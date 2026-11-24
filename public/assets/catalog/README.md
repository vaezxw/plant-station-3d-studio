# 工业组件 GLB（工艺 / 管件 / 电气 A / 铭牌）

权威源：`E:\catalog-industrial-blender\`。本目录是大屏只读副本。

- 规范：`docs/asset-spec.md`（单位 1 m，Y-up，DN100 PN16）
- 加载器：`src/scene/catalog/glbCatalog.ts` 读 `catalog-glb.json`
- **不 fit-to-0.9**（保持真实比例）
- 不替换 `public/assets/plant/` 能源站、`public/assets/turbojet/` 涡喷

标注实线/虚线不走 GLB，由 Three.js `Line2` + 管状网格生成。
