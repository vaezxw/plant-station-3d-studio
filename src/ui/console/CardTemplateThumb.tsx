import { memo, useMemo, type FC } from 'react';
import { getCatalogItem } from '../../domain/catalog';
import type { CardElementSchema, CardTemplateSchema } from '../../domain/schema';
import { resolveDashboardIcon } from '../dashboard/iconRegistry';
import { buildPreviewSampleNode, resolveTemplateElementPointKey } from './templatePreviewSample';

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

const SAMPLE_VALUES: Record<string, { val: string; unit: string }> = {
  'HG-UF-101.pressure': { val: '4620.5', unit: 'kPa' },
  'HG-UF-101.flowWork': { val: '126.4', unit: 'm³/h' },
  'HG-UF-101.temperature': { val: '24.8', unit: '℃' },
};

function resolveStaticSample(el: CardElementSchema, template: CardTemplateSchema) {
  const sampleNode = buildPreviewSampleNode(template);
  const binding = el.binding;
  if (!binding || binding.mode === 'static') {
    return {
      label: el.props.label ?? el.name,
      text: el.props.text ?? el.name,
      unit: binding?.format?.unit ?? '',
      pct: 64,
    };
  }
  if (binding.mode === 'device-slot') {
    const prop = binding.deviceSlot?.prop;
    if (prop === 'tag') return { label: sampleNode.name, text: sampleNode.tag, unit: '', pct: 64 };
    if (prop === 'name') return { label: sampleNode.section, text: sampleNode.name, unit: '', pct: 64 };
    if (prop === 'section') return { label: sampleNode.tag, text: sampleNode.section, unit: '', pct: 64 };
  }
  const pid = resolveTemplateElementPointKey(el, sampleNode);
  const hit = pid ? SAMPLE_VALUES[pid] : undefined;
  const rawNum = hit ? Number(hit.val) : 72.5;
  const mult = binding.format?.multiplier ?? 1;
  const off = binding.format?.offset ?? 0;
  const prec = binding.format?.precision ?? 1;
  const computed = (rawNum * mult + off).toFixed(prec);
  const min = el.props.min ?? 0;
  const max = el.props.max ?? 100;
  const pct = Math.max(8, Math.min(95, ((Number(computed) - min) / Math.max(1e-3, max - min)) * 100));
  return {
    label: el.props.label ?? el.name,
    text: computed,
    unit: binding.format?.unit ?? hit?.unit ?? '',
    pct,
  };
}

const StaticMiniElement: FC<{ element: CardElementSchema; template: CardTemplateSchema }> = memo(
  ({ element, template }) => {
    const st = element.style;
    const color = st.color ?? '#38bdf8';
    const sample = resolveStaticSample(element, template);

    if (element.type === 'divider') {
      return (
        <div className="w-full py-0.5 flex items-center gap-1.5">
          <div className="h-px flex-1 bg-sky-400/25" />
          {element.props.text ? (
            <span className="text-[8px] font-mono text-slate-400 shrink-0">{element.props.text}</span>
          ) : null}
          <div className="h-px flex-1 bg-sky-400/25" />
        </div>
      );
    }

    if (element.type === 'icon') {
      const IconComp = resolveDashboardIcon(element.props.iconName);
      return (
        <div
          className="flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 rounded border border-slate-700/60"
          style={{ background: st.background ?? 'rgba(56,189,248,0.12)' }}
        >
          <IconComp className="w-3.5 h-3.5" style={{ color }} />
          {element.props.label ? (
            <span className="text-[8px] text-slate-300 truncate max-w-full">{element.props.label}</span>
          ) : null}
        </div>
      );
    }

    if (element.type === 'status-dot') {
      return (
        <div
          className="flex items-center justify-between gap-1 px-2 py-1 rounded-md border border-slate-700/60"
          style={{ background: st.background ?? 'rgba(15,23,42,0.55)' }}
        >
          {element.props.label ? (
            <span className="text-[8px] text-slate-300 truncate">{element.props.label}</span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-[8px] font-medium shrink-0" style={{ color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            {element.props.statusActiveText ?? '运行'}
          </span>
        </div>
      );
    }

    if (element.type === 'progress') {
      return (
        <div
          className="px-2 py-1.5 rounded-md border border-slate-700/60 space-y-1"
          style={{ background: st.background ?? 'rgba(15,23,42,0.55)' }}
        >
          <div className="flex items-center justify-between text-[8px]">
            <span className="text-slate-300 truncate">{sample.label}</span>
            <span className="font-mono font-bold" style={{ color }}>
              {sample.text} {sample.unit}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-950/90 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${sample.pct}%`, background: color }} />
          </div>
        </div>
      );
    }

    if (element.type === 'chart-gauge') {
      const accent = element.style.color || element.props.chartColors?.[0] || '#38bdf8';
      return (
        <div className="h-[72px] rounded-md bg-slate-950/55 border border-slate-800/80 flex flex-col items-center justify-center p-1 relative overflow-hidden">
          <svg viewBox="0 0 100 62" className="w-20 h-12 overflow-visible">
            <path
              d="M 14 50 A 38 38 0 1 1 86 50"
              fill="none"
              stroke="rgba(148,163,184,0.2)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M 14 50 A 38 38 0 0 1 73 20"
              fill="none"
              stroke={accent}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx="50" cy="46" r="2.5" fill="#f8fafc" />
            <line x1="50" y1="46" x2="70" y2="24" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="text-[9px] font-mono font-bold text-slate-100 -mt-1">
            {sample.text} <span className="text-[7px] text-slate-400">{sample.unit}</span>
          </div>
          {element.props.label ? (
            <div className="text-[7px] text-slate-400 truncate max-w-full">{element.props.label}</div>
          ) : null}
        </div>
      );
    }

    if (element.type === 'chart-bar') {
      const palette = element.props.chartColors?.length
        ? element.props.chartColors
        : ['#38bdf8', '#f59e0b', '#34d399', '#a78bfa'];
      const heights = [62, 86, 48, 72];
      return (
        <div className="h-[74px] rounded-md bg-slate-950/55 border border-slate-800/80 p-1.5 flex flex-col justify-between">
          {element.props.label ? (
            <div className="text-[8px] text-slate-300 truncate">{element.props.label}</div>
          ) : null}
          <div className="flex-1 flex items-end justify-around gap-2 px-2 pt-1 border-b border-slate-700/40">
            {heights.map((h, i) => (
              <div
                key={i}
                className="w-3 rounded-t"
                style={{ height: `${h}%`, background: palette[i % palette.length] }}
              />
            ))}
          </div>
        </div>
      );
    }

    if (element.type === 'chart-line') {
      const c1 = element.props.chartColors?.[0] ?? '#38bdf8';
      const c2 = element.props.chartColors?.[1] ?? '#34d399';
      return (
        <div className="h-[76px] rounded-md bg-slate-950/55 border border-slate-800/80 p-1.5 flex flex-col justify-between">
          {element.props.label ? (
            <div className="text-[8px] text-slate-300 truncate">{element.props.label}</div>
          ) : null}
          <svg viewBox="0 0 180 48" className="w-full flex-1" preserveAspectRatio="none">
            <path
              d="M0 36 L25 30 L50 32 L78 18 L108 24 L138 14 L165 19 L180 12 L180 48 L0 48 Z"
              fill={`${c1}26`}
            />
            <path
              d="M0 36 L25 30 L50 32 L78 18 L108 24 L138 14 L165 19 L180 12"
              fill="none"
              stroke={c1}
              strokeWidth="2"
            />
            <path
              d="M0 40 L30 38 L62 31 L95 34 L125 26 L154 28 L180 22"
              fill="none"
              stroke={c2}
              strokeWidth="1.6"
              strokeDasharray="3 2"
            />
          </svg>
        </div>
      );
    }

    if (element.type === 'kpi') {
      const IconComp = element.props.iconName ? resolveDashboardIcon(element.props.iconName) : null;
      return (
        <div
          className="px-2 py-1.5 rounded-md border border-slate-700/60"
          style={{
            background: st.background ?? 'rgba(15,23,42,0.58)',
            borderColor: st.borderColor ?? 'rgba(148,163,184,0.2)',
          }}
        >
          <div className="text-[8px] text-slate-400 flex items-center gap-1 truncate">
            {IconComp ? <IconComp className="w-2.5 h-2.5 shrink-0" style={{ color }} /> : null}
            <span className="truncate">{sample.label}</span>
          </div>
          <div className="font-mono font-bold text-xs mt-0.5 truncate" style={{ color }}>
            {sample.text}
            {sample.unit ? <span className="text-[8px] font-normal text-slate-400 ml-0.5">{sample.unit}</span> : null}
          </div>
        </div>
      );
    }

    // text
    return (
      <div
        className="font-semibold text-[10px] leading-snug truncate"
        style={{
          color: st.color ?? '#f1f5f9',
          fontFamily: st.fontFamily === 'mono' ? 'monospace' : undefined,
        }}
      >
        {sample.text}
      </div>
    );
  },
);

/**
 * 列表页用纯静态轻量化缩略渲染舞台（零 ECharts 实例与 store 订阅，海量模板滚动零卡顿）
 */
export const CardTemplateThumb: FC<{ template: CardTemplateSchema }> = memo(({ template }) => {
  const catalogItem = useMemo(
    () => (template.bindCatalogKind ? getCatalogItem(template.bindCatalogKind) : undefined),
    [template.bindCatalogKind],
  );
  const cs = template.cardStyle;

  return (
    <div className="relative h-44 rounded-xl overflow-hidden bg-[#060b16] border border-slate-800/90 p-2.5 flex items-center justify-center">
      {/* 暗底工控网格纹 */}
      <div
        className="absolute inset-0 opacity-35 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(rgba(56,189,248,0.22) 1px, transparent 1px), linear-gradient(135deg, rgba(14,165,233,0.08), transparent 60%)',
          backgroundSize: '14px 14px, 100% 100%',
        }}
      />

      {/* 居中模拟大屏玻璃拟态卡片 */}
      <div
        className="relative w-full max-h-full rounded-xl border border-sky-400/25 bg-slate-900/80 shadow-xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: cs?.background || 'rgba(15, 23, 42, 0.86)',
          borderColor: cs?.borderColor || 'rgba(56, 189, 248, 0.28)',
          borderRadius: cs?.borderRadius ? `${Math.min(14, cs.borderRadius)}px` : '10px',
        }}
      >
        <div className="h-5 px-2 border-b border-slate-700/60 flex items-center justify-between bg-slate-950/45 shrink-0">
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
            <span className="text-[9px] font-semibold text-slate-200 truncate">{template.name}</span>
          </div>
          <span className="text-[8px] font-mono text-slate-400 shrink-0">
            {template.defaultSize.w}×{template.defaultSize.h}
          </span>
        </div>

        <div className="p-2 grid grid-cols-12 gap-1.5 content-start overflow-hidden">
          {template.elements.slice(0, 6).map((el) => {
            const spanCls =
              COL_SPAN_CLASS[Math.max(1, Math.min(12, Math.round(el.layout.colSpan)))] ?? 'col-span-12';
            return (
              <div key={el.id} className={spanCls}>
                <StaticMiniElement element={el} template={template} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 左下角：关联 3D 设备类型角标 */}
      {catalogItem ? (
        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-sky-500/35 text-[9px] font-mono text-sky-300 flex items-center gap-1 shadow">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: catalogItem.defaultColor }}
          />
          {catalogItem.labelZh}
        </div>
      ) : null}
    </div>
  );
});
