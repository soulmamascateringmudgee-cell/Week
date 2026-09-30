/**
 * What sits in the top-left corner.
 *
 * The app's own name for everyone, and the operator's wordmark for an
 * operator running their own colours.
 *
 * Drawn as SVG text rather than hung off an image file, for three reasons
 * that matter more than they sound:
 *
 *  - it is sharp at any size, on a phone at 3x and on a printed sheet,
 *    where a small PNG of a wordmark goes to mush;
 *  - it takes its colour from the palette, so the same mark works on
 *    charcoal and on cream without two files to keep in step;
 *  - there is no asset to host, no hotlink to someone else's CDN, and
 *    nothing to break the day a file is moved.
 *
 * The faces are the brand sheet's own — Playfair Display for the wordmark,
 * Montserrat for the rule of services under it — loaded once in the layout
 * and referenced here by their CSS variables.
 */

interface Mark {
  /** The words, big. */
  name: string;
  /** The line underneath, spaced out. Omitted when there isn't one. */
  tagline?: string;
}

const MARKS: Record<string, Mark> = {
  "soul-mamas": {
    name: "SOUL MAMAS",
    tagline: "CATERING · EVENTS · FOOD VAN",
  },
  "soul-mamas-light": {
    name: "SOUL MAMAS",
    tagline: "CATERING · EVENTS · FOOD VAN",
  },
};

export default function BrandMark({ brand }: { brand: string | null }) {
  const mark = brand ? MARKS[brand] : undefined;

  // No wordmark for this operator: the product's own name, as before.
  if (!mark) return <>Prep&nbsp;&amp;&nbsp;Ordering</>;

  return (
    <svg
      className="wordmark"
      viewBox="0 0 560 128"
      role="img"
      aria-label={mark.tagline ? `${mark.name} — ${mark.tagline}` : mark.name}
    >
      <text
        x="0"
        y="66"
        fill="var(--ink)"
        fontFamily="var(--font-display-stack)"
        fontSize="58"
        fontWeight="800"
        letterSpacing="-1"
      >
        {mark.name}
      </text>
      {mark.tagline && (
        <text
          x="2"
          y="102"
          fill="var(--accent)"
          fontFamily="var(--font-text-stack)"
          fontSize="15.5"
          fontWeight="700"
          letterSpacing="3.4"
        >
          {mark.tagline}
        </text>
      )}
    </svg>
  );
}
