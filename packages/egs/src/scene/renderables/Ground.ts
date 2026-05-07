import { Mesh } from '../drawables/Mesh';
import { Renderable } from './IRenderable';
import { GroundMaterial } from '../../elements/materials/mesh/GroundMaterial';
import { logger } from '../../utils/Logger';
import { plane } from '../../elements/geometries/builder/Index';
import { IRenderer } from '../../renderer/IRenderer';
import { Vector3 } from '../../math/Vector3';
import { readonlyMath } from '../../..';
/**
 * This class is used to draw a grid-like ground.
 */

const GROUND_DEFAULT_UP = new Vector3(0, 0, 1);
export class Ground implements Renderable {
    /**
     * The material of ground can be used to change style.
     */
    readonly material = new GroundMaterial();
    /**
     * Switch of drawing ground.
     */
    public enabled = true;
    private _size: number = 1000000;
    get size() {
        return this._size;
    }
    set size(v) {
        this._size = v;
        this.updateGeometry();
    }

    private groundMesh: Mesh;
    private geometry = plane({
        width: this.size,
        height: this.size,
        widthSegments: 50,
        heightSegments: 50
    });

    constructor() {
        this.groundMesh = new Mesh(this.geometry, this.material);
        this.groundMesh.name = 'ground';
        this.groundMesh.up.copy(GROUND_DEFAULT_UP);
    }

    get up() {
        return this.groundMesh.up;
    }

    set up(up: Vector3) {
        if (!this.groundMesh.up.equals(up)) {
            this.groundMesh.quaternion.setFromUnitVectors(GROUND_DEFAULT_UP, up);
            this.material.quat = readonlyMath.vec4(this.groundMesh.quaternion.x, this.groundMesh.quaternion.y, this.groundMesh.quaternion.z, this.groundMesh.quaternion.w);
            this.groundMesh.updateMatrix();
            this.groundMesh.updateMatrixWorld();
            this.groundMesh.up.copy(up);
        }
    }

    config(_: IRenderer) {
        return true;
    }

    private updateGeometry() {
        this.geometry = plane({
            width: this.size,
            height: this.size,
            widthSegments: 50,
            heightSegments: 50
        });
        this.groundMesh.geometry = this.geometry;
    }

    /**
     * @ignore
     */
    public render(renderer: IRenderer): void {
        if (!this.enabled) {
            return;
        }
        const camera = renderer.getCurrentCamera();

        if (camera === null) {
            logger.unreachable('camera not set before in render ground');
            return;
        }
        this.groundMesh.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, this.groundMesh.matrixWorld);
        this.groundMesh.normalMatrix.getNormalMatrix(this.groundMesh.modelViewMatrix);
        renderer.renderDrawcall(this.groundMesh.geometry, this.material, this.groundMesh, null);
    }

    public destroy() {
        this.groundMesh.destroyAllResourcesOwned();
    }
}
