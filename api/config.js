// GET /api/config
// Public, browser-safe configuration for the loyalty app. The frontend reads
// this on load so all settings live in Vercel env vars (nothing secret here —
// the anon key is safe to expose; RLS protects the data).
import { programConfig, send } from './_lib.js';

export default async function handler(req, res) {
  const cfg = programConfig();
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  return send(res, 200, {
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    paymentsConfigured: Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID),
    supabaseUrl,
    supabaseAnonKey,
    payCoffees: cfg.payCoffees,
    bundleCoffees: cfg.bundleCoffees,
    priceCents: cfg.priceCents,
    currency: cfg.currency,
  });
}
