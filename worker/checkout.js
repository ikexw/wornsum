// Cloudflare Worker — Wornsum payment backend
// Endpoints:
//   POST /checkout        → create Stripe Checkout Session, return { url }
//   GET  /session?id=...  → sanitized session details for success page
//   POST /mark-sold       → verify payment then mark products sold in GitHub

const STRIPE_API = 'https://api.stripe.com/v1';
const GH_API     = 'https://api.github.com/repos/ikexw/wornsum/contents/js/products.js';

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

      // Local pickup (free)
      params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
      params.append('shipping_options[0][shipping_rate_data][display_name]', 'Local Pickup');
      params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '0');
      params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');

      // Standard shipping ($5 flat)
      params.append('shipping_options[1][shipping_rate_data][type]', 'fixed_amount');
      params.append('shipping_options[1][shipping_rate_data][display_name]', 'Standard Shipping');
      params.append('shipping_options[1][shipping_rate_data][fixed_amount][amount]', '500');
      params.append('shipping_options[1][shipping_rate_data][fixed_amount][currency]', 'usd');
      params.append('shipping_options[1][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
      params.append('shipping_options[1][shipping_rate_data][delivery_estimate][minimum][value]', '3');
      params.append('shipping_options[1][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
      params.append('shipping_options[1][shipping_rate_data][delivery_estimate][maximum][value]', '7');

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

    // ── POST /mark-sold ────────────────────────────────────────
    // Verifies Stripe payment then marks purchased products as sold in GitHub.
    if (request.method === 'POST' && url.pathname === '/mark-sold') {
      let body;
      try { body = await request.json(); } catch {
        return json({ error: 'Invalid JSON' }, 400, cors);
      }

      const { session_id, product_ids } = body;
      if (!session_id || !Array.isArray(product_ids) || product_ids.length === 0) {
        return json({ error: 'Missing session_id or product_ids' }, 400, cors);
      }

      // Verify payment with Stripe
      const session = await stripeGet(env, `/checkout/sessions/${session_id}`);
      if (session.error || session.payment_status !== 'paid') {
        return json({ error: 'Payment not verified' }, 402, cors);
      }

      if (!env.GITHUB_TOKEN) {
        return json({ error: 'GITHUB_TOKEN not configured on Worker' }, 500, cors);
      }

      const ghHeaders = {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      };

      // Fetch current products.js
      const fileRes = await fetch(GH_API, { headers: ghHeaders });
      if (!fileRes.ok) return json({ error: 'Could not read products.js' }, 500, cors);
      const file   = await fileRes.json();
      const source = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));

      // Parse products array (content is JSON.stringify output so JSON.parse is safe)
      const pMatch = source.match(/const products\s*=\s*(\[[\s\S]*?\]);/);
      if (!pMatch) return json({ error: 'Could not parse products.js' }, 500, cors);
      let products;
      try { products = JSON.parse(pMatch[1]); } catch {
        return json({ error: 'JSON parse failed' }, 500, cors);
      }

      // Mark matching products as sold
      let changed = false;
      products = products.map(p => {
        if (product_ids.includes(p.id) && !p.sold) {
          changed = true;
          return { ...p, sold: true };
        }
        return p;
      });
      if (!changed) return json({ ok: true, changed: false }, 200, cors);

      // Rebuild products.js (preserve dropTime)
      const updatedSource = source.replace(
        /const products\s*=\s*\[[\s\S]*?\];/,
        `const products = ${JSON.stringify(products, null, 2)};`
      );

      const encoded = btoa(unescape(encodeURIComponent(updatedSource)));
      const putRes  = await fetch(GH_API, {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `Mark sold: order ${session_id.slice(0, 20)}`,
          content: encoded,
          sha: file.sha,
        }),
      });

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        return json({ error: err.message || 'GitHub write failed' }, 500, cors);
      }

      return json({ ok: true, changed: true }, 200, cors);
    }

    return new Response('Not found', { status: 404, headers: cors });
  },
};
