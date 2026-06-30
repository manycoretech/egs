import { Vector3 } from '../../math/Vector3.js';
import { Frustum } from '../../math/Frustum.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { TypeAssert } from './TypeAssert.js';
import type { Camera3D } from '../cameras/Camera3D.js';
import type { Drawable } from '../drawables/Drawable.js';

export class Culler {
    enableFrustumCulling = false;
    private frustum = new Frustum();
    private projScreenMatrix = new Matrix4();

    enableDetailCulling = false;
    private pixelsOfDistOne = 0;
    private cameraWorldPosition = new Vector3();

    /**
     * @internal
     * camera should updated
     */
    update(camera: Camera3D) {
        this.enableFrustumCulling = camera.enableFrustumCulling;
        this.enableDetailCulling = camera.enableDetailCulling;
        camera.updateMatrixWorld();
        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromMatrix(this.projScreenMatrix);
        this.cameraWorldPosition = camera.worldPosition.clone();
        this.pixelsOfDistOne = camera.getPixelsOfDistOne();
    }

    /**
     * @internal
     */
    queryCulling = (item: Drawable) => {
        if (this.enableDetailCulling && this.queryDetailCulling(item)) {
            return false;
        }

        if (this.enableFrustumCulling && this.queryFrustumCulling(item)) {
            return false;
        }

        return true;
    };

    private queryFrustumCulling(item: Drawable): boolean {
        if (TypeAssert.isSprite(item)) {
            return !this.frustum.intersectsSprite(item);
        }
        return !this.frustum.intersectsBox(item.worldBoundingBox);
    }

    private queryDetailCulling(item: Drawable): boolean {
        return (
            !item.enableViewIndependentScale &&
            (item.worldBoundingSphere.radius * 1000) /
                (this.cameraWorldPosition.distanceTo(item.worldBoundingSphere.center) * this.pixelsOfDistOne) <
                4
        );
    }
}
