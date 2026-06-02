import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderExtensionTypes, ShaderInjectionTypes, ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { Texture } from '../../textures/Texture';
import { readonlyMath } from '../../../math/Readonly';
import { materialProperty } from '../../../ContentAPI';

export class SSAOPassMaterial extends PassQuadMaterialBase {
    @materialProperty()
    normalMap: Texture;
    @materialProperty()
    depthMap: Texture;

    @materialProperty()
    bias = 0.01;
    @materialProperty()
    radius = 0.5;
    @materialProperty()
    private intensityDivR6 = 0.5 / Math.pow(0.5, 6);
    @materialProperty()
    projectionScale = 1.0;

    @materialProperty()
    cameraInverseProjectionMatrix = readonlyMath.mat4();
    @materialProperty()
    texelSize = readonlyMath.vec2(1, 1);

    className() {
        return 'SSAOPassMaterial';
    }

    private _intensity = 0.5;
    set intensity(v: number) {
        this._intensity = v;
        this.intensityDivR6 = v / Math.pow(this.radius, 6);
    }
    get intensity() {
        return this._intensity;
    }

    setTexelSize(width: number, height: number) {
        this.texelSize = readonlyMath.vec2(1 / width, 1 / height);
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addExtension(ShaderExtensionTypes.derivatives)
            .addUniform('depthMap', WebGLShaderDataType.Sampler2D)
            .addUniform('radius', WebGLShaderDataType.Float)
            .addUniform('bias', WebGLShaderDataType.Float)
            .addUniform('intensityDivR6', WebGLShaderDataType.Float)
            .addUniform('projectionScale', WebGLShaderDataType.Float)
            .addUniform('texelSize', WebGLShaderDataType.Vec2)
            .addUniform('cameraInverseProjectionMatrix', WebGLShaderDataType.Mat4)
            .addFragment(SSAOPassFrag)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = ssao();');
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('depthMap', this.depthMap);
        program.setUniform('radius', this.radius);
        program.setUniform('bias', this.bias);
        program.setUniform('intensityDivR6', this.intensityDivR6);
        program.setUniform('projectionScale', this.projectionScale);
        program.setUniform('texelSize', this.texelSize);
        program.setUniform('cameraInverseProjectionMatrix', this.cameraInverseProjectionMatrix);
    }
}

const SSAOPassFrag = createShaderBlock(`
#define UNIT_TO_M 0.001
#define NUM_SAMPLES 12
#define NUM_SPIRAL_TURNS 7
#define MAX_SS_RADIUS 64

#ifdef NORMAL_TEXTURE
uniform sampler2D normalMap;
#endif

const float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );
const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)
const float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)
const vec3 PackFactors = vec3(256. * 256. * 256., 256. * 256., 256.);
const vec4 UnpackFactors = UnpackDownscale / vec4(PackFactors, 1.);
float unpackRGBAToDepth(const in vec4 v) {
    return dot(v, UnpackFactors) * PackUpscale;
}

float random(vec2 p)
{
    return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * (43758.5453 + p.x * p.y * 1231.3));
}

vec3 reconstructCSFaceNormal(vec3 position) {
    return normalize(cross(dFdx(position), dFdy(position)));
}

float getDepth(vec2 uv) {
#ifdef DEPTH_TEXTURE
    return texture2D(depthMap, uv).x;
#else
    return unpackRGBAToDepth(texture2D(depthMap, uv));
#endif
}

vec3 getPosition(vec2 uv) {
    float zDepth = getDepth(uv);
    vec4 clipPosition = vec4((vec3(uv, zDepth) - 0.5) * 2.0, 1.0);
    vec4 res = cameraInverseProjectionMatrix * clipPosition;
    return res.xyz / res.w * UNIT_TO_M;
}

vec3 getNormal(vec2 uv, vec3 position) {
#ifdef NORMAL_TEXTURE
    return (texture2D(normalMap, uv).xyz - 0.5) * 2.0;
#else
    return reconstructCSFaceNormal(position);
#endif
}

vec2 tapLocation(int sampleNumber, float spinAngle, out float radiusSS) {
    // radius relative to radiusSS
    float alpha = (float(sampleNumber) + 0.5) * INV_NUM_SAMPLES;
    float angle = alpha * (float(NUM_SPIRAL_TURNS) * 6.28) + spinAngle;
    radiusSS = alpha;
    return vec2(cos(angle), sin(angle));
}

vec3 getOffsetPosition(vec2 uv, vec2 unitOffset, float radiusSS) {
    uv = uv + radiusSS * unitOffset * texelSize;
    return getPosition(uv);
}

float sampleAO(vec2 uv, vec3 positionCS, vec3 normalCS, float diskRadiusSS, int tapIndex, float rotationAngle) {
    float radius2 = radius * radius;
    // offset on the unit disk, spun for this pixel
    float radiusSS;
    vec2 unitOffset = tapLocation(tapIndex, rotationAngle, radiusSS);
    radiusSS *= diskRadiusSS;
    // the occluding point in camera space
    vec3 Q = getOffsetPosition(uv, unitOffset, radiusSS);
    vec3 v = Q - positionCS;
    float vv = dot(v, v);
    float vn = dot(v, normalCS);

    const float epsilon = 0.05;

    // A: From the HPG12 paper
    // Note large epsilon to avoid overdarkening within cracks
    // return float(vv < radius2) * max((vn - bias) / (epsilon + vv), 0.0) * radius2 * 0.6;

    // B: Smoother transition to zero (lowers contrast, smoothing out corners). [Recommended]
    float f = max(radius2 - vv, 0.0);

    return f * f * f * max((vn - bias) / (epsilon + vv), 0.0);

    // C: Medium contrast (which looks better at high radii), no division.  Note that the
    // contribution still falls off with radius^2, but we've adjusted the rate in a way that is
    // more computationally efficient and happens to be aesthetically pleasing.
    // float invRadius2 = 1.0 / radius2;
    // return 4.0 * max(1.0 - vv * invRadius2, 0.0) * max(vn - bias, 0.0);

    // D: Low contrast, no division operation
    // return 2.0 * float(vv < radius2) * max(vn - bias, 0.0);
}

vec4 ssao() {
    float zDepth = getDepth(vUv);
    if (zDepth == 1.0) {
        return vec4(1.0);
    }

    vec3 originCS = getPosition(vUv);
    vec3 normalCS = getNormal(vUv, originCS);

    // return vec4(packNormalToRGB(normalCS), 1.0);
    float randomPatternRotationAngle = PI2 * random(vUv);

    // choose the screen-space sample radius
    // proportional to the projected area of the sphere
    float radiusSS = min(-radius * projectionScale / originCS.z, float(MAX_SS_RADIUS));

    float sum = 0.0;
    for (int i = 0; i < NUM_SAMPLES; ++i) {
        sum += sampleAO(vUv, originCS, normalCS, radiusSS, i, randomPatternRotationAngle);
    }

    float occlusion = max(0.1, 1.0 - sum * intensityDivR6 * INV_NUM_SAMPLES);
    // Gamma Correction
    // occlusion = pow(occlusion, 2.2);
    return vec4(occlusion, occlusion, occlusion, 1.0);
}`);
