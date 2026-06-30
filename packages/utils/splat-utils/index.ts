export { computeDenseBox } from './utils.js';
export {
    createSplat,
    createSplatData,
    createSplatModifyData,
    combineSplatData,
    transformSplatFile,
} from './SplatData.js';
export { SplatOperator } from './SplatOperator.js';
export { type LodMeta, type LodConfig, LodSplat } from './lod/index.js';

export { type BVHSource, type BVHNode, BVH } from '@qunhe/egs-lib';
export { type SplatCenterPrimitive, SplatCenterPrimitiveSource } from './SplatCenterSource.js';
export { type SplatEllipsoidPrimitive, SplatEllipsoidPrimitiveSource } from './SplatEllipsoidSource.js';

import { __INTERNAL__ } from '@qunhe/egs';
import { sortSplats } from './sort.js';
__INTERNAL__?.setSortSplats(sortSplats);
