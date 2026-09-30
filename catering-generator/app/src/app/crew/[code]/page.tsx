"use client";

import { use, useCallback, useEffect, useState } from "react";

import { asHours, minutesWorked } from "@/lib/roster.ts";

/**
 * The crew's own page. One link, their name, four digits.
 *
 * Written for a casual standing in a car park deciding whether they can do
 * Saturday, not for someone at a desk. Two taps to answer, one screen to
 * see what they're on, and the prep list for the day they're working.
 *
 * They never see a price, a food cost, or anyone else's hours. That isn't a
 * display choice — the routes behind this page don't send it.
 */

interface Shift {
  id: string;
  title: string;
  workDate: string;
  location: string | null;
  detail: string | null;
  isPrep: boolean;
  asking: boolean;
  hasPack: boolean;
  myAnswer: "yes" | "no" | null;
  myNote: string | null;
  onRoster: boolean;
  start: string | null;
  end: string | null;
}

interface Hours {
  id: string;
  workDate: string;
  start: string | null;
  end: string | null;
  minutes: number;
  note: string | null;
  locked: boolean;
}

export default function CrewSignIn({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [hours, setHours] = useState<Hours[]>([]);
  const [monthMinutes, setMonthMinutes] = useState(0);
  const [checking, setChecking] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch("/api/crew/me");
    if (response.ok) {
      const body = await response.json();
      setMe(body.me);
      setShifts(body.shifts ?? []);
      setHours(body.hours ?? []);
      setMonthMinutes(body.minutesThisMonth ?? 0);
    } else {
      setMe(null);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (checking) return <div className="card">Loading…</div>;
  if (!me) return <SignInForm code={code} onIn={load} />;

  const asked = shifts.filter((shift) => shift.asking && shift.myAnswer === null);
  const mine = shifts.filter((shift) => shift.onRoster);

  return (
    <>
      <h1>Hi {me.name.split(" ")[0]}</h1>

      {asked.length > 0 && (
        <>
          <h2>Can you work?</h2>
          <p className="lede">
            {asked.length === 1
              ? "One to answer."
              : `${asked.length} to answer.`}{" "}
            Yes or no — a note is optional and Jess sees it.
          </p>
          {asked.map((shift) => (
            <AnswerCard key={shift.id} shift={shift} onAnswered={load} />
          ))}
        </>
      )}

      <h2>You&rsquo;re on</h2>
      {mine.length === 0 ? (
        <div className="card">
          <p>Nothing rostered yet. You&rsquo;ll see it here when you are.</p>
        </div>
      ) : (
        mine.map((shift) => (
          <MyShift key={shift.id} shift={shift} onLogged={load} />
        ))
      )}

      <h2>Answered</h2>
      {shifts.filter((s) => s.myAnswer !== null).length === 0 ? (
        <p className="basis">Nothing yet.</p>
      ) : (
        shifts
          .filter((shift) => shift.myAnswer !== null)
          .map((shift) => (
            <AnswerCard key={shift.id} shift={shift} onAnswered={load} />
          ))
      )}

      <h2>Your hours</h2>
      <div className="card">
        <p className="basis">This month</p>
        <p className="figure">{asHours(monthMinutes)}</p>
        {hours.length === 0 ? (
          <p className="basis">Nothing logged yet.</p>
        ) : (
          <ul className="plain answers">
            {hours.map((row) => (
              <li key={row.id}>
                <strong>{row.workDate}</strong> — {asHours(row.minutes)}
                {row.start && row.end
                  ? ` (${row.start.slice(0, 5)}–${row.end.slice(0, 5)})`
                  : ""}
                {row.locked ? " · counted" : ""}
                {row.note && <em> — {row.note}</em>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            await fetch("/api/crew/login", { method: "DELETE" });
            setMe(null);
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ signing in

function SignInForm({ code, onIn }: { code: string; onIn: () => Promise<void> }) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [crew, setCrew] = useState("");
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/crew/login?code=${encodeURIComponent(code)}`);
      if (!response.ok) {
        setUnknown(true);
        return;
      }
      const body = await response.json();
      setCrew(body.crew ?? "");
      setPeople(body.people ?? []);
    })();
  }, [code]);

  if (unknown) {
    return (
      <div className="card">
        <h1>Nothing here</h1>
        <p>
          That link doesn&rsquo;t match a crew. Check it against the one you
          were sent — it&rsquo;s easy to lose a character copying it out of a
          message.
        </p>
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
        const response = await fetch("/api/crew/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, staffId, pin }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setError(body.error ?? "Couldn't sign you in.");
          setPin("");
          setBusy(false);
          return;
        }
        setBusy(false);
        await onIn();
      }}
    >
      <h1>{crew || "Crew"}</h1>
      <p className="lede">Sign in to see your shifts.</p>

      <label htmlFor="who">Your name</label>
      <select id="who" required value={staffId} onChange={(e) => setStaffId(e.target.value)}>
        <option value="">Choose your name…</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>

      <label htmlFor="pin" style={{ marginTop: 12 }}>
        Your PIN
      </label>
      <input
        id="pin"
        inputMode="numeric"
        autoComplete="off"
        required
        value={pin}
        onChange={(e) => setPin(e.target.value)}
      />

      {error && (
        <p className="notice warn" style={{ marginTop: 12 }}>
          <strong>{error}</strong>
        </p>
      )}

      {people.length === 0 && !error && (
        <p className="basis" style={{ marginTop: 12 }}>
          Nobody on this crew has a PIN yet. Ask whoever runs the roster to
          set yours.
        </p>
      )}

      <div className="actions">
        <button type="submit" disabled={busy || staffId === "" || pin === ""}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ answering

function AnswerCard({
  shift,
  onAnswered,
}: {
  shift: Shift;
  onAnswered: () => Promise<void>;
}) {
  const [note, setNote] = useState(shift.myNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function answer(value: "yes" | "no") {
    setBusy(true);
    setError("");
    const response = await fetch("/api/crew/me", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shiftId: shift.id, answer: value, note }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Couldn't save that.");
    }
    setBusy(false);
    await onAnswered();
  }

  return (
    <div className="card shift">
      <h3>
        {shift.title}
        {shift.isPrep && <span className="tag">Prep day</span>}
      </h3>
      <p className="basis">
        {shift.workDate}
        {shift.location ? ` · ${shift.location}` : ""}
      </p>
      {shift.detail && <p>{shift.detail}</p>}

      <label htmlFor={`note-${shift.id}`} className="hint">
        Anything to add? (&ldquo;only til 5&rdquo;, &ldquo;can do if I get a lift&rdquo;)
      </label>
      <input
        id={`note-${shift.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={!shift.asking}
      />

      {shift.asking ? (
        <div className="yesno">
          <button
            type="button"
            className={`yes${shift.myAnswer === "yes" ? " on" : ""}`}
            disabled={busy}
            onClick={() => void answer("yes")}
          >
            Yes, I can
          </button>
          <button
            type="button"
            className={`no${shift.myAnswer === "no" ? " on" : ""}`}
            disabled={busy}
            onClick={() => void answer("no")}
          >
            No, sorry
          </button>
        </div>
      ) : (
        <p className="basis">
          {shift.myAnswer === "yes" ? "You said yes." : "You said no."} This
          one&rsquo;s closed now.
        </p>
      )}

      {shift.asking && shift.myAnswer && (
        <p className="basis">
          Saved — you said {shift.myAnswer === "yes" ? "yes" : "no"}. Tap the
          other one if that changes.
        </p>
      )}
      {error && (
        <p className="notice warn">
          <strong>{error}</strong>
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------ a shift you're on

function MyShift({ shift, onLogged }: { shift: Shift; onLogged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(shift.start?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(shift.end?.slice(0, 5) ?? "");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pack, setPack] = useState<null | {
    prep: { label: string; date: string; tasks: { dish: string; task: string; steps?: { label: string | null; text: string }[] }[] }[];
    dishes: { name: string; scaleNote: string; ingredients: { item: string; qty: number; unit: string; section?: string | null }[]; method?: string | null }[];
  }>(null);

  const preview = minutesWorked(start, end, Number(breakMinutes) || 0);

  return (
    <div className="card shift">
      <h3>
        {shift.title}
        {shift.isPrep && <span className="tag">Prep day</span>}
      </h3>
      <p className="basis">
        {shift.workDate}
        {shift.location ? ` · ${shift.location}` : ""}
        {shift.start && shift.end
          ? ` · ${shift.start.slice(0, 5)}–${shift.end.slice(0, 5)}`
          : " · times not set yet"}
      </p>
      {shift.detail && <p>{shift.detail}</p>}

      <div className="actions">
        {shift.hasPack && (
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              if (pack) {
                setPack(null);
                return;
              }
              const response = await fetch(`/api/crew/pack?shiftId=${shift.id}`);
              if (response.ok) setPack(await response.json());
              else setError("No job pack on this one yet.");
            }}
          >
            {pack ? "Hide the job pack" : "Job pack — prep & recipes"}
          </button>
        )}
        <button type="button" onClick={() => setOpen(!open)}>
          {open ? "Not now" : "Log my hours"}
        </button>
      </div>

      {open && (
        <div className="rosterline">
          <input
            type="time"
            value={start}
            aria-label="Started"
            onChange={(e) => setStart(e.target.value)}
          />
          <input
            type="time"
            value={end}
            aria-label="Finished"
            onChange={(e) => setEnd(e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="5"
            value={breakMinutes}
            aria-label="Break in minutes"
            onChange={(e) => setBreakMinutes(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || preview === null}
            onClick={async () => {
              setBusy(true);
              setError("");
              const response = await fetch("/api/crew/me", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  logHours: true,
                  shiftId: shift.id,
                  start,
                  end,
                  breakMinutes: Number(breakMinutes) || 0,
                  note,
                }),
              });
              if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                setError(body.error ?? "Couldn't save those hours.");
              } else {
                setOpen(false);
                setNote("");
              }
              setBusy(false);
              await onLogged();
            }}
          >
            {preview === null ? "Times?" : `Log ${asHours(preview)}`}
          </button>
        </div>
      )}

      {open && (
        <input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {error && (
        <p className="notice warn">
          <strong>{error}</strong>
        </p>
      )}

      {pack && (
        <div className="pack">
          <h4>Prep</h4>
          {pack.prep.length === 0 && <p className="basis">Nothing dated yet.</p>}
          {pack.prep.map((day) => (
            <div key={day.date}>
              <p className="basis">
                <strong>{day.label}</strong> — {day.date}
              </p>
              <ul className="plain">
                {day.tasks.map((task, index) => (
                  <li key={`${task.dish}-${index}`}>
                    <strong>{task.dish}</strong> — {task.task}
                    {task.steps && task.steps.length > 0 && (
                      <ol className="prep-steps">
                        {task.steps.map((step, stepIndex) => (
                          <li key={stepIndex}>
                            {step.label && <strong>{step.label}: </strong>}
                            {step.text}
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <h4>Dishes</h4>
          {pack.dishes.map((dish) => (
            <div key={dish.name} className="sheet">
              <h5>
                {dish.name} <span className="basis">{dish.scaleNote}</span>
              </h5>
              <ul className="plain">
                {dish.ingredients.map((line, index) => (
                  <li key={index}>
                    {line.qty} {line.unit} {line.item}
                    {line.section ? ` — ${line.section}` : ""}
                  </li>
                ))}
              </ul>
              {dish.method && <p>{dish.method}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
