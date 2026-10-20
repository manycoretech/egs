import { PassQuadMaterialBase } from './PassMaterialBase.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { Vector2 } from '../../../math/Vector2.js';
import { Vector3 } from '../../../math/Vector3.js';
import { Matrix4 } from '../../../math/Matrix4.js';
import type { Camera3D } from '../../../scene/cameras/Camera3D.js';
import type { TextureV2 } from '../../textures/TextureV2.js';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder.js';

export class SplatSortMaterial extends PassQuadMaterialBase {
    transparent = false;

    depthBias: number = 1;
    highPrecisionEnabled: boolean = false;

    count: number = 0;
    vpMatrix: Matrix4 = new Matrix4();
    resolution: Vector2 = new Vector2(0, 0);
    origin: Vector3 = new Vector3(0, 0, 0);
    centerOrigin: Vector3 = new Vector3(0, 0, 0);
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
        this.vpMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('resolution', WebGLShaderDataType.IntVec2)
            .addUniform('count', WebGLShaderDataType.Int)
            .addUniform('vpMatrix', WebGLShaderDataType.Mat4)
            .addUniform('origin', WebGLShaderDataType.Vec3)
            .addUniform('direction', WebGLShaderDataType.Vec3)
            .addUniform('centerOrigin', WebGLShaderDataType.Vec3)
            .addUniform('depthBias', WebGLShaderDataType.Float)
            .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
            .addUniform('packedTexWidth', WebGLShaderDataType.Int)
            .addFragmentCustom(this.highPrecisionEnabled ? PRECISION_FLOAT32 : PRECISION_FLOAT16)
            .addFragmentCustom(COMPUTE_SORT)
            .inject(ShaderInjectionTypes.gl_FragColor, createFragShader(this));
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('resolution', this.resolution);
        program.setUniform('count', this.count);
        program.setUniform('vpMatrix', this.vpMatrix, true);
        program.setUniform('origin', this.origin);
        program.setUniform('direction', this.direction);
        program.setUniform('centerOrigin', this.centerOrigin);
        program.setUniform('depthBias', this.depthBias);
        program.setTexture2D('centerTex', this.centerTex);
        program.setUniform('packedTexWidth', this.centerTex.width);
    }
}

const PRECISION_FLOAT16 = `const float INVALID_METRIC = 65504.0;`;
const PRECISION_FLOAT32 = `const float INVALID_METRIC = 3.402823466e38;`;
const COMPUTE_SORT = `
float computeSort(vec3 center, vec3 origin, vec3 direction, float depthBias) {
    float biasedDepth = dot(center - origin, direction) + depthBias;
    return biasedDepth > 0.0 ? biasedDepth : INVALID_METRIC;
}
`;

function createFragShader(material: SplatSortMaterial): string {
    const { highPrecisionEnabled } = material;
    if (highPrecisionEnabled) {
        return `
            ivec2 fragCoord = ivec2(gl_FragCoord);
            int splatIndex = fragCoord.y * resolution.x + fragCoord.x;
            if (splatIndex < 0 || splatIndex >= count) {
                discard;
            }

            vec4 pixel = texelFetch(centerTex, ivec2(splatIndex % packedTexWidth, splatIndex / packedTexWidth), 0);
            vec3 center = pixel.xyz + centerOrigin;
            float metric = pixel.w > 0.0 ? computeSort(center, origin, direction, depthBias) : INVALID_METRIC;
            uint packedMetric = floatBitsToUint(metric);
            gl_FragColor = vec4(uvec4(packedMetric & 0xFFu, (packedMetric >> 8u) & 0xFFu, (packedMetric >> 16u) & 0xFFu, (packedMetric >> 24u) & 0xFFu)) / 255.0;
        `;
    }

    return `
        ivec2 fragCoord = ivec2(gl_FragCoord);
        int splatIndex = 2 * (fragCoord.y * resolution.x + fragCoord.x);
        if (splatIndex < 0 || splatIndex >= count) {
            discard;
        }

        vec4 pixel;
        vec3 center;
        pixel = texelFetch(centerTex, ivec2(splatIndex % packedTexWidth, splatIndex / packedTexWidth), 0);
        center = pixel.xyz + centerOrigin;
        float metric0 = pixel.w > 0.0 ? computeSort(center, origin, direction, depthBias) : INVALID_METRIC;

        pixel = texelFetch(centerTex, ivec2((splatIndex + 1) % packedTexWidth, (splatIndex + 1) / packedTexWidth), 0);
        center = pixel.xyz + centerOrigin;
        float metric1 = pixel.w > 0.0 ? computeSort(center, origin, direction, depthBias) : INVALID_METRIC;

        uint packedMetric = packHalf2x16(vec2(metric0, metric1));
        gl_FragColor = vec4(uvec4(packedMetric & 0xFFu, (packedMetric >> 8u) & 0xFFu, (packedMetric >> 16u) & 0xFFu, (packedMetric >> 24u) & 0xFFu)) / 255.0;
    `;
}
