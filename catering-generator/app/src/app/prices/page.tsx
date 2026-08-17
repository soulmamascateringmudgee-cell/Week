"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import InvoiceReader from "@/components/InvoiceReader.tsx";
import type { PriceChange } from "@/lib/price-change.ts";

interface StoredPrice {
  id: string;
  item: string;
  unit: string;
  price: number;
  supplier: string | null;
  updated_at: string;
}

const UNITS = ["kg", "L", "ea", "bunches", "punnets", "tins", "packets", "g", "ml"];

interface PriceMove {
  item: string;
  change: PriceChange;
  supplier: string | null;
  when: string;
}

export default function PricesPage() {
  const [prices, setPrices] = useState<StoredPrice[]>([]);
  const [moves, setMoves] = useState<PriceMove[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [item, setItem] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/prices");
      const body = await response.json();
      if (!response.ok) setError(body.error ?? "Couldn't load your prices.");
      else {
        setError("");
        setPrices(body.prices as StoredPrice[]);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }

    // What's moved is a bonus on top of the price list. If it fails, the
    // prices still load — losing the whole page over a sidebar would be daft.
    try {
      const response = await fetch("/api/prices/moves");
      if (response.ok) {
        const body = await response.json();
        setMoves(body.moves as PriceMove[]);
      }
    } catch {
      // Nothing to say. The list below is the page.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item, unit, price: Number(price), supplier }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Couldn't save that price.");
      } else {
        setError("");
        setItem("");
        setPrice("");
        setSupplier("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: StoredPrice) {
    if (!window.confirm(`Remove the price for ${row.item}?`)) return;
    await fetch(`/api/prices?id=${row.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <h1>What things cost</h1>
      <p className="lede">
        Put a price against an ingredient once and every job that uses it gets
        costed. Names are matched to your order list, so pricing
        &ldquo;bacon&rdquo; here covers the bacon in the sausage rolls and the
        bacon in the quiche.
      </p>

      {note && (
        <p className="notice">
          <strong>{note}</strong>
        </p>
      )}

      <InvoiceReader
        current={prices.map(({ item, unit, price }) => ({ item, unit, price }))}
        onApplied={(message) => {
          setNote(message);
          void load();
        }}
      />

      {moves.length > 0 && (
        <div className="card">
          <h2>What&rsquo;s moved</h2>
          <p className="basis">
            Since the time before last on each of these. Only things with two
            recorded prices can move — a first price is a starting point.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Change</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((move) => (
                  <tr key={move.item}>
                    <td>
                      {move.item}
                      {move.supplier && (
                        <div className="basis">{move.supplier}</div>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          move.change.kind === "up" ||
                          move.change.kind === "unit-changed"
                            ? "tag warn"
                            : "tag"
                        }
                      >
                        {move.change.kind === "unit-changed"
                          ? "check"
                          : move.change.kind}
                      </span>
                      <div className="basis">{move.change.note}</div>
                    </td>
                    <td className="basis">{move.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form onSubmit={add}>
        <div className="card">
          <h2>Add a price</h2>
          <div className="grid">
            <div>
              <label htmlFor="price-item">
                Ingredient
                <span className="hint">
                  Spell it the way it appears on your order list
                </span>
              </label>
              <input
                id="price-item"
                type="text"
                required
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="bacon"
              />
            </div>
            <div>
              <label htmlFor="price-amount">Price</label>
              <input
                id="price-amount"
                type="number"
                onFocus={(e) => e.target.select()}
                min={0}
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="18.50"
              />
            </div>
            <div>
              <label htmlFor="price-unit">
                Per
                <span className="hint">The unit that price buys</span>
              </label>
              <select
                id="price-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="price-supplier">
                Supplier
                <span className="hint">Optional</span>
              </label>
              <input
                id="price-supplier"
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="notice">
              <strong>{error}</strong>
            </p>
          )}

          <div className="actions">
            <button type="submit" disabled={busy || item.trim() === "" || price === ""}>
              {busy ? "Saving…" : "Save price"}
            </button>
          </div>
          <p className="basis" style={{ marginTop: 10 }}>
            Entering an ingredient you&rsquo;ve already priced updates it.
            Prices change; you shouldn&rsquo;t have to hunt for the old row.
          </p>
        </div>
      </form>

      <h2>Your prices</h2>
      {loading && <div className="card">Loading…</div>}
      {!loading && prices.length === 0 && (
        <div className="card">
          <p>
            Nothing priced yet. Start with the expensive things — the meat and
            the seafood are where a job goes over budget, not the parsley.
          </p>
          <p className="basis">
            You don&rsquo;t need everything priced to be useful. Anything
            without a price is listed separately on the job, so you always know
            what the number leaves out.
          </p>
        </div>
      )}

      {prices.length > 0 && (
        <div className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Supplier</th>
                  <th style={{ textAlign: "right" }}>Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {prices.map((row) => (
                  <tr key={row.id}>
                    <td>{row.item}</td>
                    <td>{row.supplier ?? "—"}</td>
                    <td className="num">
                      ${row.price.toFixed(2)} / {row.unit}
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
          <p className="basis" style={{ marginTop: 12 }}>
            Set a budget on a job in <Link href="/event">Event</Link> and
            you&rsquo;ll get the food cost, the cost per head, and whether it
            fits.
          </p>
        </div>
      )}
    </>
  );
}
