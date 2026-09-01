/**
 * Several photos of one thing.
 *
 * A Woolworths receipt for a job is a metre of paper. A recipe torn out of a
 * folder runs over the page. Neither fits in one photograph at a resolution
 * where the numbers are still readable, so both readers take a set of photos
 * and treat them as one document.
 *
 * They go to the model together, in one request, rather than one at a time
 * with the answers stitched afterwards. That matters for a reason worth
 * stating: a line split across a photo boundary — the item name at the bottom
 * of one shot, its price at the top of the next — can only be put back
 * together by something that can see both. Reading each photo alone would
 * produce two half-lines and no way to tell they were one.
 *
 * The cost of that choice is double-counting, since photos of a long receipt
 * overlap. That's handled in the prompts, which say plainly that the pages are
 * one document and may repeat.
 */

export interface UploadedPage {
  mediaType: string;
  /** Base64, no data-URL prefix. */
  data: string;
}

/**
 * How many photos one document may be.
 *
 * Well under what the API accepts. This is a limit on patience and on what a
 * sensible request looks like: eight photographs is a very long receipt, and a
 * cook who needs more than that is better off sending the supplier's PDF.
 */
export const MAX_PAGES = 8;

/** Bytes a base64 string decodes to. Base64 runs 4 characters per 3 bytes. */
export function decodedBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

/** Why a set of pages can't be read, in a form the route can turn into words. */
export type PageFault =
  | { kind: "empty" }
  | { kind: "too-many"; count: number }
  | { kind: "type"; mediaType: string }
  | { kind: "too-big"; bytes: number };

/**
 * Pull the pages out of a request body.
 *
 * Accepts either shape: `{ pages: [...] }` from anything current, or a bare
 * `{ mediaType, data }` — which is what every caller sent before this existed,
 * and what a saved page still running the old script would send after a
 * deploy. One photo is just a document of one page.
 */
export function collectPages(body: unknown): UploadedPage[] {
  if (typeof body !== "object" || body === null) return [];
  const record = body as Record<string, unknown>;

  const listed = Array.isArray(record.pages) ? record.pages : null;
  const raw = listed ?? [record];

  const pages: UploadedPage[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const page = entry as Record<string, unknown>;
    const mediaType = typeof page.mediaType === "string" ? page.mediaType : "";
    const data = typeof page.data === "string" ? page.data : "";
    // A page with no bytes is nothing, not an error to report back — it would
    // only ever come from a caller bug, and dropping it keeps the real pages
    // readable. An entirely empty set is caught by the check below.
    if (mediaType === "" || data === "") continue;
    pages.push({ mediaType, data });
  }
  return pages;
}

/**
 * Check a set of pages against what the reader will accept.
 *
 * The size cap is on the total rather than each page: ten small photos cost
 * the same to send as one big one, and it's the request that has a ceiling.
 */
export function faultInPages(
  pages: UploadedPage[],
  options: { isAllowedType: (mediaType: string) => boolean; maxBytes: number },
): PageFault | null {
  if (pages.length === 0) return { kind: "empty" };
  if (pages.length > MAX_PAGES) return { kind: "too-many", count: pages.length };

  for (const page of pages) {
    if (!options.isAllowedType(page.mediaType)) {
      return { kind: "type", mediaType: page.mediaType };
    }
  }

  const bytes = pages.reduce((sum, page) => sum + decodedBytes(page.data), 0);
  if (bytes > options.maxBytes) return { kind: "too-big", bytes };

  return null;
}

/**
 * How the pages are introduced to the reader.
 *
 * Numbering them is not decoration. It tells the model the order it's holding
 * them in, which is what lets it follow a list that continues over a break and
 * recognise the same lines showing up twice where two photos overlap.
 */
export function pageLabel(index: number, total: number): string {
  return total === 1 ? "" : `Photo ${index + 1} of ${total}:`;
}
