# 典型能源站三维资产（Blender / GLB）

无现场总图，全部标为 **典型场景建模**。对象是供配电 + 储能 + 负荷，**不是**恒光橇装，也不是液体输送/换热演示几何。

监视-only：根节点 `extras.monitorOnly=true`、`writable=false`。无阀、无写控。

未改 `E:\hengguang-plant-dashboard\src`。

## 本机缺什么

| 项 | 状态 |
| --- | --- |
| Blender MCP（Cursor `mcp.json`） | **未配置**。本机 MCP 无 blender 桥。几何由 `scripts\build_catalog.py` 写 glTF。 |
| 便携 Blender | **已有** `E:\energy-station-blender\tools\blender-4.5.16-windows-x64\blender.exe`（4.5.16 LTS）。用于 `blend_wrap.py` 与 PCS 预览。 |
| 现场总图 | **没有**。尺寸取户外储能柜 / 油浸变常见量级。 |

## 生成

```powershell
python E:\energy-station-blender\scripts\build_catalog.py
& "E:\energy-station-blender\tools\blender-4.5.16-windows-x64\blender.exe" --background --python E:\energy-station-blender\scripts\blend_wrap.py
& "E:\energy-station-blender\tools\blender-4.5.16-windows-x64\blender.exe" --background --python E:\energy-station-blender\scripts\render_pcs_preview.py
python E:\energy-station-blender\scripts\validate_glb.py
```

## 交付路径

| 内容 | 路径 |
| --- | --- |
| 目录 PCS（PCS-02 户外柜） | `E:\energy-station-blender\export\catalog\pcs.glb` |
| 同上别名 | `E:\energy-station-blender\export\catalog\pcs-02.glb` |
| 变压器 | `E:\energy-station-blender\export\catalog\transformer.glb` |
| 储能柜 | `E:\energy-station-blender\export\catalog\bess.glb` |
| 主要负荷 | `E:\energy-station-blender\export\catalog\load.glb` |
| 配电房 | `E:\energy-station-blender\export\catalog\dist-room.glb` |
| 站区拼装 GLB | `E:\energy-station-blender\export\energy-station.glb` |
| 可编辑 .blend | `E:\energy-station-blender\export\energy-station.blend` |
| PCS-02 预览 | `E:\energy-station-blender\export\preview-pcs-02.png` |
| 映射表 | `E:\energy-station-blender\docs\equipment-mapping.md` / `.json` |
| 坐标约定 | `E:\energy-station-blender\docs\coordinate-convention.md` |
| 大屏只读副本 | `E:\hengguang-plant-dashboard\public\models\` 与 `public\assets\plant\` |

大屏 `CatalogKind` 仍是 UF/HOV。能源站 GLB **不会**自动替换工艺 primitive。`catalog-glb.json` 只登记 PCS/BESS 等键，留给后续 catalog 任务。

## 主键与配对

- 根节点 `extras.entityId` → Three `userData.entityId`
- PCS：`pairRole=pcs` + `pairedEntityIds`（JSON 数组）
- 储能柜：`pairRole=bess` + `pairedPcsId`
- `ES-PCS-01` ↔ `ES-BESS-A1..A4`（组 `ES-PAIR-A`）
- `ES-PCS-02` ↔ `ES-BESS-B1..B4`（组 `ES-PAIR-B`）
