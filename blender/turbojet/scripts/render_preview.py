# blender --background --python E:\turbojet-blender\scripts\render_preview.py
"""EEVEE still of the assembled turbojet GLB (re-run without rebuilding)."""
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(r"E:\turbojet-blender")
GLB = ROOT / "export" / "turbojet.glb"
OUT = ROOT / "export" / "preview.png"


def _reset():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def main():
    _reset()
    bpy.ops.import_scene.gltf(filepath=str(GLB))

    cam_data = bpy.data.cameras.new("TurbojetPreview")
    cam_data.lens = 35
    cam_data.clip_start = 0.02
    cam_data.clip_end = 20.0
    cam = bpy.data.objects.new("TurbojetPreview", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (0.52, -0.58, 0.24)
    direction = Vector((0.0, 0.0, 0.0)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Z").to_euler()
    bpy.context.scene.camera = cam
    bpy.context.view_layer.update()

    sun = bpy.data.lights.new("Sun", type="SUN")
    sun.energy = 5.5
    sun_obj = bpy.data.objects.new("Sun", sun)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (0.95, 0.25, 0.55)

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
    scene.render.filepath = str(OUT)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
