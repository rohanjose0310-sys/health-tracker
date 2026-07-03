"""Generate app icons (moon + heart) with a soft Liquid-Glass gradient.
Run: python3 icons/make_icons.py
"""
import math
from PIL import Image, ImageDraw, ImageFilter

OUT = __file__.rsplit("/", 1)[0]


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, c1, c2):
    """Diagonal gradient."""
    img = Image.new("RGB", (size, size), c1)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = lerp(c1, c2, t)
    return img


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def heart(draw, cx, cy, s, color):
    pts = []
    for i in range(0, 360):
        t = math.radians(i)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s, cy - y * s))
    draw.polygon(pts, fill=color)


def make(size):
    scale = 4
    S = size * scale
    # Warm rose -> lavender glass gradient
    base = gradient(S, (255, 173, 189), (176, 156, 240))
    # Overlay a soft peach glow bottom-left
    glow = Image.new("RGB", (S, S), (255, 214, 176))
    mask = Image.new("L", (S, S), 0)
    dm = ImageDraw.Draw(mask)
    dm.ellipse([-S * 0.3, S * 0.5, S * 0.7, S * 1.3], fill=140)
    mask = mask.filter(ImageFilter.GaussianBlur(S * 0.12))
    base = Image.composite(glow, base, mask)

    d = ImageDraw.Draw(base, "RGBA")
    # Crescent moon (white disc minus offset disc)
    moon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    md = ImageDraw.Draw(moon)
    r = S * 0.30
    mcx, mcy = S * 0.46, S * 0.44
    md.ellipse([mcx - r, mcy - r, mcx + r, mcy + r], fill=(255, 255, 255, 235))
    cut = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cut)
    off = S * 0.14
    cd.ellipse([mcx - r + off, mcy - r - off * 0.4, mcx + r + off, mcy + r - off * 0.4],
               fill=(0, 0, 0, 255))
    moon = Image.composite(Image.new("RGBA", (S, S), (0, 0, 0, 0)), moon, cut.split()[3])
    base.paste(moon, (0, 0), moon)

    # Little heart accent
    heart(d, S * 0.66, S * 0.66, S * 0.010, (255, 255, 255, 240))

    # Round the corners (iOS superellipse-ish)
    radius = int(S * 0.225)
    m = rounded_mask(S, radius)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(base, (0, 0), m)
    out = out.resize((size, size), Image.LANCZOS)
    return out


for sz in (180, 192, 512):
    make(sz).save(f"{OUT}/icon-{sz}.png")

# Maskable (extra padding so nothing gets clipped by the mask)
big = make(512)
pad = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
inner = big.resize((410, 410), Image.LANCZOS)
pad.paste(inner, (51, 51), inner)
pad.save(f"{OUT}/icon-maskable-512.png")

# Favicon
make(64).save(f"{OUT}/favicon-64.png")
print("icons generated")
