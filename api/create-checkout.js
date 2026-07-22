// POST /api/create-checkout
// Creates a Square hosted checkout (payment link) for one "pay for 5, get 7"
// coffee bundle. Requires the customer's Supabase JWT in the Authorization header.
import crypto from 'node:crypto';
import { userFromRequest, programConfig, squareBase, squareHeaders, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const token = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!token || !locationId) return send(res, 503, { error: 'Payments not configured yet' });

  const user = await userFromRequest(req);
  if (!user) return send(res, 401, { error: 'Please sign in first' });

  const cfg = programConfig();

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;

  try {
    const resp = await fetch(`${squareBase()}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: squareHeaders(),
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        order: {
          location_id: locationId,
          line_items: [{
            name: 'Coffee Kingdom — Coffee Bundle',
            quantity: '1',
            base_price_money: { amount: cfg.priceCents, currency: cfg.currency.toUpperCase() },
            note: `Pay for ${cfg.payCoffees}, get ${cfg.bundleCoffees}`,
          }],
          // Carried through to the order so the webhook knows who to credit.
          metadata: { userId: user.id, coffees: String(cfg.bundleCoffees) },
        },
        checkout_options: { redirect_url: `${origin}/app/?paid=success`, ask_for_shipping_address: false },
        pre_populated_data: user.email ? { buyer_email: user.email } : undefined,
      }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.payment_link?.url) {
      console.error('Square payment link error', JSON.stringify(data.errors || data));
      return send(res, 502, { error: 'Could not start checkout' });
    }

    return send(res, 200, { url: data.payment_link.url });
  } catch (err) {
    console.error('create-checkout error', err);
    return send(res, 500, { error: 'Could not start checkout' });
  }
}
