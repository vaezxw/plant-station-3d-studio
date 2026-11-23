# blender --background --python E:\energy-station-blender\scripts\render_pcs_preview.py
"""Front-quarter EEVEE still of the outdoor PCS-02 cabinet."""
from pathlib import Path

import bpy

ROOT = Path(r"E:\energy-station-blender")
GLB = ROOT / "export" / "catalog" / "pcs-02.glb"
OUT = ROOT / "export" / "preview-pcs-02.png"


def _reset():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)


def main():
    _reset()
    bpy.ops.import_scene.gltf(filepath=str(GLB))

    cam_data = bpy.data.cameras.new("PCSPreview")
    cam_data.lens = 50
    cam = bpy.data.objects.new("PCSPreview", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    # glTF import → Blender Z-up; cabinet front was +Z in glTF → +Y in Blender
    cam.location = (2.4, -3.2, 1.55)
    track = cam.constraints.new(type="TRACK_TO")
    look = bpy.data.objects.new("Look", None)
    bpy.context.scene.collection.objects.link(look)
    look.location = (0.0, 0.15, 1.15)
    track.target = look
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    bpy.context.scene.camera = cam

    sun = bpy.data.lights.new("Sun", type="SUN")
    sun.energy = 4.5
    sun.angle = 0.2
    sun_obj = bpy.data.objects.new("Sun", sun)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (0.85, 0.15, 0.55)

    fill = bpy.data.lights.new("Fill", type="AREA")
    fill.energy = 250
    fill.size = 3.0
    fill_obj = bpy.data.objects.new("Fill", fill)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-2.0, -1.5, 2.2)
    fill_obj.rotation_euler = (0.9, 0.0, -0.6)

    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.62, 0.70, 0.78, 1.0)
        bg.inputs[1].default_value = 0.85

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960
    scene.render.filepath = str(OUT)
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    bpy.ops.render.render(write_still=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
