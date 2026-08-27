"use client";

import { useState } from "react";

import { useDictation } from "@/lib/use-dictation.ts";

export interface DictatedStockLine {
  item: string;
  qty: number;
  unit: string;
  place: string;
  unclear: string;
}

/**
 * Count the pantry out loud.
 *
 * Counting a coolroom is a two-handed job, and the thing you cannot do with
 * your hands full of boxes is type. So you talk, and the words become rows.
 *
 * The recogniser is the browser's own, so the talking costs nothing and no
 * audio leaves the phone — only the finished text is sent to be structured.
 * It isn't available everywhere, so the typed form stays the main way in and
 * this offers itself when it can.
 *
 * Nothing is saved from here. Lines land in a review list first, because a
 * misheard "fifteen" for "fifty" on a pantry count is a job that turns up
 * short, and the moment to catch that is before it's written down.
 */
export default function DictateStock({
  onRead,
  onNote,
}: {
  onRead: (lines: DictatedStockLine[], notes: string[]) => void;
  onNote: (message: string) => void;
}) {
  const {
    supported,
    listening,
    finishing,
    error,
    transcript,
    interim,
    setTranscript,
    start,
    stop,
    cancel,
    reset,
  } = useDictation();
  const [busy, setBusy] = useState(false);

  if (!supported) {
    return (
      <p className="basis" style={{ marginTop: 18 }}>
        This browser can&rsquo;t do dictation — Chrome and Safari can, Firefox
        can&rsquo;t. Type the count in instead.
      </p>
    );
  }

  async function read() {
    setBusy(true);
    onNote("");
    try {
      const response = await fetch("/api/read-stock-voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        // The words stay in the box — they're the expensive part, and losing
        // a whole coolroom because the reader failed would mean walking it
        // again.
        onNote(body.error ?? "Couldn't read that one.");
        return;
      }

      const stocktake = body.stocktake as {
        lines: DictatedStockLine[];
        notes: string[];
      };
      onRead(stocktake.lines, stocktake.notes ?? []);
      reset();
    } catch {
      onNote("Couldn't reach the server. Your words are still in the box.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dictate">
      <label htmlFor="stock-dictation" style={{ marginTop: 18 }}>
        Count it out loud
        <span className="hint">
          Walk the shelf and say what&rsquo;s there —{" "}
          <em>
            two boxes of roma tomatoes, about four kilos of brisket in the chest
            freezer, half a bag of plain flour
          </em>
          . Corrections are fine; say &ldquo;no, two&rdquo; and it takes the
          two.
        </span>
      </label>

      <div className="actions" style={{ marginTop: 0, marginBottom: 10 }}>
        {listening && (
          <button type="button" onClick={stop}>
            <span className="rec" aria-hidden="true" /> Stop
          </button>
        )}
        {finishing && (
          <button type="button" onClick={cancel}>
            Finishing… tap to stop now
          </button>
        )}
        {!listening && !finishing && (
          <button type="button" onClick={start} disabled={busy}>
            {transcript ? "Keep counting" : "Start counting"}
          </button>
        )}
        {transcript && !listening && !finishing && (
          <button
            type="button"
            className="linklike"
            onClick={reset}
            disabled={busy}
          >
            Clear and start again
          </button>
        )}
      </div>

      {listening && (
        <p className="basis">
          Listening — talk normally, pauses are fine. Tap Stop when you&rsquo;re
          done.
        </p>
      )}

      {finishing && <p className="basis">Catching the last bit — one second.</p>}

      {(transcript || interim) && (
        <textarea
          id="stock-dictation"
          value={transcript + (interim ? ` ${interim}` : "")}
          onChange={(e) => setTranscript(e.target.value)}
          readOnly={listening || finishing}
          placeholder="What you say appears here…"
        />
      )}

      {error && (
        <p className="notice warn" style={{ marginTop: 10 }}>
          <strong>{error}</strong>
        </p>
      )}

      {transcript && !listening && !finishing && (
        <div className="actions">
          <button type="button" onClick={() => void read()} disabled={busy}>
            {busy ? "Reading it…" : "Turn this into a stock list"}
          </button>
        </div>
      )}
    </div>
  );
}
