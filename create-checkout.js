const MAX_METADATA_LENGTH = 500;

function cleanText(value, maxLength = MAX_METADATA_LENGTH) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function yesNo(value) {
  return value === true ? 'Yes' : 'No';
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPost(context) {
  try {
    if (!context.env.STRIPE_SECRET_KEY || !context.env.STRIPE_PRICE_ID) {
      return jsonResponse({ error: 'Checkout is not configured yet.' }, 500);
    }

    const payload = await context.request.json();
    const quantity = Number(payload.quantity);
    const firstName = cleanText(payload.firstName, 100);
    const lastName = cleanText(payload.lastName, 100);
    const email = cleanText(payload.email, 254);

    if (!firstName || !lastName || !email || !Number.isInteger(quantity) || quantity < 1 || quantity > 6) {
      return jsonResponse({ error: 'Please complete all required registration fields.' }, 400);
    }

    const origin = new URL(context.request.url).origin;
    const metadata = {
      graduate_name: `${firstName} ${lastName}`.slice(0, MAX_METADATA_LENGTH),
      former_name: cleanText(payload.formerName),
      phone: cleanText(payload.phone, 100),
      ticket_quantity: String(quantity),
      guest_names: cleanText(payload.guestNames),
      friday_concert: yesNo(payload.concert),
      saturday_picnic: yesNo(payload.picnic),
      cdo_tour_photos: yesNo(payload.cdoVisit)
    };

    const checkout = new URLSearchParams();
    checkout.set('mode', 'payment');
    checkout.set('customer_email', email);
    checkout.set('line_items[0][price]', context.env.STRIPE_PRICE_ID);
    checkout.set('line_items[0][quantity]', String(quantity));
    checkout.set('success_url', `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    checkout.set('cancel_url', `${origin}/cancel.html`);
    checkout.set('billing_address_collection', 'auto');

    for (const [key, value] of Object.entries(metadata)) {
      checkout.set(`metadata[${key}]`, value);
      checkout.set(`payment_intent_data[metadata][${key}]`, value);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: checkout.toString()
    });

    const stripeData = await stripeResponse.json();
    if (!stripeResponse.ok || !stripeData.url) {
      console.error('Stripe checkout error', stripeData);
      return jsonResponse({ error: 'Unable to start secure checkout.' }, 502);
    }

    return jsonResponse({ url: stripeData.url });
  } catch (error) {
    console.error('Checkout function error', error);
    return jsonResponse({ error: 'Unable to start secure checkout.' }, 500);
  }
}

export function onRequestGet() {
  return jsonResponse({ error: 'Method not allowed.' }, 405);
}
