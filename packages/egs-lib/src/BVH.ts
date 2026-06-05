export interface PrimitiveBuffers {
    count: number;
    indices: Uint32Array; // current idx -> source idx
    centers: Float32Array; // x,y,z packed
    boxMins: Float32Array; // x,y,z packed
    boxMaxs: Float32Array; // x,y,z packed
}

export interface BVHSource<TPrimitive> {
    build(): PrimitiveBuffers;

    createEmpty(): TPrimitive;
    get(localIdx: number, primitive: TPrimitive): void;
}

export enum IntersectContainment {
    Outside = 0,
    Intersect = 1,
    Inside = 2,
}

export interface BVHNode {
    boxMin: [number, number, number];
    boxMax: [number, number, number];
    left: number;
    right: number;
    parent: number;
    start: number;
    end: number;
    isLeaf: boolean;
}

interface BuildTask {
    start: number;
    end: number;
    parent: number;
    isLeft: boolean;
}

/**
 * BVH over source-provided primitive bounds in model space.
 */
export class BVH<TPrimitive> {
    private source: BVHSource<TPrimitive>;
    private maxLeafSize: number;
    private nodes: BVHNode[] = [];
    private sorted: Uint32Array;
    private indices: Uint32Array;

    constructor(source: BVHSource<TPrimitive>, maxLeafSize: number = 16) {
        this.source = source;
        this.maxLeafSize = maxLeafSize;
        this.build();
    }

    build() {
        const { source, maxLeafSize } = this;
        const { count, indices, centers, boxMins, boxMaxs } = source.build();
        const sorted = new Uint32Array(count);
        const nodes: BVHNode[] = [];

        if (count === 0) {
            nodes.push({
                boxMin: [0, 0, 0],
                boxMax: [0, 0, 0],
                left: -1,
                right: -1,
                parent: -1,
                start: 0,
                end: 0,
                isLeaf: true,
            });
            this.nodes = nodes;
            this.sorted = sorted;
            this.indices = indices;
            return;
        }

        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        for (let i = 0; i < count; i++) {
            sorted[i] = i;
            const i3 = i * 3;
            const x = centers[i3 + 0];
            const y = centers[i3 + 1];
            const z = centers[i3 + 2];
            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (z < minZ) {
                minZ = z;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (z > maxZ) {
                maxZ = z;
            }
        }

        const scaleX = 1023 / Math.max(maxX - minX, 1e-9);
        const scaleY = 1023 / Math.max(maxY - minY, 1e-9);
        const scaleZ = 1023 / Math.max(maxZ - minZ, 1e-9);

        const mortons = new Uint32Array(count);
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const x = centers[i3 + 0];
            const y = centers[i3 + 1];
            const z = centers[i3 + 2];
            mortons[i] = morton3D(((x - minX) * scaleX) | 0, ((y - minY) * scaleY) | 0, ((z - minZ) * scaleZ) | 0);
        }
        radixSort(mortons, sorted);

        function findSplit(start: number, end: number) {
            const startCode = mortons[start];
            const endCode = mortons[end];
            if (startCode === endCode) {
                return start + (((end - start + 1) / 2) | 0);
            }

            const commonPrefix = lcp(startCode, endCode);
            let low = start;
            let high = end;
            while (low < high) {
                const mid = ((low + high) / 2) | 0;
                const leftLcp = lcp(startCode, mortons[mid]);
                if (leftLcp > commonPrefix) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }
            return low;
        }

        const stack: BuildTask[] = [{ start: 0, end: count, parent: -1, isLeft: true }];
        while (stack.length > 0) {
            const { start, end, parent, isLeft } = stack.pop()!;

            const idx = nodes.length;
            const isLeaf = end <= start + maxLeafSize;
            if (!isLeaf) {
                const split = findSplit(start, end - 1);
                stack.push(
                    { start: split, end, parent: idx, isLeft: false },
                    { start, end: split, parent: idx, isLeft: true },
                );
            }

            nodes.push({
                boxMin: [Infinity, Infinity, Infinity],
                boxMax: [-Infinity, -Infinity, -Infinity],
                left: -1,
                right: -1,
                parent,
                start,
                end,
                isLeaf,
            });

            if (parent === -1) {
                continue;
            }

            const pNode = nodes[parent];
            if (isLeft) {
                pNode.left = idx;
            } else {
                pNode.right = idx;
            }
        }

        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const { boxMin, boxMax } = node;
            if (!node.isLeaf) {
                const { boxMin: lnMin, boxMax: lnMax } = nodes[node.left];
                const { boxMin: rnMin, boxMax: rnMax } = nodes[node.right];
                boxMin[0] = lnMin[0] < rnMin[0] ? lnMin[0] : rnMin[0];
                boxMin[1] = lnMin[1] < rnMin[1] ? lnMin[1] : rnMin[1];
                boxMin[2] = lnMin[2] < rnMin[2] ? lnMin[2] : rnMin[2];
                boxMax[0] = lnMax[0] > rnMax[0] ? lnMax[0] : rnMax[0];
                boxMax[1] = lnMax[1] > rnMax[1] ? lnMax[1] : rnMax[1];
                boxMax[2] = lnMax[2] > rnMax[2] ? lnMax[2] : rnMax[2];
                continue;
            }

            minX = Infinity;
            minY = Infinity;
            minZ = Infinity;
            maxX = -Infinity;
            maxY = -Infinity;
            maxZ = -Infinity;
            const { start, end } = node;
            for (let j = start; j < end; j++) {
                const offset = sorted[j] * 3;
                const boxMinX = boxMins[offset + 0];
                const boxMinY = boxMins[offset + 1];
                const boxMinZ = boxMins[offset + 2];
                const boxMaxX = boxMaxs[offset + 0];
                const boxMaxY = boxMaxs[offset + 1];
                const boxMaxZ = boxMaxs[offset + 2];
                if (boxMinX < minX) {
                    minX = boxMinX;
                }
                if (boxMinY < minY) {
                    minY = boxMinY;
                }
                if (boxMinZ < minZ) {
                    minZ = boxMinZ;
                }
                if (boxMaxX > maxX) {
                    maxX = boxMaxX;
                }
                if (boxMaxY > maxY) {
                    maxY = boxMaxY;
                }
                if (boxMaxZ > maxZ) {
                    maxZ = boxMaxZ;
                }
            }
            boxMin[0] = minX;
            boxMin[1] = minY;
            boxMin[2] = minZ;
            boxMax[0] = maxX;
            boxMax[1] = maxY;
            boxMax[2] = maxZ;
        }

        this.nodes = nodes;
        this.sorted = sorted;
        this.indices = indices;
    }

    getBBox3() {
        const { boxMin, boxMax } = this.nodes[0];
        return { boxMin, boxMax };
    }

    search(
        intersectNode: (node: BVHNode) => IntersectContainment,
        intersectPrimitive: (primitive: TPrimitive) => boolean,
    ): number[] {
        const { nodes, indices, sorted, source } = this;
        const primitive = source.createEmpty();
        const result: number[] = [];
        const stack: number[] = [0];
        while (stack.length > 0) {
            const nodeIdx = stack.pop()!;
            const node = nodes[nodeIdx];
            const containment = intersectNode(node);
            if (containment === IntersectContainment.Outside) {
                continue;
            } else if (containment === IntersectContainment.Inside) {
                const { start, end } = node;
                for (let i = start; i < end; i++) {
                    result.push(indices[sorted[i]]);
                }
                continue;
            }
            if (!node.isLeaf) {
                stack.push(node.left, node.right);
                continue;
            }

            const { start, end } = node;
            for (let i = start; i < end; i++) {
                const idx = sorted[i];
                source.get(idx, primitive);
                if (intersectPrimitive(primitive)) {
                    result.push(indices[idx]);
                }
            }
        }

        return result;
    }
}

function lcp(a: number, b: number) {
    return a === b ? 32 : Math.clz32(a ^ b);
}

const EXPAND_TABLE = new Uint32Array(1024);
for (let i = 0; i < 1024; i++) {
    let x = i;
    x = (x | (x << 16)) & 0x30000ff;
    x = (x | (x << 8)) & 0x300f00f;
    x = (x | (x << 4)) & 0x30c30c3;
    x = (x | (x << 2)) & 0x9249249;
    EXPAND_TABLE[i] = x >>> 0;
}
function morton3D(x: number, y: number, z: number): number {
    return (EXPAND_TABLE[z] << 2) | (EXPAND_TABLE[y] << 1) | EXPAND_TABLE[x];
}

const bucket = new Uint32Array(1 << 16);
function countingSort16(
    srcKeys: Uint32Array,
    srcIdx: Uint32Array,
    dstKeys: Uint32Array,
    dstIdx: Uint32Array,
    shift: number,
) {
    bucket.fill(0);
    const n = srcKeys.length;
    const mask = 0xffff;
    for (let i = 0; i < n; i++) {
        bucket[(srcKeys[i] >>> shift) & mask]++;
    }
    let sum = 0;
    for (let i = 0; i < bucket.length; i++) {
        const c = bucket[i];
        bucket[i] = sum;
        sum += c;
    }
    for (let i = 0; i < n; i++) {
        const key = srcKeys[i];
        const b = (key >>> shift) & mask;
        const pos = bucket[b]++;
        dstKeys[pos] = key;
        dstIdx[pos] = srcIdx[i];
    }
}

function radixSort(keys: Uint32Array, indices: Uint32Array) {
    const n = keys.length;
    const tmpKeys = new Uint32Array(n);
    const tmpIdx = new Uint32Array(n);
    countingSort16(keys, indices, tmpKeys, tmpIdx, 0);
    countingSort16(tmpKeys, tmpIdx, keys, indices, 16);
}
