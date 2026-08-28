"use client";

/**
 * Getting a photo or a PDF off a phone and into the reader.
 *
 * Three things go wrong between a receipt in your hand and a request the API
 * will accept, and all three are silent unless something handles them:
 *
 *   **iPhone photos aren't JPEGs.** Pictures taken on an iPhone are HEIC, and
 *   picking one from the photo library hands the page a HEIC file. The API
 *   accepts JPEG, PNG, WebP and GIF, so it would be rejected — for a reason
 *   nobody could act on, since the photo looks perfectly normal in the roll.
 *
 *   **Modern phone photos are too big.** A 48-megapixel picture is well over
 *   the size cap, and uploading twelve megabytes of receipt over country
 *   internet to read forty words off it is a poor trade besides.
 *
 *   **A photographed page is mostly resolution nobody needs.** Text stays
 *   legible far below the sensor's full size, and shrinking it is what makes
 *   the upload quick enough to do standing in the car park.
 *
 * So every image is drawn onto a canvas, scaled down if it's large, and
 * re-encoded as JPEG. The browser decodes HEIC natively — it has to, to show
 * you the picture — so the canvas step converts the format as a side effect of
 * resizing, without shipping a decoder.
 *
 * PDFs pass through untouched: a supplier's emailed invoice is already small,
 * already text, and re-encoding it would destroy the thing that makes it easy
 * to read.
 */

/** Long edge, in pixels. Small print on a docket is still sharp at this. */
const MAX_EDGE = 2200;

/** JPEG quality. Below about 0.8 the thin strokes on a receipt start to mush. */
const QUALITY = 0.85;

/** What the reader API accepts without conversion. */
const PASS_THROUGH = new Set(["application/pdf"]);

export interface PreparedUpload {
  mediaType: string;
  /** Base64, no data-URL prefix. */
  data: string;
  /** True when the image was shrunk or converted, for an honest status line. */
  converted: boolean;
}

export class UploadTooLargeError extends Error {}

/** Bytes a base64 string decodes to. */
function decodedBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode a file to something canvas can draw.
 *
 * `createImageBitmap` is the fast path and handles HEIC on Safari. Falling
 * back to an <img> matters because some browsers refuse HEIC bitmaps but will
 * still render the element.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("decode failed"));
        img.src = url;
      });
    } finally {
      // Revoking immediately is safe: decoding has finished or thrown by here,
      // and leaving it would hold the whole photo in memory for the session.
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Turn a chosen file into something the reader API will accept.
 *
 * Throws `UploadTooLargeError` only when a PDF is genuinely too big — images
 * are shrunk rather than refused, because "take it again smaller" is not
 * advice anybody can follow on a phone.
 */
export async function prepareUpload(
  file: File,
  maxBytes: number,
): Promise<PreparedUpload> {
  if (PASS_THROUGH.has(file.type)) {
    const data = await toBase64(file);
    if (decodedBytes(data) > maxBytes) {
      throw new UploadTooLargeError(
        "That PDF is too big to read. Send just the pages with the prices on them.",
      );
    }
    return { mediaType: file.type, data, converted: false };
  }

  try {
    const source = await decode(file);
    const width = source.width;
    const height = source.height;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    if ("close" in source) source.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) throw new Error("encode failed");

    return {
      mediaType: "image/jpeg",
      data: await toBase64(blob),
      converted: scale < 1 || file.type !== "image/jpeg",
    };
  } catch {
    // Canvas can fail — an enormous image on a phone low on memory, a format
    // the browser won't decode. Send the original rather than refusing: the
    // API may well accept it, and its error message names the real problem.
    const data = await toBase64(file);
    return { mediaType: file.type, data, converted: false };
  }
}
