"use client";

import { useEffect, useState } from "react";

import EventResult from "@/components/EventResult.tsx";
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

export default function EventPage() {
  const [today, setToday] = useState("");
  const [guests, setGuests] = useState(80);
  const [eventDate, setEventDate] = useState("");
  const [style, setStyle] = useState<EventInput["style"]>("shared");
  const [menuWeight, setMenuWeight] =
    useState<EventInput["menuWeight"]>("standard");
  const [proteins, setProteins] = useState<string[]>([
    "brisket",
    "chickenThigh",
  ]);
  const [sidesCount, setSidesCount] = useState(3);
  const [starch, setStarch] = useState<EventInput["starch"]>("potato");
  const [bread, setBread] = useState(true);
  const [dessert, setDessert] = useState<EventInput["dessert"]>("shared");
  const [grazing, setGrazing] = useState<EventInput["grazing"]>("none");
  const [canapes, setCanapes] = useState<EventInput["canapes"]>("none");
  const [drinksService, setDrinksService] = useState(false);
  const [hotOrOutdoors, setHotOrOutdoors] = useState(false);
  const [vanItem, setVanItem] = useState<NonNullable<EventInput["vanItem"]>>(
    "burgers",
  );
  const [serviceWindowHours, setServiceWindowHours] = useState(3);
  const [dietaries, setDietaries] = useState<Record<string, number>>({});

  const [plan, setPlan] = useState<EventPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Set on the client only — rendering today's date on the server would make
  // the first paint disagree with the browser.
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const toggleProtein = (key: string) => {
    setProteins((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    );
  };

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const input: EventInput = {
      guests,
      eventDate,
      today,
      style,
      menuWeight,
      proteins,
      sidesCount,
      starch,
      bread,
      dessert,
      grazing,
      canapes,
      drinksService,
      hotOrOutdoors,
      dietaries: Object.entries(dietaries)
        .filter(([, count]) => count > 0)
        .map(([label, count]) => ({ label, count })),
      ...(style === "van"
        ? { vanItem, serviceWindowHours }
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
      <h1>Event order list</h1>
      <p className="lede">
        One date, one guest count, one menu. Order day is T-7 — seven days
        before the event.
      </p>

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
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="eventDate">Event date</label>
              <input
                id="eventDate"
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
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
                value={style}
                onChange={(e) =>
                  setStyle(e.target.value as EventInput["style"])
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
                value={menuWeight}
                onChange={(e) =>
                  setMenuWeight(e.target.value as EventInput["menuWeight"])
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
                  checked={proteins.includes(c.key)}
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
                value={sidesCount}
                onChange={(e) => setSidesCount(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="starch">Starch</label>
              <select
                id="starch"
                value={starch}
                onChange={(e) =>
                  setStarch(e.target.value as EventInput["starch"])
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
                value={dessert}
                onChange={(e) =>
                  setDessert(e.target.value as EventInput["dessert"])
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
                value={grazing}
                onChange={(e) =>
                  setGrazing(e.target.value as EventInput["grazing"])
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
                value={canapes}
                onChange={(e) =>
                  setCanapes(e.target.value as EventInput["canapes"])
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
                checked={bread}
                onChange={(e) => setBread(e.target.checked)}
              />
              Bread on the table
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={drinksService}
                onChange={(e) => setDrinksService(e.target.checked)}
              />
              We&rsquo;re running drinks and coffee
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={hotOrOutdoors}
                onChange={(e) => setHotOrOutdoors(e.target.checked)}
              />
              Outdoors, or over 28&deg;C
            </label>
          </div>
        </div>

        {style === "van" && (
          <div className="card">
            <h2>Van service</h2>
            <div className="grid">
              <div>
                <label htmlFor="vanItem">What you&rsquo;re serving</label>
                <select
                  id="vanItem"
                  value={vanItem}
                  onChange={(e) =>
                    setVanItem(
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
                  value={serviceWindowHours}
                  onChange={(e) =>
                    setServiceWindowHours(Number(e.target.value))
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
                  value={dietaries[label] ?? 0}
                  onChange={(e) =>
                    setDietaries((current) => ({
                      ...current,
                      [label]: Number(e.target.value),
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
            <button
              type="button"
              className="secondary"
              onClick={() => window.print()}
            >
              Print / save as PDF
            </button>
          )}
        </div>
      </form>

      {plan && <EventResult plan={plan} />}
    </>
  );
}
