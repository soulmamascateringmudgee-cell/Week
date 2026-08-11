# Detour logos — colour work

Recoloured versions of **The Gulgong Detour** and **The Country Detour Co**, so their
drawn elements carry colour the way **The Mudgee Detour** does.

The original artwork is untouched underneath — every line, stroke and letterform is the
same drawing. Only the ink colour and its strength have changed.

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

## Transparent versions

Every logo also ships as `*-transparent.png`, with the cream paper lifted out into an
alpha channel. These are for **pale** backgrounds — the artwork is dark ink, so it will
disappear on a dark ground. A reversed light-on-dark version would need to be made
separately.

## Regenerating

```
python3 final.py          # needs pillow, numpy, scipy
```

`recolour.py` holds the palette and the compositing helpers; `final.py` holds the region
map for each logo (which part of the artwork takes which ink, and how strongly). Adjust
a colour constant in `recolour.py` to reshade every option at once.

Source artwork is kept in `source/`.
