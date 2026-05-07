import { Vector3 } from '../../math/Vector3';
import { Frustum } from '../../math/Frustum';
import { Matrix4 } from '../../math/Matrix4';
import { TypeAssert } from './TypeAssert';
import { Camera3D } from '../cameras/Camera3D';
import { Drawable } from '../drawables/Drawable';

export class Culler {
    public enableFrustumCulling = false;
    private frustum = new Frustum();
    private projScreenMatrix = new Matrix4();

    public enableDetailCulling = false;
    private pixelsOfDistOne = 0;
    private cameraWorldPosition = new Vector3();

    /**
     * @ignore
     * camera should updated
     */
    public update(camera: Camera3D) {
        this.enableFrustumCulling = camera.enableFrustumCulling;
        this.enableDetailCulling = camera.enableDetailCulling;
        camera.updateMatrixWorld();
        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromMatrix(this.projScreenMatrix);
        this.cameraWorldPosition = camera.worldPosition.clone();
        this.pixelsOfDistOne = camera.getPixelsOfDistOne();
    }

    /**
     * @ignore
     */
    public queryCulling = (item: Drawable) => {
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
        return !item.enableViewIndependentScale && (item.worldBoundingSphere.radius * 1000 / (this.cameraWorldPosition.distanceTo(item.worldBoundingSphere.center) * this.pixelsOfDistOne)) < 4;
    }
}
