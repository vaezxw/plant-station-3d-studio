import { registerBlock } from '@lius1314/visual-dashboard-scaffold';
import DetailBlock from './DetailBlock';
import M0Hello from './M0Hello';
import PointsPanel from './PointsPanel';
import SceneBlock from './SceneBlock';
import SummaryBlock from './SummaryBlock';
import { registerSceneBlocks } from './sceneRegistry';

registerBlock('m0-hello', M0Hello);
registerBlock('m1-points', PointsPanel);
registerBlock('detail', DetailBlock);
registerBlock('summary', SummaryBlock);

/** 空白画布：displayName=工艺三维槽位 scene / scene-2…；涡喷改为目录 kind 拖入 */
registerSceneBlocks(SceneBlock);
