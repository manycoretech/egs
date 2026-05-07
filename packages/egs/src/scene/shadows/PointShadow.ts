import { Shadow } from './Shadow';
import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../../renderer/shader/builders/ShaderBuilder';
import { BuiltInUniformTypes } from '../../renderer/RenderState/BuiltInUniforms';
import { WebGLShaderDataType } from '../../renderer/webgl/WGLConstants';
import { Vector3 } from '../../math/Vector3';
import { ShaderBlockPool } from '../../renderer/shader/builders/ShaderBlockPool';
import { Light } from '../lights/Light';
import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { CubeCamera } from '../cameras/CubeCamera';
import { TextureCube } from '../../elements/textures/TextureCube';
import { PointLight } from '../lights/PointLight';
import { lightProperty } from '../../ContentAPI';
import { Deserializer, Serializer } from '../../utils/Serialization';
import { Vector2 } from '../../math/Vector2';
import { _Math } from '../../math/Math';
import { RenderAttachment } from '../../elements/textures/RenderTarget';
import { Texture2D } from '../../elements/textures/Texture2D';
import { TextureV2 } from '../../elements/textures/TextureV2';

const cubeDirections = [
    new Vector3(1, 0, 0), new Vector3(- 1, 0, 0), new Vector3(0, 1, 0),
    new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)
];

const cubeUps = [
    new Vector3(0, -1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1),
    new Vector3(0, 0, -1), new Vector3(0, -1, 0), new Vector3(0, -1, 0)
];

export class PointShadow<T extends TextureV2 | Texture2D = Texture2D> extends Shadow<RenderAttachment> {
    @lightProperty()
    enableAutoBias = false;
    @lightProperty()
    private captureScale = new Vector2(1, 1);

    updateMapUniform(program: WGLProgram, mapName: string) {
        if (this.enabled) {
            program.setTextureCube(mapName, this.getMapOrDefault() as any);
        }
    }

    updateUniformsImpl(program: WGLProgram, prefix: string) {
        super.updateUniformsImpl(program, prefix);
        program.setUniform(prefix + '.shadowAutoBias', this.enableAutoBias ? 1 : 0);
        program.setUniform(prefix + '.shadowCameraNear', this.customNear);
        program.setUniform(prefix + '.shadowCameraFar', this.customFar);
        program.setUniform(prefix + '.shadowCaptureScale', this.captureScale);
    }

    getMapOrDefault(): RenderAttachment {
        if (this.enabled) {
            return this.map!;
        } else {
            return TextureCube.default as any;
        }
    }
    camera: CubeCamera;
    @lightProperty()
    customNear: number;
    @lightProperty()
    customFar: number;

    constructor(light: PointLight<T>) {
        super(light);
        this.customNear = 5;
        this.customFar = 10000;
        this.camera = new CubeCamera(90, 1, this.customNear, this.customFar);
    }

    className(): string {
        return 'PointShadow';
    }

    copy(other: PointShadow<T>) {
        super.copy(other);
        this.customNear = other.customNear;
        this.customFar = other.customFar;
    }

    extendsShader(builder: ShaderBuilder, length: number) {
        super.includeShadowMapCommon(builder);
        builder
            .addVaryingCustomArray('vPointShadowWorldCoord', WebGLShaderDataType.Vec4, length)
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
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addFragmentCustom(getCustomFrag(false))
            .addFragment(ShaderBlockPool.InverseTransformDirection);
    }

    updateCamera(light: Light) {
        this.camera.cameras.forEach((camera, i) => {
            camera.near = this.customNear;
            camera.far = this.customFar;

            light.getWorldPosition(camera.position);

            const target = new Vector3().setFromMatrixPosition(light.matrixWorld).add(cubeDirections[i]);
            camera.up.copy(cubeUps[i]);
            camera.lookAt(target);
            camera.updateMatrixWorld();
            camera.updateProjectionMatrix();
        });

        const c = this.camera.cameras[0];
        const w = Math.tan(c.fov / (2 * _Math.RAD2DEG)) * 2;
        this.captureScale.set(w, w * c.aspect);
    }

    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<PointShadow<T>>(['customNear', 'customFar']);
    }

    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<PointShadow<T>>(['customNear', 'customFar']);
    }
}

function getCustomFrag(isArray: boolean) {
    return `
${isArray ? 'uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];' : 'uniform samplerCube pointShadowMap;'}

struct PointLightShadow {
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

${isArray ? 'uniform PointLightShadow pointLightShadowsInfo[ NUM_POINT_LIGHT_SHADOWS ];' : 'uniform PointLightShadow pointLightShadowsInfo;'}
`;
}

function getCustomVert(isArray: boolean) {
    return `
struct PointLightShadow {
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

${isArray ? 'uniform PointLightShadow pointLightShadowsInfo[ NUM_POINT_LIGHT_SHADOWS ];' : 'uniform PointLightShadow pointLightShadowsInfo;'}
`;
}

const vertVary = `
// Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.
vec3 pointShadowWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix);
vec4 pointShadowWorldPosition;

for (int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++) {
    pointShadowWorldPosition = vec4(vWorldPosition, 1.0) + vec4(pointShadowWorldNormal * pointLightShadowsInfo[i].shadowNormalBias, 0);
    vPointShadowWorldCoord[ i ] = pointShadowWorldPosition;
}
`;
