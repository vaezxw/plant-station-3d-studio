# 小型轴流涡喷（Blender 权威目录）

监视-only。几何为**原创小型涡喷装配**，不是恒光橇装、能源站柜体、液体输送或换热演示。

无现场图纸，标为典型场景建模。不依赖 Blender MCP。

## 便携 Blender

`E:\energy-station-blender\tools\blender-4.5.16-windows-x64\blender.exe`（4.5.16 LTS）

## 生成

```bat
E:\energy-station-blender\tools\blender-4.5.16-windows-x64\blender.exe --background --python E:\turbojet-blender\scripts\build_turbojet.py
```

脚本会：

1. 用 bmesh 建进气道 / 多级压气机（转子+静子）/ 环形燃烧室 / 涡轮 / 喷管 / 机匣 / 外部管路 / 安装节
2. 命名对象并写 `extras.partId` / `extras.group`（rotor | stator | casing | plumbing）
3. 导出 `export\turbojet.glb`、`export\turbojet.blend`、映射 JSON、EEVEE 预览 PNG

## 产物

| 路径 | 内容 |
| --- | --- |
| `export\turbojet.glb` | 装配 GLB（权威） |
| `export\turbojet.blend` | 同源 .blend |
| `export\turbojet-mapping.json` | 零件 rest/explode / 转轴 |
| `export\preview.png` | EEVEE 预览 |
| `docs\part-mapping.json` | 映射副本 |
| `docs\part-mapping.md` | 零件表 |

大屏只读副本：`E:\hengguang-plant-dashboard\public\assets\turbojet\`

## 坐标系

- 建模：Blender Z-up，发动机轴线 +Y（进气 −Y，喷口 +Y）
- glTF：Y-up，`(x, y, z)_blender → (x, z, −y)_gltf`
- 转子：节点 `RotorSpool`，绕 mapping `spin.axis` 转
