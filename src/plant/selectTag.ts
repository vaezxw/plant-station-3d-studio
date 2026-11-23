import { setSelectedTag } from '../data/cursor';
import {
  PLANT_TAG_SELECTED,
  type TagSelectedPayload,
  type TagSelectSource,
} from './events';

type EmitFn = (eventName: string, payload?: unknown) => void;

/**
 * 统一选中入口：更新 thin store，再经 EventBus 通知各块。
 * 监视-only：不写阀、不改几何权威。
 */
export function selectPlantTag(
  tag: string | null,
  source: TagSelectSource,
  emit?: EmitFn,
): void {
  setSelectedTag(tag);
  if (tag && emit) {
    const payload: TagSelectedPayload = { tag, source };
    emit(PLANT_TAG_SELECTED, payload);
  }
}
