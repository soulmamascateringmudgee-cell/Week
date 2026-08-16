"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface JobSummary {
  id: string;
  mode: "event" | "service";
  title: string;
  event_date: string | null;
  actuals_note: string | null;
  created_at: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/jobs");
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Couldn't load your jobs.");
      } else {
        setJobs(body.jobs as JobSummary[]);
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

  async function saveNote(id: string) {
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actualsNote: noteDraft }),
    });
    setEditing(null);
    await load();
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <h1>Saved jobs</h1>
      <p className="lede">
        Open a job to run it again with a new date or headcount. Once
        it&rsquo;s done, write down what you actually used — that&rsquo;s the
        number to scale from next time, and it beats every table in here.
      </p>

      <div className="actions" style={{ marginBottom: 20 }}>
        <Link href="/event" className="btn">
          New event
        </Link>
        <Link href="/service" className="btn secondary">
          New weekly service
        </Link>
      </div>

      {loading && <div className="card">Loading…</div>}
      {error && (
        <p className="notice">
          <strong>{error}</strong>
        </p>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="card">
          <h2>Nothing saved yet</h2>
          <p>
            Build an order list or a set of par levels, then hit save. It&rsquo;ll
            show up here.
          </p>
        </div>
      )}

      {jobs.map((job) => (
        <div className="card" key={job.id}>
          <h2 style={{ marginBottom: 4 }}>{job.title}</h2>
          <p className="basis">
            {job.mode === "event" ? "Event" : "Weekly service"}
            {job.event_date && ` · ${job.event_date}`} · saved{" "}
            {new Date(job.created_at).toLocaleDateString("en-AU")}
          </p>

          {editing === job.id ? (
            <>
              <label htmlFor={`note-${job.id}`}>
                What you actually used
                <span className="hint">
                  &ldquo;11 kg brisket, not 12.5. Ran out of slaw.&rdquo;
                </span>
              </label>
              <textarea
                id={`note-${job.id}`}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <div className="actions">
                <button type="button" onClick={() => void saveNote(job.id)}>
                  Save note
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {job.actuals_note && (
                <p style={{ whiteSpace: "pre-wrap" }}>{job.actuals_note}</p>
              )}
              <div className="actions">
                <Link href={`/${job.mode}?job=${job.id}`} className="btn">
                  Open
                </Link>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setEditing(job.id);
                    setNoteDraft(job.actuals_note ?? "");
                  }}
                >
                  {job.actuals_note ? "Edit what you used" : "Record what you used"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void remove(job.id, job.title)}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
