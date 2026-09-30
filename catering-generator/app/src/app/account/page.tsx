"use client";

import { useEffect, useState } from "react";

import {
  BRANDS,
  DEFAULT_BRAND_LABEL,
  DEFAULT_BRAND_NOTE,
} from "@/lib/brand.ts";
import { MIN_PASSWORD, passwordProblem } from "@/lib/signup-rules.ts";
import { createClient } from "@/lib/supabase/client.ts";

/**
 * Changing your password.
 *
 * The current password is asked for and actually checked, by signing in with
 * it before the change goes through. Supabase doesn't require that on its own,
 * which means a laptop left open on a bench in a commercial kitchen is enough
 * for someone to lock the owner out of their own recipes. Cheap to prevent.
 */
export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [brand, setBrand] = useState<string | null>(null);
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandError, setBrandError] = useState("");

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      setEmail(user?.email ?? "");
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) return;
        const body = await response.json();
        setBrand(typeof body.brand === "string" ? body.brand : null);
      } catch {
        // The colours are already on the page. Failing to read back which
        // one is showing is not worth an error message.
      }
    })();
  }, []);

  async function chooseBrand(next: string | null) {
    setBrandBusy(true);
    setBrandError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand: next }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setBrandError(body.error ?? "Couldn't save that.");
        setBrandBusy(false);
        return;
      }
      // The palette is set on the html element by the server, so the page
      // has to come back from the server to wear it.
      window.location.reload();
    } catch {
      setBrandError("Couldn't reach the server.");
      setBrandBusy(false);
    }
  }

  const problem = next === "" ? null : passwordProblem(next, email);
  const sameAsOld = next !== "" && next === current;

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");
    setDone(false);

    const supabase = createClient();

    const { error: checkError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (checkError) {
      setError("That's not your current password. Nothing has been changed.");
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: next,
    });
    if (updateError) {
      setError(`${updateError.message} Your old password still works.`);
      setBusy(false);
      return;
    }

    setCurrent("");
    setNext("");
    setDone(true);
    setBusy(false);
  }

  return (
    <>
      <h1>Your account</h1>
      <p className="lede">
        Signed in as <strong>{email || "…"}</strong>.
      </p>

      <form onSubmit={submit}>
        <div className="card">
          <h2>Change your password</h2>

          <label htmlFor="current">Current password</label>
          <input
            id="current"
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />

          <label htmlFor="next" style={{ marginTop: 14 }}>
            New password
            <span className="hint">At least {MIN_PASSWORD} characters.</span>
          </label>
          <input
            id="next"
            type="password"
            required
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />

          {problem && (
            <p className="basis" style={{ marginTop: 8 }}>
              {problem}
            </p>
          )}
          {sameAsOld && (
            <p className="basis" style={{ marginTop: 8 }}>
              That&rsquo;s the same as your current one.
            </p>
          )}

          {error && (
            <p className="notice warn" style={{ marginTop: 12 }}>
              <strong>{error}</strong>
            </p>
          )}
          {done && (
            <p className="notice ok" style={{ marginTop: 12 }}>
              <strong>Password changed.</strong> Use the new one next time you
              sign in. You&rsquo;re still signed in here.
            </p>
          )}

          <div className="actions">
            <button
              type="submit"
              disabled={
                busy ||
                current === "" ||
                next === "" ||
                problem !== null ||
                sameAsOld
              }
            >
              {busy ? "Changing…" : "Change my password"}
            </button>
          </div>
        </div>
      </form>

      <div className="card">
        <h2>Your colours</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          How the app looks on your screens. Nobody else&rsquo;s login is
          affected, and printed sheets come out the same either way — ink on
          white paper.
        </p>

        <div className="brand-pick">
          <button
            type="button"
            className={`brand-option${brand === null ? " on" : ""}`}
            disabled={brandBusy}
            onClick={() => void chooseBrand(null)}
          >
            <span className="brand-name">{DEFAULT_BRAND_LABEL}</span>
            <span className="brand-note">{DEFAULT_BRAND_NOTE}</span>
            {brand === null && <span className="brand-on">In use</span>}
          </button>

          {BRANDS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`brand-option${brand === option.key ? " on" : ""}`}
              disabled={brandBusy}
              onClick={() => void chooseBrand(option.key)}
            >
              <span className="brand-name">{option.label}</span>
              <span className="brand-note">{option.note}</span>
              {brand === option.key && <span className="brand-on">In use</span>}
            </button>
          ))}
        </div>

        {brandError && (
          <p className="notice warn" style={{ marginTop: 12 }}>
            <strong>{brandError}</strong>
          </p>
        )}
      </div>

      <div className="card">
        <h2>Your recipes</h2>
        <p>
          Everything you save — recipes, prices, jobs — is locked to this login.
          No other operator on this app can read it, and it isn&rsquo;t used for
          anything except working out your own orders. The full note is on the{" "}
          <a href="/privacy">privacy page</a>.
        </p>
      </div>
    </>
  );
}
