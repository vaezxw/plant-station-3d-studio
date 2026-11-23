#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Typical energy-station catalog meshes → GLB (no site drawings).

glTF Y-up, metres, origin at footprint bottom-centre.
Run:  python E:\\energy-station-blender\\scripts\\build_catalog.py
"""
from __future__ import annotations

import json
import math
import os
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / "export"
CATALOG = EXPORT / "catalog"
DOCS = ROOT / "docs"
PUBLIC_MODELS = Path(r"E:\hengguang-plant-dashboard\public\models")
PUBLIC_PLANT = Path(r"E:\hengguang-plant-dashboard\public\assets\plant")

MODELING = "典型场景建模"
DISCLAIMER = (
    "无现场总平面/断面图纸。轮廓与尺寸取户外储能电站常见柜式/油浸变量级，"
    "不得作为施工图。"
)

# ---------------------------------------------------------------------------
# Tiny PNG + 5x7 font (nameplates)
# ---------------------------------------------------------------------------

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
    "/": ["00001", "00010", "00100", "01000", "10000", "10000", "00000"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
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


def nameplate_png(text: str, fg=(240, 244, 248, 255), bg=(28, 36, 48, 255), scale=4) -> bytes:
    text = text.upper()
    glyphs = []
    for ch in text:
        glyphs.append(FONT_5X7.get(ch, FONT_5X7["-"]))
    pad = 2
    gap = 1
    gw, gh = 5, 7
    width = pad * 2 + len(glyphs) * gw + gap * max(0, len(glyphs) - 1)
    height = pad * 2 + gh
    px = bytearray(width * height * 4)
    for i in range(width * height):
        px[i * 4 : i * 4 + 4] = bytes(bg)
    for gi, g in enumerate(glyphs):
        ox = pad + gi * (gw + gap)
        for y, row in enumerate(g):
            for x, bit in enumerate(row):
                if bit != "1":
                    continue
                ix = ox + x
                iy = pad + y
                o = (iy * width + ix) * 4
                px[o : o + 4] = bytes(fg)
    if scale <= 1:
        return encode_png(width, height, bytes(px))
    sw, sh = width * scale, height * scale
    scaled = bytearray(sw * sh * 4)
    for y in range(sh):
        src_y = y // scale
        for x in range(sw):
            src_x = x // scale
            s = (src_y * width + src_x) * 4
            d = (y * sw + x) * 4
            scaled[d : d + 4] = px[s : s + 4]
    return encode_png(sw, sh, bytes(scaled))


def hmi_png() -> bytes:
    """Industrial HMI: title bar, kW readout, bar graph, status pills."""
    w, h = 160, 120
    px = bytearray(w * h * 4)
    bg, bezel = (6, 14, 24, 255), (12, 22, 34, 255)
    title, teal, ok, dim, bar = (
        (18, 78, 128, 255),
        (36, 196, 214, 255),
        (42, 176, 96, 255),
        (28, 48, 68, 255),
        (48, 168, 120, 255),
    )
    for y in range(h):
        for x in range(w):
            o = (y * w + x) * 4
            px[o : o + 4] = bytes(bezel if x < 3 or x >= w - 3 or y < 3 or y >= h - 3 else bg)
            if 6 <= x <= 154 and 6 <= y <= 22:
                px[o : o + 4] = bytes(title)
            elif 10 <= x <= 78 and 30 <= y <= 58:
                px[o : o + 4] = bytes(ok if y > 44 else dim)
            elif 86 <= x <= 150 and 30 <= y <= 58:
                px[o : o + 4] = bytes(dim)
            elif 10 <= x <= 150 and 66 <= y <= 110:
                col = (x - 10) // 14
                fill_h = 8 + (col * 5) % 36
                if y >= 110 - fill_h and (x - 10) % 14 < 10:
                    px[o : o + 4] = bytes(teal if col % 2 == 0 else bar)
    return encode_png(w, h, bytes(px))


def hazard_png(width=256, height=64, stripe=18) -> bytes:
    """Yellow-black 45° chevron used on outdoor cabinet kick plates."""
    ylw, blk = (234, 186, 24, 255), (16, 16, 16, 255)
    px = bytearray(width * height * 4)
    for y in range(height):
        for x in range(width):
            on = ((x + y) // stripe) % 2 == 0
            o = (y * width + x) * 4
            px[o : o + 4] = bytes(ylw if on else blk)
    return encode_png(width, height, bytes(px))


def warning_png() -> bytes:
    w = h = 64
    px = bytearray(w * h * 4)
    ylw, blk, empty = (234, 186, 24, 255), (16, 16, 16, 255), (0, 0, 0, 0)
    cx, cy = 31.5, 38.0
    for y in range(h):
        for x in range(w):
            o = (y * w + x) * 4
            # upward triangle
            rel = (h - 8 - y) / 48.0
            half = rel * 26.0
            dx = abs(x - cx)
            if y < 8 or y > 60 or dx > half + 2:
                px[o : o + 4] = bytes(empty)
            elif dx > half - 3 or y > 56:
                px[o : o + 4] = bytes(blk)
            else:
                px[o : o + 4] = bytes(ylw)
            # bang
            if 28 <= x <= 35 and 22 <= y <= 42:
                px[o : o + 4] = bytes(blk)
            if 28 <= x <= 35 and 46 <= y <= 52:
                px[o : o + 4] = bytes(blk)
    return encode_png(w, h, bytes(px))


# ---------------------------------------------------------------------------
# glTF 2.0 / GLB writer  (Y-up, metres)
# ---------------------------------------------------------------------------

class GltfBuilder:
    def __init__(self):
        self.bin = bytearray()
        self.buffer_views = []
        self.accessors = []
        self.images = []
        self.textures = []
        self.materials = []
        self.meshes = []
        self.nodes = []
        self.mat_key = {}
        self.tex_key = {}

    def _align(self, n=4):
        while len(self.bin) % n:
            self.bin.append(0)

    def _view(self, data: bytes, target=None) -> int:
        self._align(4)
        offset = len(self.bin)
        self.bin.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            view["target"] = target
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1

    def _accessor(self, view, component_type, count, type_, min_=None, max_=None, stride=None):
        acc = {
            "bufferView": view,
            "componentType": component_type,
            "count": count,
            "type": type_,
        }
        if min_ is not None:
            acc["min"] = min_
        if max_ is not None:
            acc["max"] = max_
        if stride:
            self.buffer_views[view]["byteStride"] = stride
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def add_png_texture(self, name: str, png: bytes) -> int:
        if name in self.tex_key:
            return self.tex_key[name]
        view = self._view(png)
        img_i = len(self.images)
        self.images.append({"name": name, "mimeType": "image/png", "bufferView": view})
        tex_i = len(self.textures)
        self.textures.append({"name": name, "source": img_i})
        self.tex_key[name] = tex_i
        return tex_i

    def material(
        self,
        name,
        color,
        metallic=0.15,
        roughness=0.45,
        emissive=(0.0, 0.0, 0.0),
        texture=None,
        alpha_mode=None,
        double_sided=False,
    ) -> int:
        key = (name, tuple(color), metallic, roughness, tuple(emissive), texture, alpha_mode, double_sided)
        if key in self.mat_key:
            return self.mat_key[key]
        pbr = {
            "baseColorFactor": [float(color[0]), float(color[1]), float(color[2]), 1.0],
            "metallicFactor": float(metallic),
            "roughnessFactor": float(roughness),
        }
        if texture is not None:
            pbr["baseColorTexture"] = {"index": texture}
            pbr["baseColorFactor"] = [1, 1, 1, 1]
        mat = {
            "name": name,
            "pbrMetallicRoughness": pbr,
            "emissiveFactor": [float(emissive[0]), float(emissive[1]), float(emissive[2])],
        }
        if alpha_mode:
            mat["alphaMode"] = alpha_mode
        if double_sided:
            mat["doubleSided"] = True
        idx = len(self.materials)
        self.materials.append(mat)
        self.mat_key[key] = idx
        return idx

    def add_mesh(self, positions, normals, uvs, indices, mat_i) -> int:
        nvert = len(positions) // 3
        pos_b = struct.pack("<%sf" % len(positions), *positions)
        nrm_b = struct.pack("<%sf" % len(normals), *normals)
        uv_b = struct.pack("<%sf" % len(uvs), *uvs) if uvs else b""
        if nvert > 65535:
            idx_b = struct.pack("<%sI" % len(indices), *indices)
            idx_type = 5125
        else:
            idx_b = struct.pack("<%sH" % len(indices), *indices)
            idx_type = 5123
            if len(idx_b) % 4:
                idx_b += b"\x00\x00"

        pos_view = self._view(pos_b, 34962)
        nrm_view = self._view(nrm_b, 34962)
        idx_view = self._view(idx_b, 34963)

        xs = positions[0::3]
        ys = positions[1::3]
        zs = positions[2::3]
        pos_acc = self._accessor(
            pos_view, 5126, nvert, "VEC3",
            min_=[min(xs), min(ys), min(zs)],
            max_=[max(xs), max(ys), max(zs)],
        )
        nrm_acc = self._accessor(nrm_view, 5126, nvert, "VEC3")
        idx_acc = self._accessor(idx_view, idx_type, len(indices), "SCALAR")
        attrs = {"POSITION": pos_acc, "NORMAL": nrm_acc}
        if uvs:
            uv_view = self._view(uv_b, 34962)
            attrs["TEXCOORD_0"] = self._accessor(uv_view, 5126, nvert, "VEC2")
        mesh = {
            "primitives": [{
                "attributes": attrs,
                "indices": idx_acc,
                "material": mat_i,
                "mode": 4,
            }]
        }
        self.meshes.append(mesh)
        return len(self.meshes) - 1

    def node(self, name, parent=None, t=(0.0, 0.0, 0.0), r=None, extras=None, mesh=None) -> int:
        idx = len(self.nodes)
        n = {"name": name}
        if t != (0.0, 0.0, 0.0):
            n["translation"] = [float(t[0]), float(t[1]), float(t[2])]
        if r is not None:
            n["rotation"] = [float(r[0]), float(r[1]), float(r[2]), float(r[3])]
        if extras:
            n["extras"] = extras
        if mesh is not None:
            n["mesh"] = mesh
        self.nodes.append(n)
        if parent is not None:
            self.nodes[parent].setdefault("children", []).append(idx)
        return idx

    def to_glb(self, scene_name="Scene") -> bytes:
        scene = {"name": scene_name, "nodes": [i for i, n in enumerate(self.nodes) if True]}
        # Only root nodes (not referenced as children)
        children = set()
        for n in self.nodes:
            for c in n.get("children", []):
                children.add(c)
        roots = [i for i in range(len(self.nodes)) if i not in children]
        doc = {
            "asset": {
                "version": "2.0",
                "generator": "energy-station-blender/build_catalog.py",
                "extras": {
                    "modelingClass": MODELING,
                    "disclaimer": DISCLAIMER,
                    "units": "m",
                    "up": "Y",
                },
            },
            "scene": 0,
            "scenes": [{"name": scene_name, "nodes": roots}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.buffer_views,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        if self.images:
            doc["images"] = self.images
        if self.textures:
            doc["textures"] = self.textures
        json_bytes = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        while len(json_bytes) % 4:
            json_bytes += b" "
        bin_bytes = bytes(self.bin)
        while len(bin_bytes) % 4:
            bin_bytes += b"\x00"
        total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        header = struct.pack("<4sII", b"glTF", 2, total)
        json_chunk = struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
        bin_chunk = struct.pack("<I4s", len(bin_bytes), b"BIN\x00") + bin_bytes
        return header + json_chunk + bin_chunk


# ---------------------------------------------------------------------------
# Geometry helpers (local, Y-up, box centred)
# ---------------------------------------------------------------------------

def _tri_box(sx, sy, sz):
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    faces = [
        ([(hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz), (hx, -hy, hz)], (1, 0, 0)),
        ([(-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz), (-hx, -hy, -hz)], (-1, 0, 0)),
        ([(-hx, hy, -hz), (-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz)], (0, 1, 0)),
        ([(-hx, -hy, hz), (-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz)], (0, -1, 0)),
        ([(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)], (0, 0, 1)),
        ([(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)], (0, 0, -1)),
    ]
    pos, nrm, uv, idx = [], [], [], []
    base = 0
    for corners, n in faces:
        for i, (x, y, z) in enumerate(corners):
            pos.extend((x, y, z))
            nrm.extend(n)
            uv.extend((0.0 if i in (0, 3) else 1.0, 0.0 if i in (0, 1) else 1.0))
        idx.extend((base, base + 1, base + 2, base, base + 2, base + 3))
        base += 4
    return pos, nrm, uv, idx


def _tri_cyl(radius, height, segments=20, y_centered=True):
    pos, nrm, uv, idx = [], [], [], []
    y0 = -height * 0.5 if y_centered else 0.0
    y1 = y0 + height

    def ring(y, ny):
        start = len(pos) // 3
        for i in range(segments):
            a = 2 * math.pi * i / segments
            x, z = radius * math.cos(a), radius * math.sin(a)
            pos.extend((x, y, z))
            if ny == 0:
                nrm.extend((math.cos(a), 0.0, math.sin(a)))
            else:
                nrm.extend((0.0, ny, 0.0))
            uv.extend((i / segments, 0.0 if y == y0 else 1.0))
        return start

    s0 = ring(y0, 0.0)
    s1 = ring(y1, 0.0)
    for i in range(segments):
        j = (i + 1) % segments
        idx.extend((s0 + i, s1 + i, s1 + j, s0 + i, s1 + j, s0 + j))
    # caps
    for y, ny in ((y0, -1.0), (y1, 1.0)):
        c = len(pos) // 3
        pos.extend((0.0, y, 0.0))
        nrm.extend((0.0, ny, 0.0))
        uv.extend((0.5, 0.5))
        rs = len(pos) // 3
        for i in range(segments):
            a = 2 * math.pi * i / segments
            pos.extend((radius * math.cos(a), y, radius * math.sin(a)))
            nrm.extend((0.0, ny, 0.0))
            uv.extend((0.5 + 0.5 * math.cos(a), 0.5 + 0.5 * math.sin(a)))
        for i in range(segments):
            j = (i + 1) % segments
            if ny > 0:
                idx.extend((c, rs + i, rs + j))
            else:
                idx.extend((c, rs + j, rs + i))
    return pos, nrm, uv, idx


def _tri_cone(r0, r1, height, segments=16):
    pos, nrm, uv, idx = [], [], [], []
    y0, y1 = -height * 0.5, height * 0.5
    for i in range(segments):
        a0 = 2 * math.pi * i / segments
        a1 = 2 * math.pi * (i + 1) / segments
        p00 = (r0 * math.cos(a0), y0, r0 * math.sin(a0))
        p01 = (r0 * math.cos(a1), y0, r0 * math.sin(a1))
        p10 = (r1 * math.cos(a0), y1, r1 * math.sin(a0))
        p11 = (r1 * math.cos(a1), y1, r1 * math.sin(a1))
        vx, vy, vz = p10[0] - p00[0], p10[1] - p00[1], p10[2] - p00[2]
        wx, wy, wz = p01[0] - p00[0], p01[1] - p00[1], p01[2] - p00[2]
        nx, ny, nz = vy * wz - vz * wy, vz * wx - vx * wz, vx * wy - vy * wx
        ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        n = (nx / ln, ny / ln, nz / ln)
        base = len(pos) // 3
        for p in (p00, p10, p11, p01):
            pos.extend(p)
            nrm.extend(n)
            uv.extend((0, 0))
        idx.extend((base, base + 1, base + 2, base, base + 2, base + 3))
    return pos, nrm, uv, idx


def _tri_quad(w, h):
    """Plate in XY, facing +Z, centred. glTF UV origin is bottom-left."""
    hx, hy = w * 0.5, h * 0.5
    pos = [-hx, -hy, 0, hx, -hy, 0, hx, hy, 0, -hx, hy, 0]
    nrm = [0, 0, 1] * 4
    uv = [0, 0, 1, 0, 1, 1, 0, 1]
    idx = [0, 1, 2, 0, 2, 3]
    return pos, nrm, uv, idx


def _tri_hood(w, depth, thick, drop):
    """Rain hood: flat top with a front drip slope, centred, front = +Z."""
    hx, hz = w * 0.5, depth * 0.5
    y0, y1 = -thick * 0.5, thick * 0.5
    yf = y0 - drop
    # top (y+)
    top = [(-hx, y1, -hz), (hx, y1, -hz), (hx, y1, hz), (-hx, y1, hz)]
    # underside back half
    under = [(-hx, y0, -hz), (-hx, y0, hz * 0.15), (hx, y0, hz * 0.15), (hx, y0, -hz)]
    # front slope (faces roughly +Y/+Z)
    slope = [(-hx, y0, hz * 0.15), (-hx, yf, hz), (hx, yf, hz), (hx, y0, hz * 0.15)]
    # drip lip front
    lip = [(-hx, yf, hz), (-hx, yf - thick * 0.6, hz), (hx, yf - thick * 0.6, hz), (hx, yf, hz)]
    faces = [
        (top, (0, 1, 0)),
        (under, (0, -1, 0)),
        (slope, (0, 0.45, 0.89)),
        (lip, (0, 0, 1)),
        ([(-hx, y1, -hz), (-hx, y0, -hz), (hx, y0, -hz), (hx, y1, -hz)], (0, 0, -1)),
        ([(-hx, y1, -hz), (-hx, y1, hz), (-hx, yf, hz), (-hx, y0, -hz)], (-1, 0, 0)),
        ([(hx, y1, -hz), (hx, y0, -hz), (hx, yf, hz), (hx, y1, hz)], (1, 0, 0)),
    ]
    pos, nrm, uv, idx = [], [], [], []
    base = 0
    for corners, n in faces:
        ln = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
        nn = (n[0] / ln, n[1] / ln, n[2] / ln)
        for i, p in enumerate(corners):
            pos.extend(p)
            nrm.extend(nn)
            uv.extend((0.0 if i in (0, 3) else 1.0, 0.0 if i in (0, 1) else 1.0))
        idx.extend((base, base + 1, base + 2, base, base + 2, base + 3))
        base += 4
    return pos, nrm, uv, idx


# ---------------------------------------------------------------------------
# Scene-graph helpers
# ---------------------------------------------------------------------------

class Kit:
    def __init__(self, g: GltfBuilder):
        self.g = g

    def extras(self, entity_id, entity_type, **more):
        data = {
            "entityId": entity_id,
            "entityType": entity_type,
            "interactive": True,
            "monitorOnly": True,
            "writable": False,
            "modelingClass": MODELING,
        }
        data.update(more)
        return data

    def box(self, parent, name, size, center, color, metallic=0.18, roughness=0.42, emissive=(0, 0, 0)):
        mat = self.g.material(name + "_mat", color, metallic, roughness, emissive)
        mesh = self.g.add_mesh(*_tri_box(*size), mat)
        return self.g.node(name, parent, t=center, mesh=mesh)

    def box_y0(self, parent, name, size, xy_z, color, **kw):
        """size=(sx,sy,sz); xy_z=(x, y_bottom, z) of footprint centre."""
        sx, sy, sz = size
        x, y0, z = xy_z
        return self.box(parent, name, size, (x, y0 + sy * 0.5, z), color, **kw)

    def cyl(self, parent, name, radius, height, center, color, segments=18, metallic=0.35, roughness=0.35, r=None, emissive=(0, 0, 0)):
        mat = self.g.material(name + "_mat", color, metallic, roughness, emissive)
        mesh = self.g.add_mesh(*_tri_cyl(radius, height, segments), mat)
        return self.g.node(name, parent, t=center, r=r, mesh=mesh)

    def cone(self, parent, name, r0, r1, height, center, color, metallic=0.05, roughness=0.55):
        mat = self.g.material(name + "_mat", color, metallic, roughness)
        mesh = self.g.add_mesh(*_tri_cone(r0, r1, height), mat)
        return self.g.node(name, parent, t=center, mesh=mesh)

    def plate(self, parent, name, w, h, center, png_name, png_bytes, alpha_mode=None, double_sided=True):
        tex = self.g.add_png_texture(png_name, png_bytes)
        mat = self.g.material(
            name + "_mat",
            (1, 1, 1),
            0.0,
            0.42,
            texture=tex,
            alpha_mode=alpha_mode,
            double_sided=double_sided,
        )
        mesh = self.g.add_mesh(*_tri_quad(w, h), mat)
        return self.g.node(name, parent, t=center, mesh=mesh)

    def box_tex(self, parent, name, size, center, png_name, png_bytes, metallic=0.08, roughness=0.48):
        tex = self.g.add_png_texture(png_name, png_bytes)
        mat = self.g.material(name + "_mat", (1, 1, 1), metallic, roughness, texture=tex)
        mesh = self.g.add_mesh(*_tri_box(*size), mat)
        return self.g.node(name, parent, t=center, mesh=mesh)

    def hood(self, parent, name, w, depth, thick, drop, center, color):
        mat = self.g.material(name + "_mat", color, 0.45, 0.28)
        mesh = self.g.add_mesh(*_tri_hood(w, depth, thick, drop), mat)
        return self.g.node(name, parent, t=center, mesh=mesh)

    def louvers(self, parent, prefix, x, y0, z, w, h, d, count, color, along="z"):
        """Horizontal slats. along=z means stacked in Y on a side at ±x or ±z."""
        gap = h / count
        slat_h = gap * 0.45
        for i in range(count):
            cy = y0 + gap * (i + 0.5)
            self.box(parent, f"{prefix}_{i}", (w, slat_h, d), (x, cy, z), color, metallic=0.42, roughness=0.32)


# Colours (linear-ish sRGB)
C_CONCRETE = (0.55, 0.54, 0.50)
C_ASPHALT = (0.09, 0.09, 0.10)
C_GRASS = (0.27, 0.34, 0.22)
C_FENCE = (0.42, 0.45, 0.47)
C_PCS = (0.82, 0.84, 0.87)
C_PCS_DARK = (0.18, 0.20, 0.23)
C_PCS_BLUE = (0.10, 0.34, 0.62)
C_METAL = (0.35, 0.37, 0.39)
C_DARK = (0.12, 0.13, 0.14)
C_YELLOW = (0.92, 0.72, 0.12)
C_BLACK = (0.05, 0.05, 0.05)
C_XFMR = (0.14, 0.34, 0.20)
C_XFMR_DK = (0.08, 0.20, 0.12)
C_CERAMIC = (0.48, 0.30, 0.16)
C_BESS = (0.16, 0.18, 0.22)
C_BESS_TOP = (0.55, 0.58, 0.60)
C_CYAN = (0.12, 0.55, 0.58)
C_LOAD = (0.76, 0.74, 0.68)
C_ROOF = (0.22, 0.25, 0.28)
C_WINDOW = (0.15, 0.28, 0.38)
C_LED_G = (0.15, 0.85, 0.35)
C_LED_R = (0.85, 0.18, 0.12)


def build_pcs(g: GltfBuilder, entity_id="ES-PCS-02", pair_group="ES-PAIR-B", peers=None) -> int:
    """Outdoor PCS cabinet (typical scene). Front = +Z. Origin = pad bottom-centre."""
    k = Kit(g)
    peers = peers or ["ES-BESS-B1", "ES-BESS-B2", "ES-BESS-B3", "ES-BESS-B4"]
    tag = entity_id.replace("ES-", "")
    display = f"{tag} 储能变流器"
    qx90 = (0.70710678, 0.0, 0.0, 0.70710678)  # Y-up cyl → X-axis
    root = g.node(
        entity_id,
        extras=k.extras(
            entity_id,
            "pcs",
            catalogKind="PCS",
            displayName=display,
            pairGroup=pair_group,
            pairRole="pcs",
            pairedEntityIds=list(peers),
        ),
    )
    # concrete pad + painted skid with forklift pockets
    k.box_y0(root, "pad", (1.62, 0.10, 1.18), (0, 0, 0), C_CONCRETE, metallic=0.02, roughness=0.82)
    k.box_y0(root, "skid", (1.36, 0.12, 0.96), (0, 0.10, 0), C_PCS_DARK, metallic=0.28, roughness=0.42)
    k.box(root, "pocket_l", (0.18, 0.08, 0.98), (-0.38, 0.16, 0.0), C_DARK, metallic=0.1, roughness=0.6)
    k.box(root, "pocket_r", (0.18, 0.08, 0.98), (0.38, 0.16, 0.0), C_DARK, metallic=0.1, roughness=0.6)
    # yellow-black chevron kick plate wrapping the skid
    hz = hazard_png()
    k.box_tex(root, "hazard_f", (1.36, 0.09, 0.03), (0.0, 0.265, 0.495), "hazard", hz)
    k.box_tex(root, "hazard_b", (1.36, 0.09, 0.03), (0.0, 0.265, -0.495), "hazard", hz)
    k.box_tex(root, "hazard_l", (0.03, 0.09, 0.96), (-0.69, 0.265, 0.0), "hazard", hz)
    k.box_tex(root, "hazard_r", (0.03, 0.09, 0.96), (0.69, 0.265, 0.0), "hazard", hz)
    # powder-coat body + corner posts
    k.box_y0(root, "body", (1.24, 1.74, 0.82), (0, 0.30, 0), C_PCS, metallic=0.10, roughness=0.38)
    k.box(root, "post_fl", (0.05, 1.74, 0.05), (-0.62, 1.17, 0.40), C_PCS_DARK, metallic=0.25, roughness=0.35)
    k.box(root, "post_fr", (0.05, 1.74, 0.05), (0.62, 1.17, 0.40), C_PCS_DARK, metallic=0.25, roughness=0.35)
    k.box(root, "post_bl", (0.05, 1.74, 0.05), (-0.62, 1.17, -0.40), C_PCS_DARK, metallic=0.25, roughness=0.35)
    k.box(root, "post_br", (0.05, 1.74, 0.05), (0.62, 1.17, -0.40), C_PCS_DARK, metallic=0.25, roughness=0.35)
    # dark gasket / door frame
    k.box(root, "gasket", (1.16, 1.62, 0.02), (0.0, 1.14, 0.422), C_DARK, metallic=0.05, roughness=0.5)
    # dual doors (front +Z)
    k.box(root, "door_l", (0.55, 1.56, 0.035), (-0.29, 1.14, 0.445), C_PCS, metallic=0.11, roughness=0.34)
    k.box(root, "door_r", (0.55, 1.56, 0.035), (0.29, 1.14, 0.445), C_PCS, metallic=0.11, roughness=0.34)
    k.box(root, "mullion", (0.028, 1.52, 0.04), (0.0, 1.14, 0.452), C_PCS_DARK, metallic=0.2, roughness=0.35)
    # door skin recesses
    k.box(root, "recess_l", (0.46, 0.72, 0.012), (-0.29, 0.92, 0.466), (0.74, 0.76, 0.79), metallic=0.08, roughness=0.4)
    k.box(root, "recess_r", (0.46, 0.42, 0.012), (0.29, 0.82, 0.466), (0.74, 0.76, 0.79), metallic=0.08, roughness=0.4)
    # hinges (outer edges)
    for i, y in enumerate((0.55, 1.14, 1.72)):
        k.cyl(root, f"hinge_l_{i}", 0.014, 0.09, (-0.575, y, 0.455), C_METAL, segments=10, metallic=0.55, roughness=0.25)
        k.cyl(root, f"hinge_r_{i}", 0.014, 0.09, (0.575, y, 0.455), C_METAL, segments=10, metallic=0.55, roughness=0.25)
    # T-handles / 3-point locks near the meeting stile
    k.box(root, "lock_l", (0.05, 0.11, 0.04), (-0.08, 1.14, 0.475), C_METAL, metallic=0.55, roughness=0.28)
    k.box(root, "lock_r", (0.05, 0.11, 0.04), (0.08, 1.14, 0.475), C_METAL, metallic=0.55, roughness=0.28)
    k.cyl(root, "tbar_l", 0.01, 0.10, (-0.08, 1.14, 0.50), C_METAL, segments=10, r=qx90, metallic=0.6, roughness=0.22)
    k.cyl(root, "tbar_r", 0.01, 0.10, (0.08, 1.14, 0.50), C_METAL, segments=10, r=qx90, metallic=0.6, roughness=0.22)
    # door louvers (lower panels)
    k.louvers(root, "dlouver_l", -0.29, 0.42, 0.468, 0.42, 0.55, 0.02, 7, C_METAL)
    k.louvers(root, "dlouver_r", 0.29, 0.42, 0.468, 0.42, 0.32, 0.02, 5, C_METAL)
    # HMI on right door
    k.box(root, "hmi_bezel", (0.34, 0.28, 0.028), (0.29, 1.52, 0.468), C_DARK, metallic=0.35, roughness=0.28)
    k.box(root, "hmi_glass", (0.30, 0.24, 0.008), (0.29, 1.52, 0.484), (0.05, 0.08, 0.10), metallic=0.0, roughness=0.12, emissive=(0.02, 0.05, 0.06))
    k.plate(root, "hmi_screen", 0.28, 0.21, (0.29, 1.52, 0.490), "hmi", hmi_png())
    k.box(root, "hmi_btn_1", (0.04, 0.02, 0.012), (0.18, 1.36, 0.478), C_METAL, metallic=0.4, roughness=0.3)
    k.box(root, "hmi_btn_2", (0.04, 0.02, 0.012), (0.24, 1.36, 0.478), C_METAL, metallic=0.4, roughness=0.3)
    k.box(root, "hmi_btn_3", (0.04, 0.02, 0.012), (0.30, 1.36, 0.478), C_LED_G, roughness=0.25, emissive=(0.05, 0.25, 0.08))
    # nameplate + IP plate (unique tex per instance so PCS-01 ≠ PCS-02)
    k.box(root, "np_back", (0.46, 0.11, 0.012), (0.0, 1.92, 0.462), C_DARK, metallic=0.3, roughness=0.35)
    k.plate(root, "nameplate", 0.44, 0.09, (0.0, 1.92, 0.470), f"np-{entity_id}", nameplate_png(tag, scale=8))
    k.plate(root, "ip_plate", 0.22, 0.05, (-0.40, 1.92, 0.462), f"ip-{entity_id}", nameplate_png("IP54", fg=(20, 22, 24, 255), bg=(210, 214, 218, 255), scale=6))
    k.plate(root, "warn", 0.10, 0.10, (0.50, 1.72, 0.468), "warn", warning_png(), alpha_mode="BLEND")
    # brand bar under the hood
    k.box(root, "brand_bar", (1.26, 0.07, 0.84), (0.0, 2.02, 0.0), C_PCS_BLUE, metallic=0.28, roughness=0.28)
    # sloped rain hood + drip lip + side cheeks
    k.hood(root, "hood", 1.40, 1.08, 0.06, 0.08, (0.0, 2.14, 0.06), C_METAL)
    k.box(root, "hood_cheek_l", (0.03, 0.10, 1.02), (-0.70, 2.10, 0.04), C_METAL, metallic=0.45, roughness=0.28)
    k.box(root, "hood_cheek_r", (0.03, 0.10, 1.02), (0.70, 2.10, 0.04), C_METAL, metallic=0.45, roughness=0.28)
    # side wall louver banks (proud of the body so a 3/4 view reads vents, not a blank panel)
    k.box(root, "well_l", (0.03, 1.46, 0.68), (-0.625, 1.16, 0.0), C_DARK, metallic=0.08, roughness=0.5)
    k.box(root, "well_r", (0.03, 1.46, 0.68), (0.625, 1.16, 0.0), C_DARK, metallic=0.08, roughness=0.5)
    k.louvers(root, "louver_l", -0.655, 0.48, 0.0, 0.045, 1.42, 0.64, 14, C_METAL)
    k.louvers(root, "louver_r", 0.655, 0.48, 0.0, 0.045, 1.42, 0.64, 14, C_METAL)
    k.box(root, "side_rim_l_t", (0.05, 0.03, 0.70), (-0.655, 1.90, 0.0), C_PCS_DARK, metallic=0.25, roughness=0.35)
    k.box(root, "side_rim_l_b", (0.05, 0.03, 0.70), (-0.655, 0.46, 0.0), C_PCS_DARK, metallic=0.25, roughness=0.35)
    k.box(root, "side_rim_r_t", (0.05, 0.03, 0.70), (0.655, 1.90, 0.0), C_PCS_DARK, metallic=0.25, roughness=0.35)
    k.box(root, "side_rim_r_b", (0.05, 0.03, 0.70), (0.655, 0.46, 0.0), C_PCS_DARK, metallic=0.25, roughness=0.35)
    # rear cable gland box
    k.box_y0(root, "cable_box", (0.78, 0.34, 0.20), (0, 0.30, -0.50), C_PCS_DARK, metallic=0.28, roughness=0.4)
    for i, x in enumerate((-0.22, -0.07, 0.07, 0.22)):
        k.cyl(root, f"gland_{i}", 0.028, 0.07, (x, 0.42, -0.60), C_METAL, segments=10, metallic=0.5, roughness=0.3)
    k.box(root, "pe_boss", (0.06, 0.06, 0.04), (0.34, 0.38, -0.52), (0.55, 0.42, 0.18), metallic=0.5, roughness=0.3)
    # lifting eyes on hood
    for i, x in enumerate((-0.52, 0.52)):
        k.box(root, f"lift_{i}", (0.09, 0.045, 0.09), (x, 2.20, -0.10), C_METAL, metallic=0.62, roughness=0.22)
        k.cyl(root, f"lift_ring_{i}", 0.018, 0.05, (x, 2.24, -0.10), C_METAL, segments=10, metallic=0.62, roughness=0.22)
    # status LEDs + e-stop (right door, monitor-only — no actuator extras)
    k.box(root, "led_g", (0.036, 0.036, 0.018), (-0.48, 1.72, 0.468), C_LED_G, roughness=0.18, emissive=(0.12, 0.65, 0.18))
    k.box(root, "led_y", (0.036, 0.036, 0.018), (-0.42, 1.72, 0.468), C_YELLOW, roughness=0.2, emissive=(0.35, 0.25, 0.02))
    k.box(root, "led_r", (0.036, 0.036, 0.018), (-0.36, 1.72, 0.468), C_LED_R, roughness=0.18, emissive=(0.45, 0.04, 0.02))
    k.cyl(root, "estop_stem", 0.018, 0.04, (0.50, 1.52, 0.478), C_DARK, segments=10)
    k.cyl(root, "estop", 0.032, 0.03, (0.50, 1.52, 0.500), C_LED_R, segments=12, metallic=0.15, roughness=0.25, emissive=(0.25, 0.02, 0.02))
    k.cyl(root, "estop_ring", 0.042, 0.008, (0.50, 1.52, 0.488), C_YELLOW, segments=12, metallic=0.1, roughness=0.4)
    return root


def build_bess(g: GltfBuilder, entity_id="ES-BESS", pair_group="ES-PAIR-B", pcs_id="ES-PCS-02") -> int:
    k = Kit(g)
    root = g.node(
        entity_id,
        extras=k.extras(
            entity_id,
            "bess",
            catalogKind="BESS",
            displayName="储能柜",
            pairGroup=pair_group,
            pairRole="bess",
            pairedPcsId=pcs_id,
        ),
    )
    tag = entity_id.replace("ES-", "")
    k.box_y0(root, "pad", (1.55, 0.12, 1.55), (0, 0, 0), C_CONCRETE, metallic=0.02, roughness=0.8)
    k.box_y0(root, "plinth", (1.32, 0.10, 1.32), (0, 0.12, 0), C_DARK, metallic=0.3, roughness=0.4)
    hz = hazard_png()
    k.box_tex(root, "hazard_f", (1.32, 0.08, 0.03), (0.0, 0.26, 0.675), "hazard", hz)
    k.box_tex(root, "hazard_b", (1.32, 0.08, 0.03), (0.0, 0.26, -0.675), "hazard", hz)
    k.box_y0(root, "body", (1.28, 1.95, 1.28), (0, 0.22, 0), C_BESS, metallic=0.18, roughness=0.40)
    # HVAC top + short rain lip (liquid-cooled BESS cabinet, not a heat-exchanger demo)
    k.box_y0(root, "hvac", (1.28, 0.32, 1.28), (0, 2.17, 0), C_BESS_TOP, metallic=0.35, roughness=0.4)
    k.hood(root, "hood", 1.40, 1.40, 0.05, 0.06, (0.0, 2.54, 0.04), C_METAL)
    k.louvers(root, "hvac_front", 0.0, 2.22, 0.66, 1.10, 0.22, 0.04, 5, C_METAL)
    k.box(root, "hvac_cap", (0.35, 0.08, 0.35), (0, 2.53, 0), C_METAL, metallic=0.5, roughness=0.3)
    # doors
    k.box(root, "door_l", (0.58, 1.70, 0.04), (-0.32, 1.15, 0.66), C_BESS, metallic=0.2, roughness=0.36)
    k.box(root, "door_r", (0.58, 1.70, 0.04), (0.32, 1.15, 0.66), C_BESS, metallic=0.2, roughness=0.36)
    k.box(root, "window", (0.90, 0.10, 0.03), (0.0, 1.85, 0.68), C_WINDOW, metallic=0.1, roughness=0.2, emissive=(0.02, 0.05, 0.08))
    k.cyl(root, "handle", 0.012, 0.18, (0.04, 1.15, 0.70), C_METAL, segments=10)
    for i, y in enumerate((0.55, 1.15, 1.75)):
        k.cyl(root, f"hinge_l_{i}", 0.014, 0.08, (-0.62, y, 0.66), C_METAL, segments=8, metallic=0.55, roughness=0.25)
        k.cyl(root, f"hinge_r_{i}", 0.014, 0.08, (0.62, y, 0.66), C_METAL, segments=8, metallic=0.55, roughness=0.25)
    # cyan accent
    k.box(root, "accent", (1.30, 0.06, 1.30), (0, 2.14, 0), C_CYAN, metallic=0.3, roughness=0.3)
    k.plate(
        root,
        "nameplate",
        0.42,
        0.08,
        (0.0, 2.00, 0.68),
        f"np-{entity_id}",
        nameplate_png(tag, fg=(180, 255, 250, 255), bg=(18, 28, 32, 255)),
    )
    # side liquid-cooling fins
    for side, x in (("l", -0.66), ("r", 0.66)):
        for i in range(10):
            z = -0.50 + i * 0.11
            k.box(root, f"fin_{side}_{i}", (0.06, 1.50, 0.018), (x, 1.15, z), C_METAL, metallic=0.55, roughness=0.28)
    k.box_y0(root, "cable", (0.40, 0.22, 0.16), (0, 0.22, -0.70), C_DARK)
    k.box(root, "led", (0.05, 0.05, 0.02), (-0.50, 2.00, 0.68), C_LED_G, emissive=(0.1, 0.55, 0.2), roughness=0.2)
    return root


def _bushing(k: Kit, parent, name, x, y, z, h=0.55):
    k.cyl(parent, name + "_base", 0.055, 0.06, (x, y, z), C_METAL, segments=12)
    sheds = 5
    for i in range(sheds):
        cy = y + 0.05 + (i + 0.5) * (h / sheds)
        r0, r1 = (0.09, 0.05) if i % 2 == 0 else (0.05, 0.09)
        k.cone(parent, f"{name}_s{i}", r0, r1, h / sheds * 0.95, (x, cy, z), C_CERAMIC)
    k.cyl(parent, name + "_cap", 0.02, 0.08, (x, y + h + 0.04, z), C_METAL, segments=10)


def build_transformer(g: GltfBuilder, entity_id="ES-XFMR") -> int:
    k = Kit(g)
    root = g.node(
        entity_id,
        extras=k.extras(
            entity_id,
            "transformer",
            catalogKind="TRANSFORMER",
            displayName="变压器",
        ),
    )
    k.box_y0(root, "pad", (3.20, 0.18, 2.20), (0, 0, 0), C_CONCRETE, metallic=0.02, roughness=0.82)
    # oil pit curb
    for name, size, c in (
        ("curb_n", (3.00, 0.12, 0.10), (0, 0.24, 0.95)),
        ("curb_s", (3.00, 0.12, 0.10), (0, 0.24, -0.95)),
        ("curb_e", (0.10, 0.12, 1.80), (1.45, 0.24, 0)),
        ("curb_w", (0.10, 0.12, 1.80), (-1.45, 0.24, 0)),
    ):
        k.box(root, name, size, c, C_CONCRETE, metallic=0.02, roughness=0.8)
    k.box_y0(root, "tank", (2.20, 1.55, 1.35), (0, 0.30, 0), C_XFMR, metallic=0.08, roughness=0.5)
    k.box(root, "tank_lid", (2.24, 0.06, 1.39), (0, 1.88, 0), C_XFMR_DK, metallic=0.1, roughness=0.45)
    # radiators
    for side, x in (("l", -1.18), ("r", 1.18)):
        for i in range(9):
            z = -0.56 + i * 0.14
            k.box(root, f"rad_{side}_{i}", (0.16, 1.25, 0.035), (x, 1.05, z), C_XFMR_DK, metallic=0.12, roughness=0.4)
    # conservator
    qz90 = (0.0, 0.0, 0.70710678, 0.70710678)
    k.cyl(root, "conservator", 0.22, 1.15, (0.15, 2.18, -0.15), C_XFMR, segments=18, metallic=0.1, roughness=0.45, r=qz90)
    k.box(root, "cons_br_l", (0.04, 0.28, 0.04), (-0.35, 2.00, -0.15), C_METAL, metallic=0.5, roughness=0.3)
    k.box(root, "cons_br_r", (0.04, 0.28, 0.04), (0.65, 2.00, -0.15), C_METAL, metallic=0.5, roughness=0.3)
    k.cyl(root, "oil_gauge", 0.05, 0.04, (0.15, 2.18, 0.08), (0.7, 0.15, 0.1), segments=10, metallic=0.1, roughness=0.2)
    # HV bushings
    for i, x in enumerate((-0.45, 0.0, 0.45)):
        _bushing(k, root, f"hv{i}", x, 1.95, 0.35, h=0.52)
    # LV bushings
    for i, z in enumerate((-0.25, 0.0, 0.25, 0.48)):
        _bushing(k, root, f"lv{i}", 0.85, 1.95, z, h=0.32)
    # control box
    k.box(root, "ctrl", (0.38, 0.45, 0.22), (-0.70, 1.05, 0.78), C_PCS, metallic=0.2, roughness=0.4)
    k.plate(root, "nameplate", 0.36, 0.08, (0.0, 1.55, 0.70), "xfmr", nameplate_png("XFMR"))
    k.cyl(root, "drain", 0.03, 0.08, (0.90, 0.42, 0.0), C_METAL, segments=10)
    return root


def build_load(g: GltfBuilder, entity_id="ES-LOAD") -> int:
    k = Kit(g)
    root = g.node(
        entity_id,
        extras=k.extras(
            entity_id,
            "load",
            catalogKind="LOAD",
            displayName="主要负荷",
        ),
    )
    k.box_y0(root, "pad", (8.6, 0.16, 6.6), (0, 0, 0), C_CONCRETE, metallic=0.02, roughness=0.82)
    k.box_y0(root, "hall", (8.0, 4.2, 6.0), (0, 0.16, 0), C_LOAD, metallic=0.04, roughness=0.65)
    k.box(root, "roof", (8.4, 0.18, 6.4), (0, 4.45, 0), C_ROOF, metallic=0.15, roughness=0.5)
    k.box(root, "parapet_n", (8.4, 0.22, 0.12), (0, 4.62, 3.14), C_ROOF)
    k.box(root, "parapet_s", (8.4, 0.22, 0.12), (0, 4.62, -3.14), C_ROOF)
    # roll-up door +Z
    k.box(root, "door", (2.40, 2.60, 0.08), (0.0, 1.55, 3.05), C_DARK, metallic=0.3, roughness=0.4)
    for i in range(8):
        k.box(root, f"door_rib_{i}", (2.36, 0.04, 0.09), (0.0, 0.40 + i * 0.32, 3.08), C_METAL, metallic=0.4, roughness=0.35)
    # window bands
    k.box(root, "win_e", (0.08, 0.90, 3.6), (4.04, 2.40, 0.0), C_WINDOW, metallic=0.05, roughness=0.15, emissive=(0.03, 0.06, 0.08))
    k.box(root, "win_w", (0.08, 0.90, 3.6), (-4.04, 2.40, 0.0), C_WINDOW, metallic=0.05, roughness=0.15, emissive=(0.03, 0.06, 0.08))
    # rooftop HVAC + vent
    k.box(root, "rtu", (1.4, 0.55, 1.1), (-1.8, 4.82, -0.8), C_BESS_TOP, metallic=0.3, roughness=0.4)
    k.cyl(root, "stack", 0.18, 1.1, (2.2, 5.15, 1.2), C_METAL, segments=14)
    k.cyl(root, "stack_cap", 0.22, 0.06, (2.2, 5.73, 1.2), C_DARK, segments=14)
    # dock
    k.box_y0(root, "dock", (2.2, 0.70, 1.2), (2.6, 0.16, 3.4), C_CONCRETE, metallic=0.02, roughness=0.8)
    k.plate(root, "nameplate", 1.10, 0.22, (0.0, 3.55, 3.06), "load", nameplate_png("LOAD"))
    # MCC lineup in front of hall (reads as 负荷开关柜)
    for i, x in enumerate((-1.2, 0.0, 1.2)):
        k.box_y0(root, f"mcc_{i}", (1.05, 2.05, 0.55), (x, 0.16, 3.55), C_PCS, metallic=0.2, roughness=0.38)
        k.box(root, f"mcc_stripe_{i}", (1.05, 0.06, 0.56), (x, 2.12, 3.55), C_PCS_BLUE)
        k.box(root, f"mcc_led_{i}", (0.05, 0.05, 0.02), (x - 0.38, 1.90, 3.84), C_LED_G, emissive=(0.1, 0.5, 0.2), roughness=0.2)
    return root


def build_dist_room(g: GltfBuilder, entity_id="ES-DIST-01") -> int:
    k = Kit(g)
    root = g.node(
        entity_id,
        extras=k.extras(entity_id, "distribution_room", catalogKind="DIST_ROOM", displayName="配电房"),
    )
    k.box_y0(root, "pad", (10.4, 0.16, 7.4), (0, 0, 0), C_CONCRETE, metallic=0.02, roughness=0.82)
    k.box_y0(root, "hall", (10.0, 3.6, 7.0), (0, 0.16, 0), C_LOAD, metallic=0.04, roughness=0.62)
    k.box(root, "roof", (10.6, 0.18, 7.6), (0, 3.86, 0), C_ROOF, metallic=0.15, roughness=0.5)
    k.box(root, "eave_s", (10.6, 0.08, 0.35), (0, 3.78, 3.85), C_ROOF, metallic=0.15, roughness=0.5)
    k.box(root, "door", (1.20, 2.20, 0.08), (0.0, 1.30, 3.54), C_DARK)
    k.box(root, "door_frame", (1.32, 2.32, 0.04), (0.0, 1.32, 3.50), C_PCS_DARK, metallic=0.2, roughness=0.4)
    k.louvers(root, "wall_louver", -2.4, 1.80, 3.54, 1.60, 0.90, 0.05, 6, C_METAL)
    k.box(root, "win", (1.40, 0.70, 0.06), (2.6, 2.20, 3.54), C_WINDOW, metallic=0.05, roughness=0.2)
    k.cyl(root, "downspout_l", 0.05, 3.4, (-5.05, 1.90, 3.40), C_METAL, segments=10)
    k.cyl(root, "downspout_r", 0.05, 3.4, (5.05, 1.90, 3.40), C_METAL, segments=10)
    k.box_y0(root, "cable_trench", (2.2, 0.08, 1.0), (0.0, 0.16, 4.2), C_DARK, metallic=0.1, roughness=0.6)
    k.plate(root, "nameplate", 1.20, 0.20, (0.0, 3.20, 3.54), f"np-{entity_id}", nameplate_png("DIST"))
    return root


def add_site(g: GltfBuilder) -> int:
    k = Kit(g)
    site = g.node("Site", extras={"modelingClass": MODELING, "interactive": False, "entityType": "site"})
    k.box_y0(site, "ground", (48.0, 0.04, 36.0), (21.0, -0.04, 16.0), C_GRASS, metallic=0.0, roughness=0.9)
    k.box_y0(site, "road_ew", (40.0, 0.05, 4.0), (21.0, 0.0, 11.0), C_ASPHALT, metallic=0.0, roughness=0.85)
    k.box_y0(site, "road_ns", (4.0, 0.05, 22.0), (34.0, 0.0, 11.0), C_ASPHALT, metallic=0.0, roughness=0.85)
    k.box_y0(site, "road_svc", (36.0, 0.05, 3.2), (20.0, 0.0, 23.5), C_ASPHALT, metallic=0.0, roughness=0.85)
    # fence posts + panels (skip south gate x=30..34)
    for x in range(0, 43, 3):
        for z, skip in ((0.0, 30 <= x <= 34), (32.0, False)):
            if skip:
                continue
            k.box_y0(site, f"fp_{x}_{int(z)}", (0.08, 2.2, 0.08), (float(x), 0, z), C_FENCE, metallic=0.6, roughness=0.3)
    for z in range(0, 33, 3):
        for x in (0.0, 42.0):
            k.box_y0(site, f"fp2_{int(x)}_{z}", (0.08, 2.2, 0.08), (x, 0, float(z)), C_FENCE, metallic=0.6, roughness=0.3)
    k.box_y0(site, "fence_n", (42.0, 1.8, 0.04), (21.0, 0.2, 32.0), C_FENCE, metallic=0.55, roughness=0.32)
    k.box_y0(site, "fence_w", (0.04, 1.8, 32.0), (0.0, 0.2, 16.0), C_FENCE, metallic=0.55, roughness=0.32)
    k.box_y0(site, "fence_e", (0.04, 1.8, 32.0), (42.0, 0.2, 16.0), C_FENCE, metallic=0.55, roughness=0.32)
    k.box_y0(site, "fence_s_l", (30.0, 1.8, 0.04), (15.0, 0.2, 0.0), C_FENCE, metallic=0.55, roughness=0.32)
    k.box_y0(site, "fence_s_r", (8.0, 1.8, 0.04), (38.0, 0.2, 0.0), C_FENCE, metallic=0.55, roughness=0.32)
    # south gate
    k.box_y0(site, "gate_post_l", (0.16, 2.6, 0.16), (30.0, 0, 0.0), C_PCS_DARK, metallic=0.4, roughness=0.35)
    k.box_y0(site, "gate_post_r", (0.16, 2.6, 0.16), (34.0, 0, 0.0), C_PCS_DARK, metallic=0.4, roughness=0.35)
    k.box(site, "gate_beam", (4.2, 0.14, 0.14), (32.0, 2.55, 0.0), C_METAL, metallic=0.5, roughness=0.3)
    k.plate(site, "gate_sign", 1.4, 0.28, (32.0, 2.85, 0.12), "gate", nameplate_png("ES-GATE"))
    # road centre dashes
    for i, x in enumerate(range(4, 40, 4)):
        k.box_y0(site, f"dash_ew_{i}", (1.4, 0.02, 0.12), (float(x), 0.05, 11.0), C_YELLOW, metallic=0.05, roughness=0.55)
    for i, z in enumerate(range(2, 22, 4)):
        k.box_y0(site, f"dash_ns_{i}", (0.12, 0.02, 1.4), (34.0, 0.05, float(z)), C_YELLOW, metallic=0.05, roughness=0.55)
    # gravel yards under BESS clusters
    k.box_y0(site, "yard_a", (6.4, 0.06, 5.6), (9.2, 0.0, 17.2), (0.42, 0.40, 0.36), metallic=0.0, roughness=0.9)
    k.box_y0(site, "yard_b", (6.4, 0.06, 5.6), (25.2, 0.0, 17.2), (0.42, 0.40, 0.36), metallic=0.0, roughness=0.9)
    k.box_y0(site, "yard_pcs", (8.0, 0.06, 3.4), (25.5, 0.0, 27.2), (0.42, 0.40, 0.36), metallic=0.0, roughness=0.9)
    # cable trays + hangers
    k.box(site, "tray_ew", (18.0, 0.12, 0.50), (18.0, 3.0, 25.4), C_METAL, metallic=0.55, roughness=0.3)
    k.box(site, "tray_a", (0.50, 0.12, 8.0), (10.2, 3.0, 20.0), C_METAL, metallic=0.55, roughness=0.3)
    k.box(site, "tray_b", (0.50, 0.12, 8.0), (25.2, 3.0, 20.0), C_METAL, metallic=0.55, roughness=0.3)
    for i, x in enumerate((10.2, 18.0, 25.2)):
        k.box(site, f"hanger_{i}", (0.06, 2.4, 0.06), (x, 1.7, 25.4), C_METAL, metallic=0.5, roughness=0.32)
    k.box(site, "pipe_ew", (18.0, 0.10, 0.10), (18.0, 2.70, 25.7), (0.75, 0.42, 0.12), metallic=0.4, roughness=0.35)
    return site


def instantiate_at(g: GltfBuilder, build_fn, translation, **kw):
    """Build under a locator node moved in XZ (Y-up)."""
    loc = g.node(kw.get("entity_id", "loc") + "__place", t=translation)
    # Temporarily: builders add as roots. We rebuild by parenting after.
    before = len(g.nodes)
    root = build_fn(g, **kw)
    # reparent root under locator: locator was created first so root is not child.
    # Move locator to be parent of root.
    g.nodes[loc].setdefault("children", []).append(root)
    # If build_fn created the equipment at origin, locator translation places it.
    _ = before
    return loc


# ---------------------------------------------------------------------------
# Mapping + docs
# ---------------------------------------------------------------------------

PAIR_A = ["ES-BESS-A1", "ES-BESS-A2", "ES-BESS-A3", "ES-BESS-A4"]
PAIR_B = ["ES-BESS-B1", "ES-BESS-B2", "ES-BESS-B3", "ES-BESS-B4"]

SCENE_PLACEMENTS = [
    {"entityId": "ES-DIST-01", "kind": "DIST_ROOM", "label": "配电房", "x": 8.0, "z": 27.5, "pairGroup": None},
    {"entityId": "ES-XFMR-01", "kind": "TRANSFORMER", "label": "变压器", "x": 16.5, "z": 27.5, "pairGroup": None},
    {"entityId": "ES-PCS-01", "kind": "PCS", "label": "PCS-01", "x": 23.5, "z": 27.2, "pairGroup": "ES-PAIR-A", "peers": PAIR_A},
    {"entityId": "ES-PCS-02", "kind": "PCS", "label": "PCS-02", "x": 27.5, "z": 27.2, "pairGroup": "ES-PAIR-B", "peers": PAIR_B},
    {"entityId": "ES-BESS-A1", "kind": "BESS", "label": "储能柜 A1", "x": 8.0, "z": 16.0, "pairGroup": "ES-PAIR-A", "pcs": "ES-PCS-01"},
    {"entityId": "ES-BESS-A2", "kind": "BESS", "label": "储能柜 A2", "x": 10.5, "z": 16.0, "pairGroup": "ES-PAIR-A", "pcs": "ES-PCS-01"},
    {"entityId": "ES-BESS-A3", "kind": "BESS", "label": "储能柜 A3", "x": 8.0, "z": 18.5, "pairGroup": "ES-PAIR-A", "pcs": "ES-PCS-01"},
    {"entityId": "ES-BESS-A4", "kind": "BESS", "label": "储能柜 A4", "x": 10.5, "z": 18.5, "pairGroup": "ES-PAIR-A", "pcs": "ES-PCS-01"},
    {"entityId": "ES-BESS-B1", "kind": "BESS", "label": "储能柜 B1", "x": 24.0, "z": 16.0, "pairGroup": "ES-PAIR-B", "pcs": "ES-PCS-02"},
    {"entityId": "ES-BESS-B2", "kind": "BESS", "label": "储能柜 B2", "x": 26.5, "z": 16.0, "pairGroup": "ES-PAIR-B", "pcs": "ES-PCS-02"},
    {"entityId": "ES-BESS-B3", "kind": "BESS", "label": "储能柜 B3", "x": 24.0, "z": 18.5, "pairGroup": "ES-PAIR-B", "pcs": "ES-PCS-02"},
    {"entityId": "ES-BESS-B4", "kind": "BESS", "label": "储能柜 B4", "x": 26.5, "z": 18.5, "pairGroup": "ES-PAIR-B", "pcs": "ES-PCS-02"},
    {"entityId": "ES-LOAD-01", "kind": "LOAD", "label": "主要负荷", "x": 12.0, "z": 6.0, "pairGroup": None},
]


def write_mapping():
    DOCS.mkdir(parents=True, exist_ok=True)
    catalog = [
        {
            "file": "catalog/pcs.glb",
            "entityId": "ES-PCS-02",
            "entityType": "pcs",
            "catalogKind": "PCS",
            "displayName": "PCS-02 储能变流器",
            "size_m": {"x": 1.55, "y": 2.22, "z": 1.10},
            "pairRole": "pcs",
            "pairGroup": "ES-PAIR-B",
            "pairedEntityIds": PAIR_B,
            "modelingClass": MODELING,
        },
        {
            "file": "catalog/transformer.glb",
            "entityId": "ES-XFMR",
            "entityType": "transformer",
            "catalogKind": "TRANSFORMER",
            "displayName": "变压器",
            "size_m": {"x": 3.20, "y": 2.55, "z": 2.20},
            "modelingClass": MODELING,
        },
        {
            "file": "catalog/bess.glb",
            "entityId": "ES-BESS",
            "entityType": "bess",
            "catalogKind": "BESS",
            "displayName": "储能柜",
            "size_m": {"x": 1.55, "y": 2.55, "z": 1.55},
            "pairRole": "bess",
            "pairGroup": "ES-PAIR-B",
            "pairedPcsId": "ES-PCS-02",
            "modelingClass": MODELING,
        },
        {
            "file": "catalog/load.glb",
            "entityId": "ES-LOAD",
            "entityType": "load",
            "catalogKind": "LOAD",
            "displayName": "主要负荷",
            "size_m": {"x": 8.6, "y": 5.7, "z": 6.6},
            "modelingClass": MODELING,
        },
        {
            "file": "catalog/dist-room.glb",
            "entityId": "ES-DIST-01",
            "entityType": "distribution_room",
            "catalogKind": "DIST_ROOM",
            "displayName": "配电房",
            "size_m": {"x": 10.4, "y": 4.0, "z": 7.4},
            "modelingClass": MODELING,
        },
    ]
    doc = {
        "schemaVersion": 1,
        "scene": "typical-energy-station",
        "modelingClass": MODELING,
        "disclaimer": DISCLAIMER,
        "units": "m",
        "coordinate": {
            "gltf": "Y-up, right-handed, metres; origin = footprint bottom-centre",
            "site": "+X east, +Z south-to-north in glTF (node translation x,z); +Y up",
            "blender": "If opened in Blender, glTF importer maps Y-up → Blender Z-up",
            "threejs": "GLTFLoader keeps Y-up; traverse userData.entityId",
            "picking": "Stable entityId lives on the equipment ROOT node extras / userData",
        },
        "pairs": [
            {"group": "ES-PAIR-A", "pcs": "ES-PCS-01", "bess": PAIR_A},
            {"group": "ES-PAIR-B", "pcs": "ES-PCS-02", "bess": PAIR_B},
        ],
        "demoPowerKw": {
            "incoming": 1100,
            "loss": 20,
            "bessDischarge": 200,
            "load": 1280,
            "note": "演示口径，来自公众号典型场景，非现场测点",
        },
        "catalog": catalog,
        "sceneEntities": SCENE_PLACEMENTS,
        "nonInteractive": ["Site", "roads", "fence", "pads", "cable trays", "pipes"],
    }
    (DOCS / "equipment-mapping.json").write_text(
        json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [
        "# 能源站设备映射表（典型场景建模）",
        "",
        DISCLAIMER,
        "",
        "## 坐标约定",
        "",
        "| 项 | 约定 |",
        "| --- | --- |",
        "| 单位 | 米 |",
        "| GLB / Three.js | 右手系 **Y-up**；设备原点在底面中心 |",
        "| 站区平移 | 节点 `translation`：X 东、Y 上、Z 北向布置（本场景 Z 从南门增大） |",
        "| 主键 | 根节点 `extras.entityId` → 运行时 `userData.entityId` |",
        "| 不可点选 | 道路 / 围栏 / 桥架 / 地坪 / 管线，无 entityId |",
        "",
        "## PCS ↔ 储能柜",
        "",
        "| 组 | PCS | 储能柜 |",
        "| --- | --- | --- |",
        f"| ES-PAIR-A | ES-PCS-01 | {', '.join(PAIR_A)} |",
        f"| ES-PAIR-B | ES-PCS-02 | {', '.join(PAIR_B)} |",
        "",
        "## 目录 GLB",
        "",
        "| 文件 | entityId | 类型 | 说明 |",
        "| --- | --- | --- | --- |",
    ]
    for c in catalog:
        lines.append(
            f"| `{c['file']}` | `{c['entityId']}` | {c['displayName']} | {MODELING} |"
        )
    lines += [
        "",
        "## 站区实例",
        "",
        "| entityId | 名称 | 类型 | X | Z | 配对 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for e in SCENE_PLACEMENTS:
        pair = e.get("pairGroup") or "—"
        lines.append(
            f"| `{e['entityId']}` | {e['label']} | {e['kind']} | {e['x']} | {e['z']} | {pair} |"
        )
    (DOCS / "equipment-mapping.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (DOCS / "coordinate-convention.md").write_text(
        "\n".join(
            [
                "# 坐标约定",
                "",
                DISCLAIMER,
                "",
                "1. **单位**：米。",
                "2. **运行 GLB**：glTF 右手系，**Y 朝上**。设备根节点原点在落地底面中心，+Y 为高度。",
                "3. **站区**：`translation = (x, 0, z)`，x 向东增大，z 向北增大（南门在 z≈0）。",
                "4. **Blender**：用官方 glTF 导入后为 Z-up；继续改层级 / 材质后请再导出 GLB（勾选 extras）。",
                "5. **Three.js**：`GLTFLoader` 后 `object.traverse`，读 `userData.entityId`。同一 ID 绑列表、标签、详情。",
                "6. **配对**：PCS 根节点 `pairRole=pcs` + `pairedEntityIds`；储能柜 `pairRole=bess` + `pairedPcsId`。",
                "",
            ]
        ),
        encoding="utf-8",
    )
    return doc


def save(g: GltfBuilder, path: Path, scene_name: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = g.to_glb(scene_name)
    path.write_bytes(data)
    print(f"wrote {path}  {len(data)} bytes  nodes={len(g.nodes)} meshes={len(g.meshes)}")


def _copy_glbs(dest: Path, mapping: dict):
    dest.mkdir(parents=True, exist_ok=True)
    for src_name, dst_name in (
        ("pcs.glb", "pcs.glb"),
        ("pcs.glb", "pcs-02.glb"),
        ("transformer.glb", "transformer.glb"),
        ("bess.glb", "bess.glb"),
        ("load.glb", "load.glb"),
        ("dist-room.glb", "dist-room.glb"),
    ):
        src = CATALOG / src_name
        if src.exists():
            (dest / dst_name).write_bytes(src.read_bytes())
    scene = EXPORT / "energy-station.glb"
    if scene.exists():
        (dest / "energy-station.glb").write_bytes(scene.read_bytes())
    (dest / "catalog-glb.json").write_text(
        json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def copy_to_public():
    mapping = {
        "TRANSFORMER": "transformer.glb",
        "PCS": "pcs.glb",
        "BESS": "bess.glb",
        "LOAD": "load.glb",
        "DIST_ROOM": "dist-room.glb",
        "note": MODELING + " — CatalogKind 仍是 UF/HOV 时这些键不会自动加载",
        "entityIdPath": "root extras.entityId",
    }
    readme = "\n".join(
        [
            "# 能源站目录 GLB（典型场景建模）",
            "",
            DISCLAIMER,
            "",
            "本目录只放运行网格，**未改** `src/`。脚手架 `CatalogKind` 仍是 UF/HOV，这些文件不会自动替换工艺 primitive。",
            "",
            "| 文件 | entityId |",
            "| --- | --- |",
            "| pcs.glb / pcs-02.glb | ES-PCS-02 |",
            "| transformer.glb | ES-XFMR |",
            "| bess.glb | ES-BESS |",
            "| load.glb | ES-LOAD |",
            "| dist-room.glb | ES-DIST-01 |",
            "| energy-station.glb | 站区实例见 mapping |",
            "",
            f"映射表：`{DOCS / 'equipment-mapping.md'}`",
            "",
        ]
    )
    if PUBLIC_MODELS.parent.exists():
        _copy_glbs(PUBLIC_MODELS, mapping)
        (PUBLIC_MODELS / "README.md").write_text(readme, encoding="utf-8")
        (PUBLIC_MODELS / "equipment-mapping.md").write_bytes((DOCS / "equipment-mapping.md").read_bytes())
        (PUBLIC_MODELS / "equipment-mapping.json").write_bytes((DOCS / "equipment-mapping.json").read_bytes())
        (PUBLIC_MODELS / "coordinate-convention.md").write_bytes((DOCS / "coordinate-convention.md").read_bytes())
        print(f"copied catalog → {PUBLIC_MODELS}")
    else:
        print("skip public/models: dashboard public missing")

    if PUBLIC_PLANT.exists() or PUBLIC_PLANT.parent.exists():
        PUBLIC_PLANT.mkdir(parents=True, exist_ok=True)
        _copy_glbs(PUBLIC_PLANT, mapping)
        plant_readme = PUBLIC_PLANT / "README.md"
        extra = (
            "\n能源站典型柜体只读副本：`pcs.glb` / `pcs-02.glb` / `bess.glb` / "
            "`transformer.glb` / `load.glb` / `dist-room.glb` / `energy-station.glb`。"
            "当前 `CatalogKind` 仍是 UF/HOV，**不会**自动替换工艺 primitive。\n"
        )
        if plant_readme.exists():
            text = plant_readme.read_text(encoding="utf-8")
            if "pcs.glb" not in text:
                plant_readme.write_text(text.rstrip() + "\n" + extra, encoding="utf-8")
        else:
            plant_readme.write_text(readme, encoding="utf-8")
        print(f"copied catalog → {PUBLIC_PLANT}")
    else:
        print("skip public/assets/plant: dashboard plant missing")


def main():
    CATALOG.mkdir(parents=True, exist_ok=True)
    EXPORT.mkdir(parents=True, exist_ok=True)

    g = GltfBuilder()
    build_pcs(g)
    save(g, CATALOG / "pcs.glb", "PCS-02")
    (CATALOG / "pcs-02.glb").write_bytes((CATALOG / "pcs.glb").read_bytes())
    print(f"wrote {CATALOG / 'pcs-02.glb'}  (copy of pcs.glb)")

    g = GltfBuilder()
    build_transformer(g)
    save(g, CATALOG / "transformer.glb", "Transformer")

    g = GltfBuilder()
    build_bess(g)
    save(g, CATALOG / "bess.glb", "BESS")

    g = GltfBuilder()
    build_load(g)
    save(g, CATALOG / "load.glb", "Load")

    g = GltfBuilder()
    build_dist_room(g)
    save(g, CATALOG / "dist-room.glb", "DistRoom")

    # typical station
    g = GltfBuilder()
    add_site(g)
    builders = {
        "PCS": lambda gg, e: build_pcs(
            gg,
            entity_id=e["entityId"],
            pair_group=e.get("pairGroup") or "ES-PAIR-B",
            peers=e.get("peers") or PAIR_B,
        ),
        "BESS": lambda gg, e: build_bess(
            gg,
            entity_id=e["entityId"],
            pair_group=e.get("pairGroup") or "ES-PAIR-B",
            pcs_id=e.get("pcs") or "ES-PCS-02",
        ),
        "TRANSFORMER": lambda gg, e: build_transformer(gg, entity_id=e["entityId"]),
        "LOAD": lambda gg, e: build_load(gg, entity_id=e["entityId"]),
        "DIST_ROOM": lambda gg, e: build_dist_room(gg, entity_id=e["entityId"]),
    }
    for e in SCENE_PLACEMENTS:
        loc = g.node(e["entityId"] + "__place", t=(e["x"], 0.0, e["z"]))
        n_before = len(g.nodes)
        root = builders[e["kind"]](g, e)
        g.nodes[loc].setdefault("children", []).append(root)
        assert root >= n_before - 1
    save(g, EXPORT / "energy-station.glb", "TypicalEnergyStation")

    write_mapping()
    copy_to_public()
    print("done")


if __name__ == "__main__":
    main()
