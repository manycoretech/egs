import { BufferGroup, IndexBufferAttribute } from '../../../elements/geometries/containers/BufferGeometry';
import { BufferAttribute } from '../../../elements/attributes/BufferAttribute';
import { Vector3 } from '../../../math/Vector3';
import { Vector2 } from '../../../math/Vector2';
import { PopBufferGeometry } from '../../../elements/geometries/containers/PopBufferGeometry';
import { MeshPhongMaterial } from '../../../elements/materials/mesh/MeshPhongMaterial';

// indexValue => materialIndex
let usedMap = new Uint16Array(10000);
let expandIndexMap = new Uint32Array(1000);

const vx = new Vector3();
const vn = new Vector3();
const vt = new Vector2();

export function expandAttributeBySharedIndex(geometry: PopBufferGeometry): undefined | {
    index: IndexBufferAttribute,
    position: BufferAttribute,
    normal: BufferAttribute,
    uv: BufferAttribute,
} {
    const groups = geometry.getGroups();
    const index = geometry.index;
    const position = geometry.position;
    const normal = geometry.getAttribute('normal')!;
    const texcoord = geometry.getAttribute('uv')!;

    if (usedMap === undefined || usedMap.length < (position.count)) {
        usedMap = new Uint16Array(position.count);
    }

    usedMap.fill(0);
    expandIndexMap.fill(0);

    let sharedCount = 0;

    for (let i = 0; i < groups.length; ++i) {
        const group = groups[i];
        for (let j = 0; j < group.count; ++j) {
            const indexPointer = group.start + j;
            const indexValue = index.array[indexPointer];
            const usedMapPointer = indexValue;
            const materialIndex = usedMap[usedMapPointer];
            const groupMaterialIndex = group.materialIndex + 1;

            if (materialIndex === 0) {
                usedMap[usedMapPointer] = groupMaterialIndex;
                continue;
            }

            if (materialIndex !== groupMaterialIndex) {
                const expandIndexPointer = sharedCount * 2;

                if (expandIndexPointer > expandIndexMap.length) {
                    const newExpandIndexMap = new Uint32Array(Math.ceil(expandIndexMap.length * 1.8));
                    newExpandIndexMap.set(expandIndexMap);
                    expandIndexMap = newExpandIndexMap;
                }

                expandIndexMap[expandIndexPointer] = indexPointer;
                expandIndexMap[expandIndexPointer + 1] = indexValue;
                ++sharedCount;
            }
        }
    }

    if (sharedCount === 0) {
        return;
    }

    const newPosition = new Float32Array((position.count + sharedCount) * 3);
    newPosition.set(position.array);
    const newNormal = new Float32Array((normal.count + sharedCount) * 3);
    newNormal.set(normal.array);
    const newUv = new Float32Array((texcoord.count + sharedCount) * 2);
    newUv.set(texcoord.array);
    const newIndex = index.array.slice();

    let appendIndex = position.count;
    for (let i = 0; i < sharedCount; ++i) {
        const pointer = i * 2;
        const indexPointer = expandIndexMap[pointer];
        const indexValue = expandIndexMap[pointer + 1];

        vx.fromArray(newPosition, indexValue * 3).toArray(newPosition as any, appendIndex * 3);
        vn.fromArray(newNormal, indexValue * 3).toArray(newNormal as any, appendIndex * 3);
        vt.fromArray(newUv, indexValue * 2).toArray(newUv as any, appendIndex * 2);

        newIndex[indexPointer] = appendIndex++;
    }

    return {
        index: new BufferAttribute(newIndex, 1),
        position: new BufferAttribute(newPosition, 3),
        normal: new BufferAttribute(newNormal, 3),
        uv: new BufferAttribute(newUv, 2),
    };
}

function getMaterialGroup(groups: ReadonlyArray<Readonly<BufferGroup>>, materialIndex: number): BufferGroup | undefined {
    for (let i = 0; i < groups.length; ++i) {
        const group = groups[i];
        if (group.materialIndex === materialIndex) {
            return group;
        }
    }
    return undefined;
}

const vec3 = new Vector3();
export function generateTransformedUVAttribute(geometry: PopBufferGeometry, materials: ReadonlyArray<MeshPhongMaterial>): Float32Array {
    let needTransform = false;
    for (let i = 0; i < materials.length; ++i) {
        const material = materials[i];
        if (material.texture) {
            needTransform = true;
            break;
        }
    }

    if (!needTransform) {
        return geometry.uv.array as Float32Array;
    }

    const originalUVs = geometry.uv.array as Float32Array;
    const indexArray = geometry.index.array;
    const newUVs = new Float32Array(originalUVs);
    const uvStride = 2;

    for (let i = 0; i < materials.length; ++i) {
        const material = materials[i];
        if (material.texture !== null) {
            const group = getMaterialGroup(geometry.getGroups(), i);
            if (group === undefined) {
                continue;
            }
            const matrix = material.uvTransform.clone();

            for (let j = 0; j < group.count; ++j) {
                const p = group.start + j;
                const offset = indexArray[p] * uvStride;
                // update uvs with uvMatrix
                vec3.x = originalUVs[offset];
                vec3.y = originalUVs[offset + 1];
                vec3.z = 1.0;
                vec3.applyMatrix3(matrix);

                newUVs[offset] = vec3.x;
                newUVs[offset + 1] = vec3.y;
            }

        }
    }

    return newUVs;
}
