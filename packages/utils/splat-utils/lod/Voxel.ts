import { Box3, Frustum, Matrix4, Vector3, Vector4 } from '@qunhe/egs';

/** Original voxel metadata and a zero-copy view of the binary, in LOD-local coordinates. */
export interface LodVoxelData {
    gridBounds: { min: [number, number, number]; max: [number, number, number] };
    voxelResolution: number;
    leafSize: number;
    treeDepth: number;
    nodeCount: number;
    leafDataCount: number;
    /** Node words followed by leaf bitmap words; no decoded tree or per-voxel objects. */
    buffer: Uint32Array;
}

/** Return valid raw octree data whose bounds, depth and offsets match its buffer. */
export type ParseLodVoxelFn = (url: string, signal: AbortSignal) => LodVoxelData | Promise<LodVoxelData>;

const SOLID_NODE = 0xff000000;
const INDEX_MASK = 0x00ffffff;
const GRID_SIZE = 128;
// The same grid samples in coarse-to-fine order, so a gap can end a query early.
const SAMPLE_ORDER = new Uint16Array(GRID_SIZE * GRID_SIZE);
for (let i = 0; i < SAMPLE_ORDER.length; i++) {
    let x = 0,
        y = 0;
    for (let bit = 0; bit < 7; bit++) {
        x |= ((i >>> (bit * 2)) & 1) << (6 - bit);
        y |= ((i >>> (bit * 2 + 1)) & 1) << (6 - bit);
    }
    SAMPLE_ORDER[i] = y * GRID_SIZE + x;
}

export function validateVoxel(data: LodVoxelData) {
    if (data.leafSize !== 4) {
        throw new Error('LOD voxel data requires 4x4x4 leaves.');
    }
    if (data.buffer.length < data.nodeCount + data.leafDataCount) {
        throw new Error('LOD voxel buffer is truncated.');
    }
}

function popcount(value: number) {
    value -= (value >>> 1) & 0x55555555;
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
    return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** First occupied-voxel ray parameter, or Infinity on a miss; direction need not be normalized. */
export function raycastVoxel(data: LodVoxelData, origin: Vector3, direction: Vector3, maxDistance = Infinity) {
    const {
        buffer,
        gridBounds: { min, max },
        voxelResolution: resolution,
        nodeCount,
        treeDepth,
    } = data;
    if (!nodeCount) {
        return Infinity;
    }
    let near = 0;
    let far = maxDistance;
    for (let axis = 0; axis < 3; axis++) {
        const o = origin.getComponent(axis);
        const d = direction.getComponent(axis);
        if (d === 0) {
            if (o < min[axis] || o >= max[axis]) {
                return Infinity;
            }
        } else {
            const a = (min[axis] - o) / d;
            const b = (max[axis] - o) / d;
            near = Math.max(near, Math.min(a, b));
            far = Math.min(far, Math.max(a, b));
        }
    }
    if (!(near < far)) {
        return Infinity;
    }
    const sizeX = Math.round((max[0] - min[0]) / resolution);
    const sizeY = Math.round((max[1] - min[1]) / resolution);
    const sizeZ = Math.round((max[2] - min[2]) / resolution);
    const { x: ox, y: oy, z: oz } = origin;
    const { x: dx, y: dy, z: dz } = direction;
    const cell = (position: number, direction: number) =>
        direction < 0 ? Math.ceil(position) - 1 : Math.floor(position);
    let x = Math.max(0, Math.min(sizeX - 1, cell((ox + dx * near - min[0]) / resolution, dx)));
    let y = Math.max(0, Math.min(sizeY - 1, cell((oy + dy * near - min[1]) / resolution, dy)));
    let z = Math.max(0, Math.min(sizeZ - 1, cell((oz + dz * near - min[2]) / resolution, dz)));
    let leafX = -1,
        leafY = -1,
        leafZ = -1;
    let lowerBits = 0,
        upperBits = 0;
    while (near < far && x >= 0 && y >= 0 && z >= 0 && x < sizeX && y < sizeY && z < sizeZ) {
        const blockX = x >>> 2,
            blockY = y >>> 2,
            blockZ = z >>> 2;
        let inLeaf = blockX === leafX && blockY === leafY && blockZ === leafZ;
        let emptySize = 1;
        if (!inLeaf) {
            let index = 0;
            for (let level = treeDepth; level >= 0; level--) {
                const node = buffer[index];
                if (node === SOLID_NODE) {
                    return near;
                }
                const mask = node >>> 24;
                if (!mask) {
                    const word = (node & INDEX_MASK) * 2;
                    // A ray crosses several cells of the same leaf; read its two words only once.
                    leafX = blockX;
                    leafY = blockY;
                    leafZ = blockZ;
                    lowerBits = buffer[nodeCount + word];
                    upperBits = buffer[nodeCount + word + 1];
                    inLeaf = true;
                    break;
                }
                const shift = level + 1;
                const octant = ((x >>> shift) & 1) | (((y >>> shift) & 1) << 1) | (((z >>> shift) & 1) << 2);
                if (!(mask & (1 << octant))) {
                    // Skip the entire missing child directly in the original octree.
                    emptySize = 2 ** shift;
                    break;
                }
                index = (node & INDEX_MASK) + popcount(mask & ((1 << octant) - 1));
            }
        }
        const bit = ((z & 3) << 4) | ((y & 3) << 2) | (x & 3);
        if (inLeaf && ((bit < 32 ? lowerBits : upperBits) >>> (bit & 31)) & 1) {
            return near;
        }
        const boundaryX = (Math.floor(x / emptySize) + (dx > 0 ? 1 : 0)) * emptySize;
        const boundaryY = (Math.floor(y / emptySize) + (dy > 0 ? 1 : 0)) * emptySize;
        const boundaryZ = (Math.floor(z / emptySize) + (dz > 0 ? 1 : 0)) * emptySize;
        const tx = dx === 0 ? Infinity : (min[0] + boundaryX * resolution - ox) / dx;
        const ty = dy === 0 ? Infinity : (min[1] + boundaryY * resolution - oy) / dy;
        const tz = dz === 0 ? Infinity : (min[2] + boundaryZ * resolution - oz) / dz;
        const next = Math.min(tx, ty, tz);
        if (!(next > near) || next >= far) {
            return Infinity;
        }
        // Advance all tied axes, avoiding zero-length hits at shared edges and corners.
        const epsilon = Number.EPSILON * 8 * Math.max(1, Math.abs(next));
        x = tx - next <= epsilon ? boundaryX - (dx < 0 ? 1 : 0) : cell((ox + dx * next - min[0]) / resolution, dx);
        y = ty - next <= epsilon ? boundaryY - (dy < 0 ? 1 : 0) : cell((oy + dy * next - min[1]) / resolution, dy);
        z = tz - next <= epsilon ? boundaryZ - (dz < 0 ? 1 : 0) : cell((oz + dz * next - min[2]) / resolution, dz);
        near = next;
    }
    return Infinity;
}

/** Sampled occlusion, retaining detail wherever rays miss or the block crosses the near plane. */
export function computeVoxelOcclusion(
    voxels: readonly LodVoxelData[],
    boxes: readonly (Box3 | undefined)[],
    viewProjection: Matrix4,
) {
    const result = new Uint8Array(boxes.length);
    if (!voxels.length) {
        return result;
    }
    const inverse = new Matrix4().getInverse(viewProjection, true);
    const frustum = new Frustum().setFromMatrix(viewProjection);
    const voxelBox = new Box3();
    const active = voxels.filter(voxel => {
        voxelBox.min.fromArray(voxel.gridBounds.min);
        voxelBox.max.fromArray(voxel.gridBounds.max);
        return frustum.intersectsBox(voxelBox);
    });
    if (!active.length) {
        return result;
    }
    const hitDepths = new Float64Array(GRID_SIZE * GRID_SIZE).fill(Infinity);
    const clearDepths = new Float64Array(GRID_SIZE * GRID_SIZE).fill(-Infinity);
    const padding = Math.max(...voxels.map(voxel => voxel.voxelResolution));
    const point = new Vector4();
    const origin = new Vector3();
    const direction = new Vector3();
    const occluderAt = (x: number, y: number, maxDepth: number) => {
        point.set(x, y, -1, 1).applyMatrix4(inverse);
        origin.set(point.x / point.w, point.y / point.w, point.z / point.w);
        // The middle clip plane also works with orthographic cameras and an infinite far plane.
        point.set(x, y, 0, 1).applyMatrix4(inverse);
        direction.set(point.x / point.w, point.y / point.w, point.z / point.w).sub(origin);
        point.set(x, y, maxDepth, 1).applyMatrix4(inverse);
        const axis =
            Math.abs(direction.x) >= Math.abs(direction.y)
                ? Math.abs(direction.x) >= Math.abs(direction.z)
                    ? 0
                    : 2
                : Math.abs(direction.y) >= Math.abs(direction.z)
                  ? 1
                  : 2;
        const distance =
            (point.getComponent(axis) / point.w - origin.getComponent(axis)) / direction.getComponent(axis);
        // Occlusion only needs any hit before this block, not the closest hit in the whole scene.
        // Expand the inverse-projected bound by roundoff, then keep the original strict depth test.
        const maxDistance = distance + Number.EPSILON * 8 * Math.max(1, Math.abs(distance));
        for (const voxel of active) {
            const hit = raycastVoxel(voxel, origin, direction, maxDistance);
            if (hit === Infinity) {
                continue;
            }
            point
                .set(origin.x + direction.x * hit, origin.y + direction.y * hit, origin.z + direction.z * hit, 1)
                .applyMatrix4(viewProjection);
            const depth = point.z / point.w;
            if (depth < maxDepth) {
                return depth;
            }
        }
        return Infinity;
    };
    boxes.forEach((box, idx) => {
        if (!box) {
            return;
        }
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity,
            minDepth = Infinity;
        for (let corner = 0; corner < 8; corner++) {
            point
                .set(
                    corner & 1 ? box.max.x + padding : box.min.x - padding,
                    corner & 2 ? box.max.y + padding : box.min.y - padding,
                    corner & 4 ? box.max.z + padding : box.min.z - padding,
                    1,
                )
                .applyMatrix4(viewProjection);
            if (point.w <= 0 || point.z <= -point.w) {
                return;
            }
            minX = Math.min(minX, point.x / point.w);
            maxX = Math.max(maxX, point.x / point.w);
            minY = Math.min(minY, point.y / point.w);
            maxY = Math.max(maxY, point.y / point.w);
            minDepth = Math.min(minDepth, point.z / point.w);
        }
        minX = Math.max(-1, minX);
        minY = Math.max(-1, minY);
        maxX = Math.min(1, maxX);
        maxY = Math.min(1, maxY);
        if (!(minX < maxX && minY < maxY && minDepth < 1)) {
            return;
        }
        // Include footprint edges and center so sub-cell blocks are not decided by an unrelated grid ray.
        if (
            !(occluderAt((minX + maxX) / 2, (minY + maxY) / 2, minDepth) < minDepth) ||
            !(occluderAt(minX, minY, minDepth) < minDepth) ||
            !(occluderAt(maxX, minY, minDepth) < minDepth) ||
            !(occluderAt(minX, maxY, minDepth) < minDepth) ||
            !(occluderAt(maxX, maxY, minDepth) < minDepth)
        ) {
            return;
        }
        const startX = Math.floor(((minX + 1) * GRID_SIZE) / 2),
            endX = Math.ceil(((maxX + 1) * GRID_SIZE) / 2);
        const startY = Math.floor(((minY + 1) * GRID_SIZE) / 2),
            endY = Math.ceil(((maxY + 1) * GRID_SIZE) / 2);
        let remaining = (endX - startX) * (endY - startY);
        for (const offset of SAMPLE_ORDER) {
            const x = offset % GRID_SIZE,
                y = Math.floor(offset / GRID_SIZE);
            if (x < startX || x >= endX || y < startY || y >= endY) {
                continue;
            }
            if (clearDepths[offset] >= minDepth) {
                return;
            }
            if (!(hitDepths[offset] < minDepth)) {
                const depth = occluderAt(-1 + ((x + 0.5) * 2) / GRID_SIZE, -1 + ((y + 0.5) * 2) / GRID_SIZE, minDepth);
                if (depth === Infinity) {
                    clearDepths[offset] = minDepth;
                    return;
                }
                hitDepths[offset] = depth;
            }
            if (--remaining === 0) {
                break;
            }
        }
        result[idx] = 1;
    });
    return result;
}
