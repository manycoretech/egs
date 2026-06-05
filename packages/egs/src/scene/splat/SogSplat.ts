import { Splat } from './Splat';
import { UniformBlockObject } from '../../renderer/shader/components/UniformBlockObject';
import { WebGLShaderDataType } from '../../renderer/webgl/WGLConstants';
import { Vector3 } from '../../math/Vector3';
import { Vector4 } from '../../math/Vector4';
import type { SourceTexture } from '../../elements/textures/SourceTexture';

export type SogSplatMeta = {
    counts: number;
    shDegree: number;
    means: { mins: [number, number, number]; maxs: [number, number, number] };
} & (
    | {
          version: 1;
          scales: { mins: [number, number, number]; maxs: [number, number, number] };
          sh0: { mins: [number, number, number, number]; maxs: [number, number, number, number] };
          shN?: { mins: number; maxs: number };
      }
    | {
          version: 2;
          scales: { codebook: number[] };
          sh0: { codebook: number[] };
          shN?: { codebook: number[] };
      }
);

export class SogSplat extends Splat {
    readonly PackType: string;

    /**
     * @internal
     */
    meta: SogSplatMeta;
    /**
     * @internal
     */
    meansL: SourceTexture;
    /**
     * @internal
     */
    meansU: SourceTexture;
    /**
     * @internal
     */
    quats: SourceTexture;
    /**
     * @internal
     */
    scales: SourceTexture;
    /**
     * @internal
     */
    colors: SourceTexture;

    constructor(
        meta: SogSplatMeta,
        meansL: SourceTexture,
        meansU: SourceTexture,
        quats: SourceTexture,
        scales: SourceTexture,
        colors: SourceTexture,
        _shNLabels?: SourceTexture,
        _shNCentroids?: SourceTexture,
    ) {
        super(meta.counts, 0);
        this.PackType = 'sog_v' + meta.version;
        this.meta = meta;
        this.meansL = meansL;
        this.meansU = meansU;
        this.quats = quats;
        this.scales = scales;
        this.colors = colors;
        this.extrasTex.push(meansL, meansU, quats, scales, colors);

        const ubo = UniformBlockObject.spawn('splatMeta')
            .createItem('meansMin', WebGLShaderDataType.Vec3, new Vector3().fromArray(meta.means.mins))
            .createItem('meansMax', WebGLShaderDataType.Vec3, new Vector3().fromArray(meta.means.maxs));
        if (meta.version === 1) {
            ubo.createItem('scalesMin', WebGLShaderDataType.Vec3, new Vector3().fromArray(meta.scales.mins))
                .createItem('scalesMax', WebGLShaderDataType.Vec3, new Vector3().fromArray(meta.scales.maxs))
                .createItem('colorsMin', WebGLShaderDataType.Vec4, new Vector4().fromArray(meta.sh0.mins))
                .createItem('colorsMax', WebGLShaderDataType.Vec4, new Vector4().fromArray(meta.sh0.maxs))
                .createItem('shNMin', WebGLShaderDataType.Float, meta.shN?.mins ?? 0)
                .createItem('shNMax', WebGLShaderDataType.Float, meta.shN?.maxs ?? 1);
        } else {
            ubo.createItemArray('scalesCodebook', WebGLShaderDataType.Vec4, 64, meta.scales.codebook)
                .createItemArray('colorsCodebook', WebGLShaderDataType.Vec4, 64, meta.sh0.codebook)
                .createItemArray(
                    'shNCodebook',
                    WebGLShaderDataType.Vec4,
                    64,
                    meta.shN?.codebook ?? new Float32Array(256),
                );
        }
        this.extrasUBO.push(ubo);
    }

    createUnpackSplatShader() {
        const { meta } = this;
        return `
            const float SH_C0 = 0.28209479177387814;
            const float SQRT2 = sqrt(2.0);
            vec3 resolveCodebook(vec3 s, vec4 codebook[64]) {
                uvec3 idx = uvec3(s * 255.0);
                uvec3 mask = idx & 3u;
                vec4 code0 = codebook[idx.x >> 2u];
                vec4 code1 = codebook[idx.y >> 2u];
                vec4 code2 = codebook[idx.z >> 2u];
                return vec3(
                    mask.x == 0u ? code0.x : mask.x == 1u ? code0.y : mask.x == 2u ? code0.z : code0.w,
                    mask.y == 0u ? code1.x : mask.y == 1u ? code1.y : mask.y == 2u ? code1.z : code1.w,
                    mask.z == 0u ? code2.x : mask.z == 1u ? code2.y : mask.z == 2u ? code2.z : code2.w
                );
            }
            void unpackSplat(uint splatIndex, out Splat splat) {
                ivec2 coord = ivec2(splatIndex % extraTex0_width, splatIndex / extraTex0_width);
                vec4 pixel_0 = texelFetch(extraTex0, coord, 0);
                vec4 pixel_1 = texelFetch(extraTex1, coord, 0);
                vec3 v = mix(meansMin, meansMax, (pixel_0.xyz + pixel_1.xyz * 256.0) / 257.0);
                splat.center = sign(v) * (exp(abs(v)) - 1.0);
                vec4 pixel_2 = texelFetch(extraTex2, coord, 0);
                vec4 tq = vec4((pixel_2.xyz - 0.5) * SQRT2, 0.);
                tq.w = sqrt(max(0., 1.0 - dot(tq.xyz, tq.xyz)));
                uint qm = uint(pixel_2.w * 255.) - 252u;
                splat.quaternion = (qm == 0u) ? tq :
                    (qm == 1u) ? tq.wyzx :
                    (qm == 2u) ? tq.ywzx :
                    tq.yzwx;
                vec4 pixel_3 = texelFetch(extraTex3, coord, 0);
                ${
                    meta.version === 1
                        ? `
                    splat.scales = exp(mix(scalesMin, scalesMax, pixel_3.xyz));
                `
                        : `
                    splat.scales = exp(resolveCodebook(pixel_3.xyz, scalesCodebook));
                `
                }
                vec4 pixel_4 = texelFetch(extraTex4, coord, 0);
                ${
                    meta.version === 1
                        ? `
                    splat.color = vec4(
                        SH_C0 * mix(colorsMin.xyz, colorsMax.xyz, pixel_4.xyz) + 0.5,
                        1. / (1. + exp(-mix(colorsMin.w, colorsMax.w, pixel_4.w)))
                    );
                `
                        : `
                    splat.color = vec4(
                        SH_C0 * resolveCodebook(pixel_4.xyz, colorsCodebook) + 0.5,
                        pixel_4.w
                    );
                `
                }
            }
        `;
    }

    createUnpackSHShader() {
        const { shDegree } = this;
        return `
            ${
                shDegree > 0
                    ? `
                vec3 sh1_0 = vec3(0.);
                vec3 sh1_1 = vec3(0.);
                vec3 sh1_2 = vec3(0.);
            `
                    : ''
            }
            ${
                shDegree > 1
                    ? `
                vec3 sh2_0 = vec3(0.);
                vec3 sh2_1 = vec3(0.);
                vec3 sh2_2 = vec3(0.);
                vec3 sh2_3 = vec3(0.);
                vec3 sh2_4 = vec3(0.);
            `
                    : ``
            }
            ${
                shDegree > 2
                    ? `
                vec3 sh3_0 = vec3(0.);
                vec3 sh3_1 = vec3(0.);
                vec3 sh3_2 = vec3(0.);
                vec3 sh3_3 = vec3(0.);
                vec3 sh3_4 = vec3(0.);
                vec3 sh3_5 = vec3(0.);
                vec3 sh3_6 = vec3(0.);
            `
                    : ``
            }
        `;
    }

    onGpuDataPacked() {
        this.meansL.freeGPU();
        this.meansU.freeGPU();
        this.quats.freeGPU();
        this.scales.freeGPU();
        this.colors.freeGPU();
    }
}
