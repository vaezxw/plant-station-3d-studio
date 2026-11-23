/** EventBus 契约（页面 scope：`page:{pageId}`） */

export type TagSelectSource = 'scene' | 'label' | 'events' | 'summary';

export type TagSelectedPayload = {
  tag: string;
  source: TagSelectSource;
};

export type SnapshotChangedPayload = {
  snapshotId: 'canvas' | 'runtime';
};

export const PLANT_TAG_SELECTED = 'plant:tagSelected';
export const PLANT_SNAPSHOT_CHANGED = 'plant:snapshotChanged';

/** M2 首刀必选位号；场景缺此节点必须显式失败 */
export const M2_PRIMARY_TAG = 'HG-UF-101';
