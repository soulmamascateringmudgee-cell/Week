import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Invite-only, in one place.
 *
 * Being signed in is not permission to use this app. Anyone can ask Supabase
 * for a magic link, so the question that matters is whether the email on the
 * session is on the invite list — and that answer comes from the database,
 * which enforces the same rule on every row underneath.
 *
 * Both calls fail closed: an error means "no".
 */

export async function isInvited(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_invited");
  return !error && data === true;
}

export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}
