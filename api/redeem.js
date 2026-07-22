// POST /api/redeem   { pin: "1234" }
// Redeems one coffee from the signed-in customer's balance. A staff member
// enters the café PIN (STAFF_PIN) on the customer's phone to authorise it.
import { admin, userFromRequest, send, readRawBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const staffPin = process.env.STAFF_PIN;
  if (!staffPin) return send(res, 503, { error: 'Redemption not configured yet' });

  const user = await userFromRequest(req);
  if (!user) return send(res, 401, { error: 'Please sign in first' });

  let body = {};
  try { body = JSON.parse((await readRawBody(req)).toString() || '{}'); } catch { /* ignore */ }

  const pin = String(body.pin || '').trim();
  if (!pin || pin !== String(staffPin)) {
    return send(res, 403, { error: 'Incorrect staff PIN' });
  }

  const { data, error } = await admin().rpc('redeem_one', {
    p_user: user.id,
    p_note: 'Staff PIN redemption',
  });

  if (error) {
    if ((error.message || '').includes('no_coffees_left')) {
      return send(res, 409, { error: 'No coffees left on this account' });
    }
    console.error('redeem error', error);
    return send(res, 500, { error: 'Could not redeem' });
  }

  return send(res, 200, { balance: data });
}
