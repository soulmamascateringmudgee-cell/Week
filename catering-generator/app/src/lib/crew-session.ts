import { cookies } from "next/headers";

import { hashToken } from "./crew-access.ts";
import { adminClientConfigured, createAdminClient } from "./supabase/admin.ts";

/**
 * Who is using the crew app right now.
 *
 * Crew members are not Supabase accounts, so none of this rides on auth.uid()
 * and none of it gets row-level security for free. Every crew route reaches
 * the database with the secret key, which bypasses RLS entirely — so the
 * scoping has to be done here, in one place, and every query downstream has
 * to be filtered by what this returns.
 *
 * The rule the routes follow: never take an owner_id or a staff_id from the
 * request. Take them from the session. A request can say which shift it is
 * replying to; it cannot say who it is.
 */

export const CREW_COOKIE = "crew_session";

export interface CrewSession {
  staffId: string;
  ownerId: string;
  name: string;
}

/** The signed-in crew member, or null. Expired sessions are null and swept. */
export async function crewSession(): Promise<CrewSession | null> {
  if (!adminClientConfigured()) return null;

  const jar = await cookies();
  const token = jar.get(CREW_COOKIE)?.value;
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crew_sessions")
    .select("staff_id, owner_id, expires_at, staff(name, active)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data) return null;

  if (new Date(data.expires_at) <= new Date()) {
    await admin.from("crew_sessions").delete().eq("token_hash", hashToken(token));
    return null;
  }

  // A row on staff can be marked as left after the session was issued. The
  // session outliving the job would be a former casual still reading the
  // roster, so the check is here rather than only at sign-in.
  const person = data.staff as unknown as { name: string; active: boolean } | null;
  if (!person || !person.active) return null;

  return { staffId: data.staff_id, ownerId: data.owner_id, name: person.name };
}
