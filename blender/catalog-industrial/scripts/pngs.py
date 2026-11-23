# Tiny PNG + 5x7 nameplates / dials / IEC symbol cards (no external fonts).
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

FONT_5X7 = {
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "/": ["00001", "00010", "00100", "01000", "10000", "10000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "00100", "00100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def encode_png(width: int, height: int, pixels: bytes) -> bytes:
    raw = b"".join(b"\x00" + pixels[y * width * 4 : (y + 1) * width * 4] for y in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(raw, 9))
        + _png_chunk(b"IEND", b"")
    )


def fill(px, w, h, color):
    c = bytes(color)
    for i in range(w * h):
        px[i * 4 : i * 4 + 4] = c


def rect(px, w, h, x0, y0, x1, y1, color):
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    c = bytes(color)
    for y in range(max(0, y0), min(h, y1)):
        row = y * w
        for x in range(max(0, x0), min(w, x1)):
            o = (row + x) * 4
            px[o : o + 4] = c


def blit_text(px, w, h, text, ox, oy, scale, fg):
    gw, gap = 5, 1
    c = bytes(fg)
    for gi, ch in enumerate(text.upper()):
        g = FONT_5X7.get(ch, FONT_5X7["-"])
        for y, row in enumerate(g):
            for x, bit in enumerate(row):
                if bit != "1":
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        ix = ox + gi * (gw + gap) * scale + x * scale + dx
                        iy = oy + y * scale + dy
                        if 0 <= ix < w and 0 <= iy < h:
                            o = (iy * w + ix) * 4
                            px[o : o + 4] = c


def nameplate_png(text: str, sub: str = "DN100 PN16") -> bytes:
    w, h = 1024, 512
    px = bytearray(w * h * 4)
    fill(px, w, h, (196, 200, 204, 255))
    rect(px, w, h, 0, 0, w, 14, (32, 34, 36, 255))
    rect(px, w, h, 0, h - 14, w, h, (32, 34, 36, 255))
    rect(px, w, h, 0, 0, 14, h, (32, 34, 36, 255))
    rect(px, w, h, w - 14, 0, w, h, (32, 34, 36, 255))
    blit_text(px, w, h, text, 48, 80, 14, (18, 20, 22, 255))
    blit_text(px, w, h, sub, 48, 320, 8, (40, 44, 48, 255))
    return encode_png(w, h, bytes(px))


def dial_png() -> bytes:
    w = h = 512
    px = bytearray(w * h * 4)
    fill(px, w, h, (210, 210, 205, 255))
    cx, cy, r = w // 2, h // 2, 220
    black = (20, 20, 24, 255)
    for y in range(h):
        for x in range(w):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= r * r:
                o = (y * w + x) * 4
                px[o : o + 4] = bytes((248, 248, 242, 255))
    for i in range(17):
        t = i / 16
        ang = math.radians(225) + t * math.radians(270)
        c, s = math.cos(ang), math.sin(ang)
        inner = 0.72 if i % 2 == 0 else 0.82
        x0 = int(cx + inner * r * c)
        y0 = int(cy + inner * r * s)
        x1 = int(cx + 0.92 * r * c)
        y1 = int(cy + 0.92 * r * s)
        for k in range(20):
            xx = int(x0 + (x1 - x0) * k / 20)
            yy = int(y0 + (y1 - y0) * k / 20)
            if 0 <= xx < w and 0 <= yy < h:
                o = (yy * w + xx) * 4
                px[o : o + 4] = bytes(black)
    blit_text(px, w, h, "MPA", 210, 300, 4, black)
    blit_text(px, w, h, "0", 90, 360, 3, black)
    blit_text(px, w, h, "1.6", 360, 360, 3, black)
    rect(px, w, h, cx - 3, cy - 8, cx + 3, cy + 40, (160, 24, 24, 255))
    return encode_png(w, h, bytes(px))


def symbol_card(kind: str) -> bytes:
    w = h = 512
    px = bytearray(w * h * 4)
    fill(px, w, h, (36, 40, 46, 255))
    fg = (230, 232, 236, 255)
    gy = (80, 180, 70, 255)
    if kind == "cb":
        rect(px, w, h, 80, 80, 432, 96, fg)
        rect(px, w, h, 80, 416, 432, 432, fg)
        rect(px, w, h, 80, 80, 96, 432, fg)
        rect(px, w, h, 416, 80, 432, 432, fg)
        rect(px, w, h, 160, 240, 352, 264, fg)
        rect(px, w, h, 240, 160, 272, 352, fg)
        blit_text(px, w, h, "QF", 200, 40, 6, fg)
    elif kind == "m":
        for y in range(h):
            for x in range(w):
                dx, dy = x - 256, y - 268
                d = (dx * dx + dy * dy) ** 0.5
                if 150 < d < 172 or 70 < d < 86:
                    o = (y * w + x) * 4
                    px[o : o + 4] = bytes(fg)
        rect(px, w, h, 120, 120, 160, 148, fg)
        rect(px, w, h, 352, 120, 392, 148, fg)
        rect(px, w, h, 136, 80, 144, 120, fg)
        rect(px, w, h, 368, 80, 376, 120, fg)
        blit_text(px, w, h, "M", 232, 240, 8, fg)
    else:
        rect(px, w, h, 248, 40, 264, 280, gy)
        rect(px, w, h, 160, 280, 352, 296, gy)
        rect(px, w, h, 190, 320, 322, 336, gy)
        rect(px, w, h, 220, 360, 292, 376, gy)
        blit_text(px, w, h, "PE", 200, 420, 5, gy)
    return encode_png(w, h, bytes(px))


def chequer_png() -> bytes:
    w = h = 256
    px = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            c = (72, 76, 80, 255) if ((x + y) // 16) % 2 else (58, 62, 66, 255)
            o = (y * w + x) * 4
            px[o : o + 4] = bytes(c)
    return encode_png(w, h, bytes(px))


def write_all(tex_dir: Path) -> dict:
    tex_dir.mkdir(parents=True, exist_ok=True)
    mapping = {
        "plate_pipe": nameplate_png("PIPE", "DN100 PN16"),
        "plate_elbow": nameplate_png("ELBOW 90", "R=1.5D LR"),
        "plate_flange": nameplate_png("WN RF", "DN100 PN16"),
        "plate_hov": nameplate_png("HOV-101", "BALL VALVE"),
        "plate_mov": nameplate_png("MOV-101", "ELEC ACT"),
        "plate_ssv": nameplate_png("SSV-101", "SLAM SHUT"),
        "plate_pcv": nameplate_png("PCV-101", "REGULATOR"),
        "plate_pv": nameplate_png("PV-101", "RELIEF"),
        "plate_uf": nameplate_png("UF-101", "USM 2PATH"),
        "plate_fs": nameplate_png("FS-101", "BASKET"),
        "plate_tank": nameplate_png("V-101", "1.0 MPA"),
        "plate_skid": nameplate_png("HG-SKID", "METERING"),
        "plate_instr": nameplate_png("PI-101", "0-1.6 MPA"),
        "plate_text": nameplate_png("PV-101", "TAG"),
        "dial": dial_png(),
        "sym_cb": symbol_card("cb"),
        "sym_m": symbol_card("m"),
        "sym_gnd": symbol_card("gnd"),
        "chequer": chequer_png(),
    }
    out = {}
    for k, data in mapping.items():
        p = tex_dir / f"{k}.png"
        p.write_bytes(data)
        out[k] = p
    return out
