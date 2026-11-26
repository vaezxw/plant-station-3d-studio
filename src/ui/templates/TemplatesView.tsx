import type { FC } from 'react';
import { ArrowRight, FolderOpen, Layers, Play, Trash2 } from 'lucide-react';
import { PROJECT_PRESETS } from '../../domain/presets';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

const TemplatesView: FC<{ onEnterEditor?: () => void }> = ({ onEnterEditor }) => {
  const savedProjects = useProjectStore((s) => s.savedProjects);
  const loadPreset = useProjectStore((s) => s.loadPreset);
  const loadFromLibrary = useProjectStore((s) => s.loadFromLibrary);
  const deleteFromLibrary = useProjectStore((s) => s.deleteFromLibrary);

  const setMode = useEditorStore((s) => s.setMode);
  const setThemeId = useEditorStore((s) => s.setThemeId);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const triggerCameraView = useEditorStore((s) => s.triggerCameraView);

  const openPreset = (presetId: string, themeId: string, targetMode: 'studio' | 'dashboard') => {
    loadPreset(presetId);
    setThemeId(themeId);
    setSelectedNodeId(null);
    setMode(targetMode);
    onEnterEditor?.();
    setTimeout(() => triggerCameraView('iso'), 60);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-bg-canvas">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-end justify-between border-b border-border-subtle pb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">工艺流程模板中心</h1>
            <p className="text-xs text-text-secondary mt-1">
              选择内置燃气表工艺 / 燃气输配 / 水务模板快速起步，或从空白画布自由搭建并保存至本地工程库
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMode('studio');
              onEnterEditor?.();
            }}
            className="px-3.5 py-1.5 rounded-md bg-accent text-slate-950 text-xs font-semibold flex items-center gap-1.5 hover:opacity-90"
          >
            {onEnterEditor ? '进入 3D 工作台' : '返回当前工作台'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 内置行业模板 */}
        <section className="space-y-3">
          <div className="text-xs font-semibold text-accent uppercase tracking-wider">
            行业预设模板 ({PROJECT_PRESETS.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROJECT_PRESETS.map((preset) => {
              const sample = preset.create();
              return (
                <div
                  key={preset.id}
                  className="rounded-xl border border-border-subtle bg-bg-panel p-4 flex flex-col justify-between gap-4 hover:border-border-strong transition shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-soft text-accent border border-border-strong">
                        {preset.industryLabel}
                      </span>
                      <span className="text-[11px] font-mono text-text-muted flex items-center gap-1">
                        <Layers className="w-3 h-3" /> {sample.nodes.length}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-text-primary">{preset.name}</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">{preset.subtitle}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                    <button
                      type="button"
                      onClick={() => openPreset(preset.id, sample.themeId, 'studio')}
                      className="flex-1 h-8 rounded-md bg-accent-soft border border-border-strong text-accent text-xs font-medium hover:bg-accent hover:text-slate-950 transition"
                    >
                      进入 3D 搭建
                    </button>
                    <button
                      type="button"
                      onClick={() => openPreset(preset.id, sample.themeId, 'dashboard')}
                      className="h-8 px-2.5 rounded-md border border-border-subtle bg-bg-canvas/70 hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
                      title="直接查看大屏展示效果"
                    >
                      <Play className="w-3 h-3" /> 大屏
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 本地 IndexedDB 已保存工程 */}
        <section className="space-y-3">
          <div className="text-xs font-semibold text-accent uppercase tracking-wider">
            我的本地工程库 (IndexedDB · {savedProjects.length})
          </div>
          {savedProjects.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border-subtle text-center text-xs text-text-muted">
              暂无已保存的自定义工程。在 3D 搭建模式下点击右上角「保存」，即可将当前工艺工程存入本地库。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {savedProjects.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-border-subtle bg-bg-panel flex items-center justify-between gap-3 hover:border-border-strong transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{item.name}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {item.nodeCount} 个设备 · {new Date(item.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        void loadFromLibrary(item.id).then(() => {
                          setSelectedNodeId(null);
                          setMode('studio');
                          onEnterEditor?.();
                        });
                      }}
                      className="px-2.5 py-1.5 rounded bg-accent-soft text-accent text-xs font-medium flex items-center gap-1 hover:bg-accent hover:text-slate-950 transition"
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> 打开
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteFromLibrary(item.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400"
                      title="删除工程"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TemplatesView;
