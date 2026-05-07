import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool';
import { materialProperty } from '../../../ContentAPI';
import { SceneMaterial } from '../base';

export class MeshNormalMaterial extends SceneMaterial {
    public className() {
        return 'MeshNormalMaterial';
    }
    @materialProperty()
    public isUsingWorldSpace = true;

    public extendShaderShading(b: ShaderBuilder) {
        b.addVarying(ShaderVaryingTypes.fragNormal)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4((vNormal + vec3(1.))/ 2., 1.0);');

        if (this.isUsingWorldSpace) {
            b.inject(ShaderInjectionTypes.vary_normal, 'vNormal = inverseTransformDirection(vNormal, viewMatrix);')
                .addVertex(ShaderBlockPool.InverseTransformDirection)
                .addGlobalUniform(BuiltInUniformTypes.viewMatrix);
        }
    }

    public updateShadingUniforms(_: WGLProgram) { }

    public clone() {
        return new MeshNormalMaterial().copy(this);
    }

    public copy(m: MeshNormalMaterial) {
        this.isUsingWorldSpace = m.isUsingWorldSpace;
        return this;
    }
}
