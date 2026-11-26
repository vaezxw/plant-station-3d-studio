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
  | 'section-stats'
  | 'custom';

export type CardElementType =
  | 'text'
  | 'icon'
  | 'kpi'
  | 'progress'
  | 'status-dot'
  | 'chart-line'
  | 'chart-bar'
  | 'chart-gauge'
  | 'divider';

export type ThresholdRule = {
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
  value: number;
  color: string;
  blink?: boolean;
};

export type ElementDataBinding = {
  mode: 'static' | 'point' | 'device-slot';
  dataSourceId?: string;
  pointKey?: string;
  deviceSlot?: {
    target: 'bound-node' | 'selected-node';
    prop?: 'tag' | 'name' | 'section' | 'metric';
    metricIndex?: number;
  };
  format?: {
    multiplier?: number;
    offset?: number;
    precision?: number;
    unit?: string;
    fallback?: string;
  };
  thresholds?: ThresholdRule[];
};

export type SceneActionConfig =
  | { type: 'none' }
  | { type: 'focus-node'; nodeId: string }
  | { type: 'fly-bookmark'; bookmarkId: string }
  | { type: 'highlight-section'; section: string }
  | { type: 'highlight-pipe'; pipeId: string }
  | { type: 'toggle-turbojet'; nodeId: string; mode: 'spin' | 'explode' | 'cutaway' };

export type CardElementStyle = {
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  fontFamily?: 'sans' | 'mono';
  color?: string;
  background?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  textAlign?: 'left' | 'center' | 'right';
  heightPx?: number;
};

export type CardElementProps = {
  text?: string;
  label?: string;
  iconName?: string;
  iconSize?: number;
  seriesPointIds?: string[];
  chartColors?: string[];
  min?: number;
  max?: number;
  showGrid?: boolean;
  areaFill?: boolean;
  statusActiveText?: string;
  statusIdleText?: string;
};

export type CardElementSchema = {
  id: string;
  type: CardElementType;
  name: string;
  layout: {
    colSpan: number; // 1 ~ 12（卡片内部 12 列网格）
  };
  style: CardElementStyle;
  props: CardElementProps;
  binding?: ElementDataBinding;
  onClickAction?: SceneActionConfig;
};

export type CardStyleConfig = {
  background?: string;
  blurPx?: number;
  borderColor?: string;
  borderRadius?: number;
  headerColor?: string;
  glowColor?: string;
};

export type DashboardSceneBinding = {
  targetNodeId?: string;
  targetCatalogKind?: CatalogKind;
  followSelectedNode?: boolean;
  clickAction?: SceneActionConfig;
};

export type DashboardWidgetConfig = {
  id: string;
  type: DashboardWidgetType;
  title: string;
  showHeader?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  locked?: boolean;
  gridCols?: 24;
  cardStyle?: CardStyleConfig;
  elements?: CardElementSchema[];
  sceneBinding?: DashboardSceneBinding;
};

export type CardTemplateSchema = {
  id: string;
  name: string;
  category: 'kpi' | 'chart' | 'equipment' | 'alarm' | 'custom';
  description?: string;
  bindCatalogKind?: CatalogKind;
  defaultSize: { w: number; h: number };
  cardStyle?: CardStyleConfig;
  elements: CardElementSchema[];
  createdAt: number;
  isBuiltin?: boolean;
};

export type DataSourceType = 'builtin-sim' | 'http-rest' | 'websocket' | 'static-json';

export type DataSourceParserConfig = {
  mode: 'array' | 'key-value';
  dataPath?: string;
  idField?: string;
  valueField?: string;
  qualityField?: string;
  tsField?: string;
};

export type DataSourceConfig = {
  id: string;
  name: string;
  type: DataSourceType;
  enabled: boolean;
  http?: {
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    bodyJson?: string;
    pollIntervalMs: number;
  };
  realtime?: {
    url: string;
    topics?: string[];
    reconnectMs: number;
  };
  staticJson?: string;
  parser?: DataSourceParserConfig;
};

export function createDefaultDataSources(): DataSourceConfig[] {
  return [
    {
      id: 'builtin-sim',
      name: '内置 SCADA 工艺仿真引擎',
      type: 'builtin-sim',
      enabled: true,
    },
  ];
}

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

export type CustomNodePointRef = {
  key: string;
  label: string;
  unit?: string;
  dataSourceId?: string;
};

export type SceneNode = {
  id: string;
  tag: string;
  name: string;
  section: string;
  kind: CatalogKind | 'CUSTOM_GLB';
  customGlbId?: string;
  /** 预留：自定义模型上传 OSS 后的持久化 HTTPS URL */
  customGlbUrl?: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color?: string;
  floorStyle?: GroundStyle;
  pipeFlow?: PipeFlowConfig;
  visible: boolean;
  locked: boolean;
  pointIds: string[];
  customPoints?: CustomNodePointRef[];
  detailTemplateId?: string;
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
  dataSources?: DataSourceConfig[];
  kindTemplateMap?: Partial<Record<CatalogKind, string>>;
  ground?: GroundConfig;
  nodes: SceneNode[];
  pipes: PipeEdge[];
  bookmarks: CameraBookmark[];
  /** 已发布到 3D 平台服务端的短场景 ID（重发布保持不变，确保 SCADA 引用链接稳定） */
  publishedSceneId?: string;
  /** 关联 SCADA 采集点 / 厂站业务编码（预留映射键） */
  stationCode?: string;
  /** 工程缩略图快照（用于门户首页画廊展示） */
  thumbnailDataUrl?: string;
  updatedAt: number;
};

/** 实时数据驱动模式：auto 随运行环境决策；bridge 走 SCADA 宿主 postMessage 推送；direct 走内置直连；sim 走本地仿真 */
export type DataFeedMode = 'auto' | 'bridge' | 'direct' | 'sim';

/** 选项 B 发布存储模式：local-mock 走浏览器 IndexedDB；remote-api 走后端 REST API */
export type PublishStorageMode = 'local-mock' | 'remote-api';

export type PublishEndpointSettings = {
  storageMode: PublishStorageMode;
  apiBaseUrl: string;
  authHeaderName: string;
  authHeaderValue: string;
};

export type PublishedSceneSummary = {
  sceneId: string;
  revision: number;
  stationCode?: string;
  title: string;
  shareToken: string;
  requireToken: boolean;
  embedDefaultDataMode: DataFeedMode;
  nodeCount: number;
  widgetCount: number;
  thumbnailDataUrl?: string;
  publishedAt: number;
  updatedAt: number;
};

export type PublishedSceneRecord = PublishedSceneSummary & {
  schema: ProjectSchema;
};

export function createDefaultCardElement(type: CardElementType): CardElementSchema {
  const uid = `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case 'text':
      return {
        id: uid,
        type: 'text',
        name: '文本框',
        layout: { colSpan: 12 },
        style: { fontSize: 13, fontWeight: 600, fontFamily: 'sans', color: '#f1f5f9', textAlign: 'left', padding: 4 },
        props: { text: '工艺单元监视标题' },
        binding: { mode: 'static' },
      };
    case 'icon':
      return {
        id: uid,
        type: 'icon',
        name: '工业图标',
        layout: { colSpan: 3 },
        style: { color: '#38bdf8', background: 'rgba(56,189,248,0.12)', borderRadius: 8, padding: 6, textAlign: 'center' },
        props: { iconName: 'Gauge', iconSize: 20, label: '运行标' },
      };
    case 'kpi':
      return {
        id: uid,
        type: 'kpi',
        name: 'KPI 实时指标',
        layout: { colSpan: 6 },
        style: {
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'mono',
          color: '#38bdf8',
          background: 'rgba(15,23,42,0.58)',
          borderColor: 'rgba(148,163,184,0.2)',
          borderRadius: 8,
          padding: 8,
        },
        props: { label: '出口压力', iconName: 'Gauge' },
        binding: {
          mode: 'point',
          dataSourceId: 'builtin-sim',
          pointKey: 'HG-UF-101.pressure',
          format: { precision: 2, unit: 'kPa', multiplier: 1, offset: 0 },
          thresholds: [{ operator: '>', value: 4900, color: '#ef4444', blink: true }],
        },
      };
    case 'progress':
      return {
        id: uid,
        type: 'progress',
        name: '液位 / 负荷进度条',
        layout: { colSpan: 12 },
        style: { color: '#38bdf8', fontSize: 12, fontFamily: 'mono', padding: 6, background: 'rgba(15,23,42,0.5)', borderRadius: 8 },
        props: { label: '储罐液位占空比', min: 0, max: 100 },
        binding: {
          mode: 'point',
          dataSourceId: 'builtin-sim',
          pointKey: 'HG-UF-101.flowWork',
          format: { precision: 1, unit: '%', multiplier: 0.5 },
        },
      };
    case 'status-dot':
      return {
        id: uid,
        type: 'status-dot',
        name: '运行状态指示灯',
        layout: { colSpan: 6 },
        style: { color: '#22c55e', fontSize: 12, padding: 6, background: 'rgba(15,23,42,0.5)', borderRadius: 8 },
        props: { label: '设备运行状态', statusActiveText: '运行正常', statusIdleText: '已停机' },
        binding: { mode: 'point', dataSourceId: 'builtin-sim', pointKey: 'HG-UF-101.flowWork' },
      };
    case 'chart-line':
      return {
        id: uid,
        type: 'chart-line',
        name: '实时折线趋势图',
        layout: { colSpan: 12 },
        style: { heightPx: 148, padding: 4 },
        props: {
          label: '压力与流量趋势',
          seriesPointIds: ['HG-UF-101.pressure', 'HG-UF-101.flowWork'],
          chartColors: ['#38bdf8', '#f59e0b'],
          showGrid: true,
          areaFill: true,
        },
      };
    case 'chart-bar':
      return {
        id: uid,
        type: 'chart-bar',
        name: '多路对比柱状图',
        layout: { colSpan: 12 },
        style: { heightPx: 140, padding: 4 },
        props: {
          label: '双路瞬时流量对比',
          seriesPointIds: ['HG-UF-101.flowWork', 'HG-UF-102.flowWork', 'HG-UF-102.flowStd'],
          chartColors: ['#38bdf8', '#22d3ee', '#34d399'],
          showGrid: true,
        },
      };
    case 'chart-gauge':
      return {
        id: uid,
        type: 'chart-gauge',
        name: '工业刻度仪表盘',
        layout: { colSpan: 6 },
        style: { heightPx: 150, color: '#38bdf8', padding: 2 },
        props: { label: '瞬时流量', min: 0, max: 200 },
        binding: {
          mode: 'point',
          dataSourceId: 'builtin-sim',
          pointKey: 'HG-UF-101.flowWork',
          format: { precision: 1, unit: 'm³/h' },
        },
      };
    case 'divider':
    default:
      return {
        id: uid,
        type: 'divider',
        name: '分割装饰线',
        layout: { colSpan: 12 },
        style: { borderColor: 'rgba(56,189,248,0.28)', padding: 2 },
        props: { text: '' },
      };
  }
}

export function createWidgetsForTemplate(tpl: DashboardTemplateId): DashboardWidgetConfig[] {
  if (tpl === 'minimal') {
    return [
      { id: 'w-kpi', type: 'kpi', title: '核心运行指标', x: 0, y: 0, w: 6, h: 6, gridCols: 24, visible: false },
      { id: 'w-trend', type: 'trend', title: '压力与流量实时曲线', x: 0, y: 6, w: 6, h: 6, gridCols: 24, visible: false },
      { id: 'w-alarms', type: 'alarms', title: '安全报警监控', x: 0, y: 12, w: 6, h: 6, gridCols: 24, visible: false },
      { id: 'w-detail', type: 'detail', title: '选中设备详情', x: 18, y: 0, w: 6, h: 9, gridCols: 24, visible: false },
      { id: 'w-prod', type: 'production', title: '燃气表产量与标定合格率', x: 18, y: 9, w: 6, h: 6, gridCols: 24, visible: false },
      { id: 'w-sec', type: 'section-stats', title: '工段设备分布', x: 6, y: 12, w: 12, h: 5, gridCols: 24, visible: false },
    ];
  }
  if (tpl === 'command') {
    return [
      { id: 'w-kpi', type: 'kpi', title: '核心运行指标', x: 0, y: 0, w: 6, h: 6, gridCols: 24, visible: true },
      { id: 'w-trend', type: 'trend', title: '压力与流量实时曲线', x: 0, y: 6, w: 6, h: 6, gridCols: 24, visible: true },
      { id: 'w-alarms', type: 'alarms', title: '安全报警监控', x: 0, y: 12, w: 6, h: 6, gridCols: 24, visible: true },
      { id: 'w-detail', type: 'detail', title: '选中设备详情', x: 18, y: 0, w: 6, h: 8, gridCols: 24, visible: true },
      { id: 'w-prod', type: 'production', title: '燃气表产量与标定合格率', x: 18, y: 8, w: 6, h: 6, gridCols: 24, visible: true },
      { id: 'w-sec', type: 'section-stats', title: '工段设备分布', x: 18, y: 14, w: 6, h: 5, gridCols: 24, visible: true },
    ];
  }
  // immersive 默认模板（24 列栅格坐标系）
  return [
    { id: 'w-kpi', type: 'kpi', title: '核心运行指标', x: 0, y: 0, w: 6, h: 6, gridCols: 24, visible: true },
    { id: 'w-trend', type: 'trend', title: '压力与流量实时曲线', x: 0, y: 6, w: 6, h: 6, gridCols: 24, visible: true },
    { id: 'w-alarms', type: 'alarms', title: '安全报警监控', x: 0, y: 12, w: 6, h: 6, gridCols: 24, visible: true },
    { id: 'w-detail', type: 'detail', title: '选中设备详情', x: 18, y: 0, w: 6, h: 8, gridCols: 24, visible: true },
    { id: 'w-prod', type: 'production', title: '燃气表产量与标定合格率', x: 18, y: 8, w: 6, h: 6, gridCols: 24, visible: true },
    { id: 'w-sec', type: 'section-stats', title: '工段设备分布', x: 6, y: 13, w: 12, h: 5, gridCols: 24, visible: false },
  ];
}

/** 兼容旧版 12 列大屏布局自动平滑升级至 24 列 */
export function normalizeWidgetsTo24Cols(widgets: DashboardWidgetConfig[]): DashboardWidgetConfig[] {
  const already24 = widgets.some((w) => w.gridCols === 24 || w.x + w.w > 12);
  if (already24) return widgets;
  return widgets.map((w) => ({
    ...w,
    x: w.x * 2,
    w: w.w * 2,
    y: Math.round(w.y * 1.5),
    h: Math.round(w.h * 1.5),
    gridCols: 24,
  }));
}
