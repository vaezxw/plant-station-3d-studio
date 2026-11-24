import { useEffect } from 'react';
import { useEditorStore } from './store/useEditorStore';
import { useProjectStore } from './store/useProjectStore';
import { useTelemetryStore } from './store/useTelemetryStore';
import SceneViewport from './ui/components/SceneViewport';
import ThemeCustomizerModal from './ui/components/ThemeCustomizerModal';
import TopNav from './ui/components/TopNav';
import DashboardOverlay from './ui/dashboard/DashboardOverlay';
import InspectorPanel from './ui/studio/InspectorPanel';
import LeftPanel from './ui/studio/LeftPanel';
import TemplatesView from './ui/templates/TemplatesView';

export default function App() {
  const mode = useEditorStore((s) => s.mode);
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const stepSimulation = useTelemetryStore((s) => s.stepSimulation);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    const timer = window.setInterval(() => stepSimulation(), 1500);
    return () => window.clearInterval(timer);
  }, [stepSimulation]);

  // 全局 Studio 快捷键
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        return;
      }
      const editor = useEditorStore.getState();
      const proj = useProjectStore.getState();

      if (e.key === 'Escape' && editor.mode === 'present') {
        editor.setMode('dashboard');
        return;
      }

      if (editor.mode !== 'studio') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) proj.redo();
        else proj.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        proj.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (!editor.canvasLocked && editor.selectedNodeId) {
          const copy = proj.duplicateNode(editor.selectedNodeId);
          if (copy) editor.setSelectedNodeId(copy.id);
        }
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === 'q') editor.setTool('select');
      else if (lower === 'w') editor.setTool('move');
      else if (lower === 'e') editor.setTool('rotate');
      else if (lower === 'r') editor.setTool('scale');
      else if (lower === 'p') editor.setTool('pipe');
      else if (lower === 'f') editor.triggerCameraView('focus');
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor.canvasLocked) return;
        if (editor.selectedNodeId) {
          e.preventDefault();
          proj.removeNode(editor.selectedNodeId);
          editor.setSelectedNodeId(null);
        } else if (editor.selectedPipeId) {
          e.preventDefault();
          proj.removePipe(editor.selectedPipeId);
          editor.setSelectedPipeId(null);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-bg-canvas text-text-primary overflow-hidden">
      <TopNav />

      {mode === 'templates' ? (
        <TemplatesView />
      ) : (
        <main className="flex-1 min-h-0 flex relative overflow-hidden">
          {mode === 'studio' ? <LeftPanel /> : null}

          <div className="flex-1 min-w-0 h-full relative">
            <SceneViewport />
            {mode === 'dashboard' || mode === 'present' ? <DashboardOverlay /> : null}
          </div>

          {mode === 'studio' ? <InspectorPanel /> : null}
        </main>
      )}

      <ThemeCustomizerModal />
    </div>
  );
}
