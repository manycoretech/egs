import { PassQuadMaterialBase } from './PassMaterialBase';
import { type ShaderBuilder, ShaderInjectionTypes, FragOutType } from '../../../renderer/shader/builders/ShaderBuilder';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { Vector3 } from '../../../math/Vector3';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import type { Splat } from '../../../scene/splat/Splat';
import type { Camera3D } from '../../../scene/cameras/Camera3D';
import { Vector2 } from '../../../math/Vector2';
import type { TextureV2 } from '../../textures/TextureV2';

export class SplatPrecalculateMaterial extends PassQuadMaterialBase {
    transparent = false;

    resolution: Vector2 = new Vector2(0, 0);
    offset: number = 0;
    targetOffset: number = 0;
    targetCounts: number = 0;

    centerTex: TextureV2;
    colorTex: TextureV2;
    current: Splat;
    viewTranslate: Vector3 = new Vector3();

    constructor() {
        super();
        this.setColorWriteMasks(false, false, false, true);
    }

    update(camera: Camera3D, splat: Splat) {
        this.targetOffset = splat.offset;
        this.targetCounts = splat.counts;
        this.current = splat;
        camera.matrixWorld.getPosition(this.viewTranslate);
        this.notifyRecompileShader();
    }

    className() {
        return 'SplatPrecalculateMaterial';
    }

    generateShaderKey(_: ShaderComponentRegistry) {
        const splat = this.current;
        return HashKeyBuilder.getInstance()
            .raw(this.className())
            .raw(splat.PackType)
            .raw(splat.shDegree)
            .raw(splat.maxShDegree)
            .getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        const splat = this.current;
        for (let i = 0; i < splat.extrasTex.length; i++) {
            builder
                .addUniform(`extraTex${i}`, WebGLShaderDataType.USampler2D)
                .addUniform(`extraTex${i}_width`, WebGLShaderDataType.UInt);
        }
        builder.addDefaultFragColor = false;
        builder
            .setFragOutputChannel([{ name: 'pc_fragColor', type: FragOutType.UVec4 }])
            .addUniform('resolution', WebGLShaderDataType.IntVec2)
            .addUniform('offset', WebGLShaderDataType.Int)
            .addUniform('targetOffset', WebGLShaderDataType.Int)
            .addUniform('targetCounts', WebGLShaderDataType.Int)
            .addUniform('colorTex', WebGLShaderDataType.Sampler2D)
            .when(splat.shDegree > 0, builder =>
                builder
                    .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
                    .addUniform('viewTranslate', WebGLShaderDataType.Vec3)
                    .addUniform('modelMatrix', WebGLShaderDataType.Mat4)
                    .addFragmentCustom(createSHShader(this)),
            )
            .inject(ShaderInjectionTypes.gl_FragColor, createFragShader(this));
    }

    updateShadingUniforms(program: WGLProgram) {
        const splat = this.current;
        program.setUniform('resolution', this.resolution);
        program.setUniform('offset', this.offset);
        program.setUniform('targetOffset', this.targetOffset, true);
        program.setUniform('targetCounts', this.targetCounts);
        program.setTexture2D('colorTex', this.colorTex);
        if (splat.shDegree > 0) {
            program.setTexture2D('centerTex', this.centerTex);
            program.setUniform('viewTranslate', this.viewTranslate);
            program.setUniform('modelMatrix', splat.matrixWorld);
        }
        const { extrasTex } = splat;
        for (let i = 0; i < extrasTex.length; i++) {
            program.setTexture2D(`extraTex${i}`, extrasTex[i], true);
            program.setUniform(`extraTex${i}_width`, extrasTex[i].width, true);
        }
    }
}

function createSHShader(material: SplatPrecalculateMaterial): string {
    const splat = material.current;
    const renderShDegree = Math.min(splat.shDegree, splat.maxShDegree);
    return `
        ivec2 shTexCoord(uint index, uint width) {
            return ivec2(index % width, index / width);
        }

        vec3 unpack111011s(uint bits) {
            uvec3 u = (uvec3(bits) >> uvec3(21u, 11u, 0u)) & uvec3(0x7ffu, 0x3ffu, 0x7ffu);
            return vec3(u) / vec3(2047.0, 1023.0, 2047.0) * 2.0 - 1.0;
        }

        const float k1 = 0.4886025;
        const float k2_0 = 1.0925484;
        const float k2_1 = 0.3153915;
        const float k2_2 = 0.5462742;
        const float k3_0 = 0.5900436;
        const float k3_1 = 2.8906114;
        const float k3_2 = 0.4570458;
        const float k3_3 = 0.3731763;
        const float k3_4 = 1.4453057;
        vec3 evaluateSH(uint index, vec3 viewDir) {
            vec3 color = vec3(0.0);

            ${splat.createUnpackSHShader()}

            ${
                renderShDegree > 0
                    ? `
                vec3 sh1 = sh1_0 * (-k1 * viewDir.y)
                    + sh1_1 * (k1 * viewDir.z)
                    + sh1_2 * (-k1 * viewDir.x);
                color += sh1;
            `
                    : ''
            }
            ${
                renderShDegree > 1
                    ? `
                float xx = viewDir.x * viewDir.x;
                float yy = viewDir.y * viewDir.y;
                float zz = viewDir.z * viewDir.z;
                float xy = viewDir.x * viewDir.y;
                float yz = viewDir.y * viewDir.z;
                float zx = viewDir.z * viewDir.x;
                vec3 sh2 = sh2_0 * (k2_0 * xy)
                    + sh2_1 * (-k2_0 * yz)
                    + sh2_2 * (k2_1 * (2.0 * zz - xx - yy))
                    + sh2_3 * (-k2_0 * zx)
                    + sh2_4 * (k2_2 * (xx - yy));
                color += sh2;
            `
                    : ''
            }
            ${
                renderShDegree > 2
                    ? `
                vec3 sh3 = sh3_0 * (-k3_0 * viewDir.y * (3.0 * xx - yy))
                    + sh3_1 * (k3_1 * xy * viewDir.z)
                    + sh3_2 * (-k3_2 * viewDir.y * (4.0 * zz - xx - yy))
                    + sh3_3 * (k3_3 * viewDir.z * (2.0 * zz - 3.0 * xx - 3.0 * yy))
                    + sh3_4 * (-k3_2 * viewDir.x * (4.0 * zz - xx - yy))
                    + sh3_5 * (k3_4 * viewDir.z * (xx - yy))
                    + sh3_6 * (-k3_0 * viewDir.x * (xx - 3.0 * yy));
                color += sh3;
            `
                    : ''
            }

            return color;
        }
    `;
}

function createFragShader(material: SplatPrecalculateMaterial): string {
    const splat = material.current;
    return `
        ivec2 fragCoord = ivec2(gl_FragCoord);
        int splatIndex = fragCoord.y * resolution.x + fragCoord.x - offset;
        if (splatIndex < 0 || splatIndex >= targetCounts) {
            discard;
        }

        vec4 color = texelFetch(colorTex, fragCoord, 0);
        ${
            splat.shDegree > 0
                ? `
            vec3 center = texelFetch(centerTex, fragCoord, 0).xyz;
            vec3 normal = normalize(transpose(mat3(modelMatrix)) * (center - viewTranslate));
            color.rgb += evaluateSH(uint(splatIndex + targetOffset), normal);
        `
                : ''
        }
        uvec4 uColor = uvec4(round(saturate(color) * 255.0));
        gl_FragColor = uvec4(0u, 0u, 0u, uColor.r | (uColor.g << 8u) | (uColor.b << 16u) | (uColor.a << 24u));
    `;
}
