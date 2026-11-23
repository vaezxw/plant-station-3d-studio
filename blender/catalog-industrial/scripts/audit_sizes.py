# Measure catalog GLB world AABB (metres). Blender CLI.
# blender --background --python E:\catalog-industrial-blender\scripts\audit_sizes.py
from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(r"E:\catalog-industrial-blender")
CATALOG = ROOT / "export" / "catalog"
OUT = ROOT / "export" / "size-audit.json"
PUBLIC = Path(r"E:\hengguang-plant-dashboard\public\assets\catalog")

FILES = [
    ("FLANGE", "flange.glb"),
    ("PIPE", "pipe.glb"),
    ("PIPE_ELBOW", "pipe-elbow.glb"),
    ("HOV", "hov.glb"),
    ("MOV", "mov.glb"),
    ("SSV", "ssv.glb"),
    ("PCV", "pcv.glb"),
    ("PV", "pv.glb"),
    ("UF", "uf.glb"),
    ("FS", "fs.glb"),
    ("INSTR", "instr.glb"),
    ("TANK", "tank.glb"),
    ("HENG_GUANG_SKID", "heng-guang-skid.glb"),
    ("ELEC_CB", "elec-cb.glb"),
    ("ELEC_M", "elec-m.glb"),
    ("ELEC_GND", "elec-gnd.glb"),
    ("TEXT", "text.glb"),
]


def reset():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)


def world_aabb():
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    any_mesh = False
    bpy.context.view_layer.update()
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        any_mesh = True
        for corner in obj.bound_box:
            w = obj.matrix_world @ Vector(corner)
            mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
            mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
    if not any_mesh:
        return None
    size = mx - mn
    return {
        "min": [round(mn.x, 4), round(mn.y, 4), round(mn.z, 4)],
        "max": [round(mx.x, 4), round(mx.y, 4), round(mx.z, 4)],
        "size": [round(size.x, 4), round(size.y, 4), round(size.z, 4)],
    }


def flange_od_guess():
    """Largest mesh whose name contains Flange and Body: max of Y/Z extents."""
    best = 0.0
    name = None
    bpy.context.view_layer.update()
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        n = obj.name.lower()
        if "flange" not in n:
            continue
        if "weld" in n or "nameplate" in n:
            continue
        mn = Vector((1e9, 1e9, 1e9))
        mx = Vector((-1e9, -1e9, -1e9))
        for corner in obj.bound_box:
            w = obj.matrix_world @ Vector(corner)
            mn.x, mn.y, mn.z = min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)
            mx.x, mx.y, mx.z = max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)
        # after glTF Y-up import into Blender, Y is up. Flange disk in YZ or XZ.
        dims = sorted([mx.x - mn.x, mx.y - mn.y, mx.z - mn.z], reverse=True)
        od = dims[0]
        if od > best:
            best = od
            name = obj.name
    return round(best, 4) if best > 0 else None, name


def main():
    rows = []
    src_root = CATALOG if (CATALOG / "pipe.glb").exists() else PUBLIC
    for kind, fname in FILES:
        reset()
        path = src_root / fname
        if not path.exists():
            rows.append({"kind": kind, "file": fname, "missing": True})
            continue
        bpy.ops.import_scene.gltf(filepath=str(path))
        box = world_aabb()
        od, od_name = flange_od_guess()
        size = box["size"] if box else [0, 0, 0]
        rows.append(
            {
                "kind": kind,
                "file": fname,
                "bytes": path.stat().st_size,
                "aabb_xyz_m": size,
                "aabb_min": box["min"] if box else None,
                "aabb_max": box["max"] if box else None,
                "flange_od_guess_m": od,
                "flange_mesh": od_name,
                "face_to_face_or_length_m": size[0],
            }
        )
        print(kind, size, "flange_od", od)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": str(src_root), "rows": rows}, indent=2), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
