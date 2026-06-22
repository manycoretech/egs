import { Material } from '../Material';
import { type ShaderBuilder, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms';
import { Side } from '../../../utils/Constants';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool';
import { Vector3 } from '../../../math/Vector3';
import { Vector4 } from '../../../math/Vector4';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import type { TextureV2 } from '../../textures/TextureV2';

export class SplattingMaterial extends Material {
    transparent = true;
    premultipliedAlpha = true;
    depthWrite = false;
    side = Side.DoubleSide;

    highPrecisionEnabled: boolean = false;
    sortedLayoutEnabled: boolean = false;
    normalizedFalloff: boolean = false;
    maxStdDev: number = Math.sqrt(8);
    maxPixelRadius: number = 1024;
    preBlurAmount: number = 0.3;
    blurAmount: number = 0;
    focalAdjustment: number = 2;
    detailCullingThreshold: number = 1;
    selectedColor: Vector4 = new Vector4(1, 1, 0, 1);

    shadingPickIdEnabled: boolean = false;

    count: number = 0;
    origin: Vector3 = new Vector3(0, 0, 0);
    centerTex: TextureV2;
    covTex: TextureV2;
    covExtTex: TextureV2;
    orderTex: TextureV2;

    className() {
        return 'SplattingMaterial';
    }

    generateShaderKey() {
        return HashKeyBuilder.getInstance()
            .raw(this.className())
            .bool(this.highPrecisionEnabled)
            .bool(this.sortedLayoutEnabled)
            .bool(this.normalizedFalloff)
            .bool(this.shadingPickIdEnabled)
            .getKey();
    }

    computeShapeKey() {
        return 'splatting';
    }
    updateShapeUniforms(_program: WGLProgram) {}
    extendShaderShape(_builder: ShaderBuilder) {}

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addGlobalUniform(BuiltInUniformTypes.resolution)
            .addGlobalUniform(BuiltInUniformTypes.projectionMatrix)
            .addGlobalUniform(BuiltInUniformTypes.viewMatrix)
            .addUniform('count', WebGLShaderDataType.UInt)
            .addUniform('maxStdDev', WebGLShaderDataType.Float)
            .addUniform('maxPixelRadius', WebGLShaderDataType.Float)
            .addUniform('preBlurAmount', WebGLShaderDataType.Float)
            .addUniform('blurAmount', WebGLShaderDataType.Float)
            .addUniform('focalAdjustment', WebGLShaderDataType.Float)
            .addUniform('detailCullingThreshold', WebGLShaderDataType.Float)
            .addUniform('selectedColor', WebGLShaderDataType.Vec4)
            .addUniform('origin', WebGLShaderDataType.Vec3)
            .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
            .addUniform('packedTexWidth', WebGLShaderDataType.UInt)
            .addUniform('covTex', WebGLShaderDataType.USampler2D)
            .when(this.highPrecisionEnabled, builder => builder.addUniform('covExtTex', WebGLShaderDataType.USampler2D))
            .when(!this.sortedLayoutEnabled, builder =>
                builder
                    .addUniform('orderTex', WebGLShaderDataType.USampler2D)
                    .addUniform('orderTexWidth', WebGLShaderDataType.UInt),
            )
            .addVaryingCustom('vColor', WebGLShaderDataType.Vec4)
            .addVaryingCustom('vSplatUv', WebGLShaderDataType.Vec2)
            .when(this.shadingPickIdEnabled, builder =>
                builder.addVertexCustom(`flat out uint vId;`).addFragmentCustom(`flat in uint vId;`),
            )
            .addVertex(ShaderBlockPool.SplatHeader)
            .inject(ShaderInjectionTypes.gl_Position, createVertexShader(this))
            .addFragment(ShaderBlockPool.SplatHeader)
            .addFragment(ShaderBlockPool.FastEXP)
            .addFragment(ShaderBlockPool.ColorTransferFunctions)
            .inject(ShaderInjectionTypes.gl_FragColor, createFragmentShader(this));
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('count', this.count);
        program.setUniform('maxStdDev', this.maxStdDev);
        program.setUniform('maxPixelRadius', this.maxPixelRadius);
        program.setUniform('preBlurAmount', this.preBlurAmount);
        program.setUniform('blurAmount', this.blurAmount);
        program.setUniform('focalAdjustment', this.focalAdjustment);
        program.setUniform('detailCullingThreshold', this.detailCullingThreshold);
        program.setUniform('selectedColor', this.selectedColor);
        program.setUniform('origin', this.origin);
        program.setTexture2D('centerTex', this.centerTex);
        program.setTexture2D('covTex', this.covTex);
        program.setUniform('packedTexWidth', this.centerTex.width);
        if (this.highPrecisionEnabled) {
            program.setTexture2D('covExtTex', this.covExtTex);
        }
        if (!this.sortedLayoutEnabled) {
            program.setTexture2D('orderTex', this.orderTex);
            program.setUniform('orderTexWidth', this.orderTex.width);
        }
    }

    clone(): Material {
        return this;
    }
    copy(_other: Material) {}
}

function createVertexShader(material: SplattingMaterial): string {
    const { sortedLayoutEnabled, shadingPickIdEnabled, highPrecisionEnabled } = material;
    return `
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);

        uint splatIndex = uint(gl_VertexID / 4 + 128 * gl_InstanceID);
        if (splatIndex >= count) {
            return;
        }
        ${!sortedLayoutEnabled ? `splatIndex = texelFetch(orderTex, ivec2(splatIndex % orderTexWidth, splatIndex / orderTexWidth), 0).r;` : ''}

        ivec2 texCoord = ivec2(splatIndex % packedTexWidth, splatIndex / packedTexWidth);
        vec4 pixel_0 = texelFetch(centerTex, texCoord, 0);
        uint vertexState = uint(pixel_0.w + 0.5);
        vec3 center = pixel_0.xyz + origin;
        vec4 viewCenter = viewMatrix * vec4(center, 1.0);
        if (viewCenter.z >= 0.0) {
            return;
        }
        vec4 clipCenter = projectionMatrix * viewCenter;
        if (abs(clipCenter.z) >= clipCenter.w) {
            return;
        }

        ${
            highPrecisionEnabled
                ? `
                    uvec4 covData = texelFetch(covTex, texCoord, 0);
                    vec4 covExtData = uintBitsToFloat(texelFetch(covExtTex, texCoord, 0));
                    mat3 mCov3D = mat3(
                        uintBitsToFloat(covData.x), covExtData.y, covExtData.z,
                        covExtData.y, uintBitsToFloat(covData.y), covExtData.w,
                        covExtData.z, covExtData.w, covExtData.x
                    );
                    vec4 color = vec4(
                        unpackHalf2x16(covData.z),
                        unpackHalf2x16(covData.w)
                    );
                `
                : `
                    uvec4 covData = texelFetch(covTex, texCoord, 0);
                    vec2 covA = unpackHalf2x16(covData.x);
                    vec2 covB = unpackHalf2x16(covData.y);
                    vec2 covC = unpackHalf2x16(covData.z);
                    float sx2 = exp2(covA.x);
                    float sy2 = exp2(covA.y);
                    float sz2 = exp2(covB.x);
                    float xy = covB.y * exp2(0.5 * (covA.x + covA.y));
                    float xz = covC.x * exp2(0.5 * (covA.x + covB.x));
                    float yz = covC.y * exp2(0.5 * (covA.y + covB.x));
                    mat3 mCov3D = mat3(
                        sx2, xy, xz,
                        xy, sy2, yz,
                        xz, yz, sz2
                    );
                    if (determinant(mCov3D) < 0.) {
                        return;
                    }

                    uint uColor = covData.w;
                    vec4 color = vec4(uColor & 0xFFu, (uColor >> 8u) & 0xFFu, (uColor >> 16u) & 0xFFu, (uColor >> 24u) & 0xFFu) * INV_255;
                `
        }

        vec2 scaledResolution = resolution * focalAdjustment;
        vec2 focal = 0.5 * scaledResolution * vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
        mat3 J;
        if(projectionMatrix[2][3] == 0.0) {
            J = mat3(
                focal.x, 0.0, 0.0,
                0.0, focal.y, 0.0,
                0.0, 0.0, 0.0
            );
        } else {
            float invZ = 1.0 / viewCenter.z;
            vec2 J1 = focal * invZ;
            vec2 J2 = -(J1 * viewCenter.xy) * invZ;
            J = mat3(
                J1.x, 0.0, 0.0,
                0.0, J1.y, 0.0,
                J2.x, J2.y, 0.0
            );
        }

        mat3 m = J * mat3(viewMatrix);
        mat3 cov2D = m * mCov3D * transpose(m);
        float a = cov2D[0][0];
        float d = cov2D[1][1];
        float b = cov2D[0][1];

        a += preBlurAmount;
        d += preBlurAmount;
        float detOrig = a * d - b * b;
        a += blurAmount;
        d += blurAmount;
        float det = a * d - b * b;

        float blurAdjust = sqrt(max(0.0, detOrig / det));
        color.a *= blurAdjust;
        if (color.a < MIN_ALPHA) {
            return;
        }

        float factor = min(1.0, 0.5 * sqrt(-log(INV_255 / color.a)));
        float k = maxStdDev * factor;
        if (detailCullingThreshold > 0.) {
            float Ek = 1.0 - exp(-0.5 * k * k);
            float effArea = PI * Ek * sqrt(det);
            if (effArea < detailCullingThreshold) {
                return;
            }
        }

        float avg = 0.5 * (a + d);
        float delta = sqrt(max(0.0, avg * avg - det));
        float lambda1 = avg + delta;
        float lambda2 = avg - delta;
        float maxRadius = min(maxPixelRadius * focalAdjustment, min(scaledResolution.x, scaledResolution.y));
        float scale1 = min(maxRadius, maxStdDev * sqrt(lambda1));
        float scale2 = min(maxRadius, maxStdDev * sqrt(lambda2));
        if (any(greaterThan(abs(clipCenter.xy) - vec2(max(scale1, scale2) * clipCenter.w / scaledResolution), clipCenter.ww))) {
            return;
        }

        vec2 v1 = normalize(vec2((abs(b) < 0.001) ? 1.0 : b, lambda1 - a));
        vec2 v2 = vec2(v1.y, -v1.x);
        vec2 pixelOffset = position.x * v1 * scale1 + position.y * v2 * scale2;
        clipCenter.xy += (2.0 / scaledResolution) * pixelOffset * factor * clipCenter.w;

        if ((vertexState & 2u) != 0u) {
            color.xyz = 0.8 * mix(color.xyz, selectedColor.xyz, selectedColor.a);
        }

        vColor = color;
        vSplatUv = position.xy * k;
        ${shadingPickIdEnabled ? 'vId = splatIndex;' : ''}
        gl_Position = clipCenter;
    `;
}

function createFragmentShader(material: SplattingMaterial): string {
    const { normalizedFalloff, shadingPickIdEnabled } = material;

    return `
        float z = dot(vSplatUv, vSplatUv);
        if (z > (maxStdDev * maxStdDev)) {
            discard;
        }
        float alpha = vColor.a * ${normalizedFalloff ? `(exp(-0.5 * z) - EXP4) * INV_EXP4` : 'fastExp(-0.5 * z)'};
        if (alpha < MIN_ALPHA) {
            discard;
        }
        gl_FragColor = vec4(vColor.rgb * alpha, alpha);
        ${
            shadingPickIdEnabled
                ? `
                    gl_FragColor = vec4(
                        float((vId >> 0u) & 0xFFu) / 255.0,
                        float((vId >> 8u) & 0xFFu) / 255.0,
                        float((vId >> 16u) & 0xFFu) / 255.0,
                        float((vId >> 24u) & 0xFFu) / 255.0
                    );
                `
                : ''
        }
    `;
}
