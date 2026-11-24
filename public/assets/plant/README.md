# 工艺设备 GLB

把与目录 `CatalogKind` 同名的模型放到本目录，三维组件库会优先用 GLB，找不到则回退程序化 primitive。

## 约定

- 文件名：`UF.glb`、`HOV.glb`、`PIPE.glb`…（大小写均可）
- 或写清单 `catalog-glb.json`：

```json
{
  "UF": "models/uf_v2.glb",
  "HOV": "hov.glb"
}
```

路径相对本目录；也可用以 `/` 开头的绝对 URL。

## 注意

- 加载后会自动居中并缩放到约 1 单位，底部贴地。
- 拖拽编排（compose）不变；GLB 仅替换外观。

能源站柜体：`pcs.glb` / `pcs-02.glb` / `bess.glb` / `transformer.glb` / `load.glb` / `dist-room.glb` / `energy-station.glb`。

组件库 kind：`PCS` / `TRANSFORMER` / `BESS` / `LOAD` / `DIST_ROOM`（分类「能源站」）。加载器 `src/scene/catalog/glbCatalog.ts` 读本目录 `catalog-glb.json`，居中缩放到约 1 单位、底部贴地。不替换 UF/HOV 工艺 primitive。
