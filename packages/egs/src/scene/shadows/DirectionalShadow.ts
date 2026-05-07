import { SingleProjectShadow } from './Shadow';
import { OrthographicCamera } from '../cameras/OrthographicCamera';
import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../../renderer/shader/builders/ShaderBuilder';
import { BuiltInUniformTypes } from '../../renderer/RenderState/BuiltInUniforms';
import { WebGLShaderDataType } from '../../renderer/webgl/WGLConstants';
import { Vector3 } from '../../math/Vector3';
import { ShaderBlockPool } from '../../renderer/shader/builders/ShaderBlockPool';
import { DirectionalLight } from '../lights/DirectionalLight';
import { Deserializer, Serializer } from '../../utils/Serialization';
import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { Vector2 } from '../../math/Vector2';
import { lightProperty } from '../../ContentAPI';

export class DirectionalShadow extends SingleProjectShadow<OrthographicCamera> {
    @lightProperty()
    public enableAutoBias = false;
    @lightProperty()
    public shadowCameraNear = 0.1;
    @lightProperty()
    public shadowCameraFar = 2000;
    @lightProperty()
    public shadowRenderSize = new Vector2(2, 2);

    className(): string {
        return 'DirectionalShadow';
    }

    constructor(directional: DirectionalLight) {
        super(directional);
        this.camera = new OrthographicCamera();
        this.camera.up = new Vector3(0, 0, 1);
    }

    copy(other: DirectionalShadow) {
        super.copy(other);
        this.enableAutoBias = other.enableAutoBias;
        this.shadowCameraNear = other.shadowCameraNear;
        this.shadowCameraFar = other.shadowCameraFar;
        this.shadowRenderSize = other.shadowRenderSize;
    }

    public updateCameraAndShadowMatrices(light: DirectionalLight) {
        super.updateCameraAndShadowMatrices(light);
        this.shadowRenderSize = new Vector2(this.camera.right - this.camera.left, this.camera.top - this.camera.bottom);
        this.shadowCameraNear = this.camera.near;
        this.shadowCameraFar = this.camera.far;
    }

    public extendsShader(builder: ShaderBuilder, length: number) {
        super.includeShadowMapCommon(builder);
        builder
            .addVaryingCustomArray('vDirectionalShadowCoord', WebGLShaderDataType.Vec4, length)
            .addGlobalUniform(BuiltInUniformTypes.viewMatrix)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addFragmentCustom(getCustomFrag(true))
            .addVertexCustom(getCustomVert(true))
            .addVertex(ShaderBlockPool.InverseTransformDirection)
            .inject(ShaderInjectionTypes.vary_any, vertVary);
    }

    public extendsShaderDeferred(builder: ShaderBuilder) {
        super.includeShadowMapCommon(builder);
        builder
            .addFragmentCustom(getCustomFrag(false))
            .addFragment(ShaderBlockPool.InverseTransformDirection);
    }

    updateUniformsImpl(program: WGLProgram, prefix: string) {
        super.updateUniformsImpl(program, prefix);

        program.setUniform(prefix + '.shadowAutoBias', this.enableAutoBias ? 1 : 0);
        program.setUniform(prefix + '.shadowCameraFar', this.camera.far);
        program.setUniform(prefix + '.shadowCameraNear', this.camera.near);
        program.setUniform(prefix + '.shadowRenderSize', this.shadowRenderSize);
    }

    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<DirectionalShadow>(['camera']);
    }

    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<DirectionalShadow>(['camera']);
    }
}

function getCustomFrag(isArray: boolean) {
    return `
${isArray ? 'uniform sampler2D directionalShadowMap[NUM_DIR_LIGHT_SHADOWS];' : 'uniform sampler2D directionalShadowMap;'}

struct DirectionalLightShadow {
    mat4 shadowMatrix;
    float shadowBias;
    float shadowAutoBias;
    float shadowNormalBias;
    float shadowRadius;
    vec2 shadowMapSize;
    float shadowIntensity;
    float shadowCameraNear;
    float shadowCameraFar;
    vec2 shadowRenderSize;
};

${isArray ? 'uniform DirectionalLightShadow directionalLightShadowsInfo[NUM_DIR_LIGHT_SHADOWS];' : 'uniform DirectionalLightShadow directionalLightShadowsInfo;'}
`;
}

function getCustomVert(isArray: boolean) {
    return `
struct DirectionalLightShadow {
    mat4 shadowMatrix;
    float shadowBias;
    float shadowAutoBias;
    float shadowNormalBias;
    float shadowRadius;
    vec2 shadowMapSize;
    float shadowIntensity;
    float shadowCameraNear;
    float shadowCameraFar;
    vec2 shadowRenderSize;
};
${isArray ? 'uniform DirectionalLightShadow directionalLightShadowsInfo[NUM_DIR_LIGHT_SHADOWS];' : 'uniform DirectionalLightShadow directionalLightShadowsInfo;'}
`;
}

const vertVary = `
// Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.
vec3 directionalShadowWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix);
vec4 directionalShadowWorldPosition;

for (int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++) {
    directionalShadowWorldPosition = vec4(vWorldPosition, 1.0) + vec4(directionalShadowWorldNormal * directionalLightShadowsInfo[i].shadowNormalBias, 0);
    vDirectionalShadowCoord[i] = directionalLightShadowsInfo[i].shadowMatrix * directionalShadowWorldPosition;
}
`;
