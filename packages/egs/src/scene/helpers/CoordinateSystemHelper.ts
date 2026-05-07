import { Vector3 } from '../../math/Vector3';
import { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial';
import { Shape } from '../../math/shape/plane/Shape';
import { _Math } from '../../math/Math';
import { ArrowHelper } from './ArrowHelper';
import { Mesh } from '../drawables/Mesh';
import { Renderable } from '../renderables/IRenderable';
import { logger } from '../../utils/Logger';
import { OrthographicCamera } from '../cameras/OrthographicCamera';
import { Camera3D } from '../cameras/Camera3D';
import { TypeAssert } from '../tools/TypeAssert';
import { Matrix4 } from '../../math/Matrix4';
import { Color } from '../../math/Color';
import { Material } from '../../elements/materials/Material';
import { shape } from '../../elements/geometries/builder/Index';
import { IRenderer } from '../../renderer/IRenderer';

const ALPHABET_X = new Shape().fromJSON(JSON.parse(`{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"Shape","autoClose":false,"curves":
[{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[0.23,0],"v2":[2.5100000000000002,3.5300000000000002]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[2.5100000000000002,3.5300000000000002],"v2":[0.42,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[0.42,6.94],"v2":[1.47,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[1.47,6.94],"v2":[3.12,4.09]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[3.12,4.09],"v2":[3.18,4.09]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[3.18,4.09],"v2":[4.94,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[4.94,6.94],"v2":[5.92,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[5.92,6.94],"v2":[3.75,3.59]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[3.75,3.59],"v2":[6,0]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[6,0],"v2":[4.95,0]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[4.95,0],"v2":[3.17,2.98]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[3.17,2.98],"v2":[3.11,2.98]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[3.11,2.98],"v2":[1.24,0]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[1.24,0],"v2":[0.23,0]}],
"currentPoint":[0,0],"uuid":"AA7B7278-0C72-4A5F-AA95-50D2CBEE438B","holes":[]}
`));

const ALPHABET_Y = new Shape().fromJSON(JSON.parse(`{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"Shape","autoClose":false,"curves":
[{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[2.5100000000000002,0],"v2":[2.5100000000000002,2.98]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[2.5100000000000002,2.98],"v2":[0.06,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[0.06,6.94],"v2":[1.1,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[1.1,6.94],"v2":[2.97,3.8000000000000003]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[2.97,3.8000000000000003],"v2":[3.0300000000000002,3.8000000000000003]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[3.0300000000000002,3.8000000000000003],"v2":[4.89,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[4.89,6.94],"v2":[5.88,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[5.88,6.94],"v2":[3.41,2.99]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[3.41,2.99],"v2":[3.41,0]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[3.41,0],"v2":[2.5100000000000002,0]}],
"currentPoint":[0,0],"uuid":"121F61BC-4FD8-4510-AA77-EF598B7C0C0F","holes":[]}
`));

const ALPHABET_Z = new Shape().fromJSON(JSON.parse(`{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"Shape","autoClose":false,"curves":
[{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[0.58,0],"v2":[0.58,0.92]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[0.58,0.92],"v2":[4.57,6.08]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[4.57,6.08],"v2":[4.5600000000000005,6.140000000000001]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[4.5600000000000005,6.140000000000001],"v2":[0.78,6.140000000000001]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[0.78,6.140000000000001],"v2":[0.78,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[0.78,6.94],"v2":[5.6000000000000005,6.94]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[5.6000000000000005,6.94],"v2":[5.6000000000000005,6.08]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[5.6000000000000005,6.08],"v2":[1.55,0.87]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[1.55,0.87],"v2":[1.55,0.81]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[1.55,0.81],"v2":[5.83,0.81]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[5.83,0.81],"v2":[5.83,0]},
{"metadata":{"version":4.5,"type":"Curve","generator":"Curve.toJSON"},"arcLengthDivisions":200,"type":"LineCurve2D","v1":[5.83,0],"v2":[0.58,0]}],
"currentPoint":[0,0],"uuid":"ECBB5DA0-B373-4675-A462-EAE78DDC76D4","holes":[]}`));

const tmpDir = new Vector3();
const tmpCross = new Vector3();
const tmpRotateOriginMatrix = new Matrix4();
const tmpRotateInverseMatrix = new Matrix4();

const ARROW_HELPER_LINE_LENGTH = 300; // arrow line length
enum Direction {
    X,
    Y,
    Z
}
/**
 * This class is used to draw a fixed coordinate system on screen.
 */
export class CoordinateSystemHelper implements Renderable {
    /**
     * The switch of this effect.
     * @defaultValue `false`.
     */
    public enabled = false;
    public arrowHelperX: ArrowHelper;
    public arrowHelperY: ArrowHelper;
    public arrowHelperZ: ArrowHelper;
    public total_length: number = 740; // [300 + 70(alphabet max length)] * 2
    private location = new Vector3(0.875, 0.7, 0.125); // right bottom corner
    private isCameraNeedsUpdate = true;
    private axisCamera: OrthographicCamera;
    private alphabetX: Mesh;
    private alphabetY: Mesh;
    private alphabetZ: Mesh;
    private isWithAlphabets = true;

    public destroy() {
        this.alphabetX.destroyAllResourcesOwned();
        this.alphabetY.destroyAllResourcesOwned();
        this.alphabetZ.destroyAllResourcesOwned();
        this.axisCamera.destroy();
        this.arrowHelperX.destroyCombined();
        this.arrowHelperY.destroyCombined();
        this.arrowHelperZ.destroyCombined();
    }

    constructor(isWithAlphabets: boolean = true) {
        this.isWithAlphabets = isWithAlphabets;
        this.axisCamera = new OrthographicCamera();

        this.arrowHelperX = this.createArrowAxis(Direction.X);
        this.arrowHelperY = this.createArrowAxis(Direction.Y);
        this.arrowHelperZ = this.createArrowAxis(Direction.Z);

        if (this.isWithAlphabets) {
            this.alphabetX = this.createAlphabet(Direction.X);
            this.alphabetY = this.createAlphabet(Direction.Y);
            this.alphabetZ = this.createAlphabet(Direction.Z);
            this.alphabetX.up = this.alphabetY.up = this.alphabetZ.up = new Vector3(0, 0, 1);
        }
    }

    private createArrowAxis(direction: Direction) {
        let arrowHelper: ArrowHelper;
        switch (direction) {
            case Direction.X:
                arrowHelper = new ArrowHelper(new Vector3(1, 0, 0), new Vector3(0, 0, 0), ARROW_HELPER_LINE_LENGTH, 0xff0000, 50, 20);
                break;
            case Direction.Y:
                arrowHelper = new ArrowHelper(new Vector3(0, 1, 0), new Vector3(0, 0, 0), ARROW_HELPER_LINE_LENGTH, 0x00ff00, 50, 20);
                break;
            case Direction.Z:
                arrowHelper = new ArrowHelper(new Vector3(0, 0, 1), new Vector3(0, 0, 0), ARROW_HELPER_LINE_LENGTH, 0x0000ff, 50, 20);
                break;
        }

        const material = arrowHelper.line.expectOnlyMaterial();
        material.depthTest = false;
        material.depthWrite = false;
        material.depthTest = false;
        material.depthWrite = false;

        arrowHelper.updateMatrixWorld();
        return arrowHelper;
    }

    private createAlphabet(direction: Direction) {
        let alphabet: Mesh;
        switch (direction) {
            case Direction.X:
                alphabet = new Mesh(shape({ shapes: ALPHABET_X }), new MeshBasicMaterial({ color: 0xff0000 }));
                alphabet.translateX(ARROW_HELPER_LINE_LENGTH);
                break;
            case Direction.Y:
                alphabet = new Mesh(shape({ shapes: ALPHABET_Y }), new MeshBasicMaterial({ color: 0x00ff00 }));
                alphabet.translateY(ARROW_HELPER_LINE_LENGTH);
                break;
            case Direction.Z:
                alphabet = new Mesh(shape({ shapes: ALPHABET_Z }), new MeshBasicMaterial({ color: 0x0000ff }));
                alphabet.translateZ(ARROW_HELPER_LINE_LENGTH);
                break;
        }

        const material = alphabet.expectOnlyMaterial();
        material.depthTest = false;
        material.depthWrite = false;
        alphabet.scale = new Vector3(10, 10, 10);
        return alphabet;
    }
    // x and y are ratio from 0-1
    // same as z, which means the ratio of the screen
    public getLocation(): Vector3 {
        return this.location.clone();
    }

    public setLocation(x?: number, y?: number, size?: number) {
        if (x !== undefined) {
            this.location.setX(x);
        }
        if (y !== undefined) {
            this.location.setY(y);
        }
        if (size !== undefined) {
            this.location.setZ(size);
        }
        this.isCameraNeedsUpdate = true;
    }

    public setAlphabetParam(scale?: number, colorX?: Color, colorY?: Color, colorZ?: Color) {
        if (scale !== undefined) {
            this.alphabetX.scale.set(scale, scale, scale);
            this.alphabetY.scale.set(scale, scale, scale);
            this.alphabetZ.scale.set(scale, scale, scale);
        }
        const material = (this.alphabetX.expectOnlyMaterial() as MeshBasicMaterial);
        if (colorX !== undefined) {
            material.color.color = colorX.cloneReadonly();
        }
        if (colorY !== undefined) {
            material.color.color = colorY.cloneReadonly();
        }
        if (colorZ !== undefined) {
            material.color.color = colorZ.cloneReadonly();
        }
    }

    public setAlphabetOffset(offsetX?: Vector3, offsetY?: Vector3, offsetZ?: Vector3) {
        let maxDistance = 0;
        if (offsetX) {
            this.alphabetX.translateX(offsetX.x);
            this.alphabetX.translateY(offsetX.y);
            this.alphabetX.translateZ(offsetX.z);
            maxDistance = offsetX.x > maxDistance ? offsetX.x : maxDistance;
        }
        if (offsetY) {
            this.alphabetY.translateX(offsetY.x);
            this.alphabetY.translateY(offsetY.y);
            this.alphabetY.translateZ(offsetY.z);
            maxDistance = offsetY.y > maxDistance ? offsetY.y : maxDistance;
        }
        if (offsetZ) {
            this.alphabetZ.translateX(offsetZ.x);
            this.alphabetZ.translateY(offsetZ.y);
            this.alphabetZ.translateZ(offsetZ.z);
            maxDistance = offsetZ.z > maxDistance ? offsetZ.z : maxDistance;
        }
        this.total_length += maxDistance;
    }

    public updateAxisCamera(camera: Camera3D) {
        if (this.isCameraNeedsUpdate) {
            if (TypeAssert.isPerspectiveCamera(camera)) {
                let width, height;
                if (camera.aspect >= 1) { // width >= height
                    height = this.total_length;
                    width = Math.ceil(height * camera.aspect);
                } else { // height >= width
                    width = this.total_length;
                    height = Math.ceil(width / camera.aspect);
                }

                const r_l = Math.ceil(width / this.location.z / 2); // divide 2 here since we only need 0-1 range, not the -1 to 1 range,
                // kind of hack but works
                const t_b = Math.ceil(height / this.location.z / 2);

                const left = -this.total_length / 2 - Math.ceil(r_l * this.location.x);
                const right = Math.ceil(left + r_l);

                const top = Math.ceil(t_b * this.location.y + this.total_length / 2);
                const bottom = Math.ceil(top - t_b);

                this.axisCamera.top = top;
                this.axisCamera.bottom = bottom;
                this.axisCamera.left = left;
                this.axisCamera.right = right;
                this.axisCamera.near = -this.total_length / 2;
                this.axisCamera.far = this.total_length / 2;
                this.axisCamera.updateProjectionMatrix();
            } else {
                // TODO: what if the original camera is Orthogonal
            }
            this.isCameraNeedsUpdate = false;
        }
    }

    private renderArrowHelper(arrowHelper: ArrowHelper, renderer: IRenderer) {
        arrowHelper.line.modelViewMatrix.multiplyMatrices(tmpRotateInverseMatrix, arrowHelper.line.matrixWorld);
        renderer.renderDrawcall(arrowHelper.line.geometry, arrowHelper.line.expectOnlyMaterial(), arrowHelper.line, null);
        arrowHelper.cone.modelViewMatrix.multiplyMatrices(tmpRotateInverseMatrix, arrowHelper.cone.matrixWorld);
        renderer.renderDrawcall(arrowHelper.cone.geometry, arrowHelper.cone.expectOnlyMaterial(), arrowHelper.cone, null);
    }

    private renderAlphabet(alphabet: Mesh<Material>, renderer: IRenderer) {
        tmpDir.copy(alphabet.position).applyMatrix4(tmpRotateInverseMatrix).add(new Vector3(0, 0, 1)).applyMatrix4(tmpRotateOriginMatrix);
        tmpCross.subVectors(tmpDir, alphabet.position).normalize();
        tmpCross.crossVectors(alphabet.up, tmpCross);
        if (tmpCross.lengthSq() < 1e-9) {
            tmpDir.copy(alphabet.position).applyMatrix4(tmpRotateInverseMatrix).add(new Vector3(0, Math.sign(tmpRotateInverseMatrix.elements[10]) * -0.0001, 0.999999995)).applyMatrix4(tmpRotateOriginMatrix);
        }
        alphabet.lookAt(tmpDir);
        alphabet.modelViewMatrix.multiplyMatrices(tmpRotateInverseMatrix, alphabet.matrixWorld);
        renderer.renderDrawcall(alphabet.geometry, alphabet.expectOnlyMaterial(), alphabet, null);
    }

    private renderByOrder(order: string, renderer: IRenderer) {
        for (let i = 0; i < 3; i++) {
            this.renderArrowHelper((this as any)['arrowHelper' + order[i]], renderer);
            if (this.isWithAlphabets) {
                this.renderAlphabet((this as any)['alphabet' + order[i]], renderer);
            }
        }
    }

    public config(_: IRenderer) {
        return true;
    }

    public render(renderer: IRenderer): void {
        if (!this.enabled) {
            return;
        }
        const camera = renderer.getCurrentCamera();

        if (camera === null) {
            logger.unreachable('camera not set before in render ground');
            return;
        }

        this.updateAxisCamera(camera);
        renderer.useCamera(this.axisCamera);
        // fetch the rotation matrix from camera only
        tmpRotateOriginMatrix.makeRotationFromQuaternion(camera.quaternion);
        tmpRotateInverseMatrix.getInverse(tmpRotateOriginMatrix);

        // decide render order for each part
        // const xDepth = tmpRotateInverseMatrix.elements[2] * 1 + tmpRotateInverseMatrix.elements[6] * 0 + tmpRotateInverseMatrix.elements[10] * 0; // 1-0-0
        // const yDepth = tmpRotateInverseMatrix.elements[2] * 0 + tmpRotateInverseMatrix.elements[6] * 1 + tmpRotateInverseMatrix.elements[10] * 0; // 0-1-0
        // const zDepth = tmpRotateInverseMatrix.elements[2] * 0 + tmpRotateInverseMatrix.elements[6] * 0 + tmpRotateInverseMatrix.elements[10] * 1; // 0-0-1
        const xDepth = tmpRotateInverseMatrix._elements[2];
        const yDepth = tmpRotateInverseMatrix._elements[6];
        const zDepth = tmpRotateInverseMatrix._elements[10];

        if (xDepth >= yDepth && yDepth >= zDepth) { // X > Y > Z
            this.renderByOrder('ZYX', renderer);
        } else if (xDepth >= zDepth && zDepth >= yDepth) { // X > Z > Y
            this.renderByOrder('YZX', renderer);
        } else if (yDepth >= xDepth && xDepth >= zDepth) { // Y > X > Z
            this.renderByOrder('ZXY', renderer);
        } else if (yDepth >= zDepth && zDepth >= xDepth) { // Y > Z > X
            this.renderByOrder('XZY', renderer);
        } else if (zDepth >= xDepth && xDepth >= yDepth) { // Z > X > Y
            this.renderByOrder('YXZ', renderer);
        } else {                                         // Z > Y > X
            this.renderByOrder('XYZ', renderer);
        }

        renderer.useCamera(camera);
    }
}
