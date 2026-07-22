// POST /api/stripe-webhook
// Stripe calls this after a successful payment. We verify the signature, then
// credit the customer's coffee balance. Set STRIPE_WEBHOOK_SECRET in Vercel and
// point a Stripe webhook (checkout.session.completed) at this URL.
import Stripe from 'stripe';
import { admin, readRawBody, send } from './_lib.js';

// Stripe signature verification needs the raw, unparsed body.
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) return send(res, 503, { error: 'Webhook not configured' });

  const stripe = new Stripe(secret);
  const raw = await readRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err) {
    console.error('Webhook signature failed', err.message);
    return send(res, 400, { error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId || session.client_reference_id;
    const coffees = parseInt(session.metadata?.coffees || '0', 10);

    if (userId && coffees > 0) {
      const { error } = await admin().rpc('add_credit', {
        p_user: userId,
        p_coffees: coffees,
        p_amount_cents: session.amount_total ?? null,
        p_session: session.id,
      });
      if (error) {
        console.error('add_credit failed', error);
        return send(res, 500, { error: 'Could not credit account' });
      }
    }
  }

  return send(res, 200, { received: true });
}
