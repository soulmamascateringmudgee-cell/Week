import SignOutButton from "@/components/SignOutButton.tsx";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * Where an account that isn't on the invite list lands. Signing in worked;
 * it just doesn't buy anything. Say so plainly rather than bouncing them
 * around the login page.
 */
export default async function NoAccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <h1>You&rsquo;re signed in, but not invited yet</h1>
      <div className="card">
        <p>
          This app is invite-only. Your email
          {user?.email ? (
            <>
              {" "}
              — <strong>{user.email}</strong> —
            </>
          ) : null}{" "}
          isn&rsquo;t on the list, so there&rsquo;s nothing here for you yet.
        </p>
        <p>
          If you&rsquo;re expecting access, reply to whoever set you up and ask
          them to add this exact address. If you signed in with a different one
          by mistake, sign out and try again.
        </p>
        <div className="actions">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
