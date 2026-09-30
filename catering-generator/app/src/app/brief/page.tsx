"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  dishesNotInBook,
  jobTitleFor,
  missingFromBrief,
  recipeIdsFor,
  shiftDetail,
  shiftWhen,
  whatGetsMade,
  type Brief,
} from "@/lib/brief.ts";
import {
  MENU_WEIGHT_CHOICES,
  STYLE_CHOICES,
} from "@/lib/options.ts";
import { UploadTooLargeError, prepareUpload } from "@/lib/upload-file.ts";

/**
 * Start from a brief.
 *
 * A job arrives as words — a client's email, a planner's run sheet, or a long
 * chat with an AI where the whole thing got worked out. Retyping it into the
 * planner is where a 14:30 bump-in becomes half past four, and where the second
 * gluten-free guest quietly goes missing.
 *
 * So the words come in here and get spread out into the job, the menu and the
 * roster. Three things about how this page behaves are deliberate:
 *
 *  - **What the brief didn't say is shown first.** A screen of nine confident
 *    fields is exactly where a missing headcount hides, so the gaps go at the
 *    top and the fields that filled go underneath.
 *
 *  - **It doesn't try to be the event form again.** The proposal is read-only.
 *    Confirming it saves the job and opens it in the planner, where every field
 *    can be changed in the form she already knows. A second, slightly different
 *    copy of that form would be one more thing to keep in step, and the first
 *    time they drifted apart nobody would be told.
 *
 *  - **Nothing saves until she presses the button**, and the button says
 *    exactly what it will make.
 */

/** Matches the API's own ceiling for a PDF; images are shrunk under it. */
const MAX_UPLOAD_BYTES = 30_000_000;

/** Kept in step with MAX_PAGES in lib/pages.ts. */
const MAX_PAGES = 8;

/** Kept in step with MAX_TEXT in the read-brief route. */
const MAX_TEXT = 120_000;

/**
 * Files this page can turn into text in the browser.
 *
 * A chat exported from an AI assistant is usually one of these. They're read
 * straight into the paste box rather than uploaded, because they already are
 * the text — sending them as a document would cost bandwidth to arrive at the
 * same place.
 */
const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".json", ".log", ".rtf"];

function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/") || file.type === "application/json") return true;
  const name = file.name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

interface StagedPage {
  name: string;
  mediaType: string;
  data: string;
}

interface LibraryRecipe {
  id: string;
  name: string;
}

/** What got made, once the button's been pressed. */
interface Made {
  jobId: string;
  shifts: number;
  shiftsFailed: number;
}

const STYLE_LABEL = new Map(STYLE_CHOICES.map((choice) => [choice.key, choice.label]));
const WEIGHT_LABEL = new Map(MENU_WEIGHT_CHOICES.map((choice) => [choice.key, choice.label]));

/** "the brief didn't say", in the one place it's worded. */
function UnknownValue() {
  return <em className="basis">the brief didn&rsquo;t say</em>;
}

/** One line of the proposal: what it is, and what the brief made of it. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="count">
      <span>{label}</span>
      <br />
      <strong>{children}</strong>
    </div>
  );
}

export default function BriefPage() {
  const [text, setText] = useState("");
  const [pages, setPages] = useState<StagedPage[]>([]);
  const [adding, setAdding] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [today, setToday] = useState("");

  const [brief, setBrief] = useState<Brief | null>(null);
  const [library, setLibrary] = useState<LibraryRecipe[]>([]);

  /** Which dishes go on the job. Keyed by the dish as the brief wrote it. */
  const [useDish, setUseDish] = useState<Record<string, boolean>>({});
  /** Which shifts get created. Keyed by index into the brief's own list. */
  const [useShift, setUseShift] = useState<Record<number, boolean>>({});
  const [title, setTitle] = useState("");

  const [saving, setSaving] = useState(false);
  const [made, setMade] = useState<Made | null>(null);

  // Client-only: rendering today's date on the server would make the first
  // paint disagree with the browser, and the reader needs the browser's idea
  // of today to resolve "next Saturday".
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const chosenDishes = useMemo(() => {
    if (!brief) return [];
    return brief.dishes.filter((dish) => dish.recipe !== null && useDish[dish.asWritten]);
  }, [brief, useDish]);

  const recipeIds = useMemo(() => {
    if (!brief) return [];
    return recipeIdsFor({ ...brief, dishes: chosenDishes }, library);
  }, [brief, chosenDishes, library]);

  async function stage(chosen: File[]) {
    setError("");
    setAdding(true);
    try {
      const room = MAX_PAGES - pages.length;
      const added: StagedPage[] = [];

      for (const file of chosen) {
        // An exported chat is already text. Read it into the box so she can
        // see what's about to be sent, and edit it if half of it is irrelevant.
        if (isTextFile(file)) {
          const content = await file.text();
          setText((current) =>
            (current === "" ? content : `${current}\n\n${content}`).slice(0, MAX_TEXT),
          );
          continue;
        }

        if (added.length >= room) break;
        const upload = await prepareUpload(file, MAX_UPLOAD_BYTES);
        added.push({
          name: file.name || `Page ${pages.length + added.length + 1}`,
          mediaType: upload.mediaType,
          data: upload.data,
        });
      }

      if (added.length > 0) setPages((waiting) => [...waiting, ...added]);

      const pictures = chosen.filter((file) => !isTextFile(file)).length;
      // A text file needs no acknowledgement — it lands in the box above,
      // where she can see it. Only files that couldn't fit do.
      if (pictures > room) {
        setError(
          `Added ${room} of those ${pictures}. The reader takes ${MAX_PAGES} files at a time; do the rest as a second lot.`,
        );
      }
    } catch (problem) {
      setError(
        problem instanceof UploadTooLargeError
          ? problem.message
          : "Couldn't open that file. Try a photo, a PDF, or paste the text in instead.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function read() {
    setError("");
    setBrief(null);
    setMade(null);
    setReading(true);
    try {
      const response = await fetch("/api/read-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          pages: pages.map(({ mediaType, data }) => ({ mediaType, data })),
          today,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Couldn't read that. Fill the job in by hand on the Event page.");
        return;
      }

      const read = body.brief as Brief;
      setBrief(read);
      setLibrary((body.library ?? []) as LibraryRecipe[]);
      setTitle(jobTitleFor(read));

      // Everything it found is ticked to start with. She's here to confirm a
      // proposal, not to build one from nothing — and unticking what's wrong
      // is less work than ticking what's right.
      setUseDish(
        Object.fromEntries(
          read.dishes.filter((dish) => dish.recipe !== null).map((dish) => [dish.asWritten, true]),
        ),
      );
      setUseShift(Object.fromEntries(read.shifts.map((_, index) => [index, true])));
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setReading(false);
    }
  }

  /**
   * Save the job, then hang the ticked shifts off it.
   *
   * In that order, and the shifts only after the job has an id, because a
   * shift attached to a job is what lets the crew see its prep list. A shift
   * that fails to save is counted and reported rather than swallowed: a roster
   * that looks made and isn't is worse than one that plainly didn't.
   */
  async function setUp() {
    if (!brief) return;
    setError("");
    setSaving(true);

    try {
      // Only what the brief actually stated. Everything else is left out of
      // the input entirely, so the planner's own defaults stand — visible, in
      // boxes she can see — rather than a blank being saved as a decision.
      const input: Record<string, unknown> = {
        recipeIds,
        ...(brief.guests !== null ? { guests: brief.guests } : {}),
        ...(brief.eventDate !== null ? { eventDate: brief.eventDate } : {}),
        ...(brief.style !== null ? { style: brief.style } : {}),
        ...(brief.menuWeight !== null ? { menuWeight: brief.menuWeight } : {}),
        ...(brief.serviceWindowHours !== null
          ? { serviceWindowHours: brief.serviceWindowHours }
          : {}),
        ...(brief.budget !== null ? { budget: String(brief.budget) } : {}),
        ...(brief.drinksService !== null ? { drinksService: brief.drinksService } : {}),
        ...(brief.hotOrOutdoors !== null ? { hotOrOutdoors: brief.hotOrOutdoors } : {}),
        ...(brief.dietaries.length > 0
          ? {
              dietaries: Object.fromEntries(
                brief.dietaries.filter((diet) => diet.count > 0).map((d) => [d.label, d.count]),
              ),
            }
          : {}),
      };

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "event",
          title: title.trim() === "" ? jobTitleFor(brief) : title.trim(),
          eventDate: brief.eventDate,
          input,
        }),
      });
      const jobBody = await jobResponse.json().catch(() => ({}));

      if (!jobResponse.ok || typeof jobBody.id !== "string") {
        setError(jobBody.error ?? "Couldn't save the job. Nothing has been changed.");
        return;
      }

      const wanted = brief.shifts.filter((_, index) => useShift[index]);
      let saved = 0;
      for (const shift of wanted) {
        const shiftResponse = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: jobBody.id,
            title: shift.title,
            workDate: shift.date,
            location: shift.location,
            detail: shiftDetail(shift, brief.otherDietaries),
            isPrep: shift.isPrep,
            asking: true,
          }),
        });
        if (shiftResponse.ok) saved += 1;
      }

      setMade({ jobId: jobBody.id, shifts: saved, shiftsFailed: wanted.length - saved });
    } catch {
      setError("Couldn't reach the server. Nothing has been saved — try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  const notInBook = brief ? dishesNotInBook(brief) : [];
  const gaps = brief ? missingFromBrief(brief) : [];
  const ready = text.trim().length > 0 || pages.length > 0;

  return (
    <>
      <p className="eyebrow">From a brief</p>
      <h1>Bring a job in from a chat, an email or a sheet of paper</h1>
      <p>
        Paste the whole thing — a client&rsquo;s email, a planner&rsquo;s run sheet, or the
        entire conversation where you worked the job out with an AI. Photograph it if it&rsquo;s
        on paper. It gets read into a job, a menu and a roster for you to check, and nothing is
        saved until you say so.
      </p>

      {/* -------------------------------------------------------- the brief */}
      <div className="card">
        <h2>The brief</h2>

        <label htmlFor="brief-text">Paste it here</label>
        <textarea
          id="brief-text"
          rows={10}
          value={text}
          disabled={reading}
          maxLength={MAX_TEXT}
          placeholder={
            "Hi, we're after catering for our wedding at Burnbrae on 14 March — about 80 people, long table, two of the guests are gluten free…"
          }
          onChange={(event) => setText(event.target.value)}
        />
        {text.length > 0 && (
          <p className="basis">
            {text.length.toLocaleString()} characters. A whole chat is fine — the longer it is,
            the more it has to go on.
          </p>
        )}

        <label htmlFor="brief-file" style={{ marginTop: 16 }}>
          Or choose a file
        </label>
        {/*
          No `capture` attribute — setting it forces the camera and hides the
          phone's own "Photo Library" and "Browse" options, which is where the
          run sheet someone emailed actually is.
        */}
        <input
          id="brief-file"
          type="file"
          accept="image/*,application/pdf,text/plain,text/markdown,.md,.txt,.csv,.json,.log,.rtf"
          multiple
          disabled={reading || adding}
          onChange={(event) => {
            const chosen = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (chosen.length > 0) void stage(chosen);
          }}
        />
        <p className="basis">
          A photo, a PDF, or a text file. A chat saved as <code>.txt</code> is read straight into
          the box above so you can see what&rsquo;s going in. A Word document isn&rsquo;t
          something this can open — copy the text out and paste it instead.
        </p>

        {adding && <p className="notice">Getting that ready…</p>}

        {pages.length > 0 && (
          <ul className="pages" style={{ marginTop: 12 }}>
            {pages.map((page, index) => (
              <li key={`${page.name}-${index}`}>
                <span>
                  {pages.length > 1 && <strong>{index + 1}. </strong>}
                  {page.name}
                </span>
                <button
                  type="button"
                  className="linklike"
                  disabled={reading || adding}
                  onClick={() => setPages((waiting) => waiting.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {error !== "" && <p className="notice warn">{error}</p>}

        <div className="actions">
          <button type="button" disabled={!ready || reading || adding} onClick={() => void read()}>
            {reading ? "Reading it…" : "Read this brief"}
          </button>
          {(text !== "" || pages.length > 0) && (
            <button
              type="button"
              className="linklike"
              disabled={reading || adding}
              onClick={() => {
                setText("");
                setPages([]);
                setBrief(null);
                setMade(null);
                setError("");
              }}
            >
              Start again
            </button>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------- the proposal */}
      {brief && !made && (
        <>
          <h2>What it made of that</h2>

          {/* The gaps first. A screen of confident fields is exactly where a
              missing headcount hides. */}
          {gaps.length > 0 ? (
            <div className="notice check">
              <strong>The brief didn&rsquo;t say {gaps.join(", ")}.</strong> Nothing has been
              guessed. You&rsquo;ll set those in the planner — it opens with its own defaults in
              those boxes, and they&rsquo;re yours to change.
            </div>
          ) : (
            <div className="notice ok">
              Everything the planner needs was in the brief. Check it below all the same.
            </div>
          )}

          {brief.otherDietaries.length > 0 && (
            <div className="notice warn">
              <strong>
                {brief.otherDietaries.length === 1
                  ? "There's a dietary requirement"
                  : `There are ${brief.otherDietaries.length} dietary requirements`}{" "}
                the planner has no box for:
              </strong>
              <ul>
                {brief.otherDietaries.map((diet) => (
                  <li key={diet}>{diet}</li>
                ))}
              </ul>
              These are written into the note on every on-site shift below, so the crew read them
              on the day. They are <strong>not</strong> stored on the job itself — the planner
              only holds the five tickboxes — so handle them yourself as well.
            </div>
          )}

          {brief.unclear.length > 0 && (
            <div className="card">
              <h3>What it wasn&rsquo;t sure about</h3>
              <ul>
                {brief.unclear.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <h3>The job</h3>
            <div className="counts">
              <Field label="People">{brief.guests ?? <UnknownValue />}</Field>
              <Field label="Date">{brief.eventDate ?? <UnknownValue />}</Field>
              <Field label="Served">
                {brief.style === null ? <UnknownValue /> : STYLE_LABEL.get(brief.style)}
              </Field>
              <Field label="How much food">
                {brief.menuWeight === null ? (
                  <UnknownValue />
                ) : (
                  WEIGHT_LABEL.get(brief.menuWeight)
                )}
              </Field>
              <Field label="Serving for">
                {brief.serviceWindowHours === null ? (
                  <UnknownValue />
                ) : (
                  `${brief.serviceWindowHours} h`
                )}
              </Field>
              <Field label="Food budget">
                {brief.budget === null ? <UnknownValue /> : `$${brief.budget.toLocaleString()}`}
              </Field>
              <Field label="Drinks service">
                {brief.drinksService === null ? (
                  <UnknownValue />
                ) : brief.drinksService ? (
                  "Yes"
                ) : (
                  "No"
                )}
              </Field>
              <Field label="Hot or outdoors">
                {brief.hotOrOutdoors === null ? (
                  <UnknownValue />
                ) : brief.hotOrOutdoors ? (
                  "Yes"
                ) : (
                  "No"
                )}
              </Field>
              {brief.venue !== "" && <Field label="Venue">{brief.venue}</Field>}
              {brief.client !== "" && <Field label="Client">{brief.client}</Field>}
              {brief.crewNeeded !== null && (
                <Field label="Crew wanted">{brief.crewNeeded}</Field>
              )}
            </div>

            {brief.dietaries.length > 0 && (
              <>
                <h4>Dietaries</h4>
                <ul className="chips">
                  {brief.dietaries.map((diet) => (
                    <li key={diet.label} className="chip">
                      {diet.label}
                      {diet.count > 0 ? ` × ${diet.count}` : " — no number given"}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <label htmlFor="brief-title" style={{ marginTop: 18 }}>
              Save it as
            </label>
            <input
              id="brief-title"
              type="text"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {/* ----------------------------------------------------- the menu */}
          <div className="card">
            <h3>The menu</h3>
            {brief.dishes.length === 0 ? (
              <p className="basis">
                No dishes in the brief. You&rsquo;ll pick them in the planner.
              </p>
            ) : (
              <>
                <p className="basis">
                  Ticked dishes go on the job in your own numbers, scaled from the recipe you
                  wrote. Only dishes already in your recipe book can be ticked — a dish the app
                  hasn&rsquo;t got can&rsquo;t be costed or ordered for.
                </p>
                <div className="checks">
                  {brief.dishes
                    .filter((dish) => dish.recipe !== null)
                    .map((dish) => (
                      <label className="check" key={dish.asWritten}>
                        <input
                          type="checkbox"
                          checked={useDish[dish.asWritten] === true}
                          onChange={(event) =>
                            setUseDish((current) => ({
                              ...current,
                              [dish.asWritten]: event.target.checked,
                            }))
                          }
                        />
                        <span>
                          {dish.recipe}
                          {dish.recipe !== dish.asWritten && (
                            <>
                              {" "}
                              <span className="basis">
                                — the brief called it &ldquo;{dish.asWritten}&rdquo;
                              </span>
                            </>
                          )}
                        </span>
                      </label>
                    ))}
                </div>

                {notInBook.length > 0 && (
                  <div className="notice check" style={{ marginTop: 16 }}>
                    <strong>
                      {notInBook.length === 1
                        ? "One dish isn't in your recipe book yet:"
                        : `${notInBook.length} dishes aren't in your recipe book yet:`}
                    </strong>
                    <ul>
                      {notInBook.map((dish) => (
                        <li key={dish}>{dish}</li>
                      ))}
                    </ul>
                    They aren&rsquo;t on the job, because nothing here knows what goes into them.{" "}
                    <Link href="/recipes">Write them up</Link> and they&rsquo;ll be orderable and
                    costed like the rest — then read this brief again.
                  </div>
                )}
              </>
            )}
          </div>

          {/* --------------------------------------------------- the roster */}
          <div className="card">
            <h3>The days of work</h3>
            {brief.shifts.length === 0 ? (
              <p className="basis">
                The brief didn&rsquo;t name any prep or service days, so nothing has been made up.
                Add them on the <Link href="/crew">Crew</Link> page.
              </p>
            ) : (
              <>
                <p className="basis">
                  Each ticked day becomes a shift your crew can be asked about, attached to this
                  job. Times go into the shift&rsquo;s note — each person&rsquo;s own hours are
                  set when you roster them on.
                </p>
                <div className="checks">
                  {brief.shifts.map((shift, index) => (
                    <label className="check" key={`${shift.date}-${shift.title}-${index}`}>
                      <input
                        type="checkbox"
                        checked={useShift[index] === true}
                        onChange={(event) =>
                          setUseShift((current) => ({ ...current, [index]: event.target.checked }))
                        }
                      />
                      <span>
                        <strong>{shift.title}</strong>
                        {shift.isPrep && <span className="tag"> prep</span>}
                        <br />
                        <span className="basis">
                          {shift.date} · {shiftWhen(shift)}
                          {shift.location !== "" && ` · ${shift.location}`}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {error !== "" && <p className="notice warn">{error}</p>}

          <div className="actions">
            <button type="button" disabled={saving} onClick={() => void setUp()}>
              {saving ? "Setting it up…" : whatGetsMade(recipeIds.length, countTicked(useShift))}
            </button>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------- the result */}
      {made && (
        <div className="card">
          <h2>Done</h2>
          <p>
            The job is saved
            {made.shifts > 0 &&
              ` with ${made.shifts} ${made.shifts === 1 ? "day of work" : "days of work"} on the roster`}
            .
          </p>
          {made.shiftsFailed > 0 && (
            <p className="notice warn">
              {made.shiftsFailed} of the days didn&rsquo;t save. The job itself is fine — add
              those on the <Link href="/crew">Crew</Link> page.
            </p>
          )}
          <p className="basis">
            Nothing has been ordered yet. Open it in the planner, check the boxes the brief
            didn&rsquo;t fill, and press Build to get the quantities.
          </p>
          <div className="actions">
            <Link href={`/event?job=${made.jobId}`}>
              <button type="button">Open it in the planner</button>
            </Link>
            <Link href="/crew" className="linklike">
              Go to the roster
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function countTicked(ticks: Record<number, boolean>): number {
  return Object.values(ticks).filter(Boolean).length;
}
