# Plant Station 3D Studio — 纯前端 3D 工艺流程低代码搭建平台

面向**燃气表制造工艺、燃气输配调压、可燃气体报警监控、水务工艺与综合能源站**的纯前端 3D 工艺流程搭建与数字孪生大屏展示平台（监视-only）。

## 核心能力

- **四大工作模式无缝切换**：
  - **模板中心**：内置「燃气表智能制造与标定车间」「燃气输配调压与报警监控站」「水务增压与综合能源站」「空白 3D 画布」4 套工程模板，支持 IndexedDB 本地工程库与 `.json` 工程模板导入/导出。
  - **3D 搭建（Studio）**：四区无遮挡专业工作台（资产库 / 大纲 + 3D 主视口 + 属性检查器）。
    - **鼠标直接拖拽 + 智能磁吸对齐**：默认选择模式下按住设备即可在地面自由拖动，靠近其他设备中心线自动显示青/琥珀色对齐引导线并吸附。
    - **管口吸附自动正交连管（`P`）**：点击两台设备管口锚点自动生成带 90° 弯头、连接法兰与流体流光动画的三维管路，移动设备时管道实时跟随重算。
    - **画布锁定预览**：一键锁定画布防误触，仅允许放大、缩小与旋转整体视角预览。
    - **变换与历史栈**：支持 `TransformControls`（`Q/W/E/R`）、`±90°` 快速转向、多步 `Ctrl+Z / Y` 撤销重做、`Ctrl+D` 复制、`F` 聚焦与导入本地 `.glb` 模型。
    - **整站导出**：支持一键将搭建完成的 3D 厂站及管网导出为标准 `.glb` 模型。
  - **大屏编排（Dashboard）**：基于 12 列自由网格（`react-grid-layout`）拖拽/缩放业务卡片（实时 KPI、SVG 双波形趋势曲线、安全报警监控、燃气表产量与标定合格率、工段分布、设备联动详情），空白区域透传 3D 视角操作，支持切换 3 套预设大屏模板及录制「视角书签」。
  - **全屏演示（Present）**：隐藏编辑控件，提供纯净沉浸式 3D 数字孪生展示与视角漫游巡检。
- **可扩展主题体系**：内置「深空工业暗灰蓝」「燃气调度琥珀夜」「工程蓝图浅灰白」，支持在界面内自定义配色与 3D 环境氛围并持久化保存。

## 本地开发与资产生成

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查与生产构建
npm run build

# 离线重新生成燃气表行业高精度 GLB 模型库（输出至 public/assets/studio/）
node scripts/generate-studio-assets.mjs

# 校验 M1 测点与拓扑数据
npm run assert:m1
```

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `src/domain/` | 工程 Schema v2、燃气表全行业设备目录、内置预设模板与可扩展主题注册表 |
| `src/store/` | Zustand 状态库（工程与 Undo/Redo 历史栈、编辑器状态、实时仿真测点序列） |
| `src/engine/` | 纯 TS Three.js 引擎（`SceneCore`、PBR `MaterialLibrary`、`AssetManager`、`PipeSystem`、`ThumbnailGenerator`、`SceneExporter`） |
| `src/ui/` | 四区 Studio 界面、模板中心、大屏自由网格编排与卡片组件 |
| `scripts/generate-studio-assets.mjs` | 离线高精度 PBR `.glb` 工业模型批量生成脚本 |
| `public/assets/studio/` | 21 款高精度工业 `.glb` 资产及 `manifest.json`（由 Git LFS 跟踪） |
| `public/assets/catalog/` & `plant/` & `turbojet/` | 工业管件、能源站柜体与涡喷透平资产 |
