# 工业组件库资产规范（冻结）

监视-only。单位、轴向、法兰、port、PBR、LOD、导出在改模型前冻结。权威 Blender 工程：`E:\catalog-industrial-blender\`。大屏只读 GLB 副本：`E:\hengguang-plant-dashboard\public\assets\catalog\`。

**不替换** `public/assets/plant/` 能源站 GLB、`public/assets/turbojet/` 涡喷 GLB。不改 `topology.ts` / 点表。

同内容副本：`E:\catalog-industrial-blender\docs\asset-spec.md`。

---

## 1. 单位与轴向

| 项 | 约定 |
| --- | --- |
| 单位 | 1 单位 = **1 m**（Blender 与 glTF 相同） |
| 轴向 | **Y-up**（Blender 建模 Z-up，glTF 导出 `export_yup=True`：Blender `(x,y,z)` → glTF `(x,z,−y)`） |
| 流向 | 默认 **+X**（glTF）：`port_in` → `port_out` |
| 全库比例 | 同一世界比例，禁止每件自己缩放；加载器对工艺/管件/电气/标注 **不做 fit-to-0.9** |
| 能源站 / 涡喷 | 保持原加载路径与缩放，本规范不覆盖 |

Blender 建模：+Z 为上，流向 +X。弯头在 XY 平面转弯（导出后为 glTF XZ 地面转弯）。

---

## 2. 原点

| 类别 | 原点 |
| --- | --- |
| 直管 / 弯头 / 在线阀门 / 流量计 | 流道中心线 × 面到面中点 |
| 单独法兰 | 密封面中心，+X 为流出（密封面法向） |
| 落地装置（撬、过滤器、储罐） | 安装底面中心，+Y 向上 |
| 电气标牌 / 铭牌 | 标牌板面中心（可带短立柱，柱底可低于原点） |
| 标注线 | 线段中点 |

落地件画布放置高度 **y = 0**；在线件 **y = 1**（管廊高度）。吸附以 port 为准，不用包围盒中心硬拼。

---

## 3. 法兰规格（全库唯一）

系列：**DN100 / PN16**，对焊颈法兰（WN，EN 1092-1 Type 11 视觉，RF 突面）。螺栓 **8×M16**。管件、阀门、装置接管必须复用同一套尺寸，禁止私自改外径/孔数。

| 尺寸 | 值 (m) | 备注 |
| --- | --- | --- |
| 管外径 OD | 0.1143 | DN100 |
| 管内径 ID | 0.0960 | 视觉壁厚约 9 mm，避免纸薄 |
| 法兰外径 | 0.220 | PN16 DN100 |
| 法兰厚度 | 0.022 | 不含突面 |
| 突面 RF 外径 | 0.158 | 高 0.002 |
| 螺栓圆 PCD | 0.180 | |
| 螺栓孔 | 8×φ0.018 | |
| 螺栓 | M16，六角头 + 螺柱 + 螺母 | 实例化，不复制网格 |
| 颈长（WN） | 0.040 | 锥段收到管 OD |
| 垫片缝 | 0.002 | 可视化缝，不单独交付垫片件 |

弯头：90° **长半径** R = 1.5D ≈ 0.171 m。直管默认面到面 **1.00 m**。球阀面到面 **0.230 m**（Class 150 / EN 558 量级）。

---

## 4. Port 节点

每个流体接口一个 glTF 空节点（Blender Empty）：

| 名 | 含义 |
| --- | --- |
| `port_in` | 入口密封面中心 |
| `port_out` | 出口密封面中心 |
| `port_vent` / `port_drain` / `port_branch` | 可选第三口 |

- 局部 **+X** 指向流出（离开设备）。
- 自定义属性：`dn=100`，`pn=16`，`port="in"|"out"|…`。
- 画布吸附对齐这些节点，不对准包围盒。

落地件的进出口仍在同一中心线高度（角式放散阀、篮式过滤器除外，见单件）。

---

## 5. 网格命名

英文语义，禁止 `Cube.012`。

| 节点 | 用途 |
| --- | --- |
| `body-core` | 选中框锚点（必须有且仅有一个） |
| `ValveBody` / `PipeBody` / `Shell` / `SkidFrame` | 主体 |
| `Flange_A` / `Flange_B` | 端法兰 |
| `Actuator` / `Handwheel` / `Bonnet` / `Stem` | 阀件 |
| `Nameplate` | 铭牌 |
| `SymbolPlate` | 电气标牌 |

根节点名 = CatalogKind（`PIPE`、`HOV`…）。自定义属性：`catalogKind`、`spec="dn100-pn16-v1"`、`lod="high"`。

可动件（手柄、执行器指示）单独成节点，保留旋转轴，第一期静态。

---

## 6. PBR 材质命名（Principled BSDF → glTF）

禁止 Blender 专有节点作为最终着色。金属用 Metallic-Roughness。油漆件 **metallic = 0**，用清漆（Coat）表现漆面。不要用自发光提亮主体。

| 材质名 | 用途 | metallic | roughness | 色（线性约） |
| --- | --- | --- | --- | --- |
| `Paint_YellowPipe` | 碳钢管道 / 阀体工业黄 | 0 | 0.42 | 0.72, 0.55, 0.12 |
| `Paint_GreyBody` | 壳体灰漆 | 0 | 0.48 | 0.38, 0.40, 0.42 |
| `Paint_ActuatorBlue` | 执行器电工蓝 | 0 | 0.40 | 0.10, 0.22, 0.38 |
| `Paint_SafetyRed` | 放散 / 安全 | 0 | 0.40 | 0.55, 0.08, 0.08 |
| `Paint_SafetyOrange` | 切断阀识别 | 0 | 0.42 | 0.70, 0.32, 0.06 |
| `Paint_Black` | 手柄套、表壳 | 0 | 0.50 | 0.06, 0.06, 0.07 |
| `Metal_Machined` | 密封面、阀杆、加工面 | 0.85 | 0.22 | 0.72, 0.73, 0.74 |
| `Metal_Galvanized` | 螺栓螺母 | 0.80 | 0.35 | 0.55, 0.56, 0.54 |
| `Metal_Stainless` | 不锈钢拉丝 | 0.90 | 0.28 | 0.62, 0.63, 0.64 |
| `Metal_Plate` | 电气/铭牌底板 | 0.35 | 0.45 | 0.18, 0.20, 0.22 |
| `Rubber_Black` | 手柄套、密封 | 0 | 0.70 | 0.04, 0.04, 0.04 |
| `Glass_Instrument` | 表镜、视窗 | 0 | 0.08 | 0.85, 0.90, 0.95（透） |
| `Plastic_Nameplate` | 位号牌面 | 0 | 0.55 | 贴图 albedo |

ORM 打包、法线 OpenGL、albedo sRGB。第一期允许无贴图的 Principled 值 + 少量铭牌/表盘/符号 PNG（≤1K）。禁止糖果色、MeshBasic 作为主体。

Three.js：`MeshStandardMaterial` / `MeshPhysicalMaterial` + 已有 `studioPbr` IBL。模型不自发光。

---

## 7. LOD 与三角面预算（含实例化前）

| 档 | 阀门 / 管件 / 仪表 | 撬装 / 过滤器 / 容器 | 电气符号 / 标注 |
| --- | --- | --- | --- |
| High | 3k–12k | 8k–25k | 几何极简，轮廓+贴图 |
| LOD1 | 1.5k–4k | 约 High 的 40% | 同 High |
| LOD2 | 400–1.2k | 远距可辨类型 | — |

本轮交付 **High** 单 GLB（`lod="high"`）。LOD1/LOD2 文件名预留 `{kind}_lod1.glb`，未出则加载器只用 High。螺栓/法兰/螺母 **mesh 实例**，不要复制几何。

GLB 体积：管件/阀 通常数百 KB；装置 可到 1–2 MB。纹理 2K 为主，本轮铭牌/符号 512–1024。

---

## 8. 导出

- 格式：glTF 2.0 **GLB**，嵌入纹理。
- `export_yup=True`，`export_cameras=False`，`export_lights=False`，`export_extras=True`，`export_apply=True`（网格）。
- 保留节点层级与 port Empty。
- 双面材质仅铭牌/垫片/标牌薄件。
- 不要 Draco（加载端未开解码器）。不要导出灯光摄像机。
- 权威 `.blend` 与脚本在 `E:\catalog-industrial-blender\`；大屏只拷 GLB + `catalog-glb.json`。

```
blender --background --python E:\catalog-industrial-blender\scripts\build_catalog.py
```

Blender：`E:\energy-station-blender\tools\blender-4.5.16-windows-x64\blender.exe`

---

## 9. CatalogKind 与文件

| kind | 文件 | 分类 | 原点 |
| --- | --- | --- | --- |
| PIPE | pipe.glb | 管段 | 在线中点 |
| PIPE_ELBOW | pipe-elbow.glb | 管段 | 弯心 |
| FLANGE | flange.glb | 管段 | 密封面 |
| HENG_GUANG_SKID | heng-guang-skid.glb | 工艺 | 底面中心 |
| UF | uf.glb | 工艺 | 在线中点 |
| FS | fs.glb | 工艺 | 底面中心 |
| HOV | hov.glb | 工艺 | 在线中点 |
| MOV | mov.glb | 工艺 | 在线中点 |
| SSV | ssv.glb | 工艺 | 在线中点 |
| PCV | pcv.glb | 工艺 | 在线中点 |
| PV | pv.glb | 工艺 | 进口中心线（角式，出口朝上） |
| INSTR | instr.glb | 工艺 | 过程接头 |
| TANK | tank.glb | 工艺 | 底面中心 |
| ELEC_CB | elec-cb.glb | 电气 A | 标牌中心 |
| ELEC_M | elec-m.glb | 电气 A | 标牌中心 |
| ELEC_GND | elec-gnd.glb | 电气 A | 标牌中心 |
| TEXT | text.glb | 标注 | 铭牌中心 |
| LINE_SOLID / LINE_DASHED | Three.js Line2 + 管状网格 | 标注 | 中点 |

电气 **只做方案 A**（GB/T 4728 / IEC 60617 三维标牌），不混写实断路器/电机。

---

## 10. 加载器

- 工艺 / 管件 / 电气 / 铭牌：`/assets/catalog/catalog-glb.json`
- 能源站：仍 `/assets/plant/catalog-glb.json`
- 涡喷：仍 `/assets/turbojet/turbojet.glb`
- `SKIP_FIT`：上表工业 kind + `TURBOJET`
- 缩略图与拖放走 `buildCatalogMesh` → GLB 优先
- 标注线：`Line2`（屏宽稳定）+ 同径管状网格；虚线 dash 世界单位

---

## 11. 验收对照（总则）

1. 缩到图标可辨类型；拉近看法兰螺栓、分模、执行器或铭牌。
2. port 对齐后中心线连续、DN100 一致、法兰不悬空穿模。
3. IBL 下金属/油漆，不塑料、不发光、不溢色。
4. 三角面与体积在预算内，画布可拖。
5. 命名、单位、原点、轴向、port 全库一致。
