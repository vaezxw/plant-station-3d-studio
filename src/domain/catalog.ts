import type { NodeKind } from '../data/topology';

export type StudioCategoryId =
  | 'gas-transport'
  | 'gas-meter'
  | 'manufacturing'
  | 'alarm-safety'
  | 'water'
  | 'energy'
  | 'pipe-infra';

export type CatalogKind =
  | NodeKind
  | 'PIPE'
  | 'PIPE_ELBOW'
  | 'FLANGE'
  | 'INSTR'
  | 'TANK'
  | 'ELEC_CB'
  | 'ELEC_M'
  | 'ELEC_GND'
  | 'TEXT'
  | 'LINE_SOLID'
  | 'LINE_DASHED'
  | 'PCS'
  | 'TRANSFORMER'
  | 'BESS'
  | 'LOAD'
  | 'DIST_ROOM'
  | 'TURBOJET'
  | 'HENG_GUANG_SKID'
  // 燃气表、燃气表制作工艺、报警监控、水务、基建扩展
  | 'METER_MEMBRANE'
  | 'METER_ROOTS'
  | 'CALIBRATION_RIG'
  | 'CONVEYOR_LINE'
  | 'LEAK_TEST_BENCH'
  | 'ROBOT_STATION'
  | 'LASER_MARKER'
  | 'GAS_DETECTOR'
  | 'ALARM_TOWER'
  | 'EXPLOSION_PANEL'
  | 'WATER_PUMP'
  | 'DOSING_TANK'
  | 'MAG_METER'
  | 'BASE_PAD'
  | 'PLATFORM_RAIL';

export type PortSpec = {
  id: string;
  localPos: [number, number, number];
  normal: [number, number, number];
};

export type StudioCatalogItem = {
  kind: CatalogKind;
  category: StudioCategoryId;
  labelZh: string;
  description: string;
  tagPrefix: string;
  defaultSection: string;
  defaultColor: string;
  placeY: number;
  accentBg: string;
  glyph: string;
  ports?: PortSpec[];
};

export const STUDIO_CATEGORIES: readonly { id: StudioCategoryId; labelZh: string }[] = [
  { id: 'gas-transport', labelZh: '燃气输配' },
  { id: 'gas-meter', labelZh: '燃气表与标定' },
  { id: 'manufacturing', labelZh: '燃气表工艺线' },
  { id: 'alarm-safety', labelZh: '报警监控' },
  { id: 'water', labelZh: '水务工艺' },
  { id: 'energy', labelZh: '能源与特种' },
  { id: 'pipe-infra', labelZh: '管件与基建' },
];

export const STUDIO_CATALOG: readonly StudioCatalogItem[] = [
  // 1. 燃气输配与调压
  {
    kind: 'HENG_GUANG_SKID',
    category: 'gas-transport',
    labelZh: '调压计量撬',
    description: '双路燃气过滤调压计量整装撬块',
    tagPrefix: 'SKID',
    defaultSection: '调压计量区',
    defaultColor: '#38bdf8',
    placeY: 0,
    accentBg: '#0284c7',
    glyph: '撬',
  },
  {
    kind: 'FS',
    category: 'gas-transport',
    labelZh: '旋风分离过滤器',
    description: '立式燃气除尘除液分离过滤器',
    tagPrefix: 'FS',
    defaultSection: '过滤分离区',
    defaultColor: '#94a3b8',
    placeY: 0.35,
    accentBg: '#475569',
    glyph: 'FS',
    ports: [
      { id: 'in', localPos: [-0.32, 0.05, 0], normal: [-1, 0, 0] },
      { id: 'out', localPos: [0.32, 0.05, 0], normal: [1, 0, 0] },
    ],
  },
  {
    kind: 'TANK',
    category: 'gas-transport',
    labelZh: '缓冲储罐',
    description: '立式稳压缓冲储气罐',
    tagPrefix: 'TK',
    defaultSection: '稳压储气区',
    defaultColor: '#64748b',
    placeY: 0,
    accentBg: '#475569',
    glyph: 'TK',
  },
  {
    kind: 'HOV',
    category: 'gas-transport',
    labelZh: '手动球阀',
    description: 'DN100 法兰式手动截断球阀',
    tagPrefix: 'HOV',
    defaultSection: '工艺管网',
    defaultColor: '#eab308',
    placeY: 0.4,
    accentBg: '#ca8a04',
    glyph: 'HV',
  },
  {
    kind: 'MOV',
    category: 'gas-transport',
    labelZh: '电动调节阀',
    description: '带智能电动执行器工艺调节阀',
    tagPrefix: 'MOV',
    defaultSection: '工艺管网',
    defaultColor: '#f59e0b',
    placeY: 0.4,
    accentBg: '#d97706',
    glyph: 'MV',
  },
  {
    kind: 'SSV',
    category: 'gas-transport',
    labelZh: '安全切断阀',
    description: '超压紧急联锁安全切断阀 (SSV)',
    tagPrefix: 'SSV',
    defaultSection: '安全保护区',
    defaultColor: '#ef4444',
    placeY: 0.4,
    accentBg: '#dc2626',
    glyph: 'SSV',
  },
  {
    kind: 'PCV',
    category: 'gas-transport',
    labelZh: '先导调压阀',
    description: '自力式先导膜片燃气调压器',
    tagPrefix: 'PCV',
    defaultSection: '调压区',
    defaultColor: '#22d3ee',
    placeY: 0.4,
    accentBg: '#0891b2',
    glyph: 'PCV',
  },
  {
    kind: 'PV',
    category: 'gas-transport',
    labelZh: '安全放散阀',
    description: '弹簧式超压放散安全阀',
    tagPrefix: 'PV',
    defaultSection: '安全保护区',
    defaultColor: '#f87171',
    placeY: 0.4,
    accentBg: '#b91c1c',
    glyph: 'PV',
  },

  // 2. 燃气表与标定
  {
    kind: 'METER_MEMBRANE',
    category: 'gas-meter',
    labelZh: '膜式燃气表',
    description: '工商业 G16/G25 智能膜式燃气表',
    tagPrefix: 'GM',
    defaultSection: '燃气计量区',
    defaultColor: '#cbd5e1',
    placeY: 0,
    accentBg: '#0ea5e9',
    glyph: '膜表',
  },
  {
    kind: 'METER_ROOTS',
    category: 'gas-meter',
    labelZh: '罗茨燃气表',
    description: '高精度腰轮罗茨流量计（带温压补偿）',
    tagPrefix: 'RM',
    defaultSection: '燃气计量区',
    defaultColor: '#38bdf8',
    placeY: 0,
    accentBg: '#0369a1',
    glyph: '罗茨',
  },
  {
    kind: 'UF',
    category: 'gas-meter',
    labelZh: '超声波燃气表',
    description: '双声道高精度超声波燃气流量计',
    tagPrefix: 'UF',
    defaultSection: '燃气计量区',
    defaultColor: '#0ea5e9',
    placeY: 0,
    accentBg: '#0284c7',
    glyph: 'UF',
  },
  {
    kind: 'CALIBRATION_RIG',
    category: 'gas-meter',
    labelZh: '音速喷嘴标定台',
    description: '燃气表多表位音速喷嘴自动校验装置',
    tagPrefix: 'CAL',
    defaultSection: '计量检定区',
    defaultColor: '#38bdf8',
    placeY: 0,
    accentBg: '#0369a1',
    glyph: '标定',
  },
  {
    kind: 'INSTR',
    category: 'gas-meter',
    labelZh: '温压变送器',
    description: '就地数字显示压力/温度变送仪表',
    tagPrefix: 'PT',
    defaultSection: '监测仪表',
    defaultColor: '#a78bfa',
    placeY: 0.45,
    accentBg: '#7c3aed',
    glyph: 'PI',
  },

  // 3. 燃气表制作工艺产线
  {
    kind: 'CONVEYOR_LINE',
    category: 'manufacturing',
    labelZh: '滚筒装配线',
    description: '燃气表自动化装配倍速链/滚筒输送线',
    tagPrefix: 'LINE',
    defaultSection: '总装车间',
    defaultColor: '#64748b',
    placeY: 0,
    accentBg: '#334155',
    glyph: '输送',
  },
  {
    kind: 'ROBOT_STATION',
    category: 'manufacturing',
    labelZh: '自动装配机械臂',
    description: '表壳合盖与自动锁螺丝六轴工位',
    tagPrefix: 'ROB',
    defaultSection: '总装车间',
    defaultColor: '#f59e0b',
    placeY: 0,
    accentBg: '#d97706',
    glyph: '机械臂',
  },
  {
    kind: 'LEAK_TEST_BENCH',
    category: 'manufacturing',
    labelZh: '气密性检漏台',
    description: '燃气表整机差压/氦质谱气密性检测台',
    tagPrefix: 'LEAK',
    defaultSection: '质检工序',
    defaultColor: '#22d3ee',
    placeY: 0,
    accentBg: '#0891b2',
    glyph: '检漏',
  },
  {
    kind: 'LASER_MARKER',
    category: 'manufacturing',
    labelZh: '激光打标工位',
    description: '表体条码与铭牌激光打标视觉检测台',
    tagPrefix: 'LSR',
    defaultSection: '包装追溯区',
    defaultColor: '#818cf8',
    placeY: 0,
    accentBg: '#4f46e5',
    glyph: '打标',
  },

  // 4. 报警监控与安防
  {
    kind: 'GAS_DETECTOR',
    category: 'alarm-safety',
    labelZh: '可燃气体探测器',
    description: '防爆催化燃烧/激光甲烷泄漏报警探头',
    tagPrefix: 'GD',
    defaultSection: '安防监控区',
    defaultColor: '#f97316',
    placeY: 0,
    accentBg: '#ea580c',
    glyph: 'GD',
  },
  {
    kind: 'ALARM_TOWER',
    category: 'alarm-safety',
    labelZh: '声光报警灯柱',
    description: '防爆区域三色声光报警警示柱',
    tagPrefix: 'ALM',
    defaultSection: '安防监控区',
    defaultColor: '#ef4444',
    placeY: 0,
    accentBg: '#dc2626',
    glyph: '报警',
  },
  {
    kind: 'EXPLOSION_PANEL',
    category: 'alarm-safety',
    labelZh: '防爆报警控制箱',
    description: '气体报警联动紧急切断 PLC 控制箱',
    tagPrefix: 'FCP',
    defaultSection: '安防监控区',
    defaultColor: '#475569',
    placeY: 0,
    accentBg: '#334155',
    glyph: '防爆箱',
  },

  // 5. 水务工艺
  {
    kind: 'WATER_PUMP',
    category: 'water',
    labelZh: '变频离心泵组',
    description: '卧式变频恒压供水/循环离心泵撬',
    tagPrefix: 'PUMP',
    defaultSection: '水务泵房',
    defaultColor: '#0ea5e9',
    placeY: 0,
    accentBg: '#0284c7',
    glyph: '水泵',
  },
  {
    kind: 'DOSING_TANK',
    category: 'water',
    labelZh: '加药反应罐',
    description: '带顶部搅拌机与液位计的 PE/不锈钢加药罐',
    tagPrefix: 'DOS',
    defaultSection: '水处理区',
    defaultColor: '#10b981',
    placeY: 0,
    accentBg: '#059669',
    glyph: '加药',
  },
  {
    kind: 'MAG_METER',
    category: 'water',
    labelZh: '电磁流量计',
    description: '工业给排水管道衬胶电磁流量计',
    tagPrefix: 'FE',
    defaultSection: '水务管网',
    defaultColor: '#06b6d4',
    placeY: 0,
    accentBg: '#0891b2',
    glyph: 'FE',
  },

  // 6. 能源与特种装备
  {
    kind: 'PCS',
    category: 'energy',
    labelZh: 'PCS 变流器',
    description: '户外储能双向变流器柜',
    tagPrefix: 'PCS',
    defaultSection: '能源站区',
    defaultColor: '#38bdf8',
    placeY: 0,
    accentBg: '#0284c7',
    glyph: 'PCS',
  },
  {
    kind: 'BESS',
    category: 'energy',
    labelZh: '液冷储能柜',
    description: '工业园区磷酸铁锂液冷储能电池柜',
    tagPrefix: 'BESS',
    defaultSection: '能源站区',
    defaultColor: '#64748b',
    placeY: 0,
    accentBg: '#475569',
    glyph: '储能',
  },
  {
    kind: 'TRANSFORMER',
    category: 'energy',
    labelZh: '配电变压器',
    description: '10kV 油浸式/干式电力变压器',
    tagPrefix: 'TR',
    defaultSection: '配电区',
    defaultColor: '#4ade80',
    placeY: 0,
    accentBg: '#16a34a',
    glyph: '变',
  },
  {
    kind: 'DIST_ROOM',
    category: 'energy',
    labelZh: '配电房',
    description: '预制舱式高压配电室',
    tagPrefix: 'ROOM',
    defaultSection: '配电区',
    defaultColor: '#94a3b8',
    placeY: 0,
    accentBg: '#475569',
    glyph: '配电',
  },
  {
    kind: 'TURBOJET',
    category: 'energy',
    labelZh: '涡喷透平（演示）',
    description: '支持旋转/爆炸视图/剖切的精密轴流总成',
    tagPrefix: 'TJ',
    defaultSection: '特种设备区',
    defaultColor: '#b45309',
    placeY: 0.6,
    accentBg: '#b45309',
    glyph: 'TJ',
  },

  // 7. 管件与厂区基建
  {
    kind: 'PIPE',
    category: 'pipe-infra',
    labelZh: '标准直管段',
    description: '1 米 DN100 法兰连接直管段',
    tagPrefix: 'PIPE',
    defaultSection: '管廊管网',
    defaultColor: '#eab308',
    placeY: 0.4,
    accentBg: '#ca8a04',
    glyph: '──',
  },
  {
    kind: 'PIPE_ELBOW',
    category: 'pipe-infra',
    labelZh: '90° 弯头',
    description: 'DN100 法兰 90° 转角弯管',
    tagPrefix: 'ELB',
    defaultSection: '管廊管网',
    defaultColor: '#ca8a04',
    placeY: 0.4,
    accentBg: '#a16207',
    glyph: '⌞',
  },
  {
    kind: 'FLANGE',
    category: 'pipe-infra',
    labelZh: '法兰盘组件',
    description: 'PN16 带颈对焊法兰',
    tagPrefix: 'FLG',
    defaultSection: '管廊管网',
    defaultColor: '#cbd5e1',
    placeY: 0.4,
    accentBg: '#64748b',
    glyph: '◎',
  },
  {
    kind: 'BASE_PAD',
    category: 'pipe-infra',
    labelZh: '混凝土基座',
    description: '带黄黑安全警示边条的设备基础台',
    tagPrefix: 'PAD',
    defaultSection: '土建基建',
    defaultColor: '#64748b',
    placeY: 0,
    accentBg: '#475569',
    glyph: '基座',
  },
  {
    kind: 'PLATFORM_RAIL',
    category: 'pipe-infra',
    labelZh: '检修平台护栏',
    description: '防滑花纹钢格栅检修平台与黄漆安全栏杆',
    tagPrefix: 'PLT',
    defaultSection: '土建基建',
    defaultColor: '#eab308',
    placeY: 0,
    accentBg: '#ca8a04',
    glyph: '平台',
  },
  {
    kind: 'TEXT',
    category: 'pipe-infra',
    labelZh: '3D 工艺标牌',
    description: '厂站区位与工段铭牌标识',
    tagPrefix: 'LBL',
    defaultSection: '标识系统',
    defaultColor: '#0ea5e9',
    placeY: 0.25,
    accentBg: '#0284c7',
    glyph: 'Aa',
  },
] as const;

export function getCatalogItem(kind: string): StudioCatalogItem | undefined {
  return STUDIO_CATALOG.find((item) => item.kind === kind);
}
