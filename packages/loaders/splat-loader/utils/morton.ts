import type { SplatData } from '../splat/SplatData.js';
import { createSingleSplat } from './splat.js';

const MORTON_EXPAND_TABLE = new Uint32Array(1024);
for (let i = 0; i < MORTON_EXPAND_TABLE.length; i++) {
    let value = i;
    value = (value ^ (value << 16)) & 0xff0000ff;
    value = (value ^ (value << 8)) & 0x0300f00f;
    value = (value ^ (value << 4)) & 0x030c30c3;
    MORTON_EXPAND_TABLE[i] = (value ^ (value << 2)) & 0x09249249;
}

function radixSort(indices: Uint32Array, codes: Uint32Array, scratch: Uint32Array, buckets: Uint32Array) {
    let source = indices;
    let target = scratch.subarray(0, indices.length);
    for (let shift = 0; shift < 30; shift += 10) {
        buckets.fill(0);
        for (let i = 0; i < source.length; i++) {
            buckets[(codes[source[i]] >>> shift) & 1023]++;
        }
        let offset = 0;
        for (let i = 0; i < buckets.length; i++) {
            const count = buckets[i];
            buckets[i] = offset;
            offset += count;
        }
        for (let i = 0; i < source.length; i++) {
            const index = source[i];
            target[buckets[(codes[index] >>> shift) & 1023]++] = index;
        }
        const swap = source;
        source = target;
        target = swap;
    }
    // Three passes leave the sorted indices in scratch.
    indices.set(source);
}

function createMortonOrder(splat: SplatData, workspace: Uint32Array): Uint32Array {
    const { counts } = splat;
    const order = new Uint32Array(counts);
    const mortonCodes = workspace.subarray(0, counts);
    const scratch = workspace.subarray(counts, counts * 2);
    const buckets = new Uint32Array(1024);
    const center = createSingleSplat();

    for (let i = 0; i < counts; i++) {
        order[i] = i;
    }

    const sortBucket = (indices: Uint32Array) => {
        if (indices.length === 0) {
            return;
        }

        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        for (let i = 0; i < indices.length; i++) {
            splat.getCenter(indices[i], center);
            const { x, y, z } = center;
            if (x < minX) {
                minX = x;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (z < minZ) {
                minZ = z;
            }
            if (z > maxZ) {
                maxZ = z;
            }
        }
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const rangeZ = maxZ - minZ;
        if (!isFinite(rangeX) || !isFinite(rangeY) || !isFinite(rangeZ)) {
            return;
        }
        if (rangeX === 0 && rangeY === 0 && rangeZ === 0) {
            return;
        }
        const scaleX = rangeX === 0 ? 0 : 1024 / rangeX;
        const scaleY = rangeY === 0 ? 0 : 1024 / rangeY;
        const scaleZ = rangeZ === 0 ? 0 : 1024 / rangeZ;

        for (let i = 0; i < indices.length; i++) {
            splat.getCenter(indices[i], center);
            const x = Math.min(1023, (center.x - minX) * scaleX) >>> 0;
            const y = Math.min(1023, (center.y - minY) * scaleY) >>> 0;
            const z = Math.min(1023, (center.z - minZ) * scaleZ) >>> 0;
            mortonCodes[indices[i]] =
                MORTON_EXPAND_TABLE[x] | (MORTON_EXPAND_TABLE[y] << 1) | (MORTON_EXPAND_TABLE[z] << 2);
        }

        radixSort(indices, mortonCodes, scratch, buckets);

        // Refine large same-code buckets using their local bounds.
        for (let start = 0; start < indices.length;) {
            const code = mortonCodes[indices[start]];
            let end = start + 1;
            while (end < indices.length && mortonCodes[indices[end]] === code) {
                end++;
            }
            if (end - start > 256) {
                sortBucket(indices.subarray(start, end));
            }
            start = end;
        }
    };

    sortBucket(order);
    return order;
}

export function sortSplatData(splat: SplatData) {
    const { counts, samplers } = splat.serialize();
    const workspace = new Uint32Array(Math.max(counts * 2, ...samplers.map(sampler => sampler.source.byteLength / 4)));
    const order = createMortonOrder(splat, workspace);

    for (const { source, width, height, depth } of samplers) {
        if (!source.byteLength) {
            continue;
        }
        const words = new Uint32Array(source.buffer, source.byteOffset, source.byteLength / 4);
        const stride = words.length / (width * height * depth);
        if (stride === 1) {
            for (let i = 0; i < counts; i++) {
                workspace[i] = words[order[i]];
            }
        } else {
            for (let i = 0; i < counts; i++) {
                const offset = order[i] * stride;
                for (let j = 0; j < stride; j++) {
                    workspace[i * stride + j] = words[offset + j];
                }
            }
        }
        words.set(workspace.subarray(0, counts * stride));
    }
}
