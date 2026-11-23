# 工业组件库（Blender 权威源）

DN100 PN16、Y-up、1 m 单位。监视-only。规范：`docs/asset-spec.md`。

```bat
E:\energy-station-blender\tools\blender-4.5.16-windows-x64\blender.exe --background --python E:\catalog-industrial-blender\scripts\build_catalog.py
```

产物：`export\catalog\*.glb`，并复制到 `E:\hengguang-plant-dashboard\public\assets\catalog\`。

不替换能源站 / 涡喷 GLB。
