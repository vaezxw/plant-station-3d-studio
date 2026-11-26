import {
  Activity,
  AlertTriangle,
  BarChart3,
  Box,
  CheckCircle2,
  Cpu,
  Droplets,
  Factory,
  Flame,
  Gauge,
  Radio,
  ShieldCheck,
  Sliders,
  Thermometer,
  Wind,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const DASHBOARD_ICON_MAP: Record<string, { label: string; icon: LucideIcon }> = {
  Gauge: { label: '压力仪表', icon: Gauge },
  Activity: { label: '动态波形', icon: Activity },
  Thermometer: { label: '温度计', icon: Thermometer },
  Droplets: { label: '流体/水务', icon: Droplets },
  Flame: { label: '燃气/热力', icon: Flame },
  Zap: { label: '电力/能耗', icon: Zap },
  Wind: { label: '气体/吹扫', icon: Wind },
  Cpu: { label: '控制设备', icon: Cpu },
  Factory: { label: '厂站车间', icon: Factory },
  Workflow: { label: '工艺流程', icon: Workflow },
  BarChart3: { label: '统计图表', icon: BarChart3 },
  AlertTriangle: { label: '告警提示', icon: AlertTriangle },
  ShieldCheck: { label: '安全联锁', icon: ShieldCheck },
  CheckCircle2: { label: '合格/就绪', icon: CheckCircle2 },
  Radio: { label: '远程信号', icon: Radio },
  Sliders: { label: '调节阀', icon: Sliders },
  Wrench: { label: '检修维护', icon: Wrench },
  Box: { label: '通用设备', icon: Box },
};

export function resolveDashboardIcon(name?: string): LucideIcon {
  if (name && DASHBOARD_ICON_MAP[name]) {
    return DASHBOARD_ICON_MAP[name].icon;
  }
  return Gauge;
}
