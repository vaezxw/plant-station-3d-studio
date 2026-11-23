# Authoritative small turbojet. Geometry is original (not Hengguang / energy-station / liquid-transfer).
# blender --background --python E:\turbojet-blender\scripts\build_turbojet.py
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(r"E:\turbojet-blender")
EXPORT = ROOT / "export"
DOCS = ROOT / "docs"
BLEND_PATH = EXPORT / "turbojet.blend"
GLB_PATH = EXPORT / "turbojet.glb"
MAP_PATH = EXPORT / "turbojet-mapping.json"
MAP_MD = DOCS / "part-mapping.md"
PREVIEW_PATH = EXPORT / "preview.png"

SEGS = 48
MONITOR_ONLY = 1

# Engine axis = Blender +Y (inlet −Y, nozzle +Y). glTF: (x, y, z)_b → (x, z, −y)
PARTS: list[dict] = []


def blender_to_gltf(x: float, y: float, z: float) -> list[float]:
    return [float(x), float(z), float(-y)]


def reset_scene() -> None:
    # Do not call read_factory_settings: it restarts Blender and drops this script.
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)
    for curve in list(bpy.data.curves):
        bpy.data.curves.remove(curve)
    for coll in list(bpy.data.collections):
        if coll.name not in {"Collection", "Scene Collection"}:
            bpy.data.collections.remove(coll)


def ensure_coll(name: str):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def empty(name: str, coll, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.05
    coll.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def shade_smooth(obj) -> None:
    mesh = obj.data
    if not hasattr(mesh, "polygons"):
        return
    for p in mesh.polygons:
        p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32))
        obj.select_set(False)
    except Exception:
        pass


def make_material(
    name: str,
    color: tuple[float, float, float],
    metallic: float,
    roughness: float,
    *,
    coat: float = 0.0,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    out.location = (280, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        if "Coat Roughness" in bsdf.inputs:
            bsdf.inputs["Coat Roughness"].default_value = 0.12
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat["pbrHint"] = "metal"
    return mat


def assign_mat(obj, mat) -> None:
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def bm_to_obj(name: str, bm, coll):
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj


def tag(
    obj,
    part_id: str,
    group: str,
    label_zh: str,
    explode_b: tuple[float, float, float],
    parent=None,
):
    obj.name = part_id
    obj["partId"] = part_id
    obj["group"] = group
    obj["labelZh"] = label_zh
    obj["monitorOnly"] = MONITOR_ONLY
    ex = blender_to_gltf(*explode_b)
    obj["explodeX"] = ex[0]
    obj["explodeY"] = ex[1]
    obj["explodeZ"] = ex[2]
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    shade_smooth(obj)
    PARTS.append(
        {
            "partId": part_id,
            "name": obj.name,
            "group": group,
            "labelZh": label_zh,
            "rest": [0.0, 0.0, 0.0],
            "explode": ex,
            "explodeBlender": [float(explode_b[0]), float(explode_b[1]), float(explode_b[2])],
        }
    )
    return obj


def naca_half(s: float, t: float) -> float:
    s = min(max(s, 0.0), 1.0)
    root = math.sqrt(s)
    yt = 5.0 * t * (
        0.2969 * root - 0.1260 * s - 0.3516 * s * s + 0.2843 * s**3 - 0.1036 * s**4
    )
    return max(yt, 0.004 * t)


def add_frustum_shell(
    bm,
    y0: float,
    y1: float,
    rin0: float,
    rout0: float,
    rin1: float,
    rout1: float,
    segs: int = SEGS,
    cap_start: bool = True,
    cap_end: bool = True,
) -> None:
    def ring(y: float, r: float):
        if r <= 1e-7:
            return [bm.verts.new((0.0, y, 0.0))]
        return [
            bm.verts.new(
                (r * math.cos(2 * math.pi * i / segs), y, r * math.sin(2 * math.pi * i / segs))
            )
            for i in range(segs)
        ]

    o0 = ring(y0, rout0)
    o1 = ring(y1, rout1)
    i0 = ring(y0, rin0) if rin0 > 1e-6 else None
    i1 = ring(y1, rin1) if rin1 > 1e-6 else None
    bm.verts.ensure_lookup_table()

    def quad(a, b, c, d):
        try:
            bm.faces.new((a, b, c, d))
        except ValueError:
            pass

    def bridge(ra, rb):
        if len(ra) == 1 and len(rb) == 1:
            return
        if len(ra) == 1:
            for i in range(segs):
                j = (i + 1) % segs
                try:
                    bm.faces.new((ra[0], rb[i], rb[j]))
                except ValueError:
                    pass
            return
        if len(rb) == 1:
            for i in range(segs):
                j = (i + 1) % segs
                try:
                    bm.faces.new((ra[i], rb[0], ra[j]))
                except ValueError:
                    pass
            return
        for i in range(segs):
            j = (i + 1) % segs
            quad(ra[i], rb[i], rb[j], ra[j])

    bridge(o0, o1)
    if i0 is not None and i1 is not None:
        bridge(i1, i0)
    if cap_start and i0 is not None and len(i0) == segs:
        for i in range(segs):
            j = (i + 1) % segs
            quad(o0[i], i0[i], i0[j], o0[j])
    if cap_end and i1 is not None and len(i1) == segs:
        for i in range(segs):
            j = (i + 1) % segs
            quad(o1[i], o1[j], i1[j], i1[i])


def add_solid_cylinder(bm, y0: float, y1: float, r: float, segs: int = 32) -> None:
    add_frustum_shell(bm, y0, y1, 0.0, r, 0.0, r, segs=segs, cap_start=True, cap_end=True)


def add_blade_row(
    bm,
    y: float,
    r_hub: float,
    r_tip: float,
    count: int,
    chord: float,
    thick_ratio: float,
    twist_hub_deg: float,
    twist_tip_deg: float,
    *,
    rotor: bool,
    camber: float = 0.035,
    nspan: int = 5,
    nchord: int = 8,
) -> None:
    sign = 1.0 if rotor else -1.0
    for bi in range(count):
        theta = 2.0 * math.pi * bi / count
        radial = Vector((math.cos(theta), 0.0, math.sin(theta)))
        axial = Vector((0.0, 1.0, 0.0))
        tang = Vector((-math.sin(theta), 0.0, math.cos(theta)))
        grid: list[list[tuple]] = []
        for si in range(nspan):
            t = si / (nspan - 1)
            r = (r_hub - 0.0006) + t * (r_tip - r_hub + 0.0006)
            twist = math.radians(twist_hub_deg + t * (twist_tip_deg - twist_hub_deg)) * sign
            ca, sa = math.cos(twist), math.sin(twist)
            dir_chord = axial * ca + tang * sa
            dir_thick = -axial * sa + tang * ca
            row = []
            for ci in range(nchord):
                s = ci / (nchord - 1)
                th = naca_half(s, thick_ratio) * chord
                cam = camber * 4.0 * s * (1.0 - s) * chord * sign
                ax = (s - 0.42) * chord
                mid = radial * r + Vector((0.0, y, 0.0)) + dir_chord * ax + dir_thick * cam
                vu = bm.verts.new(tuple(mid + dir_thick * (th * 0.55)))
                vl = bm.verts.new(tuple(mid - dir_thick * (th * 0.45)))
                row.append((vu, vl))
            grid.append(row)

        def q(a, b, c, d):
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass

        for si in range(nspan - 1):
            for ci in range(nchord - 1):
                u00, l00 = grid[si][ci]
                u10, l10 = grid[si][ci + 1]
                u01, l01 = grid[si + 1][ci]
                u11, l11 = grid[si + 1][ci + 1]
                q(u00, u10, u11, u01)
                q(l00, l01, l11, l10)
        for si in range(nspan - 1):
            u0, l0 = grid[si][0]
            u1, l1 = grid[si + 1][0]
            q(u0, u1, l1, l0)
            u0, l0 = grid[si][-1]
            u1, l1 = grid[si + 1][-1]
            q(u0, l0, l1, u1)
        for ci in range(nchord - 1):
            u0, l0 = grid[-1][ci]
            u1, l1 = grid[-1][ci + 1]
            q(u0, u1, l1, l0)


def add_hub_disk(bm, y: float, r_in: float, r_out: float, half_t: float = 0.004) -> None:
    add_frustum_shell(
        bm, y - half_t, y + half_t, r_in, r_out, r_in, r_out, segs=36, cap_start=True, cap_end=True
    )


def finish_stage(
    name: str,
    bm,
    coll,
    mat,
    group: str,
    label_zh: str,
    explode_b: tuple[float, float, float],
    parent,
):
    obj = bm_to_obj(name, bm, coll)
    assign_mat(obj, mat)
    return tag(obj, name, group, label_zh, explode_b, parent=parent)


def add_torus_around_y(bm, y: float, major: float, minor: float, maj_n=28, min_n=10) -> None:
    """Torus whose major circle lies in XZ (around engine +Y)."""
    rings: list[list] = []
    for i in range(maj_n):
        a = 2.0 * math.pi * i / maj_n
        cx = major * math.cos(a)
        cz = major * math.sin(a)
        radial = Vector((math.cos(a), 0.0, math.sin(a)))
        axial = Vector((0.0, 1.0, 0.0))
        ring = []
        for k in range(min_n):
            b = 2.0 * math.pi * k / min_n
            p = Vector((cx, y, cz)) + radial * (math.cos(b) * minor) + axial * (math.sin(b) * minor)
            ring.append(bm.verts.new(tuple(p)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(maj_n):
        a = rings[i]
        b = rings[(i + 1) % maj_n]
        for k in range(min_n):
            j = (k + 1) % min_n
            try:
                bm.faces.new((a[k], b[k], b[j], a[j]))
            except ValueError:
                pass


def add_pipe(bm, pts: list[tuple[float, float, float]], radius: float, segs: int = 8) -> None:
    rings = []
    for i, p in enumerate(pts):
        p = Vector(p)
        if i < len(pts) - 1:
            nxt = Vector(pts[i + 1])
            tangent = (nxt - p).normalized()
        else:
            tangent = (p - Vector(pts[i - 1])).normalized()
        up = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(up)) > 0.92:
            up = Vector((1.0, 0.0, 0.0))
        n1 = tangent.cross(up).normalized()
        n2 = tangent.cross(n1).normalized()
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            v = p + n1 * (math.cos(a) * radius) + n2 * (math.sin(a) * radius)
            ring.append(bm.verts.new(tuple(v)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segs):
            j = (k + 1) % segs
            try:
                bm.faces.new((a[k], b[k], b[j], a[j]))
            except ValueError:
                pass
    # caps
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        c = Vector((0, 0, 0))
        for v in ring:
            c += Vector(v.co)
        c /= len(ring)
        cv = bm.verts.new(tuple(c))
        for k in range(segs):
            j = (k + 1) % segs
            try:
                if flip:
                    bm.faces.new((cv, ring[j], ring[k]))
                else:
                    bm.faces.new((cv, ring[k], ring[j]))
            except ValueError:
                pass


def bolt_circle(bm, y: float, r: float, n: int, bolt_r: float, half_h: float) -> None:
    for i in range(n):
        a = 2 * math.pi * i / n
        cx, cz = r * math.cos(a), r * math.sin(a)
        start = len(bm.verts)
        add_solid_cylinder_at(bm, (cx, y - half_h, cz), (cx, y + half_h, cz), bolt_r, segs=8)
        _ = start


def add_solid_cylinder_at(bm, p0, p1, r: float, segs: int = 10) -> None:
    p0, p1 = Vector(p0), Vector(p1)
    tangent = p1 - p0
    if tangent.length < 1e-8:
        return
    add_pipe(bm, [tuple(p0), tuple(p1)], r, segs=segs)


# --- materials ---
def materials() -> dict[str, object]:
    return {
        "titanium": make_material("TitaniumComp", (0.62, 0.64, 0.68), 1.0, 0.28, coat=0.18),
        "stator": make_material("StatorSteel", (0.72, 0.73, 0.75), 1.0, 0.34, coat=0.08),
        "inconel": make_material("InconelTurbine", (0.62, 0.52, 0.38), 1.0, 0.32, coat=0.12),
        "casing": make_material("CasingAl", (0.55, 0.57, 0.60), 1.0, 0.38, coat=0.05),
        "inlet": make_material("InletLip", (0.78, 0.79, 0.82), 1.0, 0.18, coat=0.35),
        "combustor": make_material("CombustorLiner", (0.28, 0.22, 0.18), 1.0, 0.48),
        "hot": make_material(
            "NozzleHeatTint",
            (0.38, 0.26, 0.20),
            1.0,
            0.36,
            coat=0.2,
            emission=(0.45, 0.16, 0.04),
            emission_strength=0.08,
        ),
        "shaft": make_material("ShaftSteel", (0.45, 0.46, 0.48), 1.0, 0.22, coat=0.15),
        "pipe": make_material("StainlessPipe", (0.70, 0.71, 0.73), 1.0, 0.26, coat=0.1),
        "fuel": make_material("FuelBrass", (0.72, 0.52, 0.18), 1.0, 0.30),
        "mount": make_material("MountSteel", (0.40, 0.41, 0.43), 1.0, 0.45),
        "base": make_material("StandPaint", (0.12, 0.14, 0.16), 0.15, 0.55),
        "spinner": make_material("SpinnerPolished", (0.82, 0.83, 0.86), 1.0, 0.12, coat=0.4),
        "igniter": make_material("IgniterCeramic", (0.86, 0.84, 0.78), 0.05, 0.42),
    }


def build() -> None:
    reset_scene()
    EXPORT.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)

    coll_root = ensure_coll("00_Assembly")
    coll_rotor = ensure_coll("01_Rotors")
    coll_stator = ensure_coll("02_Stators")
    coll_casing = ensure_coll("03_Casings")
    coll_plumb = ensure_coll("04_Plumbing")
    coll_mount = ensure_coll("05_Mounts")

    root = empty("TurbojetAssembly", coll_root)
    root["partId"] = "turbojet-root"
    root["group"] = "assembly"
    root["monitorOnly"] = MONITOR_ONLY
    root["engineClass"] = "small-axial-turbojet"
    root["modelingClass"] = "typical-scene"

    spool = empty("RotorSpool", coll_rotor, parent=root)
    spool["partId"] = "rotor-spool"
    spool["group"] = "rotor"
    spool["spinAxisBlender"] = [0.0, 1.0, 0.0]
    spool["spinAxis"] = blender_to_gltf(0.0, 1.0, 0.0)  # glTF ≈ [0,0,-1]

    stator_root = empty("StatorGroup", coll_stator, parent=root)
    casing_root = empty("CasingGroup", coll_casing, parent=root)
    plumb_root = empty("PlumbingGroup", coll_plumb, parent=root)
    mount_root = empty("MountGroup", coll_mount, parent=root)

    mats = materials()
    shaft_r = 0.0078

    # --- shaft + spinner + bearings (rotors) ---
    bm = bmesh.new()
    add_solid_cylinder(bm, -0.175, 0.148, shaft_r, segs=28)
    obj = finish_stage(
        "shaft",
        bm,
        coll_rotor,
        mats["shaft"],
        "rotor",
        "主轴",
        (0.0, 0.0, 0.0),
        spool,
    )

    bm = bmesh.new()
    # ogive spinner: stacked frusta
    add_frustum_shell(bm, -0.208, -0.198, 0.0, 0.004, 0.0, 0.011, segs=32, cap_start=True, cap_end=False)
    add_frustum_shell(bm, -0.198, -0.182, 0.0, 0.011, 0.0, 0.0155, segs=32, cap_start=False, cap_end=False)
    add_frustum_shell(bm, -0.182, -0.168, 0.0, 0.0155, 0.0, 0.0162, segs=32, cap_start=False, cap_end=True)
    finish_stage("spinner", bm, coll_rotor, mats["spinner"], "rotor", "进气锥", (0.0, -0.06, 0.0), spool)

    for y, pid, label in ((-0.162, "bearing-fwd", "前轴承"), (0.078, "bearing-aft", "后轴承")):
        bm = bmesh.new()
        add_frustum_shell(bm, y - 0.005, y + 0.005, shaft_r, 0.013, shaft_r, 0.013, segs=24)
        finish_stage(pid, bm, coll_rotor, mats["shaft"], "rotor", label, (0.0, 0.0, 0.0), spool)

    # --- inlet ---
    bm = bmesh.new()
    # rounded lip: three tapered shells
    add_frustum_shell(bm, -0.228, -0.216, 0.046, 0.058, 0.047, 0.060, segs=SEGS)
    add_frustum_shell(bm, -0.216, -0.200, 0.047, 0.060, 0.048, 0.056, segs=SEGS, cap_start=False)
    add_frustum_shell(bm, -0.200, -0.178, 0.048, 0.056, 0.0485, 0.053, segs=SEGS, cap_start=False, cap_end=True)
    finish_stage(
        "inlet-lip",
        bm,
        coll_casing,
        mats["inlet"],
        "casing",
        "进气唇口",
        (0.0, -0.12, 0.0),
        casing_root,
    )

    bm = bmesh.new()
    add_frustum_shell(bm, -0.178, -0.158, 0.0485, 0.053, 0.048, 0.0525, segs=SEGS)
    finish_stage(
        "inlet-duct",
        bm,
        coll_casing,
        mats["casing"],
        "casing",
        "进气道",
        (0.0, -0.10, 0.0),
        casing_root,
    )

    # inlet flange bolts
    bm = bmesh.new()
    bolt_circle(bm, -0.218, 0.057, 12, 0.0022, 0.003)
    finish_stage(
        "inlet-flange-bolts",
        bm,
        coll_casing,
        mats["stator"],
        "casing",
        "进气法兰螺栓",
        (0.0, -0.12, 0.0),
        casing_root,
    )

    # --- IGV ---
    bm = bmesh.new()
    add_hub_disk(bm, -0.158, shaft_r + 0.0008, 0.016)
    add_blade_row(
        bm,
        -0.158,
        0.016,
        0.0475,
        13,
        0.010,
        0.10,
        52,
        30,
        rotor=False,
        camber=0.04,
    )
    finish_stage("igv", bm, coll_stator, mats["stator"], "stator", "进口导叶", (0.0, -0.07, 0.0), stator_root)

    # compressor stages
    stages = [
        dict(y=-0.144, hub=0.0165, tip=0.0472, nr=11, ns=13, chord=0.011, tw_h=48, tw_t=26),
        dict(y=-0.118, hub=0.0195, tip=0.0462, nr=13, ns=15, chord=0.010, tw_h=44, tw_t=22),
        dict(y=-0.094, hub=0.0235, tip=0.0452, nr=15, ns=17, chord=0.009, tw_h=40, tw_t=18),
        dict(y=-0.070, hub=0.0275, tip=0.0442, nr=17, ns=19, chord=0.0085, tw_h=36, tw_t=15),
    ]
    for i, st in enumerate(stages, start=1):
        bm = bmesh.new()
        add_hub_disk(bm, st["y"], shaft_r + 0.0006, st["hub"])
        add_blade_row(
            bm,
            st["y"],
            st["hub"],
            st["tip"],
            st["nr"],
            st["chord"],
            0.11,
            st["tw_h"],
            st["tw_t"],
            rotor=True,
            nspan=5,
            nchord=8,
        )
        finish_stage(
            f"comp-rotor-{i}",
            bm,
            coll_rotor,
            mats["titanium"],
            "rotor",
            f"压气机转子 {i} 级",
            (0.0, -0.04 - 0.012 * i, 0.0),
            spool,
        )

        sy = st["y"] + 0.012
        bm = bmesh.new()
        add_hub_disk(bm, sy, shaft_r + 0.0012, st["hub"] + 0.0008, half_t=0.0032)
        add_blade_row(
            bm,
            sy,
            st["hub"] + 0.0008,
            st["tip"] - 0.0004,
            st["ns"],
            st["chord"] * 0.92,
            0.10,
            st["tw_h"] - 4,
            st["tw_t"] - 2,
            rotor=False,
            nspan=5,
            nchord=7,
        )
        finish_stage(
            f"comp-stator-{i}",
            bm,
            coll_stator,
            mats["stator"],
            "stator",
            f"压气机静子 {i} 级",
            (0.0, -0.02 - 0.008 * i, 0.0),
            stator_root,
        )

    # diffuser
    bm = bmesh.new()
    add_frustum_shell(bm, -0.056, -0.028, 0.030, 0.0445, 0.028, 0.062, segs=SEGS)
    add_frustum_shell(bm, -0.056, -0.028, 0.0, 0.0, 0.0, 0.0, segs=8, cap_start=False, cap_end=False)
    finish_stage(
        "diffuser",
        bm,
        coll_stator,
        mats["stator"],
        "stator",
        "扩压器",
        (0.0, -0.02, 0.0),
        stator_root,
    )

    # --- combustor annular liners ---
    bm = bmesh.new()
    add_frustum_shell(bm, -0.026, 0.078, 0.058, 0.070, 0.056, 0.072, segs=SEGS)
    finish_stage(
        "combustor-outer",
        bm,
        coll_casing,
        mats["combustor"],
        "casing",
        "燃烧室外衬",
        (0.10, 0.0, 0.0),
        casing_root,
    )

    bm = bmesh.new()
    add_frustum_shell(bm, -0.022, 0.074, 0.026, 0.034, 0.024, 0.032, segs=40)
    finish_stage(
        "combustor-inner",
        bm,
        coll_casing,
        mats["combustor"],
        "casing",
        "燃烧室内衬",
        (0.0, 0.0, 0.0),
        casing_root,
    )

    bm = bmesh.new()
    add_frustum_shell(bm, -0.028, -0.016, 0.034, 0.070, 0.032, 0.068, segs=SEGS)
    finish_stage(
        "combustor-dome",
        bm,
        coll_casing,
        mats["combustor"],
        "casing",
        "燃烧室头部",
        (0.08, 0.0, 0.0),
        casing_root,
    )

    # swirl cups
    bm = bmesh.new()
    for i in range(10):
        a = 2 * math.pi * i / 10
        r = 0.050
        x, z = r * math.cos(a), r * math.sin(a)
        add_frustum_shell_translated = None
        # local cylinder along Y at (x,z)
        y0, y1 = -0.018, -0.004
        segs = 10
        o0, o1 = [], []
        for k in range(segs):
            ang = 2 * math.pi * k / segs
            o0.append(bm.verts.new((x + 0.0065 * math.cos(ang), y0, z + 0.0065 * math.sin(ang))))
            o1.append(bm.verts.new((x + 0.0055 * math.cos(ang), y1, z + 0.0055 * math.sin(ang))))
        for k in range(segs):
            j = (k + 1) % segs
            try:
                bm.faces.new((o0[k], o1[k], o1[j], o0[j]))
            except ValueError:
                pass
    finish_stage(
        "swirl-cups",
        bm,
        coll_casing,
        mats["inconel"],
        "casing",
        "旋流杯",
        (0.09, 0.0, 0.0),
        casing_root,
    )
    _ = add_frustum_shell_translated

    # dilution bosses (visual rings, not boolean holes)
    bm = bmesh.new()
    add_torus_around_y(bm, 0.018, 0.0715, 0.0022, maj_n=36, min_n=8)
    add_torus_around_y(bm, 0.042, 0.0722, 0.0020, maj_n=36, min_n=8)
    finish_stage(
        "dilution-rings",
        bm,
        coll_casing,
        mats["inconel"],
        "casing",
        "掺混孔加强环",
        (0.10, 0.0, 0.0),
        casing_root,
    )

    # --- turbine ---
    bm = bmesh.new()
    add_hub_disk(bm, 0.090, shaft_r + 0.001, 0.024)
    add_blade_row(bm, 0.090, 0.024, 0.051, 17, 0.011, 0.13, 30, 18, rotor=False, camber=0.045, nspan=5, nchord=8)
    finish_stage("ngv-1", bm, coll_stator, mats["inconel"], "stator", "导向器 1 级", (0.0, 0.04, 0.0), stator_root)

    bm = bmesh.new()
    add_hub_disk(bm, 0.106, shaft_r + 0.0006, 0.022)
    add_blade_row(bm, 0.106, 0.022, 0.0525, 19, 0.012, 0.12, 38, 16, rotor=True, camber=0.05, nspan=5, nchord=8)
    finish_stage(
        "turb-rotor-1",
        bm,
        coll_rotor,
        mats["inconel"],
        "rotor",
        "涡轮转子 1 级",
        (0.0, 0.06, 0.0),
        spool,
    )

    bm = bmesh.new()
    add_hub_disk(bm, 0.122, shaft_r + 0.001, 0.020)
    add_blade_row(bm, 0.122, 0.020, 0.054, 21, 0.010, 0.12, 28, 14, rotor=False, camber=0.04, nspan=5, nchord=7)
    finish_stage("ngv-2", bm, coll_stator, mats["inconel"], "stator", "导向器 2 级", (0.0, 0.07, 0.0), stator_root)

    bm = bmesh.new()
    add_hub_disk(bm, 0.138, shaft_r + 0.0006, 0.018)
    add_blade_row(bm, 0.138, 0.018, 0.055, 23, 0.011, 0.11, 34, 12, rotor=True, camber=0.045, nspan=5, nchord=8)
    finish_stage(
        "turb-rotor-2",
        bm,
        coll_rotor,
        mats["inconel"],
        "rotor",
        "涡轮转子 2 级",
        (0.0, 0.09, 0.0),
        spool,
    )

    # exhaust cone + nozzle
    bm = bmesh.new()
    add_frustum_shell(bm, 0.148, 0.210, 0.0, 0.016, 0.0, 0.009, segs=32, cap_start=True, cap_end=True)
    finish_stage(
        "exhaust-cone",
        bm,
        coll_stator,
        mats["hot"],
        "stator",
        "尾锥",
        (0.0, 0.11, 0.0),
        stator_root,
    )

    bm = bmesh.new()
    add_frustum_shell(bm, 0.150, 0.188, 0.056, 0.062, 0.040, 0.048, segs=SEGS)
    add_frustum_shell(bm, 0.188, 0.228, 0.040, 0.048, 0.027, 0.034, segs=SEGS, cap_start=False, cap_end=True)
    finish_stage(
        "nozzle",
        bm,
        coll_casing,
        mats["hot"],
        "casing",
        "尾喷管",
        (0.0, 0.14, 0.0),
        casing_root,
    )

    # --- outer casings (clearance outside blades) ---
    bm = bmesh.new()
    add_frustum_shell(bm, -0.178, -0.052, 0.0515, 0.058, 0.0465, 0.055, segs=SEGS)
    finish_stage(
        "fwd-casing",
        bm,
        coll_casing,
        mats["casing"],
        "casing",
        "压气机机匣",
        (0.0, 0.0, 0.09),
        casing_root,
    )

    bm = bmesh.new()
    add_frustum_shell(bm, -0.052, 0.086, 0.072, 0.082, 0.073, 0.084, segs=SEGS)
    finish_stage(
        "mid-casing",
        bm,
        coll_casing,
        mats["casing"],
        "casing",
        "中介机匣",
        (0.0, 0.0, 0.12),
        casing_root,
    )

    bm = bmesh.new()
    add_frustum_shell(bm, 0.086, 0.152, 0.057, 0.066, 0.056, 0.064, segs=SEGS)
    finish_stage(
        "aft-casing",
        bm,
        coll_casing,
        mats["casing"],
        "casing",
        "涡轮机匣",
        (0.0, 0.0, 0.10),
        casing_root,
    )

    # casing flanges
    for y, pid, label, r, expz in (
        (-0.052, "flange-fwd", "压气机后法兰", 0.060, 0.09),
        (0.086, "flange-mid", "涡轮前法兰", 0.086, 0.12),
        (0.150, "flange-aft", "喷管法兰", 0.066, 0.10),
    ):
        bm = bmesh.new()
        add_frustum_shell(bm, y - 0.0035, y + 0.0035, r - 0.008, r + 0.006, r - 0.008, r + 0.006, segs=40)
        bolt_circle(bm, y, r + 0.002, 10, 0.002, 0.004)
        finish_stage(pid, bm, coll_casing, mats["stator"], "casing", label, (0.0, 0.0, expz), casing_root)

    # accessory gearbox
    bm = bmesh.new()
    # box under compressor
    x0, x1, y0, y1, z0, z1 = -0.028, 0.028, -0.118, -0.062, -0.078, -0.056
    verts = [
        bm.verts.new((x, y, z))
        for z in (z0, z1)
        for y in (y0, y1)
        for x in (x0, x1)
    ]
    # 8 verts: index x + 2*y + 4*z
    faces_idx = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 2, 6, 4),
        (1, 5, 7, 3),
    ]
    bm.verts.ensure_lookup_table()
    for f in faces_idx:
        try:
            bm.faces.new(tuple(verts[i] for i in f))
        except ValueError:
            pass
    # cooling fins
    for i in range(5):
        fy = y0 + 0.008 + i * 0.010
        add_frustum_shell_dummy = None
        p0 = (-0.024, fy, z0 - 0.006)
        p1 = (0.024, fy, z0 - 0.006)
        add_pipe(bm, [p0, p1], 0.0016, segs=6)
    finish_stage(
        "accessory-gearbox",
        bm,
        coll_casing,
        mats["mount"],
        "casing",
        "附件机匣",
        (0.0, 0.0, -0.12),
        casing_root,
    )
    _ = add_frustum_shell_dummy

    bm = bmesh.new()
    add_solid_cylinder_at(bm, (0.0, -0.090, -0.054), (0.0, -0.090, -0.018), 0.0045, segs=12)
    finish_stage(
        "radial-drive",
        bm,
        coll_casing,
        mats["shaft"],
        "casing",
        "径向传动轴",
        (0.0, 0.0, -0.10),
        casing_root,
    )

    # --- plumbing ---
    bm = bmesh.new()
    add_torus_around_y(bm, -0.010, 0.086, 0.0036, maj_n=32, min_n=10)
    finish_stage(
        "fuel-manifold",
        bm,
        coll_plumb,
        mats["fuel"],
        "plumbing",
        "燃油总管",
        (0.14, 0.0, 0.0),
        plumb_root,
    )

    bm = bmesh.new()
    for i in range(10):
        a = 2 * math.pi * i / 10 + 0.12
        x, z = 0.086 * math.cos(a), 0.086 * math.sin(a)
        xi, zi = 0.070 * math.cos(a), 0.070 * math.sin(a)
        add_pipe(bm, [(x, -0.010, z), (xi, -0.016, zi)], 0.0022, segs=6)
    finish_stage(
        "fuel-injectors",
        bm,
        coll_plumb,
        mats["fuel"],
        "plumbing",
        "燃油喷嘴",
        (0.13, 0.0, 0.0),
        plumb_root,
    )

    bm = bmesh.new()
    add_pipe(
        bm,
        [
            (0.086, -0.010, 0.0),
            (0.110, -0.010, 0.0),
            (0.118, -0.080, -0.02),
            (0.090, -0.130, -0.04),
            (0.020, -0.145, -0.06),
            (0.0, -0.145, -0.072),
        ],
        0.0032,
        segs=8,
    )
    finish_stage(
        "fuel-line",
        bm,
        coll_plumb,
        mats["pipe"],
        "plumbing",
        "供油管",
        (0.16, 0.0, -0.04),
        plumb_root,
    )

    bm = bmesh.new()
    add_pipe(
        bm,
        [
            (-0.054, -0.100, 0.02),
            (-0.072, -0.100, 0.04),
            (-0.080, 0.020, 0.05),
            (-0.070, 0.100, 0.04),
            (-0.050, 0.130, 0.02),
        ],
        0.0028,
        segs=8,
    )
    finish_stage(
        "oil-line",
        bm,
        coll_plumb,
        mats["pipe"],
        "plumbing",
        "滑油管",
        (-0.14, 0.0, 0.04),
        plumb_root,
    )

    bm = bmesh.new()
    add_pipe(
        bm,
        [
            (0.0, -0.080, 0.054),
            (0.0, -0.080, 0.078),
            (0.04, -0.040, 0.090),
            (0.05, 0.040, 0.090),
            (0.02, 0.080, 0.070),
        ],
        0.0030,
        segs=8,
    )
    finish_stage(
        "bleed-pipe",
        bm,
        coll_plumb,
        mats["pipe"],
        "plumbing",
        "引气管",
        (0.04, 0.0, 0.14),
        plumb_root,
    )

    bm = bmesh.new()
    add_solid_cylinder_at(bm, (0.0, 0.030, 0.082), (0.0, 0.030, 0.102), 0.004, segs=10)
    add_solid_cylinder_at(bm, (0.0, 0.030, 0.100), (0.0, 0.030, 0.118), 0.006, segs=10)
    finish_stage(
        "igniter",
        bm,
        coll_plumb,
        mats["igniter"],
        "plumbing",
        "点火电嘴",
        (0.0, 0.0, 0.14),
        plumb_root,
    )

    # --- mounts / struts / stand ---
    bm = bmesh.new()
    add_torus_around_y(bm, -0.130, 0.059, 0.003, maj_n=28, min_n=8)
    finish_stage(
        "mount-ring-fwd",
        bm,
        coll_mount,
        mats["mount"],
        "casing",
        "前安装环",
        (0.0, 0.0, -0.08),
        mount_root,
    )

    bm = bmesh.new()
    add_torus_around_y(bm, 0.070, 0.086, 0.0032, maj_n=28, min_n=8)
    finish_stage(
        "mount-ring-aft",
        bm,
        coll_mount,
        mats["mount"],
        "casing",
        "后安装环",
        (0.0, 0.0, -0.08),
        mount_root,
    )

    bm = bmesh.new()
    # four struts down to rails
    for x in (-0.045, 0.045):
        add_pipe(bm, [(x, -0.130, -0.050), (x, -0.130, -0.095), (x, -0.110, -0.118)], 0.0038, segs=8)
        add_pipe(bm, [(x, 0.070, -0.078), (x, 0.070, -0.100), (x, 0.040, -0.118)], 0.0038, segs=8)
    finish_stage(
        "struts",
        bm,
        coll_mount,
        mats["mount"],
        "casing",
        "安装撑杆",
        (0.0, 0.0, -0.14),
        mount_root,
    )

    bm = bmesh.new()
    # base plate
    add_frustum_shell(bm, -0.160, 0.090, 0.0, 0.0, 0.0, 0.0, segs=4, cap_start=False, cap_end=False)
    # actual box plate
    vs = []
    for y in (-0.170, 0.100):
        for x in (-0.070, 0.070):
            for z in (-0.128, -0.118):
                vs.append(bm.verts.new((x, y, z)))
    bm.verts.ensure_lookup_table()
    # skip messy indexing — build plate as thick box via two shells
    bm.free()
    bm = bmesh.new()
    y0, y1 = -0.175, 0.105
    xw, zw, zh = 0.075, -0.123, 0.010
    corners = []
    for zi in (zw, zw + zh):
        for yi in (y0, y1):
            for xi in (-xw, xw):
                corners.append(bm.verts.new((xi, yi, zi)))
    bm.verts.ensure_lookup_table()
    idx = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 2, 6, 4),
        (1, 5, 7, 3),
    ]
    for f in idx:
        try:
            bm.faces.new(tuple(corners[i] for i in f))
        except ValueError:
            pass
    finish_stage(
        "stand-base",
        bm,
        coll_mount,
        mats["base"],
        "casing",
        "试验台底座",
        (0.0, 0.0, -0.16),
        mount_root,
    )

    # inlet struts (structural, in duct)
    bm = bmesh.new()
    add_blade_row(
        bm,
        -0.188,
        0.016,
        0.048,
        5,
        0.012,
        0.16,
        0,
        0,
        rotor=False,
        camber=0.0,
        nspan=4,
        nchord=5,
    )
    finish_stage(
        "inlet-struts",
        bm,
        coll_stator,
        mats["stator"],
        "stator",
        "进气支板",
        (0.0, -0.09, 0.0),
        stator_root,
    )

    write_mapping(spool)
    shade_all()
    export_glb()
    save_blend()
    render_preview()
    print("parts", len(PARTS))
    print("glb", GLB_PATH, "bytes", GLB_PATH.stat().st_size if GLB_PATH.exists() else 0)


def write_mapping(spool) -> None:
    payload = {
        "engine": "small-axial-turbojet",
        "monitorOnly": True,
        "axis": "gltf-y-up",
        "blenderAxis": "Y-forward-Z-up",
        "spin": {
            "nodeName": "RotorSpool",
            "axis": blender_to_gltf(0.0, 1.0, 0.0),
            "note": "Rotate RotorSpool around this glTF axis",
        },
        "clip": {
            "planeNormal": [1.0, 0.0, 0.0],
            "constant": 0.0,
            "groups": ["casing"],
        },
        "parts": PARTS,
        "counts": {
            "parts": len(PARTS),
            "rotor": sum(1 for p in PARTS if p["group"] == "rotor"),
            "stator": sum(1 for p in PARTS if p["group"] == "stator"),
            "casing": sum(1 for p in PARTS if p["group"] == "casing"),
            "plumbing": sum(1 for p in PARTS if p["group"] == "plumbing"),
        },
    }
    EXPORT.mkdir(parents=True, exist_ok=True)
    MAP_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / "part-mapping.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [
        "# 涡喷零件映射",
        "",
        "监视-only。对象为小型轴流涡喷装配，不是恒光橇装 / 能源站 / 液输换热。",
        "",
        f"零件数：**{len(PARTS)}**。GLB：`export/turbojet.glb`。",
        "",
        "| partId | group | 中文 | explode (glTF xyz) |",
        "| --- | --- | --- | --- |",
    ]
    for p in PARTS:
        lines.append(
            f"| `{p['partId']}` | {p['group']} | {p['labelZh']} | {p['explode']} |"
        )
    MAP_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    _ = spool


def shade_all() -> None:
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        for p in mesh.polygons:
            p.use_smooth = True
        if hasattr(mesh, "shade_smooth"):
            try:
                mesh.shade_smooth()
            except Exception:
                pass


def export_glb() -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_extras=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        use_selection=False,
    )
    print("exported", GLB_PATH)


def save_blend() -> None:
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print("saved", BLEND_PATH)


def render_preview() -> None:
    cam_data = bpy.data.cameras.new("TurbojetPreview")
    cam_data.lens = 50
    cam = bpy.data.objects.new("TurbojetPreview", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam_data.clip_start = 0.02
    cam_data.clip_end = 20.0
    cam_data.lens = 35
    cam.location = (0.52, -0.58, 0.24)
    direction = Vector((0.0, 0.0, 0.0)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Z").to_euler()
    bpy.context.scene.camera = cam
    bpy.context.view_layer.update()

    sun = bpy.data.lights.new("Sun", type="SUN")
    sun.energy = 5.5
    sun.angle = 0.18
    sun_obj = bpy.data.objects.new("Sun", sun)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (0.95, 0.25, 0.55)

    fill = bpy.data.lights.new("Fill", type="AREA")
    fill.energy = 180
    fill.size = 0.6
    fill_obj = bpy.data.objects.new("Fill", fill)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-0.35, -0.20, 0.25)
    fill_obj.rotation_euler = (1.1, 0.0, -0.7)

    rim = bpy.data.lights.new("Rim", type="AREA")
    rim.energy = 90
    rim.size = 0.4
    rim_obj = bpy.data.objects.new("Rim", rim)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0.15, 0.35, 0.18)
    rim_obj.rotation_euler = (0.6, 0.2, 2.4)

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.18, 0.22, 0.28, 1.0)
        bg.inputs[1].default_value = 0.55

    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    bpy.ops.render.render(write_still=True)
    print("preview", PREVIEW_PATH)


if __name__ == "__main__":
    try:
        build()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
