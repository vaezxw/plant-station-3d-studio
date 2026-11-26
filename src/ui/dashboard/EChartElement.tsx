import { useEffect, useMemo, useRef, type FC } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, GaugeChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { CardElementSchema, DashboardSceneBinding, SceneNode } from '../../domain/schema';
import { resolveThemeById } from '../../domain/themes';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { POINT_CATALOG, useTelemetryStore } from '../../store/useTelemetryStore';
import { usePreviewOverride } from './PreviewOverrideContext';

echarts.use([
  LineChart,
  BarChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

type Props = {
  element: CardElementSchema;
  sceneBinding?: DashboardSceneBinding;
};

function resolveSeriesPointIds(
  element: CardElementSchema,
  sceneBinding?: DashboardSceneBinding,
  previewNode?: SceneNode,
): string[] {
  const nodes = useProjectStore.getState().project.nodes;
  const selectedNodeId = useEditorStore.getState().selectedNodeId;
  const rawList = element.props.seriesPointIds ?? [];

  if (element.binding?.mode === 'device-slot') {
    const targetId =
      element.binding.deviceSlot?.target === 'selected-node' || sceneBinding?.followSelectedNode
        ? selectedNodeId
        : sceneBinding?.targetNodeId;
    const node = previewNode ?? nodes.find((n) => n.id === targetId);
    if (node) {
      const merged = [...node.pointIds, ...(node.customPoints?.map((c) => c.key) ?? [])];
      if (element.type === 'chart-gauge') {
        const idx = element.binding.deviceSlot?.metricIndex ?? 0;
        return merged[idx] ? [merged[idx]] : [];
      }
      if (merged.length > 0) return merged.slice(0, 3);
    }
  }

  if (element.type === 'chart-gauge') {
    return element.binding?.pointKey ? [element.binding.pointKey] : rawList.slice(0, 1);
  }
  return rawList.length > 0 ? rawList : ['HG-UF-101.pressure'];
}

export const EChartElement: FC<Props> = ({ element, sceneBinding }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const storeValueMap = useTelemetryStore((s) => s.valueMap);
  const storePointHistory = useTelemetryStore((s) => s.pointHistory);
  const externalDefs = useTelemetryStore((s) => s.externalDefs);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const themeId = useEditorStore((s) => s.themeId);
  const customThemes = useEditorStore((s) => s.customThemes);
  const previewOverride = usePreviewOverride();

  const isLightTheme = useMemo(
    () => resolveThemeById(themeId, customThemes).mode === 'light',
    [themeId, customThemes],
  );

  const valueMap = useMemo(
    () =>
      previewOverride?.valueOverrides
        ? { ...storeValueMap, ...previewOverride.valueOverrides }
        : storeValueMap,
    [storeValueMap, previewOverride?.valueOverrides],
  );
  const pointHistory = useMemo(
    () =>
      previewOverride?.historyOverrides
        ? { ...storePointHistory, ...previewOverride.historyOverrides }
        : storePointHistory,
    [storePointHistory, previewOverride?.historyOverrides],
  );

  const seriesIds = useMemo(
    () => resolveSeriesPointIds(element, sceneBinding, previewOverride?.previewNode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [element, sceneBinding, selectedNodeId, previewOverride?.previewNode],
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => {
      chart.resize();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const palette = element.props.chartColors?.length
      ? element.props.chartColors
      : isLightTheme
        ? ['#007aff', '#d97706', '#059669', '#7c3aed']
        : ['#38bdf8', '#f59e0b', '#34d399', '#a78bfa'];

    const textMain = isLightTheme ? '#0f172a' : '#f8fafc';
    const textMuted = isLightTheme ? '#475569' : '#94a3b8';
    const textBar = isLightTheme ? '#334155' : '#cbd5e1';
    const trackBg = isLightTheme ? 'rgba(15,23,42,0.12)' : 'rgba(148,163,184,0.18)';
    const splitColor = isLightTheme ? 'rgba(15,23,42,0.1)' : 'rgba(148,163,184,0.12)';
    const axisLineColor = isLightTheme ? 'rgba(15,23,42,0.2)' : 'rgba(148,163,184,0.25)';
    const tipBg = isLightTheme ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const tipBorder = isLightTheme ? 'rgba(0,122,255,0.35)' : 'rgba(56,189,248,0.4)';

    const labelOf = (pid: string) =>
      POINT_CATALOG.find((p) => p.id === pid)?.name ??
      previewOverride?.defOverrides?.[pid]?.name ??
      externalDefs[pid]?.name ??
      pid;
    const unitOf = (pid: string) =>
      POINT_CATALOG.find((p) => p.id === pid)?.unit ??
      previewOverride?.defOverrides?.[pid]?.unit ??
      externalDefs[pid]?.unit ??
      '';

    if (element.type === 'chart-gauge') {
      const pid = seriesIds[0];
      const rawVal = pid ? valueMap[pid]?.value : null;
      const mult = element.binding?.format?.multiplier ?? 1;
      const off = element.binding?.format?.offset ?? 0;
      const prec = element.binding?.format?.precision ?? 1;
      const val =
        rawVal !== null && rawVal !== undefined && Number.isFinite(rawVal)
          ? Number((rawVal * mult + off).toFixed(prec))
          : 0;
      const unit = element.binding?.format?.unit ?? (pid ? unitOf(pid) : '');
      const min = element.props.min ?? 0;
      const max = element.props.max ?? 200;
      const accent = element.style.color || palette[0];

      chart.setOption(
        {
          backgroundColor: 'transparent',
          series: [
            {
              type: 'gauge',
              min,
              max,
              startAngle: 205,
              endAngle: -25,
              radius: '88%',
              center: ['50%', '55%'],
              progress: { show: true, width: 7, itemStyle: { color: accent } },
              axisLine: {
                lineStyle: { width: 7, color: [[1, trackBg]] },
              },
              pointer: { show: true, length: '52%', width: 3, itemStyle: { color: textMain } },
              axisTick: { show: false },
              splitLine: { length: 5, lineStyle: { width: 1.5, color: 'rgba(148,163,184,0.45)' } },
              axisLabel: { distance: 11, color: textMuted, fontSize: 8 },
              detail: {
                valueAnimation: true,
                offsetCenter: [0, '44%'],
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                color: textMain,
                formatter: `{value} ${unit}`,
              },
              title: {
                offsetCenter: [0, '76%'],
                fontSize: 10,
                color: textMuted,
              },
              data: [{ value: val, name: element.props.label || '' }],
            },
          ],
        },
        true,
      );
      return;
    }

    if (element.type === 'chart-bar') {
      const names = seriesIds.map((pid) => labelOf(pid));
      const vals = seriesIds.map((pid, idx) => {
        const v = valueMap[pid]?.value ?? 0;
        return {
          value: Number(v.toFixed(2)),
          itemStyle: {
            color: palette[idx % palette.length],
            borderRadius: [4, 4, 0, 0],
          },
        };
      });

      chart.setOption(
        {
          backgroundColor: 'transparent',
          grid: { top: 24, right: 12, bottom: 24, left: 36, containLabel: true },
          tooltip: {
            trigger: 'axis',
            backgroundColor: tipBg,
            borderColor: tipBorder,
            textStyle: { color: textMain, fontSize: 11 },
          },
          xAxis: {
            type: 'category',
            data: names,
            axisLine: { lineStyle: { color: axisLineColor } },
            axisLabel: { color: textMuted, fontSize: 10, interval: 0, overflow: 'truncate', width: 64 },
          },
          yAxis: {
            type: 'value',
            splitLine: {
              show: element.props.showGrid ?? true,
              lineStyle: { color: splitColor, type: 'dashed' },
            },
            axisLabel: { color: textMuted, fontSize: 10 },
          },
          series: [
            {
              type: 'bar',
              barMaxWidth: 28,
              data: vals,
              label: {
                show: true,
                position: 'top',
                color: textBar,
                fontSize: 10,
                fontFamily: 'monospace',
              },
            },
          ],
        },
        true,
      );
      return;
    }

    // chart-line 多系列实时曲线
    const firstHist = seriesIds.map((id) => pointHistory[id] ?? []).find((l) => l.length > 0) ?? [];
    const xLabels = firstHist.map((p) => p.label);
    const thresholds = element.binding?.thresholds ?? [];

    chart.setOption(
      {
        backgroundColor: 'transparent',
        grid: { top: seriesIds.length > 1 ? 26 : 16, right: 12, bottom: 18, left: 38, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: tipBg,
          borderColor: tipBorder,
          textStyle: { color: textMain, fontSize: 11 },
        },
        legend:
          seriesIds.length > 1
            ? {
                top: 0,
                right: 4,
                textStyle: { color: textMuted, fontSize: 10 },
                itemWidth: 10,
                itemHeight: 6,
              }
            : { show: false },
        xAxis: {
          type: 'category',
          data: xLabels,
          boundaryGap: false,
          axisLine: { lineStyle: { color: axisLineColor } },
          axisLabel: { color: textMuted, fontSize: 9 },
        },
        yAxis: {
          type: 'value',
          scale: true,
          min: element.props.min,
          max: element.props.max,
          splitLine: {
            show: element.props.showGrid ?? true,
            lineStyle: { color: splitColor, type: 'dashed' },
          },
          axisLabel: { color: textMuted, fontSize: 9 },
        },
        series: seriesIds.map((pid, idx) => {
          const c = palette[idx % palette.length];
          const hist = pointHistory[pid] ?? [];
          return {
            name: labelOf(pid),
            type: 'line',
            smooth: true,
            showSymbol: false,
            lineStyle: { width: 2, color: c },
            itemStyle: { color: c },
            areaStyle: element.props.areaFill
              ? {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: `${c}55` },
                    { offset: 1, color: `${c}05` },
                  ]),
                }
              : undefined,
            data: hist.map((pt) => pt.value),
            markLine:
              idx === 0 && thresholds.length > 0
                ? {
                    silent: true,
                    symbol: 'none',
                    lineStyle: { color: thresholds[0].color, type: 'dashed', width: 1.5 },
                    data: [{ yAxis: thresholds[0].value }],
                  }
                : undefined,
          };
        }),
      },
      true,
    );
  }, [element, externalDefs, isLightTheme, pointHistory, seriesIds, valueMap]);

  const heightPx = element.style.heightPx ?? 145;
  return (
    <div className="w-full flex flex-col">
      {element.props.label && element.type !== 'chart-gauge' ? (
        <div className="text-[11px] font-medium text-text-secondary px-1 mb-0.5 truncate">
          {element.props.label}
        </div>
      ) : null}
      <div ref={hostRef} className="w-full" style={{ height: `${heightPx}px` }} />
    </div>
  );
};
