"""Generate five of the Pro theme lock-screen wallpapers (屋 and 毛: make-pro-illus-wallpapers.cjs) (app/assets/wallpapers/pro-<theme>.jpg).

Original artwork made from code (no licensing questions). Re-run to regenerate:
    python3 scripts/make-pro-wallpapers.py
Each wallpaper is 1080x2340 (phone ratio) plus a 216x468 thumbnail.

Layout rule for all six: the lock screen puts the clock at about 8-15% of the height and the to-do cards between
about 20% and 65%. So the middle stays calm; each theme's signature sits behind the clock and along the bottom.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 2340
OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'assets', 'wallpapers')
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def vgrad(stops):
    ys = np.linspace(0, 1, H)
    col = np.stack([np.interp(ys, [p for p, _ in stops], [rgb(c)[k] for _, c in stops]) for k in range(3)], -1)
    return np.repeat(col[:, None, :], W, 1)


def noise(scale, seed, octaves=4):
    """Smooth value noise in 0..1 (sum of upscaled random grids)."""
    r = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(2, int(scale * 2 ** o))
        g = r.random((int(H / W * s) + 2, s + 2)).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        out += np.asarray(img, np.float32) / 255 * amp
        tot += amp
        amp *= .5
    return out / tot


def grain(img, amount, seed):
    r = np.random.default_rng(seed)
    return img + (r.random((H, W, 1)).astype(np.float32) - .5) * amount


def glow(cx, cy, rad, power=2.0):
    d = np.sqrt((XX - cx) ** 2 + (YY - cy) ** 2) / rad
    return np.clip(1 - d, 0, 1) ** power


def mix(img, color, alpha):
    a = alpha[..., None] if alpha.ndim == 2 else alpha
    return img * (1 - a) + rgb(color) * a


def multiply(img, color, alpha):
    a = alpha[..., None] if alpha.ndim == 2 else alpha
    return img * (1 - a + a * rgb(color) / 255)


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)) if isinstance(img, np.ndarray) else img
    im.save(os.path.join(OUT, f'{name}.jpg'), quality=88, optimize=True, progressive=True)
    im.resize((216, 468), Image.LANCZOS).save(os.path.join(OUT, f'{name}-thumb.jpg'), quality=82)


def serif(size):
    path = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc'
    for i in range(10):
        try:
            f = ImageFont.truetype(path, size, index=i)
            if 'SC' in ' '.join(f.getname()):
                return f
        except OSError:
            break
    return ImageFont.truetype(path, size)


def supersampled(draw_fn, k=2, mode='RGBA'):
    """Draw at k× size with PIL, then shrink: smooth edges for vector-like shapes."""
    big = Image.new(mode, (W * k, H * k), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(big), k)
    return big.resize((W, H), Image.LANCZOS)


def over(img, layer):
    a = np.asarray(layer, np.float32) / 255
    return img * (1 - a[..., 3:4]) + a[..., :3] * 255 * a[..., 3:4]


# ---------- 晨 · 玻璃: a pastel dawn seen through glass — prism bands and a low sun ----------
def dawn():
    img = vgrad([(0, '#c9c1ff'), (.28, '#d9d6ff'), (.55, '#d4f1ea'), (.82, '#ffe0cf'), (1, '#ffcdb8')])
    n = noise(3, 1)
    img = mix(img, '#b9b0ff', np.clip((n - .45) * 1.4, 0, 1) * .35 * (1 - YY / H))
    img = mix(img, '#ffffff', glow(W * .74, H * .83, 520, 1.6) * .75)
    img = mix(img, '#fff4ea', glow(W * .74, H * .83, 230, 1.2) * .8)
    # glass: soft diagonal bands with a faint rainbow fringe on their edges
    for i, (off, wdt, a) in enumerate([(-.25, 120, .22), (.05, 60, .16), (.32, 190, .14), (.62, 80, .18)]):
        d = (XX * .62 + YY * .38) / (W * .62 + H * .38) - off - .25
        band = np.clip(1 - np.abs(d * (W * .62 + H * .38)) / wdt, 0, 1) ** 1.5
        img = mix(img, '#ffffff', band * a)
        for c, sh in (('#ff9fd0', -wdt * .9), ('#8fe6ff', wdt * .9)):
            fr = np.clip(1 - np.abs(d * (W * .62 + H * .38) - sh) / (wdt * .25), 0, 1) ** 2
            img = mix(img, c, fr * a * .45)
    # a big glass lens lower right: what is behind it is magnified and shifted, with a bright rim and a highlight
    cx, cy, R = W * .62, H * .79, 400
    dx, dy = XX - cx, YY - cy
    d = np.sqrt(dx ** 2 + dy ** 2) / R
    inside = d < 1
    k = .78 + .12 * d ** 2                                     # stronger magnification in the middle
    sx = np.clip(cx + dx * k - 40, 0, W - 1).astype(np.int32)
    sy = np.clip(cy + dy * k - 70, 0, H - 1).astype(np.int32)
    lens = img[sy, sx]
    lens = mix(lens, '#ffffff', np.full((H, W), .12, np.float32))
    edge = np.clip(1 - np.abs(d - .985) / .02, 0, 1)
    inner = np.clip((d - .8) / .2, 0, 1) ** 2
    lens = mix(lens, '#7f78d8', inner * .12)
    img = np.where(inside[..., None], lens, img)
    img = mix(img, '#ffffff', edge * .85)
    shadow = np.clip(1 - np.abs(d - 1.04) / .06, 0, 1) * (dy > 0) * .12
    img = mix(img, '#5c55a8', shadow)
    hl = np.exp(-(((XX - (cx - R * .42)) / (R * .28)) ** 2 + ((YY - (cy - R * .5)) / (R * .12)) ** 2))
    img = mix(img, '#ffffff', hl * .55)
    return grain(img, 6, 11)


# ---------- 昼 · 纸: letter paper ruled as a copybook (米字格), one cinnabar seal ----------
def day():
    img = vgrad([(0, '#f7f4ee'), (1, '#efe9de')])
    n = noise(40, 2, 3)
    img = mix(img, '#e4dccb', np.clip(n - .55, 0, 1) * .5)
    r = np.random.default_rng(5)
    fibers = Image.new('L', (W, H), 0)
    fd = ImageDraw.Draw(fibers)
    for _ in range(900):  # paper fibres
        x, y, L, a = r.random() * W, r.random() * H, 10 + r.random() * 60, r.random() * np.pi
        fd.line([(x, y), (x + np.cos(a) * L, y + np.sin(a) * L)], fill=int(40 + r.random() * 60), width=1)
    img = multiply(img, '#b9a98c', np.asarray(fibers.filter(ImageFilter.GaussianBlur(.6)), np.float32) / 255 * .35)
    red = (180, 58, 44)
    cell = 216

    def grid(dr, k):
        x0, y0 = 0, 0
        for gx in range(-1, W // cell + 2):
            for gy in range(-1, H // cell + 2):
                x, y = (x0 + gx * cell) * k, (y0 + gy * cell) * k
                c = cell * k
                dr.rectangle([x, y, x + c, y + c], outline=red + (46,), width=2 * k)
                for (a, b) in (((x, y + c / 2), (x + c, y + c / 2)), ((x + c / 2, y), (x + c / 2, y + c)), ((x, y), (x + c, y + c)), ((x + c, y), (x, y + c))):
                    steps = 22
                    for s in range(0, steps, 2):
                        p = (a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps)
                        q = (a[0] + (b[0] - a[0]) * (s + 1) / steps, a[1] + (b[1] - a[1]) * (s + 1) / steps)
                        dr.line([p, q], fill=red + (20,), width=1 * k)
    img = over(img, supersampled(grid))
    # a line of characters to trace (描红) along the bottom row of cells
    trace = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(trace)
    f = serif(150)
    for i, ch in enumerate('日日是好日'):
        td.text((i * cell + cell / 2, 8 * cell + cell / 2 + 6), ch, font=f, fill=red + (52,), anchor='mm')
    img = over(img, trace)
    # the seal: 碎碎 on the right column, 清单 on the left, cinnabar with worn edges
    s = 205  # 1.19: smaller, and low in the corner so the lock screen's footer row never sits on it
    seal = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(seal)
    sd.rounded_rectangle([6, 6, s - 6, s - 6], radius=14, fill=red + (235,))
    f = serif(76)
    for ch, (cx, cy) in zip('碎碎清单', [(.72, .3), (.72, .72), (.28, .3), (.28, .72)]):
        sd.text((cx * s, cy * s), ch, font=f, fill=(247, 242, 236, 255), anchor='mm')
    wear = (np.random.default_rng(9).random((s, s)) > .93).astype(np.uint8) * 255
    a = np.asarray(seal).copy()
    a[..., 3] = np.where(wear > 0, a[..., 3] * .25, a[..., 3]).astype(np.uint8)
    seal = Image.fromarray(a).rotate(-4, resample=Image.BICUBIC, expand=True)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.paste(seal, (W - seal.width - 64, int(H * .958) - seal.height // 2), seal)
    img = over(img, layer)
    return grain(img, 5, 12)


# ---------- 夜 · 光: a deep sky with the milky way and a few constellations ----------
def night():
    img = vgrad([(0, '#0c1238'), (.45, '#090c22'), (1, '#05060b')])
    n1, n2 = noise(3, 3, 6), noise(9, 4, 4)
    band = np.exp(-(((XX - W * .5) * .55 + (YY - H * .3) * -.83) / 330) ** 2)
    milky = np.clip(band * (n1 * 1.3 - .25) * (.6 + n2 * .6), 0, 1)
    img = mix(img, '#6f7fd6', milky * .32)
    img = mix(img, '#c7a6ff', np.clip(milky - .45, 0, 1) * .35)
    img = mix(img, '#1b2a6a', glow(W * .2, H * .95, 900, 1.5) * .35)
    r = np.random.default_rng(21)
    stars = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stars)
    for _ in range(2600):
        x, y = r.random() * W, r.random() * H
        boost = 1 + 2.5 * band[int(y), int(x)]
        b = min(255, int((40 + r.random() ** 3 * 215) * (.7 + .3 * boost)))
        rad = .4 + r.random() ** 6 * 1.8
        sd.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(225, 232, 255, b))
    img = over(img, stars.filter(ImageFilter.GaussianBlur(.35)))
    groups = [[(160, 300), (300, 210), (420, 330), (560, 260), (690, 360)], [(780, 520), (900, 430), (980, 560), (870, 650)], [(120, 1980), (260, 1900), (330, 2030), (470, 1960)]]

    def cons(dr, k):
        for g in groups:
            dr.line([(x * k, y * k) for x, y in g], fill=(223, 230, 255, 70), width=2 * k)
        for g in groups:
            for x, y in g:
                s = 13 * k
                pts = []
                for i in range(16):  # four-point star
                    a = i / 16 * 2 * np.pi
                    rr = s if i % 4 == 0 else s * .18
                    pts.append((x * k + np.cos(a) * rr, y * k + np.sin(a) * rr))
                dr.polygon(pts, fill=(246, 248, 255, 255))
    layer = supersampled(cons)
    halo = layer.filter(ImageFilter.GaussianBlur(9))
    img = over(img, halo)
    img = over(img, layer)
    return grain(img, 5, 13)


# ---------- 晕 · 彩墨: big watercolour washes at the top and bottom, clear water in the middle ----------
def bloom():
    img = vgrad([(0, '#f6f7f6'), (1, '#eef0ef')])
    paper = noise(60, 31, 3)
    washes = [('#3b5a87', W * .16, H * .1, 470, 41), ('#b8475a', W * .86, H * .05, 360, 42), ('#d9a43a', W * .78, H * .9, 420, 43),
              ('#3f8aa6', W * .3, H * .93, 380, 44), ('#2b2b2e', W * .52, H * .995, 230, 45), ('#b8475a', W * .02, H * .78, 210, 46)]
    for color, cx, cy, R, seed in washes:
        n = noise(4, seed, 4)
        ang = np.arctan2(YY - cy, XX - cx)
        rr = R * (1 + (n - .5) * .55 + .08 * np.sin(ang * 5 + seed))
        d = np.sqrt((XX - cx) ** 2 + (YY - cy) ** 2) / rr
        inside = np.clip((1 - d) * 18, 0, 1)
        body = .2 + .12 * noise(14, seed + 100, 3)
        rim = np.exp(-((1 - d) * 7) ** 2) * .38            # pigment collects at the edge as it dries
        gran = (paper - .5) * .12                             # granulation in the paper's grain
        a = np.clip(inside * (body + rim + gran), 0, .8)
        img = multiply(img, color, a)
    return grain(img, 5, 14)


# ---------- 乐 · 纸带: green velvet lining, a long punched music-box strip across the bottom ----------
def tape():
    img = vgrad([(0, '#17392f'), (.5, '#12302a'), (1, '#0c221d')])
    n = noise(120, 51, 2)
    img = img + (n[..., None] - .5) * 18                    # velvet pile
    img = mix(img, '#3d7a66', glow(W * .5, H * .12, 900, 2) * .25)
    r = np.random.default_rng(52)

    def strip(dr, k):
        # the strip runs diagonally across the lower part; holes = a little melody
        L, T = 2200, 300
        cx, cy, ang = W * .5, H * .79, -.33
        ux, uy, vx, vy = np.cos(ang), np.sin(ang), -np.sin(ang), np.cos(ang)
        P = lambda u, v: ((cx + ux * u + vx * v) * k, (cy + uy * u + vy * v) * k)
        dr.polygon([P(-L / 2, -T / 2 + 18), P(L / 2, -T / 2 + 18), P(L / 2, T / 2 + 18), P(-L / 2, T / 2 + 18)], fill=(0, 0, 0, 90))
        dr.polygon([P(-L / 2, -T / 2), P(L / 2, -T / 2), P(L / 2, T / 2), P(-L / 2, T / 2)], fill=(243, 236, 220, 255))
        for i in range(9):
            v = -T / 2 + 40 + i * (T - 80) / 8
            dr.line([P(-L / 2, v), P(L / 2, v)], fill=(18, 48, 42, 30 if i % 2 else 50), width=2 * k)
        for u in np.arange(-L / 2 + 20, L / 2, 36):
            for v in (-T / 2 + 14, T / 2 - 14):
                x, y = P(u, v)
                dr.ellipse([x - 4 * k, y - 4 * k, x + 4 * k, y + 4 * k], fill=(18, 48, 42, 200))
        notes = [0, 2, 4, 2, 5, 4, 2, 0, 1, 3, 5, 6, 4, 2, 3, 1, 0, 2, 4, 6, 5]
        for j, p in enumerate(notes):
            u, v = -L / 2 + 160 + j * 92, -T / 2 + 40 + p * (T - 80) / 8 * 1.33
            x, y = P(u, v)
            dr.ellipse([x - 15 * k, y - 15 * k, x + 15 * k, y + 15 * k], fill=(12, 34, 29, 255))
    layer = supersampled(strip)
    img = over(img, layer.filter(ImageFilter.GaussianBlur(.5)))
    return grain(img, 7, 15)


# ---------- 印 · 孔版: a two-colour riso print — pink halftone sun, blue hills, off register ----------
def riso():
    img = vgrad([(0, '#f7f5f0'), (1, '#f2efe8')])
    pink, blue = '#ff4fa3', '#2f5fb3'
    # halftone dots for the pink pass
    cellp = 15
    gx, gy = (XX * .95 + YY * .31) / cellp, (-XX * .31 + YY * .95) / cellp
    dot = np.sqrt((gx - np.round(gx)) ** 2 + (gy - np.round(gy)) ** 2)

    def halftone(level):
        return np.clip((level * .58 - dot) * 9, 0, 1)
    sun = np.clip((250 - np.sqrt((XX - W * .72) ** 2 + (YY - H * .8) ** 2)) / 3, 0, 1)   # setting behind the hills, clear of the clock
    img = multiply(img, pink, halftone(sun * .95) * .95)
    blob = np.clip((120 - np.sqrt((XX - W * .1) ** 2 + (YY - H * .035) ** 2)) / 3, 0, 1)
    img = multiply(img, pink, halftone(blob * .8) * .9)
    # blue pass: hills along the bottom and a small moon, printed 6px off register
    off = 6
    hills = np.zeros((H, W), np.float32)
    for base, amp, freq, ph in ((.84, 70, 2.2, .3), (.9, 50, 3.4, 1.7)):
        yline = H * base + amp * np.sin(XX / W * np.pi * freq + ph)
        hills = np.maximum(hills, np.clip((YY - yline + off) / 2, 0, 1))
    moon = np.clip((70 - np.sqrt((XX - W * .88 - off) ** 2 + (YY - H * .045) ** 2)) / 2, 0, 1)
    img = multiply(img, blue, np.clip(hills + moon, 0, 1) * .92)
    stripes = ((np.floor((XX + YY * .5) / 26) % 2) == 0) & (np.abs(YY - H * .63) < 26)
    img = multiply(img, blue, stripes.astype(np.float32) * .85)

    def marks(dr, k):
        for x, y in ((60, 60), (W - 60, 60), (60, H - 60), (W - 60, H - 60)):
            dr.ellipse([(x - 16) * k, (y - 16) * k, (x + 16) * k, (y + 16) * k], outline=(47, 95, 179, 170), width=2 * k)
            dr.line([((x - 30) * k, y * k), ((x + 30) * k, y * k)], fill=(47, 95, 179, 170), width=2 * k)
            dr.line([(x * k, (y - 30) * k), (x * k, (y + 30) * k)], fill=(47, 95, 179, 170), width=2 * k)
    img = over(img, supersampled(marks))
    r = np.random.default_rng(61)
    specks = (r.random((H, W)) > .985).astype(np.float32)
    img = mix(img, '#f6f4ef', specks * .9)                   # ink that did not take
    return grain(img, 8, 16)


if __name__ == '__main__':
    import sys
    only = sys.argv[1:]
    for name, fn in (('dawn', dawn), ('day', day), ('night', night), ('bloom', bloom), ('riso', riso)):
        if only and name not in only: continue
        save(fn(), f'pro-{name}')
        print('made pro-' + name)
