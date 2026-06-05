import { Splat } from './Splat';
import type { SourceTexture } from '../../elements/textures/SourceTexture';

export class SuperCompressedSplat extends Splat {
    readonly PackType = 'super_compressed';

    /**
     * @internal
     */
    splatTex: SourceTexture;
    /**
     * @internal
     */
    sh1Tex?: SourceTexture;
    /**
     * @internal
     */
    sh2Tex?: SourceTexture;

    constructor(
        counts: number,
        shDegree: number,
        splatTex: SourceTexture,
        sh1Tex?: SourceTexture,
        sh2Tex?: SourceTexture,
    ) {
        super(counts, shDegree);
        this.splatTex = splatTex;
        this.extrasTex.push(splatTex);
        if (sh1Tex) {
            this.sh1Tex = sh1Tex;
            this.extrasTex.push(sh1Tex);
        }
        if (sh2Tex) {
            this.sh2Tex = sh2Tex;
            this.extrasTex.push(sh2Tex);
        }
    }

    createUnpackSplatShader() {
        return `
            vec4 decodeQuatOct(float u, float v, float angle) {
                vec3 axis = vec3(u, v, 1.0 - abs(u) - abs(v));
                float t = max(-axis.z, 0.0);
                axis.x += (axis.x >= 0.0) ? -t : t;
                axis.y += (axis.y >= 0.0) ? -t : t;
                axis = normalize(axis);
                float theta = angle * PI;
                float halfTheta = theta * 0.5;
                float s = sin(halfTheta);
                float w = cos(halfTheta);
                return vec4(axis * s, w);
            }
            const float LN_SCALE_MIN = -12.0;
            const float LN_SCALE_MAX = 9.0;
            const float LN_RESCALE = (LN_SCALE_MAX - LN_SCALE_MIN) / 254.0;
            void unpackSplat(uint splatIndex, out Splat splat) {
                uvec4 pixel_0 = texelFetch(extraTex0, ivec2(splatIndex % extraTex0_width, splatIndex / extraTex0_width), 0);
                uint word0 = pixel_0.x, word1 = pixel_0.y, word2 = pixel_0.z, word3 = pixel_0.w;
                splat.center = vec3(unpackHalf2x16(word0), unpackHalf2x16(word1 & 0xFFFFu).x);
                uvec3 uScales = uvec3((word1 >> 16u) & 0xFFu, (word1 >> 24u) & 0xFFu, (word2 >> 0u) & 0xFFu);
                splat.scales = vec3(
                    (uScales.x == 0u) ? 0.0 : exp(LN_SCALE_MIN + float(uScales.x - 1u) * LN_RESCALE),
                    (uScales.y == 0u) ? 0.0 : exp(LN_SCALE_MIN + float(uScales.y - 1u) * LN_RESCALE),
                    (uScales.z == 0u) ? 0.0 : exp(LN_SCALE_MIN + float(uScales.z - 1u) * LN_RESCALE)
                );
                float quantU = (float((word2 >> 8u) & 0xFFu) - 128.0) / 128.0;
                float quantV = (float((word2 >> 16u) & 0xFFu) - 128.0) / 128.0;
                float angle = float((word2 >> 24u) & 0xFFu) / 255.0;
                splat.quaternion = decodeQuatOct(quantU, quantV, angle);
                splat.color = vec4(
                    float((word3 >> 0u) & 0xFFu) / 255.0,
                    float((word3 >> 8u) & 0xFFu) / 255.0,
                    float((word3 >> 16u) & 0xFFu) / 255.0,
                    float((word3 >> 24u) & 0xFFu) / 255.0
                );
            }
        `;
    }

    createUnpackSHShader() {
        const { shDegree } = this;
        return `
            ${
                shDegree > 0
                    ? `
                ivec2 coord = ivec2(index % extraTex1_width, index / extraTex1_width);
                uvec4 pixel = texelFetch(extraTex1, coord, 0);
                uint word0 = pixel.x;
                uint word1 = pixel.y;
                vec3 sh1_0 = vec3((word0 >> 0) & 31u, (word0 >> 5) & 31u, (word0 >> 10) & 31u) * 0.0625 - 1.0;
                vec3 sh1_1 = vec3((word0 >> 15) & 31u, (word0 >> 20) & 31u, (word0 >> 25) & 31u) * 0.0625 - 1.0;
                vec3 sh1_2 = vec3(((word1 & 0x7u) << 2) | (word0 >> 30), (word1 >> 3) & 31u, (word1 >> 8) & 31u) * 0.0625 - 1.0;
            `
                    : ''
            }
            ${
                shDegree > 1
                    ? `
                uint word2 = pixel.z;
                uint word3 = pixel.w;
                vec3 sh2_0 = vec3((word2 >> 0) & 0xFu, (word2 >> 4) & 0xFu, (word2 >> 8) & 0xFu) * 0.125 - 1.0;
                vec3 sh2_1 = vec3((word2 >> 12) & 0xFu, (word2 >> 16) & 0xFu, (word2 >> 20) & 0xFu) * 0.125 - 1.0;
                vec3 sh2_2 = vec3((word2 >> 24) & 0xFu, (word2 >> 28) & 0xFu, (word3 >> 0) & 0xFu) * 0.125 - 1.0;
                vec3 sh2_3 = vec3((word3 >> 4) & 0xFu, (word3 >> 8) & 0xFu, (word3 >> 12) & 0xFu) * 0.125 - 1.0;
                vec3 sh2_4 = vec3((word3 >> 16) & 0xFu, (word3 >> 20) & 0xFu, (word3 >> 24) & 0xFu) * 0.125 - 1.0;
            `
                    : ``
            }
            ${
                shDegree > 2
                    ? `
                uvec4 pixel_1 = texelFetch(extraTex2, coord, 0);
                uint word4 = pixel_1.x;
                uint word5 = pixel_1.y;
                uint word6 = pixel_1.z;
                vec3 sh3_0 = vec3((word4 >> 0) & 0xFu, (word4 >> 4) & 0xFu, (word4 >> 8) & 0xFu) * 0.125 - 1.0;
                vec3 sh3_1 = vec3((word4 >> 12) & 0xFu, (word4 >> 16) & 0xFu, (word4 >> 20) & 0xFu) * 0.125 - 1.0;
                vec3 sh3_2 = vec3((word4 >> 24) & 0xFu, (word4 >> 28) & 0xFu, (word5 >> 0) & 0xFu) * 0.125 - 1.0;
                vec3 sh3_3 = vec3((word5 >> 4) & 0xFu, (word5 >> 8) & 0xFu, (word5 >> 12) & 0xFu) * 0.125 - 1.0;
                vec3 sh3_4 = vec3((word5 >> 16) & 0xFu, (word5 >> 20) & 0xFu, (word5 >> 24) & 0xFu) * 0.125 - 1.0;
                vec3 sh3_5 = vec3((word5 >> 28) & 0xFu, (word6 >> 0) & 0xFu, (word6 >> 4) & 0xFu) * 0.125 - 1.0;
                vec3 sh3_6 = vec3((word6 >> 8) & 0xFu, (word6 >> 12) & 0xFu, (word6 >> 16) & 0xFu) * 0.125 - 1.0;
            `
                    : ``
            }
        `;
    }

    onGpuDataPacked() {
        this.splatTex.freeGPU();
    }
}
