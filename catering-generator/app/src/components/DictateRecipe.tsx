"use client";

import { useState } from "react";

import { useDictation } from "@/lib/use-dictation.ts";
import type { RecipeIngredient } from "@/lib/types.ts";

export interface DictatedRecipe {
  name: string;
  serves: number;
  ingredients: RecipeIngredient[];
  method: string;
  unclear: string[];
}

/**
 * Say a recipe out loud instead of typing it.
 *
 * Two steps on purpose. You talk, and the words appear in a box you can edit;
 * only then does it go off to be turned into ingredient rows. The recogniser
 * mishears — flour and salt becomes "four salt" — and it is far easier to fix
 * a word in a sentence than to work out afterwards why the order sheet wants
 * four of something.
 *
 * Nothing is uploaded while you talk: the recognition runs in the browser, and
 * only the finished text is sent.
 */
export default function DictateRecipe({
  onRead,
  onNote,
}: {
  onRead: (recipe: DictatedRecipe) => void;
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
        can&rsquo;t. Photograph the recipe or type it in instead.
      </p>
    );
  }

  async function read() {
    setBusy(true);
    onNote("");
    try {
      const response = await fetch("/api/read-recipe-voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        // The words stay in the box — they're the expensive part, and losing
        // them because the reader failed would mean saying it all again.
        onNote(body.error ?? "Couldn't read that one.");
        return;
      }

      const recipe = body.recipe as DictatedRecipe;
      onRead(recipe);
      reset();
    } catch {
      onNote("Couldn't reach the server. Your words are still in the box.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dictate">
      <label htmlFor="dictation" style={{ marginTop: 18 }}>
        Say the recipe
        <span className="hint">
          Talk it through the way you&rsquo;d tell someone: the dish, who it
          feeds, then the amounts. Fix any words it mishears before reading it.
        </span>
      </label>

      <div className="actions" style={{ marginTop: 0, marginBottom: 10 }}>
        {listening && (
          <button type="button" onClick={stop}>
            <span className="rec" aria-hidden="true" /> Stop
          </button>
        )}
        {/* "Finishing" is a real state, not a gap. The last phrase is often
            still coming back from the recogniser, and saying so beats a button
            that looks like it ignored the tap. */}
        {finishing && (
          <button type="button" onClick={cancel}>
            Finishing… tap to stop now
          </button>
        )}
        {!listening && !finishing && (
          <button type="button" onClick={start} disabled={busy}>
            {transcript ? "Keep talking" : "Start talking"}
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

      {finishing && (
        <p className="basis">Catching the last bit — one second.</p>
      )}

      {(transcript || interim) && (
        <textarea
          id="dictation"
          value={transcript + (interim ? ` ${interim}` : "")}
          onChange={(e) => setTranscript(e.target.value)}
          readOnly={listening || finishing}
          placeholder="What you say appears here…"
        />
      )}

      {error && (
        <p className="notice" style={{ marginTop: 10 }}>
          <strong>{error}</strong>
        </p>
      )}

      {transcript && !listening && !finishing && (
        <div className="actions">
          <button type="button" onClick={() => void read()} disabled={busy}>
            {busy ? "Reading it…" : "Turn this into a recipe"}
          </button>
        </div>
      )}
    </div>
  );
}
