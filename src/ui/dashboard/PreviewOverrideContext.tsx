import { createContext, useContext, type FC, type ReactNode } from 'react';
import type { PointDef, PointValue } from '../../data/points';
import type { SceneNode } from '../../domain/schema';
import type { PointSample } from '../../store/useTelemetryStore';

export type PreviewOverrideContextValue = {
  /** 在脱离具体工程时用于解析 device-slot 的样本 3D 设备节点 */
  previewNode?: SceneNode;
  /** 覆盖测点实时值（用于工况/告警试跑） */
  valueOverrides?: Record<string, PointValue>;
  /** 覆盖测点历史曲线（用于详情折线图预览） */
  historyOverrides?: Record<string, PointSample[]>;
  /** 覆盖测点元数据（单位/名称兜底） */
  defOverrides?: Record<string, Pick<PointDef, 'id' | 'name' | 'unit'>>;
  /** 当前在检查器中高亮定位的元素 ID */
  highlightElementId?: string | null;
  /** 在预览态点击卡片原子元素时同步回调检查器 */
  onPreviewSelectElement?: (elementId: string) => void;
};

const PreviewOverrideContext = createContext<PreviewOverrideContextValue | null>(null);

export const PreviewOverrideProvider: FC<{
  value: PreviewOverrideContextValue;
  children: ReactNode;
}> = ({ value, children }) => (
  <PreviewOverrideContext.Provider value={value}>{children}</PreviewOverrideContext.Provider>
);

export function usePreviewOverride(): PreviewOverrideContextValue | null {
  return useContext(PreviewOverrideContext);
}
