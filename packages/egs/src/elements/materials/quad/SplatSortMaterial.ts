import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { Vector3 } from '../../../math/Vector3';
import type { Camera3D } from '../../../scene/cameras/Camera3D';
import { Vector2 } from '../../../math/Vector2';
import type { TextureV2 } from '../../textures/TextureV2';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';

export class SplatSortMaterial extends PassQuadMaterialBase {
    transparent = false;

    depthBias: number = 1;
    highPrecisionEnabled: boolean = false;

    count: number = 0;
    resolution: Vector2 = new Vector2(0, 0);
    origin: Vector3 = new Vector3(0, 0, 0);
    direction: Vector3 = new Vector3(0, 0, -1);

    centerTex: TextureV2;

    className() {
        return 'SplatSortMaterial';
    }

    generateShaderKey() {
        return HashKeyBuilder.getInstance().raw(this.className()).bool(this.highPrecisionEnabled).getKey();
    }

    update(camera: Camera3D) {
        camera.matrixWorld.getPosition(this.origin);
        this.direction.set(0, 0, -1).applyMatrix4(camera.matrixWorld).sub(this.origin).normalize();
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('resolution', WebGLShaderDataType.IntVec2)
            .addUniform('count', WebGLShaderDataType.Int)
            .addUniform('origin', WebGLShaderDataType.Vec3)
            .addUniform('direction', WebGLShaderDataType.Vec3)
            .addUniform('depthBias', WebGLShaderDataType.Float)
            .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
            .addUniform('centerTexWidth', WebGLShaderDataType.Int)
            .addFragmentCustom(this.highPrecisionEnabled ? PRECISION_FLOAT32 : PRECISION_FLOAT16)
            .addFragmentCustom(COMPUTE_SORT)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                this.highPrecisionEnabled ? HIGH_PRECISION_FRAG_SHADER : LOW_PRECISION_FRAG_SHADER,
            );
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('resolution', this.resolution);
        program.setUniform('count', this.count);
        program.setUniform('origin', this.origin);
        program.setUniform('direction', this.direction);
        program.setUniform('depthBias', this.depthBias);
        program.setTexture2D('centerTex', this.centerTex);
        program.setUniform('centerTexWidth', this.centerTex.width);
    }
}

const PRECISION_FLOAT16 = `const float INVALID_METRIC = 65504.0;`;
const PRECISION_FLOAT32 = `const float INVALID_METRIC = 3.402823466e38;`;

const COMPUTE_SORT = `
float computeSort(vec3 splatCenter, vec3 origin, vec3 direction, float depthBias) {
    vec3 center = splatCenter - origin;
    float biasedDepth = dot(center, direction) + depthBias;
    return biasedDepth > 0.0 ? biasedDepth : INVALID_METRIC;
}
`;

const LOW_PRECISION_FRAG_SHADER = `
ivec2 fragCoord = ivec2(gl_FragCoord);
int splatIndex = 2 * (fragCoord.y * resolution.x + fragCoord.x);
if (splatIndex < 0 || splatIndex >= count) {
    discard;
}

vec4 pixel;
pixel = texelFetch(centerTex, ivec2(splatIndex % centerTexWidth, splatIndex / centerTexWidth), 0);
float metric0 = pixel.w > 0.0 ? computeSort(pixel.xyz, origin, direction, depthBias) : INVALID_METRIC;
pixel = texelFetch(centerTex, ivec2((splatIndex + 1) % centerTexWidth, (splatIndex + 1) / centerTexWidth), 0);
float metric1 = pixel.w > 0.0 ? computeSort(pixel.xyz, origin, direction, depthBias) : INVALID_METRIC;

uint packedMetric = packHalf2x16(vec2(metric0, metric1));
gl_FragColor = vec4(uvec4(packedMetric & 0xFFu, (packedMetric >> 8u) & 0xFFu, (packedMetric >> 16u) & 0xFFu, (packedMetric >> 24u) & 0xFFu)) / 255.0;
`;

const HIGH_PRECISION_FRAG_SHADER = `
ivec2 fragCoord = ivec2(gl_FragCoord);
int splatIndex = fragCoord.y * resolution.x + fragCoord.x;
if (splatIndex < 0 || splatIndex >= count) {
    discard;
}

vec4 pixel = texelFetch(centerTex, ivec2(splatIndex % centerTexWidth, splatIndex / centerTexWidth), 0);
float metric = pixel.w > 0.0 ? computeSort(pixel.xyz, origin, direction, depthBias) : INVALID_METRIC;
uint packedMetric = floatBitsToUint(metric);
gl_FragColor = vec4(uvec4(packedMetric & 0xFFu, (packedMetric >> 8u) & 0xFFu, (packedMetric >> 16u) & 0xFFu, (packedMetric >> 24u) & 0xFFu)) / 255.0;
`;
