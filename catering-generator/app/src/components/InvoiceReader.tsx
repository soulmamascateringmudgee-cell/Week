"use client";

import { useState } from "react";

import {
  describeChange,
  toUnitPrice,
  type PriceChange,
} from "@/lib/price-change.ts";
import { UploadTooLargeError, prepareUpload } from "@/lib/upload-file.ts";

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

/**
 * What each kind of change looks like in the review table.
 *
 * A price going up costs money on the next job, so it's the loud one. A
 * price going down is good news and reads that way. `unit-changed` is
 * neither — it means the docket priced this by the kilo where the list has
 * it by the each, so the two can't be compared at all and somebody has to
 * look. That's a different thing from a rise and shouldn't borrow its
 * colour.
 */
const TONE: Record<PriceChange["kind"], string> = {
  up: "warn",
  down: "good",
  new: "",
  same: "",
  "unit-changed": "check",
};

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

/** Matches the API's own ceiling for a PDF; images are shrunk under it. */
const MAX_UPLOAD_BYTES = 30_000_000;

/** Matches the reader's own limit. Kept in step with MAX_PAGES in lib/pages.ts. */
const MAX_PAGES = 8;

/** A photo or PDF waiting to be read, with the name to show the cook. */
interface StagedPage {
  name: string;
  mediaType: string;
  data: string;
}

/** The three Mudgee has, plus the one a lot of country towns have instead. */
const SHOPS = ["Woolworths", "Coles", "Aldi", "IGA"];

/**
 * Photograph a docket or a receipt; check what it read; apply it to the prices.
 *
 * The review table is the whole point, not a formality. These numbers go
 * straight into what a job costs and therefore into what somebody quotes, so
 * every line shows what was printed on the docket, what it works out to per
 * unit, and how that compares to the price already on file — before anything
 * is saved. A line the reader was unsure about says so, and a line whose unit
 * changed is flagged rather than turned into a percentage.
 *
 * A supermarket receipt reads differently from a wholesale docket — the amount
 * is inside the product name rather than in a quantity column — so the two are
 * different modes, and the reader is told which one it's looking at rather
 * than left to work it out. The shop matters as much as the price: a town
 * without a wholesaler means the same brisket has three prices, and the whole
 * point is knowing which of them is cheapest.
 */
export default function InvoiceReader({
  current,
  onApplied,
}: {
  /** Prices already on file, for the comparison column. */
  current: { item: string; unit: string; price: number; supplier?: string | null }[];
  onApplied: (message: string) => void;
}) {
  const [reading, setReading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /**
   * Photos chosen but not yet read.
   *
   * A supermarket receipt for a job is longer than one photograph can hold and
   * still be legible, and a phone camera takes one shot at a time — so the
   * photos collect here and go to the reader together. Reading them one at a
   * time would produce a separate half-receipt for each, and lose any line
   * that straddles the join.
   */
  const [pages, setPages] = useState<StagedPage[]>([]);
  const [invoice, setInvoice] = useState<ReadInvoice | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [kind, setKind] = useState<"invoice" | "receipt">("invoice");
  /** Which shop the receipt is from, when the header didn't say. */
  const [shop, setShop] = useState("");

  function build(read: ReadInvoice, forShop: string): ReviewRow[] {
    // Keyed by item *and* shop. Comparing an Aldi receipt line against the
    // Woolworths price on file would report a 30% fall that is really just two
    // different shops — the sort of confident wrong number this whole app is
    // built to avoid. No price for this shop yet means the line is new here,
    // which is true and useful.
    const priced = new Map(
      current.map((p) => [
        `${p.item.toLowerCase()}|${(p.supplier ?? "").toLowerCase()}`,
        { price: p.price, unit: p.unit },
      ]),
    );
    const key = (item: string) => `${item}|${forShop.toLowerCase()}`;

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
        change: describeChange(priced.get(key(unit.item)) ?? null, unit),
        unclear: line.unclear ?? "",
        printed: `${line.qty} ${line.unit} for $${line.lineTotal.toFixed(2)}`,
        keep: true,
      });
    }
    return built;
  }

  /** Take the chosen files, shrink them, and add them to what's waiting. */
  async function stage(chosen: File[]) {
    setAdding(true);
    setError("");
    try {
      const room = MAX_PAGES - pages.length;
      if (room <= 0) {
        setError(
          `That's already ${MAX_PAGES} photos, as many as the reader takes at once. Read these first, then do the rest as a second lot.`,
        );
        return;
      }

      const taking = chosen.slice(0, room);
      const added: StagedPage[] = [];
      for (const file of taking) {
        // Shrunk and re-encoded here rather than shipped whole: an iPhone
        // photo is HEIC, which the API doesn't take, and 12 MB of it over
        // country internet to read forty words is a poor trade.
        const upload = await prepareUpload(file, MAX_UPLOAD_BYTES);
        added.push({
          name: file.name || `Photo ${pages.length + added.length + 1}`,
          mediaType: upload.mediaType,
          data: upload.data,
        });
      }
      setPages((waiting) => [...waiting, ...added]);

      if (chosen.length > room) {
        setError(
          `Added ${room} of those ${chosen.length}. The reader takes ${MAX_PAGES} at a time; do the rest as a second lot.`,
        );
      }
    } catch (problem) {
      setError(
        problem instanceof UploadTooLargeError
          ? problem.message
          : "Couldn't open that file. Try another photo.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function read() {
    setReading(true);
    setError("");
    setInvoice(null);
    setRows([]);
    try {
      const response = await fetch("/api/read-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pages: pages.map(({ mediaType, data }) => ({ mediaType, data })),
          kind,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? `Couldn't read that ${kind}.`);
        return;
      }

      const readInvoice = body.invoice as ReadInvoice;
      // What you picked wins over what the header read. You know which shop
      // you were standing in; the top of a crumpled receipt might not say.
      const forShop = shop.trim() || readInvoice.supplier || "";
      const built = build({ ...readInvoice, supplier: forShop }, forShop);
      if (built.length === 0) {
        setError(
          kind === "receipt"
            ? "Nothing on that receipt had both an amount and a price. Check the item lines are in frame, not just the total."
            : "Nothing on that docket had both an amount and a price. Check the quantities column is in frame.",
        );
        return;
      }
      setInvoice({ ...readInvoice, supplier: forShop });
      setRows(built);
      // Cleared only once it has been read into something reviewable. On any
      // failure the photos stay, so a slow connection doesn't cost you a walk
      // back out to the car for the receipt.
      setPages([]);
    } catch {
      setError(`Couldn't read that ${kind}.`);
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
        `${body.saved} price${body.saved === 1 ? "" : "s"} updated from that ${kind}` +
          (invoice?.supplier ? ` at ${invoice.supplier}` : "") +
          "." +
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
      <h2>Add a docket</h2>
      <p className="basis">
        Photograph it, pick one out of your camera roll, or upload the PDF the
        supplier emailed. A long receipt can go in as several photos and be
        read as one. It turns the lines into prices you can check, then updates
        your list — what you actually paid, not an advertised price.
      </p>

      <fieldset className="choices">
        <legend>What are you photographing?</legend>
        <label>
          <input
            type="radio"
            name="docket-kind"
            checked={kind === "invoice"}
            disabled={reading}
            onChange={() => setKind("invoice")}
          />
          A supplier invoice — butcher, greengrocer, wholesaler
        </label>
        <label>
          <input
            type="radio"
            name="docket-kind"
            checked={kind === "receipt"}
            disabled={reading}
            onChange={() => setKind("receipt")}
          />
          A supermarket receipt — Woolworths, Coles, Aldi
        </label>
      </fieldset>

      {kind === "receipt" && (
        <>
          <label htmlFor="receipt-shop">Which shop?</label>
          <select
            id="receipt-shop"
            value={shop}
            disabled={reading}
            onChange={(e) => setShop(e.target.value)}
          >
            <option value="">Read it off the receipt</option>
            {SHOPS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="basis">
            Every price is saved against its shop, so the same brisket can hold
            a Woolies price and an Aldi one. Costing a job then takes whichever
            is cheapest and tells you where to go.
          </p>
          <p className="basis">
            A photo of the paper receipt or a PDF both work, and a receipt too
            long for one photo can go in as several. Photos are shrunk on your
            phone before they upload, so a big picture over slow internet
            isn&rsquo;t a problem.
          </p>
        </>
      )}

      {/*
        No `capture` attribute. Setting it forces the camera and removes the
        "Photo Library" and "Browse" options from the phone's own picker — so a
        receipt already sitting in the camera roll, or the PDF the supplier
        emailed, becomes impossible to choose. Without it the OS offers all
        three, camera included.

        `multiple` lets several be picked from the library at once. It doesn't
        help the camera, which takes one shot at a time — which is why the
        photos stage up below rather than being read the moment one arrives.
      */}
      <input
        id="invoice-photo"
        type="file"
        accept="image/*,application/pdf"
        multiple
        disabled={reading || adding}
        onChange={(e) => {
          const chosen = Array.from(e.target.files ?? []);
          // Cleared so choosing the same photo twice still fires.
          e.target.value = "";
          if (chosen.length > 0) void stage(chosen);
        }}
      />
      {adding && <p className="notice">Getting {pages.length > 0 ? "those" : "that"} ready…</p>}

      {pages.length > 0 && (
        <>
          <p className="basis" style={{ marginTop: 12 }}>
            {pages.length === 1
              ? "One photo ready."
              : `${pages.length} photos ready, and they'll be read as one ${kind}.`}{" "}
            Add another if the {kind} runs past the bottom of the frame — a long
            receipt is easier to read in sections than squeezed into one shot.
          </p>
          <ul className="pages">
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
                  onClick={() =>
                    setPages((waiting) => waiting.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="actions">
            <button
              type="button"
              onClick={() => void read()}
              disabled={reading || adding}
            >
              {reading
                ? "Reading…"
                : pages.length === 1
                  ? `Read this ${kind}`
                  : `Read these ${pages.length} photos`}
            </button>
            <button
              type="button"
              className="linklike"
              disabled={reading || adding}
              onClick={() => {
                setPages([]);
                setError("");
              }}
            >
              Start again
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="notice warn" style={{ marginTop: 12 }}>
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
            <p className="notice check">
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
                      <span className={`tag ${TONE[row.change.kind]}`}>
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
