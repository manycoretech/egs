import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderInjectionTypes, ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { Material } from '../Material';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { Color } from '../../../math/Color';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms';
import { TextureV2 } from '../../textures/TextureV2';

export class SplatKernelHighlightMaterial extends Material {
    depthTest = false;

    size = 2;
    color = new Color(0, 0, 1);
    centerTex: TextureV2;
    orderTex: TextureV2;

    className() {
        return 'SplatKernelHighlightMaterial';
    }

    computeShapeKey() { return 'SplatKernelHighlight'; }
    extendShaderShape(_builder: ShaderBuilder, _: ShaderComponentRegistry) { }
    updateShapeUniforms(_p: WGLProgram, _: ShaderComponentRegistry) { }

    extendShaderShading(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder
            .addGlobalUniform(BuiltInUniformTypes.projectionMatrix)
            .addGlobalUniform(BuiltInUniformTypes.viewMatrix)
            .addUniform('size', WebGLShaderDataType.Float)
            .addUniform('color', WebGLShaderDataType.Vec3)
            .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
            .addUniform('packedTexWidth', WebGLShaderDataType.UInt)
            .addUniform('orderTex', WebGLShaderDataType.USampler2D)
            .addUniform('orderTexWidth', WebGLShaderDataType.UInt)
            .addVaryingCustom('vColor', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.gl_PointSize, 'gl_PointSize = size;')
            .inject(ShaderInjectionTypes.gl_Position, VERTEX_SHADER)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(color, 1.0);');
    }

    updateShadingUniforms(program: WGLProgram, _registry: ShaderComponentRegistry) {
        program.setUniform('size', this.size);
        program.setUniform('color', this.color);
        program.setTexture2D('centerTex', this.centerTex);
        program.setUniform('packedTexWidth', this.centerTex.width);
        program.setTexture2D('orderTex', this.orderTex);
        program.setUniform('orderTexWidth', this.orderTex.width);
    }

    copy(_other: SplatKernelHighlightMaterial) { }
    clone() { return this; }
}

const VERTEX_SHADER = `
uint orderIndex = uint(gl_InstanceID);
uint splatIndex = texelFetch(orderTex, ivec2(orderIndex % orderTexWidth, orderIndex / orderTexWidth), 0).r;
ivec2 texCoord = ivec2(splatIndex % packedTexWidth, splatIndex / packedTexWidth);
vec3 center = texelFetch(centerTex, texCoord, 0).xyz;
vColor = color;
gl_Position = projectionMatrix * viewMatrix * vec4(center, 1.0);
`;
