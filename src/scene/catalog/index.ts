export {
  CATALOG_CATEGORIES,
  DEVICE_CATALOG,
  INDUSTRIAL_GLB_KINDS,
  catalogEntry,
  catalogPlaceY,
  isCatalogKind,
  isNodeKind,
  isPlaceableCatalogKind,
  isTurbojetKind,
  type CatalogCategory,
  type CatalogKind,
  type DeviceCatalogEntry,
} from './types';
export {
  buildCatalogMesh,
  buildFlangeDisk,
  defaultColorForKind,
  labelOffsetY,
} from './meshes';
export {
  cloneGlbTemplate,
  hasGlbTemplate,
  listLoadedGlbKinds,
  preloadCatalogGlbs,
  registerGlbForKind,
  subscribeGlbCatalog,
} from './glbCatalog';
export { syncLine2Resolution } from './annotationLines';
