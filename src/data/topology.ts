/**
 * 恒光橇装工艺拓扑（M1 冻结稿）。
 *
 * 依据：docs/3d-process-flow-research.md 图一位号 + 柜铭牌核对。
 * 硬规则：上下路不对称，禁止把下路末 MOV 改成上路式双 PV。
 *
 * --- 人工冻结结论（G1 书面结论落库；未决项标 review）---
 * 1. HG-UF-102：柜门铭牌清晰为 HG-UF-102；画布下路 OCR 不稳定。
 *    冻结 tag=`HG-UF-102`，挂在下路 FS→MOV 之间；canvasPosition=review。
 * 2. HG-MOV10122：OCR 出现两次，按「同一标签扫到两次」冻结为**单台**设备；
 *    若原图旁还有第二台，需人工改 topology（不得凭空加节点）。
 * 3. 调压后/出口压力「1.06」「0.86」：图一无单位 → 点表 unit=`?` + quality 可 UNCERTAIN；
 *    本文件不臆造 MPa/kPa。
 * 4. 画布「7 号阀 / 8 号阀」未绑定到具体 HG-* → 见 points.ts reviewTags。
 */

export type NodeKind = 'HOV' | 'FS' | 'UF' | 'MOV' | 'SSV' | 'PCV' | 'PV';
export type Lane = 'elster' | 'weisi' | 'common';

export type TopologyNode = {
  tag: string;
  kind: NodeKind;
  lane: Lane;
  upstream: string[];
  downstream: string[];
  /** 需要人工对着原图再核的说明；有值则不得当已终审 */
  reviewNote?: string;
};

export type PipeSegment = {
  id: string;
  lane: Lane;
  /** 位号中心线折线（占位坐标，M2 再换成真实挤出） */
  centerline: [number, number, number][];
  fromTag: string;
  toTag: string;
};

function n(
  tag: string,
  kind: NodeKind,
  lane: Lane,
  upstream: string[],
  downstream: string[],
  reviewNote?: string,
): TopologyNode {
  return { tag, kind, lane, upstream, downstream, ...(reviewNote ? { reviewNote } : {}) };
}

/** 全部设备节点（主键 = tag = HG-*） */
export const TOPOLOGY_NODES: TopologyNode[] = [
  // —— 上路 / 埃尔斯特 ——
  n('HG-HOV10111', 'HOV', 'elster', [], ['HG-FS-101']),
  n('HG-FS-101', 'FS', 'elster', ['HG-HOV10111'], ['HG-UF-101']),
  n('HG-UF-101', 'UF', 'elster', ['HG-FS-101'], ['HG-MOV10112']),
  n('HG-MOV10112', 'MOV', 'elster', ['HG-UF-101'], ['HG-HOV10114']),
  n('HG-HOV10114', 'HOV', 'elster', ['HG-MOV10112'], ['HG-MOV10211']),
  n('HG-MOV10211', 'MOV', 'elster', ['HG-HOV10114'], ['HG-SSV10212']),
  n('HG-SSV10212', 'SSV', 'elster', ['HG-MOV10211'], ['HG-PCV10213']),
  n('HG-PCV10213', 'PCV', 'elster', ['HG-SSV10212'], ['HG-PV10214']),
  n('HG-PV10214', 'PV', 'elster', ['HG-PCV10213'], ['HG-PV10215']),
  n('HG-PV10215', 'PV', 'elster', ['HG-PV10214'], ['HG-MOV10311']),

  // —— 下路 / 中核维思（不对称：末为 PV + MOV，不是双 PV）——
  n('HG-HOV10121', 'HOV', 'weisi', [], ['HG-FS-102']),
  n('HG-FS-102', 'FS', 'weisi', ['HG-HOV10121'], ['HG-UF-102']),
  n(
    'HG-UF-102',
    'UF',
    'weisi',
    ['HG-FS-102'],
    ['HG-MOV10122'],
    '柜铭牌确认 UF-102；画布下路该位置 OCR 不稳定，canvas 坐标待人工核图。',
  ),
  n(
    'HG-MOV10122',
    'MOV',
    'weisi',
    ['HG-UF-102'],
    ['HG-MOV10221'],
    '图一 OCR 出现两次：冻结为单台；若原图旁另有设备须人工增补，禁止凭空复制。',
  ),
  n('HG-MOV10221', 'MOV', 'weisi', ['HG-MOV10122'], ['HG-SSV10222']),
  n('HG-SSV10222', 'SSV', 'weisi', ['HG-MOV10221'], ['HG-PCV10223']),
  n('HG-PCV10223', 'PCV', 'weisi', ['HG-SSV10222'], ['HG-PV10224']),
  n('HG-PV10224', 'PV', 'weisi', ['HG-PCV10223'], ['HG-MOV10225']),
  n(
    'HG-MOV10225',
    'MOV',
    'weisi',
    ['HG-PV10224'],
    ['HG-HOV10321'],
    '下路不对称差异位：上路对应为第二只 PV(HG-PV10215)，此处保持 MOV。',
  ),
  n('HG-HOV10321', 'HOV', 'weisi', ['HG-MOV10225'], ['HG-MOV10311']),

  // —— 出口汇管 / 去孝感恒光 ——
  n('HG-MOV10311', 'MOV', 'common', ['HG-PV10215', 'HG-HOV10321'], ['HG-HOV10312']),
  n('HG-HOV10312', 'HOV', 'common', ['HG-MOV10311'], []),
];

function seg(
  id: string,
  lane: Lane,
  fromTag: string,
  toTag: string,
  centerline: [number, number, number][],
): PipeSegment {
  return { id, lane, fromTag, toTag, centerline };
}

/** 管段（中心线占位；lane 归属明确） */
export const PIPE_SEGMENTS: PipeSegment[] = [
  seg('elster-in', 'elster', 'HG-HOV10111', 'HG-FS-101', [
    [0, 2, 0],
    [1, 2, 0],
  ]),
  seg('elster-fs-uf', 'elster', 'HG-FS-101', 'HG-UF-101', [
    [1, 2, 0],
    [2, 2, 0],
  ]),
  seg('elster-uf-mov', 'elster', 'HG-UF-101', 'HG-MOV10112', [
    [2, 2, 0],
    [3, 2, 0],
  ]),
  seg('elster-mov-hov', 'elster', 'HG-MOV10112', 'HG-HOV10114', [
    [3, 2, 0],
    [4, 2, 0],
  ]),
  seg('elster-reg', 'elster', 'HG-HOV10114', 'HG-PV10215', [
    [4, 2, 0],
    [5, 2, 0],
    [6, 2, 0],
    [7, 2, 0],
    [8, 2, 0],
    [9, 2, 0],
  ]),
  seg('elster-to-outlet', 'elster', 'HG-PV10215', 'HG-MOV10311', [
    [9, 2, 0],
    [10, 1, 0],
  ]),
  seg('weisi-in', 'weisi', 'HG-HOV10121', 'HG-FS-102', [
    [0, 0, 0],
    [1, 0, 0],
  ]),
  seg('weisi-fs-uf', 'weisi', 'HG-FS-102', 'HG-UF-102', [
    [1, 0, 0],
    [2, 0, 0],
  ]),
  seg('weisi-uf-mov', 'weisi', 'HG-UF-102', 'HG-MOV10122', [
    [2, 0, 0],
    [3, 0, 0],
  ]),
  seg('weisi-reg', 'weisi', 'HG-MOV10122', 'HG-MOV10225', [
    [3, 0, 0],
    [4, 0, 0],
    [5, 0, 0],
    [6, 0, 0],
    [7, 0, 0],
    [8, 0, 0],
    [9, 0, 0],
  ]),
  seg('weisi-hov', 'weisi', 'HG-MOV10225', 'HG-HOV10321', [
    [9, 0, 0],
    [9.5, 0, 0],
  ]),
  seg('weisi-to-outlet', 'weisi', 'HG-HOV10321', 'HG-MOV10311', [
    [9.5, 0, 0],
    [10, 1, 0],
  ]),
  seg('common-out', 'common', 'HG-MOV10311', 'HG-HOV10312', [
    [10, 1, 0],
    [12, 1, 0],
  ]),
];

export const TOPOLOGY_BY_TAG: ReadonlyMap<string, TopologyNode> = new Map(
  TOPOLOGY_NODES.map((node) => [node.tag, node]),
);

/** 下路不对称差异位：必须存在，且不得被改成 PV */
export const ASYMMETRIC_WEISI_TAIL_TAG = 'HG-MOV10225';
export const ASYMMETRIC_ELSTER_TAIL_TAG = 'HG-PV10215';

export function listReviewNodes(): TopologyNode[] {
  return TOPOLOGY_NODES.filter((node) => Boolean(node.reviewNote));
}
