# Run inside Blender:
#   blender --background --python E:\energy-station-blender\scripts\blend_wrap.py
"""Import catalog + station GLBs into an editable .blend (Z-up after glTF import)."""
from pathlib import Path

import bpy

ROOT = Path(r"E:\energy-station-blender")
EXPORT = ROOT / "export"
CATALOG = EXPORT / "catalog"
BLEND = EXPORT / "energy-station.blend"


def _reset():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)
    for coll in list(bpy.data.collections):
        if coll.name != "Collection":
            bpy.data.collections.remove(coll)


def _ensure_coll(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def _import(path: Path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def _link_exclusive(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def main():
    _reset()
    cat = _ensure_coll("01_Catalog")
    station = _ensure_coll("02_TypicalStation")
    cams = _ensure_coll("03_CameraLights")

    catalog_files = [
        ("PCS", CATALOG / "pcs.glb"),
        ("TRANSFORMER", CATALOG / "transformer.glb"),
        ("BESS", CATALOG / "bess.glb"),
        ("LOAD", CATALOG / "load.glb"),
        ("DIST_ROOM", CATALOG / "dist-room.glb"),
    ]
    x = -20.0
    for name, path in catalog_files:
        if not path.exists():
            continue
        objs = _import(path)
        holder = bpy.data.objects.new(f"CAT_{name}", None)
        cat.objects.link(holder)
        holder.location = (x, 0.0, 0.0)
        holder["catalogKind"] = name
        holder["modelingClass"] = "典型场景建模"
        for o in objs:
            _link_exclusive(o, cat)
            if o.parent is None:
                o.parent = holder
        x += 12.0

    scene_glb = EXPORT / "energy-station.glb"
    if scene_glb.exists():
        objs = _import(scene_glb)
        for o in objs:
            _link_exclusive(o, station)

    # overview camera (Blender Z-up after import)
    cam_data = bpy.data.cameras.new("OverviewCamera")
    cam_data.lens = 35
    cam = bpy.data.objects.new("OverviewCamera", cam_data)
    cams.objects.link(cam)
    cam.location = (42.0, -10.0, 28.0)
    track = cam.constraints.new(type="TRACK_TO")
    look = bpy.data.objects.new("LookAt", None)
    cams.objects.link(look)
    look.location = (18.0, 16.0, 1.5)
    track.target = look
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    bpy.context.scene.camera = cam

    sun = bpy.data.lights.new("Sun", type="SUN")
    sun.energy = 3.0
    sun_obj = bpy.data.objects.new("Sun", sun)
    cams.objects.link(sun_obj)
    sun_obj.location = (20.0, -12.0, 30.0)
    sun_obj.rotation_euler = (0.7, 0.2, 0.4)

    world = bpy.context.scene.world
    if world and world.use_nodes:
        bg = world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.52, 0.62, 0.74, 1.0)
            bg.inputs[1].default_value = 0.7

    bpy.context.scene["modelingClass"] = "典型场景建模"
    bpy.context.scene["disclaimer"] = "无现场图纸；典型场景建模"
    EXPORT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    print("saved", BLEND)


if __name__ == "__main__":
    main()
