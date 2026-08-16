import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client holding the project's secret key.
 *
 * SERVER ONLY. This key bypasses row-level security completely — it can read
 * and write every operator's recipes and every job. It must never be imported
 * into a client component. The env var deliberately has no NEXT_PUBLIC_ prefix
 * so Next won't inline it into the browser bundle even by accident.
 *
 * It exists for exactly one job: creating an account for someone already on
 * the invite list, which nothing running as `anon` is allowed to do. Anything
 * that can be done with the ordinary signed-in client should be.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    // Thrown rather than returned so a missing key can't be mistaken for a
    // working client that quietly does nothing.
    throw new Error("SUPABASE_SECRET_KEY is not set on this deployment.");
  }

  return createSupabaseClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Whether self-serve signup can work at all on this deployment. */
export function adminClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  );
}
