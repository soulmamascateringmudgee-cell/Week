// POST /api/create-checkout
// Creates a Stripe Checkout session for one "pay for 5, get 7" coffee bundle.
// Requires the customer's Supabase JWT in the Authorization header.
import Stripe from 'stripe';
import { userFromRequest, programConfig, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return send(res, 503, { error: 'Payments not configured yet' });

  const user = await userFromRequest(req);
  if (!user) return send(res, 401, { error: 'Please sign in first' });

  const cfg = programConfig();
  const stripe = new Stripe(secret);

  // Where Stripe sends the customer back to.
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: { userId: user.id, coffees: String(cfg.bundleCoffees) },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: cfg.currency,
          unit_amount: cfg.priceCents,
          product_data: {
            name: 'Coffee Kingdom — Coffee Bundle',
            description: `Pay for ${cfg.payCoffees} coffees, get ${cfg.bundleCoffees}. Redeem at either Mudgee café.`,
          },
        },
      }],
      success_url: `${origin}/app/?paid=success`,
      cancel_url: `${origin}/app/?paid=cancel`,
    });

    return send(res, 200, { url: session.url });
  } catch (err) {
    console.error('create-checkout error', err);
    return send(res, 500, { error: 'Could not start checkout' });
  }
}
