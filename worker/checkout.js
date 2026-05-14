// Cloudflare Worker — Wornsum payment backend
// Endpoints:
//   POST /checkout  → create Stripe Checkout Session, return { url }
//   GET  /session?id=cs_xxx → return sanitized session details for success page

const STRIPE_API = 'https://api.stripe.com/v1';

const ALLOWED_ORIGINS = [
  'https://wornsum.com',
  'https://www.wornsum.com',
  'http://localhost',
  'http://127.0.0.1',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.some(o => (origin || '').startsWith(o));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://wornsum.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

async function stripeGet(env, path) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors   = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── POST /checkout ─────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/checkout') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400, cors);
      }

      const { items, note } = body;
      if (!Array.isArray(items) || items.length === 0) {
        return json({ error: 'Cart is empty' }, 400, cors);
      }

      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('success_url', 'https://wornsum.com/success.html?session_id={CHECKOUT_SESSION_ID}');
      params.append('cancel_url', 'https://wornsum.com/cart.html');

      // Collect shipping address via Stripe
      const countries = ['US', 'CA', 'GB', 'AU', 'NZ', 'IE'];
      countries.forEach((c, i) =>
        params.append(`shipping_address_collection[allowed_countries][${i}]`, c)
      );

      if (note) params.append('metadata[note]', String(note).slice(0, 500));

      items.forEach((item, i) => {
        params.append(`line_items[${i}][price_data][currency]`, 'usd');
        params.append(`line_items[${i}][price_data][product_data][name]`, String(item.name));
        if (item.size) {
          params.append(
            `line_items[${i}][price_data][product_data][description]`,
            `Size: ${item.size}`
          );
        }
        params.append(
          `line_items[${i}][price_data][unit_amount]`,
          String(Math.round(Number(item.price) * 100))
        );
        params.append(`line_items[${i}][quantity]`, String(item.qty));
      });

      const stripeRes = await fetch(`${STRIPE_API}/checkout/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const session = await stripeRes.json();

      if (session.error) {
        return json({ error: session.error.message }, 500, cors);
      }

      return json({ url: session.url }, 200, cors);
    }

    // ── GET /session?id=cs_xxx ─────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/session') {
      const id = url.searchParams.get('id');
      if (!id || !id.startsWith('cs_')) {
        return json({ error: 'Invalid session ID' }, 400, cors);
      }

      const session = await stripeGet(env, `/checkout/sessions/${id}`);

      if (session.error) {
        return json({ error: session.error.message }, 404, cors);
      }

      return json({
        id:           session.id,
        status:       session.payment_status,
        email:        session.customer_details?.email  || null,
        name:         session.customer_details?.name   || null,
        amount_total: session.amount_total,
        currency:     session.currency,
        note:         session.metadata?.note           || null,
      }, 200, cors);
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
};
