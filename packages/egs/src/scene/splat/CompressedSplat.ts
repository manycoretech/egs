import { Splat } from './Splat.js';
import type { SourceTexture } from '../../elements/textures/SourceTexture.js';

export class CompressedSplat extends Splat {
    readonly PackType = 'compressed';

    /**
     * @internal
     */
    splat1Tex: SourceTexture;
    /**
     * @internal
     */
    splat2Tex: SourceTexture;
    /**
     * @internal
     */
    sh1Tex?: SourceTexture;
    /**
     * @internal
     */
    sh2Tex?: SourceTexture;
    /**
     * @internal
     */
    sh3Tex?: SourceTexture;
    /**
     * @internal
     */
    sh4Tex?: SourceTexture;

    constructor(
        counts: number,
        shDegree: number,
        splat1Tex: SourceTexture,
        splat2Tex: SourceTexture,
        sh1Tex?: SourceTexture,
        sh2Tex?: SourceTexture,
        sh3Tex?: SourceTexture,
        sh4Tex?: SourceTexture,
    ) {
        super(counts, shDegree);
        this.splat1Tex = splat1Tex;
        this.splat2Tex = splat2Tex;
        this.extrasTex.push(splat1Tex, splat2Tex);
        if (sh1Tex) {
            this.sh1Tex = sh1Tex;
            this.extrasTex.push(sh1Tex);
        }
        if (sh2Tex) {
            this.sh2Tex = sh2Tex;
            this.extrasTex.push(sh2Tex);
        }
        if (sh3Tex) {
            this.sh3Tex = sh3Tex;
            this.extrasTex.push(sh3Tex);
        }
        if (sh4Tex) {
            this.sh4Tex = sh4Tex;
            this.extrasTex.push(sh4Tex);
        }
    }

    createUnpackSplatShader() {
        return `
            vec4 decodeQuatOct(uint encoded) {
                uint quantU = encoded & uint(0x3FFu);
                uint quantV = (encoded >> 10u) & uint(0x3FFu);
                uint angleInt = encoded >> 20u;
                float u_f = float(quantU) / 1023.0;
                float v_f = float(quantV) / 1023.0;
                vec2 f = vec2(u_f * 2.0 - 1.0, v_f * 2.0 - 1.0);
                vec3 axis = vec3(f.xy, 1.0 - abs(f.x) - abs(f.y));
                float t = max(-axis.z, 0.0);
                axis.x += (axis.x >= 0.0) ? -t : t;
                axis.y += (axis.y >= 0.0) ? -t : t;
                axis = normalize(axis);
                float theta = (float(angleInt) / 4095.0) * PI;
                float halfTheta = theta * 0.5;
                float s = sin(halfTheta);
                float w = cos(halfTheta);
                return vec4(axis * s, w);
            }
            void unpackSplat(uint splatIndex, out Splat splat) {
                ivec2 coord = ivec2(splatIndex % extraTex0_width, splatIndex / extraTex0_width);
                uvec4 pixel_0 = texelFetch(extraTex0, coord, 0);
                uvec4 pixel_1 = texelFetch(extraTex1, coord, 0);
                splat.center = vec3(
                    uintBitsToFloat(pixel_0.x),
                    uintBitsToFloat(pixel_0.y),
                    uintBitsToFloat(pixel_0.z)
                );
                splat.color = vec4(
                    unpackHalf2x16(pixel_1.x),
                    unpackHalf2x16(pixel_1.y).x,
                    unpackHalf2x16(pixel_0.w).x
                );
                splat.scales = exp(vec3(
                    unpackHalf2x16(pixel_1.y).y,
                    unpackHalf2x16(pixel_1.z)
                ));
                splat.quaternion = decodeQuatOct(pixel_1.w);
            }
        `;
    }

    createUnpackSHShader() {
        const { shDegree } = this;
        return `
            ${
                shDegree > 0
                    ? `
                        ivec2 coord = ivec2(index % extraTex2_width, index / extraTex2_width);
                        uvec4 pixel_0 = texelFetch(extraTex2, coord, 0);
                        vec3 sh1_0 = unpack111011s(pixel_0.x);
                        vec3 sh1_1 = unpack111011s(pixel_0.y);
                        vec3 sh1_2 = unpack111011s(pixel_0.z);
                    `
                    : ''
            }
            ${
                shDegree > 1
                    ? `
                        uvec4 pixel_1 = texelFetch(extraTex3, coord, 0);
                        vec3 sh2_0 = unpack111011s(pixel_0.w);
                        vec3 sh2_1 = unpack111011s(pixel_1.x);
                        vec3 sh2_2 = unpack111011s(pixel_1.y);
                        vec3 sh2_3 = unpack111011s(pixel_1.z);
                        vec3 sh2_4 = unpack111011s(pixel_1.w);
                    `
                    : ``
            }
            ${
                shDegree > 2
                    ? `
                        uvec4 pixel_2 = texelFetch(extraTex4, coord, 0);
                        uvec4 pixel_3 = texelFetch(extraTex5, coord, 0);
                        vec3 sh3_0 = unpack111011s(pixel_2.x);
                        vec3 sh3_1 = unpack111011s(pixel_2.y);
                        vec3 sh3_2 = unpack111011s(pixel_2.z);
                        vec3 sh3_3 = unpack111011s(pixel_2.w);
                        vec3 sh3_4 = unpack111011s(pixel_3.x);
                        vec3 sh3_5 = unpack111011s(pixel_3.y);
                        vec3 sh3_6 = unpack111011s(pixel_3.z);
                    `
                    : ``
            }
        `;
    }

    onGpuDataPacked() {
        this.splat1Tex.freeGPU();
        this.splat2Tex.freeGPU();
    }
}
