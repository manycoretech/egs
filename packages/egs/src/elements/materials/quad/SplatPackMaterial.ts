import { PassQuadMaterialBase } from './PassMaterialBase.js';
import {
    type ShaderBuilder,
    ShaderInjectionTypes,
    FragOutType,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { Vector2 } from '../../../math/Vector2.js';
import { Vector3 } from '../../../math/Vector3.js';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder.js';
import type { Splat } from '../../../scene/splat/Splat.js';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool.js';
import { Layers } from '../../../scene/tools/Layers.js';
import { TextureDataType } from '../../../utils/Constants.js';
import { RendererBackend } from '../../../renderer/IRenderer.js';

function isUSamplerType(type: TextureDataType) {
    return type === TextureDataType.UnsignedIntType || type === TextureDataType.UnsignedShortType;
}

export class SplatPackMaterial extends PassQuadMaterialBase {
    transparent = false;

    highPrecisionEnabled: boolean = false;
    outputColorAttachment: boolean = true;

    resolution: Vector2 = new Vector2(0, 0);
    offset: number = 0;
    targetOffset: number = 0;
    targetCounts: number = 0;
    layer: Layers = new Layers();
    origin = new Vector3(0, 0, 0);

    current: Splat;

    className() {
        return 'SplatPackMaterial';
    }

    update(splat: Splat) {
        this.targetOffset = splat.offset;
        this.targetCounts = splat.counts;
        this.current = splat;
        this.notifyRecompileShader();
    }

    generateShaderKey() {
        const splat = this.current;
        return HashKeyBuilder.getInstance()
            .raw(this.className())
            .bool(this.highPrecisionEnabled)
            .bool(this.outputColorAttachment)
            .raw(splat.PackType)
            .bool(!!splat.stateTex)
            .raw('e' + splat.extrasTex.length)
            .raw(splat.modifiers.map(m => m.name).join(','))
            .getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        const { current: splat, highPrecisionEnabled, outputColorAttachment } = this;
        for (let i = 0; i < splat.extrasTex.length; i++) {
            builder
                .addUniform(
                    `extraTex${i}`,
                    isUSamplerType(splat.extrasTex[i].glFormat.dataType(RendererBackend.WEBGL2_JS))
                        ? WebGLShaderDataType.USampler2D
                        : WebGLShaderDataType.Sampler2D,
                )
                .addUniform(`extraTex${i}_width`, WebGLShaderDataType.UInt);
        }
        for (let i = 0; i < splat.extrasUBO.length; i++) {
            builder.addUBO(splat.extrasUBO[i]);
        }
        for (let i = 0; i < splat.modifiers.length; i++) {
            const modifier = splat.modifiers[i];
            builder.addUBO(modifier.UBO).addFragmentCustom(modifier.header);
        }
        builder.addDefaultFragColor = false;
        builder
            .setFragOutputChannel([
                { name: 'pc_fragColor_0', type: FragOutType.Vec4 },
                { name: 'pc_fragColor_1', type: FragOutType.UVec4 },
            ])
            .when(highPrecisionEnabled, builder => builder.addNewFragOutputChannel('pc_fragColor_2', FragOutType.UVec4))
            .when(outputColorAttachment, builder => builder.addNewFragOutputChannel(`pc_fragColor_3`, FragOutType.Vec4))
            .addUniform('resolution', WebGLShaderDataType.IntVec2)
            .addUniform('offset', WebGLShaderDataType.Int)
            .addUniform('targetOffset', WebGLShaderDataType.Int)
            .addUniform('targetCounts', WebGLShaderDataType.Int)
            .addUniform('visible', WebGLShaderDataType.Bool)
            .addUniform('modelMatrix', WebGLShaderDataType.Mat4)
            .addUniform('origin', WebGLShaderDataType.Vec3)
            .when(!!splat.stateTex, builder =>
                builder
                    .addUniform('stateTex', WebGLShaderDataType.USampler2D)
                    .addUniform('stateTexWidth', WebGLShaderDataType.UInt),
            )
            .addFragment(ShaderBlockPool.SplatHeader)
            .addFragmentCustom(`
                mat3 scaleQuaternionToMatrix(vec3 s, vec4 q) {
                    return mat3(
                        s.x * (1.0 - 2.0 * (q.y * q.y + q.z * q.z)),
                        s.x * (2.0 * (q.x * q.y + q.w * q.z)),
                        s.x * (2.0 * (q.x * q.z - q.w * q.y)),
                        s.y * (2.0 * (q.x * q.y - q.w * q.z)),
                        s.y * (1.0 - 2.0 * (q.x * q.x + q.z * q.z)),
                        s.y * (2.0 * (q.y * q.z + q.w * q.x)),
                        s.z * (2.0 * (q.x * q.z + q.w * q.y)),
                        s.z * (2.0 * (q.y * q.z - q.w * q.x)),
                        s.z * (1.0 - 2.0 * (q.x * q.x + q.y * q.y))
                    );
                }
            `)
            .when(!!splat.modifiers.length, builder =>
                builder.addFragmentCustom(`
                    void modifySplat(uint idx, out Splat splat) {
                        ${splat.modifiers.map(modify => modify.content).join('\r')}
                    }
                `),
            )
            .addFragmentCustom(splat.createUnpackSplatShader())
            .inject(ShaderInjectionTypes.gl_FragColor, createFragShader(this));
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('resolution', this.resolution);
        program.setUniform('offset', this.offset);
        program.setUniform('targetOffset', this.targetOffset);
        program.setUniform('targetCounts', this.targetCounts);
        program.setUniform('origin', this.origin);

        const splat = this.current;
        program.setUniform('visible', splat.netVisibility && this.layer.test(splat.netLayer));
        program.setUniform('modelMatrix', splat.matrixWorld);

        const { extrasTex, extrasUBO, stateTex, modifiers } = splat;
        for (let i = 0; i < extrasTex.length; i++) {
            program.setTexture2D(`extraTex${i}`, extrasTex[i], true);
            program.setUniform(`extraTex${i}_width`, extrasTex[i].width, true);
        }
        for (let i = 0; i < extrasUBO.length; i++) {
            extrasUBO[i].updateWebGL(program);
        }
        if (stateTex) {
            program.setTexture2D('stateTex', stateTex);
            program.setUniform('stateTexWidth', stateTex.width);
        }
        for (let i = 0; i < modifiers.length; i++) {
            modifiers[i].UBO.updateWebGL(program);
        }
    }
}

function createFragShader(material: SplatPackMaterial): string {
    const { current: splat, highPrecisionEnabled, outputColorAttachment } = material;
    return `
        ivec2 fragCoord = ivec2(gl_FragCoord);
        int splatIndex_i = fragCoord.y * resolution.x + fragCoord.x - offset;
        if (splatIndex_i < 0 || splatIndex_i >= targetCounts) {
            discard;
        }

        pc_fragColor_0 = vec4(0.);
        pc_fragColor_1 = uvec4(0);
        ${highPrecisionEnabled ? 'pc_fragColor_2 = uvec4(0);' : ''}
        ${outputColorAttachment ? 'pc_fragColor_3 = vec4(0.);' : ''}

        if (!visible) {
            return;
        }

        uint splatIndex = uint(splatIndex_i + targetOffset);
        uint state = 1u;
        ${
            !!splat.stateTex
                ? `
                    state = texelFetch(stateTex, ivec2(splatIndex % stateTexWidth, splatIndex / stateTexWidth), 0).r;
                    if ((state & 1u) != 0u) {
                        return;
                    }
                    state |= 1u;
                `
                : ''
        }

        Splat splat;
        unpackSplat(splatIndex, splat);
        if (splat.color.a < MIN_ALPHA) {
            return;
        }
        if (all(equal(splat.scales, vec3(0.0)))) {
            return;
        }

        ${!!splat.modifiers.length ? 'modifySplat(splatIndex, splat);' : ''}

        vec3 center = (modelMatrix * vec4(splat.center, 1.0)).xyz - origin;
        mat3 rs = mat3(modelMatrix) * scaleQuaternionToMatrix(splat.scales, splat.quaternion);
        mat3 cov = rs * transpose(rs);

        pc_fragColor_0 = vec4(center, float(state));
        ${
            highPrecisionEnabled
                ? `
                    pc_fragColor_1 = uvec4(
                        floatBitsToUint(cov[0][0]),
                        floatBitsToUint(cov[1][1]),
                        0u,
                        0u
                    );
                    pc_fragColor_2 = uvec4(
                        floatBitsToUint(cov[2][2]),
                        floatBitsToUint(cov[0][1]),
                        floatBitsToUint(cov[0][2]),
                        floatBitsToUint(cov[1][2])
                    );
                `
                : `
                    float sx2 = cov[0][0];
                    float sy2 = cov[1][1];
                    float sz2 = cov[2][2];
                    const float RHO_MAX = 0.999;
                    float rho_xy = clamp(cov[0][1] / sqrt(sx2 * sy2), -RHO_MAX, RHO_MAX);
                    float rho_xz = clamp(cov[0][2] / sqrt(sx2 * sz2), -RHO_MAX, RHO_MAX);
                    float rho_yz = clamp(cov[1][2] / sqrt(sy2 * sz2), -RHO_MAX, RHO_MAX);

                    sx2 = clamp(log2(sx2), -60.0, 60.0);
                    sy2 = clamp(log2(sy2), -60.0, 60.0);
                    sz2 = clamp(log2(sz2), -60.0, 60.0);

                    pc_fragColor_1 = uvec4(
                        packHalf2x16(vec2(sx2, sy2)),
                        packHalf2x16(vec2(sz2, rho_xy)),
                        packHalf2x16(vec2(rho_xz, rho_yz)),
                        0u
                    );
                `
        }
        ${
            outputColorAttachment
                ? 'pc_fragColor_3 = splat.color;'
                : highPrecisionEnabled
                  ? `
                        pc_fragColor_1.z = packHalf2x16(splat.color.rg);
                        pc_fragColor_1.w = packHalf2x16(splat.color.ba);
                    `
                  : `
                        uvec4 uColor = uvec4(round(saturate(splat.color) * 255.0));
                        pc_fragColor_1.w = uColor.r | (uColor.g << 8u) | (uColor.b << 16u) | (uColor.a << 24u);
                    `
        }
    `;
}
