# PNG screenshots from build-theme-thumbs.cjs -> 240px-wide JPEGs for the 外观 gallery; 随光 is dawn | day | night in diagonal bands.
from PIL import Image, ImageDraw
import os, glob
d = os.path.join(os.path.dirname(__file__), '..', 'app', 'assets', 'themes')
W = 240
def small(im): return im.convert('RGB').resize((W, round(im.height * W / im.width)), Image.LANCZOS)
pics = {}
for f in glob.glob(os.path.join(d, '*.png')):
    k = os.path.basename(f)[:-4]; pics[k] = small(Image.open(f)); pics[k].save(os.path.join(d, k + '.jpg'), quality=80, optimize=True, progressive=True); os.remove(f)
for suf in ('', '-en'):
    a, b, c = pics['dawn' + suf], pics['day' + suf], pics['night' + suf]; H = a.height
    # 随光: the three themes it moves between, fanned out like cards on a sky that goes from morning to night
    bg = Image.new('RGB', (W, H)); px = ImageDraw.Draw(bg)
    top, bot = (226, 222, 246), (24, 26, 44)
    for y in range(H):
        t = y / (H - 1); px.line([(0, y), (W, y)], fill=tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    def card(img, scale, angle):
        w, h = round(W * scale), round(H * scale)
        im = img.resize((w, h), Image.LANCZOS).convert('RGBA')
        m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=round(16 * scale * 1.6), fill=255); im.putalpha(m)
        sh = Image.new('RGBA', (w + 30, h + 30), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([15, 19, w + 14, h + 18], radius=22, fill=(0, 0, 0, 70))
        from PIL import ImageFilter
        sh = sh.filter(ImageFilter.GaussianBlur(8)); sh.alpha_composite(im, (15, 15))
        return sh.rotate(angle, resample=Image.BICUBIC, expand=True)
    auto = bg.convert('RGBA')
    for img, dx, dy, ang in ((a, -14, 96, 11), (c, 120, 96, -11), (b, 46, 60, 0)):
        k = card(img, 0.56, ang); auto.alpha_composite(k, (dx, dy))
    auto.convert('RGB').save(os.path.join(d, 'auto' + suf + '.jpg'), quality=82, optimize=True, progressive=True)
    print(sorted(os.listdir(d)))
    # the Pro sheet's 随光 card is wide: the tops of the three home screens side by side
    wide = Image.new('RGB', (W * 3 + 16, 360), (18, 18, 22))
    for i, img in enumerate((a, b, c)): wide.paste(img.crop((0, 0, W, 360)), (i * (W + 8), 0))
    wide.save(os.path.join(d, 'auto-wide' + suf + '.jpg'), quality=80, optimize=True, progressive=True)
