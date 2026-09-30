"use client";

import { useCallback, useEffect, useState } from "react";

import { onButSaidNo, splitByDate, tally, willingButNotOn } from "@/lib/roster.ts";
import { PIN_LENGTH, pinProblem } from "@/lib/pin-rules.ts";

/**
 * The operator's side of the roster: who works for you, what's going, who
 * said they can do it, and who's on.
 *
 * Built around the two questions that actually get asked in a kitchen week:
 * "who have I heard back from" and "who's on Saturday". Everything else is
 * underneath those.
 */

interface Person {
  id: string;
  name: string;
  phone: string | null;
  role: string | null;
  note: string | null;
  active: boolean;
  hasPin: boolean;
}

interface Shift {
  id: string;
  job_id: string | null;
  title: string;
  work_date: string;
  location: string | null;
  detail: string | null;
  is_prep: boolean;
  asking: boolean;
  shift_replies: { staff_id: string; answer: "yes" | "no"; note: string | null }[];
  shift_crew: { staff_id: string; start_time: string | null; end_time: string | null }[];
}

interface Job {
  id: string;
  title: string;
  event_date: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function CrewPage() {
  const [staff, setStaff] = useState<Person[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [crewCode, setCrewCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"shifts" | "people">("shifts");

  const load = useCallback(async () => {
    try {
      const [staffRes, shiftRes, jobRes, profileRes] = await Promise.all([
        fetch("/api/staff"),
        fetch("/api/shifts"),
        fetch("/api/jobs"),
        fetch("/api/profile"),
      ]);
      if (!staffRes.ok) {
        const body = await staffRes.json().catch(() => ({}));
        setError(body.error ?? "Couldn't load your crew.");
        return;
      }
      setStaff((await staffRes.json()).staff ?? []);
      if (shiftRes.ok) setShifts((await shiftRes.json()).shifts ?? []);
      if (jobRes.ok) setJobs((await jobRes.json()).jobs ?? []);
      if (profileRes.ok) setCrewCode((await profileRes.json()).crewCode ?? null);
      setError("");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (id: string) => staff.find((p) => p.id === id)?.name ?? "someone";
  const { upcoming, past } = splitByDate(shifts, today());

  return (
    <>
      <h1>Crew</h1>
      <p className="lede">
        Who works for you, what&rsquo;s coming up, and who said they can do it.
      </p>

      {error && (
        <p className="notice warn">
          <strong>{error}</strong>
        </p>
      )}

      <div className="tabrow">
        <button
          type="button"
          className={`tabbtn${tab === "shifts" ? " on" : ""}`}
          onClick={() => setTab("shifts")}
        >
          Shifts
        </button>
        <button
          type="button"
          className={`tabbtn${tab === "people" ? " on" : ""}`}
          onClick={() => setTab("people")}
        >
          Your people{staff.length ? ` (${staff.filter((p) => p.active).length})` : ""}
        </button>
      </div>

      {loading && <div className="card">Loading…</div>}

      {!loading && tab === "shifts" && (
        <>
          <AddShift jobs={jobs} onAdded={load} />
          {upcoming.length === 0 && (
            <div className="card">
              <p>
                Nothing coming up. Add a shift above and your crew will see it
                next time they open their page.
              </p>
            </div>
          )}
          {upcoming.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              staff={staff}
              nameOf={nameOf}
              onChanged={load}
            />
          ))}
          {past.length > 0 && (
            <details className="card">
              <summary>Shifts that have been and gone ({past.length})</summary>
              <ul className="plain">
                {past.slice(0, 20).map((shift) => (
                  <li key={shift.id}>
                    {shift.work_date} — {shift.title} ·{" "}
                    {shift.shift_crew.length} on
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {!loading && tab === "people" && (
        <People staff={staff} crewCode={crewCode} onChanged={load} />
      )}
    </>
  );
}

// --------------------------------------------------------------- one shift

function ShiftCard({
  shift,
  staff,
  nameOf,
  onChanged,
}: {
  shift: Shift;
  staff: Person[];
  nameOf: (id: string) => string;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const replies = shift.shift_replies.map((r) => ({
    staffId: r.staff_id,
    answer: r.answer,
    note: r.note,
  }));
  const rostered = shift.shift_crew.map((c) => ({ staffId: c.staff_id }));
  const counts = tally(staff, replies);
  const keen = willingButNotOn(replies, rostered);
  const clash = onButSaidNo(replies, rostered);

  async function put(payload: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/shifts/${shift.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    await onChanged();
    setBusy(false);
  }

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/shifts/${shift.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    await onChanged();
    setBusy(false);
  }

  const notOn = staff.filter(
    (p) => p.active && !shift.shift_crew.some((c) => c.staff_id === p.id),
  );

  return (
    <div className="card shift">
      <div className="shift-head">
        <h2>
          {shift.title}
          {shift.is_prep && <span className="tag">Prep day</span>}
        </h2>
        <p className="basis">
          {shift.work_date}
          {shift.location ? ` · ${shift.location}` : ""}
          {shift.job_id ? " · job pack attached" : ""}
        </p>
      </div>

      {shift.detail && <p>{shift.detail}</p>}

      <div className="counts">
        <span className="count yes">
          <strong>{counts.yes}</strong> can
        </span>
        <span className="count no">
          <strong>{counts.no}</strong> can&rsquo;t
        </span>
        <span className="count waiting">
          <strong>{counts.waiting}</strong> haven&rsquo;t said
        </span>
      </div>

      {replies.length > 0 && (
        <ul className="plain answers">
          {replies.map((reply) => (
            <li key={reply.staffId} className={reply.answer}>
              <strong>{nameOf(reply.staffId)}</strong> — {reply.answer === "yes" ? "can work" : "can’t"}
              {reply.note && <em> — {reply.note}</em>}
            </li>
          ))}
        </ul>
      )}

      <h3>On the roster</h3>
      {shift.shift_crew.length === 0 ? (
        <p className="basis">Nobody on yet.</p>
      ) : (
        <ul className="plain answers">
          {shift.shift_crew.map((line) => (
            <li key={line.staff_id}>
              <strong>{nameOf(line.staff_id)}</strong>
              {line.start_time && line.end_time
                ? ` — ${line.start_time.slice(0, 5)}–${line.end_time.slice(0, 5)}`
                : " — times not set"}{" "}
              <button
                type="button"
                className="linklike"
                disabled={busy}
                onClick={() => void put({ staffId: line.staff_id, on: false })}
              >
                take off
              </button>
            </li>
          ))}
        </ul>
      )}

      {keen.length > 0 && (
        <p className="notice check">
          <strong>Said yes, not on yet:</strong> {keen.map(nameOf).join(", ")}
        </p>
      )}
      {clash.length > 0 && (
        <p className="notice warn">
          <strong>On the roster but said they can&rsquo;t:</strong>{" "}
          {clash.map(nameOf).join(", ")}
        </p>
      )}

      {notOn.length > 0 && (
        <div className="rosterline">
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Put someone on…</option>
            {notOn.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {replies.find((r) => r.staffId === person.id)?.answer === "yes"
                  ? " — said yes"
                  : ""}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={start}
            aria-label="Start"
            onChange={(e) => setStart(e.target.value)}
          />
          <input
            type="time"
            value={end}
            aria-label="Finish"
            onChange={(e) => setEnd(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || pick === ""}
            onClick={async () => {
              await put({ staffId: pick, start, end });
              setPick("");
            }}
          >
            Add
          </button>
        </div>
      )}

      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void patch({ asking: !shift.asking })}
        >
          {shift.asking ? "Stop asking — crew is set" : "Ask the crew again"}
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- add a shift

function AddShift({ jobs, onAdded }: { jobs: Job[]; onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [location, setLocation] = useState("");
  const [detail, setDetail] = useState("");
  const [isPrep, setIsPrep] = useState(false);
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <div className="actions">
        <button type="button" onClick={() => setOpen(true)}>
          Add a shift
        </button>
      </div>
    );
  }

  return (
    <form
      className="card"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const response = await fetch("/api/shifts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, workDate, location, detail, isPrep, jobId }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setError(body.error ?? "Couldn't add that shift.");
          setBusy(false);
          return;
        }
        setTitle("");
        setWorkDate("");
        setLocation("");
        setDetail("");
        setIsPrep(false);
        setJobId("");
        setOpen(false);
        setBusy(false);
        await onAdded();
      }}
    >
      <h2>Add a shift</h2>

      <label htmlFor="shift-title">What is it</label>
      <input
        id="shift-title"
        required
        value={title}
        placeholder="Wedding at Vinegrove — 120 pax"
        onChange={(e) => setTitle(e.target.value)}
      />

      <label htmlFor="shift-date" style={{ marginTop: 12 }}>
        Which day
      </label>
      <input
        id="shift-date"
        type="date"
        required
        value={workDate}
        onChange={(e) => setWorkDate(e.target.value)}
      />

      <label htmlFor="shift-where" style={{ marginTop: 12 }}>
        Where
      </label>
      <input
        id="shift-where"
        value={location}
        placeholder="Vinegrove"
        onChange={(e) => setLocation(e.target.value)}
      />

      <label htmlFor="shift-detail" style={{ marginTop: 12 }}>
        Anything they need to know
        <span className="hint">
          Shown on their phone with the question. Start time, what to wear,
          how many senior.
        </span>
      </label>
      <textarea
        id="shift-detail"
        rows={2}
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />

      <label htmlFor="shift-job" style={{ marginTop: 12 }}>
        Attach a saved job
        <span className="hint">
          Gives the crew the prep list and the recipe sheets for it. They
          never see prices or what it cost.
        </span>
      </label>
      <select id="shift-job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
        <option value="">No job pack</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.title}
            {job.event_date ? ` — ${job.event_date}` : ""}
          </option>
        ))}
      </select>

      <label className="inline" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={isPrep}
          onChange={(e) => setIsPrep(e.target.checked)}
        />
        This is a prep day, not the event
      </label>

      {error && (
        <p className="notice warn" style={{ marginTop: 12 }}>
          <strong>{error}</strong>
        </p>
      )}

      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add it"}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------- your people

function People({
  staff,
  crewCode,
  onChanged,
}: {
  staff: Person[];
  crewCode: string | null;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const problem = pin === "" ? null : pinProblem(pin);
  const link =
    crewCode && typeof window !== "undefined"
      ? `${window.location.origin}/crew/${crewCode}`
      : null;

  return (
    <>
      <div className="card">
        <h2>Where your crew sign in</h2>
        {link ? (
          <>
            <p>
              Send them this link once. They pick their name and type their
              PIN — no email, no password, nothing to set up.
            </p>
            <code>{link}</code>
          </>
        ) : (
          <p className="basis">
            Add someone below and your crew link will appear here.
          </p>
        )}
      </div>

      <form
        className="card"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const response = await fetch("/api/staff", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, phone, role, pin }),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            setError(body.error ?? "Couldn't add them.");
            setBusy(false);
            return;
          }
          setName("");
          setPhone("");
          setRole("");
          setPin("");
          setBusy(false);
          await onChanged();
        }}
      >
        <h2>Add someone</h2>

        <label htmlFor="crew-name">Their name</label>
        <input
          id="crew-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="crew-phone" style={{ marginTop: 12 }}>
          Phone
        </label>
        <input
          id="crew-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <label htmlFor="crew-role" style={{ marginTop: 12 }}>
          Role
          <span className="hint">Whatever you call them — senior, junior, van.</span>
        </label>
        <input
          id="crew-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />

        <label htmlFor="crew-pin" style={{ marginTop: 12 }}>
          Their PIN
          <span className="hint">
            {PIN_LENGTH} digits. Read it to them — it&rsquo;s never shown
            again anywhere, and you can set a new one any time.
          </span>
        </label>
        <input
          id="crew-pin"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        {problem && <p className="basis">{problem}</p>}

        {error && (
          <p className="notice warn" style={{ marginTop: 12 }}>
            <strong>{error}</strong>
          </p>
        )}

        <div className="actions">
          <button
            type="submit"
            disabled={busy || name.trim() === "" || problem !== null}
          >
            {busy ? "Adding…" : "Add to the crew"}
          </button>
        </div>
      </form>

      {staff.map((person) => (
        <PersonCard key={person.id} person={person} onChanged={onChanged} />
      ))}
    </>
  );
}

function PersonCard({
  person,
  onChanged,
}: {
  person: Person;
  onChanged: () => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const problem = pin === "" ? null : pinProblem(pin);

  async function patch(payload: Record<string, unknown>, message: string) {
    setBusy(true);
    const response = await fetch(`/api/staff/${person.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaid(response.ok ? message : "That didn't save.");
    setBusy(false);
    await onChanged();
  }

  return (
    <div className={`card person${person.active ? "" : " left"}`}>
      <h2 style={{ marginBottom: 4 }}>{person.name}</h2>
      <p className="basis">
        {person.role ?? "no role set"}
        {person.phone ? ` · ${person.phone}` : ""}
        {person.hasPin ? " · can sign in" : " · no PIN yet"}
        {person.active ? "" : " · has left"}
      </p>

      <div className="rosterline">
        <input
          inputMode="numeric"
          placeholder={person.hasPin ? "New PIN" : "Set a PIN"}
          value={pin}
          aria-label={`PIN for ${person.name}`}
          onChange={(e) => setPin(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || problem !== null || pin === ""}
          onClick={async () => {
            await patch({ pin }, `New PIN set. Read it to ${person.name}.`);
            setPin("");
          }}
        >
          Save PIN
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() =>
            void patch(
              { active: !person.active },
              person.active ? "Marked as left." : "Back on the crew.",
            )
          }
        >
          {person.active ? "Mark as left" : "Bring back"}
        </button>
      </div>

      {problem && <p className="basis">{problem}</p>}
      {said && <p className="basis">{said}</p>}
    </div>
  );
}
