#!/usr/bin/env python3
"""Crop/chroma Fuji land + train sprites into the collection folder as bg-* assets."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(
    "/Users/junginhwan/.cursor/projects/Users-junginhwan-Project-junginhwan-photography/assets"
)
OUT = ROOT / "collections" / "Mt.Fuji to Tokyo with BAHNO 1"

LAND_H = 720
BODY_H = 562
TRACK_H = LAND_H - BODY_H
LAND_BLEND = 88
LAND_TRIM = 0.08
BODY_KEEP = 0.78
LAND_PANELS = [
    ASSETS / "fuji-land-empty.png",
    ASSETS / "fuji-leg-town.png",
    ASSETS / "fuji-leg-suburb.png",
    ASSETS / "fuji-leg-tokyo.png",
]
# Drop leftover mountains on the left of later legs (Fuji only in the first panel).
LAND_LEFT_CROP = [0.0, 0.30, 0.06, 0.04]
LAND_JOINS: list[Path] = []
TRAIN_SRC = ASSETS / "fuji-train-pixel.png"
TRAIN_H = 168


def chroma_magenta(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r >= 180 and g <= 95 and b >= 180:
                px[x, y] = (0, 0, 0, 0)
            elif r >= 220 and b >= 220 and g <= 140:
                px[x, y] = (0, 0, 0, 0)
    return im


def trim(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    return im.crop(bbox)


def resize_h(im: Image.Image, height: int) -> Image.Image:
    nw = max(1, int(im.width * (height / im.height)))
    return im.convert("RGB").resize((nw, height), Image.Resampling.NEAREST)


def body_only(im: Image.Image) -> Image.Image:
    im = im.convert("RGB")
    cut = max(8, int(im.height * BODY_KEEP))
    return resize_h(im.crop((0, 0, im.width, cut)), BODY_H)


def make_track_band(width: int) -> Image.Image:
    """Original pixel-art track, tiled, with rails locked to one Y."""
    src = Image.open(LAND_PANELS[0]).convert("RGB")
    top = int(src.height * BODY_KEEP)
    raw = src.crop((0, top, src.width, src.height))
    tile = resize_h(raw, TRACK_H)
    tw, th = tile.size
    tpx = tile.load()

    def row_darkness(y: int) -> float:
        s = 0
        n = 0
        for x in range(0, tw, 3):
            r, g, b = tpx[x, y]
            s += r + g + b
            n += 1
        return s / max(n, 1)

    y0, y1 = int(th * 0.18), int(th * 0.78)
    ranked = sorted(range(y0, y1), key=row_darkness)
    rail_rows = sorted(set(ranked[:4]))

    wrap = 36
    band = Image.new("RGB", (width, th))
    px = band.load()
    for x in range(width):
        sx = x % tw
        if sx < wrap:
            t = sx / wrap
            u = 1.0 - t
            sx_end = tw - wrap + sx
            for y in range(th):
                r1, g1, b1 = tpx[sx_end, y]
                r2, g2, b2 = tpx[sx, y]
                px[x, y] = (
                    int(r1 * u + r2 * t),
                    int(g1 * u + g2 * t),
                    int(b1 * u + b2 * t),
                )
        else:
            for y in range(th):
                px[x, y] = tpx[sx, y]

    mid = tw // 2
    for y in rail_rows:
        sample = tpx[mid, y]
        for x in range(width):
            px[x, y] = sample
    return band, rail_rows


def cosine_stitch(parts: list[Image.Image], blend: int, height: int) -> Image.Image:
    total = sum(p.width for p in parts) - blend * (len(parts) - 1)
    out = Image.new("RGB", (total, height))
    x = 0
    for i, part in enumerate(parts):
        if i == 0:
            out.paste(part, (0, 0))
            x = part.width
            continue
        overlap = min(blend, part.width, x)
        x0 = x - overlap
        prev = out.crop((x0, 0, x0 + overlap, height))
        nxt = part.crop((0, 0, overlap, height))
        blended = prev.copy()
        prev_px = prev.load()
        nxt_px = nxt.load()
        mix_px = blended.load()
        for dx in range(overlap):
            base = (dx + 0.5) / overlap
            t = 0.5 - 0.5 * math.cos(math.pi * base)
            u = 1.0 - t
            for y in range(height):
                r1, g1, b1 = prev_px[dx, y]
                r2, g2, b2 = nxt_px[dx, y]
                mix_px[dx, y] = (
                    int(r1 * u + r2 * t),
                    int(g1 * u + g2 * t),
                    int(b1 * u + b2 * t),
                )
        out.paste(blended, (x0, 0))
        rest = part.crop((overlap, 0, part.width, height))
        out.paste(rest, (x, 0))
        x += part.width - overlap
    return out


def stitch_land() -> Image.Image:
    tiles = [body_only(Image.open(src)) for src in LAND_PANELS]
    joins = [body_only(Image.open(src)) for src in LAND_JOINS]

    parts: list[Image.Image] = []
    trim0 = int(tiles[0].width * LAND_TRIM)
    parts.append(tiles[0].crop((0, 0, tiles[0].width - trim0, BODY_H)))
    if joins:
        for i, join in enumerate(joins):
            parts.append(join)
            mid = tiles[i + 1]
            left = int(mid.width * LAND_TRIM)
            right = int(mid.width * LAND_TRIM) if i < len(joins) - 1 else 0
            parts.append(mid.crop((left, 0, mid.width - right, BODY_H)))
    else:
        for i, mid in enumerate(tiles[1:]):
            left_frac = LAND_LEFT_CROP[i + 1] if i + 1 < len(LAND_LEFT_CROP) else LAND_TRIM
            left = int(mid.width * left_frac)
            right = int(mid.width * LAND_TRIM) if i < len(tiles) - 2 else 0
            parts.append(mid.crop((left, 0, mid.width - right, BODY_H)))

    sky = cosine_stitch(parts, LAND_BLEND, BODY_H)
    tracks, rail_rows = make_track_band(sky.width)
    canvas = Image.new("RGB", (sky.width, LAND_H))
    canvas.paste(sky, (0, 0))
    canvas.paste(tracks, (0, BODY_H))
    # Blend only on the track strip so scenery pixels stay unchanged.
    rail_min = min(rail_rows) if rail_rows else 36
    fade = max(12, min(rail_min - 3, 48))
    px = canvas.load()
    sky_px = sky.load()
    tr_px = tracks.load()
    for x in range(sky.width):
        acc = [0, 0, 0]
        for k in range(1, 5):
            r, g, b = sky_px[x, BODY_H - k]
            acc[0] += r
            acc[1] += g
            acc[2] += b
        gr = (acc[0] // 4, acc[1] // 4, acc[2] // 4)
        for y in range(fade):
            t = 0.5 - 0.5 * math.cos(math.pi * ((y + 0.5) / fade))
            t = min(1.0, max(0.0, t + (((x * 13 + y * 7) % 5) - 2) * 0.018))
            u = 1.0 - t
            r2, g2, b2 = tr_px[x, y]
            px[x, BODY_H + y] = (
                int(gr[0] * u + r2 * t),
                int(gr[1] * u + g2 * t),
                int(gr[2] * u + b2 * t),
            )
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    land = stitch_land()
    land.save(OUT / "bg-fuji-land.png", optimize=True)

    train = chroma_magenta(Image.open(TRAIN_SRC))
    train = trim(train)
    tw, th = train.size
    train = train.crop((0, 0, tw, int(th * 0.9)))
    train = trim(train)
    tw, th = train.size
    nw = int(tw * (TRAIN_H / th))
    train = train.resize((nw, TRAIN_H), Image.Resampling.NEAREST)
    train.save(OUT / "bg-fuji-train.png", optimize=True)

    tw, th = train.size
    coach = train.crop((int(tw * 0.09), 0, int(tw * 0.70), th))
    coach.save(OUT / "bg-fuji-coach.png", optimize=True)

    print(f"land {land.size} -> {OUT / 'bg-fuji-land.png'}")
    print(f"train {train.size} -> {OUT / 'bg-fuji-train.png'}")
    print(f"coach {coach.size} -> {OUT / 'bg-fuji-coach.png'}")


if __name__ == "__main__":
    main()
