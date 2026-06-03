import type { Mesh } from '../scene/drawables/Mesh';
import { BVHStrategyType, type BVH, BVHBuilder } from './Impl';
import type { Intersection, Raycaster } from '../scene/tools/Raycaster';
import type { Ray } from '../math/Ray';
import { Vector3 } from '../math/Vector3';
import { Side } from '../utils/Constants';
import { Face3 } from '../math/Face3';
import { Triangle } from '../math/Triangle';
import type { Material } from '../elements/materials/Material';
import type { BufferGeometry } from '../elements/geometries/containers/BufferGeometry';
import { logger } from '../utils/Logger';

class Box {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;

    constructor() {
        this.reset();
    }

    reset() {
        this.minX = this.minY = this.minZ = Number.MAX_VALUE;
        this.maxX = this.maxY = this.maxZ = -Number.MAX_VALUE;
    }

    expand(x: number, y: number, z: number) {
        this.minX = Math.min(this.minX, x);
        this.minY = Math.min(this.minY, y);
        this.minZ = Math.min(this.minZ, z);
        this.maxX = Math.max(this.maxX, x);
        this.maxY = Math.max(this.maxY, y);
        this.maxZ = Math.max(this.maxZ, z);
    }
}

const tempBox = new Box();
const taskMap = new Map<BufferGeometry, number>();
export async function createMeshBVH(mesh: Mesh) {
    if (!BVHBuilder.isInitd) {
        return;
    }

    const geometry = mesh.geometry;
    const positionAttr = geometry.position;
    if (!positionAttr) {
        return;
    }

    const lastVersion = taskMap.get(geometry);
    if (lastVersion !== undefined && geometry.meshBVHVersion <= lastVersion) {
        return;
    }

    const indexAttr = geometry.index;
    const counts = (indexAttr ?? positionAttr).count / 3;
    const boxes = new Float32Array(6 * counts);
    const triangleIndexMap = new Uint32Array(counts);

    const indexArray = indexAttr?.array;
    const positionArray = positionAttr.array;

    let i0: number;
    let i1: number;
    let i2: number;
    for (let i = 0; i < counts; i++) {
        tempBox.reset();
        if (indexArray) {
            i0 = indexArray[i * 3];
            i1 = indexArray[i * 3 + 1];
            i2 = indexArray[i * 3 + 2];
        } else {
            i0 = i * 3;
            i1 = i * 3 + 1;
            i2 = i * 3 + 2;
        }
        tempBox.expand(positionArray[i0 * 3], positionArray[i0 * 3 + 1], positionArray[i0 * 3 + 2]);
        tempBox.expand(positionArray[i1 * 3], positionArray[i1 * 3 + 1], positionArray[i1 * 3 + 2]);
        tempBox.expand(positionArray[i2 * 3], positionArray[i2 * 3 + 1], positionArray[i2 * 3 + 2]);
        boxes[i * 6] = tempBox.minX;
        boxes[i * 6 + 1] = tempBox.minY;
        boxes[i * 6 + 2] = tempBox.minZ;
        boxes[i * 6 + 3] = tempBox.maxX;
        boxes[i * 6 + 4] = tempBox.maxY;
        boxes[i * 6 + 5] = tempBox.maxZ;
        triangleIndexMap[i] = i;
    }
    taskMap.set(geometry, geometry.meshBVHVersion);
    BVHBuilder.build({ strategyType: BVHStrategyType.Mesh, boxes })
        .then(bvh => {
            const lastVersion = taskMap.get(geometry)!;
            if (geometry.meshBVHVersion >= lastVersion) {
                geometry.meshBVH = new MeshBVH(bvh, triangleIndexMap);
                taskMap.delete(geometry);
            }
        })
        .catch(e => {
            const lastVersion = taskMap.get(geometry)!;
            if (geometry.meshBVHVersion >= lastVersion) {
                taskMap.delete(geometry);
            }
            logger.warn(e);
        });
}

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const vD = new Vector3(); // cache hit pos
export class MeshBVH {
    private bvh: BVH;
    private triangleIndexMap: Uint32Array;

    constructor(bvh: BVH, triangleIndexMap: Uint32Array) {
        this.bvh = bvh;
        this.triangleIndexMap = triangleIndexMap;
    }

    pick(source: Mesh, raycaster: Raycaster, ray: Ray, intersects: Intersection[]) {
        const { bvh, triangleIndexMap } = this;
        const { origin: o, direction: d } = ray;
        const pickResult = bvh.pick(o.x, o.y, o.z, d.x, d.y, d.z);

        const materials = source.getMaterials();
        const isOnlyOneMaterial = !source.shouldUseGeometryGroupsWhenOnlyHasOneMaterial && materials.length === 1;

        const geometry = source.geometry;
        const groups = geometry.getGroups();
        const indexArray = geometry.index?.array;
        const positionArray = geometry.position.array;

        let i0: number;
        let i1: number;
        let i2: number;
        for (let i = 0; i < pickResult.length; i++) {
            const triIndex = triangleIndexMap[pickResult[i]];
            if (indexArray) {
                i0 = indexArray[triIndex * 3];
                i1 = indexArray[triIndex * 3 + 1];
                i2 = indexArray[triIndex * 3 + 2];
            } else {
                i0 = triIndex * 3;
                i1 = triIndex * 3 + 1;
                i2 = triIndex * 3 + 2;
            }
            vA.set(positionArray[i0 * 3], positionArray[i0 * 3 + 1], positionArray[i0 * 3 + 2]);
            vB.set(positionArray[i1 * 3], positionArray[i1 * 3 + 1], positionArray[i1 * 3 + 2]);
            vC.set(positionArray[i2 * 3], positionArray[i2 * 3 + 1], positionArray[i2 * 3 + 2]);

            let intersect: Vector3 | null = ray.intersectTriangle(vA, vB, vC, false, vD);
            if (!intersect) {
                continue;
            }
            let material: Material | undefined;
            if (!isOnlyOneMaterial) {
                const start = triIndex * 3;
                for (let i = 0; i < groups.length; i++) {
                    const group = groups[i];
                    if (start >= group.start && (start + 9) < (group.start + group.count)) {
                        material = materials[group.materialIndex];
                        break;
                    }
                }
            }
            if (!material) {
                material = materials[0];
            }
            if (material.side === Side.BackSide) {
                intersect = ray.intersectTriangle(vC, vB, vA, true, vD);
            } else if (material.side === Side.FrontSide) {
                intersect = ray.intersectTriangle(vA, vB, vC, true, vD);
            }
            if (!intersect) {
                continue;
            }

            intersect.applyMatrix4(source.matrixWorld);
            const distance = raycaster.ray.origin.distanceTo(intersect);
            if (distance < raycaster.near || distance > raycaster.far) {
                continue;
            }

            intersects.push({
                distance,
                point: intersect.clone(),
                object: source,
                primitiveIndex: triIndex,
                face: new Face3(i0, i1, i2, Triangle.getNormal(vA, vB, vC, new Vector3())),
                faceIndex: triIndex,
            });
        }
    }

    destroy() {
        this.bvh.free();
        this.bvh = undefined!;
        this.triangleIndexMap = undefined!;
    }
}
