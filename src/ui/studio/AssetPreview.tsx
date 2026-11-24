import { useEffect, useRef, useState, type FC } from 'react';
import type { CatalogKind } from '../../domain/catalog';
import { getThumbnailHub, THUMB_HEIGHT, THUMB_WIDTH } from '../../engine/ThumbnailGenerator';

type Props = {
  kind: CatalogKind;
  alt: string;
  hovered?: boolean;
};

/** 资产库模型预览：进入视口后生成高清静态 PNG 缩略图，悬停时激活实时 3D 自转 */
const AssetPreview: FC<Props> = ({ kind, alt, hovered = false }) => {
  const [src, setSrc] = useState<string>('');
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const hub = getThumbnailHub();
    const timer = window.setTimeout(() => {
      setSrc(hub.getThumbnail(kind));
    }, 0);
    const unsub = hub.subscribe(() => {
      setSrc(hub.getThumbnail(kind));
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [kind, visible]);

  useEffect(() => {
    if (!hovered || !visible) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const hub = getThumbnailHub();
    hub.startHover(kind, ctx);
    return () => {
      hub.stopHover();
    };
  }, [hovered, kind, visible]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-16 rounded-md overflow-hidden bg-gradient-to-b from-slate-800/55 to-slate-950/85 border border-border-subtle/60 flex items-center justify-center"
    >
      {src && !hovered ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="w-full h-full object-contain pointer-events-none select-none"
        />
      ) : !hovered ? (
        <div className="w-5 h-5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      ) : null}
      <canvas
        ref={canvasRef}
        width={THUMB_WIDTH}
        height={THUMB_HEIGHT}
        className={`w-full h-full object-contain pointer-events-none ${hovered ? 'block' : 'hidden'}`}
      />
    </div>
  );
};

export default AssetPreview;
