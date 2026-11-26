import { del, get, keys, set } from 'idb-keyval';
import { create } from 'zustand';
import type { CardTemplateSchema, DashboardWidgetConfig } from '../domain/schema';

const TEMPLATE_PREFIX = 'plant-studio:card-tpl:';

export const BUILTIN_CARD_TEMPLATES: CardTemplateSchema[] = [
  {
    id: 'tpl-water-pump',
    name: '离心泵组工况监视卡',
    category: 'equipment',
    description: '适用于 WATER_PUMP，跟随设备实时测点显示启停状态、流量仪表盘与出口压力',
    bindCatalogKind: 'WATER_PUMP',
    defaultSize: { w: 6, h: 9 },
    isBuiltin: true,
    createdAt: 1700000000001,
    cardStyle: { blurPx: 14, borderRadius: 12 },
    elements: [
      {
        id: 'el-wp-1',
        type: 'text',
        name: '设备位号标题',
        layout: { colSpan: 8 },
        style: { fontSize: 13, fontWeight: 700, fontFamily: 'mono', color: '#38bdf8' },
        props: { text: 'P-201 输送泵组' },
        binding: { mode: 'device-slot', deviceSlot: { target: 'bound-node', prop: 'tag' } },
      },
      {
        id: 'el-wp-2',
        type: 'status-dot',
        name: '泵运行灯',
        layout: { colSpan: 4 },
        style: { color: '#22c55e', fontSize: 11 },
        props: { label: '', statusActiveText: '运行中', statusIdleText: '停机' },
        binding: { mode: 'device-slot', deviceSlot: { target: 'bound-node', prop: 'metric', metricIndex: 1 } },
      },
      {
        id: 'el-wp-3',
        type: 'chart-gauge',
        name: '工况流量表盘',
        layout: { colSpan: 6 },
        style: { heightPx: 138, color: '#38bdf8' },
        props: { label: '实时流量', min: 0, max: 200 },
        binding: {
          mode: 'device-slot',
          deviceSlot: { target: 'bound-node', prop: 'metric', metricIndex: 1 },
          format: { precision: 1, unit: 'm³/h' },
        },
      },
      {
        id: 'el-wp-4',
        type: 'kpi',
        name: '出口压力指标',
        layout: { colSpan: 6 },
        style: {
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'mono',
          color: '#f1f5f9',
          background: 'rgba(15,23,42,0.58)',
          borderRadius: 8,
          padding: 8,
        },
        props: { label: '出口压力', iconName: 'Gauge' },
        binding: {
          mode: 'device-slot',
          deviceSlot: { target: 'bound-node', prop: 'metric', metricIndex: 0 },
          format: { precision: 2, unit: 'kPa' },
          thresholds: [{ operator: '>', value: 4850, color: '#ef4444', blink: true }],
        },
      },
    ],
  },
  {
    id: 'tpl-tank-level',
    name: '工艺储罐液位监测卡',
    category: 'equipment',
    description: '适用于 TANK 储罐与反应罐，展示液位百分比进度条及压温指标',
    bindCatalogKind: 'TANK',
    defaultSize: { w: 6, h: 7 },
    isBuiltin: true,
    createdAt: 1700000000002,
    elements: [
      {
        id: 'el-tk-1',
        type: 'text',
        name: '储罐名称',
        layout: { colSpan: 12 },
        style: { fontSize: 13, fontWeight: 600, color: '#f1f5f9' },
        props: { text: '工艺储罐液位状态' },
        binding: { mode: 'device-slot', deviceSlot: { target: 'bound-node', prop: 'name' } },
      },
      {
        id: 'el-tk-2',
        type: 'progress',
        name: '液位占空比',
        layout: { colSpan: 12 },
        style: { color: '#0ea5e9', fontSize: 12, fontFamily: 'mono', background: 'rgba(15,23,42,0.52)', borderRadius: 8, padding: 8 },
        props: { label: '当前储液液位', min: 0, max: 100 },
        binding: {
          mode: 'point',
          dataSourceId: 'builtin-sim',
          pointKey: 'HG-UF-101.flowWork',
          format: { precision: 1, unit: '%', multiplier: 0.55 },
          thresholds: [{ operator: '>', value: 85, color: '#f59e0b' }],
        },
      },
      {
        id: 'el-tk-3',
        type: 'kpi',
        name: '罐内压力',
        layout: { colSpan: 6 },
        style: { fontSize: 15, fontWeight: 700, fontFamily: 'mono', color: '#38bdf8', background: 'rgba(15,23,42,0.52)', borderRadius: 8, padding: 6 },
        props: { label: '罐顶压力', iconName: 'Activity' },
        binding: { mode: 'device-slot', deviceSlot: { target: 'bound-node', prop: 'metric', metricIndex: 0 }, format: { precision: 2, unit: 'kPa' } },
      },
      {
        id: 'el-tk-4',
        type: 'kpi',
        name: '介质温度',
        layout: { colSpan: 6 },
        style: { fontSize: 15, fontWeight: 700, fontFamily: 'mono', color: '#f59e0b', background: 'rgba(15,23,42,0.52)', borderRadius: 8, padding: 6 },
        props: { label: '存储温度', iconName: 'Thermometer' },
        binding: { mode: 'point', dataSourceId: 'builtin-sim', pointKey: 'HG-UF-101.temperature', format: { precision: 2, unit: '℃' } },
      },
    ],
  },
  {
    id: 'tpl-hx-monitor',
    name: '板式换热器冷热温差卡',
    category: 'chart',
    description: '适用于 HEAT_EXCHANGER，集成分组柱状对比与温压曲线',
    bindCatalogKind: 'HEAT_EXCHANGER',
    defaultSize: { w: 7, h: 8 },
    isBuiltin: true,
    createdAt: 1700000000003,
    elements: [
      {
        id: 'el-hx-1',
        type: 'kpi',
        name: '热侧温度',
        layout: { colSpan: 6 },
        style: { fontSize: 16, fontWeight: 700, fontFamily: 'mono', color: '#f59e0b', background: 'rgba(15,23,42,0.52)', borderRadius: 8, padding: 6 },
        props: { label: '工艺介质温度', iconName: 'Thermometer' },
        binding: { mode: 'point', dataSourceId: 'builtin-sim', pointKey: 'HG-UF-101.temperature', format: { precision: 1, unit: '℃' } },
      },
      {
        id: 'el-hx-2',
        type: 'kpi',
        name: '冷侧流量',
        layout: { colSpan: 6 },
        style: { fontSize: 16, fontWeight: 700, fontFamily: 'mono', color: '#38bdf8', background: 'rgba(15,23,42,0.52)', borderRadius: 8, padding: 6 },
        props: { label: '冷却水流量', iconName: 'Droplets' },
        binding: { mode: 'point', dataSourceId: 'builtin-sim', pointKey: 'HG-UF-102.flowStd', format: { precision: 1, unit: 'm³/h' } },
      },
      {
        id: 'el-hx-3',
        type: 'chart-bar',
        name: '流量对比柱图',
        layout: { colSpan: 12 },
        style: { heightPx: 145 },
        props: {
          label: '热侧 / 冷侧流量负荷对比',
          seriesPointIds: ['HG-UF-101.flowWork', 'HG-UF-102.flowStd'],
          chartColors: ['#f59e0b', '#38bdf8'],
          showGrid: true,
        },
      },
    ],
  },
  {
    id: 'tpl-multi-trend',
    name: '多参数自定义实时趋势卡',
    category: 'chart',
    description: '通用高自由度双通道折线趋势 + KPI 组合卡片模板',
    defaultSize: { w: 7, h: 8 },
    isBuiltin: true,
    createdAt: 1700000000004,
    elements: [
      {
        id: 'el-tr-1',
        type: 'chart-line',
        name: '双通道趋势图',
        layout: { colSpan: 12 },
        style: { heightPx: 170 },
        props: {
          label: '压力 & 瞬时流量',
          seriesPointIds: ['HG-UF-101.pressure', 'HG-UF-101.flowWork'],
          chartColors: ['#38bdf8', '#34d399'],
          showGrid: true,
          areaFill: true,
        },
      },
    ],
  },
];

type CardTemplateState = {
  customTemplates: CardTemplateSchema[];
  hydrated: boolean;
  hydrateTemplates: () => Promise<void>;
  saveWidgetAsTemplate: (
    widget: DashboardWidgetConfig,
    meta: {
      name: string;
      category: CardTemplateSchema['category'];
      description?: string;
      bindCatalogKind?: CardTemplateSchema['bindCatalogKind'];
    },
  ) => Promise<CardTemplateSchema>;
  importTemplates: (list: CardTemplateSchema[]) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
};

export const useCardTemplateStore = create<CardTemplateState>((setState, getState) => ({
  customTemplates: [],
  hydrated: false,

  hydrateTemplates: async () => {
    try {
      const allKeys = await keys();
      const tplKeys = allKeys.filter(
        (k): k is string => typeof k === 'string' && k.startsWith(TEMPLATE_PREFIX),
      );
      const list: CardTemplateSchema[] = [];
      for (const k of tplKeys) {
        const tpl = await get<CardTemplateSchema>(k);
        if (tpl && tpl.id && Array.isArray(tpl.elements)) {
          list.push(tpl);
        }
      }
      list.sort((a, b) => b.createdAt - a.createdAt);
      setState({ customTemplates: list, hydrated: true });
    } catch {
      setState({ hydrated: true });
    }
  },

  saveWidgetAsTemplate: async (widget, meta) => {
    const id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // 剥离具体实例 ID 并深拷贝，形成可反复拖拽使用的独立模板
    const clonedElements = (JSON.parse(JSON.stringify(widget.elements ?? [])) as CardTemplateSchema['elements']).map(
      (el, idx) => ({
        ...el,
        id: `tpl-el-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      }),
    );
    const tpl: CardTemplateSchema = {
      id,
      name: meta.name.trim() || widget.title || '自定义组件模板',
      category: meta.category,
      description: meta.description,
      bindCatalogKind: meta.bindCatalogKind,
      defaultSize: { w: widget.w, h: widget.h },
      cardStyle: widget.cardStyle ? (JSON.parse(JSON.stringify(widget.cardStyle)) as CardTemplateSchema['cardStyle']) : undefined,
      elements: clonedElements,
      createdAt: Date.now(),
      isBuiltin: false,
    };
    await set(`${TEMPLATE_PREFIX}${tpl.id}`, tpl);
    setState({ customTemplates: [tpl, ...getState().customTemplates] });
    return tpl;
  },

  importTemplates: async (list) => {
    const valid = list.filter((t) => t && Array.isArray(t.elements));
    for (const raw of valid) {
      const id = raw.id.startsWith('tpl-') ? raw.id : `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const tpl: CardTemplateSchema = { ...raw, id, isBuiltin: false, createdAt: Date.now() };
      await set(`${TEMPLATE_PREFIX}${tpl.id}`, tpl);
    }
    await getState().hydrateTemplates();
  },

  deleteTemplate: async (id) => {
    await del(`${TEMPLATE_PREFIX}${id}`);
    setState({ customTemplates: getState().customTemplates.filter((t) => t.id !== id) });
  },
}));
