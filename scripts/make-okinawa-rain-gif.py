#!/usr/bin/env python3
"""Still pixel-sea + animated rain → collections/okinawa/background.gif"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(
    "/Users/junginhwan/.cursor/projects/Users-junginhwan-Project-junginhwan-photography/assets/okinawa-tropical-sea-pixel.png"
)
OUT = ROOT / "collections" / "okinawa" / "background.gif"

WIDTH = 960
FRAMES = 14
DURATION_MS = 45
RAIN_COUNT = 420
ANGLE_DEG = 12
RNG = random.Random(42)


def slant_offset(dy: float, angle_rad: float) -> float:
    return dy * math.tan(angle_rad)


def main() -> None:
    base = Image.open(SRC).convert("RGB")
    base = ImageEnhance.Color(base).enhance(0.92)
    base = ImageEnhance.Contrast(base).enhance(1.05)
    w, h = base.size
    nh = int(h * (WIDTH / w))
    base = base.resize((WIDTH, nh), Image.Resampling.NEAREST)
    w, h = base.size

    # Slightly cooler/darker so rain reads on a webpage behind photos
    overlay = Image.new("RGB", (w, h), (18, 32, 48))
    base = Image.blend(base, overlay, 0.12)

    angle = math.radians(ANGLE_DEG)
    horizon = int(h * 0.58)

    drops = []
    for _ in range(RAIN_COUNT):
        x = RNG.uniform(-40, w + 40)
        y = RNG.uniform(-h, h)
        speed = RNG.uniform(18, 42)
        length = RNG.uniform(10, 26)
        thick = 1 if RNG.random() < 0.82 else 2
        alpha = RNG.randint(70, 175)
        drops.append(
            {
                "x": x,
                "y": y,
                "speed": speed,
                "length": length,
                "thick": thick,
                "alpha": alpha,
            }
        )

    splash_xs = [RNG.uniform(0, w) for _ in range(90)]

    frames: list[Image.Image] = []
    for i in range(FRAMES):
        frame = base.copy()
        rain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(rain)

        t = i / FRAMES
        for d in drops:
            y = (d["y"] + d["speed"] * i) % (h + 50) - 20
            dx = slant_offset(d["length"], angle)
            x0 = (d["x"] + slant_offset(d["speed"] * i, angle)) % (w + 80) - 40
            x1 = x0 + dx
            y1 = y + d["length"]
            col = (210, 230, 255, d["alpha"])
            draw.line([(x0, y), (x1, y1)], fill=col, width=d["thick"])

        splash = ImageDraw.Draw(rain)
        for si, sx in enumerate(splash_xs):
            phase = (i * 3 + si * 7) % FRAMES
            if phase < 3:
                sy = horizon + (si % 9) * 3
                a = 90 - phase * 28
                r = 1 + phase
                splash.ellipse(
                    [sx - r, sy - 1, sx + r, sy + 1],
                    fill=(200, 225, 255, max(20, a)),
                )

        rain = rain.filter(ImageFilter.GaussianBlur(radius=0.35))
        composed = Image.alpha_composite(frame.convert("RGBA"), rain).convert("P", palette=Image.Palette.ADAPTIVE, colors=96)
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
