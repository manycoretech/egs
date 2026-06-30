import {
    type ShaderBuilder,
    ShaderInjectionTypes,
    ShaderVaryingTypes,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms.js';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool.js';
import { materialProperty } from '../../../ContentAPI.js';
import { SceneMaterial } from '../base/index.js';

/**
 * Material that shades meshes by their normals.
 */
export class MeshNormalMaterial extends SceneMaterial {
    className() {
        return 'MeshNormalMaterial';
    }
    @materialProperty()
    isUsingWorldSpace = true;

    extendShaderShading(b: ShaderBuilder) {
        b.addVarying(ShaderVaryingTypes.fragNormal).inject(
            ShaderInjectionTypes.gl_FragColor,
            'gl_FragColor = vec4((vNormal + vec3(1.))/ 2., 1.0);',
        );

        if (this.isUsingWorldSpace) {
            b.inject(ShaderInjectionTypes.vary_normal, 'vNormal = inverseTransformDirection(vNormal, viewMatrix);')
                .addVertex(ShaderBlockPool.InverseTransformDirection)
                .addGlobalUniform(BuiltInUniformTypes.viewMatrix);
        }
    }

    updateShadingUniforms(_: WGLProgram) {}

    clone() {
        return new MeshNormalMaterial().copy(this);
    }

    copy(m: MeshNormalMaterial) {
        this.isUsingWorldSpace = m.isUsingWorldSpace;
        return this;
    }
}
