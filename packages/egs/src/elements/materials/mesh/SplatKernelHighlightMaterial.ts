import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder.js';
import { Material } from '../Material.js';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry.js';
import { Color } from '../../../math/Color.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms.js';
import type { TextureV2 } from '../../textures/TextureV2.js';
import { Vector3 } from '../../../math/Vector3.js';
import { Vector4 } from '../../../math/Vector4.js';

export class SplatKernelHighlightMaterial extends Material {
    depthTest = false;

    size = 2;
    color = new Color(0, 0, 1);
    selectedColor: Vector4 = new Vector4(1, 1, 0, 0);
    origin: Vector3 = new Vector3(0, 0, 0);
    centerTex: TextureV2;
    orderTex: TextureV2;

    className() {
        return 'SplatKernelHighlightMaterial';
    }

    computeShapeKey() {
        return 'SplatKernelHighlight';
    }
    extendShaderShape(_builder: ShaderBuilder, _: ShaderComponentRegistry) {}
    updateShapeUniforms(_p: WGLProgram, _: ShaderComponentRegistry) {}

    extendShaderShading(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder
            .addGlobalUniform(BuiltInUniformTypes.projectionMatrix)
            .addGlobalUniform(BuiltInUniformTypes.viewMatrix)
            .addUniform('size', WebGLShaderDataType.Float)
            .addUniform('color', WebGLShaderDataType.Vec3)
            .addUniform('selectedColor', WebGLShaderDataType.Vec4)
            .addUniform('origin', WebGLShaderDataType.Vec3)
            .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
            .addUniform('packedTexWidth', WebGLShaderDataType.UInt)
            .addUniform('orderTex', WebGLShaderDataType.USampler2D)
            .addUniform('orderTexWidth', WebGLShaderDataType.UInt)
            .addVaryingCustom('vColor', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.gl_PointSize, 'gl_PointSize = size;')
            .inject(ShaderInjectionTypes.gl_Position, VERTEX_SHADER)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(vColor, 1.0);');
    }

    updateShadingUniforms(program: WGLProgram, _registry: ShaderComponentRegistry) {
        program.setUniform('size', this.size);
        program.setUniform('origin', this.origin);
        program.setUniform('color', this.color);
        program.setUniform('selectedColor', this.selectedColor);
        program.setTexture2D('centerTex', this.centerTex);
        program.setUniform('packedTexWidth', this.centerTex.width);
        program.setTexture2D('orderTex', this.orderTex);
        program.setUniform('orderTexWidth', this.orderTex.width);
    }

    copy(_other: SplatKernelHighlightMaterial) {}
    clone() {
        return this;
    }
}

const VERTEX_SHADER = `
uint orderIndex = uint(gl_InstanceID);
uint splatIndex = texelFetch(orderTex, ivec2(orderIndex % orderTexWidth, orderIndex / orderTexWidth), 0).r;
ivec2 texCoord = ivec2(splatIndex % packedTexWidth, splatIndex / packedTexWidth);
vec4 pixel_0 = texelFetch(centerTex, texCoord, 0);
vec3 center = pixel_0.xyz + origin;
uint vertexState = uint(pixel_0.w + 0.5);
vColor = mix(color.xyz, selectedColor.xyz, (vertexState & 2u) != 0u ? selectedColor.a : 0.0);
gl_Position = projectionMatrix * viewMatrix * vec4(center, 1.0);
`;
