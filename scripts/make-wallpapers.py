"""Generate the built-in wallpaper library (app/assets/wallpapers/).

Original artwork made from code, so there are no licensing questions. Re-run to regenerate:
    python3 scripts/make-wallpapers.py
Each wallpaper is 1080x2340 (phone ratio) plus a 216x468 thumbnail.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

W, H = 1080, 2340
OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'assets', 'wallpapers')
rng = np.random.default_rng(7)


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def vgrad(stops):
    """Vertical gradient from [(pos 0..1, '#hex'), ...]."""
    ys = np.linspace(0, 1, H)
    out = np.zeros((H, 3), np.float32)
    for c in range(3):
        out[:, c] = np.interp(ys, [p for p, _ in stops], [hexrgb(h)[c] for _, h in stops])
    return np.repeat(out[:, None, :], W, axis=1)


def ridge(base, amp, rough, seed, octaves=6):
    """1D fractal ridge line: y position (pixels) for every x."""
    r = np.random.default_rng(seed)
    x = np.linspace(0, 1, W)
    y = np.zeros(W)
    a, f = 1.0, 1.5
    for _ in range(octaves):
        y += a * np.sin(2 * np.pi * (f * x + r.random())) + a * 0.5 * np.sin(2 * np.pi * (f * 1.7 * x + r.random()))
        a *= rough
        f *= 2.1
    y = (y - y.min()) / (np.ptp(y) + 1e-6)
    return base - y * amp


def fill_below(img, line, color, soft=2.0):
    ys = np.arange(H)[:, None]
    mask = np.clip((ys - line[None, :]) / soft, 0, 1)[..., None]
    return img * (1 - mask) + hexrgb(color) * mask


def fog(img, y, height, color, strength):
    ys = np.arange(H)[:, None, None]
    m = np.exp(-((ys - y) / height) ** 2) * strength
    return img * (1 - m) + hexrgb(color) * m


def glow(img, cx, cy, radius, color, strength):
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / radius
    m = (np.exp(-d ** 2) * strength)[..., None]
    return img * (1 - m) + hexrgb(color) * m


def grain(img, amount=3.0):
    return img + rng.normal(0, amount, (H, W, 1))


def mountains(sky, layers, fogc, sun=None, mist=0.35):
    img = vgrad(sky)
    if sun:
        img = glow(img, *sun)
    for i, (base, amp, rough, color) in enumerate(layers):
        img = fill_below(img, ridge(base * H, amp * H, rough, 100 + i), color)
        img = fog(img, base * H + 40, 120 + 40 * i, fogc, mist * (1 - i / len(layers)))
    return img


def wallpaper_mist():
    return mountains([(0, '#e9efea'), (.55, '#d5e0d8'), (1, '#9fb5a8')],
                     [(.50, .12, .55, '#b8c9be'), (.58, .12, .55, '#94ad9f'), (.68, .14, .5, '#6f8e7e'), (.80, .12, .5, '#4c6c5d'), (.93, .10, .45, '#2f4a3e')],
                     '#e3ebe5', mist=.45)


def wallpaper_dusk():
    return mountains([(0, '#2c2f52'), (.35, '#7b5a7e'), (.55, '#e09a7f'), (.66, '#f4c99a'), (1, '#f4c99a')],
                     [(.62, .08, .55, '#a06f7c'), (.70, .10, .55, '#6e4e66'), (.80, .12, .5, '#43354d'), (.92, .10, .5, '#241f33')],
                     '#f1b98f', sun=(W * .62, H * .58, 260, '#fff1d0', .9), mist=.25)


def wallpaper_forest():
    img = mountains([(0, '#0f2520'), (.5, '#1d3d33'), (1, '#28493d')],
                    [(.45, .10, .62, '#2c5145'), (.55, .12, .65, '#21433a'), (.67, .14, .7, '#17352d'), (.82, .14, .72, '#0e2620')],
                    '#5f8a78', mist=.3)
    return glow(img, W * .5, H * .2, 700, '#3f6f5d', .35)


def wallpaper_sea():
    img = vgrad([(0, '#a9c7d8'), (.48, '#e4eef1'), (.5, '#7fa7b8'), (.75, '#3f6f86'), (1, '#1f4357')])
    ys, xs = np.mgrid[0:H, 0:W]
    below = ys > H * .5
    shimmer = (np.sin(xs / 37 + ys / 3.1) * np.sin(ys / 11.0) * 6 * ((ys - H * .5) / H + .1))[..., None]
    img = img + np.where(below[..., None], shimmer, 0)
    img = glow(img, W * .5, H * .49, 380, '#fbfdfd', .55)
    return img


def wallpaper_night():
    img = vgrad([(0, '#070c1c'), (.6, '#16233f'), (1, '#24395a')])
    stars = rng.random((H, W)) > 0.9993
    bright = rng.random((H, W)) * stars * (np.linspace(1, .2, H)[:, None])
    img = img + (bright * 230)[..., None]
    img = glow(img, W * .72, H * .2, 120, '#f6f3e6', .95)
    img = glow(img, W * .72, H * .2, 420, '#6c7fa6', .25)
    img = fill_below(img, ridge(.86 * H, .08 * H, .55, 31), '#0b1526')
    img = fill_below(img, ridge(.93 * H, .06 * H, .5, 32), '#060c18')
    return img


def wallpaper_aurora():
    img = vgrad([(0, '#041613'), (.7, '#0b2a2a'), (1, '#0f3433')])
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    for k, (c, off, amp, wid, s) in enumerate([('#3fd59a', .30, 140, 70, .6), ('#58c7d6', .38, 110, 55, .45), ('#9be7a8', .24, 90, 40, .4)]):
        center = H * off + amp * np.sin(xs / 210 + k * 1.7) + 60 * np.sin(xs / 83 + k)
        band = np.exp(-((ys - center) / wid) ** 2) * (0.6 + 0.4 * np.sin(xs / 47 + k * 2.3) ** 2)
        streak = np.clip((center - ys) / 520, 0, 1) * np.exp(-((ys - center) / 520) ** 2) * .5
        m = ((band + streak) * s)[..., None]
        img = img * (1 - m) + hexrgb(c) * m
    img = fill_below(img, ridge(.88 * H, .07 * H, .55, 41), '#04110f')
    return img


def wallpaper_dunes():
    img = vgrad([(0, '#f3e6d4'), (.4, '#ecd3b5'), (1, '#c99a73')])
    colors = ['#e6c6a2', '#d9b089', '#c99a73', '#b3805c', '#946446']
    for i, c in enumerate(colors):
        x = np.linspace(0, 1, W)
        line = H * (.45 + i * .12) - H * .07 * np.sin(2 * np.pi * (x * (.7 + .15 * i) + i * .37)) - H * .02 * np.sin(2 * np.pi * x * 3.1 + i)
        img = fill_below(img, line, c, soft=10)
    return glow(img, W * .25, H * .15, 300, '#fff7ea', .6)


def wallpaper_pine():
    img = vgrad([(0, '#0d2c25'), (1, '#174a3d')])
    for cx, cy, r, c, s in [(.15, .2, 700, '#2f7a62', .55), (.85, .45, 650, '#13765b', .6), (.3, .8, 800, '#5aa58a', .35), (.9, .9, 500, '#0a221c', .6)]:
        img = glow(img, W * cx, H * cy, r, c, s)
    return img


LIBRARY = [
    ('mist', wallpaper_mist), ('dusk', wallpaper_dusk), ('forest', wallpaper_forest), ('sea', wallpaper_sea),
    ('night', wallpaper_night), ('aurora', wallpaper_aurora), ('dunes', wallpaper_dunes), ('pine', wallpaper_pine),
]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, make in LIBRARY:
        arr = np.clip(grain(make()), 0, 255).astype(np.uint8)
        im = Image.fromarray(arr, 'RGB').filter(ImageFilter.GaussianBlur(0.6))
        im.save(os.path.join(OUT, f'{name}.jpg'), quality=80, optimize=True, progressive=True)
        im.resize((216, 468), Image.LANCZOS).save(os.path.join(OUT, f'{name}-thumb.jpg'), quality=78, optimize=True)
        print(name, os.path.getsize(os.path.join(OUT, f'{name}.jpg')) // 1024, 'KB')
