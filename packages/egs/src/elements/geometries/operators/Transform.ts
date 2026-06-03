import type { BufferGeometry } from '../../../elements/geometries/containers/BufferGeometry';
import type { Matrix4 } from '../../../math/Matrix4';
import { Matrix3 } from '../../../math/Matrix3';

/**
 * Let every positional and normal vector multiple with specified matrix.
 * @param {Matrix4} matrix a 4×4 matrix which is applied to.
 * @remarks See {@link Matrix4.applyToBufferAttribute| applyToBufferAttribute} for more details.
 */
export function transform(geometry: BufferGeometry, matrix: Matrix4):BufferGeometry {
    const position = geometry.getAttribute('position');

    if (position !== undefined) {
        matrix.applyToBufferAttribute(position);
        position.needsUpdate = true;
        geometry.notifyShapeChanged();
    }

    const normal = geometry.getAttribute('normal');

    if (normal !== undefined) {
        const normalMatrix = new Matrix3().getNormalMatrix(matrix);
        normalMatrix.applyToBufferAttribute(normal);
        normal.needsUpdate = true;
    }

    return geometry;
}
