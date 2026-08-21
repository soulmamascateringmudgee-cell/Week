"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client.ts";

/** Why a sign-in link didn't work, in words a chef can act on. */
const PROBLEMS: Record<string, string> = {
  "same-browser":
    "That link has to be opened in the same browser you asked for it from. Request a new one here, then open the email on this device.",
  expired:
    "That link has already been used or has expired. They're good once, for an hour. Request a fresh one below.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/jobs";
  const problem = searchParams.get("problem");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /**
   * The email sender is rate limited and links are fussy about which browser
   * opens them. A password always works, from any device, immediately — which
   * matters at 6am when service starts at 7.
   */
  async function signInWithPassword(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const { error: signInError } = await createClient().auth.signInWithPassword(
      { email, password },
    );

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "That email and password don't match. Check both, or use a sign-in link instead."
          : signInError.message,
      );
      setBusy(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const supabase = createClient();
    const redirect = new URL("/auth/confirm", window.location.origin);
    redirect.searchParams.set("next", next);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.toString() },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setSent(true);
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="card">
        <h2>Check your email</h2>
        <p>
          There&rsquo;s a link on its way to <strong>{email}</strong>. Open it on
          this device and you&rsquo;re in — no password to remember.
        </p>
        <p className="basis">
          Nothing after a minute or two? Check the junk folder, then try again.
        </p>
      </div>
    );
  }

  return (
    <>
      {problem && PROBLEMS[problem] && (
        <p className="notice warn">{PROBLEMS[problem]}</p>
      )}

      <form onSubmit={signInWithPassword}>
        <div className="card">
          <label htmlFor="email">
            Email
            <span className="hint">
              Access is by invitation, so use the address you were set up with.
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
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="notice warn" style={{ marginTop: 12 }}>
              <strong>{error}</strong>
            </p>
          )}

          <div className="actions">
            <button
              type="submit"
              disabled={busy || email.trim() === "" || password === ""}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </div>
      </form>

      <form onSubmit={submit}>
        <div className="card">
          <h2>No password?</h2>
          <p className="basis">
            We&rsquo;ll email a link to the address above instead. Open it in
            this same browser — links are tied to the device that asked for
            them. Sending is capped at a couple an hour, so a password is the
            reliable way in.
          </p>
          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={submit}
              disabled={busy || email.trim() === ""}
            >
              {busy ? "Sending…" : "Email me a link"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <>
      <h1>Sign in</h1>
      <p className="lede">
        Your order lists and par levels are saved to your account, so you can
        pull up a job you&rsquo;ve already run and scale from what you actually
        used.
      </p>
      <Suspense fallback={<div className="card">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </>
  );
}
