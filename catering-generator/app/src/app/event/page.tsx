"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import EventResult from "@/components/EventResult.tsx";
import SaveJob from "@/components/SaveJob.tsx";
import {
  MENU_WEIGHT_CHOICES,
  PROTEIN_CHOICES,
  STARCH_CHOICES,
  STYLE_CHOICES,
  VAN_ITEM_CHOICES,
} from "@/lib/options.ts";
import type { EventInput, EventPlan } from "@/lib/types.ts";

const DIETARY_LABELS = [
  "Gluten free",
  "Dairy free",
  "Vegetarian",
  "Vegan",
  "Nut allergy",
];

/** Element ids can't contain spaces, and a broken id breaks its label. */
const fieldId = (label: string) =>
  `diet-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/**
 * The form as the operator sees it. This is what gets saved, so opening a job
 * later restores exactly what was typed — including the van fields, whether or
 * not that job was a van job.
 */
interface EventForm {
  guests: number;
  eventDate: string;
  style: EventInput["style"];
  menuWeight: EventInput["menuWeight"];
  proteins: string[];
  sidesCount: number;
  starch: EventInput["starch"];
  bread: boolean;
  dessert: EventInput["dessert"];
  grazing: EventInput["grazing"];
  canapes: EventInput["canapes"];
  drinksService: boolean;
  hotOrOutdoors: boolean;
  vanItem: NonNullable<EventInput["vanItem"]>;
  serviceWindowHours: number;
  dietaries: Record<string, number>;
}

const BLANK: EventForm = {
  guests: 80,
  eventDate: "",
  style: "shared",
  menuWeight: "standard",
  proteins: ["brisket", "chickenThigh"],
  sidesCount: 3,
  starch: "potato",
  bread: true,
  dessert: "shared",
  grazing: "none",
  canapes: "none",
  drinksService: false,
  hotOrOutdoors: false,
  vanItem: "burgers",
  serviceWindowHours: 3,
  dietaries: {},
};

function EventPlanner() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");

  const [form, setForm] = useState<EventForm>(BLANK);
  const [today, setToday] = useState("");
  const [plan, setPlan] = useState<EventPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Client-only: rendering today's date on the server would make the first
  // paint disagree with the browser.
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  // Opening a saved job restores the form exactly as it was typed.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok || cancelled) return;
      const body = await response.json();
      if (body.job?.input) setForm({ ...BLANK, ...body.job.input });
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleProtein = (key: string) =>
    setForm((current) => ({
      ...current,
      proteins: current.proteins.includes(key)
        ? current.proteins.filter((k) => k !== key)
        : [...current.proteins, key],
    }));

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const input: EventInput = {
      guests: form.guests,
      eventDate: form.eventDate,
      today,
      style: form.style,
      menuWeight: form.menuWeight,
      proteins: form.proteins,
      sidesCount: form.sidesCount,
      starch: form.starch,
      bread: form.bread,
      dessert: form.dessert,
      grazing: form.grazing,
      canapes: form.canapes,
      drinksService: form.drinksService,
      hotOrOutdoors: form.hotOrOutdoors,
      dietaries: Object.entries(form.dietaries)
        .filter(([, count]) => count > 0)
        .map(([label, count]) => ({ label, count })),
      ...(form.style === "van"
        ? {
            vanItem: form.vanItem,
            serviceWindowHours: form.serviceWindowHours,
          }
        : {}),
    };

    try {
      const response = await fetch("/api/plan/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Couldn't build the order list.");
        setPlan(null);
      } else {
        setPlan(body as EventPlan);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={submit}>
        <div className="card">
          <h2>The job</h2>
          <div className="grid">
            <div>
              <label htmlFor="guests">
                Guests
                <span className="hint">Confirmed or your best estimate</span>
              </label>
              <input
                id="guests"
                type="number"
                min={1}
                max={5000}
                required
                value={form.guests}
                onChange={(e) => set("guests", Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="eventDate">Event date</label>
              <input
                id="eventDate"
                type="date"
                required
                value={form.eventDate}
                onChange={(e) => set("eventDate", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="today">
                Today
                <span className="hint">Drives the countdown dates</span>
              </label>
              <input
                id="today"
                type="date"
                required
                value={today}
                onChange={(e) => setToday(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="style">Service style</label>
              <select
                id="style"
                value={form.style}
                onChange={(e) =>
                  set("style", e.target.value as EventInput["style"])
                }
              >
                {STYLE_CHOICES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="menuWeight">
                Menu weight
                <span className="hint">Sets the protein per head</span>
              </label>
              <select
                id="menuWeight"
                value={form.menuWeight}
                onChange={(e) =>
                  set("menuWeight", e.target.value as EventInput["menuWeight"])
                }
              >
                {MENU_WEIGHT_CHOICES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Proteins</h2>
          <p className="basis">
            The served protein for the menu weight is split evenly across
            whatever you tick, then multiplied out by each one&rsquo;s yield.
          </p>
          <div className="checks">
            {PROTEIN_CHOICES.map((c) => (
              <label className="check" key={c.key}>
                <input
                  type="checkbox"
                  checked={form.proteins.includes(c.key)}
                  onChange={() => toggleProtein(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>The rest of the menu</h2>
          <div className="grid">
            <div>
              <label htmlFor="sides">Number of sides / salads</label>
              <input
                id="sides"
                type="number"
                min={0}
                max={6}
                value={form.sidesCount}
                onChange={(e) => set("sidesCount", Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="starch">Starch</label>
              <select
                id="starch"
                value={form.starch}
                onChange={(e) =>
                  set("starch", e.target.value as EventInput["starch"])
                }
              >
                {STARCH_CHOICES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dessert">Dessert</label>
              <select
                id="dessert"
                value={form.dessert}
                onChange={(e) =>
                  set("dessert", e.target.value as EventInput["dessert"])
                }
              >
                <option value="none">None</option>
                <option value="shared">Plated or shared</option>
                <option value="bites">Sweet bites</option>
              </select>
            </div>
            <div>
              <label htmlFor="grazing">Grazing</label>
              <select
                id="grazing"
                value={form.grazing}
                onChange={(e) =>
                  set("grazing", e.target.value as EventInput["grazing"])
                }
              >
                <option value="none">None</option>
                <option value="starter">As a starter</option>
                <option value="meal">As a light meal</option>
              </select>
            </div>
            <div>
              <label htmlFor="canapes">Canapés</label>
              <select
                id="canapes"
                value={form.canapes}
                onChange={(e) =>
                  set("canapes", e.target.value as EventInput["canapes"])
                }
              >
                <option value="none">None</option>
                <option value="predinner">Pre-dinner, 1 hr</option>
                <option value="meal">Replacing a meal</option>
              </select>
            </div>
          </div>

          <div className="checks" style={{ marginTop: 14 }}>
            <label className="check">
              <input
                type="checkbox"
                checked={form.bread}
                onChange={(e) => set("bread", e.target.checked)}
              />
              Bread on the table
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.drinksService}
                onChange={(e) => set("drinksService", e.target.checked)}
              />
              We&rsquo;re running drinks and coffee
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.hotOrOutdoors}
                onChange={(e) => set("hotOrOutdoors", e.target.checked)}
              />
              Outdoors, or over 28&deg;C
            </label>
          </div>
        </div>

        {form.style === "van" && (
          <div className="card">
            <h2>Van service</h2>
            <div className="grid">
              <div>
                <label htmlFor="vanItem">What you&rsquo;re serving</label>
                <select
                  id="vanItem"
                  value={form.vanItem}
                  onChange={(e) =>
                    set(
                      "vanItem",
                      e.target.value as NonNullable<EventInput["vanItem"]>,
                    )
                  }
                >
                  {VAN_ITEM_CHOICES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="window">
                  Service window
                  <span className="hint">Hours the window is open</span>
                </label>
                <input
                  id="window"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={form.serviceWindowHours}
                  onChange={(e) =>
                    set("serviceWindowHours", Number(e.target.value))
                  }
                />
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h2>Dietaries</h2>
          <p className="basis">
            How many guests, by requirement. These get ordered and packed
            separately.
          </p>
          <div className="grid">
            {DIETARY_LABELS.map((label) => (
              <div key={label}>
                <label htmlFor={fieldId(label)}>{label}</label>
                <input
                  id={fieldId(label)}
                  type="number"
                  min={0}
                  value={form.dietaries[label] ?? 0}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      dietaries: {
                        ...current.dietaries,
                        [label]: Number(e.target.value),
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="notice">
            <strong>{error}</strong>
          </p>
        )}

        <div className="actions">
          <button type="submit" disabled={busy}>
            {busy ? "Working it out…" : "Build the order list"}
          </button>
          {plan && (
            <>
              <button
                type="button"
                className="secondary"
                onClick={() => window.print()}
              >
                Print / save as PDF
              </button>
              <SaveJob
                mode="event"
                input={form}
                eventDate={form.eventDate}
                defaultTitle={`${form.guests} guests, ${form.eventDate}`}
              />
            </>
          )}
        </div>
      </form>

      {plan && <EventResult plan={plan} />}
    </>
  );
}

export default function EventPage() {
  return (
    <>
      <h1>Event order list</h1>
      <p className="lede">
        One date, one guest count, one menu. Order day is T-7 — seven days
        before the event.
      </p>
      <Suspense fallback={<div className="card">Loading…</div>}>
        <EventPlanner />
      </Suspense>
    </>
  );
}
