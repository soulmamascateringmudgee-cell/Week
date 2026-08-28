"use client";

/**
 * Print the whole job, with every section open.
 *
 * The sections also open themselves on the browser's `beforeprint` event, but
 * that event is not dependable — iOS Safari has never fired it, and Share →
 * Print on a phone is how a cook actually gets this onto paper. Relying on it
 * means the countdown and the recipe sheets silently don't print, which is
 * exactly what happened.
 *
 * So this doesn't rely on any event. It opens every folded section itself,
 * then prints. No listener to miss, nothing to fire late.
 *
 * They're deliberately left open afterwards. Restoring them means racing the
 * browser's print snapshot — and on iOS the preview is still being built when
 * `print()` returns, so closing them again can empty the page mid-capture. An
 * expanded page after printing is a small oddity; a printed order sheet with
 * the prep list missing is a job that goes wrong.
 */
export default function PrintButton() {
  function print() {
    for (const section of document.querySelectorAll("details")) {
      section.open = true;
    }
    window.print();
  }

  return (
    <button type="button" className="secondary" onClick={print}>
      Print this job
    </button>
  );
}
