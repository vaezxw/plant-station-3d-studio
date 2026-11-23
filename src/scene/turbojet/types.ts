export type TurbojetGroup = 'rotor' | 'stator' | 'casing' | 'plumbing' | 'assembly';

export type TurbojetPartMap = {
  partId: string;
  name: string;
  group: string;
  labelZh: string;
  rest: number[];
  explode: number[];
};

export type TurbojetMapping = {
  engine: string;
  monitorOnly: boolean;
  spin: { nodeName: string; axis: number[] };
  clip: { planeNormal: number[]; constant: number; groups: string[] };
  parts: TurbojetPartMap[];
};

export const TURBOJET_GLB_URL = '/assets/turbojet/turbojet.glb';
export const TURBOJET_MAP_URL = '/assets/turbojet/turbojet-mapping.json';
