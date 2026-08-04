#!/usr/bin/env python3
"""Generate transparent caption overlays + outro card for the Country Smart AI reel."""
from PIL import Image, ImageDraw, ImageFont
import os
import sys

W, H = 1080, 1920
DEFAULT_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cards")
OUT = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
os.makedirs(OUT, exist_ok=True)

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"

OCHRE = (224, 166, 59, 255)
WHITE = (255, 255, 255, 255)
SCRIM = (12, 12, 14, 180)


def font(path, size):
    return ImageFont.truetype(path, size)


def text_w(draw, s, f, tracking=0):
    if not s:
        return 0
    w = sum(draw.textlength(ch, font=f) for ch in s)
    return int(w + tracking * (len(s) - 1))


def draw_tracked(draw, xy, s, f, fill, tracking=0):
    x, y = xy
    for ch in s:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking


def pill_line(draw, cy, s, f, pad_x=34, pad_y=18, radius=18):
    """Centered line of text on a rounded dark pill. cy = vertical centre."""
    tw = int(draw.textlength(s, font=f))
    asc, desc = f.getmetrics()
    th = asc + desc
    x0 = (W - tw) / 2 - pad_x
    x1 = (W + tw) / 2 + pad_x
    y0 = cy - th / 2 - pad_y
    y1 = cy + th / 2 + pad_y
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=SCRIM)
    draw.text((W / 2, cy), s, font=f, fill=WHITE, anchor="mm")


# ── caption cards ────────────────────────────────────────────────────────────
CAPS = [
    ("cap_a", "6pm last night.", "Catering a job in Mudgee."),
    ("cap_b", "On the laptop between courses:", "a client's website, finished."),
    ("cap_c", "Then ordering the stock", "for this weekend's jobs."),
    ("cap_d", "One apron. One shift.", "Claude did the admin."),
]

f_cap = font(BOLD, 54)
for name, l1, l2 in CAPS:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pill_line(d, 1215, l1, f_cap)
    pill_line(d, 1315, l2, f_cap)
    img.save(os.path.join(OUT, name + ".png"))
    print(name, "line widths:", int(d.textlength(l1, font=f_cap)), int(d.textlength(l2, font=f_cap)))

# ── persistent brand lockup (top) ────────────────────────────────────────────
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
f_lock = font(BOLD, 30)
lock = "COUNTRY SMART AI"
tr = 6
lw = text_w(d, lock, f_lock, tr)
dot_r = 6
gap = 18
total = lw + gap + dot_r * 2
x0 = (W - total) / 2
cy = 138
d.rounded_rectangle(
    [x0 - 30, cy - 30, x0 + total + 30, cy + 30], radius=30, fill=(12, 12, 14, 130)
)
d.ellipse([x0, cy - dot_r, x0 + dot_r * 2, cy + dot_r], fill=OCHRE)
asc, desc = f_lock.getmetrics()
draw_tracked(d, (x0 + dot_r * 2 + gap, cy - (asc + desc) / 2 + 3), lock, f_lock, WHITE, tr)
img.save(os.path.join(OUT, "lockup.png"))

# ── outro card ───────────────────────────────────────────────────────────────
card = Image.new("RGBA", (W, H), (17, 16, 14, 255))
d = ImageDraw.Draw(card)
# soft warm glow behind the title
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([-200, 560, W + 200, 1360], fill=(224, 166, 59, 26))
try:
    from PIL import ImageFilter

    glow = glow.filter(ImageFilter.GaussianBlur(120))
except Exception:
    pass
card = Image.alpha_composite(card, glow)
d = ImageDraw.Draw(card)

f_title = font(BOLD, 76)
f_tag = font(BOLD, 46)
f_small = font(REG, 32)

tr_t = 6
t1 = "COUNTRY SMART"
t2 = "AI"
w1 = text_w(d, t1, f_title, tr_t)
asc, desc = f_title.getmetrics()
draw_tracked(d, ((W - w1) / 2, 690), t1, f_title, WHITE, tr_t)
w2 = text_w(d, t2, f_title, tr_t)
draw_tracked(d, ((W - w2) / 2, 690 + asc + desc + 6), t2, f_title, OCHRE, tr_t)

# rule
ry = 690 + (asc + desc) * 2 + 70
d.rounded_rectangle([W / 2 - 70, ry, W / 2 + 70, ry + 5], radius=3, fill=OCHRE)

d.text((W / 2, ry + 90), "Big city tools. Country hours.", font=f_tag, fill=WHITE, anchor="mm")
d.text(
    (W / 2, ry + 165),
    "Catering, websites and stock orders in one shift.",
    font=f_small,
    fill=(255, 255, 255, 175),
    anchor="mm",
)
f_loc = font(BOLD, 28)
wl = text_w(d, "MUDGEE, NSW", f_loc, 5)
draw_tracked(d, ((W - wl) / 2, ry + 240), "MUDGEE, NSW", f_loc, (224, 166, 59, 210), 5)

card.convert("RGB").save(os.path.join(OUT, "outro.png"))
print("cards written to", OUT)
