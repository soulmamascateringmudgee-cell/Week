"""Recolour the Gulgong / Country Detour logos into The Mudgee Detour palette."""
from PIL import Image
import numpy as np
from scipy.ndimage import gaussian_filter, maximum_filter

U = 'source/'
SRC = {'gulgong': U + 'gulgong-detour-original.png',
       'country': U + 'country-detour-original.png'}

BG = np.array([249., 241., 236.])          # cream paper, sampled from the Mudgee logo

# --- Mudgee brand inks -------------------------------------------------------
TERRA      = np.array([150.,  72.,  26.])  # clock-tower terracotta (hero line art)
TERRA_DEEP = np.array([119.,  50.,  14.])  # darker rust for lettering
OLIVE      = np.array([ 66.,  66.,  38.])  # script / icon olive
OLIVE_DEEP = np.array([ 42.,  45.,  23.])  # darker olive for lettering
SAGE       = np.array([ 84.,  90.,  52.])  # grape-leaf green
SAGE_GREY  = np.array([106.,  99.,  60.])  # distant hills / vineyard rows
SEPIA      = np.array([ 96.,  66.,  40.])  # warm engraving brown
PLUM       = np.array([110.,  45.,  74.])  # grape / wine purple


def load(path):
    return np.array(Image.open(path).convert('RGB')).astype(float)


def hsv(img):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    mx, mn = img.max(2), img.min(2)
    d = np.maximum(mx - mn, 1e-6)
    h = np.zeros_like(mx)
    m = mx == r; h[m] = ((g - b)[m] / d[m]) % 6
    m = mx == g; h[m] = ((b - r)[m] / d[m]) + 2
    m = mx == b; h[m] = ((r - g)[m] / d[m]) + 4
    return h * 60, np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0), mx / 255


def ink_masks(img):
    """Split the artwork into existing green ink, existing rust ink and pencil sketch."""
    h, s, v = hsv(img)
    lum = img @ [0.299, 0.587, 0.114]
    dark = lum < 190
    green = dark & (h >= 42) & (h <= 78) & (s >= 0.38)
    rust = dark & (h >= 6) & (h <= 34) & (s >= 0.52)
    # grow over the antialiased fringe so letterforms keep one colour
    green = maximum_filter(green, size=5)
    rust = maximum_filter(rust, size=5) & ~green
    return green, rust


def alpha_from_darkness(img, gain=1.0, floor_pct=99.2):
    """Ink coverage 0-1, normalised so the darkest strokes reach full strength."""
    lum = img @ [0.299, 0.587, 0.114]
    bg_lum = float(BG @ [0.299, 0.587, 0.114])
    d = np.clip((bg_lum - lum) / bg_lum, 0, None)
    ref = np.percentile(d[d > 0.02], floor_pct) if (d > 0.02).any() else 1.0
    return np.clip(d / max(ref, 1e-6) * gain, 0, 1)


def rect(shape, x0, y0, x1, y1, feather=18):
    m = np.zeros(shape[:2])
    m[max(y0, 0):y1, max(x0, 0):x1] = 1
    return gaussian_filter(m, feather) if feather else m


def circle(shape, cx, cy, r, feather=12):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    m = (((xx - cx) ** 2 + (yy - cy) ** 2) <= r * r).astype(float)
    return gaussian_filter(m, feather) if feather else m


def paint(field, mask, colour):
    m = mask[..., None]
    return field * (1 - m) + colour * m


def compose(img, field, alpha):
    return np.clip(BG * (1 - alpha[..., None]) + field * alpha[..., None], 0, 255)


def save(arr, path):
    Image.fromarray(arr.astype(np.uint8)).save(path)


def interior_fill(img, region, dilate=4, blur=2.0):
    """Soft wash inside closed line-art shapes, like the filled Mudgee grape leaves."""
    from scipy.ndimage import binary_fill_holes, binary_dilation, binary_erosion
    lum = img @ [0.299, 0.587, 0.114]
    strokes = (lum < 215) & (region > 0.5)
    thick = binary_dilation(strokes, iterations=dilate)
    inner = binary_fill_holes(thick) & ~thick
    inner = binary_erosion(inner, iterations=1)
    return gaussian_filter(inner.astype(float), blur)


OCHRE = np.array([166., 116.,  38.])   # goldfields ochre


def to_rgba(rgb):
    """Lift the cream paper out into an alpha channel for use on other backgrounds."""
    a = np.clip(((BG - rgb) / BG).max(2), 0, 1)
    safe = np.maximum(a, 1e-4)[..., None]
    col = np.clip((rgb - BG * (1 - safe)) / safe, 0, 255)
    return np.dstack([col, a * 255])
