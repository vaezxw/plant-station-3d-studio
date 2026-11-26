import { memo, type FC } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import type {
  CardElementSchema,
  DashboardSceneBinding,
  SceneNode,
  ThresholdRule,
} from '../../domain/schema';
import { resolveThemeById } from '../../domain/themes';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { POINT_CATALOG, useTelemetryStore } from '../../store/useTelemetryStore';
import { EChartElement } from './EChartElement';
import { resolveDashboardIcon } from './iconRegistry';
import { usePreviewOverride, type PreviewOverrideContextValue } from './PreviewOverrideContext';

function matchThreshold(val: number | null, rules?: ThresholdRule[]): ThresholdRule | null {
  if (val === null || !rules || rules.length === 0) return null;
  for (const r of rules) {
    if (r.operator === '>' && val > r.value) return r;
    if (r.operator === '>=' && val >= r.value) return r;
    if (r.operator === '<' && val < r.value) return r;
    if (r.operator === '<=' && val <= r.value) return r;
    if (r.operator === '==' && val === r.value) return r;
    if (r.operator === '!=' && val !== r.value) return r;
  }
  return null;
}

function resolveElementDisplay(
  el: CardElementSchema,
  sceneBinding: DashboardSceneBinding | undefined,
  nodes: SceneNode[],
  selectedNodeId: string | null,
  override?: PreviewOverrideContextValue | null,
): {
  text: string;
  numValue: number | null;
  unit: string;
  pointLabel: string;
  alarmRule: ThresholdRule | null;
  boundNode?: SceneNode;
} {
  const storeValueMap = useTelemetryStore.getState().valueMap;
  const externalDefs = useTelemetryStore.getState().externalDefs;
  const binding = el.binding;

  const targetNodeId =
    binding?.deviceSlot?.target === 'selected-node' || sceneBinding?.followSelectedNode
      ? selectedNodeId
      : sceneBinding?.targetNodeId;
  const boundNode = override?.previewNode ?? (targetNodeId ? nodes.find((n) => n.id === targetNodeId) : undefined);

  if (!binding || binding.mode === 'static') {
    return {
      text: el.props.text ?? '',
      numValue: null,
      unit: binding?.format?.unit ?? '',
      pointLabel: el.props.label ?? el.name,
      alarmRule: null,
      boundNode,
    };
  }

  let resolvedKey = binding.pointKey;
  let customDefLabel: string | undefined;
  let customDefUnit: string | undefined;

  if (binding.mode === 'device-slot') {
    const slot = binding.deviceSlot;
    if (!boundNode) {
      return {
        text: '请选中 3D 设备',
        numValue: null,
        unit: '',
        pointLabel: el.props.label ?? el.name,
        alarmRule: null,
      };
    }
    if (slot?.prop === 'tag') {
      return { text: boundNode.tag, numValue: null, unit: '', pointLabel: boundNode.name, alarmRule: null, boundNode };
    }
    if (slot?.prop === 'name') {
      return { text: boundNode.name, numValue: null, unit: '', pointLabel: boundNode.section, alarmRule: null, boundNode };
    }
    if (slot?.prop === 'section') {
      return { text: boundNode.section, numValue: null, unit: '', pointLabel: boundNode.tag, alarmRule: null, boundNode };
    }

    const idx = slot?.metricIndex ?? 0;
    const allNodePoints: { key: string; label?: string; unit?: string }[] = [
      ...boundNode.pointIds.map((pid) => ({ key: pid })),
      ...(boundNode.customPoints ?? []),
    ];
    const hit = allNodePoints[idx];
    if (!hit) {
      return {
        text: binding.format?.fallback ?? '--',
        numValue: null,
        unit: binding.format?.unit ?? '',
        pointLabel: el.props.label ?? '未绑测点',
        alarmRule: null,
        boundNode,
      };
    }
    resolvedKey = hit.key;
    customDefLabel = hit.label;
    customDefUnit = hit.unit;
  }

  if (!resolvedKey) {
    return {
      text: binding.format?.fallback ?? '--',
      numValue: null,
      unit: binding.format?.unit ?? '',
      pointLabel: el.props.label ?? el.name,
      alarmRule: null,
      boundNode,
    };
  }

  const pv = override?.valueOverrides?.[resolvedKey] ?? storeValueMap[resolvedKey];
  const builtinDef = POINT_CATALOG.find((p) => p.id === resolvedKey) ?? override?.defOverrides?.[resolvedKey];
  const extDef = externalDefs[resolvedKey];

  const pointLabel = el.props.label || customDefLabel || builtinDef?.name || extDef?.name || resolvedKey;
  const unit = binding.format?.unit ?? customDefUnit ?? builtinDef?.unit ?? extDef?.unit ?? '';

  if (!pv || pv.value === null || pv.value === undefined) {
    return {
      text: binding.format?.fallback ?? '--',
      numValue: null,
      unit,
      pointLabel,
      alarmRule: pv?.quality === 'BAD' ? { operator: '!=', value: 0, color: '#ef4444', blink: true } : null,
      boundNode,
    };
  }

  const mult = binding.format?.multiplier ?? 1;
  const off = binding.format?.offset ?? 0;
  const prec = binding.format?.precision ?? 2;
  const numValue = Number((pv.value * mult + off).toFixed(prec));
  const alarmRule = matchThreshold(numValue, binding.thresholds);

  return {
    text: String(numValue),
    numValue,
    unit,
    pointLabel,
    alarmRule,
    boundNode,
  };
}

type ElementBodyProps = {
  element: CardElementSchema;
  sceneBinding?: DashboardSceneBinding;
};

const ElementBody: FC<ElementBodyProps> = memo(({ element, sceneBinding }) => {
  const nodes = useProjectStore((s) => s.project.nodes);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const themeId = useEditorStore((s) => s.themeId);
  const customThemes = useEditorStore((s) => s.customThemes);
  const isLightTheme = resolveThemeById(themeId, customThemes).mode === 'light';
  // 精准订阅遥测变化，驱动刷新
  useTelemetryStore((s) => s.tickCount);
  const valueMap = useTelemetryStore((s) => s.valueMap);
  const dispatchSceneAction = useEditorStore((s) => s.dispatchSceneAction);
  const previewOverride = usePreviewOverride();

  void valueMap;

  if (element.type === 'chart-line' || element.type === 'chart-bar' || element.type === 'chart-gauge') {
    return <EChartElement element={element} sceneBinding={sceneBinding} />;
  }

  const resolved = resolveElementDisplay(element, sceneBinding, nodes, selectedNodeId, previewOverride);
  const st = element.style;
  const adaptiveTextColor =
    st.color && !(isLightTheme && (st.color === '#f1f5f9' || st.color === '#f8fafc'))
      ? st.color
      : 'var(--text-primary)';
  const adaptiveBoxBg =
    st.background && !(isLightTheme && st.background.startsWith('rgba(15,23,42'))
      ? st.background
      : isLightTheme
        ? 'var(--bg-elevated)'
        : 'rgba(15,23,42,0.56)';
  const activeColor = resolved.alarmRule?.color ?? adaptiveTextColor;
  const blinkCls = resolved.alarmRule?.blink ? 'animate-pulse' : '';
  const fontClass = st.fontFamily === 'mono' ? 'font-mono' : 'font-sans';
  const alignClass =
    st.textAlign === 'center' ? 'text-center' : st.textAlign === 'right' ? 'text-right' : 'text-left';

  const handleAction = () => {
    if (element.onClickAction && element.onClickAction.type !== 'none') {
      dispatchSceneAction(element.onClickAction);
    } else if (resolved.boundNode) {
      dispatchSceneAction({ type: 'focus-node', nodeId: resolved.boundNode.id });
    }
  };

  if (element.type === 'divider') {
    return (
      <div className="w-full py-1 flex items-center gap-2">
        <div
          className="h-px flex-1"
          style={{ background: st.borderColor ?? 'rgba(56,189,248,0.28)' }}
        />
        {element.props.text ? (
          <span className="text-[10px] font-mono text-text-muted shrink-0">
            {element.props.text}
          </span>
        ) : null}
        <div
          className="h-px flex-1"
          style={{ background: st.borderColor ?? 'rgba(56,189,248,0.28)' }}
        />
      </div>
    );
  }

  if (element.type === 'icon') {
    const IconComp = resolveDashboardIcon(element.props.iconName);
    return (
      <div
        onClick={handleAction}
        className={`flex flex-col items-center justify-center gap-1 ${
          element.onClickAction && element.onClickAction.type !== 'none' ? 'cursor-pointer hover:opacity-90' : ''
        } ${blinkCls}`}
        style={{
          background: st.background ?? 'rgba(56,189,248,0.12)',
          borderRadius: `${st.borderRadius ?? 8}px`,
          padding: `${st.padding ?? 6}px`,
          border: st.borderColor ? `1px solid ${st.borderColor}` : '1px solid transparent',
        }}
      >
        <IconComp size={element.props.iconSize ?? 20} style={{ color: activeColor }} />
        {element.props.label ? (
          <span className="text-[10px] text-text-secondary truncate max-w-full">
            {element.props.label}
          </span>
        ) : null}
      </div>
    );
  }

  if (element.type === 'status-dot') {
    const isRunning = resolved.numValue !== null ? resolved.numValue > 0.01 : true;
    const dotColor = resolved.alarmRule?.color ?? (isRunning ? st.color ?? '#22c55e' : '#64748b');
    return (
      <div
        onClick={handleAction}
        className="flex items-center justify-between gap-2"
        style={{
          background: adaptiveBoxBg,
          borderRadius: `${st.borderRadius ?? 8}px`,
          padding: `${st.padding ?? 6}px`,
          border: st.borderColor ? `1px solid ${st.borderColor}` : '1px solid var(--border-subtle)',
        }}
      >
        {element.props.label ? (
          <span className="text-[11px] text-text-secondary truncate">{element.props.label}</span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium shrink-0" style={{ color: dotColor }}>
          <span
            className={`w-2 h-2 rounded-full ${isRunning ? 'animate-pulse' : ''}`}
            style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
          />
          {isRunning ? (element.props.statusActiveText ?? '运行') : (element.props.statusIdleText ?? '停止')}
        </span>
      </div>
    );
  }

  if (element.type === 'progress') {
    const min = element.props.min ?? 0;
    const max = element.props.max ?? 100;
    const pct =
      resolved.numValue !== null
        ? Math.max(0, Math.min(100, ((resolved.numValue - min) / Math.max(1e-4, max - min)) * 100))
        : 0;
    return (
      <div
        onClick={handleAction}
        className="space-y-1.5"
        style={{
          background: adaptiveBoxBg,
          borderRadius: `${st.borderRadius ?? 8}px`,
          padding: `${st.padding ?? 6}px`,
          border: st.borderColor ? `1px solid ${st.borderColor}` : '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-secondary truncate">{resolved.pointLabel}</span>
          <span className={`font-mono font-bold ${blinkCls}`} style={{ color: activeColor }}>
            {resolved.text} {resolved.unit}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-bg-canvas/80 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: activeColor }}
          />
        </div>
      </div>
    );
  }

  if (element.type === 'kpi') {
    const IconComp = element.props.iconName ? resolveDashboardIcon(element.props.iconName) : null;
    return (
      <div
        onClick={handleAction}
        className={`flex flex-col justify-between ${
          element.onClickAction?.type !== 'none' && element.onClickAction ? 'cursor-pointer hover:border-border-strong' : ''
        }`}
        style={{
          background: adaptiveBoxBg,
          border: `1px solid ${resolved.alarmRule ? resolved.alarmRule.color : st.borderColor ?? 'var(--border-subtle)'}`,
          borderRadius: `${st.borderRadius ?? 8}px`,
          padding: `${st.padding ?? 8}px`,
        }}
      >
        <div className="text-[11px] text-text-muted flex items-center gap-1 truncate">
          {IconComp ? <IconComp className="w-3 h-3 shrink-0" style={{ color: activeColor }} /> : null}
          <span className="truncate">{resolved.pointLabel}</span>
        </div>
        <div
          className={`${fontClass} ${alignClass} mt-0.5 leading-tight truncate ${blinkCls}`}
          style={{
            fontSize: `${st.fontSize ?? 18}px`,
            fontWeight: st.fontWeight ?? 700,
            color: activeColor,
          }}
        >
          {resolved.text}
          {resolved.unit ? (
            <span className="text-[10px] font-normal text-text-muted ml-1">{resolved.unit}</span>
          ) : null}
        </div>
      </div>
    );
  }

  // text 文本框
  return (
    <div
      onClick={handleAction}
      className={`${fontClass} ${alignClass} ${blinkCls} leading-snug break-words ${
        element.onClickAction && element.onClickAction.type !== 'none' ? 'cursor-pointer hover:opacity-90' : ''
      }`}
      style={{
        fontSize: `${st.fontSize ?? 13}px`,
        fontWeight: st.fontWeight ?? 600,
        color: activeColor,
        background: st.background,
        border: st.borderColor ? `1px solid ${st.borderColor}` : undefined,
        borderRadius: st.borderRadius ? `${st.borderRadius}px` : undefined,
        padding: st.padding !== undefined ? `${st.padding}px` : undefined,
      }}
    >
      {resolved.text}
      {resolved.unit ? <span className="text-[11px] text-text-muted ml-1">{resolved.unit}</span> : null}
    </div>
  );
});

const COL_SPAN_CLASS: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
};

type SortableItemProps = {
  widgetId: string;
  element: CardElementSchema;
  sceneBinding?: DashboardSceneBinding;
  isEditing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

export const SortableElementItem: FC<SortableItemProps> = ({
  element,
  sceneBinding,
  isEditing,
  isSelected,
  onSelect,
  onRemove,
}) => {
  const previewOverride = usePreviewOverride();
  const isPreviewHighlight = previewOverride?.highlightElementId === element.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.id,
    disabled: !isEditing,
  });

  const spanCls = COL_SPAN_CLASS[Math.max(1, Math.min(12, Math.round(element.layout.colSpan)))] ?? 'col-span-12';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      onClick={(e) => {
        if (previewOverride?.onPreviewSelectElement) {
          e.stopPropagation();
          previewOverride.onPreviewSelectElement(element.id);
          return;
        }
        if (!isEditing) return;
        e.stopPropagation();
        onSelect();
      }}
      className={`${spanCls} relative group rounded-lg transition ${
        isPreviewHighlight
          ? 'self-start ring-2 ring-cyan-400 bg-cyan-400/10 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
          : isEditing
            ? isSelected
              ? 'ring-1 ring-accent bg-accent/5'
              : 'hover:ring-1 hover:ring-border-strong/70'
            : previewOverride?.onPreviewSelectElement
              ? 'self-start cursor-pointer hover:ring-1 hover:ring-cyan-400/50'
              : ''
      }`}
    >
      {isEditing ? (
        <div
          className={`absolute -top-2 right-1 z-20 flex items-center gap-0.5 rounded bg-bg-elevated border border-border-subtle px-1 py-0.5 shadow-md transition ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-0.5 text-text-muted hover:text-accent cursor-grab active:cursor-grabbing"
            title="拖动调整元素排序"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-0.5 text-text-muted hover:text-red-400"
            title="移除此元素"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ) : null}

      <ElementBody element={element} sceneBinding={sceneBinding} />
    </div>
  );
};
