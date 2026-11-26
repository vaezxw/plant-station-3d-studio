import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { Check, ChevronDown, Palette } from 'lucide-react';
import { BUILTIN_THEMES, resolveThemeById } from '../../domain/themes';
import { useEditorStore } from '../../store/useEditorStore';

type Props = {
  /** 登录页模式：稍微加高以匹配悬浮顶栏胶囊 */
  variant?: 'topbar' | 'floating';
};

const ThemeSwitcher: FC<Props> = ({ variant = 'topbar' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const themeId = useEditorStore((s) => s.themeId);
  const customThemes = useEditorStore((s) => s.customThemes);
  const setThemeId = useEditorStore((s) => s.setThemeId);

  const allThemes = useMemo(() => [...BUILTIN_THEMES, ...customThemes], [customThemes]);
  const current = useMemo(
    () => resolveThemeById(themeId, customThemes),
    [themeId, customThemes],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="切换平台主题"
        onClick={() => setOpen((v) => !v)}
        className={`${
          variant === 'floating' ? 'h-9 px-3 rounded-xl bg-bg-panel' : 'h-8 px-2.5 rounded-xl bg-bg-canvas'
        } border border-border-subtle hover:border-border-strong hover:bg-bg-hover flex items-center gap-2 text-xs text-text-primary transition shadow-sm`}
      >
        <Palette className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="max-w-[116px] truncate font-medium">{current.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180 text-accent' : ''
          }`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="可用平台主题"
          className="theme-switcher-popover absolute right-0 mt-2 w-64 rounded-2xl border border-border-strong bg-bg-elevated backdrop-blur-2xl shadow-2xl p-1.5 z-50 space-y-0.5"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
            <span>选择平台主题风格</span>
            <span className="font-mono text-[9px] text-accent">{allThemes.length} 套</span>
          </div>
          {allThemes.map((t) => {
            const active = t.id === current.id;
            return (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setThemeId(t.id);
                  setOpen(false);
                }}
                className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition ${
                  active
                    ? 'bg-accent-soft border border-border-strong text-accent shadow-sm'
                    : 'border border-transparent hover:bg-bg-hover text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-5 h-5 rounded-full border border-white/40 shadow-sm shrink-0 overflow-hidden flex"
                    title={t.mode === 'light' ? '浅色主题' : '深色主题'}
                  >
                    <span className="w-1/2 h-full" style={{ background: t.tokens.bgCanvas }} />
                    <span className="w-1/2 h-full" style={{ background: t.tokens.accent }} />
                  </span>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold truncate ${active ? 'text-accent' : 'text-text-primary'}`}>
                      {t.name}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {t.id === 'liquid-glass'
                        ? '高透磨砂 · 镜面折光'
                        : t.mode === 'light'
                          ? '明亮工程视觉'
                          : '深邃护眼夜视'}
                    </div>
                  </div>
                </div>
                {active ? <Check className="w-3.5 h-3.5 text-accent shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default ThemeSwitcher;
