import numpy as np
from scipy.ndimage import gaussian_filter
from recolour import *
from PIL import Image
import os

OUT = 'out'
os.makedirs(OUT, exist_ok=True)


def ellipse(shape, cx, cy, rx, ry, feather=10):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return gaussian_filter(((((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) <= 1).astype(float), feather)


def write(rgb, name):
    save(rgb, f'{OUT}/{name}.png')
    Image.fromarray(to_rgba(rgb).astype(np.uint8)).save(f'{OUT}/{name}-transparent.png')


# ----------------------------------------------------------------- Gulgong ---
gimg = load(SRC['gulgong'])
gsh = gimg.shape
G_BLOSSOMS = [(1002, 197, 56), (1068, 252, 54), (1102, 324, 54), (955, 352, 46), (982, 447, 50)]


def gulgong(blossom, leaf, building, street, name):
    field = np.ones(gsh) * street
    gain = np.ones(gsh[:2])
    m = rect(gsh, 900, 130, 1180, 730, feather=22)
    field, gain = paint(field, m, leaf), gain * (1 + 1.05 * m)
    m = rect(gsh, 605, 330, 945, 620, feather=20)
    field, gain = paint(field, m, street), gain * (1 + 0.62 * m)
    m = rect(gsh, 292, 220, 622, 615, feather=16)
    field, gain = paint(field, m, building), gain * (1 + 0.95 * m)
    m = ellipse(gsh, 765, 328, 68, 92, feather=12)
    field, gain = paint(field, m, SEPIA), gain * (1 + 1.0 * m)
    for cx, cy, r in G_BLOSSOMS:
        m = circle(gsh, cx, cy, r, feather=9)
        field, gain = paint(field, m, blossom), gain * (1 + 1.0 * m)
    out = compose(gimg, field, np.clip(alpha_from_darkness(gimg) * gain, 0, 1))
    green, rust = ink_masks(gimg)
    write(np.where((green | rust)[..., None], gimg, out), name)


gulgong(TERRA, SAGE, TERRA, SAGE_GREY, 'gulgong-detour-1-terracotta')
gulgong(OCHRE, SAGE, TERRA, SAGE_GREY, 'gulgong-detour-2-goldfields')
gulgong(PLUM,  SAGE, TERRA, SAGE_GREY, 'gulgong-detour-3-plum')

# ----------------------------------------------------------------- Country ---
cimg = load(SRC['country'])
csh = cimg.shape
C_BLOSSOMS = [(222, 383, 62), (180, 472, 58), (300, 467, 56), (256, 432, 26), (259, 546, 22)]


def country(blossom, leaf, road, serif, script, boost, name):
    field = np.ones(csh) * road
    gain = np.ones(csh[:2])
    m = rect(csh, 105, 330, 425, 795, feather=20)
    field, gain = paint(field, m, leaf), gain * (1 + 1.25 * boost * m)
    m = rect(csh, 375, 620, 1045, 850, feather=20)
    field, gain = paint(field, m, road), gain * (1 + 1.25 * boost * m)
    m = rect(csh, 922, 520, 1034, 664, feather=7)
    field, gain = paint(field, m, TERRA), gain * (1 + 1.35 * boost * m)
    m = rect(csh, 786, 650, 886, 742, feather=10)
    field, gain = paint(field, m, OLIVE), gain * (1 + 1.25 * boost * m)
    for cx, cy, r in C_BLOSSOMS:
        m = circle(csh, cx, cy, r, feather=10)
        field, gain = paint(field, m, blossom), gain * (1 + 1.30 * boost * m)
    green, rust = ink_masks(cimg)
    field = paint(field, green.astype(float), script)
    field = paint(field, rust.astype(float), serif)
    gain = np.where(green | rust, 1.0, gain)
    write(compose(cimg, field, np.clip(alpha_from_darkness(cimg) * gain, 0, 1)), name)


country(TERRA, SAGE, SAGE_GREY, TERRA_DEEP, OLIVE_DEEP, 1.0, 'country-detour-1-terracotta')
country(OCHRE, SAGE, SAGE_GREY, TERRA_DEEP, OLIVE_DEEP, 1.0, 'country-detour-2-goldfields')
country(TERRA, np.array([74., 84., 42.]), np.array([88., 88., 56.]),
        np.array([104., 42., 10.]), np.array([34., 38., 18.]), 1.25, 'country-detour-3-bold')
print('done')
