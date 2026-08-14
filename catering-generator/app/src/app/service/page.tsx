"use client";

import { useState } from "react";

import ServiceResult from "@/components/ServiceResult.tsx";
import {
  PROTEIN_CHOICES,
  SERVICE_CATEGORY_CHOICES,
  SHELF_LIFE_CHOICES,
  VENUE_CHOICES,
  VENUE_COVERS_HELP,
  WEEKDAY_CHOICES,
} from "@/lib/options.ts";
import type {
  ServiceInput,
  ServiceItem,
  ServicePlan,
  Weekday,
} from "@/lib/types.ts";

const BLANK_ITEM: ServiceItem = {
  name: "",
  category: "main",
  proteinKey: undefined,
  portionG: 180,
  shelfLife: "medium",
  onHandKg: 0,
};

export default function ServicePage() {
  const [venueType, setVenueType] =
    useState<ServiceInput["venueType"]>("restaurant");
  const [covers, setCovers] = useState<Record<Weekday, number>>({
    Mon: 0,
    Tue: 90,
    Wed: 90,
    Thu: 100,
    Fri: 140,
    Sat: 160,
    Sun: 120,
  });
  const [deliveryDays, setDeliveryDays] = useState<Weekday[]>(["Tue", "Fri"]);
  const [leadTimeHours, setLeadTimeHours] = useState(12);
  const [fridgeCapacityKg, setFridgeCapacityKg] = useState<string>("");
  const [prepHoursAvailable, setPrepHoursAvailable] = useState<string>("");
  const [serviceWindowHours, setServiceWindowHours] = useState<string>("");
  const [items, setItems] = useState<ServiceItem[]>([
    {
      name: "Braised beef",
      category: "main",
      proteinKey: "brisket",
      portionG: 180,
      shelfLife: "medium",
      onHandKg: 0,
    },
    {
      name: "Market fish",
      category: "main",
      proteinKey: "fishFillet",
      portionG: 180,
      shelfLife: "short",
      onHandKg: 0,
    },
    {
      name: "Garden salad",
      category: "side",
      portionG: 70,
      shelfLife: "short",
      onHandKg: 0,
    },
  ]);

  const [menuText, setMenuText] = useState("");
  const [parsingAvailable, setParsingAvailable] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState("");

  const [plan, setPlan] = useState<ServicePlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const updateItem = (index: number, patch: Partial<ServiceItem>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const toggleDelivery = (day: Weekday) => {
    setDeliveryDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day],
    );
  };

  async function parseMenu() {
    setParsing(true);
    setParseNote("");
    try {
      const response = await fetch("/api/parse-menu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ menuText }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 503) setParsingAvailable(false);
        setParseNote(body.error ?? "Couldn't read that menu.");
      } else if (Array.isArray(body.items) && body.items.length > 0) {
        setItems(
          body.items.map((item: ServiceItem) => ({ ...item, onHandKg: 0 })),
        );
        setParseNote(
          `Read ${body.items.length} items. Check the portions and shelf life before you build the par — those two drive everything.`,
        );
      } else {
        setParseNote("Couldn't find any dishes in that. Add them by hand.");
      }
    } catch {
      setParseNote("Couldn't reach the server. Add the items by hand.");
    } finally {
      setParsing(false);
    }
  }

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    setError("");

    const input: ServiceInput = {
      venueType,
      covers,
      deliveryDays,
      leadTimeHours,
      items: items.filter((item) => item.name.trim() !== ""),
      ...(fridgeCapacityKg !== ""
        ? { fridgeCapacityKg: Number(fridgeCapacityKg) }
        : {}),
      ...(prepHoursAvailable !== ""
        ? { prepHoursAvailable: Number(prepHoursAvailable) }
        : {}),
      ...(serviceWindowHours !== ""
        ? { serviceWindowHours: Number(serviceWindowHours) }
        : {}),
    };

    try {
      const response = await fetch("/api/plan/service", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Couldn't build the par levels.");
        setPlan(null);
      } else {
        setPlan(body as ServicePlan);
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
      <h1>Weekly par levels</h1>
      <p className="lede">
        Forecast covers in, par levels out. The order is always par minus what
        you counted on hand — count before you send it.
      </p>

      <form onSubmit={submit}>
        <div className="card">
          <h2>The operation</h2>
          <div className="grid">
            <div>
              <label htmlFor="venue">Venue type</label>
              <select
                id="venue"
                value={venueType}
                onChange={(e) =>
                  setVenueType(e.target.value as ServiceInput["venueType"])
                }
              >
                {VENUE_CHOICES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lead">
                Supplier lead time
                <span className="hint">Hours between order and delivery</span>
              </label>
              <input
                id="lead"
                type="number"
                min={0}
                value={leadTimeHours}
                onChange={(e) => setLeadTimeHours(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="fridge">
                Usable cold storage
                <span className="hint">kg — about 70% of nominal</span>
              </label>
              <input
                id="fridge"
                type="number"
                min={0}
                placeholder="optional"
                value={fridgeCapacityKg}
                onChange={(e) => setFridgeCapacityKg(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="prep">
                Prep hours rostered
                <span className="hint">Across the week</span>
              </label>
              <input
                id="prep"
                type="number"
                min={0}
                placeholder="optional"
                value={prepHoursAvailable}
                onChange={(e) => setPrepHoursAvailable(e.target.value)}
              />
            </div>
            {venueType === "kiosk" && (
              <div>
                <label htmlFor="window">
                  Service window
                  <span className="hint">Hours open on the busiest day</span>
                </label>
                <input
                  id="window"
                  type="number"
                  min={0}
                  step={0.5}
                  value={serviceWindowHours}
                  onChange={(e) => setServiceWindowHours(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Forecast covers</h2>
          <p className="basis">
            {VENUE_COVERS_HELP[venueType]} Leave a day at zero if you&rsquo;re
            closed.
          </p>
          <div className="grid">
            {WEEKDAY_CHOICES.map((day) => (
              <div key={day}>
                <label htmlFor={`covers-${day}`}>{day}</label>
                <input
                  id={`covers-${day}`}
                  type="number"
                  min={0}
                  value={covers[day]}
                  onChange={(e) =>
                    setCovers((current) => ({
                      ...current,
                      [day]: Number(e.target.value),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <h3>Delivery days</h3>
          <p className="basis">
            Each delivery has to carry every cover until the next one lands.
          </p>
          <div className="checks">
            {WEEKDAY_CHOICES.map((day) => (
              <label className="check" key={day}>
                <input
                  type="checkbox"
                  checked={deliveryDays.includes(day)}
                  onChange={() => toggleDelivery(day)}
                />
                {day}
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Menu</h2>

          {parsingAvailable && (
            <>
              <label htmlFor="menuText">
                Paste your menu
                <span className="hint">
                  Optional shortcut — it fills the rows below so you don&rsquo;t
                  type them. Every quantity still comes from the calculator.
                </span>
              </label>
              <textarea
                id="menuText"
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
                placeholder="Braised beef cheek, mash, jus&#10;Market fish, fennel, salsa verde&#10;Garden salad…"
              />
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={parseMenu}
                  disabled={parsing || menuText.trim().length < 10}
                >
                  {parsing ? "Reading…" : "Read the menu"}
                </button>
              </div>
            </>
          )}
          {parseNote && <p className="notice">{parseNote}</p>}

          <h3>Items</h3>
          {items.map((item, index) => (
            <div className="row-item" key={index}>
              <div>
                <label htmlFor={`name-${index}`}>Dish</label>
                <input
                  id={`name-${index}`}
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`cat-${index}`}>Course</label>
                <select
                  id={`cat-${index}`}
                  value={item.category}
                  onChange={(e) =>
                    updateItem(index, {
                      category: e.target.value as ServiceItem["category"],
                    })
                  }
                >
                  {SERVICE_CATEGORY_CHOICES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`prot-${index}`}>Protein</label>
                <select
                  id={`prot-${index}`}
                  value={item.proteinKey ?? ""}
                  onChange={(e) =>
                    updateItem(index, {
                      proteinKey: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">No yield loss</option>
                  {PROTEIN_CHOICES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`portion-${index}`}>Portion (g)</label>
                <input
                  id={`portion-${index}`}
                  type="number"
                  min={1}
                  value={item.portionG}
                  onChange={(e) =>
                    updateItem(index, { portionG: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label htmlFor={`shelf-${index}`}>Shelf life</label>
                <select
                  id={`shelf-${index}`}
                  value={item.shelfLife}
                  onChange={(e) =>
                    updateItem(index, {
                      shelfLife: e.target.value as ServiceItem["shelfLife"],
                    })
                  }
                >
                  {SHELF_LIFE_CHOICES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`hand-${index}`}>On hand (kg)</label>
                <input
                  id={`hand-${index}`}
                  type="number"
                  min={0}
                  step={0.5}
                  value={item.onHandKg ?? 0}
                  onChange={(e) =>
                    updateItem(index, { onHandKg: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          ))}

          <div className="actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setItems((current) => [...current, BLANK_ITEM])}
            >
              Add an item
            </button>
            {items.length > 1 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setItems((current) => current.slice(0, -1))}
              >
                Remove the last
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="notice">
            <strong>{error}</strong>
          </p>
        )}

        <div className="actions">
          <button type="submit" disabled={busy}>
            {busy ? "Working it out…" : "Build the par levels"}
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

      {plan && <ServiceResult plan={plan} />}
    </>
  );
}
