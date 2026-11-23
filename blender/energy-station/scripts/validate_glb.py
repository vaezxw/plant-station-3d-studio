import json
import struct
from pathlib import Path


def glb_json(p):
    data = Path(p).read_bytes()
    magic, ver, length = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF", magic
    clen, ctype = struct.unpack_from("<I4s", data, 12)
    assert ctype == b"JSON", ctype
    return json.loads(data[20 : 20 + clen].decode("utf-8"))


files = [
    r"E:\energy-station-blender\export\catalog\pcs.glb",
    r"E:\energy-station-blender\export\catalog\transformer.glb",
    r"E:\energy-station-blender\export\catalog\bess.glb",
    r"E:\energy-station-blender\export\catalog\load.glb",
    r"E:\energy-station-blender\export\catalog\dist-room.glb",
    r"E:\energy-station-blender\export\energy-station.glb",
]
for f in files:
    doc = glb_json(f)
    ids = []
    for n in doc["nodes"]:
        extras = n.get("extras") or {}
        if extras.get("entityId"):
            ids.append(
                {
                    "name": n["name"],
                    "entityId": extras.get("entityId"),
                    "type": extras.get("entityType"),
                    "pairGroup": extras.get("pairGroup"),
                    "pairRole": extras.get("pairRole"),
                    "pairedPcsId": extras.get("pairedPcsId"),
                    "pairedEntityIds": extras.get("pairedEntityIds"),
                }
            )
    print("===", Path(f).name, "nodes", len(doc["nodes"]), "meshes", len(doc["meshes"]))
    for row in ids:
        print(" ", row)

print("public models:")
for p in sorted(Path(r"E:\hengguang-plant-dashboard\public\models").glob("*")):
    print(" ", p.name, p.stat().st_size)
