import { ShaderInjectionTypes, ShaderBuilder, ShaderVaryingTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { Material, MaterialParameters } from '../Material';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';

export abstract class PassQuadMaterialBase extends Material {
    constructor(params?: MaterialParameters) {
        super({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            ...params,
        });
    }

    public extendShaderShape(builder: ShaderBuilder) {
        builder
            .inject(ShaderInjectionTypes.gl_Position, 'gl_Position = vec4(position, 1.0);')
            .addVarying(ShaderVaryingTypes.fragUV);
    }

    className(): string {
        return 'PassQuadMaterialBase';
    }

    public computeShapeKey() {
        // PassQuadMaterialBase
        return 'q';
    }

    public updateShapeUniforms(_1: WGLProgram) { }

    public copy(_: PassQuadMaterialBase) {
        return this;
    }

    public clone() {
        return this;
    }
}

export abstract class PassPointsMaterialBase extends Material {
    constructor(params?: MaterialParameters) {
        super({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            ...params,
        });
    }

    public extendShaderShape(_builder: ShaderBuilder) {
    }

    public computeShapeKey() {
        // PassPointsMaterialBase
        return 'p';
    }

    public updateShapeUniforms(_1: WGLProgram) { }

    public copy(_: PassPointsMaterialBase) {
        return this;
    }

    public clone() {
        return this;
    }
}
