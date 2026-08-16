"use client";

import { useCallback, useEffect, useState } from "react";

interface Invite {
  email: string;
  is_admin: boolean;
  note: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/invites");
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Couldn't load the invite list.");
      } else {
        setError("");
        setInvites(body.invites as Invite[]);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, note }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Couldn't add that invite.");
      } else {
        setEmail("");
        setNote("");
        setError("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(target: string) {
    if (!window.confirm(`Remove ${target}? They lose access straight away.`)) return;
    const response = await fetch(`/api/invites?email=${encodeURIComponent(target)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Couldn't remove that invite.");
    }
    await load();
  }

  return (
    <>
      <h1>Who&rsquo;s allowed in</h1>
      <p className="lede">
        Only the addresses on this list can use the app. Add a buyer here the
        moment they&rsquo;ve paid, and take them off when they stop.
      </p>

      <form onSubmit={add}>
        <div className="card">
          <h2>Invite someone</h2>
          <label htmlFor="invite-email">
            Their email
            <span className="hint">
              The exact address they&rsquo;ll sign in with.
            </span>
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="chef@theirvenue.com.au"
          />
          <label htmlFor="invite-note">
            Note
            <span className="hint">
              For you, not them. &ldquo;Paid $450, 12 Aug.&rdquo;
            </span>
          </label>
          <input
            id="invite-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="actions">
            <button type="submit" disabled={busy || email.trim() === ""}>
              {busy ? "Adding…" : "Add to the list"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p className="notice">
          <strong>{error}</strong>
        </p>
      )}
      {loading && <div className="card">Loading…</div>}

      {invites.map((invite) => (
        <div className="card" key={invite.email}>
          <h2 style={{ marginBottom: 4 }}>{invite.email}</h2>
          <p className="basis">
            {invite.is_admin ? "Owner" : "Operator"}
            {invite.note && ` · ${invite.note}`} · added{" "}
            {new Date(invite.created_at).toLocaleDateString("en-AU")}
          </p>
          {!invite.is_admin && (
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => void remove(invite.email)}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <h2>One thing to know</h2>
        <p>
          Removing someone takes their access away immediately, but it
          doesn&rsquo;t delete the jobs they saved — those stay in the database,
          out of reach, in case they come back.
        </p>
      </div>
    </>
  );
}
