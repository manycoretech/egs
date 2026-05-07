import { SharedShaderComponent } from '../Shader';
import { ShaderBuilder, ShaderVaryingTypes, ShaderInjectionTypes } from '../builders/ShaderBuilder';
import { Plane } from '../../../math/Plane';
import { WebGLShaderDataType } from '../../webgl/WGLConstants';
import { Camera3D } from '../../../scene/cameras/Camera3D';
import { Matrix3 } from '../../../math/Matrix3';
import { WGLProgram } from '../../webgl/WGLProgram';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { Vector3 } from '../../../math/Vector3';
import { ContentBridge, materialProperty } from '../../../ContentAPI';

const viewNormalMatrix = new Matrix3();

export class ClippingShaderComponent extends SharedShaderComponent {
    public className() {
        return 'ClippingShaderComponent';
    }

    constructor(isSceneClipping = false) {
        super();
        this.isSceneClipping = isSceneClipping;
        ContentBridge.shaderComponentCreateAttachable(this);
    }

    private isSceneClipping = false;
    private get uniformName() {
        return 'clippingPlanes' + (this.isSceneClipping ? 'scene' : '');
    }

    @materialProperty()
    private _clippingPlanes: Plane[] = [];
    get clippingPlanes(): Plane[] {
        return this._clippingPlanes;
    }
    set clippingPlanes(value: Plane[]) {
        this._clippingPlanes = value;
        this.updateClipping();
    }

    public updateClipping() {
        if (this._clippingPlanes.length * 4 !== this.transformedPlanes.length) {
            this.broadcastToRecompile();
        }
        // trigger setter update data
        this._clippingPlanes = this._clippingPlanes.slice();
        this.transformedPlanes = new Float32Array(4 * this.planeCount);
    }

    // the real plane uniform data should transformed into camera space,
    private transformedPlanes = new Float32Array();

    get planeCount() {
        return this._clippingPlanes.length;
    }

    public copy(other: ClippingShaderComponent) {
        this._clippingPlanes = other._clippingPlanes.slice();
        return this;
    }

    public clone() {
        return new ClippingShaderComponent().copy(this);
    }

    public updatePlane(camera: Camera3D) {
        const viewMatrix = camera.matrixWorldInverse;
        viewNormalMatrix.getNormalMatrix(viewMatrix);
        this._clippingPlanes.forEach((p, i) => {
            const plane = p.clone().applyMatrix4(viewMatrix, viewNormalMatrix);
            this.transformedPlanes[i * 4] = plane.normal.x;
            this.transformedPlanes[i * 4 + 1] = plane.normal.y;
            this.transformedPlanes[i * 4 + 2] = plane.normal.z;
            this.transformedPlanes[i * 4 + 3] = plane.constant;
        });
    }

    public extendShaderShape(builder: ShaderBuilder): void {
        if (this.planeCount === 0) {
            return;
        }
        builder.addVarying(ShaderVaryingTypes.viewPosition)
            .addUniformArray(this.uniformName, WebGLShaderDataType.Vec4, this.planeCount)
            .inject(ShaderInjectionTypes.discard,
                `
    for ( int i = 0; i < ${this._clippingPlanes.length}; i ++ ) {
        vec4 plane = ${this.uniformName}[ i ];
        if ( dot( vViewPosition, plane.xyz ) > plane.w ) discard;
    }
            `);
    }
    public extendShaderShading(_builder: ShaderBuilder): void {
    }

    public updateShapeUniforms(program: WGLProgram) {
        if (this.planeCount === 0) {
            return;
        }
        const camera = program.renderState.builtUniforms.currentCamera as Camera3D;
        this.updatePlane(camera);
        program.setUniform(`${this.uniformName}[0]`, this.transformedPlanes);
    }

    public generateShaderKey() {
        return this._clippingPlanes.length + '';
    }
    public computeShapeKey() {
        return this._clippingPlanes.length + '';
    }

    public serialize(ctx: Serializer<any>): void {
        const planesData = this._clippingPlanes.map(plane => {
            return {
                normal: plane.normal.getSerializeData(),
                constant: plane.constant
            };
        });
        ctx.putRaw('clippingPlanes', planesData);
    }
    public deserialize(ctx: Deserializer): void | Promise<void> {
        const planesData = ctx.readRaw('clippingPlanes');
        if (planesData) {
            planesData.forEach((data: any) => {
                const normal = new Vector3();
                normal.setSerializeData(data.normal);
                this._clippingPlanes.push(new Plane(normal, data.constant));
            });
        }
    }
}
