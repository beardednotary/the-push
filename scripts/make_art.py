"""Build the share banner and icons from art/walkout.webp.

    python scripts/make_art.py

Writes Next.js file-convention assets into src/app/ (picked up automatically):
    opengraph-image.jpg, twitter-image.jpg   1200x630 share banner
    icon.jpg                                  512x512
    apple-icon.jpg                            180x180, opaque
    favicon.ico                               16/32/48
and art/preview.png, a contact sheet showing everything at real size.
Also src/share-assets/share-bg.jpg, the backdrop for per-result share cards.
"""
import math
import pathlib

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / "art"
APP = ROOT / "src/app"
SRC = Image.open(ART / "walkout.webp").convert("RGB")  # 1731x908

INK = (7, 8, 11)
WHITE = (255, 255, 255)
GOLD = (255, 212, 0)
RED = (232, 17, 45)
SKEW = math.tan(math.radians(14))

# The wrestler, in source pixels: head ~y118, waist ~y470, feet ~y850, centred on x~865.
FIGURE_X = 865


def font(name, size, weight=None):
    f = ImageFont.truetype(str(ART / "fonts" / name), size)
    if weight:
        f.set_variation_by_name(weight)
    return f


def plate(draw, x, y, text, fnt, fill, ink, pad_x=18, pad_y=6, baseline_nudge=0):
    """Broadcast plate: a -14deg parallelogram with straight text inside. Returns its right edge."""
    l, t, r, b = draw.textbbox((0, 0), text, font=fnt)
    w, h = r - l + pad_x * 2, b - t + pad_y * 2
    off = h * SKEW
    draw.polygon([(x + off, y), (x + w + off, y), (x + w, y + h), (x, y + h)], fill=fill)
    draw.text((x + pad_x + off / 2 - l, y + pad_y - t + baseline_nudge), text, font=fnt, fill=ink)
    return x + w + off


def banner():
    im = SRC.resize((1200, 630), Image.LANCZOS)
    # fade the left side toward black so the type sits on the curtain, not the crowd
    fade = Image.new("L", (1200, 630), 0)
    fd = ImageDraw.Draw(fade)
    for x0 in range(560):
        fd.line([(x0, 0), (x0, 630)], fill=int(205 * (1 - x0 / 560) ** 1.6))
    im = Image.composite(Image.new("RGB", im.size, INK), im, fade)
    d = ImageDraw.Draw(im)
    x, y = 46, 150
    plate(d, x, y, "THE PUSH", font("Teko.ttf", 104, b"Bold"), WHITE, INK, pad_x=20, pad_y=4)
    y2 = y + 132
    plate(d, x, y2, "DAILY WRESTLING TRIVIA", font("SairaCondensed-ExtraBold.ttf", 30), GOLD, INK, pad_x=14, pad_y=8)
    tag = font("SairaCondensed-Bold.ttf", 27)
    for i, line in enumerate(["5 QUESTIONS · 15 SECONDS EACH", "THE IMMACULATE RING", "NEW CARD EVERY NIGHT"]):
        d.text((x + 4, y2 + 66 + i * 36), line, font=tag, fill=(230, 233, 240))
    return im


def share_bg():
    """Backdrop for per-result share cards: the walk-out pushed right, the left faded to black for the score."""
    canvas = Image.new("RGB", (1200, 630), INK)
    canvas.paste(SRC.resize((1201, 630), Image.LANCZOS), (300, 0))
    fade = Image.new("L", canvas.size, 0)
    fd = ImageDraw.Draw(fade)
    for x0 in range(300, 760):
        fd.line([(x0, 0), (x0, 630)], fill=int(255 * (1 - (x0 - 300) / 460) ** 1.4))
    fd.rectangle((0, 0, 300, 630), fill=255)
    canvas = Image.composite(Image.new("RGB", canvas.size, INK), canvas, fade)
    return ImageEnhance.Brightness(canvas).enhance(0.9)


def square(cx, top, side, contrast=1.0, size=512):
    box = (cx - side // 2, top, cx + side // 2, top + side)
    sq = SRC.crop(box)
    if contrast != 1.0:
        sq = ImageEnhance.Contrast(sq).enhance(contrast)
    return sq.resize((size, size), Image.LANCZOS)


def main():
    b = banner()
    b.save(APP / "opengraph-image.jpg", quality=86, optimize=True, progressive=True)
    b.save(APP / "twitter-image.jpg", quality=86, optimize=True, progressive=True)
    share_bg().save(ROOT / "src/share-assets/share-bg.jpg", quality=84, optimize=True, progressive=True)

    big = square(FIGURE_X, 96, 780)                   # whole walk-out, curtains just at the edges
    small = square(FIGURE_X, 104, 470, contrast=1.35)  # head to hips: a shape that survives 16-32px
    big.save(APP / "icon.jpg", quality=88, optimize=True)
    big.resize((180, 180), Image.LANCZOS).save(APP / "apple-icon.jpg", quality=90, optimize=True)
    small.save(APP / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    # home-screen app icons for the web manifest (Android / installed PWA)
    for px in (192, 512):
        big.resize((px, px), Image.LANCZOS).save(ROOT / "public" / f"icon-{px}.png", optimize=True)

    # contact sheet: everything at real size on the site's background
    sheet = Image.new("RGB", (1260, 1040), INK)
    d = ImageDraw.Draw(sheet)
    label = font("SairaCondensed-Bold.ttf", 20)
    sheet.paste(b, (30, 40))
    d.text((30, 10), "Share banner 1200x630", font=label, fill=WHITE)
    yy = 700
    d.text((30, yy - 30), "icon 512 (shown at 256)", font=label, fill=WHITE)
    sheet.paste(big.resize((256, 256), Image.LANCZOS), (30, yy))
    d.text((320, yy - 30), "apple-icon 180", font=label, fill=WHITE)
    sheet.paste(big.resize((180, 180), Image.LANCZOS), (320, yy))
    d.text((540, yy - 30), "favicon 48 / 32 / 16 (real size)", font=label, fill=WHITE)
    for i, s in enumerate((48, 32, 16)):
        sheet.paste(small.resize((s, s), Image.LANCZOS), (540 + i * 70, yy))
    d.text((540, yy + 80), "favicon 32 / 16 blown up 6x", font=label, fill=WHITE)
    for i, s in enumerate((32, 16)):
        sheet.paste(small.resize((s, s), Image.LANCZOS).resize((s * 6, s * 6), Image.NEAREST), (540 + i * 210, yy + 110))
    # a fake browser tab, light and dark
    for i, (bg, fg) in enumerate([((222, 225, 230), (30, 30, 30)), ((53, 54, 58), (232, 234, 237))]):
        tx, ty = 990, yy + i * 60
        d.rounded_rectangle((tx, ty, tx + 240, ty + 40), radius=8, fill=bg)
        sheet.paste(small.resize((16, 16), Image.LANCZOS), (tx + 12, ty + 12))
        d.text((tx + 36, ty + 9), "The Push: daily wrest...", font=font("SairaCondensed-Bold.ttf", 17), fill=fg)
    sheet.save(ART / "preview.png")
    print("wrote", [p.name for p in APP.glob("*") if p.suffix in (".jpg", ".ico")], "and art/preview.png")


if __name__ == "__main__":
    main()
