import type { BufferGeometry } from '../containers/BufferGeometry';
import { logger } from '../../../utils/Logger';
import { BufferAttribute } from '../../attributes/BufferAttribute';
import { Vector3 } from '../../../math/Vector3';
const vector = new Vector3();

/**
 * Every normal vector in a geometry will have a magnitude of 1. geometry will correct lighting on the geometry surfaces.
 */
export function reNormalize(geometry: BufferGeometry): void {
    const normals = geometry.getAttribute('normal');
    if (normals === undefined) {
        logger.invalidInput('geometry has no normal');
        return;
    }
    const normalBuffer = normals.array;
    for (let i = 0, il = normals.count; i < il; i++) {
        vector.x = normalBuffer[i * 3];
        vector.y = normalBuffer[i * 3 + 1];
        vector.z = normalBuffer[i * 3 + 2];
        vector.normalize();
        normalBuffer[i * 3] = vector.x;
        normalBuffer[i * 3 + 1] = vector.y;
        normalBuffer[i * 3 + 2] = vector.z;
    }
    normals.notifyContentChange();
}

/**
 * Computes face normals normal by averaging vertices position.
 */
export function computeNormalsByPosition(geometry: BufferGeometry): void {
    const index = geometry.index;
    const attributes = geometry.getAttributes();

    if (attributes.position) {
        const positions = attributes.position.array;
        const normals = new Float32Array(positions.length);

        let vA, vB, vC;
        const pA = new Vector3();
        const pB = new Vector3();
        const pC = new Vector3();
        const cb = new Vector3();
        const ab = new Vector3();

        // indexed elements
        if (index) {
            const indices = index.array;
            for (let i = 0, il = index.count; i < il; i += 3) {

                vA = indices[i + 0] * 3;
                vB = indices[i + 1] * 3;
                vC = indices[i + 2] * 3;

                pA.fromArray(positions, vA);
                pB.fromArray(positions, vB);
                pC.fromArray(positions, vC);

                cb.subVectors(pC, pB);
                ab.subVectors(pA, pB);
                cb.cross(ab);

                normals[vA] += cb.x;
                normals[vA + 1] += cb.y;
                normals[vA + 2] += cb.z;

                normals[vB] += cb.x;
                normals[vB + 1] += cb.y;
                normals[vB + 2] += cb.z;

                normals[vC] += cb.x;
                normals[vC + 1] += cb.y;
                normals[vC + 2] += cb.z;
            }
        } else {
            // non-indexed elements (unconnected triangle soup)
            for (let i = 0, il = positions.length; i < il; i += 9) {
                pA.fromArray(positions, i);
                pB.fromArray(positions, i + 3);
                pC.fromArray(positions, i + 6);

                cb.subVectors(pC, pB);
                ab.subVectors(pA, pB);
                cb.cross(ab);

                normals[i] = cb.x;
                normals[i + 1] = cb.y;
                normals[i + 2] = cb.z;

                normals[i + 3] = cb.x;
                normals[i + 4] = cb.y;
                normals[i + 5] = cb.z;

                normals[i + 6] = cb.x;
                normals[i + 7] = cb.y;
                normals[i + 8] = cb.z;
            }
        }

        geometry.addAttribute('normal', new BufferAttribute(normals, 3));
        reNormalize(geometry);
        attributes.normal.needsUpdate = true;
    }
}
