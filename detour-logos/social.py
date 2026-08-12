"""Social cover sizes built from country-detour-2-goldfields.png."""
from PIL import Image
import numpy as np
import os

BG = (249, 241, 236)
LOGO = 'country-detour-2-goldfields.png'
OUT = 'social'
os.makedirs(OUT, exist_ok=True)


def to_rgba(im):
    a = np.array(im.convert('RGB')).astype(float)
    bg = np.array(BG, float)
    alpha = np.clip(((bg - a) / bg).max(2), 0, 1)
    safe = np.maximum(alpha, 1e-4)[..., None]
    col = np.clip((a - bg * (1 - safe)) / safe, 0, 255)
    return Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8))


src = Image.open(LOGO)
art = to_rgba(src).crop((141, 355, 1093, 892))          # trimmed to the ink
sprig = to_rgba(src).crop((118, 340, 336, 782))       # blossom + eucalyptus cluster only

# canvas: (w, h, safe box as fraction of w/h, centre of that box)
SIZES = {
    'facebook-cover-1640x924':  (1640, 924, 0.56, 0.62, 0.50, 0.47),
    'x-header-1500x500':        (1500, 500, 0.54, 0.68, 0.53, 0.44),
    'linkedin-cover-1128x376':  (1128, 376, 0.52, 0.70, 0.57, 0.43),
    'share-card-1200x630':      (1200, 630, 0.72, 0.70, 0.50, 0.48),
}


def build(name, w, h, bw, bh, cx, cy, accent=False):
    canvas = Image.new('RGB', (w, h), BG)
    if accent:
        s = sprig.copy().transpose(Image.FLIP_LEFT_RIGHT)
        k = (h * 0.92) / s.height
        s = s.resize((int(s.width * k), int(s.height * k)), Image.LANCZOS)
        faded = s.copy()
        faded.putalpha(s.getchannel('A').point(lambda v: int(v * 0.30)))
        canvas.paste(faded, (w - int(s.width * 0.62), int(h * 0.04)), faded)

    k = min(w * bw / art.width, h * bh / art.height)
    a = art.resize((int(art.width * k), int(art.height * k)), Image.LANCZOS)
    canvas.paste(a, (int(w * cx - a.width / 2), int(h * cy - a.height / 2)), a)
    canvas.save(f'{OUT}/{name}.png')
    return canvas


for name, (w, h, bw, bh, cx, cy) in SIZES.items():
    build(name, w, h, bw, bh, cx, cy)

build('facebook-cover-1640x924-sprig', 1640, 924, 0.56, 0.62, 0.46, 0.47, accent=True)
build('x-header-1500x500-sprig', 1500, 500, 0.54, 0.68, 0.47, 0.44, accent=True)
print('done')
