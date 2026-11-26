import {
  createWidgetsForTemplate,
  normalizeWidgetsTo24Cols,
  type DashboardWidgetConfig,
  type ProjectSchema,
} from '../domain/schema';
import { useTelemetryStore } from '../store/useTelemetryStore';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawWidgetContent(
  ctx: CanvasRenderingContext2D,
  w: DashboardWidgetConfig,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  const valueMap = useTelemetryStore.getState().valueMap;
  const padding = 6;
  const cx = bx + padding;
  const cy = by + 16 + padding;
  const cw = Math.max(20, bw - padding * 2);
  const ch = Math.max(16, bh - 16 - padding * 2);

  // 优先尝试截取页面中对应大屏卡片真实渲染的 ECharts Canvas
  const domWidget =
    typeof document !== 'undefined'
      ? document.querySelector(`[data-drop-widget-id="${w.id}"]`)
      : null;
  const chartCanvases = domWidget ? Array.from(domWidget.querySelectorAll('canvas')) : [];
  if (chartCanvases.length > 0) {
    const stepH = ch / chartCanvases.length;
    chartCanvases.forEach((c, idx) => {
      try {
        if (c.width > 0 && c.height > 0) {
          ctx.drawImage(c, cx, cy + idx * stepH, cw, Math.max(14, stepH - 2));
        }
      } catch {
        // ignore tainted canvas
      }
    });
    if (w.type === 'custom' && (w.elements?.length ?? 0) === chartCanvases.length) {
      return;
    }
  }

  if (w.type === 'kpi') {
    const p1 = valueMap['HG-UF-101.pressure']?.value ?? 4676.9;
    const f1 = valueMap['HG-UF-101.flowWork']?.value ?? 124.5;
    const t1 = valueMap['HG-UF-101.temperature']?.value ?? 39.5;
    const items = [
      ['压力', `${p1}`],
      ['温度', `${t1}`],
      ['流量', `${f1}`],
      ['累积', '31.4M'],
    ];
    const cellW = (cw - 4) / 2;
    const cellH = (ch - 4) / 2;
    items.forEach(([lbl, val], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const ix = cx + col * (cellW + 4);
      const iy = cy + row * (cellH + 4);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      drawRoundedRect(ctx, ix, iy, cellW, cellH, 4);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px sans-serif';
      ctx.fillText(lbl, ix + 4, iy + 10);
      ctx.fillStyle = idx === 2 ? '#38bdf8' : '#f1f5f9';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(val, ix + 4, iy + Math.min(cellH - 3, 21));
    });
    return;
  }

  if (w.type === 'trend') {
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const ly = cy + (ch / 3) * i;
      ctx.beginPath();
      ctx.moveTo(cx, ly);
      ctx.lineTo(cx + cw, ly);
      ctx.stroke();
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const px = cx + (i / 12) * cw;
      const py = cy + ch * 0.45 + Math.sin(i * 0.7) * (ch * 0.25);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const px = cx + (i / 12) * cw;
      const py = cy + ch * 0.65 + Math.cos(i * 0.65) * (ch * 0.2);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    return;
  }

  if (w.type === 'alarms') {
    for (let i = 0; i < 2; i++) {
      const ay = cy + i * Math.min(26, ch / 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      drawRoundedRect(ctx, cx, ay, cw, Math.min(22, ch / 2 - 3), 4);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx + 4, ay + 6, 4, 4);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
      ctx.fillRect(cx + 12, ay + 6, cw * 0.68, 3);
    }
    return;
  }

  if (w.type === 'production' || w.type === 'section-stats') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    drawRoundedRect(ctx, cx, cy, cw, Math.max(10, ch * 0.45), 4);
    ctx.fill();
    ctx.fillStyle = '#34d399';
    ctx.fillRect(cx, cy + ch - 8, cw * 0.85, 5);
    return;
  }

  // detail / custom 卡片兜底元素轮廓
  const els = w.elements ?? [];
  if (els.length > 0 && chartCanvases.length === 0) {
    const rowH = Math.max(14, Math.min(24, ch / Math.max(1, Math.min(els.length, 4))));
    els.slice(0, 4).forEach((el, idx) => {
      const ey = cy + idx * (rowH + 2);
      if (ey + rowH > cy + ch + 4) return;
      ctx.fillStyle =
        el.type === 'chart-gauge' || el.type === 'chart-line'
          ? 'rgba(56, 189, 248, 0.18)'
          : 'rgba(15, 23, 42, 0.7)';
      drawRoundedRect(ctx, cx, ey, cw, rowH, 4);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px sans-serif';
      ctx.fillText((el.props.label || el.name).slice(0, 10), cx + 5, ey + Math.min(rowH - 4, 12));
    });
  } else if (chartCanvases.length === 0) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    drawRoundedRect(ctx, cx, cy, cw, Math.min(22, ch * 0.45), 4);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('设备详情 · 联动卡片', cx + 6, cy + 14);
  }
}

/** 将 3D 视口底图与 24 列组态大屏卡片合成为一张 16:9 高清展示缩略图 */
export async function composeDashboardThumbnail(
  base3dDataUrl: string | undefined,
  project: ProjectSchema,
  maxWidth = 640,
): Promise<string | undefined> {
  if (typeof document === 'undefined') return base3dDataUrl;

  const width = maxWidth;
  const height = Math.round((maxWidth * 9) / 16);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return base3dDataUrl;

  // 1. 底色与工业网格背景
  ctx.fillStyle = '#090e1a';
  ctx.fillRect(0, 0, width, height);

  if (base3dDataUrl) {
    const img = await loadImage(base3dDataUrl);
    if (img && img.width > 0 && img.height > 0) {
      const srcRatio = img.width / img.height;
      const dstRatio = width / height;
      let dw = width;
      let dh = height;
      let dx = 0;
      let dy = 0;
      if (srcRatio > dstRatio) {
        dh = height;
        dw = height * srcRatio;
        dx = (width - dw) / 2;
      } else {
        dw = width;
        dh = width / srcRatio;
        dy = (height - dh) / 2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  } else {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // 2. 叠加 24 列大屏编排组态卡片（只要存在可见卡片就自动绘制合成）
  const rawWidgets = project.dashboardWidgets ?? createWidgetsForTemplate(project.dashboardTemplate);
  const widgets = normalizeWidgetsTo24Cols(rawWidgets).filter((w) => w.visible);
  if (widgets.length > 0) {
    const padX = 14;
    const topY = 26;
    const bottomPad = 18;
    const gridW = width - padX * 2;
    const gridH = height - topY - bottomPad;
    const maxRow = Math.max(18, ...widgets.map((w) => w.y + w.h));
    const colW = gridW / 24;
    const rowH = gridH / maxRow;

    // 顶部大屏状态标题胶囊
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    drawRoundedRect(ctx, padX, 6, Math.min(240, width * 0.45), 16, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(padX + 10, 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(project.name.slice(0, 18), padX + 18, 17);

    // 各张悬浮大屏卡片
    for (const w of widgets) {
      const bx = padX + w.x * colW + 2;
      const by = topY + w.y * rowH + 2;
      const bw = Math.max(36, w.w * colW - 4);
      const bh = Math.max(28, w.h * rowH - 4);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      drawRoundedRect(ctx, bx, by, bw, bh, 7);
      ctx.fill();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 卡片标题头
      ctx.fillStyle = 'rgba(22, 33, 56, 0.72)';
      drawRoundedRect(ctx, bx + 1, by + 1, bw - 2, 14, 6);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(w.title.slice(0, Math.max(4, Math.floor(bw / 8))), bx + 6, by + 11);

      drawWidgetContent(ctx, w, bx, by, bw, bh);
    }
  }

  return canvas.toDataURL('image/jpeg', 0.84);
}

/** 从当前运行中 3D 视口抓帧并与项目大屏配置合成为统一缩略图 */
export async function captureProjectCompositeSnapshot(
  project: ProjectSchema,
): Promise<string | undefined> {
  const rawCap = (
    window as unknown as { __plantStudioCaptureThumbnail?: () => string | undefined }
  ).__plantStudioCaptureThumbnail;
  const base3d = rawCap?.();
  if (!base3d && project.thumbnailDataUrl) {
    return await composeDashboardThumbnail(project.thumbnailDataUrl, project);
  }
  return await composeDashboardThumbnail(base3d, project);
}
