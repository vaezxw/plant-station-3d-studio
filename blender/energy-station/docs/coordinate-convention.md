# 坐标约定

无现场总平面/断面图纸。轮廓与尺寸取户外储能电站常见柜式/油浸变量级，不得作为施工图。

1. **单位**：米。
2. **运行 GLB**：glTF 右手系，**Y 朝上**。设备根节点原点在落地底面中心，+Y 为高度。
3. **站区**：`translation = (x, 0, z)`，x 向东增大，z 向北增大（南门在 z≈0）。
4. **Blender**：用官方 glTF 导入后为 Z-up；继续改层级 / 材质后请再导出 GLB（勾选 extras）。
5. **Three.js**：`GLTFLoader` 后 `object.traverse`，读 `userData.entityId`。同一 ID 绑列表、标签、详情。
6. **配对**：PCS 根节点 `pairRole=pcs` + `pairedEntityIds`；储能柜 `pairRole=bess` + `pairedPcsId`。
