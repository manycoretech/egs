import { Material } from '../Material';
import { ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import type { ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { materialProperty } from '../../../ContentAPI';
import { ReadonlyVector3 } from '../../../math/Vector3';
import { readonlyMath } from '../../../math/Readonly';
import { ReadonlyVector4 } from '../../../math/Vector4';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';

export abstract class JsNoImplMaterial extends Material {
    extendShaderShape(_builder: ShaderBuilder, _registry: ShaderComponentRegistry): void { }
    extendShaderShading(_builder: ShaderBuilder, _registry: ShaderComponentRegistry): void { }
    computeShapeKey(_registry: ShaderComponentRegistry): string {
        return '';
    }
    updateShapeUniforms(_program: WGLProgram, _registry: ShaderComponentRegistry): void { }
    updateShadingUniforms(_program: WGLProgram, _registry: ShaderComponentRegistry): void { }
}

export abstract class BackgroundLikeMaterial extends Material {
    @materialProperty()
    up: ReadonlyVector3 = readonlyMath.vec3(0, 0, 1);
    @materialProperty()
    quat: ReadonlyVector4 = readonlyMath.vec4(0, 0, 0, 1);

    extendShaderShape(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder
            .useCamera()
            .addUniform('backgroundUp', WebGLShaderDataType.Vec3)
            .addUniform('backgroundRotation', WebGLShaderDataType.Vec4)
            .inject(ShaderInjectionTypes.gl_Position, `gl_Position.z = gl_Position.w;`);
    }
    computeShapeKey(_: ShaderComponentRegistry) {
        // BackgroundLikeMaterial
        return 'cb';
    }

    updateShapeUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        program.setUniform('backgroundUp', this.up, true);
        program.setUniform('backgroundRotation', this.quat, true);
    }
}

export interface DeferredMaterial extends Material {
    isSupportDeferred: true,
    extendEncodeDeferred(builder: ShaderBuilder): void;
    updateDeferredUniform(p: WGLProgram): void;
}

export { SceneMaterial, SceneClipMaterial, ScenePopLODMaterial } from './Scene';
