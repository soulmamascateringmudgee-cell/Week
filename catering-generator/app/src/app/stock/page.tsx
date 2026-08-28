"use client";

import { useCallback, useEffect, useState } from "react";

import DictateStock, {
  type DictatedStockLine,
} from "@/components/DictateStock.tsx";

interface StockRow {
  id: string;
  item: string;
  qty: number;
  unit: string;
  place: string;
  counted_on: string;
  updated_at: string;
}

/** A dictated line waiting to be checked before it's saved. */
interface ReviewRow extends DictatedStockLine {
  keep: boolean;
}

/**
 * The pantry count.
 *
 * Two ways in, because counting a coolroom and remembering one thing at the
 * bench are different jobs. You talk your way through a shelf; you type a
 * single line.
 *
 * Nothing dictated is saved without being looked at. A misheard "fifty" for
 * "fifteen" on a pantry count is a job that turns up short, and the moment to
 * catch it is before it's written down — the same rule the invoice reader
 * works to.
 */
export default function StockPage() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [readNotes, setReadNotes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [place, setPlace] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stock");
      const body = await response.json().catch(() => ({}));
      if (response.ok) setStock(body.stock ?? []);
      else setNote(body.error ?? "Couldn't load your stock.");
    } catch {
      setNote("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(lines: { item: string; qty: number; unit: string; place: string }[]) {
    setSaving(true);
    try {
      const response = await fetch("/api/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNote(body.error ?? "Couldn't save that.");
        return false;
      }
      setNote(
        `${body.saved} line${body.saved === 1 ? "" : "s"} counted.` +
          (body.rejected
            ? ` ${body.rejected} skipped for want of an amount.`
            : ""),
      );
      await load();
      return true;
    } catch {
      setNote("Couldn't reach the server. Nothing has been saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addOne(event: React.FormEvent) {
    event.preventDefault();
    const ok = await save([
      { item, qty: Number(qty), unit, place },
    ]);
    if (ok) {
      setItem("");
      setQty("");
      setPlace("");
    }
  }

  async function remove(row: StockRow) {
    try {
      const response = await fetch(`/api/stock?id=${row.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setNote(`${row.item} taken off the count.`);
        await load();
      } else {
        setNote("Couldn't remove that line.");
      }
    } catch {
      setNote("Couldn't reach the server.");
    }
  }

  const keeping = rows.filter((row) => row.keep);

  return (
    <>
      <h1>What&rsquo;s in the pantry</h1>
      <p className="lede">
        Count what you already have and the job sheet marks it, so you
        don&rsquo;t buy a second box of what&rsquo;s behind the first one. It
        never takes the amount off your order by itself — a count is a memory
        of a Tuesday, and you&rsquo;re the one who knows if it still holds.
      </p>

      {note && (
        <p className="notice ok">
          <strong>{note}</strong>
        </p>
      )}

      <div className="card">
        <h2>Count it out loud</h2>
        <p className="basis">
          Hands full of boxes is exactly when you can&rsquo;t type. Talk through
          the shelf instead and check the list before it saves.
        </p>
        <DictateStock
          onRead={(lines, notes) => {
            setRows(lines.map((line) => ({ ...line, keep: line.qty > 0 })));
            setReadNotes(notes);
            setNote("");
          }}
          onNote={setNote}
        />
      </div>

      {rows.length > 0 && (
        <div className="card">
          <h2>Check the count</h2>
          <p className="basis">
            Nothing is saved yet. Anything it wasn&rsquo;t sure about is
            unticked — give it an amount or leave it out.
          </p>

          {readNotes.map((line) => (
            <p className="notice check" key={line}>
              {line}
            </p>
          ))}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Keep</th>
                  <th>Item</th>
                  <th>Amount</th>
                  <th>Where</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.item}-${i}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.keep}
                        aria-label={`Keep ${row.item}`}
                        onChange={(e) =>
                          setRows((all) =>
                            all.map((r, j) =>
                              j === i ? { ...r, keep: e.target.checked } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      {row.item}
                      {row.unclear && (
                        <div className="basis">{row.unclear}</div>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.qty || ""}
                        placeholder="how much?"
                        aria-label={`Amount of ${row.item}`}
                        onChange={(e) =>
                          setRows((all) =>
                            all.map((r, j) =>
                              j === i
                                ? { ...r, qty: Number(e.target.value) }
                                : r,
                            ),
                          )
                        }
                      />{" "}
                      {row.unit}
                    </td>
                    <td>{row.place || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="actions">
            <button
              type="button"
              disabled={saving || keeping.length === 0}
              onClick={async () => {
                const ok = await save(
                  keeping.map(({ item: i, qty: q, unit: u, place: p }) => ({
                    item: i,
                    qty: q,
                    unit: u,
                    place: p,
                  })),
                );
                if (ok) {
                  setRows([]);
                  setReadNotes([]);
                }
              }}
            >
              {saving
                ? "Saving…"
                : `Save ${keeping.length} line${keeping.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              className="linklike"
              onClick={() => {
                setRows([]);
                setReadNotes([]);
              }}
            >
              Throw this away
            </button>
          </div>
        </div>
      )}

      <form className="card" onSubmit={(e) => void addOne(e)}>
        <h2>Add one thing</h2>

        <label htmlFor="stock-item">What is it?</label>
        <input
          id="stock-item"
          type="text"
          value={item}
          required
          placeholder="Beef brisket"
          onChange={(e) => setItem(e.target.value)}
        />

        <label htmlFor="stock-qty">How much?</label>
        <input
          id="stock-qty"
          type="number"
          step="any"
          min="0"
          value={qty}
          required
          placeholder="4"
          onChange={(e) => setQty(e.target.value)}
        />

        <label htmlFor="stock-unit">
          Counted in
          <span className="hint">
            However you counted it. Boxes are fine — a box isn&rsquo;t a fixed
            weight, and guessing what one weighs would put an invented number on
            your order sheet.
          </span>
        </label>
        <input
          id="stock-unit"
          type="text"
          value={unit}
          required
          placeholder="kg"
          onChange={(e) => setUnit(e.target.value)}
        />

        <label htmlFor="stock-place">
          Where <span className="hint">Optional. Chest freezer, dry store, van.</span>
        </label>
        <input
          id="stock-place"
          type="text"
          value={place}
          placeholder="Chest freezer"
          onChange={(e) => setPlace(e.target.value)}
        />

        <div className="actions">
          <button type="submit" disabled={saving}>
            Add to the count
          </button>
        </div>
      </form>

      <h2>Your count</h2>
      {loading && <div className="card">Loading…</div>}
      {!loading && stock.length === 0 && (
        <div className="card">
          <p>Nothing counted yet.</p>
          <p className="basis">
            Start with the expensive things and the things you always seem to
            have three of. You don&rsquo;t need a full count to be useful —
            anything not on here just isn&rsquo;t marked on the job.
          </p>
        </div>
      )}

      {stock.length > 0 && (
        <div className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Where</th>
                  <th>Counted</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stock.map((row) => (
                  <tr key={row.id}>
                    <td>{row.item}</td>
                    <td>{row.place || "—"}</td>
                    <td>{row.counted_on}</td>
                    <td className="num">
                      {row.qty} {row.unit}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="linklike"
                        onClick={() => void remove(row)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
