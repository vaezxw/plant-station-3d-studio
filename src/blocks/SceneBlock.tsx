import { useState, type CSSProperties, type FC } from 'react';
import type { BlockComponentProps } from '@lius1314/visual-dashboard-scaffold';
import {
  loadCanvasMode,
  saveCanvasMode,
  type CanvasRenderMode,
} from './canvasMode';
import { contentBackgroundStyle, useBlockContentBackground } from './blockTheme';
import Scene2DRenderer from './Scene2DRenderer';
import Scene3DRenderer from './Scene3DRenderer';
import { SCENE_DISPLAY_NAME, SCENE_PALETTE_HINT } from './sceneRegistry';

/**
 * 空白画布宿主：组件库只提供这一类画布（槽位 scene / scene-2…）。
 * 用户再选 2D / 3D；涡喷与柜体都从三维模型库拖入同一 3D 场景。
 */
const SceneBlock: FC<BlockComponentProps> = (props) => {
  const slotId = props.blockId || 'scene';
  const contentBackground = useBlockContentBackground(props.pageId, props.blockId);
  const [mode, setMode] = useState<CanvasRenderMode>(() => loadCanvasMode(slotId));

  const pick = (next: CanvasRenderMode) => {
    setMode(next);
    saveCanvasMode(slotId, next);
  };

  return (
    <div
      style={{
        ...hostWrap,
        ...contentBackgroundStyle(contentBackground),
        width: props.width ?? '100%',
        height: props.height ?? '100%',
      }}
    >
      <div style={chrome}>
        <strong style={{ color: '#38bdf8', letterSpacing: 1 }}>{SCENE_DISPLAY_NAME}</strong>
        <span style={{ opacity: 0.65, fontSize: 11 }}>
          {mode === 'blank' ? '空白画布' : mode === '2d' ? '2D 模式' : '3D 模式'}
        </span>
        <span style={{ opacity: 0.85, color: '#fde68a', fontSize: 11 }}>{SCENE_PALETTE_HINT}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button type="button" style={modeBtn(mode === '2d')} onClick={() => pick('2d')}>
            2D
          </button>
          <button type="button" style={modeBtn(mode === '3d')} onClick={() => pick('3d')}>
            3D
          </button>
          <button
            type="button"
            style={modeBtn(mode === 'blank')}
            onClick={() => pick('blank')}
            title="回到空白，可重选模式"
          >
            空白
          </button>
        </div>
      </div>

      <div style={body}>
        {mode === 'blank' ? (
          <div style={blankPane}>
            <div style={{ fontSize: 18, color: '#67e8f9', fontWeight: 600 }}>空白画布</div>
            <div style={{ fontSize: 13, opacity: 0.75, maxWidth: 420, lineHeight: 1.55 }}>
              添加画布不会自动进入三维，也不会铺恒光环路。请选择 2D/3D，再从「三维模型」拖入阀门、PCS、橇装或涡喷。
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="button" style={bigChoice} onClick={() => pick('2d')}>
                进入 2D
              </button>
              <button type="button" style={bigChoice} onClick={() => pick('3d')}>
                进入 3D
              </button>
            </div>
          </div>
        ) : null}
        {mode === '2d' ? <Scene2DRenderer {...props} slotId={slotId} /> : null}
        {mode === '3d' ? <Scene3DRenderer {...props} /> : null}
      </div>
    </div>
  );
};

const hostWrap: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  background: 'transparent',
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

const body: CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
};

const blankPane: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: 24,
  textAlign: 'center',
};

const bigChoice: CSSProperties = {
  cursor: 'pointer',
  border: '1px solid rgba(56,189,248,0.55)',
  background: 'rgba(14,165,233,0.28)',
  color: '#f0f9ff',
  padding: '10px 22px',
  borderRadius: 4,
  fontSize: 14,
  fontWeight: 600,
};

function modeBtn(active: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    border: '1px solid rgba(56,189,248,0.5)',
    background: active ? 'rgba(14,165,233,0.4)' : 'rgba(30,41,59,0.7)',
    color: '#e0f2fe',
    padding: '3px 10px',
    borderRadius: 3,
    fontSize: 11,
  };
}

export default SceneBlock;
