import type { FC } from 'react';
import type { BlockComponentProps } from '@lius1314/visual-dashboard-scaffold';

/** M0 占位块：证明 registerBlock 已生效，非「未绑定组件」。 */
const M0Hello: FC<BlockComponentProps> = ({ blockId, title, width, height }) => {
  return (
    <div
      style={{
        width: width ?? '100%',
        height: height ?? '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        color: '#e2e8f0',
        background: 'linear-gradient(160deg, rgba(15,23,42,0.92), rgba(30,41,59,0.85))',
        border: '1px solid rgba(56,189,248,0.35)',
        fontFamily: '"Microsoft YaHei", sans-serif',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, color: '#38bdf8' }}>
        M0 Hello
      </div>
      <div style={{ fontSize: 16, opacity: 0.9 }}>湖北恒光燃气 / 橇装工艺</div>
      <div style={{ fontSize: 13, opacity: 0.65 }}>
        blockId={blockId} · title={title || 'm0-hello'}
      </div>
      <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
        脚手架已接通；后续 M1+ 再接拓扑 / 三维 / PLC（本里程碑不做）。
      </div>
    </div>
  );
};

export default M0Hello;