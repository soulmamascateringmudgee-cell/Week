"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SaveJob({
  mode,
  input,
  plan,
  defaultTitle,
  eventDate,
}: {
  mode: "event" | "service";
  /** The form state, saved verbatim so opening the job restores it exactly. */
  input: unknown;
  /**
   * The sheet this form produced, saved with it.
   *
   * Kept so opening the job shows the list the food was ordered against.
   * Regenerating would rebuild it from today's prices, today's recipes and
   * today's pantry count, and hand back a different sheet without saying so.
   */
  plan?: unknown;
  defaultTitle: string;
  eventDate?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, title, eventDate, input, plan }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Couldn't save that job.");
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <p className="basis">
        Saved. It&rsquo;s in{" "}
        <a href="/jobs">your saved jobs</a> — record what you actually used once
        it&rsquo;s done.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        Save this job
      </button>
    );
  }

  return (
    <div style={{ flexBasis: "100%" }}>
      <label htmlFor="job-title">
        Name it
        <span className="hint">So you can find it again next time</span>
      </label>
      <input
        id="job-title"
        type="text"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
      />
      {error && (
        <p className="notice warn" style={{ marginTop: 10 }}>
          <strong>{error}</strong>
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || title.trim() === ""}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
