import { PassQuadMaterialBase } from './PassMaterialBase';
import { _Math } from '../../../math/Math';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { readonlyMath } from '../../../math/Readonly';
import { materialProperty } from '../../../ContentAPI';
import type { Texture } from '../../textures/Texture';

export class SSAOBlurPassMaterial extends PassQuadMaterialBase {
    @materialProperty()
    map: Texture;
    @materialProperty()
    depthMap: Texture;
    @materialProperty()
    normalMap: Texture;
    @materialProperty()
    axis = readonlyMath.vec2(0, 0);
    @materialProperty()
    weights: number[];
    @materialProperty()
    texelSize = readonlyMath.vec2(1, 1);
    @materialProperty()
    cameraNear = 1.0;
    @materialProperty()
    cameraFar = 1000.0;
    @materialProperty()
    edgeSharpness = 1.2;
    private KERNEL_RADIUS: number;

    className() {
        return 'SSAOBlurPassMaterial';
    }

    constructor() {
        super();
        this.radius = 2;
    }

    get radius() {
        return this.KERNEL_RADIUS;
    }

    set radius(v: number) {
        this.KERNEL_RADIUS = v;
        this.weights = _Math.CreateSampleWeights(v * 2);
        this.notifyRecompileShader();
    }

    setTexelSize(width: number, height: number) {
        this.texelSize = readonlyMath.vec2(1 / width, 1 / height);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('map', this.map);
        program.setTexture2D('depthMap', this.depthMap);
        program.setUniform('axis', this.axis);
        program.setUniform('weights[0]', this.weights);
        program.setUniform('texelSize', this.texelSize);
        program.setUniform('cameraNear', this.cameraNear);
        program.setUniform('cameraFar', this.cameraFar);
        program.setUniform('edgeSharpness', this.edgeSharpness);
    }

    extendShaderShading(b: ShaderBuilder) {
        b
            .addFragDefine(`#define KERNEL_RADIUS ${this.KERNEL_RADIUS}`)
            .addUniform('map', WebGLShaderDataType.Sampler2D)
            .addUniform('depthMap', WebGLShaderDataType.Sampler2D)
            .addUniform('axis', WebGLShaderDataType.Vec2)
            .addUniform('texelSize', WebGLShaderDataType.Vec2)
            .addUniformArray('weights', WebGLShaderDataType.Float, this.weights.length)
            .addUniform('cameraNear', WebGLShaderDataType.Float)
            .addUniform('cameraFar', WebGLShaderDataType.Float)
            .addUniform('edgeSharpness', WebGLShaderDataType.Float)
            .addFragmentCustom(SSAOBlurFrag)
            .inject(ShaderInjectionTypes.gl_FragColor, SSAOBlurFragColor);
    }
}

const SSAOBlurFragColor = `
vec3  color = texture2D(map, vUv).rgb;
float depth = reconstructCSZ(vUv);
vec3  normal = getNormal(vUv);

vec3 sum = color;

// base weight for depth falloff.  Increase this for more blurriness,
// decrease it for better edge discrimination
float base = weights[0];
float totalWeight = base;
sum *= totalWeight;

// divide depth making depth difference linear in screen space.
float factor = edgeSharpness / (-depth) * 100.0;

for (int r = 1; r <= KERNEL_RADIUS * 2; ++r) {
    vec2 offset = axis * float(r) * texelSize;
    // spatial domain: offset gaussian tap
    float tapWeight = 0.3 + weights[r];

    vec2 tapUv = vUv + offset;
    vec3 tapColor = texture2D(map, tapUv).rgb;
    float tapDepth = reconstructCSZ(tapUv);
    vec3  tapNormal = getNormal(tapUv);

    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
    tapWeight *= max(0.0, 1.0 - abs(tapDepth - depth) * factor) ;
    tapWeight *= clamp(dot(normal, tapNormal) + 0.1, 0.0, 1.0);

    totalWeight += tapWeight;
    sum += tapColor * tapWeight;

    tapUv = vUv - offset;
    tapColor = texture2D(map, tapUv).rgb;
    tapDepth = reconstructCSZ(tapUv);
    tapNormal = getNormal(tapUv);
    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
    tapWeight *= max(0.0, 1.0 - abs(tapDepth - depth) * factor) ;
    tapWeight *= clamp(dot(normal, tapNormal) + 0.1, 0.0, 1.0);

    totalWeight += tapWeight;
    sum += tapColor * tapWeight;
}

const float epsilon = 0.0001;

gl_FragColor = vec4(sum / (totalWeight + epsilon), 1.0);
`;

const SSAOBlurFrag = `
const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)
const float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)
const vec3 PackFactors = vec3(256. * 256. * 256., 256. * 256., 256.);
const vec4 UnpackFactors = UnpackDownscale / vec4(PackFactors, 1.);
float unpackRGBAToDepth(const in vec4 v) {
    return dot(v, UnpackFactors) * PackUpscale;
}

float perspectiveDepthToViewZ(const in float invClipZ, const in float near, const in float far) {
    return (near * far) / ((far - near) * invClipZ - far);
}

float reconstructCSZ(vec2 uv) {
    float depth = unpackRGBAToDepth(texture2D(depthMap, uv));
    return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
}

vec3 getNormal(vec2 uv) {
#ifdef NORMAL_TEXTURE
    return (texture2D(normalMap, uv).xyz - 0.5) * 2.0;
#else
    return vec3(1.0, 0.0, 0.0);
#endif
}`;
