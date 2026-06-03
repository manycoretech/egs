import { SingleProjectShadow } from './Shadow';
import { type ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../../renderer/shader/builders/ShaderBuilder';
import { BuiltInUniformTypes } from '../../renderer/RenderState/BuiltInUniforms';
import { WebGLShaderDataType } from '../../renderer/webgl/WGLConstants';
import { Vector3 } from '../../math/Vector3';
import { PerspectiveCamera } from '../cameras/PerspectiveCamera';
import { _Math } from '../../math/Math';
import { ShaderBlockPool } from '../../renderer/shader/builders/ShaderBlockPool';
import type { SpotLight } from '../lights/SpotLight';
import type { DrawableList } from '../tools/DrawcallList';
import type { Deserializer, Serializer } from '../../utils/Serialization';
import type { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { lightProperty } from '../../ContentAPI';
import { Vector2 } from '../../math/Vector2';
import type { TextureV2 } from '../../elements/textures/TextureV2';
import type { Texture2D } from '../../elements/textures/Texture2D';

export class SpotShadow<T extends TextureV2 | Texture2D = Texture2D> extends SingleProjectShadow<PerspectiveCamera> {
    customNear: number;
    customFar: number;
    isAutoComputeNearFar: boolean = false;
    @lightProperty()
    shadowCameraNear = 1;
    @lightProperty()
    shadowCameraFar = 10000;

    @lightProperty()
    enableAutoBias = false;

    @lightProperty()
    captureScale = new Vector2(1, 1);

    constructor(light: SpotLight<T>) {
        super(light);
        this.camera = new PerspectiveCamera();
        this.camera.up = new Vector3(0, 0, 1);
        this.camera.near = 1;
        this.camera.far = 10000;
        this.customNear = 300;
        this.customFar = 10000;
    }

    className(): string {
        return 'SpotShadow';
    }

    copy(other: SpotShadow<T>) {
        super.copy(other);
        this.enableAutoBias = other.enableAutoBias;
    }

    extendsShader(builder: ShaderBuilder, length: number) {
        super.includeShadowMapCommon(builder);
        builder
            .addVaryingCustomArray('vSpotShadowCoord', WebGLShaderDataType.Vec4, length)
            .addGlobalUniform(BuiltInUniformTypes.viewMatrix)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addFragmentCustom(getCustomFrag(true))
            .addVertexCustom(getCustomVert(true))
            .addVertex(ShaderBlockPool.InverseTransformDirection)
            .inject(ShaderInjectionTypes.vary_any, vertVary);
    }

    extendsShaderDeferred(builder: ShaderBuilder) {
        super.includeShadowMapCommon(builder);
        builder
            .addFragmentCustom(getCustomFrag(false))
            .addFragment(ShaderBlockPool.InverseTransformDirection);
    }

    updateSpotNearFar(fullList: DrawableList, light: SpotLight) {
        if (!this.enabled) {
            return;
        }
        const camera = this.camera;
        const fov = _Math.RAD2DEG * light.angle;
        const aspect = this.mapSize.x / this.mapSize.y;
        if (fov !== camera.fov || aspect !== camera.aspect) {
            camera.fov = fov;
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
        }
        // calculate by ourself
        if (this.isAutoComputeNearFar) {
            this.camera.near = fullList.getCameraClosestDistance(camera);
        } else {
            this.camera.near = this.customNear;
        }

        // calculate by ourself
        if (this.isAutoComputeNearFar) {
            const angle = Math.acos(this.camera.matrixWorld._elements[10]) + this.camera.fov * Math.PI / 180 / 2;
            let dis = Math.cos(this.camera.fov * Math.PI / 180 / 2) * this.camera.matrixWorld._elements[14] / Math.cos(angle);
            if (dis < this.camera.near) {
                dis = this.camera.near + 30000;
            }
            this.camera.far = Math.min(dis, this.camera.near + 30000);
        } else {
            this.camera.far = Math.max(this.camera.near + 1, this.customFar);
        }

        this.camera.updateProjectionMatrix();
        // we update the camera info here, separate from the light uniform, since
        // we have to get the scene data first to do the cull work
        this.updateCameraAndShadowMatrices(light);
    }

    updateCameraAndShadowMatrices(light: SpotLight) {
        // Update light.target by rotation if isRotationModeOn is true.
        if (light.isRotationModeOn) {
            light.updateWorldMatrix(true, false);
            // Multiply by 2000 to avoid excessive jitter
            light.target.position.setFromMatrixPosition(light.matrixWorld).sub((light as SpotLight).getDirection().multiplyScalar(2000));
        }
        super.updateCameraAndShadowMatrices(light);

        const c = this.camera;
        const w = Math.tan(c.fov / (2 * _Math.RAD2DEG)) * 2;
        this.captureScale = new Vector2(w, w * c.aspect);
        this.shadowCameraNear = this.camera.near;
        this.shadowCameraFar = this.camera.far;
    }

    updateUniformsImpl(program: WGLProgram, prefix: string) {
        super.updateUniformsImpl(program, prefix);
        program.setUniform(prefix + '.shadowAutoBias', this.enableAutoBias ? 1 : 0);
        program.setUniform(prefix + '.shadowCameraFar', this.camera.far);
        program.setUniform(prefix + '.shadowCameraNear', this.camera.near);
        program.setUniform(prefix + '.shadowCaptureScale', this.captureScale);
    }

    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<SpotShadow<T>>(['enableAutoBias', 'customNear', 'customFar', 'isAutoComputeNearFar']);
    }

    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<SpotShadow<T>>(['enableAutoBias', 'customNear', 'customFar', 'isAutoComputeNearFar']);
    }
}

function getCustomFrag(isArray: boolean) {
    return `
${isArray ? 'uniform sampler2D spotShadowMap[NUM_SPOT_LIGHT_SHADOWS];' : 'uniform sampler2D spotShadowMap;'}

struct SpotLightShadow {
    mat4 shadowMatrix;
    float shadowAutoBias;
    float shadowBias;
    float shadowNormalBias;
    float shadowRadius;
    vec2 shadowMapSize;
    float shadowIntensity;
    float shadowCameraNear;
    float shadowCameraFar;
    vec2 shadowCaptureScale;
};

${isArray ? 'uniform SpotLightShadow spotLightShadowsInfo[NUM_SPOT_LIGHT_SHADOWS];' : 'uniform SpotLightShadow spotLightShadowsInfo;'}
`;
}

function getCustomVert(isArray: boolean) {
    return `
struct SpotLightShadow {
    mat4 shadowMatrix;
    float shadowAutoBias;
    float shadowBias;
    float shadowNormalBias;
    float shadowRadius;
    vec2 shadowMapSize;
    float shadowIntensity;
    float shadowCameraNear;
    float shadowCameraFar;
    vec2 shadowCaptureScale;
};

${isArray ? 'uniform SpotLightShadow spotLightShadowsInfo[NUM_SPOT_LIGHT_SHADOWS];' : 'uniform SpotLightShadow spotLightShadowsInfo;'}
`;
}

const vertVary = `
// Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.
vec3 spotShadowWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix);
vec4 spotShadowWorldPosition;

for (int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++) {
    spotShadowWorldPosition = vec4(vWorldPosition, 1.0) + vec4(spotShadowWorldNormal * spotLightShadowsInfo[i].shadowNormalBias, 0);
    vSpotShadowCoord[i] = spotLightShadowsInfo[i].shadowMatrix * spotShadowWorldPosition;
}
`;
