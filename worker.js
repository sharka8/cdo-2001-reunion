import { onRequestPost, onRequestGet } from './functions/api/create-checkout.js';
import { handleStripeWebhook } from './functions/api/stripe-webhook.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/create-checkout') {
      if (request.method === 'POST') {
        return onRequestPost({
          request,
          env,
          waitUntil: ctx.waitUntil.bind(ctx)
        });
      }
      return onRequestGet({ request, env });
    }

    if (url.pathname === '/api/stripe-webhook') {
      if (request.method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Method not allowed.' }),
          {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      return handleStripeWebhook(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
