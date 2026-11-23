# 能源站设备映射表（典型场景建模）

无现场总平面/断面图纸。轮廓与尺寸取户外储能电站常见柜式/油浸变量级，不得作为施工图。

## 坐标约定

| 项 | 约定 |
| --- | --- |
| 单位 | 米 |
| GLB / Three.js | 右手系 **Y-up**；设备原点在底面中心 |
| 站区平移 | 节点 `translation`：X 东、Y 上、Z 北向布置（本场景 Z 从南门增大） |
| 主键 | 根节点 `extras.entityId` → 运行时 `userData.entityId` |
| 不可点选 | 道路 / 围栏 / 桥架 / 地坪 / 管线，无 entityId |

## PCS ↔ 储能柜

| 组 | PCS | 储能柜 |
| --- | --- | --- |
| ES-PAIR-A | ES-PCS-01 | ES-BESS-A1, ES-BESS-A2, ES-BESS-A3, ES-BESS-A4 |
| ES-PAIR-B | ES-PCS-02 | ES-BESS-B1, ES-BESS-B2, ES-BESS-B3, ES-BESS-B4 |

## 目录 GLB

| 文件 | entityId | 类型 | 说明 |
| --- | --- | --- | --- |
| `catalog/pcs.glb` | `ES-PCS-02` | PCS-02 储能变流器 | 典型场景建模 |
| `catalog/transformer.glb` | `ES-XFMR` | 变压器 | 典型场景建模 |
| `catalog/bess.glb` | `ES-BESS` | 储能柜 | 典型场景建模 |
| `catalog/load.glb` | `ES-LOAD` | 主要负荷 | 典型场景建模 |
| `catalog/dist-room.glb` | `ES-DIST-01` | 配电房 | 典型场景建模 |

## 站区实例

| entityId | 名称 | 类型 | X | Z | 配对 |
| --- | --- | --- | --- | --- | --- |
| `ES-DIST-01` | 配电房 | DIST_ROOM | 8.0 | 27.5 | — |
| `ES-XFMR-01` | 变压器 | TRANSFORMER | 16.5 | 27.5 | — |
| `ES-PCS-01` | PCS-01 | PCS | 23.5 | 27.2 | ES-PAIR-A |
| `ES-PCS-02` | PCS-02 | PCS | 27.5 | 27.2 | ES-PAIR-B |
| `ES-BESS-A1` | 储能柜 A1 | BESS | 8.0 | 16.0 | ES-PAIR-A |
| `ES-BESS-A2` | 储能柜 A2 | BESS | 10.5 | 16.0 | ES-PAIR-A |
| `ES-BESS-A3` | 储能柜 A3 | BESS | 8.0 | 18.5 | ES-PAIR-A |
| `ES-BESS-A4` | 储能柜 A4 | BESS | 10.5 | 18.5 | ES-PAIR-A |
| `ES-BESS-B1` | 储能柜 B1 | BESS | 24.0 | 16.0 | ES-PAIR-B |
| `ES-BESS-B2` | 储能柜 B2 | BESS | 26.5 | 16.0 | ES-PAIR-B |
| `ES-BESS-B3` | 储能柜 B3 | BESS | 24.0 | 18.5 | ES-PAIR-B |
| `ES-BESS-B4` | 储能柜 B4 | BESS | 26.5 | 18.5 | ES-PAIR-B |
| `ES-LOAD-01` | 主要负荷 | LOAD | 12.0 | 6.0 | — |
