import { useState, type FC } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { BUILTIN_THEMES, resolveThemeById, type StudioTheme } from '../../domain/themes';
import { useEditorStore } from '../../store/useEditorStore';

const ThemeCustomizerModal: FC = () => {
  const open = useEditorStore((s) => s.themeModalOpen);
  const themeId = useEditorStore((s) => s.themeId);
  const customThemes = useEditorStore((s) => s.customThemes);
  const setThemeModalOpen = useEditorStore((s) => s.setThemeModalOpen);
  const setThemeId = useEditorStore((s) => s.setThemeId);
  const saveCustomTheme = useEditorStore((s) => s.saveCustomTheme);
  const deleteCustomTheme = useEditorStore((s) => s.deleteCustomTheme);

  const current = resolveThemeById(themeId, customThemes);

  const [name, setName] = useState(`${current.name} · 自定义`);
  const [mode, setMode] = useState<'dark' | 'light'>(current.mode);
  const [accent, setAccent] = useState(current.tokens.accent);
  const [bgCanvas, setBgCanvas] = useState(current.tokens.bgCanvas);
  const [sceneBg, setSceneBg] = useState(current.scene3d.background);
  const [groundColor, setGroundColor] = useState(current.scene3d.groundColor);
  const [gridPrimary, setGridPrimary] = useState(current.scene3d.gridPrimary);

  if (!open) return null;

  const handleSaveAsNew = () => {
    const cleanName = name.trim() || '自定义主题';
    const isDark = mode === 'dark';
    const next: StudioTheme = {
      id: `custom-${Date.now()}`,
      name: cleanName,
      description: '用户自定义风格主题',
      mode,
      isCustom: true,
      tokens: {
        bgCanvas,
        bgPanel: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)',
        bgElevated: isDark ? 'rgba(22, 33, 56, 0.94)' : 'rgba(248, 250, 252, 0.98)',
        bgHover: `${accent}24`,
        borderSubtle: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.12)',
        borderStrong: `${accent}75`,
        textPrimary: isDark ? '#f1f5f9' : '#0f172a',
        textSecondary: isDark ? '#cbd5e1' : '#334155',
        textMuted: '#64748b',
        accent,
        accentSoft: `${accent}28`,
        accentGlow: `${accent}55`,
      },
      scene3d: {
        background: sceneBg,
        fogColor: sceneBg,
        fogDensity: isDark ? 0.018 : 0.012,
        groundColor,
        gridPrimary,
        gridSecondary: groundColor,
        envIntensity: isDark ? 0.9 : 1.05,
      },
    };
    saveCustomTheme(next);
    setThemeModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] max-w-[92vw] rounded-xl bg-bg-elevated border border-border-strong shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">主题风格与自定义扩展</h3>
          <button
            type="button"
            onClick={() => setThemeModalOpen(false)}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <div className="text-xs font-medium text-text-secondary mb-2">已注册主题</div>
            <div className="grid grid-cols-2 gap-2">
              {[...BUILTIN_THEMES, ...customThemes].map((t) => {
                const active = t.id === themeId;
                return (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition ${
                      active
                        ? 'border-border-strong bg-accent-soft'
                        : 'border-border-subtle bg-bg-canvas/60 hover:bg-bg-hover'
                    }`}
                    onClick={() => setThemeId(t.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ background: t.tokens.accent }}
                      />
                      <span className="text-xs font-medium text-text-primary truncate">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {active ? <Check className="w-3.5 h-3.5 text-accent" /> : null}
                      {t.isCustom ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomTheme(t.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400"
                          title="删除此自定义主题"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-3">
            <div className="text-xs font-medium text-text-secondary">新建自定义风格</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-text-secondary space-y-1">
                <span>主题名称</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-border-strong"
                />
              </label>
              <label className="text-xs text-text-secondary space-y-1">
                <span>明暗基调</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'dark' | 'light')}
                  className="w-full px-2.5 py-1.5 rounded bg-bg-canvas border border-border-subtle text-text-primary focus:outline-none focus:border-border-strong"
                >
                  <option value="dark">深色大屏模式</option>
                  <option value="light">浅色工程蓝图</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { label: '强调色', val: accent, set: setAccent },
                { label: 'UI 底色', val: bgCanvas, set: setBgCanvas },
                { label: '3D 背景', val: sceneBg, set: setSceneBg },
                { label: '地坪色', val: groundColor, set: setGroundColor },
                { label: '网格线', val: gridPrimary, set: setGridPrimary },
              ].map((c) => (
                <label
                  key={c.label}
                  className="flex flex-col items-center gap-1 p-2 rounded bg-bg-canvas/70 border border-border-subtle text-[11px] text-text-secondary cursor-pointer"
                >
                  <input
                    type="color"
                    value={c.val}
                    onChange={(e) => c.set(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border-subtle flex justify-end gap-2 bg-bg-canvas/50">
          <button
            type="button"
            onClick={() => setThemeModalOpen(false)}
            className="px-3 py-1.5 rounded-md text-xs border border-border-subtle text-text-secondary hover:bg-bg-hover"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSaveAsNew}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-accent text-slate-950 flex items-center gap-1.5 hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> 保存并应用新主题
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeCustomizerModal;
