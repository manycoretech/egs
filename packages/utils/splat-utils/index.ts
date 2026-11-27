export { computeDenseBox } from './utils.js';
export { readbackStream } from './readback.js';
export {
    createSplat,
    createSplatData,
    createSplatModifyData,
    combineSplatData,
    transformSplatFile,
} from './SplatData.js';
export { SplatOperator } from './SplatOperator.js';
export { type LodMeta, type LodConfig, type LodVoxelData, type ParseLodVoxelFn, LodSplat } from './lod/index.js';

export { type BVHSource, type BVHNode, BVH } from '@qunhe/egs-lib';
export { type SplatCenterPrimitive, SplatCenterPrimitiveSource } from './SplatCenterSource.js';
export { type SplatEllipsoidPrimitive, SplatEllipsoidPrimitiveSource } from './SplatEllipsoidSource.js';

import { __INTERNAL__ } from '@qunhe/egs';
import { WorkerSplatSorter } from './sort.js';
__INTERNAL__?.setSplatSorter(new WorkerSplatSorter());
