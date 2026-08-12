"""Light-on-dark versions, for dark website headers, merch and photo overlays."""
from PIL import Image
import numpy as np
import colorsys

BG = np.array([249., 241., 236.])
GROUND = np.array([35., 38., 25.])          # deep olive-black, drawn from the brand olive
PAIRS = [('country-detour-2-goldfields', 'country-detour-2-goldfields-reversed'),
         ('gulgong-detour-2-goldfields', 'gulgong-detour-2-goldfields-reversed'),
         ('hill-end-detour', 'hill-end-detour-reversed'),
         ('rylstone-detour', 'rylstone-detour-reversed'),
         ('kandos-detour', 'kandos-detour-reversed')]


MONO = np.array([242., 233., 221.])         # warm off-white, for the single-colour version


def lift(rgb):
    """Same hues, opened up for a dark ground. Greens go sage, not acid."""
    out = np.zeros_like(rgb)
    flat, res = rgb.reshape(-1, 3) / 255, out.reshape(-1, 3)
    for i, (r, g, b) in enumerate(flat):
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        deg = h * 360
        if 40 <= deg <= 100:                # olive and sage: desaturate hard or it reads lime
            s2, v2 = min(s * 0.30, 0.20), 0.88
        else:                               # terracotta and ochre keep more of their warmth
            s2, v2 = min(s * 0.60, 0.46), 0.82
        res[i] = colorsys.hsv_to_rgb(h, s2, v2)
    return out.reshape(rgb.shape) * 255


for src, dst in PAIRS:
    img = np.array(Image.open(f'{src}.png').convert('RGB')).astype(float)
    a = np.clip(((BG - img) / BG).max(2), 0, 1)
    safe = np.maximum(a, 1e-4)[..., None]
    ink = np.clip((img - BG * (1 - safe)) / safe, 0, 255)
    light = lift(ink)
    Image.fromarray(np.clip(GROUND * (1 - a[..., None]) + light * a[..., None], 0, 255)
                    .astype(np.uint8)).save(f'{dst}.png')
    Image.fromarray(np.dstack([light, a * 255]).astype(np.uint8)).save(f'{dst}-transparent.png')
    Image.fromarray(np.clip(GROUND * (1 - a[..., None]) + MONO * a[..., None], 0, 255)
                    .astype(np.uint8)).save(f'{dst}-mono.png')
    print(dst)
