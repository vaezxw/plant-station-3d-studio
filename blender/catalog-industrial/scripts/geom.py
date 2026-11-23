# Shared DN100 PN16 hard-surface helpers for industrial catalog (Blender bmesh).
from __future__ import annotations

import math
from typing import Iterable, Sequence

import bmesh
import bpy
from mathutils import Matrix, Vector

# --- frozen spec (metres) ----------------------------------------------------
PIPE_OD = 0.1143
PIPE_ID = 0.0960
FLANGE_OD = 0.220
FLANGE_THK = 0.022
RF_OD = 0.158
RF_H = 0.002
PCD = 0.180
HOLE_D = 0.018
N_BOLTS = 8
BOLT_D = 0.016
NUT_AF = 0.024
HEAD_H = 0.010
NUT_H = 0.013
NECK_LEN = 0.040
GASKET = 0.002
ELBOW_R = 1.5 * PIPE_OD  # 0.17145
PIPE_FF = 1.00
VALVE_FF = 0.40
SEGS_PIPE = 32
SEGS_FLANGE = 48
SEGS_BOLT = 12
SEGS_HOLE = 10
WASHER_OD = 0.030
WASHER_THK = 0.002

DN = 100
PN = 16
SPEC = "dn100-pn16-v2"


def reset_scene() -> None:
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


def empty(name: str, coll, loc=(0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.04
    obj.location = loc
    coll.objects.link(obj)
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def shade_smooth(obj, angle_deg: float = 30.0) -> None:
    mesh = obj.data
    if not hasattr(mesh, "polygons"):
        return
    for p in mesh.polygons:
        p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle_deg))
        obj.select_set(False)
    except Exception:
        pass


def bm_to_obj(name: str, bm, coll):
    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj


def assign_mat(obj, mat) -> None:
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def set_props(obj, **kwargs) -> None:
    for k, v in kwargs.items():
        obj[k] = v


def select_hierarchy(root) -> None:
    bpy.ops.object.select_all(action="DESELECT")

    def walk(o):
        o.select_set(True)
        for c in o.children:
            walk(c)

    walk(root)
    bpy.context.view_layer.objects.active = root


def count_tris(root) -> int:
    n = 0

    def walk(o):
        nonlocal n
        if o.type == "MESH" and o.data:
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
        for c in o.children:
            walk(c)

    walk(root)
    return n


def orphan_hide(obj) -> None:
    obj.hide_render = True
    obj.hide_viewport = True


# --- bmesh primitives --------------------------------------------------------


def _basis(axis: Vector):
    axis = Vector(axis).normalized()
    helper = Vector((0.0, 0.0, 1.0)) if abs(axis.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    x = axis.cross(helper).normalized()
    y = axis.cross(x).normalized()
    return x, y, axis


def ring(bm, center, axis, radius, segs, twist=0.0):
    x, y, _ = _basis(axis)
    c = Vector(center)
    verts = []
    for i in range(segs):
        a = twist + 2.0 * math.pi * i / segs
        p = c + x * (radius * math.cos(a)) + y * (radius * math.sin(a))
        verts.append(bm.verts.new(p))
    return verts


def bridge(bm, a, b, flip=False):
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        try:
            if flip:
                bm.faces.new((a[i], b[i], b[j], a[j]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
        except ValueError:
            pass


def cap_disk(bm, ring_v, center, flip=False):
    c = bm.verts.new(Vector(center))
    n = len(ring_v)
    for i in range(n):
        j = (i + 1) % n
        try:
            if flip:
                bm.faces.new((c, ring_v[j], ring_v[i]))
            else:
                bm.faces.new((c, ring_v[i], ring_v[j]))
        except ValueError:
            pass
    return c


def add_tube(bm, p0, p1, r_out, r_in=0.0, segs=SEGS_PIPE, cap_start=True, cap_end=True):
    p0 = Vector(p0)
    p1 = Vector(p1)
    axis = p1 - p0
    if axis.length < 1e-8:
        return
    o0 = ring(bm, p0, axis, r_out, segs)
    o1 = ring(bm, p1, axis, r_out, segs)
    bridge(bm, o0, o1)
    if r_in > 1e-6:
        i0 = ring(bm, p0, axis, r_in, segs)
        i1 = ring(bm, p1, axis, r_in, segs)
        bridge(bm, i1, i0)
        if cap_start:
            bridge(bm, o0, i0)
        if cap_end:
            bridge(bm, i1, o1)
    else:
        if cap_start:
            cap_disk(bm, o0, p0, flip=True)
        if cap_end:
            cap_disk(bm, o1, p1, flip=False)


def add_cyl(bm, p0, p1, r, segs=16, cap=True):
    add_tube(bm, p0, p1, r, 0.0, segs=segs, cap_start=cap, cap_end=cap)


def add_box(bm, center, size, axes=None):
    c = Vector(center)
    sx, sy, sz = size
    if axes is None:
        ax, ay, az = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    else:
        ax, ay, az = (Vector(a).normalized() for a in axes)
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    corners = []
    for ix in (-hx, hx):
        for iy in (-hy, hy):
            for iz in (-hz, hz):
                corners.append(bm.verts.new(c + ax * ix + ay * iy + az * iz))
    # indexing: 0(---) 1(--+) 2(-+-) 3(-++) 4(+--) 5(+-+) 6(++-) 7(+++)
    faces = [
        (0, 1, 3, 2),  # -x
        (4, 6, 7, 5),  # +x
        (0, 4, 5, 1),  # -y
        (2, 3, 7, 6),  # +y
        (0, 2, 6, 4),  # -z
        (1, 5, 7, 3),  # +z
    ]
    for f in faces:
        try:
            bm.faces.new(tuple(corners[i] for i in f))
        except ValueError:
            pass


def add_hex_prism(bm, center, axis, across_flats, height, segs=6):
    axis = Vector(axis).normalized()
    r = across_flats / math.sqrt(3.0)
    h0 = Vector(center) - axis * (height * 0.5)
    h1 = Vector(center) + axis * (height * 0.5)
    a = ring(bm, h0, axis, r, segs, twist=math.pi / 6)
    b = ring(bm, h1, axis, r, segs, twist=math.pi / 6)
    bridge(bm, a, b)
    cap_disk(bm, a, h0, flip=True)
    cap_disk(bm, b, h1, flip=False)


def add_cone(bm, base, tip, r, segs=12):
    base = Vector(base)
    tip = Vector(tip)
    axis = tip - base
    rv = ring(bm, base, axis, r, segs)
    tv = bm.verts.new(tip)
    n = len(rv)
    for i in range(n):
        j = (i + 1) % n
        try:
            bm.faces.new((rv[i], rv[j], tv))
        except ValueError:
            pass
    cap_disk(bm, rv, base, flip=True)


def add_uv_sphere(bm, center, radius, segs_u=16, segs_v=10, hemi=None):
    """hemi: None full, 'pos' along +Z of local, use axis via... we use world Z."""
    c = Vector(center)
    v0 = 0
    v1 = segs_v
    if hemi == "+z":
        v0 = segs_v // 2
    elif hemi == "-z":
        v1 = segs_v // 2
    rows = []
    for vi in range(v0, v1 + 1):
        v = vi / segs_v
        phi = math.pi * v
        y = math.cos(phi)
        rs = math.sin(phi)
        row = []
        for ui in range(segs_u):
            th = 2 * math.pi * ui / segs_u
            p = c + Vector((rs * math.cos(th) * radius, rs * math.sin(th) * radius, y * radius))
            row.append(bm.verts.new(p))
        rows.append(row)
    for ri in range(len(rows) - 1):
        bridge(bm, rows[ri], rows[ri + 1])
    if hemi is None:
        if rows[0] and (rows[0][0].co - rows[0][1].co).length < radius * 0.05:
            pass


def add_ellipsoid_head(bm, center, axis, radius, height, segs_u=20, segs_v=6, inward=False):
    """2:1 elliptical head. axis points toward the pole (away from shell)."""
    axis = Vector(axis).normalized()
    x, y, _ = _basis(axis)
    c = Vector(center)
    sign = -1.0 if inward else 1.0
    rows = []
    for vi in range(segs_v + 1):
        t = vi / segs_v * (math.pi / 2)
        r = radius * math.cos(t)
        h = height * math.sin(t) * sign
        ring_c = c + axis * h
        if r < 1e-5:
            rows.append([bm.verts.new(ring_c)])
        else:
            rows.append(ring(bm, ring_c, axis, r, segs_u))
    for ri in range(len(rows) - 1):
        a, b = rows[ri], rows[ri + 1]
        if len(a) == 1 and len(b) == 1:
            continue
        if len(b) == 1:
            for i in range(len(a)):
                j = (i + 1) % len(a)
                try:
                    bm.faces.new((a[i], a[j], b[0]))
                except ValueError:
                    pass
        else:
            bridge(bm, a, b)


def add_torus_weld(bm, center, axis, major, minor, segs_u=16, segs_v=6):
    axis = Vector(axis).normalized()
    x, y, _ = _basis(axis)
    c = Vector(center)
    rings = []
    for i in range(segs_u):
        a = 2 * math.pi * i / segs_u
        rc = c + x * (major * math.cos(a)) + y * (major * math.sin(a))
        # minor circle in plane of (radial, axis)
        radial = (x * math.cos(a) + y * math.sin(a)).normalized()
        row = []
        for j in range(segs_v):
            b = 2 * math.pi * j / segs_v
            p = rc + radial * (minor * math.cos(b)) + axis * (minor * math.sin(b))
            row.append(bm.verts.new(p))
        rings.append(row)
    for i in range(segs_u):
        bridge(bm, rings[i], rings[(i + 1) % segs_u])


def add_quarter_elbow(bm, radius, r_out, r_in, segs_sweep=14, segs_circ=20):
    """Bend center at origin. End A (0,-R,0) tangent +X; end B (R,0,0) tangent +Y."""
    outer = []
    inner = []
    for i in range(segs_sweep + 1):
        th = -math.pi / 2 + (math.pi / 2) * i / segs_sweep
        c = Vector((radius * math.cos(th), radius * math.sin(th), 0.0))
        t = Vector((-math.sin(th), math.cos(th), 0.0))
        outer.append(ring(bm, c, t, r_out, segs_circ))
        inner.append(ring(bm, c, t, r_in, segs_circ))
    for i in range(segs_sweep):
        bridge(bm, outer[i], outer[i + 1])
        bridge(bm, inner[i + 1], inner[i])
    bridge(bm, outer[0], inner[0])
    bridge(bm, inner[-1], outer[-1])


# --- materials ---------------------------------------------------------------


def make_material(
    name: str,
    color: tuple[float, float, float],
    metallic: float,
    roughness: float,
    *,
    coat: float = 0.0,
    alpha: float = 1.0,
    transmission: float = 0.0,
    ior: float = 1.45,
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
            bsdf.inputs["Coat Roughness"].default_value = 0.14
    if alpha < 0.999:
        mat.blend_method = "BLEND"
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
    if transmission > 0 and "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission
        if "IOR" in bsdf.inputs:
            bsdf.inputs["IOR"].default_value = ior
        mat.blend_method = "BLEND"
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = min(alpha, 0.35)
    return mat


def library_materials():
    """v2 分件涂装。禁止全库一个浅黄。颜色为线性近似（对应 sRGB RAL 备注）。"""
    return {
        # RAL 1021/1023 燃气黄，比旧 0.72/0.55/0.12 更深更饱和
        "Paint_YellowPipe": make_material("Paint_YellowPipe", (0.74, 0.46, 0.02), 0.0, 0.46, coat=0.22),
        "Paint_GreyBody": make_material("Paint_GreyBody", (0.55, 0.57, 0.58), 0.0, 0.50, coat=0.14),
        "Paint_ActuatorBlue": make_material("Paint_ActuatorBlue", (0.03, 0.12, 0.22), 0.0, 0.42, coat=0.18),
        "Paint_SafetyRed": make_material("Paint_SafetyRed", (0.36, 0.03, 0.035), 0.0, 0.42, coat=0.16),
        "Paint_SafetyOrange": make_material("Paint_SafetyOrange", (0.55, 0.18, 0.03), 0.0, 0.44, coat=0.16),
        "Paint_Black": make_material("Paint_Black", (0.04, 0.04, 0.045), 0.0, 0.55),
        "Paint_GreenYellow": make_material("Paint_GreenYellow", (0.18, 0.50, 0.10), 0.0, 0.48, coat=0.10),
        "Paint_EpoxyWhite": make_material("Paint_EpoxyWhite", (0.62, 0.64, 0.66), 0.0, 0.48, coat=0.12),
        "Paint_SkidGalv": make_material("Paint_SkidGalv", (0.38, 0.40, 0.42), 0.35, 0.48),
        "Paint_Grate": make_material("Paint_Grate", (0.12, 0.13, 0.14), 0.25, 0.55),
        "Metal_Machined": make_material("Metal_Machined", (0.48, 0.50, 0.53), 0.92, 0.32),
        "Metal_Galvanized": make_material("Metal_Galvanized", (0.14, 0.16, 0.145), 0.82, 0.42),
        "Metal_Stainless": make_material("Metal_Stainless", (0.55, 0.56, 0.58), 0.88, 0.30),
        "Metal_Plate": make_material("Metal_Plate", (0.42, 0.43, 0.45), 0.55, 0.40),
        "Rubber_Black": make_material("Rubber_Black", (0.03, 0.03, 0.03), 0.0, 0.78),
        "Glass_Instrument": make_material(
            "Glass_Instrument", (0.05, 0.07, 0.08), 0.0, 0.06, alpha=0.32, transmission=0.8
        ),
        "Plastic_Nameplate": make_material("Plastic_Nameplate", (0.72, 0.73, 0.74), 0.15, 0.42),
        "Paint_White": make_material("Paint_White", (0.78, 0.78, 0.76), 0.0, 0.48),
        "Paint_Cast": make_material("Paint_Cast", (0.22, 0.23, 0.24), 0.08, 0.58, coat=0.08),
        "Metal_StripeBlack": make_material("Metal_StripeBlack", (0.03, 0.03, 0.03), 0.2, 0.48),
    }


# --- bolts / flanges ---------------------------------------------------------

_BOLT_MESH = {"assy": None, "hole": None}


def reset_bolt_cache() -> None:
    _BOLT_MESH["assy"] = None
    _BOLT_MESH["hole"] = None


def _ensure_bolt_meshes(coll, mats):
    """One assembly: washer + short hex head ON the RF + shank only through the flange + nut.

    Local +X = outward from sealing face. x=0 is the RF plane. No long rod past the hex
    (that was the radial/axial spike in v1).
    """
    if _BOLT_MESH["assy"] is not None:
        return
    clamp = RF_H + FLANGE_THK
    bm = bmesh.new()
    # washer sitting on RF
    add_tube(bm, (0.0004, 0, 0), (WASHER_THK, 0, 0), WASHER_OD * 0.5, BOLT_D * 0.52, segs=SEGS_BOLT)
    # hex head: seat on washer, extruded outward
    add_hex_prism(
        bm,
        (WASHER_THK + HEAD_H * 0.5, 0, 0),
        Vector((1, 0, 0)),
        NUT_AF,
        HEAD_H,
        segs=6,
    )
    # shank only through the plate (plus 1 mm into nut)
    add_cyl(bm, (0.0002, 0, 0), (-(clamp + 0.001), 0, 0), BOLT_D * 0.5, segs=SEGS_BOLT)
    # back washer + nut
    add_tube(
        bm,
        (-clamp, 0, 0),
        (-(clamp + WASHER_THK), 0, 0),
        WASHER_OD * 0.5,
        BOLT_D * 0.52,
        segs=SEGS_BOLT,
    )
    add_hex_prism(
        bm,
        (-(clamp + WASHER_THK + NUT_H * 0.5), 0, 0),
        Vector((1, 0, 0)),
        NUT_AF,
        NUT_H,
        segs=6,
    )
    assy = bm_to_obj("_BoltAssy", bm, coll)
    assign_mat(assy, mats["Metal_Galvanized"])
    shade_smooth(assy, 18)
    orphan_hide(assy)
    _BOLT_MESH["assy"] = assy
    bm = bmesh.new()
    add_cyl(bm, (0.0008, 0, 0), (-(RF_H + FLANGE_THK), 0, 0), HOLE_D * 0.48, segs=SEGS_HOLE)
    hole = bm_to_obj("_BoltHole", bm, coll)
    assign_mat(hole, mats["Paint_Black"])
    orphan_hide(hole)
    _BOLT_MESH["hole"] = hole


def instance_of(src, name, coll, loc, parent, rot=None):
    obj = src.copy()
    obj.data = src.data
    obj.name = name
    obj.location = loc
    if rot is not None:
        obj.rotation_euler = rot
    obj.hide_render = False
    obj.hide_viewport = False
    coll.objects.link(obj)
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = Matrix.Identity(4)
    return obj


def add_bolt_circle(coll, parent, mats, face_x: float, facing: float, prefix: str):
    """facing +1: RF looks +X. Hex heads sit on the sealing face; no radial spikes."""
    _ensure_bolt_meshes(coll, mats)
    src = _BOLT_MESH["assy"]
    hole_src = _BOLT_MESH["hole"]
    rot = (0.0, 0.0, 0.0) if facing > 0 else (0.0, 0.0, math.pi)
    for i in range(N_BOLTS):
        ang = 2 * math.pi * i / N_BOLTS + math.pi / N_BOLTS
        y = (PCD * 0.5) * math.cos(ang)
        z = (PCD * 0.5) * math.sin(ang)
        instance_of(src, f"{prefix}_Bolt_{i+1:02d}", coll, (face_x, y, z), parent, rot)
        instance_of(hole_src, f"{prefix}_Hole_{i+1:02d}", coll, (face_x, y, z), parent, rot)


def flange_stack() -> float:
    return RF_H + FLANGE_THK + NECK_LEN


def make_wn_flange_mesh(name: str, coll, mats, face_x: float, facing: float):
    """WN + RF. facing +1 looks +X. Origin of object at world origin; verts in world."""
    bm = bmesh.new()
    f = facing
    # RF
    rf0 = face_x - f * RF_H
    rf1 = face_x
    add_tube(bm, (rf0, 0, 0), (rf1, 0, 0), RF_OD * 0.5, PIPE_ID * 0.5, segs=SEGS_FLANGE)
    # Disk
    d1 = rf0
    d0 = rf0 - f * FLANGE_THK
    add_tube(bm, (d0, 0, 0), (d1, 0, 0), FLANGE_OD * 0.5, PIPE_ID * 0.5, segs=SEGS_FLANGE)
    # Hub / neck taper
    n0 = d0
    n1 = d0 - f * NECK_LEN
    # outer taper FLANGE hub ~0.14 → PIPE_OD
    hub0 = 0.148
    add_tube(bm, (n0, 0, 0), (n1, 0, 0), hub0 * 0.5, PIPE_ID * 0.5, segs=SEGS_PIPE)
    # small step to pipe OD
    add_tube(bm, (n1, 0, 0), (n1 - f * 0.004, 0, 0), PIPE_OD * 0.5, PIPE_ID * 0.5, segs=SEGS_PIPE)
    obj = bm_to_obj(name, bm, coll)
    assign_mat(obj, mats["Paint_YellowPipe"])
    shade_smooth(obj, 28)
    # machined RF overlay as separate thin disk (metal)
    bm = bmesh.new()
    add_tube(
        bm,
        (rf1 - f * 0.0004, 0, 0),
        (rf1 + f * 0.0002, 0, 0),
        RF_OD * 0.5 - 0.001,
        PIPE_ID * 0.5,
        segs=SEGS_FLANGE,
    )
    rf = bm_to_obj(f"{name}_RF", bm, coll)
    assign_mat(rf, mats["Metal_Machined"])
    shade_smooth(rf, 25)
    return obj, rf, n1 - f * 0.004  # pipe join x


def make_pipe_body(name, coll, mats, x0, x1):
    bm = bmesh.new()
    add_tube(bm, (x0, 0, 0), (x1, 0, 0), PIPE_OD * 0.5, PIPE_ID * 0.5, segs=SEGS_PIPE)
    obj = bm_to_obj(name, bm, coll)
    assign_mat(obj, mats["Paint_YellowPipe"])
    shade_smooth(obj)
    return obj


def make_weld(name, coll, mats, x, axis=(1, 0, 0)):
    bm = bmesh.new()
    add_torus_weld(bm, (x, 0, 0), Vector(axis), PIPE_OD * 0.5, 0.0035, segs_u=16, segs_v=6)
    obj = bm_to_obj(name, bm, coll)
    assign_mat(obj, mats["Paint_GreyBody"])
    shade_smooth(obj, 40)
    return obj


def parent_keep(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


def tag_root(root, kind: str, extras: dict | None = None):
    set_props(root, catalogKind=kind, spec=SPEC, dn=DN, pn=PN, lod="high", unit="m")
    if extras:
        set_props(root, **extras)


def make_port(coll, parent, name: str, loc, kind="in"):
    e = empty(name, coll, loc, parent)
    e["dn"] = DN
    e["pn"] = PN
    e["port"] = kind
    # local +X is outflow: for port_in at -X face, empty rotation so +X points out (−X world)
    if kind == "in":
        e.rotation_euler = (0.0, 0.0, math.pi)
    elif kind == "out":
        e.rotation_euler = (0.0, 0.0, 0.0)
    elif kind == "up":
        e.rotation_euler = (0.0, -math.pi / 2, 0.0)
    return e


def apply_mesh_rots(objs: Iterable):
    for obj in objs:
        if obj.type != "MESH":
            continue
        try:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            obj.select_set(False)
        except Exception:
            pass
