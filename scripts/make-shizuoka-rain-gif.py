#!/usr/bin/env python3
"""Still Shizuoka pixel landscape + very light rain → collections/shizuoka 1/background.gif"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    "/Users/junginhwan/.cursor/projects/Users-junginhwan-Project-junginhwan-photography/assets/shizuoka-pixel-landscape.png"
)
OUT = ROOT / "collections" / "shizuoka 1" / "background.gif"

WIDTH = 960
FRAMES = 12
DURATION_MS = 70
RAIN_COUNT = 72
ANGLE_DEG = 10
RNG = random.Random(7)


def slant_offset(dy: float, angle_rad: float) -> float:
    return dy * math.tan(angle_rad)


def main() -> None:
    base = Image.open(SRC).convert("RGB")
    base = ImageEnhance.Color(base).enhance(0.96)
    w, h = base.size
    nh = int(h * (WIDTH / w))
    base = base.resize((WIDTH, nh), Image.Resampling.NEAREST)
    w, h = base.size

    overlay = Image.new("RGB", (w, h), (40, 48, 58))
    base = Image.blend(base, overlay, 0.06)

    angle = math.radians(ANGLE_DEG)
    drops = []
    for _ in range(RAIN_COUNT):
        drops.append(
            {
                "x": RNG.uniform(-30, w + 30),
                "y": RNG.uniform(-h, h),
                "speed": RNG.uniform(10, 18),
                "length": RNG.uniform(6, 12),
                "thick": 1,
                "alpha": RNG.randint(28, 62),
            }
        )

    frames: list[Image.Image] = []
    for i in range(FRAMES):
        frame = base.copy()
        rain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(rain)
        for d in drops:
            y = (d["y"] + d["speed"] * i) % (h + 40) - 16
            dx = slant_offset(d["length"], angle)
            x0 = (d["x"] + slant_offset(d["speed"] * i, angle)) % (w + 60) - 30
            col = (200, 214, 228, d["alpha"])
            draw.line([(x0, y), (x0 + dx, y + d["length"])], fill=col, width=d["thick"])
        rain = rain.filter(ImageFilter.GaussianBlur(radius=0.25))
        composed = Image.alpha_composite(frame.convert("RGBA"), rain).convert(
            "P", palette=Image.Palette.ADAPTIVE, colors=96
        )
        frames.append(composed)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=DURATION_MS,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB, {FRAMES} frames)")


if __name__ == "__main__":
    main()
