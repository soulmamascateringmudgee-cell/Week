"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { MIN_PASSWORD, passwordProblem } from "@/lib/signup-rules.ts";
import { createClient } from "@/lib/supabase/client.ts";

/**
 * Where an invited operator sets their own password.
 *
 * They land here from the invite email. Two boxes, no verification link to
 * wait for, and it signs them straight in at the end — the first minute of
 * using something new is the one where people give up, so there is nothing
 * between "set a password" and being inside the app.
 */
function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The invite email can carry the address, so most people never type it.
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Checked as they type so the rule is never a surprise at the end, but only
  // once they've started — an empty box isn't a mistake yet.
  const localProblem = password === "" ? null : passwordProblem(password, email);

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Couldn't set that up. Try again in a moment.");
        setBusy(false);
        return;
      }

      // The account exists now, so sign them in with what they just typed
      // rather than sending them to a login page to type it a second time.
      const { error: signInError } = await createClient().auth.signInWithPassword(
        { email, password },
      );

      if (signInError) {
        // The account is real and the password is set, so this is recoverable
        // and they need to know that before they try signing up again.
        setError(
          "Your account is set up, but signing you in didn't work. Go to the sign-in page and use the password you just chose.",
        );
        setBusy(false);
        return;
      }

      router.push("/recipes");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="card">
        <label htmlFor="email">
          Your email
          <span className="hint">
            The exact address you were invited on.
          </span>
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com.au"
        />

        <label htmlFor="password" style={{ marginTop: 14 }}>
          Pick a password
          <span className="hint">
            At least {MIN_PASSWORD} characters. Three words you&rsquo;ll
            remember beats one clever one.
          </span>
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {localProblem && (
          <p className="basis" style={{ marginTop: 8 }}>
            {localProblem}
          </p>
        )}

        {error && (
          <p className="notice warn" style={{ marginTop: 12 }}>
            <strong>{error}</strong>
          </p>
        )}

        <div className="actions">
          <button
            type="submit"
            disabled={busy || email.trim() === "" || localProblem !== null || password === ""}
          >
            {busy ? "Setting you up…" : "Set my password and go in"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function SignupPage() {
  return (
    <>
      <h1>Set your password</h1>
      <p className="lede">
        Access is by invitation. If your email is on the list, this is all
        that&rsquo;s between you and your first order sheet — there&rsquo;s no
        confirmation link to wait for.
      </p>
      <Suspense fallback={<div className="card">Loading…</div>}>
        <SignupForm />
      </Suspense>
      <p className="basis">
        Already set one up? <Link href="/login">Sign in instead</Link>. Your
        recipes stay locked to your own login — see{" "}
        <Link href="/privacy">what happens to your data</Link>.
      </p>
    </>
  );
}
