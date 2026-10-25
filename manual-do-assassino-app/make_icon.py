"""Gera os ícones do app (adaga dentro de um anel), nos tamanhos que o Android pede."""
from pathlib import Path

from PIL import Image, ImageDraw

RES = Path(__file__).parent / "android" / "res"
BG = (14, 14, 16, 255)
RED = (200, 36, 59, 255)
GOLD = (224, 182, 90, 255)
BONE = (233, 230, 223, 255)

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def emblem(draw, cx, cy, r):
    """Desenha o emblema (mesmo da capa do app) com centro (cx, cy) e raio r."""
    u = r / 47.0  # o desenho original é um círculo de raio 47 num quadro 100x100

    def p(x, y):
        return (cx + (x - 50) * u, cy + (y - 50) * u)

    w = max(2, int(3.2 * u))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=RED, width=w)
    draw.polygon([p(50, 14), p(57, 58), p(50, 66), p(43, 58)], fill=BONE)
    draw.rounded_rectangle([p(33, 60), p(67, 66)], radius=3 * u, fill=GOLD)
    draw.rounded_rectangle([p(46, 66), p(54, 82)], radius=2 * u, fill=RED)
    draw.ellipse([p(46, 81), p(54, 89)], fill=GOLD)


def render(size, bg, scale):
    big = size * 4  # desenha grande e reduz para bordas suaves
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.22, fill=BG)
    emblem(d, big / 2, big / 2, big / 2 * scale)
    return img.resize((size, size), Image.LANCZOS)


def main():
    for dens, size in LEGACY.items():
        out = RES / f"mipmap-{dens}"
        out.mkdir(parents=True, exist_ok=True)
        render(size, True, 0.78).save(out / "ic_launcher.png")
    for dens, size in ADAPTIVE.items():
        # Só os 66dp centrais de 108dp aparecem com certeza: o emblema fica nessa área.
        render(size, False, 0.58).save(RES / f"mipmap-{dens}" / "ic_launcher_fg.png")
    render(512, True, 0.78).save(Path(__file__).parent / "icone-512.png")
    print("ícones gerados")


if __name__ == "__main__":
    main()
