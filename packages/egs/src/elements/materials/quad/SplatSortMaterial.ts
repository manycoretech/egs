import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { ShaderInjectionTypes, ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { Vector3 } from '../../../math/Vector3';
import { Camera3D } from '../../../scene/cameras/Camera3D';
import { Vector2 } from '../../../math/Vector2';
import { TextureV2 } from '../../textures/TextureV2';

export class SplatSortMaterial extends PassQuadMaterialBase {
    transparent = false;

    resolution: Vector2 = new Vector2(0, 0);
    splatCounts: number = 0;
    targetOffset: number = 0;
    sortOrigin: Vector3 = new Vector3(0, 0, 0);
    sortDirection: Vector3 = new Vector3(0, 0, -1);
    sortRadial: boolean = true;
    sortDepthBias: number = 1;

    centerTex: TextureV2;

    className() {
        return 'SplatSortMaterial';
    }

    update(camera: Camera3D) {
        this.sortOrigin.setScalar(0).applyMatrix4(camera.matrixWorld);
        this.sortDirection.set(0, 0, -1).applyMatrix4(camera.matrixWorld).sub(this.sortOrigin).normalize();
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('resolution', WebGLShaderDataType.IntVec2)
            .addUniform('splatCounts', WebGLShaderDataType.Int)
            .addUniform('targetOffset', WebGLShaderDataType.Int)
            .addUniform('sortRadial', WebGLShaderDataType.Bool)
            .addUniform('sortOrigin', WebGLShaderDataType.Vec3)
            .addUniform('sortDirection', WebGLShaderDataType.Vec3)
            .addUniform('sortDepthBias', WebGLShaderDataType.Float)
            .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
            .addUniform('centerTexWidth', WebGLShaderDataType.Int)
            .addFragmentCustom(COMPUTE_SORT)
            .inject(ShaderInjectionTypes.gl_FragColor, FRAG_SHADER);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('resolution', this.resolution);
        program.setUniform('splatCounts', this.splatCounts);
        program.setUniform('targetOffset', this.targetOffset);
        program.setUniform('sortRadial', this.sortRadial);
        program.setUniform('sortOrigin', this.sortOrigin);
        program.setUniform('sortDirection', this.sortDirection);
        program.setUniform('sortDepthBias', this.sortDepthBias);
        program.setTexture2D('centerTex', this.centerTex);
        program.setUniform('centerTexWidth', this.centerTex.width);
    }
}

const COMPUTE_SORT = `
const float INFINITY = float(0x7F800000u); // IEEE 754 representation of infinity
float computeSort(vec3 splatCenter, bool sortRadial, vec3 sortOrigin, vec3 sortDirection, float sortDepthBias) {
    vec3 center = splatCenter - sortOrigin;
    float biasedDepth = dot(center, sortDirection) + sortDepthBias;
    if (biasedDepth <= 0.0) {
        return INFINITY;
    }
    return sortRadial ? length(center) : biasedDepth;
}
`;

const FRAG_SHADER = `
ivec2 fragCoord = ivec2(gl_FragCoord);
int splatIndex = 2 * (fragCoord.y * resolution.x + fragCoord.x) - targetOffset;
if (splatIndex < 0 || splatIndex >= splatCounts) {
    discard;
}

vec4 pixel;
pixel = texelFetch(centerTex, ivec2(splatIndex % centerTexWidth, splatIndex / centerTexWidth), 0);
float metric0 = pixel.w > 0. ? computeSort(pixel.xyz, sortRadial, sortOrigin, sortDirection, sortDepthBias) : INFINITY;

pixel = texelFetch(centerTex, ivec2((splatIndex + 1) % centerTexWidth, (splatIndex + 1) / centerTexWidth), 0);
float metric1 = pixel.w > 0. ? computeSort(pixel.xyz, sortRadial, sortOrigin, sortDirection, sortDepthBias) : INFINITY;

uint packed = packHalf2x16(vec2(metric0, metric1));
gl_FragColor = vec4(uvec4(packed & 0xFFu, (packed >> 8u) & 0xFFu, (packed >> 16u) & 0xFFu, (packed >> 24u) & 0xFFu)) / 255.0;
`;
