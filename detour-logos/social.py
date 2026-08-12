"""Social cover sizes for both Detour logos."""
from PIL import Image
import numpy as np
import os
import shutil

BG = (249, 241, 236)
OUT = 'social'

# canvas, then the safe box (fraction of w/h) and its centre — kept clear of mobile
# cropping on Facebook and of the profile picture on X and LinkedIn.
SIZES = [
    ('facebook-cover-1640x924', 1640, 924, 0.50, 0.47),
    ('x-header-1500x500',       1500, 500, 0.53, 0.44),
    ('linkedin-cover-1128x376', 1128, 376, 0.57, 0.43),
    ('share-card-1200x630',     1200, 630, 0.50, 0.48),
]
BOX = {                       # (width fraction, height fraction) per logo shape
    'country': {'facebook-cover-1640x924': (0.56, 0.62), 'x-header-1500x500': (0.54, 0.68),
                'linkedin-cover-1128x376': (0.52, 0.70), 'share-card-1200x630': (0.72, 0.70)},
    'gulgong': {'facebook-cover-1640x924': (0.42, 0.80), 'x-header-1500x500': (0.30, 0.84),
                'linkedin-cover-1128x376': (0.28, 0.86), 'share-card-1200x630': (0.44, 0.82)},
    'hillend': {'facebook-cover-1640x924': (0.42, 0.80), 'x-header-1500x500': (0.30, 0.84),
                'linkedin-cover-1128x376': (0.28, 0.86), 'share-card-1200x630': (0.44, 0.82)},
}
LOGOS = {
    'country': dict(file='country-detour-2-goldfields.png', crop=(141, 355, 1093, 892),
                    accent=(118, 340, 336, 782), sprig_on=('facebook-cover-1640x924',
                                                           'x-header-1500x500')),
    'gulgong': dict(file='gulgong-detour-2-goldfields.png', crop=(137, 89, 1155, 1152),
                    accent=None, sprig_on=()),
    'hillend': dict(file='hill-end-detour.png', crop=None, accent=None, sprig_on=()),
}


def to_rgba(im):
    a = np.array(im.convert('RGB')).astype(float)
    bg = np.array(BG, float)
    alpha = np.clip(((bg - a) / bg).max(2), 0, 1)
    safe = np.maximum(alpha, 1e-4)[..., None]
    return Image.fromarray(np.dstack([np.clip((a - bg * (1 - safe)) / safe, 0, 255),
                                      alpha * 255]).astype(np.uint8))


def build(art, sprig, w, h, bw, bh, cx, cy, path):
    canvas = Image.new('RGB', (w, h), BG)
    if sprig is not None:
        s = sprig.transpose(Image.FLIP_LEFT_RIGHT)
        k = (h * 0.92) / s.height
        s = s.resize((int(s.width * k), int(s.height * k)), Image.LANCZOS)
        faded = s.copy()
        faded.putalpha(s.getchannel('A').point(lambda v: int(v * 0.30)))
        canvas.paste(faded, (w - int(s.width * 0.62), int(h * 0.04)), faded)
    k = min(w * bw / art.width, h * bh / art.height)
    a = art.resize((int(art.width * k), int(art.height * k)), Image.LANCZOS)
    canvas.paste(a, (int(w * cx - a.width / 2), int(h * cy - a.height / 2)), a)
    canvas.save(path)


shutil.rmtree(OUT, ignore_errors=True)
for name, cfg in LOGOS.items():
    os.makedirs(f'{OUT}/{name}', exist_ok=True)
    src = Image.open(cfg['file'])
    art = to_rgba(src)
    art = art.crop(cfg['crop'] or art.getbbox())
    sprig = to_rgba(src).crop(cfg['accent']) if cfg['accent'] else None
    for size, w, h, cx, cy in SIZES:
        bw, bh = BOX[name][size]
        build(art, None, w, h, bw, bh, cx, cy, f'{OUT}/{name}/{size}.png')
        if size in cfg['sprig_on']:
            build(art, sprig, w, h, bw, bh, cx - 0.05, cy, f'{OUT}/{name}/{size}-sprig.png')
print('done')
