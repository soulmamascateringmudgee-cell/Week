// GET /api/config
// Public, browser-safe configuration for the loyalty app. The Supabase URL and
// anon key are safe to expose (Row Level Security protects the data), so they're
// hardcoded here as the source of truth — this avoids env-var copy/paste issues
// where an invisible character corrupts the key and breaks requests.
import { programConfig, send } from './_lib.js';

// Strip anything outside printable ASCII (defensive against paste gremlins).
const clean = (s) => (s || '').replace(/[^\x21-\x7E]/g, '');

const SUPABASE_URL = 'https://gcasdasjlbxggnxcvtzp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjYXNkYXNqbGJ4Z2dueGN2dHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NzI5ODcsImV4cCI6MjEwMDI0ODk4N30.jrvBlXE8VlSm2m9-cK7BCY13vEiRAYZVREFiMTCUMtg';

export default async function handler(req, res) {
  const cfg = programConfig();
  return send(res, 200, {
    configured: true,
    paymentsConfigured: Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID),
    supabaseUrl: clean(SUPABASE_URL),
    supabaseAnonKey: clean(SUPABASE_ANON_KEY),
    payCoffees: cfg.payCoffees,
    bundleCoffees: cfg.bundleCoffees,
    priceCents: cfg.priceCents,
    currency: cfg.currency,
  });
}
