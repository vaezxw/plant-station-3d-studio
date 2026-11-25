import type { CatalogKind } from './catalog';

export type StudioMode = 'templates' | 'studio' | 'dashboard' | 'present';
export type TransformTool = 'select' | 'move' | 'rotate' | 'scale' | 'pipe';
export type DashboardTemplateId = 'immersive' | 'command' | 'minimal';

export type DashboardWidgetType =
  | 'kpi'
  | 'trend'
  | 'alarms'
  | 'detail'
  | 'production'
  | 'section-stats';

export type DashboardWidgetConfig = {
  id: string;
  type: DashboardWidgetType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
};

export type Vec3 = [number, number, number];

export type GroundStyle =
  | 'weathered-concrete'
  | 'epoxy-dark'
  | 'slate-matte'
  | 'steel-grid-floor'
  | 'grid-only';

export type GroundConfig = {
  enabled: boolean;
  style: GroundStyle;
  shape: 'rect' | 'circle';
  width: number;
  depth: number;
  roughness: number;
  metalness: number;
  showBorder: boolean;
};

export function createDefaultGroundConfig(): GroundConfig {
  return {
    enabled: true,
    style: 'weathered-concrete',
    shape: 'rect',
    width: 32,
    depth: 24,
    roughness: 0.48,
    metalness: 0.14,
    showBorder: true,
  };
}

export type PipeFlowMode = 'uv-chevron' | 'glass-stream' | '3d-arrow' | 'none';

export type PipeFlowConfig = {
  enabled: boolean;
  mode: PipeFlowMode;
  direction: 'forward' | 'reverse';
  speed: number;
  color?: string;
  bindPointId?: string;
};

export function createDefaultPipeFlow(): PipeFlowConfig {
  return {
    enabled: true,
    mode: 'uv-chevron',
    direction: 'forward',
    speed: 1.0,
  };
}

export type SceneNode = {
  id: string;
  tag: string;
  name: string;
  section: string;
  kind: CatalogKind | 'CUSTOM_GLB';
  customGlbId?: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color?: string;
  floorStyle?: GroundStyle;
  pipeFlow?: PipeFlowConfig;
  visible: boolean;
  locked: boolean;
  pointIds: string[];
  labelText?: string;
};

export type PipeEdge = {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  medium: 'gas' | 'water' | 'air';
  diameterMm: number;
  flow?: PipeFlowConfig;
};

export type CameraBookmark = {
  id: string;
  name: string;
  position: Vec3;
  target: Vec3;
};

export type ProjectSchema = {
  version: 2;
  id: string;
  name: string;
  industry: 'gas-meter' | 'gas-station' | 'water' | 'energy' | 'custom';
  description: string;
  themeId: string;
  dashboardTemplate: DashboardTemplateId;
  dashboardWidgets?: DashboardWidgetConfig[];
  ground?: GroundConfig;
  nodes: SceneNode[];
  pipes: PipeEdge[];
  bookmarks: CameraBookmark[];
  updatedAt: number;
};

export function createWidgetsForTemplate(tpl: DashboardTemplateId): DashboardWidgetConfig[] {
  if (tpl === 'minimal') {
    return [
      { id: 'w-kpi', type: 'kpi', title: '核心运行指标', x: 0, y: 0, w: 3, h: 4, visible: false },
      { id: 'w-trend', type: 'trend', title: '压力与流量实时曲线', x: 0, y: 4, w: 3, h: 4, visible: false },
      { id: 'w-alarms', type: 'alarms', title: '安全报警监控', x: 0, y: 8, w: 3, h: 4, visible: false },
      { id: 'w-detail', type: 'detail', title: '选中设备详情', x: 9, y: 0, w: 3, h: 6, visible: false },
      { id: 'w-prod', type: 'production', title: '燃气表产量与标定合格率', x: 9, y: 6, w: 3, h: 4, visible: false },
      { id: 'w-sec', type: 'section-stats', title: '工段设备分布', x: 3, y: 8, w: 6, h: 3, visible: false },
    ];
  }
  if (tpl === 'command') {
    return [
      { id: 'w-kpi', type: 'kpi', title: '核心运行指标', x: 0, y: 0, w: 3, h: 4, visible: true },
      { id: 'w-trend', type: 'trend', title: '压力与流量实时曲线', x: 0, y: 4, w: 3, h: 4, visible: true },
      { id: 'w-alarms', type: 'alarms', title: '安全报警监控', x: 0, y: 8, w: 3, h: 4, visible: true },
      { id: 'w-detail', type: 'detail', title: '选中设备详情', x: 9, y: 0, w: 3, h: 5, visible: true },
      { id: 'w-prod', type: 'production', title: '燃气表产量与标定合格率', x: 9, y: 5, w: 3, h: 4, visible: true },
      { id: 'w-sec', type: 'section-stats', title: '工段设备分布', x: 9, y: 9, w: 3, h: 3, visible: true },
    ];
  }
  // immersive 默认模板
  return [
    { id: 'w-kpi', type: 'kpi', title: '核心运行指标', x: 0, y: 0, w: 3, h: 4, visible: true },
    { id: 'w-trend', type: 'trend', title: '压力与流量实时曲线', x: 0, y: 4, w: 3, h: 4, visible: true },
    { id: 'w-alarms', type: 'alarms', title: '安全报警监控', x: 0, y: 8, w: 3, h: 4, visible: true },
    { id: 'w-detail', type: 'detail', title: '选中设备详情', x: 9, y: 0, w: 3, h: 5, visible: true },
    { id: 'w-prod', type: 'production', title: '燃气表产量与标定合格率', x: 9, y: 5, w: 3, h: 4, visible: true },
    { id: 'w-sec', type: 'section-stats', title: '工段设备分布', x: 3, y: 8, w: 6, h: 3, visible: false },
  ];
}
