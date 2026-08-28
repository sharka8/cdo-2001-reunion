function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  const parts = signatureHeader.split(',');
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = bytesToHex(digest);
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

export async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.GOOGLE_SHEETS_WEBHOOK_URL || !env.SHEETS_SHARED_SECRET) {
    return jsonResponse({ error: 'Registration spreadsheet webhook is not configured.' }, 500);
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('Stripe-Signature') || '';
  const verified = await verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!verified) return jsonResponse({ error: 'Invalid Stripe signature.' }, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid event payload.' }, 400);
  }

  const acceptedEvents = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);
  if (!acceptedEvents.has(event.type)) return jsonResponse({ received: true, ignored: true });

  const session = event.data?.object;
  if (!session || session.payment_status !== 'paid') {
    return jsonResponse({ received: true, ignored: true });
  }

  const metadata = session.metadata || {};
  const sheetPayload = {
    sharedSecret: env.SHEETS_SHARED_SECRET,
    paymentDate: new Date((session.created || event.created) * 1000).toISOString(),
    graduateName: metadata.graduate_name || '',
    formerName: metadata.former_name || '',
    email: session.customer_details?.email || session.customer_email || '',
    phone: metadata.phone || session.customer_details?.phone || '',
    tickets: Number(metadata.ticket_quantity || 0),
    guestNames: metadata.guest_names || '',
    fridayCongress: metadata.friday_concert || 'No',
    familyPicnic: metadata.saturday_picnic || 'No',
    cdoTourPhotos: metadata.cdo_tour_photos || 'No',
    amountPaid: Number(session.amount_total || 0) / 100,
    currency: String(session.currency || '').toUpperCase(),
    stripeSessionId: session.id || '',
    paymentIntentId: session.payment_intent || '',
    paymentStatus: session.payment_status || ''
  };

  const sheetResponse = await fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(sheetPayload),
    redirect: 'follow'
  });

  const sheetResult = await sheetResponse.text();
  if (!sheetResponse.ok || !sheetResult.includes('"ok":true')) {
    console.error('Google Sheets webhook failed', sheetResponse.status, sheetResult);
    return jsonResponse({ error: 'Unable to save the paid registration.' }, 502);
  }

  return jsonResponse({ received: true, saved: true });
}
