import { onRequestPost, onRequestGet } from './functions/api/create-checkout.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/create-checkout') {
      if (request.method === 'POST') {
        return onRequestPost({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
      }
      return onRequestGet({ request, env });
    }

    return env.ASSETS.fetch(request);
  }
};
