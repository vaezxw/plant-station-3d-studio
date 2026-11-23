import { useEffect, useRef, useState, type CSSProperties, type FC } from 'react';
import type { BlockComponentProps } from '@lius1314/visual-dashboard-scaffold';
import {
  createTurbojetViewer,
  type TurbojetSelect,
  type TurbojetViewer,
} from '../scene/turbojet/createTurbojetViewer';
import { TURBOJET_DISPLAY_NAME, TURBOJET_PALETTE_HINT } from './turbojetRegistry';

/**
 * Dedicated turbojet canvas. Does not replace 工艺三维 / energy-station catalog.
 * Monitor-only: spin / explode / cutaway / pick.
 */
const TurbojetBlock: FC<BlockComponentProps> = ({ width, height }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<TurbojetViewer | null>(null);
  const [spin, setSpin] = useState(false);
  const [explode, setExplode] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [status, setStatus] = useState<string | null>('加载涡喷模型…');
  const [sel, setSel] = useState<TurbojetSelect | null>(null); // identity only; overlay is in the viewer

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    void (async () => {
      try {
        const viewer = await createTurbojetViewer(host, {
          onSelect: (next) => {
            if (!cancelled) setSel(next);
          },
          onStatus: (msg) => {
            if (!cancelled) setStatus(msg);
          },
        });
        if (cancelled) {
          viewer.dispose();
          return;
        }
        viewerRef.current = viewer;
      } catch (err) {
        if (!cancelled) {
          setStatus(`涡喷画布启动失败：${err instanceof Error ? err.message : String(err)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, []);

  const toggleSpin = () => {
    const next = !spin;
    setSpin(next);
    viewerRef.current?.setSpin(next);
  };
  const toggleExplode = () => {
    const next = !explode;
    setExplode(next);
    viewerRef.current?.setExplode(next);
  };
  const toggleCut = () => {
    const next = !cutaway;
    setCutaway(next);
    viewerRef.current?.setCutaway(next);
  };
  const reset = () => {
    setSpin(false);
    setExplode(false);
    setCutaway(false);
    setSel(null);
    viewerRef.current?.resetView();
  };

  return (
    <div style={{ ...wrap, width: width ?? '100%', height: height ?? '100%' }}>
      <div style={chrome}>
        <strong style={{ color: '#67e8f9', letterSpacing: 1 }}>{TURBOJET_DISPLAY_NAME}</strong>
        <span style={{ opacity: 0.65, fontSize: 11 }}>监视-only · 小型轴流涡喷</span>
        {sel ? (
          <span style={{ color: '#bae6fd', fontSize: 11 }}>
            选中：{sel.labelZh}（{sel.partId}）
          </span>
        ) : null}
        <span style={{ opacity: 0.8, color: '#fde68a', fontSize: 11 }}>{TURBOJET_PALETTE_HINT}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" style={modeBtn(spin)} onClick={toggleSpin}>
            运转
          </button>
          <button type="button" style={modeBtn(explode)} onClick={toggleExplode}>
            爆炸视图
          </button>
          <button type="button" style={modeBtn(cutaway)} onClick={toggleCut}>
            剖切
          </button>
          <button type="button" style={modeBtn(false)} onClick={reset}>
            复位
          </button>
        </div>
      </div>
      <div ref={hostRef} style={canvasHost}>
        {status ? <div style={statusPane}>{status}</div> : null}
      </div>
    </div>
  );
};

const wrap: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  background: 'radial-gradient(ellipse at 40% 20%, #1e293b 0%, #0b1220 75%)',
  border: '1px solid rgba(56,189,248,0.3)',
  boxSizing: 'border-box',
  fontFamily: '"Microsoft YaHei", "Segoe UI", sans-serif',
  color: '#e2e8f0',
};

const chrome: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  padding: '6px 10px',
  fontSize: 13,
  borderBottom: '1px solid rgba(56,189,248,0.22)',
  background: 'rgba(15,23,42,0.65)',
  flexShrink: 0,
};

const canvasHost: CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
};

const statusPane: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  color: '#7dd3fc',
  fontSize: 13,
};

function modeBtn(active: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    border: '1px solid rgba(56,189,248,0.5)',
    background: active ? 'rgba(14,165,233,0.45)' : 'rgba(30,41,59,0.7)',
    color: '#e0f2fe',
    padding: '3px 10px',
    borderRadius: 3,
    fontSize: 11,
  };
}

export default TurbojetBlock;
