"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

/**
 * True while the browser is preparing a print copy.
 *
 * Folding is a screen affordance. The printed sheet is the one that goes to
 * the kitchen, and a section left shut on paper is an ingredient that doesn't
 * get ordered — so every section opens for the print and closes again after.
 *
 * This is done in the DOM rather than in CSS on purpose. Browsers hide closed
 * `<details>` content with `content-visibility`, which a `display: block`
 * print rule does not reliably override, and the failure would be silent and
 * invisible until someone printed a sheet with the countdown missing.
 *
 * `flushSync` is load-bearing: React batches state updates, and a re-render
 * that lands after the browser has taken its snapshot is no use at all.
 */
function usePrintOpen(): boolean {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const open = () => flushSync(() => setPrinting(true));
    const close = () => flushSync(() => setPrinting(false));

    window.addEventListener("beforeprint", open);
    window.addEventListener("afterprint", close);

    // Safari historically fired no beforeprint; it changes this media query
    // instead. Listening to both is harmless — they set the same flag.
    const query = window.matchMedia("print");
    const onChange = (event: MediaQueryListEvent) =>
      flushSync(() => setPrinting(event.matches));
    query.addEventListener("change", onChange);

    return () => {
      window.removeEventListener("beforeprint", open);
      window.removeEventListener("afterprint", close);
      query.removeEventListener("change", onChange);
    };
  }, []);

  return printing;
}

/**
 * One foldable section of a result page.
 *
 * A finished job produces a lot: the order split by category, the packaging,
 * the countdown, the risks, the costing. Printed as one column it's a page and
 * a half of scrolling to reach the countdown, which is the part you actually
 * need on the Thursday.
 *
 * So each part folds. Two rules make folding safe rather than just tidier:
 *
 *   1. The heading carries a count. A folded section still tells you how much
 *      is inside, so nothing disappears just because it's shut.
 *   2. `open` is the caller's decision, not a default. The order sheet opens
 *      because that's what the page is for; the rest starts shut.
 */
export default function Section({
  title,
  count,
  open = false,
  tone,
  variant = "card",
  children,
}: {
  title: string;
  /** What's inside, in the caller's own words: "14 lines", "6 steps". */
  count?: string;
  open?: boolean;
  /** "warn" marks a section that needs looking at before ordering. */
  tone?: "warn";
  /**
   * "plain" is the nested one — a supplier group inside the order sheet.
   * Same folding, same print behaviour, but a rule and a smaller heading
   * instead of its own card, because a card inside a card reads as clutter.
   */
  variant?: "card" | "plain";
  children: React.ReactNode;
}) {
  const printing = usePrintOpen();

  if (variant === "plain") {
    return (
      <details className="subsection" open={open || printing}>
        <summary>
          <span className="subsection-title">{title}</span>
          {count && <span className="basis">{count}</span>}
        </summary>
        <div className="subsection-body">{children}</div>
      </details>
    );
  }

  return (
    <details
      className={tone === "warn" ? "section warn" : "section"}
      open={open || printing}
    >
      <summary>
        <span className="section-title">{title}</span>
        {count && <span className="basis">{count}</span>}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}
