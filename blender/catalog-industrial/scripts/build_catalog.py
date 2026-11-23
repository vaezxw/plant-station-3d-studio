# Industrial catalog (DN100 PN16). Blender 4.5 CLI.
# blender --background --python E:\catalog-industrial-blender\scripts\build_catalog.py
from __future__ import annotations

import json
import math
import shutil
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

import geom as G  # noqa: E402
from pngs import write_all  # noqa: E402

ROOT = Path(r"E:\catalog-industrial-blender")
EXPORT = ROOT / "export" / "catalog"
BLEND = ROOT / "export" / "industrial-catalog.blend"
TEX = ROOT / "textures"
PUBLIC = Path(r"E:\hengguang-plant-dashboard\public\assets\catalog")
REPORT = ROOT / "export" / "triangle-report.json"

CTX = {}


def mats():
    return CTX["mats"]


def coll():
    return CTX["coll"]


def tex(key: str) -> Path:
    return CTX["tex"][key]


def image_mat(name: str, png: Path, metallic=0.0, roughness=0.52):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = G.make_material(name, (0.9, 0.88, 0.8), metallic, roughness)
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    img = bpy.data.images.load(str(png))
    img.colorspace_settings.name = "sRGB"
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.location = (-320, 0)
    nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def plate_uv_box(bm, size):
    uv = bm.loops.layers.uv.new("UVMap")
    sx, sy, sz = size
    for face in bm.faces:
        for loop in face.loops:
            p = loop.vert.co
            loop[uv].uv = Vector((p.y / max(sy, 1e-6) + 0.5, p.z / max(sz, 1e-6) + 0.5))


def make_nameplate(name, coll, png, parent, loc, rot=(0, 0.0, 0.0), size=(0.004, 0.088, 0.044)):
    bm = bmesh.new()
    G.add_box(bm, (0, 0, 0), size)
    plate_uv_box(bm, size)
    obj = G.bm_to_obj(name, bm, coll)
    G.assign_mat(obj, image_mat(f"Mat_{name}", png))
    obj.location = loc
    obj.rotation_euler = rot
    G.parent_keep(obj, parent)
    obj.data.materials[0].use_backface_culling = False
    return obj


def make_flange_assy(name: str):
    holder = G.empty(name, coll())
    body, rf, join_x = G.make_wn_flange_mesh(f"{name}_Body", coll(), mats(), 0.0, +1.0)
    G.parent_keep(body, holder)
    G.parent_keep(rf, holder)
    G.add_bolt_circle(coll(), holder, mats(), 0.0, +1.0, name)
    weld = G.make_weld(f"{name}_Weld", coll(), mats(), join_x)
    G.parent_keep(weld, holder)
    holder["joinLocalX"] = float(join_x)
    return holder, float(join_x)


def place(obj, loc, euler, parent):
    obj.location = loc
    obj.rotation_euler = euler
    G.parent_keep(obj, parent)


def new_root(kind: str):
    c = G.ensure_coll(kind)
    root = G.empty(kind, c)
    G.tag_root(root, kind)
    return root, c


def box_obj(name, center, size, mat, parent, axes=None):
    bm = bmesh.new()
    G.add_box(bm, center, size, axes)
    obj = G.bm_to_obj(name, bm, coll())
    G.assign_mat(obj, mat)
    G.shade_smooth(obj, 20)
    G.parent_keep(obj, parent)
    return obj


def cyl_obj(name, p0, p1, r, mat, parent, segs=16):
    bm = bmesh.new()
    G.add_cyl(bm, p0, p1, r, segs=segs)
    obj = G.bm_to_obj(name, bm, coll())
    G.assign_mat(obj, mat)
    G.shade_smooth(obj)
    G.parent_keep(obj, parent)
    return obj


def tube_obj(name, p0, p1, ro, ri, mat, parent, segs=20):
    bm = bmesh.new()
    G.add_tube(bm, p0, p1, ro, ri, segs=segs)
    obj = G.bm_to_obj(name, bm, coll())
    G.assign_mat(obj, mat)
    G.shade_smooth(obj)
    G.parent_keep(obj, parent)
    return obj


def hex_obj(name, center, axis, af, h, mat, parent):
    bm = bmesh.new()
    G.add_hex_prism(bm, center, Vector(axis), af, h)
    obj = G.bm_to_obj(name, bm, coll())
    G.assign_mat(obj, mat)
    G.shade_smooth(obj, 15)
    G.parent_keep(obj, parent)
    return obj


# --- pipe family -------------------------------------------------------------


def build_flange():
    root, _ = new_root("FLANGE")
    CTX["coll"] = bpy.data.collections["FLANGE"]
    assy, join = make_flange_assy("Flange_A")
    place(assy, (0, 0, 0), (0, 0, 0), root)
    stub_end = join - 0.06
    tube_obj("Stub", (join, 0, 0), (stub_end, 0, 0), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, mats()["Paint_YellowPipe"], root)
    # bevel ring at stub
    bm = bmesh.new()
    G.add_cone(bm, (stub_end, 0, 0), (stub_end - 0.012, 0, 0), G.PIPE_OD * 0.5, segs=20)
    bevel = G.bm_to_obj("Bevel", bm, coll())
    G.assign_mat(bevel, mats()["Metal_Machined"])
    G.parent_keep(bevel, root)
    make_nameplate("Nameplate", coll(), tex("plate_flange"), root, (0.01, 0, G.FLANGE_OD * 0.5 + 0.01))
    G.make_port(coll(), root, "port_in", (0, 0, 0), "in")
    G.make_port(coll(), root, "port_out", (stub_end, 0, 0), "out")
    assy.children[0].name = "body-core"
    return root


def build_pipe():
    root, _ = new_root("PIPE")
    CTX["coll"] = bpy.data.collections["PIPE"]
    ff = G.PIPE_FF
    fa, j = make_flange_assy("Flange_A")
    fb, _ = make_flange_assy("Flange_B")
    place(fa, (-ff * 0.5, 0, 0), (0, 0, math.pi), root)
    place(fb, (ff * 0.5, 0, 0), (0, 0, 0), root)
    x0, x1 = -ff * 0.5 + abs(j), ff * 0.5 - abs(j)
    body = tube_obj("PipeBody", (x0, 0, 0), (x1, 0, 0), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, mats()["Paint_YellowPipe"], root, segs=G.SEGS_PIPE)
    body.name = "body-core"
    # longitudinal weld
    cyl_obj("LongSeam", (x0, 0, G.PIPE_OD * 0.5), (x1, 0, G.PIPE_OD * 0.5), 0.0022, mats()["Paint_GreyBody"], root, segs=8)
    make_nameplate("Nameplate", coll(), tex("plate_pipe"), root, (0, 0, G.PIPE_OD * 0.5 + 0.02))
    G.make_port(coll(), root, "port_in", (-ff * 0.5, 0, 0), "in")
    G.make_port(coll(), root, "port_out", (ff * 0.5, 0, 0), "out")
    return root


def build_elbow():
    root, _ = new_root("PIPE_ELBOW")
    CTX["coll"] = bpy.data.collections["PIPE_ELBOW"]
    r = G.ELBOW_R
    bm = bmesh.new()
    G.add_quarter_elbow(bm, r, G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, segs_sweep=22, segs_circ=28)
    body = G.bm_to_obj("body-core", bm, coll())
    G.assign_mat(body, mats()["Paint_YellowPipe"])
    G.shade_smooth(body)
    G.parent_keep(body, root)
    fa, j = make_flange_assy("Flange_A")
    fb, _ = make_flange_assy("Flange_B")
    jl = abs(j)
    place(fa, (-jl, -r, 0), (0, 0, math.pi), root)
    place(fb, (r, jl, 0), (0, 0, math.pi / 2), root)
    make_nameplate("Nameplate", coll(), tex("plate_elbow"), root, (r * 0.35, -r * 0.35, G.PIPE_OD * 0.5 + 0.02))
    G.make_port(coll(), root, "port_in", (-jl, -r, 0), "in")
    po = G.make_port(coll(), root, "port_out", (r, jl, 0), "out")
    po.rotation_euler = (0, 0, math.pi / 2)
    return root


# --- valves ------------------------------------------------------------------


def add_inline_flanges(root, ff):
    fa, j = make_flange_assy("Flange_A")
    fb, _ = make_flange_assy("Flange_B")
    place(fa, (-ff * 0.5, 0, 0), (0, 0, math.pi), root)
    place(fb, (ff * 0.5, 0, 0), (0, 0, 0), root)
    G.make_port(coll(), root, "port_in", (-ff * 0.5, 0, 0), "in")
    G.make_port(coll(), root, "port_out", (ff * 0.5, 0, 0), "out")
    return abs(j)


def cast_body(root, half_run, color_mat=None):
    m = color_mat or mats()["Paint_YellowPipe"]
    # cylindrical runs
    tube_obj("Run_A", (-half_run, 0, 0), (-0.04, 0, 0), G.PIPE_OD * 0.55, G.PIPE_ID * 0.5, m, root, 20)
    tube_obj("Run_B", (0.04, 0, 0), (half_run, 0, 0), G.PIPE_OD * 0.55, G.PIPE_ID * 0.5, m, root, 20)
    # cast center (slightly faceted sphere via segs)
    bm = bmesh.new()
    G.add_cyl(bm, (0, 0, -0.07), (0, 0, 0.08), 0.095, segs=16)
    G.add_box(bm, (0, 0, 0), (0.14, 0.16, 0.16))
    body = G.bm_to_obj("ValveBody", bm, coll())
    G.assign_mat(body, m)
    G.shade_smooth(body, 28)
    G.parent_keep(body, root)
    # parting line
    bm = bmesh.new()
    G.add_torus_weld(bm, (0, 0, 0), Vector((0, 1, 0)), 0.082, 0.0025, segs_u=20, segs_v=6)
    seam = G.bm_to_obj("PartingLine", bm, coll())
    G.assign_mat(seam, mats()["Paint_GreyBody"])
    G.parent_keep(seam, root)
    return body


def bonnet(root, z0=0.07):
    m = mats()["Paint_YellowPipe"]
    cyl_obj("BonnetNeck", (0, 0, z0), (0, 0, z0 + 0.035), 0.055, m, root, 16)
    box_obj("BonnetFlange", (0, 0, z0 + 0.042), (0.13, 0.13, 0.016), m, root)
    # bonnet bolts
    for i, (x, y) in enumerate(((0.045, 0.045), (0.045, -0.045), (-0.045, 0.045), (-0.045, -0.045))):
        hex_obj(f"BonnetBolt_{i}", (x, y, z0 + 0.055), (0, 0, 1), 0.012, 0.008, mats()["Metal_Galvanized"], root)
    cyl_obj("PackingGland", (0, 0, z0 + 0.055), (0, 0, z0 + 0.085), 0.028, mats()["Metal_Machined"], root, 12)
    cyl_obj("Stem", (0, 0, z0 + 0.08), (0, 0, z0 + 0.16), 0.012, mats()["Metal_Machined"], root, 10)
    return z0 + 0.16


def build_hov():
    root, _ = new_root("HOV")
    CTX["coll"] = bpy.data.collections["HOV"]
    ff = G.VALVE_FF
    j = add_inline_flanges(root, ff)
    body = cast_body(root, ff * 0.5 - j)
    body.name = "body-core"
    top = bonnet(root)
    # L-handle along flow (open)
    box_obj("Handle", (0.09, 0, top + 0.012), (0.26, 0.028, 0.018), mats()["Paint_Black"], root)
    cyl_obj("HandleGrip", (0.20, 0, top + 0.012), (0.30, 0, top + 0.012), 0.016, mats()["Rubber_Black"], root, 10)
    box_obj("LockTab", (0.02, 0.03, top - 0.01), (0.02, 0.04, 0.01), mats()["Metal_Galvanized"], root)
    make_nameplate("Nameplate", coll(), tex("plate_hov"), root, (0.02, 0.09, 0.02), rot=(0, 0, math.pi / 2))
    return root


def electric_actuator(root, z0):
    m = mats()["Paint_ActuatorBlue"]
    box_obj("ISO_Pad", (0, 0, z0), (0.10, 0.10, 0.012), mats()["Paint_GreyBody"], root)
    box_obj("Actuator", (0, 0, z0 + 0.09), (0.22, 0.18, 0.16), m, root)
    cyl_obj("Motor", (0.14, 0, z0 + 0.09), (0.28, 0, z0 + 0.09), 0.055, m, root, 16)
    cyl_obj("MotorCap", (0.28, 0, z0 + 0.09), (0.31, 0, z0 + 0.09), 0.052, mats()["Paint_GreyBody"], root, 12)
    box_obj("JBox", (0, 0.11, z0 + 0.09), (0.08, 0.05, 0.07), mats()["Paint_GreyBody"], root)
    cyl_obj("CableGland", (0, 0.14, z0 + 0.09), (0, 0.18, z0 + 0.09), 0.012, mats()["Paint_Black"], root, 8)
    # indicator window
    box_obj("Indicator", (0.0, -0.095, z0 + 0.12), (0.05, 0.01, 0.04), mats()["Glass_Instrument"], root)
    box_obj("IndicatorFlag", (0.0, -0.09, z0 + 0.12), (0.03, 0.006, 0.02), mats()["Paint_SafetyRed"], root)
    # side handwheel
    bm = bmesh.new()
    G.add_torus_weld(bm, (0, -0.14, z0 + 0.05), Vector((0, 1, 0)), 0.055, 0.007, segs_u=16, segs_v=6)
    hw = G.bm_to_obj("Handwheel", bm, coll())
    G.assign_mat(hw, mats()["Paint_Black"])
    G.parent_keep(hw, root)
    cyl_obj("HWHub", (0, -0.12, z0 + 0.05), (0, -0.16, z0 + 0.05), 0.016, mats()["Metal_Machined"], root, 10)
    cyl_obj("LiftEye", (0, 0, z0 + 0.18), (0, 0, z0 + 0.21), 0.008, mats()["Metal_Galvanized"], root, 8)


def build_mov():
    root, _ = new_root("MOV")
    CTX["coll"] = bpy.data.collections["MOV"]
    ff = G.VALVE_FF
    j = add_inline_flanges(root, ff)
    body = cast_body(root, ff * 0.5 - j)
    body.name = "body-core"
    top = bonnet(root)
    electric_actuator(root, top - 0.02)
    make_nameplate("Nameplate", coll(), tex("plate_mov"), root, (0.02, 0.10, 0.02), rot=(0, 0, math.pi / 2))
    return root


def build_ssv():
    root, _ = new_root("SSV")
    CTX["coll"] = bpy.data.collections["SSV"]
    ff = G.VALVE_FF
    j = add_inline_flanges(root, ff)
    body = cast_body(root, ff * 0.5 - j, mats()["Paint_YellowPipe"])
    body.name = "body-core"
    top = bonnet(root)
    m = mats()["Paint_SafetyRed"]
    cyl_obj("SpringCan", (0, 0, top), (0, 0, top + 0.28), 0.085, m, root, 20)
    cyl_obj("SpringBand", (0, 0, top + 0.10), (0, 0, top + 0.13), 0.090, mats()["Metal_StripeBlack"], root, 16)
    cyl_obj("SpringBand2", (0, 0, top + 0.18), (0, 0, top + 0.21), 0.090, mats()["Metal_StripeBlack"], root, 16)
    box_obj("CanFlange", (0, 0, top + 0.01), (0.20, 0.20, 0.016), m, root)
    for i, (x, y) in enumerate(((0.07, 0.07), (0.07, -0.07), (-0.07, 0.07), (-0.07, -0.07))):
        hex_obj(f"CanBolt_{i}", (x, y, top + 0.02), (0, 0, 1), 0.014, 0.01, mats()["Metal_Galvanized"], root)
    box_obj("ResetLever", (0.12, 0, top + 0.08), (0.16, 0.02, 0.02), mats()["Paint_Black"], root)
    cyl_obj("PosPin", (0, 0, top + 0.28), (0, 0, top + 0.34), 0.012, mats()["Metal_Machined"], root, 8)
    box_obj("PosFlag", (0.03, 0, top + 0.34), (0.04, 0.01, 0.02), mats()["Paint_SafetyRed"], root)
    cyl_obj("SignalGland", (0.09, 0, top + 0.22), (0.14, 0, top + 0.22), 0.01, mats()["Paint_Black"], root, 8)
    make_nameplate("Nameplate", coll(), tex("plate_ssv"), root, (0.02, 0.10, 0.02), rot=(0, 0, math.pi / 2))
    return root


def build_pcv():
    root, _ = new_root("PCV")
    CTX["coll"] = bpy.data.collections["PCV"]
    ff = G.VALVE_FF
    j = add_inline_flanges(root, ff)
    m = mats()["Paint_YellowPipe"]
    body = box_obj("body-core", (0, 0, 0), (0.12, 0.16, 0.14), m, root)
    tube_obj("Run_A", (-ff * 0.5 + j, 0, 0), (-0.04, 0, 0), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root)
    tube_obj("Run_B", (0.04, 0, 0), (ff * 0.5 - j, 0, 0), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root)
    # diaphragm case
    cyl_obj("DiaphFlange", (0, 0, 0.08), (0, 0, 0.10), 0.13, mats()["Paint_EpoxyWhite"], root, 20)
    bm = bmesh.new()
    G.add_ellipsoid_head(bm, (0, 0, 0.10), Vector((0, 0, 1)), 0.125, 0.07, segs_u=20, segs_v=6)
    dome = G.bm_to_obj("DiaphDome", bm, coll())
    G.assign_mat(dome, mats()["Paint_EpoxyWhite"])
    G.shade_smooth(dome)
    G.parent_keep(dome, root)
    for i in range(8):
        a = 2 * math.pi * i / 8
        hex_obj(f"DiaphBolt_{i}", (0.11 * math.cos(a), 0.11 * math.sin(a), 0.095), (0, 0, 1), 0.012, 0.008, mats()["Metal_Galvanized"], root)
    cyl_obj("Pilot", (0, 0, 0.16), (0, 0, 0.22), 0.028, mats()["Paint_ActuatorBlue"], root, 12)
    cyl_obj("AdjScrew", (0, 0, 0.22), (0, 0, 0.26), 0.012, mats()["Metal_Machined"], root, 8)
    hex_obj("AdjHex", (0, 0, 0.255), (0, 0, 1), 0.018, 0.01, mats()["Metal_Galvanized"], root)
    # impulse tube
    tube_obj("Impulse", (0.04, 0, 0.04), (0.04, 0, 0.12), 0.006, 0.003, mats()["Metal_Stainless"], root, 8)
    tube_obj("Impulse2", (0.04, 0, 0.12), (0.0, 0, 0.12), 0.006, 0.003, mats()["Metal_Stainless"], root, 8)
    cyl_obj("Vent", (0.05, 0, 0.17), (0.09, 0, 0.17), 0.008, mats()["Paint_GreyBody"], root, 8)
    make_nameplate("Nameplate", coll(), tex("plate_pcv"), root, (0.02, 0.10, 0.0), rot=(0, 0, math.pi / 2))
    _ = body
    return root


def build_pv():
    """Angle PSV: inlet −X, outlet +Z (up). Origin at inlet centerline / body."""
    root, _ = new_root("PV")
    CTX["coll"] = bpy.data.collections["PV"]
    m = mats()["Paint_SafetyRed"]
    fa, j = make_flange_assy("Flange_A")
    fb, _ = make_flange_assy("Flange_B")
    place(fa, (-0.12, 0, 0), (0, 0, math.pi), root)
    place(fb, (0, 0, 0.14), (0, -math.pi / 2, 0), root)  # local +X → +Z
    tube_obj("InletRun", (-0.12 + abs(j), 0, 0), (0, 0, 0), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root)
    tube_obj("OutletRun", (0, 0, abs(j)), (0, 0, 0.14 - abs(j)), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root)
    bm = bmesh.new()
    G.add_box(bm, (0, 0, 0.02), (0.13, 0.13, 0.13))
    body = G.bm_to_obj("body-core", bm, coll())
    G.assign_mat(body, m)
    G.shade_smooth(body, 25)
    G.parent_keep(body, root)
    cyl_obj("SpringBonnet", (0, 0, 0.08), (0, 0, 0.28), 0.06, m, root, 16)
    cyl_obj("Cap", (0, 0, 0.28), (0, 0, 0.33), 0.045, mats()["Paint_GreyBody"], root, 12)
    hex_obj("CapNut", (0, 0, 0.335), (0, 0, 1), 0.022, 0.012, mats()["Metal_Galvanized"], root)
    make_nameplate("Nameplate", coll(), tex("plate_pv"), root, (0.08, 0, 0.18))
    G.make_port(coll(), root, "port_in", (-0.12, 0, 0), "in")
    po = G.make_port(coll(), root, "port_out", (0, 0, 0.14), "up")
    _ = po
    return root


# --- meters / filter / tank / skid ------------------------------------------


def build_uf():
    root, _ = new_root("UF")
    CTX["coll"] = bpy.data.collections["UF"]
    ff = 0.80
    j = add_inline_flanges(root, ff)
    m = mats()["Paint_YellowPipe"]
    body = tube_obj("body-core", (-ff * 0.5 + j, 0, 0), (ff * 0.5 - j, 0, 0), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root, 24)
    # flow arrow
    bm = bmesh.new()
    G.add_cone(bm, (0.12, 0, G.PIPE_OD * 0.5 + 0.004), (0.18, 0, G.PIPE_OD * 0.5 + 0.004), 0.012, 8)
    G.add_cyl(bm, (0.04, 0, G.PIPE_OD * 0.5 + 0.004), (0.12, 0, G.PIPE_OD * 0.5 + 0.004), 0.004, 8)
    arrow = G.bm_to_obj("FlowArrow", bm, coll())
    G.assign_mat(arrow, mats()["Paint_Black"])
    G.parent_keep(arrow, root)
    # 2-path transducers
    for i, x in enumerate((-0.12, 0.12)):
        for s, y in ((1, 0.07), (-1, -0.07)):
            cyl_obj(f"Xducer_{i}_{s}", (x, 0, G.PIPE_OD * 0.5), (x, y, G.PIPE_OD * 0.5 + 0.04), 0.018, mats()["Metal_Stainless"], root, 12)
            cyl_obj(f"Gland_{i}_{s}", (x, y, G.PIPE_OD * 0.5 + 0.04), (x, y * 1.4, G.PIPE_OD * 0.5 + 0.06), 0.01, mats()["Paint_Black"], root, 8)
    # transmitter
    box_obj("Transmitter", (0, 0, 0.16), (0.16, 0.12, 0.10), mats()["Paint_ActuatorBlue"], root)
    box_obj("Display", (0, -0.062, 0.17), (0.10, 0.006, 0.05), mats()["Glass_Instrument"], root)
    box_obj("Keys", (0.0, -0.062, 0.13), (0.08, 0.006, 0.02), mats()["Paint_Black"], root)
    cyl_obj("TxGland", (0.09, 0, 0.14), (0.14, 0, 0.14), 0.012, mats()["Paint_Black"], root, 8)
    box_obj("GroundLug", (0, 0.07, 0.02), (0.02, 0.02, 0.012), mats()["Metal_Galvanized"], root)
    make_nameplate("Nameplate", coll(), tex("plate_uf"), root, (0, 0.08, -0.02), rot=(0, 0, math.pi / 2))
    _ = body
    return root


def build_fs():
    root, _ = new_root("FS")
    CTX["coll"] = bpy.data.collections["FS"]
    m = mats()["Paint_EpoxyWhite"]
    # legs, origin at base
    for i, (x, y) in enumerate(((0.16, 0.16), (0.16, -0.16), (-0.16, 0.16), (-0.16, -0.16))):
        box_obj(f"Leg_{i}", (x, y, 0.15), (0.04, 0.04, 0.30), mats()["Paint_GreyBody"], root)
        box_obj(f"Foot_{i}", (x, y, 0.012), (0.08, 0.08, 0.02), mats()["Paint_GreyBody"], root)
    shell_z0, shell_z1 = 0.32, 0.95
    tube_obj("body-core", (0, 0, shell_z0), (0, 0, shell_z1), 0.18, 0.16, m, root, 24)
    bm = bmesh.new()
    G.add_ellipsoid_head(bm, (0, 0, shell_z0), Vector((0, 0, -1)), 0.18, 0.09, segs_u=20, segs_v=5)
    bot = G.bm_to_obj("BottomHead", bm, coll())
    G.assign_mat(bot, m)
    G.shade_smooth(bot)
    G.parent_keep(bot, root)
    # quick-opening cover
    bm = bmesh.new()
    G.add_ellipsoid_head(bm, (0, 0, shell_z1), Vector((0, 0, 1)), 0.18, 0.08, segs_u=20, segs_v=5)
    cover = G.bm_to_obj("Cover", bm, coll())
    G.assign_mat(cover, mats()["Paint_EpoxyWhite"])
    G.shade_smooth(cover)
    G.parent_keep(cover, root)
    box_obj("CoverFlange", (0, 0, shell_z1), (0.40, 0.40, 0.02), mats()["Paint_GreyBody"], root)
    for i in range(12):
        a = 2 * math.pi * i / 12
        hex_obj(f"CoverBolt_{i}", (0.18 * math.cos(a), 0.18 * math.sin(a), shell_z1 + 0.016), (0, 0, 1), 0.016, 0.012, mats()["Metal_Galvanized"], root)
    box_obj("DPGauge", (0, 0.30, 0.56), (0.06, 0.04, 0.08), mats()["Paint_Black"], root)
    cyl_obj("DPGlass", (0, 0.325, 0.58), (0, 0.332, 0.58), 0.022, mats()["Glass_Instrument"], root, 12)
    box_obj("Davit", (0.22, 0, shell_z1 + 0.08), (0.03, 0.03, 0.16), mats()["Paint_GreyBody"], root)
    cyl_obj("LiftLug", (0, 0, shell_z1 + 0.09), (0, 0, shell_z1 + 0.12), 0.012, mats()["Metal_Galvanized"], root, 8)
    # in-line nozzles at z=0.55
    nz = 0.55
    fa, j = make_flange_assy("Flange_A")
    fb, _ = make_flange_assy("Flange_B")
    place(fa, (-0.28, 0, nz), (0, 0, math.pi), root)
    place(fb, (0.28, 0, nz), (0, 0, 0), root)
    tube_obj("NozzleIn", (-0.28 + abs(j), 0, nz), (-0.16, 0, nz), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root)
    tube_obj("NozzleOut", (0.16, 0, nz), (0.28 - abs(j), 0, nz), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root)
    # drain
    cyl_obj("Drain", (0, 0, 0.22), (0, 0, 0.30), 0.02, mats()["Paint_GreyBody"], root, 10)
    hex_obj("DrainPlug", (0, 0, 0.21), (0, 0, 1), 0.028, 0.016, mats()["Metal_Galvanized"], root)
    cyl_obj("DP_Hi", (0, 0.18, 0.70), (0, 0.24, 0.70), 0.01, mats()["Metal_Stainless"], root, 8)
    cyl_obj("DP_Lo", (0, 0.18, 0.42), (0, 0.24, 0.42), 0.01, mats()["Metal_Stainless"], root, 8)
    make_nameplate("Nameplate", coll(), tex("plate_fs"), root, (0.19, 0, 0.75))
    G.make_port(coll(), root, "port_in", (-0.28, 0, nz), "in")
    G.make_port(coll(), root, "port_out", (0.28, 0, nz), "out")
    G.make_port(coll(), root, "port_drain", (0, 0, 0.21), "in")
    return root


def build_instr():
    root, _ = new_root("INSTR")
    CTX["coll"] = bpy.data.collections["INSTR"]
    # origin at process connection (bottom)
    cyl_obj("NPT", (0, 0, 0), (0, 0, 0.035), 0.012, mats()["Metal_Machined"], root, 10)
    # pigtail siphon
    bm = bmesh.new()
    segs = 12
    pts = []
    for i in range(segs + 1):
        t = i / segs
        a = t * math.pi
        pts.append(Vector((0.03 * math.sin(a), 0.0, 0.05 + 0.03 * (1 - math.cos(a)))))
    for i in range(segs):
        G.add_cyl(bm, pts[i], pts[i + 1], 0.007, segs=8)
    siphon = G.bm_to_obj("Siphon", bm, coll())
    G.assign_mat(siphon, mats()["Paint_YellowPipe"])
    G.shade_smooth(siphon)
    G.parent_keep(siphon, root)
    # gauge body
    z = 0.14
    cyl_obj("Case", (0, -0.018, z), (0, 0.018, z), 0.055, mats()["Paint_Black"], root, 24)
    # dial
    bm = bmesh.new()
    G.add_cyl(bm, (0, -0.02, z), (0, -0.016, z), 0.048, segs=24)
    plate_uv_box(bm, (0.1, 0.04, 0.1))
    # fix UV: project XZ
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        for loop in face.loops:
            p = loop.vert.co
            loop[uv].uv = Vector((p.x / 0.1 + 0.5, (p.z - z) / 0.1 + 0.5))
    dial = G.bm_to_obj("Dial", bm, coll())
    G.assign_mat(dial, image_mat("Mat_Dial", tex("dial")))
    G.parent_keep(dial, root)
    cyl_obj("Glass", (0, -0.026, z), (0, -0.022, z), 0.046, mats()["Glass_Instrument"], root, 24)
    cyl_obj("Bezel", (0, -0.028, z), (0, -0.024, z), 0.055, mats()["Metal_Stainless"], root, 24)
    make_nameplate("Nameplate", coll(), tex("plate_instr"), root, (0.06, 0, 0.08), size=(0.003, 0.06, 0.03))
    G.make_port(coll(), root, "port_in", (0, 0, 0), "in")
    box_obj("body-core", (0, 0, z), (0.02, 0.02, 0.02), mats()["Paint_Black"], root)
    return root


def build_tank():
    root, _ = new_root("TANK")
    CTX["coll"] = bpy.data.collections["TANK"]
    m = mats()["Paint_EpoxyWhite"]
    r, z0, z1 = 0.28, 0.35, 1.15
    for i, (x, y) in enumerate(((0.22, 0.22), (0.22, -0.22), (-0.22, 0.22), (-0.22, -0.22))):
        box_obj(f"Leg_{i}", (x, y, 0.16), (0.05, 0.05, 0.32), m, root)
        box_obj(f"Foot_{i}", (x, y, 0.015), (0.10, 0.10, 0.03), m, root)
    tube_obj("body-core", (0, 0, z0), (0, 0, z1), r, r - 0.012, m, root, 28)
    bm = bmesh.new()
    G.add_ellipsoid_head(bm, (0, 0, z1), Vector((0, 0, 1)), r, r * 0.5, segs_u=24, segs_v=6)
    top = G.bm_to_obj("TopHead", bm, coll())
    G.assign_mat(top, m)
    G.shade_smooth(top)
    G.parent_keep(top, root)
    bm = bmesh.new()
    G.add_ellipsoid_head(bm, (0, 0, z0), Vector((0, 0, -1)), r, r * 0.5, segs_u=24, segs_v=6)
    bot = G.bm_to_obj("BottomHead", bm, coll())
    G.assign_mat(bot, m)
    G.shade_smooth(bot)
    G.parent_keep(bot, root)
    # manway
    cyl_obj("Manway", (r - 0.02, 0, 0.75), (r + 0.06, 0, 0.75), 0.10, m, root, 16)
    fa, j = make_flange_assy("ManwayFlange")
    place(fa, (r + 0.08, 0, 0.75), (0, 0, 0), root)
    # nozzles
    fb, _ = make_flange_assy("NozzleIn")
    fc, _ = make_flange_assy("NozzleOut")
    place(fb, (-0.42, 0, 0.55), (0, 0, math.pi), root)
    place(fc, (0.42, 0, 0.55), (0, 0, 0), root)
    tube_obj("NIn", (-0.42 + abs(j), 0, 0.55), (-r, 0, 0.55), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root)
    tube_obj("NOut", (r, 0, 0.55), (0.42 - abs(j), 0, 0.55), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, m, root)
    fd, _ = make_flange_assy("PSVNozzle")
    place(fd, (0, 0, 1.42), (0, -math.pi / 2, 0), root)
    cyl_obj("PSVNeck", (0, 0, z1 + r * 0.5 - 0.02), (0, 0, 1.42 - abs(j)), 0.04, m, root, 12)
    cyl_obj("LevelTapHi", (0, r, 1.00), (0, r + 0.05, 1.00), 0.012, mats()["Metal_Stainless"], root, 8)
    cyl_obj("LevelTapLo", (0, r, 0.50), (0, r + 0.05, 0.50), 0.012, mats()["Metal_Stainless"], root, 8)
    box_obj("LugL", (-0.12, 0, z1 + 0.12), (0.04, 0.02, 0.06), mats()["Metal_Galvanized"], root)
    box_obj("LugR", (0.12, 0, z1 + 0.12), (0.04, 0.02, 0.06), mats()["Metal_Galvanized"], root)
    make_nameplate("Nameplate", coll(), tex("plate_tank"), root, (r + 0.01, 0, 0.85))
    G.make_port(coll(), root, "port_in", (-0.42, 0, 0.55), "in")
    G.make_port(coll(), root, "port_out", (0.42, 0, 0.55), "out")
    G.make_port(coll(), root, "port_vent", (0, 0, 1.42), "up")
    return root


def build_skid():
    root, _ = new_root("HENG_GUANG_SKID")
    CTX["coll"] = bpy.data.collections["HENG_GUANG_SKID"]
    m = mats()["Paint_SkidGalv"]
    L, W, H = 2.40, 1.40, 0.16
    # channel frame
    for y in (-W * 0.5, W * 0.5):
        box_obj(f"BeamY_{y}", (0, y, H * 0.5), (L, 0.06, H), m, root)
    for x in (-L * 0.5 + 0.05, 0.0, L * 0.5 - 0.05):
        box_obj(f"BeamX_{x}", (x, 0, H * 0.5), (0.06, W, H), m, root)
    # grate bars (thickness + voids, not a textured sheet)
    grate = mats()["Paint_Grate"]
    bar_t, bar_w, deck_z = 0.018, 0.028, H + 0.02
    nx, ny = 18, 10
    span_x, span_y = L - 0.12, W - 0.12
    for i in range(nx):
        x = -span_x * 0.5 + (i + 0.5) * (span_x / nx)
        box_obj(f"GrateX_{i}", (x, 0, deck_z), (bar_w, span_y, bar_t), grate, root)
    for i in range(ny):
        y = -span_y * 0.5 + (i + 0.5) * (span_y / ny)
        box_obj(f"GrateY_{i}", (0, y, deck_z + 0.01), (span_x, bar_w, bar_t), grate, root)
    # feet
    fw, fd = L * 0.42, W * 0.38
    for i, (x, y) in enumerate(((fw, fd), (fw, -fd), (-fw, fd), (-fw, -fd))):
        box_obj(f"SkidFoot_{i}", (x, y, 0.025), (0.16, 0.16, 0.05), m, root)
        box_obj(f"Lug_{i}", (x, y, H + 0.10), (0.06, 0.025, 0.08), mats()["Metal_Galvanized"], root)
    # header
    z = 0.62
    hx = L * 0.5 - 0.08
    fa, j = make_flange_assy("HeaderIn")
    fb, _ = make_flange_assy("HeaderOut")
    place(fa, (-hx, 0, z), (0, 0, math.pi), root)
    place(fb, (hx, 0, z), (0, 0, 0), root)
    header = tube_obj("body-core", (-hx + abs(j), 0, z), (hx - abs(j), 0, z), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, mats()["Paint_YellowPipe"], root)
    _ = header
    # pipe shoes + U-bolts
    for x in (-0.55, 0.55):
        box_obj(f"Shoe_{x}", (x, 0, z - 0.14), (0.10, 0.16, 0.05), m, root)
        bm = bmesh.new()
        G.add_tube(bm, (x, -0.08, z), (x, 0.08, z), 0.009, 0.004, segs=10)
        u = G.bm_to_obj(f"UBolt_{x}", bm, coll())
        G.assign_mat(u, mats()["Metal_Galvanized"])
        G.parent_keep(u, root)
    def skid_ball_valve(i: int, x: float):
        ym = mats()["Paint_YellowPipe"]
        bm = bmesh.new()
        G.add_box(bm, (x, 0, z), (0.13, 0.16, 0.16))
        G.add_cyl(bm, (x, 0, z - 0.08), (x, 0, z + 0.07), 0.09, segs=16)
        vb = G.bm_to_obj(f"SkidValveBody_{i}", bm, coll())
        G.assign_mat(vb, ym)
        G.shade_smooth(vb, 26)
        G.parent_keep(vb, root)
        bm = bmesh.new()
        G.add_torus_weld(bm, (x, 0, z), Vector((0, 1, 0)), 0.08, 0.0022, segs_u=16, segs_v=5)
        seam = G.bm_to_obj(f"SkidParting_{i}", bm, coll())
        G.assign_mat(seam, mats()["Paint_GreyBody"])
        G.parent_keep(seam, root)
        cyl_obj(f"SkidBonnet_{i}", (x, 0, z + 0.07), (x, 0, z + 0.11), 0.05, ym, root, 14)
        box_obj(f"SkidBonnetFlg_{i}", (x, 0, z + 0.118), (0.12, 0.12, 0.014), ym, root)
        for bi, (dx, dy) in enumerate(((0.04, 0.04), (0.04, -0.04), (-0.04, 0.04), (-0.04, -0.04))):
            hex_obj(f"SkidBonnetBolt_{i}_{bi}", (x + dx, dy, z + 0.13), (0, 0, 1), 0.011, 0.007, mats()["Metal_Galvanized"], root)
        cyl_obj(f"SkidGland_{i}", (x, 0, z + 0.13), (x, 0, z + 0.16), 0.024, mats()["Metal_Machined"], root, 10)
        cyl_obj(f"SkidStem_{i}", (x, 0, z + 0.16), (x, 0, z + 0.22), 0.011, mats()["Metal_Machined"], root, 8)
        box_obj(f"SkidHandle_{i}", (x + 0.08, 0, z + 0.23), (0.22, 0.024, 0.016), mats()["Paint_Black"], root)
        cyl_obj(f"SkidGrip_{i}", (x + 0.18, 0, z + 0.23), (x + 0.26, 0, z + 0.23), 0.014, mats()["Rubber_Black"], root, 8)
        box_obj(f"SkidLock_{i}", (x + 0.02, 0.03, z + 0.21), (0.018, 0.03, 0.008), mats()["Metal_Galvanized"], root)

    skid_ball_valve(0, -0.50)
    skid_ball_valve(1, 0.0)
    skid_ball_valve(2, 0.50)
    cyl_obj("SkidRegFlange", (0.78, 0, z + 0.08), (0.78, 0, z + 0.10), 0.09, mats()["Paint_EpoxyWhite"], root, 16)
    bm = bmesh.new()
    G.add_ellipsoid_head(bm, (0.78, 0, z + 0.10), Vector((0, 0, 1)), 0.085, 0.05, segs_u=16, segs_v=5)
    dome = G.bm_to_obj("SkidRegDome", bm, coll())
    G.assign_mat(dome, mats()["Paint_EpoxyWhite"])
    G.shade_smooth(dome)
    G.parent_keep(dome, root)
    cyl_obj("SkidRegScrew", (0.78, 0, z + 0.15), (0.78, 0, z + 0.20), 0.01, mats()["Metal_Machined"], root, 8)
    tube_obj("Branch", (0.20, 0, z), (0.20, 0.28, z), 0.02, 0.012, mats()["Paint_YellowPipe"], root, 10)
    cyl_obj("PICase", (0.20, 0.34, z), (0.20, 0.38, z), 0.04, mats()["Paint_ActuatorBlue"], root, 16)
    cyl_obj("Vent", (-0.95, 0, z), (-0.95, 0, z + 0.14), 0.012, mats()["Paint_GreyBody"], root, 8)
    hex_obj("VentCap", (-0.95, 0, z + 0.15), (0, 0, 1), 0.02, 0.012, mats()["Metal_Galvanized"], root)
    cyl_obj("Drain", (0.95, 0, z), (0.95, 0, 0.28), 0.012, mats()["Paint_GreyBody"], root, 8)
    make_nameplate("Nameplate", coll(), tex("plate_skid"), root, (0.0, W * 0.5 + 0.01, 0.28), rot=(0, 0, math.pi / 2), size=(0.004, 0.12, 0.05))
    G.make_port(coll(), root, "port_in", (-hx, 0, z), "in")
    G.make_port(coll(), root, "port_out", (hx, 0, z), "out")
    box_obj("Kickplate", (0, W * 0.5 - 0.02, H + 0.06), (L - 0.1, 0.014, 0.10), m, root)
    box_obj("Kickplate2", (0, -W * 0.5 + 0.02, H + 0.06), (L - 0.1, 0.014, 0.10), m, root)
    rail_z, rail_y = 1.35, W * 0.5 - 0.04
    for i, x in enumerate((-1.05, -0.35, 0.35, 1.05)):
        cyl_obj(f"RailPost_{i}", (x, rail_y, H), (x, rail_y, rail_z), 0.016, m, root, 10)
    tube_obj("RailTop", (-1.05, rail_y, rail_z), (1.05, rail_y, rail_z), 0.014, 0.007, m, root, 10)
    tube_obj("RailMid", (-1.05, rail_y, 0.78), (1.05, rail_y, 0.78), 0.012, 0.006, m, root, 10)
    br, _ = make_flange_assy("BranchFlange")
    place(br, (-0.70, 0.28, z), (0, 0, math.pi / 2), root)
    tube_obj("Branch2", (-0.70, 0, z), (-0.70, 0.28 - 0.01, z), G.PIPE_OD * 0.5, G.PIPE_ID * 0.5, mats()["Paint_YellowPipe"], root)
    pb = G.make_port(coll(), root, "port_branch", (-0.70, 0.28, z), "out")
    pb.rotation_euler = (0, 0, math.pi / 2)
    return root


# --- electrical A + text -----------------------------------------------------


def symbol_plate(kind, file_key, label, extra_geom):
    root, _ = new_root(kind)
    CTX["coll"] = bpy.data.collections[kind]
    m = mats()["Metal_Plate"]
    box_obj("Plate", (0, 0, 0), (0.008, 0.22, 0.16), m, root)
    bm = bmesh.new()
    G.add_box(bm, (0.005, 0, 0), (0.002, 0.20, 0.14))
    plate_uv_box(bm, (0.002, 0.20, 0.14))
    face = G.bm_to_obj("SymbolPlate", bm, coll())
    G.assign_mat(face, image_mat(f"Mat_{kind}", tex(file_key)))
    G.parent_keep(face, root)
    extra_geom(root)
    box_obj("Stand", (0, 0, -0.12), (0.02, 0.02, 0.08), m, root)
    box_obj("body-core", (0, 0, 0), (0.02, 0.08, 0.08), m, root)
    return root


def build_elec_cb():
    def extra(root):
        # extruded IEC-ish breaker bars (readable at icon size)
        box_obj("FrameH1", (0.006, 0, 0.055), (0.004, 0.14, 0.008), mats()["Metal_Stainless"], root)
        box_obj("FrameH2", (0.006, 0, -0.055), (0.004, 0.14, 0.008), mats()["Metal_Stainless"], root)
        box_obj("Break", (0.006, 0, 0), (0.004, 0.08, 0.01), mats()["Metal_Stainless"], root)
        box_obj("QF", (0.006, 0, 0.07), (0.003, 0.04, 0.012), mats()["Paint_White"], root)

    return symbol_plate("ELEC_CB", "sym_cb", "QF", extra)


def build_elec_m():
    def extra(root):
        bm = bmesh.new()
        G.add_tube(bm, (0.006, 0, 0), (0.01, 0, 0), 0.055, 0.048, segs=24)
        ring_o = G.bm_to_obj("MotorCircle", bm, coll())
        G.assign_mat(ring_o, mats()["Metal_Stainless"])
        G.parent_keep(ring_o, root)
        box_obj("TermL", (0.006, -0.04, 0.07), (0.004, 0.02, 0.012), mats()["Metal_Stainless"], root)
        box_obj("TermR", (0.006, 0.04, 0.07), (0.004, 0.02, 0.012), mats()["Metal_Stainless"], root)

    return symbol_plate("ELEC_M", "sym_m", "M", extra)


def build_elec_gnd():
    def extra(root):
        gy = mats()["Paint_GreenYellow"]
        box_obj("GndStem", (0.006, 0, 0.02), (0.004, 0.008, 0.10), gy, root)
        box_obj("Gnd1", (0.006, 0, -0.03), (0.004, 0.10, 0.008), gy, root)
        box_obj("Gnd2", (0.006, 0, -0.045), (0.004, 0.07, 0.008), gy, root)
        box_obj("Gnd3", (0.006, 0, -0.06), (0.004, 0.04, 0.008), gy, root)

    return symbol_plate("ELEC_GND", "sym_gnd", "PE", extra)


def build_text():
    root, _ = new_root("TEXT")
    CTX["coll"] = bpy.data.collections["TEXT"]
    m = mats()["Metal_Plate"]
    box_obj("body-core", (0, 0, 0), (0.006, 0.22, 0.10), m, root)
    # folded rim
    box_obj("Rim", (0, 0, 0), (0.008, 0.23, 0.11), mats()["Paint_GreyBody"], root)
    bm = bmesh.new()
    G.add_box(bm, (0.004, 0, 0), (0.0015, 0.20, 0.08))
    plate_uv_box(bm, (0.002, 0.20, 0.08))
    face = G.bm_to_obj("Nameplate", bm, coll())
    G.assign_mat(face, image_mat("Mat_TEXT", tex("plate_text")))
    G.parent_keep(face, root)
    cyl_obj("Stem", (0, 0, -0.06), (0, 0, -0.12), 0.006, m, root, 8)
    box_obj("Pointer", (0.02, 0, -0.12), (0.04, 0.02, 0.01), mats()["Paint_SafetyOrange"], root)
    return root


# --- export ------------------------------------------------------------------

ASSETS = [
    ("FLANGE", "flange.glb", build_flange),
    ("PIPE", "pipe.glb", build_pipe),
    ("PIPE_ELBOW", "pipe-elbow.glb", build_elbow),
    ("HOV", "hov.glb", build_hov),
    ("MOV", "mov.glb", build_mov),
    ("SSV", "ssv.glb", build_ssv),
    ("PCV", "pcv.glb", build_pcv),
    ("PV", "pv.glb", build_pv),
    ("UF", "uf.glb", build_uf),
    ("FS", "fs.glb", build_fs),
    ("INSTR", "instr.glb", build_instr),
    ("TANK", "tank.glb", build_tank),
    ("HENG_GUANG_SKID", "heng-guang-skid.glb", build_skid),
    ("ELEC_CB", "elec-cb.glb", build_elec_cb),
    ("ELEC_M", "elec-m.glb", build_elec_m),
    ("ELEC_GND", "elec-gnd.glb", build_elec_gnd),
    ("TEXT", "text.glb", build_text),
]


def export_root(root, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    G.select_hierarchy(root)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )


def layout_roots(roots):
    x = 0.0
    for kind, root in roots:
        root.location = (x, 0.0, 0.0)
        x += 3.0


def write_manifest(report):
    manifest = {
        "base": "/assets/catalog",
        "spec": G.SPEC,
        "unit": "m",
        "yup": True,
        "dn": 100,
        "pn": 16,
        "note": "Industrial DN100 PN16 catalog. Do not mix with plant/ energy-station or turbojet GLBs.",
    }
    for kind, fname, _ in ASSETS:
        manifest[kind] = fname
    EXPORT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (EXPORT / "catalog-glb.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (PUBLIC / "catalog-glb.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (EXPORT / "triangle-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


def copy_public():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for _, fname, _ in ASSETS:
        src = EXPORT / fname
        if src.exists():
            shutil.copy2(src, PUBLIC / fname)


def main():
    G.reset_scene()
    G.reset_bolt_cache()
    TEX.mkdir(parents=True, exist_ok=True)
    EXPORT.mkdir(parents=True, exist_ok=True)
    CTX["tex"] = write_all(TEX)
    CTX["mats"] = G.library_materials()
    CTX["coll"] = G.ensure_coll("Catalog")

    roots = []
    report = {"spec": G.SPEC, "assets": {}}
    for kind, fname, fn in ASSETS:
        print("BUILD", kind)
        CTX["coll"] = G.ensure_coll(kind)
        root = fn()
        tris = G.count_tris(root)
        report["assets"][kind] = {"file": fname, "triangles": tris}
        print("  tris", tris)
        export_root(root, EXPORT / fname)
        size = (EXPORT / fname).stat().st_size if (EXPORT / fname).exists() else 0
        report["assets"][kind]["bytes"] = size
        print("  glb bytes", size)
        roots.append((kind, root))

    layout_roots(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    write_manifest(report)
    copy_public()
    print("blend", BLEND)
    print("public", PUBLIC)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
