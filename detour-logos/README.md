# Detour logos

Recoloured versions of **The Gulgong Detour** and **The Country Detour Co**, so their
drawn elements carry colour the way **The Mudgee Detour** does — plus three new badges
built to match: **The Hill End Detour**, **The Rylstone Detour** and
**The Kandos Detour**.

For the recoloured pair, the original artwork is untouched underneath: every line, stroke
and letterform is the same drawing, and only the ink colour and its strength have changed.

## Palette

| Ink | Hex | Used for |
| --- | --- | --- |
| Terracotta | `#96481A` | Opera House, windmill, blossoms (option 1), map pin |
| Deep rust | `#77320E` | "The Country" serif |
| Goldfields ochre | `#A67426` | Blossoms (option 2) |
| Grape plum | `#6E2D4A` | Blossoms (Gulgong option 3) |
| Leaf sage | `#545A34` | Gum leaves, eucalyptus foliage |
| Khaki olive | `#6A633C` | Streetscape, dirt road, vineyard-style background line work |
| Icon olive | `#424226` | Kangaroo, 4WD, dashed track |
| Deep olive | `#2A2D17` | "Detour" script, tagline |
| Engraving sepia | `#604228` | Henry Lawson portrait |
| Paper cream | `#F9F1EC` | Background |

## The Gulgong Detour

Three options, differing only in the gum-blossom colour:

- `gulgong-detour-1-terracotta.png` — blossoms in the house terracotta
- `gulgong-detour-2-goldfields.png` — blossoms in goldfields ochre
- `gulgong-detour-3-plum.png` — blossoms in the Mudgee grape plum

In all three: the Prince of Wales Opera House takes the terracotta the Mudgee clock
tower has, the verandah streetscape sits back in khaki olive the way the Mudgee hills
and vineyard rows do, the Henry Lawson portrait is warm engraving sepia, and the gum
leaves are grape-leaf sage. Lettering, arcs, 4WD, pin and dashed track are unchanged.

## The Country Detour Co

- `country-detour-1-terracotta.png` — blossoms in terracotta
- `country-detour-2-goldfields.png` — blossoms in goldfields ochre
- `country-detour-3-bold.png` — the strongest version: darkest lettering, richest
  foliage, heaviest line work

All three darken the lettering ("The Country" into deep rust, "Detour" and the tagline
into deep olive) and strengthen the drawn line work. The eucalyptus foliage is sage, the
dirt road khaki olive, the windmill terracotta and the kangaroo icon olive.

## The town badges — Hill End, Rylstone, Kandos

`hill-end-detour.png`, `rylstone-detour.png`, `kandos-detour.png` — new badges, not
recolours, built to sit in the same family.

The shared furniture is lifted straight from the Gulgong badge: the circle arcs, the
`DETOUR` wordmark, the rule and dot, `EXPLORE. DISCOVER. INDULGE.`, and the 4WD, dashed
track and map pin. That is the same artwork, not a copy of it, so the lockup matches
exactly. Each town then gets its own illustration and wordmark, the latter set in
**Great Vibes**, a close match for the script on the other three.

**Hill End** — the Royal Hotel in clock-tower terracotta, Holtermann's nugget in
goldfields ochre in a vignette where Gulgong has the Henry Lawson portrait, the poplars
in leaf sage with the same soft fill as the eucalyptus, and the ridge in khaki olive.

**Rylstone** — a two-storey sandstone inn with its iron-lace verandah in terracotta, a
weathered Ganguddy pagoda in the vignette, and an olive branch down the right where
Gulgong has its gum sprig, the olives in grape plum.

**Kandos** — the cement works in terracotta: the chimney, the sawtooth sheds and the
silos. Works gearing in goldfields ochre in the vignette, and the escarpment with its
gums behind, in khaki olive and sage.

Each illustration is vector — `towns/<slug>/illustration.svg` opens in any vector editor
if you want to redraw a part of it. They are drawn line art rather than the etched,
hatched style of the first three, since those came out of an image generator and these
did not. Swapping in a matching engraving later is a drop-in change: replace the SVG and
rebuild.

Rebuild all three with `python3 build-towns.py`. It reads `gulgong-detour-2-goldfields.png`
for the furniture, writes each `illustration.svg`, and rasterises it with the bundled
Chromium. Fonts are in `towns/fonts/`, both under the SIL Open Font License.

## Leaf fill

The eucalyptus blades and the Gulgong gum leaves are washed with sage inside their
outlines, so they read as filled shapes the way the Mudgee grape leaves do rather than as
bare outlines. The fill is found by filling the bold outline strokes only — the pale
interior veins are ignored, which is what stops it leaking into the background.

## Transparent versions

Every logo also ships as `*-transparent.png`, with the cream paper lifted out into an
alpha channel. These are for **pale** backgrounds — see below for dark ones.

## Reversed, for dark backgrounds

Built from the goldfields colourway of the Gulgong and Country logos, and from each of
the three town badges, for dark website headers, merch and photo overlays:

| File | What it is |
| --- | --- |
| `*-reversed.png` | light ink on a deep olive-black ground, hues kept |
| `*-reversed-mono.png` | the same in a single warm off-white |
| `*-reversed-transparent.png` | the light ink alone, for placing over a photo |

The hues are opened up rather than simply inverted, and the olives are desaturated hard
on the way — lightened at full saturation they turn acid green.

Rebuild with `python3 reversed.py`. Add a logo to its `PAIRS` list to reverse another
colourway.

## Social covers

`social/<logo>/` holds cover sizes for each logo — `country`, `gulgong`, `hillend`,
`rylstone` and `kandos`:

| File | Size | For |
| --- | --- | --- |
| `facebook-cover-1640x924.png` | 1640 × 924 | Facebook page cover |
| `x-header-1500x500.png` | 1500 × 500 | X / Twitter header |
| `linkedin-cover-1128x376.png` | 1128 × 376 | LinkedIn company page cover |
| `share-card-1200x630.png` | 1200 × 630 | link previews (Open Graph) |

The logo is kept inside each platform's safe area, so nothing important is lost to
mobile cropping or to the profile picture that sits over the bottom-left corner on X and
LinkedIn.

The Country covers also come in `-sprig` versions of the two banner formats, carrying a
faded, mirrored copy of the blossom cluster off the right edge — the wide formats leave a
lot of empty cream around a centred logo. The round badges are close to square, so they
are simply scaled up to fill those formats instead.

Rebuild with `python3 social.py`. Its `LOGOS` and `BOX` tables hold the source file, the
crop and the per-format sizing for each logo.

## Regenerating

```
python3 final.py          # needs pillow, numpy, scipy
```

`recolour.py` holds the palette and the compositing helpers; `final.py` holds the region
map for each logo (which part of the artwork takes which ink, and how strongly). Adjust
a colour constant in `recolour.py` to reshade every option at once.

Source artwork is kept in `source/`.
