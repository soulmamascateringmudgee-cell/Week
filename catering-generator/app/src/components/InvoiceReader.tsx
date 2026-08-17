"use client";

import { useState } from "react";

import {
  describeChange,
  toUnitPrice,
  type PriceChange,
} from "@/lib/price-change.ts";

interface ReadLine {
  item: string;
  qty: number;
  unit: string;
  lineTotal: number;
  unclear: string;
}

interface ReadInvoice {
  supplier: string;
  invoiceDate: string;
  lines: ReadLine[];
  notes: string[];
}

/** A line after review — what will actually be saved. */
interface ReviewRow {
  item: string;
  price: number;
  unit: string;
  /** How it compares to the price already on file. */
  change: PriceChange;
  /** What the reader was unsure about on this line, if anything. */
  unclear: string;
  /** What was printed, kept so the cook can check the sum. */
  printed: string;
  keep: boolean;
}

/**
 * Photograph a supplier invoice; check what it read; apply it to the prices.
 *
 * The review table is the whole point, not a formality. These numbers go
 * straight into what a job costs and therefore into what somebody quotes, so
 * every line shows what was printed on the docket, what it works out to per
 * unit, and how that compares to the price already on file — before anything
 * is saved. A line the reader was unsure about says so, and a line whose unit
 * changed is flagged rather than turned into a percentage.
 */
export default function InvoiceReader({
  current,
  onApplied,
}: {
  /** Prices already on file, for the comparison column. */
  current: { item: string; unit: string; price: number }[];
  onApplied: (message: string) => void;
}) {
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<ReadInvoice | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);

  function build(read: ReadInvoice): ReviewRow[] {
    const priced = new Map(
      current.map((p) => [p.item.toLowerCase(), { price: p.price, unit: p.unit }]),
    );

    const built: ReviewRow[] = [];
    for (const line of read.lines) {
      const unit = toUnitPrice(line);
      // A line the maths can't stand behind — no quantity, a credit — is
      // dropped rather than saved as a guess.
      if (!unit) continue;
      built.push({
        item: unit.item,
        price: unit.price,
        unit: unit.unit,
        change: describeChange(priced.get(unit.item) ?? null, unit),
        unclear: line.unclear ?? "",
        printed: `${line.qty} ${line.unit} for $${line.lineTotal.toFixed(2)}`,
        keep: true,
      });
    }
    return built;
  }

  async function read(file: File) {
    setReading(true);
    setError("");
    setInvoice(null);
    setRows([]);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("read failed"));
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/read-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaType: file.type, data }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Couldn't read that invoice.");
        return;
      }

      const readInvoice = body.invoice as ReadInvoice;
      const built = build(readInvoice);
      if (built.length === 0) {
        setError(
          "Nothing on that docket had both an amount and a price. Check the quantities column is in frame.",
        );
        return;
      }
      setInvoice(readInvoice);
      setRows(built);
    } catch {
      setError("Couldn't read that invoice.");
    } finally {
      setReading(false);
    }
  }

  async function apply() {
    setSaving(true);
    setError("");
    const keeping = rows.filter((row) => row.keep);
    try {
      const response = await fetch("/api/prices/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: keeping.map(({ item, unit, price }) => ({ item, unit, price })),
          supplier: invoice?.supplier ?? "",
          pricedOn: invoice?.invoiceDate ?? "",
          source: "invoice",
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Couldn't save those prices.");
        return;
      }

      setInvoice(null);
      setRows([]);
      onApplied(
        `${body.saved} price${body.saved === 1 ? "" : "s"} updated from that docket.` +
          (body.warning ? ` ${body.warning}` : ""),
      );
    } catch {
      setError("Couldn't reach the server. Nothing has been saved.");
    } finally {
      setSaving(false);
    }
  }

  const keeping = rows.filter((row) => row.keep).length;

  return (
    <div className="card">
      <h2>Photograph an invoice</h2>
      <p className="basis">
        The docket from your butcher, greengrocer or wholesaler. It reads the
        lines into prices you can check, then updates your list — what you
        actually paid, not a supermarket shelf price.
      </p>

      <input
        id="invoice-photo"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={reading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same photo twice still fires.
          e.target.value = "";
          if (file) void read(file);
        }}
      />
      {reading && <p className="notice">Reading the invoice…</p>}

      {error && (
        <p className="notice" style={{ marginTop: 12 }}>
          <strong>{error}</strong>
        </p>
      )}

      {invoice && rows.length > 0 && (
        <>
          <h3>
            {invoice.supplier || "That docket"}
            {invoice.invoiceDate && (
              <span className="basis"> · {invoice.invoiceDate}</span>
            )}
          </h3>

          {invoice.notes.length > 0 && (
            <p className="notice">
              {invoice.notes.map((note) => (
                <span key={note}>{note} </span>
              ))}
            </p>
          )}

          <p className="basis">
            Check every line before saving — these become what your jobs are
            costed against. Untick anything you don&rsquo;t want.
          </p>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Keep</th>
                  <th>Item</th>
                  <th style={{ textAlign: "right" }}>Works out to</th>
                  <th>Against your list</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.item}-${index}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.keep}
                        aria-label={`Keep ${row.item}`}
                        onChange={() =>
                          setRows((all) =>
                            all.map((r, i) =>
                              i === index ? { ...r, keep: !r.keep } : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      {row.item}
                      <div className="basis">{row.printed}</div>
                      {row.unclear && (
                        <div className="basis">
                          <strong>Check:</strong> {row.unclear}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      ${row.price.toFixed(2)}
                      <div className="basis">a {row.unit}</div>
                    </td>
                    <td>
                      <span
                        className={
                          row.change.kind === "up" ||
                          row.change.kind === "unit-changed"
                            ? "tag warn"
                            : "tag"
                        }
                      >
                        {row.change.kind === "unit-changed"
                          ? "check"
                          : row.change.kind}
                      </span>
                      <div className="basis">{row.change.note}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="actions">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={saving || keeping === 0}
            >
              {saving
                ? "Saving…"
                : `Update ${keeping} price${keeping === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              className="linklike"
              onClick={() => {
                setInvoice(null);
                setRows([]);
              }}
              disabled={saving}
            >
              Discard this one
            </button>
          </div>
        </>
      )}
    </div>
  );
}
