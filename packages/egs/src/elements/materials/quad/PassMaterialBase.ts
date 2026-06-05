import {
    ShaderInjectionTypes,
    type ShaderBuilder,
    ShaderVaryingTypes,
} from '../../../renderer/shader/builders/ShaderBuilder';
import { Material, type MaterialParameters } from '../Material';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';

export abstract class PassQuadMaterialBase extends Material {
    constructor(params?: MaterialParameters) {
        super({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            ...params,
        });
    }

    extendShaderShape(builder: ShaderBuilder) {
        builder
            .inject(ShaderInjectionTypes.gl_Position, 'gl_Position = vec4(position, 1.0);')
            .addVarying(ShaderVaryingTypes.fragUV);
    }

    className(): string {
        return 'PassQuadMaterialBase';
    }

    computeShapeKey() {
        // PassQuadMaterialBase
        return 'q';
    }

    updateShapeUniforms(_1: WGLProgram) {}

    copy(_: PassQuadMaterialBase) {
        return this;
    }

    clone() {
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

    extendShaderShape(_builder: ShaderBuilder) {}

    computeShapeKey() {
        // PassPointsMaterialBase
        return 'p';
    }

    updateShapeUniforms(_1: WGLProgram) {}

    copy(_: PassPointsMaterialBase) {
        return this;
    }

    clone() {
        return this;
    }
}
