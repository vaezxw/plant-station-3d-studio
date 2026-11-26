import { useEffect, useMemo, useRef } from 'react';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { parseRuntimeEntry } from './domain/runtimeUrl';
import { createDefaultDataSources, type DataFeedMode } from './domain/schema';
import { DataSourceManager } from './engine/DataSourceManager';
import { useCardTemplateStore } from './store/useCardTemplateStore';
import { useEditorStore } from './store/useEditorStore';
import { useProjectStore } from './store/useProjectStore';
import { useTelemetryStore } from './store/useTelemetryStore';
import { ForbiddenPage, RequireAuth, RequirePerm, useHasPerm } from './ui/components/AuthGuard';
import DataSourceModal from './ui/components/DataSourceModal';
import PreviewRuntimeShell from './ui/components/PreviewRuntimeShell';
import PublishSceneModal from './ui/components/PublishSceneModal';
import SceneViewport from './ui/components/SceneViewport';
import ThemeCustomizerModal from './ui/components/ThemeCustomizerModal';
import TopNav from './ui/components/TopNav';
import ConsoleAssetsPage from './ui/console/ConsoleAssetsPage';
import {
  ConsoleCardTemplatesPage,
  ConsoleProjectsPage,
  ConsoleReleasesPage,
} from './ui/console/ConsoleBusinessPages';
import ConsoleHomePage from './ui/console/ConsoleHomePage';
import {
  ConsoleDataSourcesPage,
  ConsoleIntegrationPage,
} from './ui/console/ConsoleIntegrationPages';
import ConsoleLayout from './ui/console/ConsoleLayout';
import {
  ConsoleRolesPage,
  ConsoleSettingsPage,
  ConsoleUsersPage,
} from './ui/console/ConsoleSystemPages';
import DashboardOverlay from './ui/dashboard/DashboardOverlay';
import LoginPage from './ui/pages/LoginPage';
import InspectorPanel from './ui/studio/InspectorPanel';
import LeftPanel from './ui/studio/LeftPanel';
import TemplatesView from './ui/templates/TemplatesView';

function WorkbenchShell() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const canEdit = useHasPerm('project:edit');
  const dsManagerRef = useRef<DataSourceManager | null>(null);

  const mode = useEditorStore((s) => s.mode);
  const dataSources = useProjectStore((s) => s.project.dataSources);
  const dataFeedMode = useTelemetryStore((s) => s.dataFeedMode);
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const loadFromLibrary = useProjectStore((s) => s.loadFromLibrary);
  const hydrateTemplates = useCardTemplateStore((s) => s.hydrateTemplates);
  const stepSimulation = useTelemetryStore((s) => s.stepSimulation);

  useEffect(() => {
    void hydrateFromStorage().then(() => {
      if (projectId) {
        const state = useProjectStore.getState();
        if (
          state.project.id !== projectId &&
          state.savedProjects.some((p) => p.id === projectId)
        ) {
          void loadFromLibrary(projectId);
        }
      }
    });
    void hydrateTemplates();
  }, [hydrateFromStorage, hydrateTemplates, loadFromLibrary, projectId]);

  useEffect(() => {
    if (!canEdit) {
      useEditorStore.getState().setMode('present');
    }
  }, [canEdit]);

  useEffect(() => {
    const mgr = new DataSourceManager();
    dsManagerRef.current = mgr;
    return () => {
      mgr.dispose();
      dsManagerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (dataFeedMode === 'bridge') {
      dsManagerRef.current?.dispose();
      return;
    }
    dsManagerRef.current?.sync(dataSources ?? createDefaultDataSources());
  }, [dataSources, dataFeedMode]);

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
        if (canEdit) editor.setMode('dashboard');
        else navigate('/console/home');
        return;
      }

      if (!canEdit) return;
      if (editor.mode !== 'studio' && editor.mode !== 'dashboard') return;

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

      if (editor.mode !== 'studio') return;
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
  }, [canEdit, navigate]);

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
      <DataSourceModal />
      <PublishSceneModal />
    </div>
  );
}

/** 免登录白名单：独立预览与 SCADA 嵌入式路由入口 (#/preview/:sceneId) */
function PreviewRouteBridge() {
  const { sceneId } = useParams();
  const [searchParams] = useSearchParams();

  const entry = useMemo(() => {
    const rawDataMode = searchParams.get('dataMode');
    const dataMode: DataFeedMode =
      rawDataMode === 'bridge' || rawDataMode === 'direct' || rawDataMode === 'sim'
        ? rawDataMode
        : 'auto';
    return {
      isPreviewEntry: true,
      sceneId: sceneId ? decodeURIComponent(sceneId) : null,
      token: (searchParams.get('token') ?? '').trim(),
      embed: searchParams.get('embed') === 'scada' ? ('scada' as const) : ('none' as const),
      dataMode,
      parentOrigin: (searchParams.get('parentOrigin') ?? '*').trim() || '*',
      hideChrome: searchParams.get('chrome') === '0',
    };
  }, [sceneId, searchParams]);

  return <PreviewRuntimeShell entry={entry} />;
}

function TemplatesConsoleRoute() {
  const navigate = useNavigate();
  return <TemplatesView onEnterEditor={() => navigate('/editor')} />;
}

export default function App() {
  // 兼容旧式 Query 参数入口 (?mode=preview&sceneId=xxx)
  const queryEntry = useMemo(() => {
    const parsed = parseRuntimeEntry();
    return window.location.search.includes('mode=preview') && parsed.isPreviewEntry ? parsed : null;
  }, []);

  if (queryEntry && queryEntry.sceneId) {
    return <PreviewRuntimeShell entry={queryEntry} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/preview/:sceneId" element={<PreviewRouteBridge />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<ForbiddenPage />} />

        <Route
          path="/console"
          element={
            <RequireAuth>
              <ConsoleLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/console/home" replace />} />
          <Route
            path="home"
            element={
              <RequirePerm perm="menu:home">
                <ConsoleHomePage />
              </RequirePerm>
            }
          />
          <Route
            path="projects"
            element={
              <RequirePerm perm="menu:projects">
                <ConsoleProjectsPage />
              </RequirePerm>
            }
          />
          <Route
            path="releases"
            element={
              <RequirePerm perm="menu:releases">
                <ConsoleReleasesPage />
              </RequirePerm>
            }
          />
          <Route
            path="templates"
            element={
              <RequirePerm perm="menu:templates">
                <TemplatesConsoleRoute />
              </RequirePerm>
            }
          />
          <Route
            path="assets-3d"
            element={
              <RequirePerm perm="menu:assets">
                <ConsoleAssetsPage />
              </RequirePerm>
            }
          />
          <Route
            path="card-templates"
            element={
              <RequirePerm perm="menu:card-templates">
                <ConsoleCardTemplatesPage />
              </RequirePerm>
            }
          />
          <Route
            path="datasources"
            element={
              <RequirePerm perm="menu:datasources">
                <ConsoleDataSourcesPage />
              </RequirePerm>
            }
          />
          <Route
            path="integration"
            element={
              <RequirePerm perm="menu:integration">
                <ConsoleIntegrationPage />
              </RequirePerm>
            }
          />
          <Route
            path="system/users"
            element={
              <RequirePerm perm="menu:system:users">
                <ConsoleUsersPage />
              </RequirePerm>
            }
          />
          <Route
            path="system/roles"
            element={
              <RequirePerm perm="menu:system:roles">
                <ConsoleRolesPage />
              </RequirePerm>
            }
          />
          <Route
            path="system/settings"
            element={
              <RequirePerm perm="menu:system:settings">
                <ConsoleSettingsPage />
              </RequirePerm>
            }
          />
        </Route>

        <Route
          path="/editor/:projectId?"
          element={
            <RequireAuth>
              <WorkbenchShell />
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to="/console/home" replace />} />
        <Route path="*" element={<Navigate to="/console/home" replace />} />
      </Routes>
    </HashRouter>
  );
}
