"""Build the town badges: Hill End, Rylstone and Kandos.

The shared furniture — circle arcs, DETOUR, tagline and the 4WD/track/pin row — is lifted
straight from the Gulgong badge, so the lockup matches the rest of the family exactly.
Onto that go a per-town illustration, drawn as vectors and kept in towns/<slug>/, and the
town's wordmark set in Great Vibes.

Needs pillow, numpy, scipy and the bundled Chromium to rasterise the SVG.
"""
import base64, math, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import binary_dilation

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'towns')
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'


def badge_furniture():
    """The Gulgong badge with its town-specific artwork and wordmark taken out."""
    import numpy as np
    from PIL import Image
    from scipy.ndimage import binary_dilation

    SRC = 'gulgong-detour-2-goldfields.png'
    BG = np.array([249., 241., 236.])
    src = np.array(Image.open(SRC).convert('RGB')).astype(float)
    out = src.copy()

    for y0, y1, x0, x1 in [(100, 200, 900, 1210),      # stray blossom above the arc
                           (195, 250, 330, 1210),      # under the top arc
                           (250, 320, 275, 1210),
                           (320, 648, 248, 1210),      # illustration block
                           (420, 772, 250, 1010),      # script wordmark
                           (640, 800, 1000, 1130)]:    # botanical stem below the sprig
        out[y0:y1, x0:x1] = BG

    # where the script runs into the wordmark line or across the arc, take olive ink only
    mx, mn = src.max(2), src.min(2)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    h = np.zeros_like(mx)
    m = mx == r; h[m] = ((g - b)[m] / d[m]) % 6
    m = mx == g; h[m] = ((b - r)[m] / d[m]) + 2
    m = mx == b; h[m] = ((r - g)[m] / d[m]) + 4
    h *= 60
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lum = src @ [0.299, 0.587, 0.114]
    script = binary_dilation((lum < 232) & (h >= 38) & (h <= 82) & (s >= 0.24), iterations=3)
    box = np.zeros(script.shape, bool)
    box[772:895, 250:1010] = True
    box[420:895, 100:250] = True     # flourish reaching past the arc
    out[script & box] = BG

    return Image.fromarray(out.astype(np.uint8))


def illustration_hill_end():
    import base64, math, subprocess, os

    TERRA, OCHRE, SAGE, KHAKI = '#96481A', '#A67426', '#545A34', '#6A633C'
    NUGGET = '#DCBC77'
    GAR = base64.b64encode(open(f'{HERE}/fonts/EBGaramond.ttf', 'rb').read()).decode()


    def poplar(x, base, h, w, seed):
        """Lombardy poplar: a tall column with a scalloped, foliage-like edge."""
        n = 13
        pts = []
        for i in range(n + 1):
            t = i / n
            half = w * (math.sin(math.pi * min(t * 0.92 + 0.06, 1)) ** 0.62) * (1 - 0.35 * t)
            pts.append((base - h * t, half))
        d = [f'M{x:.1f} {base:.1f}']
        for i in range(1, n + 1):                       # up the left side
            y0, h0 = pts[i - 1]; y1, h1 = pts[i]
            bulge = 1.0 + (0.16 if (i + seed) % 2 else 0.26)
            d.append(f'Q{x - max(h0, h1) * bulge:.1f} {(y0 + y1) / 2:.1f} {x - h1:.1f} {y1:.1f}')
        for i in range(n, 0, -1):                       # and back down the right
            y0, h0 = pts[i]; y1, h1 = pts[i - 1]
            bulge = 1.0 + (0.26 if (i + seed) % 2 else 0.16)
            d.append(f'Q{x + max(h0, h1) * bulge:.1f} {(y0 + y1) / 2:.1f} {x + h1:.1f} {y1:.1f}')
        d.append('Z')
        path = ' '.join(d)
        veins = ''.join(
            f'<path d="M{x:.1f} {base - h * (0.22 + 0.15 * k):.1f} '
            f'q{-w * 0.34:.1f} {8} {-w * 0.44:.1f} {20}" opacity="0.5"/>'
            f'<path d="M{x:.1f} {base - h * (0.28 + 0.15 * k):.1f} '
            f'q{w * 0.34:.1f} {8} {w * 0.44:.1f} {20}" opacity="0.5"/>' for k in range(5))
        return (f'<path d="{path}" fill="#B9C09A" fill-opacity="0.40" stroke-width="2.2"/>'
                f'<line x1="{x}" y1="{base - h * 0.10:.1f}" x2="{x}" y2="{base + 2}" stroke-width="3"/>'
                f'<g stroke-width="1.3">{veins}</g>')


    poplars = ''.join(poplar(*p) for p in [(952, 602, 214, 30, 0), (996, 603, 318, 38, 1),
                                           (1042, 604, 268, 33, 0), (1088, 605, 356, 41, 1),
                                           (1132, 601, 232, 29, 0)])

    # roof sheeting
    def corr(x0, y0, x1, y1, x2, y2, x3, y3, n, op):
        out = []
        for i in range(1, n):
            t = i / n
            out.append(f'<line x1="{x0+(x1-x0)*t:.1f}" y1="{y0+(y1-y0)*t:.1f}" '
                       f'x2="{x2+(x3-x2)*t:.1f}" y2="{y2+(y3-y2)*t:.1f}"/>')
        return f'<g stroke-width="1.3" opacity="{op}">' + ''.join(out) + '</g>'


    POSTS = (312, 386, 460, 534, 608, 656)
    posts = ''.join(f'<path d="M{x-4} 460 v138 M{x+4} 460 v138"/>' for x in POSTS)
    valance = ''.join(f'<path d="M{x+4} 460 q{(POSTS[i+1]-x-8)/2:.1f} 26 {POSTS[i+1]-x-8:.1f} 0"/>'
                      for i, x in enumerate(POSTS[:-1]))
    brackets = ''.join(f'<path d="M{x-4} 476 q-13 2 -16 16 M{x+4} 476 q13 2 16 16"/>' for x in POSTS)

    SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
    <defs><style>
    @font-face {{ font-family:"Gar"; src:url(data:font/ttf;base64,{GAR}) format("truetype"); }}
    .ink {{ fill:none; stroke-linecap:round; stroke-linejoin:round; }}
    </style></defs>

    <!-- the ridge the town sits on, kept clear of the buildings -->
    <g class="ink" stroke="{KHAKI}" stroke-width="2.2" opacity="0.5">
      <path d="M726 492 C776 476 820 484 866 468 C896 458 916 462 934 456"/>
      <path d="M736 514 C790 504 838 508 886 498" opacity="0.6"/>
    </g>

    <g class="ink" stroke="{SAGE}">{poplars}</g>

    <!-- the Royal Hotel -->
    <g transform="translate(42,25) scale(0.955)">
    <g class="ink" stroke="{TERRA}" stroke-width="3">
      <path d="M292 372 L390 300 L570 300 L668 372 Z"/>
      {corr(292,372,390,300,668,372,570,300,20,0.5)}
      <path d="M390 300 L570 300" stroke-width="3.4"/>
      <path d="M292 372 L668 372" stroke-width="2.6"/>
      <rect x="408" y="244" width="36" height="56"/><path d="M401 244 h50 M401 258 h50"/>
      <rect x="522" y="256" width="32" height="44"/><path d="M516 256 h44 M516 268 h44"/>
      <path d="M330 372 v64 M630 372 v64"/>
      <path d="M286 436 L674 436 L680 460 L280 460 Z"/>
      {corr(286,436,680,460,286,436,680,460,1,0)}
      <g stroke-width="1.3" opacity="0.45">
        <path d="M300 460 L303 436 M340 460 L342 436 M380 460 L381 436 M420 460 L420 436
                 M460 460 L459 436 M500 460 L498 436 M540 460 L537 436 M580 460 L576 436
                 M620 460 L615 436 M660 460 L654 436"/>
      </g>
      <g stroke-width="2.4">{posts}</g>
      <g stroke-width="1.7" opacity="0.75">{valance}</g>
      <g stroke-width="1.5" opacity="0.7">{brackets}</g>
      <path d="M336 460 v138 M626 460 v138 M336 598 h290"/>
      <path d="M280 598 L680 598" stroke-width="2.6"/>
      <path d="M462 512 h40 v86 h-40 Z"/>
      <path d="M462 512 q20 -16 40 0" />
      <path d="M482 526 v72"/>
      <path d="M366 518 h60 v62 h-60 Z M396 518 v62 M366 549 h60"/>
      <path d="M542 518 h60 v62 h-60 Z M572 518 v62 M542 549 h60"/>
      <path d="M452 598 l-12 12 h84 l-12 -12"/>
      <g stroke-width="1.4" opacity="0.45"><path d="M300 560 h30 M632 560 h34"/></g>
    </g>
    <text x="480" y="412" font-family="Gar" font-size="31" letter-spacing="6"
          text-anchor="middle" fill="{TERRA}">ROYAL HOTEL</text>
    </g>

    <!-- Holtermann's nugget, in a vignette -->
    <g class="ink" stroke="{TERRA}">
      <path d="M714 250 q0 -22 22 -26 q14 -3 22 -10 h124 q8 7 22 10 q22 4 22 26 v150
               q0 22 -22 26 q-14 3 -22 10 h-124 q-8 -7 -22 -10 q-22 -4 -22 -26 Z" stroke-width="2.6"/>
      <path d="M728 258 q0 -14 16 -18 h152 q16 4 16 18 v134 q0 14 -16 18 h-152 q-16 -4 -16 -18 Z"
            stroke-width="1.4" opacity="0.65"/>
    </g>
    <ellipse cx="820" cy="325" rx="72" ry="82" fill="none" stroke="{TERRA}" stroke-width="1.8"
             opacity="0.8"/>
    <g class="ink" stroke="{OCHRE}" stroke-width="2.6">
      <path d="M786 379 L757 356 L765 322 L752 300 L779 279 L812 285 L833 268 L858 283
               L873 311 L866 340 L878 358 L850 376 L818 370 Z"
            fill="{NUGGET}" fill-opacity="0.5"/>
      <g stroke-width="1.5" opacity="0.85">
        <path d="M779 279 C796 292 802 306 822 310 C844 314 858 300 873 311"/>
        <path d="M822 310 C816 330 806 342 800 362 C797 371 800 376 786 379"/>
        <path d="M800 362 C818 366 838 362 852 374"/>
        <path d="M765 322 C778 330 790 328 800 336" opacity="0.75"/>
      </g>
      <g stroke-width="1.1" opacity="0.5">
        <path d="M830 322 l32 10 M826 334 l36 11 M824 346 l32 11 M828 358 l22 8
                 M786 292 l14 6 M782 302 l16 7"/>
      </g>
      <g stroke-width="1.7" opacity="0.85">
        <path d="M902 268 v16 M894 276 h16 M742 388 v13 M735.5 394.5 h13 M884 384 v11 M878.5 389.5 h11"/>
      </g>
    </g>

    <g class="ink" stroke="{KHAKI}" stroke-width="1.9" opacity="0.6">
      <path d="M676 604 C800 598 960 610 1150 600"/>
      <g stroke-width="1.3" opacity="0.7">
        <path d="M700 604 l-6 -13 M714 605 l4 -13 M770 606 l-5 -12 M820 605 l5 -12
                 M900 606 l-6 -12 M1010 606 l4 -12 M1105 603 l-5 -12"/>
      </g>
    </g>
    </svg>'''
    return SVG



SCRIPT_INK = (42, 45, 23)
FONT = f'{HERE}/fonts/GreatVibes.ttf'


def ink_bbox(img):
    a = np.array(img)[..., 3]
    ys, xs = np.where(a > 8)
    return xs.min(), ys.min(), xs.max(), ys.max()


def draw_word(text, target_w, left, bottom, canvas):
    """Set the word so its ink lands exactly where the lockup wants it."""
    lo, hi = 20, 600
    for _ in range(24):
        mid = (lo + hi) / 2
        layer = Image.new('RGBA', (2600, 900), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((60, 120), text, font=ImageFont.truetype(FONT, int(mid)),
                                   fill=SCRIPT_INK + (255,))
        x0, y0, x1, y1 = ink_bbox(layer)
        if x1 - x0 < target_w:
            lo = mid
        else:
            hi = mid
    layer = Image.new('RGBA', (2600, 900), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((60, 120), text, font=ImageFont.truetype(FONT, int(lo)),
                               fill=SCRIPT_INK + (255,))
    x0, y0, x1, y1 = ink_bbox(layer)
    canvas.alpha_composite(layer.crop((x0, y0, x1 + 1, y1 + 1)),
                           (int(left), int(bottom - (y1 - y0))))


def illustration_rylstone():
    TERRA, OCHRE, SAGE, KHAKI, SEPIA = '#96481A', '#A67426', '#545A34', '#6A633C', '#604228'
    GAR = base64.b64encode(open(f'{HERE}/fonts/EBGaramond.ttf', 'rb').read()).decode()


    def corr(x0, y0, x1, y1, x2, y2, x3, y3, n, op):
        out = []
        for i in range(1, n):
            t = i / n
            out.append(f'<line x1="{x0+(x1-x0)*t:.1f}" y1="{y0+(y1-y0)*t:.1f}" '
                       f'x2="{x2+(x3-x2)*t:.1f}" y2="{y2+(y3-y2)*t:.1f}"/>')
        return f'<g stroke-width="1.3" opacity="{op}">' + ''.join(out) + '</g>'


    def pagoda(cx, base, h, w, layers, seed):
        """A weathered sandstone pagoda: stacked beds of rock, each ledge overhanging the last."""
        ys = [base - h * (i / layers) ** 0.92 for i in range(layers + 1)]
        hws = [w * (1 - 0.52 * (i / layers) ** 1.25) * (1 + (0.05 if (i + seed) % 2 else -0.03))
               for i in range(layers + 1)]
        left, right, ledges = [f'M{cx - hws[0]:.1f} {base:.1f}'], [], []
        for i in range(layers):
            y0, y1 = ys[i], ys[i + 1]
            a, b = hws[i], hws[i + 1]
            over = 8 if (i + seed) % 2 else 5
            left.append(f'L{cx - a:.1f} {y1 + 7:.1f} L{cx - a - over:.1f} {y1 + 3:.1f} '
                        f'L{cx - b:.1f} {y1:.1f}')
            right.insert(0, f'L{cx + b:.1f} {y1:.1f} L{cx + a + over:.1f} {y1 + 3:.1f} '
                            f'L{cx + a:.1f} {y1 + 7:.1f}')
            if i < layers - 1:
                ledges.append(f'<path d="M{cx - a - over:.1f} {y1 + 3:.1f} Q{cx:.1f} {y1 - 3:.1f} '
                              f'{cx + a + over:.1f} {y1 + 3:.1f}" stroke-width="2"/>')
                ledges.append(f'<path d="M{cx - a * 0.62:.1f} {y1 + 15:.1f} h{a * 1.24:.1f}" '
                              f'stroke-width="1.1" opacity="0.4"/>')
        cap = (f'Q{cx - hws[-1] * 0.5:.1f} {ys[-1] - 16:.1f} {cx:.1f} {ys[-1] - 18:.1f} '
               f'Q{cx + hws[-1] * 0.5:.1f} {ys[-1] - 16:.1f} {cx + hws[-1]:.1f} {ys[-1]:.1f}')
        body = (f'<path d="{" ".join(left)} {cap} {" ".join(right)} L{cx + hws[0]:.1f} {base:.1f} Z" '
                f'fill="#CFC6A8" fill-opacity="0.30" stroke-width="2.4"/>')
        return body + ''.join(ledges)


    POSTS_U = (300, 378, 456, 534, 612, 668)
    POSTS_L = (300, 378, 456, 534, 612, 668)
    upost = ''.join(f'<path d="M{x-4} 372 v92 M{x+4} 372 v92"/>' for x in POSTS_U)
    lpost = ''.join(f'<path d="M{x-4} 476 v122 M{x+4} 476 v122"/>' for x in POSTS_L)
    lace_u = ''.join(f'<path d="M{x+4} 372 q{(POSTS_U[i+1]-x-8)/2:.1f} 24 {POSTS_U[i+1]-x-8:.1f} 0"/>'
                     for i, x in enumerate(POSTS_U[:-1]))
    lace_l = ''.join(f'<path d="M{x+4} 476 q{(POSTS_L[i+1]-x-8)/2:.1f} 24 {POSTS_L[i+1]-x-8:.1f} 0"/>'
                     for i, x in enumerate(POSTS_L[:-1]))
    balusters = ''.join(f'<line x1="{x}" y1="430" x2="{x}" y2="462"/>' for x in range(310, 665, 13))
    courses = ''.join(f'<path d="M334 {y} h300" />' for y in range(392, 460, 17)) + \
              ''.join(f'<path d="M334 {y} h300" />' for y in range(506, 592, 17))
    olives = []
    for i, (t, side, sz) in enumerate([(0.12, -1, 19), (0.22, 1, 16), (0.35, -1, 18), (0.48, 1, 19),
                                       (0.60, -1, 17), (0.72, 1, 18), (0.84, -1, 15)]):
        x = 1072 + 54 * math.sin(t * 2.6) - 46 * t
        y = 604 - 396 * t
        lx, ly = x + side * (26 + 10 * t), y - 20
        olives.append(f'<path d="M{x:.1f} {y:.1f} Q{(x+lx)/2+side*6:.1f} {(y+ly)/2:.1f} '
                      f'{lx:.1f} {ly:.1f}" stroke-width="1.8"/>')
        olives.append(f'<ellipse cx="{lx:.1f}" cy="{ly:.1f}" rx="{sz*0.62:.1f}" ry="{sz:.1f}" '
                      f'transform="rotate({side*28} {lx:.1f} {ly:.1f})" fill="#6E2D4A" '
                      f'fill-opacity="0.55" stroke="#6E2D4A" stroke-width="2"/>')
    leaves = []
    for i in range(13):
        t = 0.06 + i * 0.072
        x = 1072 + 54 * math.sin(t * 2.6) - 46 * t
        y = 604 - 396 * t
        side = 1 if i % 2 else -1
        L, W = 62 - 16 * t, 15 - 3 * t
        tipx, tipy = x + side * L * 0.92, y - L * 0.52
        olives.append('')
        leaves.append(f'<path d="M{x:.1f} {y:.1f} Q{x+side*L*0.42:.1f} {y-L*0.62:.1f} {tipx:.1f} {tipy:.1f} '
                      f'Q{x+side*L*0.58:.1f} {y-L*0.14:.1f} {x:.1f} {y:.1f} Z" '
                      f'fill="#B9C09A" fill-opacity="0.42" stroke-width="2"/>'
                      f'<path d="M{x:.1f} {y:.1f} Q{x+side*L*0.5:.1f} {y-L*0.38:.1f} {tipx:.1f} {tipy:.1f}" '
                      f'stroke-width="1.1" opacity="0.55"/>')
    stem = ('<path d="M1074 614 C1044 528 1086 448 1056 356 C1036 292 1030 244 1022 206" '
            'stroke-width="3"/>')
    branch = stem + ''.join(leaves) + ''.join(olives)
    pagodas = ''

    vig_pagoda = pagoda(820, 386, 116, 52, 5, 0)

    SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
    <defs><style>
    @font-face {{ font-family:"Gar"; src:url(data:font/ttf;base64,{GAR}) format("truetype"); }}
    .ink {{ fill:none; stroke-linecap:round; stroke-linejoin:round; }}
    </style></defs>

    <g class="ink" stroke="{KHAKI}" stroke-width="2.2" opacity="0.5">
      <path d="M700 500 C760 486 806 492 860 478 C888 470 908 472 926 468"/>
    </g>

    <g class="ink" stroke="{KHAKI}" stroke-width="2.4">{pagodas}</g>
    <g class="ink" stroke="{SAGE}" stroke-width="2.2">{branch}</g>

    <!-- sandstone inn, two-tier verandah -->
    <g class="ink" stroke="{TERRA}" stroke-width="3">
      <path d="M292 320 L392 258 L576 258 L676 320 Z"/>
      {corr(292,320,392,258,676,320,576,258,20,0.5)}
      <path d="M392 258 L576 258" stroke-width="3.4"/>
      <path d="M292 320 L676 320" stroke-width="2.6"/>
      <rect x="404" y="210" width="34" height="48"/><path d="M398 210 h46 M398 222 h46"/>
      <rect x="528" y="220" width="30" height="38"/><path d="M522 220 h42 M522 231 h42"/>
      <path d="M334 320 v32 M634 320 v32"/>
      <path d="M284 348 L684 348 L688 372 L280 372 Z"/>
      <g stroke-width="2.3">{upost}</g>
      <g stroke-width="1.6" opacity="0.75">{lace_u}</g>
      <g stroke-width="1.5" opacity="0.6"><path d="M300 430 h368"/><path d="M300 462 h368"/></g>
      <g stroke-width="1.2" opacity="0.55">{balusters}</g>
      <path d="M284 464 L684 464 L688 476 L280 476 Z"/>
      <g stroke-width="2.3">{lpost}</g>
      <g stroke-width="1.6" opacity="0.75">{lace_l}</g>
      <path d="M334 372 v92 M634 372 v92 M334 476 v122 M634 476 v122"/>
      <path d="M284 598 L684 598" stroke-width="2.6"/>
      <g stroke-width="1.1" opacity="0.35">{courses}</g>
      <path d="M366 382 h50 v54 h-50 Z M391 382 v54 M366 409 h50"/>
      <path d="M460 382 h50 v54 h-50 Z M485 382 v54 M460 409 h50"/>
      <path d="M554 382 h50 v54 h-50 Z M579 382 v54 M554 409 h50"/>
      <path d="M462 508 h44 v90 h-44 Z M462 530 q22 -14 44 0 M484 530 v68"/>
      <path d="M366 514 h56 v58 h-56 Z M394 514 v58 M366 543 h56"/>
      <path d="M548 514 h56 v58 h-56 Z M576 514 v58 M548 543 h56"/>
      <path d="M452 598 l-12 12 h96 l-12 -12"/>
    </g>

    <!-- a platypus, for Dunns Swamp -->
    <g class="ink" stroke="{TERRA}">
      <path d="M714 250 q0 -22 22 -26 q14 -3 22 -10 h124 q8 7 22 10 q22 4 22 26 v150
               q0 22 -22 26 q-14 3 -22 10 h-124 q-8 -7 -22 -10 q-22 -4 -22 -26 Z" stroke-width="2.6"/>
      <path d="M728 258 q0 -14 16 -18 h152 q16 4 16 18 v134 q0 14 -16 18 h-152 q-16 -4 -16 -18 Z"
            stroke-width="1.4" opacity="0.65"/>
    </g>
    <ellipse cx="820" cy="325" rx="72" ry="82" fill="none" stroke="{TERRA}" stroke-width="1.8"
             opacity="0.8"/>
    <g class="ink" stroke="{KHAKI}" stroke-width="2.5">{vig_pagoda}</g>

    <g class="ink" stroke="{SAGE}" stroke-width="2" opacity="0.7">
      <path d="M690 612 C800 606 940 616 1096 606"/>
      <g stroke-width="1.5">
        <path d="M706 612 q-4 -22 -14 -32 M714 612 q2 -24 12 -34 M722 612 q6 -18 16 -24"/>
      </g>
    </g>
    </svg>'''
    return SVG


def illustration_kandos():
    TERRA, OCHRE, SAGE, KHAKI = '#96481A', '#A67426', '#545A34', '#6A633C'
    GAR = base64.b64encode(open(f'{HERE}/fonts/EBGaramond.ttf', 'rb').read()).decode()

    bands = ''.join(f'<path d="M{356 - (18 - 4 * i):.1f} {y:.1f} h{2 * (18 - 4 * i):.1f}" '
                    f'stroke-width="1.3" opacity="0.38"/>' for i, y in enumerate((470, 340)))

    saw = ' '.join(f'V446 L{300 + 64 * (i + 1)} 474' for i in range(4))
    windows = ''.join(f'<rect x="{x}" y="500" width="28" height="32"/>'
                      f'<path d="M{x+14} 500 v32 M{x} 516 h28" stroke-width="1.1" opacity="0.5"/>'
                      for x in (316, 366, 416, 466, 516))

    silos = []
    for x in (578, 620, 662):
        silos.append(f'<path d="M{x} 596 V478 q19 -20 38 0 V596"/>')
        silos.append(f'<path d="M{x} 508 h38 M{x} 556 h38" stroke-width="1.2" opacity="0.42"/>')
    silos = ''.join(silos) + '<path d="M570 472 h140 v-14 h-140 Z"/><path d="M640 458 v-14"/>'

    teeth = []
    for i in range(12):
        a = i * 2 * math.pi / 12
        w0, w1 = 0.072, 0.048
        pts = [(56, a - w0), (72, a - w1), (72, a + w1), (56, a + w0)]
        d = ' '.join(f'{"M" if k == 0 else "L"}{820 + r * math.cos(t):.1f} {325 + r * math.sin(t):.1f}'
                     for k, (r, t) in enumerate(pts))
        teeth.append(f'<path d="{d} Z" fill="#DCBC77" fill-opacity="0.5"/>')
    spokes = ''.join(f'<path d="M{820 + 22 * math.cos(i * math.pi / 3):.1f} '
                     f'{325 + 22 * math.sin(i * math.pi / 3):.1f} '
                     f'L{820 + 52 * math.cos(i * math.pi / 3):.1f} '
                     f'{325 + 52 * math.sin(i * math.pi / 3):.1f}" stroke-width="2.4"/>'
                     for i in range(6))

    cliff_top = 'M928 512 L934 462 L958 452 L986 456 L1014 446 L1046 450 L1078 442 L1112 448 L1140 444 L1152 456 L1156 508'
    joints = ''.join(f'<path d="M{x} {460 + 8 * math.sin(x * 0.07):.1f} v{40 + 10 * math.cos(x * 0.05):.1f}" '
                     f'stroke-width="1.1" opacity="0.3"/>' for x in range(946, 1148, 19))


    def gum(x, base, h, w, seed=0):
        """Trunk with a loose, lumpy canopy rather than a lollipop."""
        cy, n = base - h * 0.86, 11
        pts = []
        for i in range(n):
            a = -math.pi / 2 + i * 2 * math.pi / n
            r = 1 + 0.16 * math.sin(i * 2.7 + seed) + 0.1 * math.cos(i * 1.6 + seed)
            pts.append((x + w * r * math.cos(a), cy + h * 0.24 * r * math.sin(a)))
        d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f}'
        for i in range(1, n + 1):
            x0, y0 = pts[i % n]
            px, py = pts[i - 1]
            mx, my = (px + x0) / 2, (py + y0) / 2
            bl = 1.26 + 0.12 * math.sin(i * 3.1 + seed)
            d += f' Q{x + (mx - x) * bl:.1f} {cy + (my - cy) * bl:.1f} {x0:.1f} {y0:.1f}'
        return (f'<path d="M{x} {base} C{x-5} {base-h*0.4} {x+5} {base-h*0.56} {x} {base-h*0.68}" '
                f'stroke-width="2.8"/>'
                f'<path d="M{x-3} {base-h*0.5} l-15 -14 M{x+3} {base-h*0.58} l16 -14" stroke-width="2"/>'
                f'<path d="{d} Z" fill="#B9C09A" fill-opacity="0.38" stroke-width="2.2"/>')


    SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
    <defs><style>
    @font-face {{ font-family:"Gar"; src:url(data:font/ttf;base64,{GAR}) format("truetype"); }}
    .ink {{ fill:none; stroke-linecap:round; stroke-linejoin:round; }}
    </style></defs>

    <!-- the escarpment behind the town -->
    <g class="ink" stroke="{KHAKI}" stroke-width="2.4">
      <path d="{cliff_top} Q1040 520 928 512 Z" fill="#CFC6A8" fill-opacity="0.26"/>
      {joints}
      <path d="M924 556 Q1000 536 1064 544 Q1120 550 1160 542" stroke-width="1.8" opacity="0.65"/>
      <path d="M932 578 Q1010 566 1080 572 Q1126 576 1158 570" stroke-width="1.5" opacity="0.5"/>
    </g>
    <g class="ink" stroke="{SAGE}">{gum(978, 598, 126, 40, 0)}{gum(1104, 600, 102, 32, 2)}</g>

    <!-- the cement works -->
    <g class="ink" stroke="{TERRA}" stroke-width="3">
      <path d="M336 596 L348 226 L364 226 L376 596"/>
      <path d="M344 226 L342 210 h28 l-2 16" stroke-width="2.6"/>
      <path d="M340 208 h32" stroke-width="2.2"/>
      {bands}
      <path d="M330 566 L336 596 M382 596 L376 566 M330 566 h52" stroke-width="2.2"/>
      <path d="M300 596 V474 {saw} V596 Z"/>
      {windows}
      <path d="M406 548 h42 v48 h-42 Z"/>
      {silos}
      <path d="M282 596 H742" stroke-width="2.6"/>
    </g>

    <!-- gearing, for the works -->
    <g class="ink" stroke="{OCHRE}" stroke-width="2.4">
      {''.join(teeth)}
      <circle cx="820" cy="325" r="56" fill="#DCBC77" fill-opacity="0.35" stroke-width="2.6"/>
      <circle cx="820" cy="325" r="22" stroke-width="2.4"/>
      <circle cx="820" cy="325" r="10" stroke-width="2"/>
      {spokes}
    </g>
    <g class="ink" stroke="{TERRA}">
      <path d="M714 250 q0 -22 22 -26 q14 -3 22 -10 h124 q8 7 22 10 q22 4 22 26 v150
               q0 22 -22 26 q-14 3 -22 10 h-124 q-8 -7 -22 -10 q-22 -4 -22 -26 Z" stroke-width="2.6"/>
      <path d="M728 258 q0 -14 16 -18 h152 q16 4 16 18 v134 q0 14 -16 18 h-152 q-16 -4 -16 -18 Z"
            stroke-width="1.4" opacity="0.65"/>
    </g>

    <g class="ink" stroke="{KHAKI}" stroke-width="2" opacity="0.62">
      <path d="M286 604 C420 598 640 610 1096 602"/>
      <g stroke-width="1.3" opacity="0.7">
        <path d="M762 604 l-6 -13 M776 605 l4 -13 M860 606 l-5 -12 M900 605 l5 -12"/>
      </g>
    </g>
    </svg>'''
    return SVG


TOWNS = {
    'hill-end': (illustration_hill_end, 'hill-end-detour.png',
                 [('The', 150, 186, 520), ('Hill End', 812, 178, 792)]),
    'rylstone': (illustration_rylstone, 'rylstone-detour.png',
                 [('The', 150, 186, 520), ('Rylstone', 806, 178, 800)]),
    'kandos': (illustration_kandos, 'kandos-detour.png',
               [('The', 150, 186, 520), ('Kandos', 700, 214, 786)]),
}


def build(slug):
    illustration, out_name, words = TOWNS[slug]
    svg = illustration()
    os.makedirs(f'{HERE}/{slug}', exist_ok=True)
    open(f'{HERE}/{slug}/illustration.svg', 'w').write(svg)
    open(f'{HERE}/.illustration.html', 'w').write(
        '<html><body style="margin:0;background:transparent">' + svg + '</body></html>')
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
                    '--default-background-color=00000000', '--window-size=1254,1254',
                    f'--screenshot={HERE}/.illustration.png',
                    f'file://{HERE}/.illustration.html'], check=True, capture_output=True)

    out = badge_furniture().convert('RGBA')
    out.alpha_composite(Image.open(f'{HERE}/.illustration.png').convert('RGBA'))
    for word, width, left, bottom in words:
        draw_word(word, width, left, bottom, out)
    out.convert('RGB').save(out_name)

    rgb = np.array(out.convert('RGB')).astype(float)
    bg = np.array([249., 241., 236.])
    a = np.clip(((bg - rgb) / bg).max(2), 0, 1)
    safe = np.maximum(a, 1e-4)[..., None]
    ink = np.clip((rgb - bg * (1 - safe)) / safe, 0, 255)
    Image.fromarray(np.dstack([ink, a * 255]).astype(np.uint8)).save(
        out_name.replace('.png', '-transparent.png'))
    for f in ('.illustration.html', '.illustration.png'):
        os.remove(f'{HERE}/{f}')
    print(f'built {out_name}')


for slug in TOWNS:
    build(slug)
