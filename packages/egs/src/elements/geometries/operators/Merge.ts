import { BufferGeometry, type BufferRange } from '../containers/BufferGeometry';
import { logger } from '../../../utils/Logger';
import { BufferAttribute } from '../../attributes/BufferAttribute';
import { Matrix4 } from '../../../math/Matrix4';
import { Matrix3 } from '../../../math/Matrix3';

export interface BufferGeometryMergeInfo {
    geometry: BufferGeometry,
    worldMatrix: Matrix4,
}

const normalMatrix = new Matrix3();
export function mergeBufferGeometries(geometries: BufferGeometry[], useGroups: boolean, matrix: Matrix4[]): BufferGeometry {
    return mergeBufferGeometries2(geometries, useGroups, matrix)?.geometry;
}

/**
 * merge given buffer geometries into one
 * @returns merged geometries & each geometry's range in merged geometry(same index as input)
 */
export function mergeBufferGeometries2(geometries: BufferGeometry[], useGroups: boolean, matrix: Matrix4[]): { // TODO: null type
    geometry: BufferGeometry,
    ranges: BufferRange[][];
} {
    const isIndexed = geometries[0].index !== null;
    const attributesUsed = new Set(Object.keys(geometries[0].getAttributes()));

    const attributes: Record<string, BufferAttribute[]> = {};
    const mergedGeometry = new BufferGeometry();
    const ranges: BufferRange[][] = [];

    ranges.length = geometries.length;

    let offset = 0;

    for (let i = 0; i < geometries.length; ++i) {
        const currentRanges: BufferRange[] = [];
        let count = 0;
        ranges[i] = currentRanges;
        const geometry = geometries[i];
        let attributesCount = 0;

        // ensure that all geometries are indexed, or none

        if (isIndexed !== (geometry.index !== null)) {
            logger.unsupported('mergeBufferGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.');
            return null!;
        }

        if (isIndexed) {
            count = geometry.index!.count;
        } else if (geometry.getAttributes().position !== undefined) {
            count = geometry.getAttributes().position.count;
        } else {
            logger.unsupported('mergeBufferGeometries() failed with geometry at index ' + i + '. The geometry must have either an index or a position attribute');
            return null!;
        }

        // gather attributes, exit early if they're different

        for (const name in geometry.getAttributes()) {
            if (!attributesUsed.has(name)) {
                logger.unsupported('mergeBufferGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.');
                return null!;
            }

            if (attributes[name] === undefined) {
                attributes[name] = [];
            }
            attributes[name].push(geometry.getAttributes()[name]);
            attributesCount++;
        }

        // ensure geometries have the same number of attributes

        if (attributesCount !== attributesUsed.size) {
            logger.unsupported('mergeBufferGeometries() failed with geometry at index ' + i + '. Make sure all geometries have the same number of attributes.');
            return null!;
        }

        currentRanges.push({
            start: offset,
            count
        });

        if (useGroups) {
            mergedGeometry.addGroup(offset, count, i);
        }

        offset += count;
    }

    // merge indices

    if (isIndexed) {
        let indexOffset = 0;
        const mergedIndex = [];
        for (let i = 0; i < geometries.length; ++i) {
            const index = geometries[i].index!.array;
            for (let j = 0; j < index.length; ++j) {
                mergedIndex.push(index[j] + indexOffset);
            }
            indexOffset += geometries[i].getAttributes().position.count;
        }
        mergedGeometry.setIndex(mergedIndex);
    }

    // merge attributes
    for (const name in attributes) {
        let mergedAttribute;
        if (name === 'position' && matrix !== undefined) {
            mergedAttribute = mergeBufferAttributes(attributes[name].map((b, i) => matrix[i].applyToBufferAttribute(b.clone())));
        } else if (name === 'normal' && matrix !== undefined) {
            mergedAttribute = mergeBufferAttributes(attributes[name].map((b, i) => normalMatrix.getNormalMatrix(matrix[i]).applyToBufferAttribute(b.clone())));
        } else {
            mergedAttribute = mergeBufferAttributes(attributes[name]);
        }
        if (!mergedAttribute) {
            logger.unsupported('mergeBufferGeometries() failed while trying to merge the ' + name + ' attribute.');
            return null!;
        }
        mergedGeometry.setAttribute(name, mergedAttribute);
    }

    return {
        geometry: mergedGeometry,
        ranges
    };
}

function mergeBufferAttributes(attributes: BufferAttribute[]) {
    let TypedArray: any;
    let itemSize: number | undefined;
    let arrayLength = 0;

    for (let i = 0; i < attributes.length; ++i) {
        const attribute = attributes[i];

        if (TypedArray === undefined) {
            TypedArray = attribute.array.constructor;
        }
        if (TypedArray !== attribute.array.constructor) {
            logger.unsupported('mergeBufferAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.');
            return null;
        }

        if (itemSize === undefined) {
            itemSize = attribute.itemSize;
        }
        if (itemSize !== attribute.itemSize) {
            logger.unsupported('mergeBufferAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.');
            return null;
        }

        arrayLength += attribute.array.length;
    }

    const array = new TypedArray!(arrayLength);
    let offset = 0;

    for (let i = 0; i < attributes.length; ++i) {
        array.set(attributes[i].array, offset);
        offset += attributes[i].array.length;
    }

    return new BufferAttribute(array, itemSize || 1);
}

/**
 * Combine all {@link attributes| attributes} of external geometry and this geometry.
 * @param {BufferGeometry} geometry all attributes of this geometry will be moved.
 * @param {number} offset the begin position to store data,
 * only the data in 0-offset*{@link BufferAttribute.itemSize| itemSize } of {@link BufferAttribute.array| array } can be retain.
 */
export function mergeTheOtherIntoSelf(me: BufferGeometry, geometry: BufferGeometry, offset: number): void {
    const attributes = me.getAttributes();

    for (const key in attributes) {
        if (geometry.getAttribute(key) === undefined) {
            continue;
        }
        const attribute1 = attributes[key];
        const attributeArray1 = attribute1.array;

        const attribute2 = geometry.getAttribute(key)!;
        const attributeArray2 = attribute2.array;

        const attributeSize = attribute2.itemSize;

        for (let i = 0, j = attributeSize * offset; i < attributeArray2.length; i++, j++) {
            attributeArray1[j] = attributeArray2[i];
        }

    }
}
