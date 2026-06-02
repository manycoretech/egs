import { PassQuadMaterialBase } from './PassMaterialBase';
import { ShaderBuilder, ShaderInjectionTypes, FragOutType } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { Vector2 } from '../../../math/Vector2';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { Splat, SplatEffectConfig } from '../../../scene/splat/Splat';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool';
import { Layers } from '../../../scene/tools/Layers';
import { TextureDataType } from '../../../utils/Constants';
import { RendererBackend } from '../../../renderer/IRenderer';

function isUSamplerType(type: TextureDataType) {
    return type === TextureDataType.UnsignedIntType || type === TextureDataType.UnsignedShortType;
}

export class SplatPackMaterial extends PassQuadMaterialBase {
    transparent = false;

    outputColorAttachment: boolean = true;

    resolution: Vector2 = new Vector2(0, 0);
    offset: number = 0;
    targetOffset: number = 0;
    targetCounts: number = 0;
    layer: Layers = new Layers();

    private current: Splat;

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
            .bool(this.outputColorAttachment)
            .raw(splat.PackType)
            .bool(!!splat.stateTex)
            .bool(!!splat.groupTex)
            .raw('e' + splat.extrasTex.length)
            .bool(splat.effect.enabled)
            .bool(splat.effect.pulseEnabled)
            .bool(splat.effect.ringEnabled)
            .bool(splat.effect.spreadEnabled)
            .bool(splat.effect.remyEnabled)
            .bool(splat.effect.magicEnabled)
            .bool(splat.effect.overrideEnabled)
            .getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        const { current: splat, outputColorAttachment } = this;
        const enableState = !!splat.stateTex;
        const enableGroupTransform = !!splat.groupTex && !!splat.groupTransformTex;
        const effect = splat.effect;

        for (let i = 0; i < splat.extrasTex.length; i++) {
            builder
                .addUniform(`extraTex${i}`, isUSamplerType(splat.extrasTex[i].glFormat.dataType(RendererBackend.WEBGL2_JS)) ? WebGLShaderDataType.USampler2D : WebGLShaderDataType.Sampler2D)
                .addUniform(`extraTex${i}_width`, WebGLShaderDataType.UInt);
        }
        for (let i = 0; i < splat.extrasUBO.length; i++) {
            builder.addUBO(splat.extrasUBO[i]);
        }
        builder.addDefaultFragColor = false;
        builder
            .setFragOutputChannel([
                { name: 'pc_fragColor_0', type: FragOutType.UVec4 },
                { name: 'pc_fragColor_1', type: FragOutType.Vec4 },
            ])
            .when(outputColorAttachment, builder => builder.addNewFragOutputChannel('pc_fragColor_2', FragOutType.Vec4))
            .addUniform('resolution', WebGLShaderDataType.IntVec2)
            .addUniform('offset', WebGLShaderDataType.Int)
            .addUniform('targetOffset', WebGLShaderDataType.Int)
            .addUniform('targetCounts', WebGLShaderDataType.Int)
            .addUniform('visible', WebGLShaderDataType.Bool)
            .addUniform('modelMatrix', WebGLShaderDataType.Mat4)
            .when(enableState, builder => {
                builder
                    .addUniform('stateTex', WebGLShaderDataType.USampler2D)
                    .addUniform('stateTexWidth', WebGLShaderDataType.UInt);
                return builder;
            })
            .when(enableGroupTransform, builder => {
                builder
                    .addUniform('groupTex', WebGLShaderDataType.USampler2D)
                    .addUniform('groupTexWidth', WebGLShaderDataType.UInt)
                    .addUniform('groupTransformTex', WebGLShaderDataType.Sampler2D);
                return builder;
            })
            .when(effect.enabled, builder => updateShaderBuilder(effect, builder))
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
            .addFragmentCustom(splat.createUnpackSplatShader())
            .inject(ShaderInjectionTypes.gl_FragColor, `
                ivec2 fragCoord = ivec2(gl_FragCoord);
                int splatIndex_i = fragCoord.y * resolution.x + fragCoord.x - offset;
                if (splatIndex_i < 0 || splatIndex_i >= targetCounts) {
                    discard;
                }

                pc_fragColor_0 = uvec4(0);
                pc_fragColor_1 = vec4(0.);
                ${outputColorAttachment ? 'pc_fragColor_2 = vec4(0.);' : ''}

                if (!visible) {
                    return;
                }

                uint splatIndex = uint(splatIndex_i + targetOffset);
                uint state = 1u;
                ${enableState ? `
                    state = texelFetch(stateTex, ivec2(splatIndex % stateTexWidth, splatIndex / stateTexWidth), 0).r;
                    if ((state & 1u) != 0u) {
                        return;
                    }
                    state |= 1u;
                ` : ''}

                Splat splat;
                unpackSplat(splatIndex, splat);
                if (splat.color.a < MIN_ALPHA) {
                    return;
                }
                if (all(equal(splat.scales, vec3(0.0)))) {
                    return;
                }

                mat4 mMatrix = modelMatrix;
                ${enableGroupTransform ? `
                    uint paletteIdx = texelFetch(groupTex, ivec2(splatIndex % groupTexWidth, splatIndex / groupTexWidth), 0).r;
                    mat4 transform;
                    transform[0] = texelFetch(groupTransformTex, ivec2(0, paletteIdx), 0);
                    transform[1] = texelFetch(groupTransformTex, ivec2(1, paletteIdx), 0);
                    transform[2] = texelFetch(groupTransformTex, ivec2(2, paletteIdx), 0);
                    transform[3] = vec4(0.0, 0.0, 0.0, 1.0);
                    mMatrix = mMatrix * transpose(transform);
                ` : ''}

                ${createEffectShader(effect)}

                vec3 center = (mMatrix * vec4(splat.center, 1.0)).xyz;
                mat3 rs = mat3(mMatrix) * scaleQuaternionToMatrix(splat.scales, splat.quaternion);
                mat3 cov = rs * transpose(rs);

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

                pc_fragColor_0 = uvec4(
                    packHalf2x16(vec2(sx2, sy2)),
                    packHalf2x16(vec2(sz2, rho_xy)),
                    packHalf2x16(vec2(rho_xz, rho_yz)),
                    0u
                );
                pc_fragColor_1 = vec4(center, float(state));
                ${outputColorAttachment ? `
                    pc_fragColor_2 = splat.color;
                ` : `
                    uvec4 uColor = uvec4(round(saturate(splat.color) * 255.0));
                    pc_fragColor_0.w = uColor.r | (uColor.g << 8u) | (uColor.b << 16u) | (uColor.a << 24u);
                `}
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('resolution', this.resolution);
        program.setUniform('offset', this.offset);
        program.setUniform('targetOffset', this.targetOffset);
        program.setUniform('targetCounts', this.targetCounts);

        const splat = this.current;
        program.setUniform('visible', splat.netVisibility && this.layer.test(splat.netLayer));
        program.setUniform('modelMatrix', splat.matrixWorld);

        const { extrasTex, extrasUBO, stateTex, groupTex, groupTransformTex, effect } = splat;
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
        if (groupTex && groupTransformTex) {
            program.setTexture2D('groupTex', groupTex);
            program.setUniform('groupTexWidth', groupTex.width);
            program.setTexture2D('groupTransformTex', groupTransformTex);
        }
        updateEffectUniform(effect, program);
    }
}

function updateEffectUniform(effect: SplatEffectConfig, program: WGLProgram) {
    if (!effect.enabled) {
        return;
    }
    if (effect.pulseEnabled) {
        program.setUniform('pulseSparseThreshold', effect.pulseSparseThreshold);
        program.setUniform('pulseJitterPhase', effect.pulseJitterPhase);
        program.setUniform('pulseJitterAmount', effect.pulseJitterAmount);
        program.setUniform('pulsePhase', effect.pulsePhase);
        program.setUniform('pulseAmount', effect.pulseAmount);
        program.setUniform('pulseSize', effect.pulseSize);
        program.setUniform('pulseSizeVariance', effect.pulseSizeVariance);
        program.setUniform('pulseColorBoost', effect.pulseColorBoost);
    }
    if (effect.ringEnabled) {
        program.setUniform('ringInnerRegionVisible', effect.ringInnerRegionVisible);
        program.setUniform('ringOrigin', effect.ringOrigin);
        program.setUniform('ringRadius', effect.ringRadius);
        program.setUniform('ringWidth', effect.ringWidth);
        program.setUniform('ringColor', effect.ringColor);
    }
    if (effect.spreadEnabled) {
        program.setUniform('spreadRadius', effect.spreadRadius);
        program.setUniform('spreadOrigin', effect.spreadOrigin);
        program.setUniform('spreadPreRadius', effect.spreadPreRadius);
        program.setUniform('spreadPreScale', effect.spreadPreScale);
        program.setUniform('spreadColorBlendRadius', effect.spreadColorBlendRadius);
        program.setUniform('spreadColorBlendBase', effect.spreadColorBlendBase);
    }
    if (effect.remyEnabled) {
        program.setUniform('remyOrigin', effect.remyOrigin);
        program.setUniform('remyPreRadius', effect.remyPreRadius);
        program.setUniform('remyPreScale', effect.remyPreScale);
        program.setUniform('remyDenseRadius', effect.remyDenseRadius);
        program.setUniform('remyDenseScale', effect.remyDenseScale);
        program.setUniform('remyDenseMinRatio', effect.remyDenseMinRatio);
        program.setUniform('remyDenseMaxRatio', effect.remyDenseMaxRatio);
        program.setUniform('remyColorBlendRadius', effect.remyColorBlendRadius);
        program.setUniform('remyColorBlendBase', effect.remyColorBlendBase);
        program.setUniform('remyNormalRadius', effect.remyNormalRadius);
        program.setUniform('remyRingRadius', effect.remyRingRadius);
        program.setUniform('remyRingWidth', effect.remyRingWidth);
        program.setUniform('remyRingInnerColor', effect.remyRingInnerColor);
        program.setUniform('remyRingMidRatios', effect.remyRingMidRatios);
        program.setUniform('remyRingMidColor', effect.remyRingMidColor);
        program.setUniform('remyRingOuterColor', effect.remyRingOuterColor);
    }
    if (effect.magicEnabled) {
        program.setUniform('magicOrigin', effect.magicOrigin);
        program.setUniform('magicInitialSize', effect.magicInitialSize);
        program.setUniform('magicInitialAlpha', effect.magicInitialAlpha);
        program.setUniform('magicInitialDensity', effect.magicInitialDensity);
        program.setUniform('magicExpandRadius', effect.magicExpandRadius);
        program.setUniform('magicExpandJitterAmount', effect.magicExpandJitterAmount);
        program.setUniform('magicExpandScale', effect.magicExpandScale);
        program.setUniform('magicColorBlendRadius', effect.magicColorBlendRadius);
        program.setUniform('magicColorBlendBase', effect.magicColorBlendBase);
        program.setUniform('magicRingRadius', effect.magicRingRadius);
        program.setUniform('magicRingWidth', effect.magicRingWidth);
        program.setUniform('magicRingColor', effect.magicRingColor);
        program.setUniform('magicRingJitterAmount', effect.magicRingJitterAmount);
    }
    if (effect.overrideEnabled) {
        program.setUniform('overrideColor', effect.overrideColor);
    }
}

function updateShaderBuilder(effect: SplatEffectConfig, builder: ShaderBuilder) {
    if (effect.pulseEnabled) {
        builder
            .addUniform('pulseSparseThreshold', WebGLShaderDataType.Float)
            .addUniform('pulseJitterPhase', WebGLShaderDataType.Float)
            .addUniform('pulseJitterAmount', WebGLShaderDataType.Float)
            .addUniform('pulsePhase', WebGLShaderDataType.Float)
            .addUniform('pulseAmount', WebGLShaderDataType.Float)
            .addUniform('pulseSize', WebGLShaderDataType.Float)
            .addUniform('pulseSizeVariance', WebGLShaderDataType.Float)
            .addUniform('pulseColorBoost', WebGLShaderDataType.Float)
            .addFragment(ShaderBlockPool.Hash);
    }
    if (effect.ringEnabled) {
        builder
            .addUniform('ringEnabled', WebGLShaderDataType.Bool)
            .addUniform('ringInnerRegionVisible', WebGLShaderDataType.Bool)
            .addUniform('ringOrigin', WebGLShaderDataType.Vec3)
            .addUniform('ringRadius', WebGLShaderDataType.Float)
            .addUniform('ringWidth', WebGLShaderDataType.Float)
            .addUniform('ringColor', WebGLShaderDataType.Vec3);
    }
    if (effect.spreadEnabled) {
        builder
            .addUniform('spreadRadius', WebGLShaderDataType.Float)
            .addUniform('spreadOrigin', WebGLShaderDataType.Vec3)
            .addUniform('spreadPreRadius', WebGLShaderDataType.Float)
            .addUniform('spreadPreScale', WebGLShaderDataType.Float)
            .addUniform('spreadColorBlendRadius', WebGLShaderDataType.Float)
            .addUniform('spreadColorBlendBase', WebGLShaderDataType.Vec4);
    }
    if (effect.remyEnabled) {
        builder
            .addFragment(ShaderBlockPool.Hash)
            .addUniform('remyOrigin', WebGLShaderDataType.Vec3)
            .addUniform('remyPreRadius', WebGLShaderDataType.Float)
            .addUniform('remyPreScale', WebGLShaderDataType.Float)
            .addUniform('remyDenseRadius', WebGLShaderDataType.Float)
            .addUniform('remyDenseScale', WebGLShaderDataType.Float)
            .addUniform('remyDenseMinRatio', WebGLShaderDataType.Float)
            .addUniform('remyDenseMaxRatio', WebGLShaderDataType.Float)
            .addUniform('remyColorBlendRadius', WebGLShaderDataType.Float)
            .addUniform('remyColorBlendBase', WebGLShaderDataType.Vec4)
            .addUniform('remyNormalRadius', WebGLShaderDataType.Float)
            .addUniform('remyRingRadius', WebGLShaderDataType.Float)
            .addUniform('remyRingWidth', WebGLShaderDataType.Float)
            .addUniform('remyRingInnerColor', WebGLShaderDataType.Vec4)
            .addUniform('remyRingMidRatios', WebGLShaderDataType.Float)
            .addUniform('remyRingMidColor', WebGLShaderDataType.Vec4)
            .addUniform('remyRingOuterColor', WebGLShaderDataType.Vec4);
    }
    if (effect.magicEnabled) {
        builder
            .addFragment(ShaderBlockPool.Hash)
            .addUniform('magicOrigin', WebGLShaderDataType.Vec3)
            .addUniform('magicInitialSize', WebGLShaderDataType.Float)
            .addUniform('magicInitialAlpha', WebGLShaderDataType.Float)
            .addUniform('magicInitialDensity', WebGLShaderDataType.Float)
            .addUniform('magicExpandRadius', WebGLShaderDataType.Float)
            .addUniform('magicExpandJitterAmount', WebGLShaderDataType.Float)
            .addUniform('magicExpandScale', WebGLShaderDataType.Float)
            .addUniform('magicColorBlendRadius', WebGLShaderDataType.Float)
            .addUniform('magicColorBlendBase', WebGLShaderDataType.Vec4)
            .addUniform('magicRingRadius', WebGLShaderDataType.Float)
            .addUniform('magicRingWidth', WebGLShaderDataType.Float)
            .addUniform('magicRingColor', WebGLShaderDataType.Vec4)
            .addUniform('magicRingJitterAmount', WebGLShaderDataType.Float);
    }
    if (effect.overrideEnabled) {
        builder.addUniform('overrideColor', WebGLShaderDataType.Vec4);
    }

    return builder;
}

function createEffectShader(effect: SplatEffectConfig): string {
    if (!effect.enabled) {
        return '';
    }

    return `
        ${effect.pulseEnabled ? `
            float hash_id = hash(float(splatIndex));
            if (hash_id < pulseSparseThreshold) {
                return;
            }
            float h = fract(hash_id * 1.318 + hash_id * hash_id * 0.233);
            vec3 jitter = sin(vec3(
                pulseJitterPhase + h * PI2,
                pulseJitterPhase * 1.13 + h * PI,
                pulseJitterPhase * 0.87 + h * PI_HALF
            )) * pulseJitterAmount;
            splat.center += jitter;
            float pulse = 1.0 + sin(pulsePhase + h * PI2 * 0.8) * pulseAmount;
            float scaleFactor = pulseSize * (1.0 + h * pulseSizeVariance);
            splat.scales = vec3(pulse * scaleFactor);
            splat.color *= pulseColorBoost;
        ` : ''}

        ${effect.ringEnabled ? `
            float distanceToReference = length(splat.center - ringOrigin);
            if ((distanceToReference <= ringRadius) != ringInnerRegionVisible) {
                return;
            }
            float distanceFromRing = abs(distanceToReference - ringRadius);
            float ringFactor = 1.0 - smoothstep(0.0, ringWidth, distanceFromRing);
            vec3 finalColor = mix(splat.color.rgb, ringColor, ringFactor * 0.8);
            splat.color.rgb = finalColor;
        ` : ''}

        ${effect.spreadEnabled ? `
            float distance = length((splat.center - spreadOrigin).xy);
            float t_main = saturate(spreadRadius - distance);
            vec3 scale_main = mix(vec3(0.0), splat.scales, t_main);
            float t_pre = saturate(spreadPreRadius - distance);
            vec3 scale_pre = mix(vec3(0.0), splat.scales * spreadPreScale, t_pre);
            splat.scales = max(scale_main, scale_pre);
            float t_col = saturate(spreadColorBlendRadius - distance);
            splat.color = mix(spreadColorBlendBase, splat.color, t_col);
        ` : ''}

        ${effect.remyEnabled ? `
            float hash_id = hash(float(splatIndex));
            float distance = length(splat.center - remyOrigin);
            vec3 scale = splat.scales;
            vec4 color = splat.color;

            float stage_0_mask = saturate(remyPreRadius - distance);
            scale = mix(vec3(0.0), vec3(remyPreScale), stage_0_mask);

            float stage_1_mask = saturate(remyDenseRadius - distance);
            scale += scale * remyDenseScale * stage_1_mask;
            scale *= step(hash_id, remyDenseMinRatio + (remyDenseMaxRatio - remyDenseMinRatio) * smoothstep(0., 1., stage_1_mask));

            float stage_2_mask = saturate(remyColorBlendRadius - distance);
            color = mix(color, remyColorBlendBase, stage_2_mask);

            float stage_3_mask = step(0., remyNormalRadius - distance);
            if (stage_3_mask == 1.0) {
                scale = splat.scales;
                color = splat.color;
            }

            float stage_4_mask = clamp(remyRingRadius - distance, 0.0, remyRingWidth);
            float phase = stage_4_mask / remyRingWidth;
            vec4 cloudColor;
            if (phase < remyRingMidRatios) {
                float u = smoothstep(0.0, remyRingMidRatios, phase);
                cloudColor = mix(remyRingOuterColor, remyRingMidColor, u);
            } else {
                float u = smoothstep(remyRingMidRatios, 1.0, phase);
                cloudColor = mix(remyRingMidColor, remyRingInnerColor, u);
            }
            float cloudMask = smoothstep(0.0, 0.4, stage_4_mask) * (1.0 - smoothstep(remyRingWidth - 0.4, remyRingWidth, stage_4_mask));
            color += cloudColor * cloudMask;

            splat.scales = scale;
            splat.color = color;
        ` : ''}

        ${effect.magicEnabled ? `
            float hash_id = hash(float(splatIndex));
            float distance = length(splat.center - magicOrigin);
            float distanceXY = length(splat.center.xy - magicOrigin.xy);
            vec3 effectCenter = splat.center;
            vec3 effectScale = splat.scales;
            vec4 effectColor = splat.color;

            float stage_0_mask = saturate(magicExpandRadius - distance);
            vec3 jitter = normalize(vec3(
                sin(hash_id * 12.9898),
                cos(hash_id * 78.233),
                sin(hash_id * 45.164)
            )) * magicExpandJitterAmount;
            effectCenter -= jitter * (1.0 - saturate(pow(stage_0_mask, 2.0)));
            effectScale = mix(vec3(magicInitialSize), vec3(magicInitialSize * magicExpandScale), stage_0_mask) * step(hash_id, magicInitialDensity);
            effectColor.a *= magicInitialAlpha;

            float stage_1_mask = saturate(magicColorBlendRadius - distance);
            effectColor = mix(effectColor, magicColorBlendBase, stage_1_mask);

            float distanceToRing = magicRingRadius - distanceXY;
            float ringMask = step(0.0, distanceToRing);
            float phase = 1.0 - distanceToRing / magicRingWidth;
            float phaseMask = step(0.0, phase);
            effectCenter += vec3(0., 0., magicRingJitterAmount) * sin(saturate(phase) * PI) * phaseMask;
            effectColor = mix(effectColor, magicRingColor, phaseMask * ringMask);

            float resetMask = ringMask * (1.0 - phaseMask);
            splat.center = mix(effectCenter, splat.center, resetMask);
            splat.scales = mix(effectScale, splat.scales, resetMask);
            splat.color = mix(effectColor, splat.color, resetMask);
        ` : ''}

        ${effect.overrideEnabled ? `
            splat.color = overrideColor;
        ` : ''}
    `;
}
