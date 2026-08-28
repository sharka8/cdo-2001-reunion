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
    let survey;
    try {
      survey = validateSurvey(payload.classmateResponses);
    } catch (error) {
      return jsonResponse({ error: error.message }, 400);
    }
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
    // Split on code points, never inside an emoji's surrogate pair.
    const encoded = JSON.stringify(survey);
    if (encoded.length > 19000) return jsonResponse({ error: 'Please shorten your survey responses.' }, 400);
    const chunks = [''];
    for (const character of encoded) {
      if (chunks[chunks.length - 1].length + character.length > 500) chunks.push('');
      chunks[chunks.length - 1] += character;
    }
    metadata.survey_chunks = String(chunks.length);
    chunks.forEach((chunk, index) => { metadata[`survey_${index}`] = chunk; });

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

export function validateSurvey(value = []) {
  if (!Array.isArray(value) || value.length > 6) throw new Error('Please provide at most six classmate responses.');
  const careers = ['', 'Education', 'Healthcare', 'Engineering / Technology', 'Business', 'Skilled trades', 'Public service / Military', 'Arts / Media', 'Hospitality', 'Full-time caregiving', 'Student', 'Retired', 'Other'];
  return value.map((record) => {
    if (!record || typeof record !== 'object') throw new Error('Invalid classmate response.');
    const result = {};
    for (const [key, limit] of Object.entries({name:100, location:120, career:60, careerOther:100, accomplishment:400, memory:400})) {
      const text = record[key] ?? '';
      if (typeof text !== 'string' || text.length > limit) throw new Error(`Please shorten the ${key} answer (maximum ${limit} characters).`);
      result[key] = text.trim();
    }
    if (!careers.includes(result.career)) throw new Error('Please choose a listed career field.');
    for (const key of ['children', 'grandchildren']) {
      const raw = record[key];
      result[key] = raw === '' || raw == null ? null : Number(raw);
      if (result[key] !== null && ((typeof raw !== 'string' && typeof raw !== 'number') || !Number.isInteger(result[key]) || result[key] < 0 || result[key] > 100)) throw new Error('Family counts must be whole numbers from 0 to 100, or blank.');
    }
    result.shareWithName = record.shareWithName === true;
    return result;
  }).filter((r) => r.location || r.career || r.careerOther || r.accomplishment || r.memory || r.children !== null || r.grandchildren !== null);
}
