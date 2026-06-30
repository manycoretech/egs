import { BufferGeometry } from '../containers/BufferGeometry.js';
import type { Nullable } from '../../../utils/Utils.js';
import { logger } from '../../../utils/Logger.js';
import { BufferAttribute } from '../../attributes/BufferAttribute.js';

/**
 * Return a non-index version of an indexed BufferGeometry.
 */
export function createNoneIndexed(geometry: BufferGeometry): Nullable<BufferGeometry> {
    if (geometry.index === null) {
        logger.invalidInput('EGS.BufferGeometry.toNonIndexed(): Geometry is already non-indexed.');
        return null;
    }

    const geometry2 = new BufferGeometry();
    const attributes = geometry.getAttributes();
    const indices = geometry.index.array;

    for (const name in attributes) {
        const attribute = attributes[name];
        const array = attribute.array as any;
        const itemSize = attribute.itemSize;
        const array2 = new array.constructor(indices.length * itemSize);
        let index = 0;
        let index2 = 0;
        for (let i = 0, l = indices.length; i < l; i++) {
            index = indices[i] * itemSize;
            for (let j = 0; j < itemSize; j++) {
                array2[index2++] = array[index++];
            }
        }
        geometry2.addAttribute(name, new BufferAttribute(array2, itemSize));
    }

    const groups = geometry.getGroups().slice();
    geometry2.setGroups(groups);
    return geometry2;
}
