// POST /api/square-webhook
// Square calls this when a payment completes. We verify the signature, look up
// the order's metadata (which carries the customer + bundle size), then credit
// the coffee balance. Configure a Square webhook subscription for the
// `payment.updated` event pointing at this URL, and set the signature key.
import crypto from 'node:crypto';
import { admin, readRawBody, squareBase, squareHeaders, send } from './_lib.js';

export const config = { api: { bodyParser: false } };

function safeEqual(a, b) {
  const ab = Buffer.from(a || '', 'utf8');
  const bb = Buffer.from(b || '', 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const sigKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!sigKey || !token) return send(res, 503, { error: 'Webhook not configured' });

  const raw = (await readRawBody(req)).toString('utf8');

  // Square signs: base64( HMAC-SHA256( signatureKey, notificationUrl + body ) )
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const notifyUrl = process.env.SQUARE_WEBHOOK_URL || `${proto}://${host}${req.url}`;
  const expected = crypto.createHmac('sha256', sigKey).update(notifyUrl + raw).digest('base64');
  const got = req.headers['x-square-hmacsha256-signature'];
  if (!safeEqual(got, expected)) {
    console.error('Square webhook signature mismatch');
    return send(res, 400, { error: 'Bad signature' });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return send(res, 400, { error: 'Bad body' }); }

  if (event.type === 'payment.updated' || event.type === 'payment.created') {
    const payment = event.data?.object?.payment;
    if (payment && payment.status === 'COMPLETED' && payment.order_id) {
      try {
        const orderRes = await fetch(`${squareBase()}/v2/orders/${payment.order_id}`, { headers: squareHeaders() });
        const order = (await orderRes.json()).order;
        const meta = order?.metadata || {};
        const userId = meta.userId;
        const coffees = parseInt(meta.coffees || '0', 10);
        const amount = payment.amount_money?.amount ?? order?.total_money?.amount ?? null;

        if (userId && coffees > 0) {
          const { error } = await admin().rpc('add_credit', {
            p_user: userId, p_coffees: coffees, p_amount_cents: amount, p_session: payment.id,
          });
          if (error) { console.error('add_credit failed', error); return send(res, 500, { error: 'credit failed' }); }
        }
      } catch (err) {
        console.error('square-webhook order lookup failed', err);
        return send(res, 500, { error: 'processing failed' });
      }
    }
  }

  return send(res, 200, { received: true });
}
