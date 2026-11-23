import {
  App as DashboardApp,
  defaultDashboardConfig,
  type DashboardConfig,
} from '@lius1314/visual-dashboard-scaffold';
import '@lius1314/visual-dashboard-scaffold/style.css';
import './blocks';
import ScenePaletteHost from './blocks/ScenePaletteHost';

const PAGE_ID = 'process';

const initialConfig: DashboardConfig = {
  ...defaultDashboardConfig,
  editMode: true,
  activePageId: PAGE_ID,
  outer: {
    width: 1920,
    height: 1080,
    background: 'transparent',
    autofit: {
      enabled: true,
      designWidth: 1920,
      designHeight: 1080,
      resize: true,
      transition: 0,
      delay: 0,
    },
  },
  header: {
    ...defaultDashboardConfig.header,
    height: 80,
    visible: true,
    title: {
      ...defaultDashboardConfig.header.title,
      text: '湖北恒光燃气 / 橇装工艺',
      fontSize: 28,
      letterSpacing: 4,
    },
  },
  pages: [
    {
      id: PAGE_ID,
      name: '橇装工艺',
      middle: {
        height: 0,
        background: 'transparent',
        visible: true,
      },
      chartBlocks: [
        {
          id: 'summary',
          title: '总览',
          titleHeight: 36,
          titleBackground: 'transparent',
          contentBackground: 'transparent',
          blockBackground: 'transparent',
          layout: {
            i: 'summary',
            x: 16,
            y: 12,
            w: 560,
            h: 250,
            zIndex: 0,
            minW: 280,
            minH: 160,
          },
        },
        {
          id: 'scene',
          title: '工艺三维',
          titleHeight: 36,
          titleBackground: 'transparent',
          contentBackground: 'transparent',
          blockBackground: 'transparent',
          layout: {
            i: 'scene',
            x: 16,
            y: 276,
            w: 1280,
            h: 680,
            zIndex: 0,
            minW: 480,
            minH: 320,
          },
        },
        {
          id: 'detail',
          title: '设备详情',
          titleHeight: 36,
          titleBackground: 'transparent',
          contentBackground: 'transparent',
          blockBackground: 'transparent',
          layout: {
            i: 'detail',
            x: 1312,
            y: 12,
            w: 580,
            h: 944,
            zIndex: 0,
            minW: 280,
            minH: 240,
          },
        },
      ],
      params: {},
    },
  ],
};

export default function App() {
  return (
    <>
      <DashboardApp editable initialConfig={initialConfig} />
      {/* 编辑模式组件库：脚手架原生不列出 registerBlock 中文名 */}
      <ScenePaletteHost />
    </>
  );
}
