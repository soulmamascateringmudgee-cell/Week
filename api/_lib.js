// Shared helpers for the Coffee Kingdom loyalty API (Vercel serverless).
import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client — bypasses RLS. NEVER expose this key to the browser.
export function admin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Read program config from env (with sensible defaults).
export function programConfig() {
  return {
    payCoffees:    parseInt(process.env.PAY_COFFEES    || '5', 10),   // pay for 5…
    bundleCoffees: parseInt(process.env.BUNDLE_COFFEES || '7', 10),   // …get 7
    priceCents:    parseInt(process.env.BUNDLE_PRICE_CENTS || '2750', 10), // A$27.50
    currency:     (process.env.CURRENCY || 'aud').toLowerCase(),
  };
}

// Resolve the signed-in customer from the Authorization: Bearer <jwt> header.
export async function userFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
