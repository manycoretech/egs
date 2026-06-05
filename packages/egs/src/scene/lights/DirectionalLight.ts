import { Light } from './Light';
import { Object3D } from '../Object3D';
import type { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { Matrix4 } from '../../math/Matrix4';
import { Vector3 } from '../../math/Vector3';
import { Color } from '../../math/Color';
import { createShaderBlock } from '../../renderer/shader/builders/ShaderBlock';
import type { Deserializer, Serializer } from '../../utils/Serialization';
import { DirectionalShadow } from '../shadows/DirectionalShadow';
import { singleton } from '../../utils/Utils';
import { lightProperty } from '../../ContentAPI';

/**
 * A light that gets emitted in a specific direction.
 * This light will behave as though it is infinitely far away and the rays produced from it are all parallel. <br />
 * The common use cases for this is to simulate daylight.
 * The sun is far enough away that its position can be considered to be infinite, and all light rays coming from it are parallel.
 * This light can cast shadows - see the {@link shadow | shadow } attribute for details.
 */
const defaultTarget = singleton(() => new Object3D());
export class DirectionalLight extends Light {
    viewMatrix: Matrix4 = new Matrix4();
    invViewMatrix: Matrix4 = new Matrix4();

    static get DEFAULT_TARGET() {
        return defaultTarget();
    }
    /**
     * The target is a point in world space used to calculate the direction of light.
     */
    @lightProperty()
    private _target: Object3D = DirectionalLight.DEFAULT_TARGET;
    get target() {
        if (this._target) {
            return this._target;
        } else {
            return DirectionalLight.DEFAULT_TARGET;
        }
    }
    set target(t) {
        this._target = t;
    }
    /**
     * Check the type whether it belongs to PerspectiveCamera.
     * This value should not be changed by user.
     */
    isDirectionalLight = true;
    private vector3 = new Vector3();
    private uniforms = {
        direction: new Vector3(),
        color: new Color(),
    };
    /**
     * Use this attribute to set the shadow's config.
     * @remarks See example '3d shadow' for more details.
     */
    shadow = new DirectionalShadow(this);
    isShadowNeedsUpdate = true;
    /**
     * The name of instance's class.
     */
    className() {
        return 'DirectionalLight';
    }

    constructor(color?: number | string, intensity?: number) {
        super(color, intensity);
        this.position.copy(Object3D.DefaultUp);
        this.updateMatrix();
    }
    /**
     * Copy the data to this light instance from source.
     * This method need override in derived classes to copy extended data.
     * @param {Light} source the data source.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    copy(source: DirectionalLight, recursive?: boolean) {
        super.copy(source, recursive);
        this.shadow.copy(source.shadow);
        return this;
    }
    clone(recursive?: boolean) {
        return new DirectionalLight().copy(this, recursive);
    }
    /**
     * @internal
     */
    refreshUniforms(viewMatrix: Matrix4) {
        this.uniforms.color.copy(this.color).multiplyScalar(this.intensity);
        this.uniforms.direction.setFromMatrixPosition(this.matrixWorld);
        this.vector3 = this.target.position;
        this.uniforms.direction.sub(this.vector3).transformDirection(viewMatrix);
    }

    updateUniformForForward(program: WGLProgram, index: number) {
        const lightPrefix = `directionalLights[${index}]`;
        const shadowPrefix = `directionalLightShadowsInfo[${index}]`;
        this.updateUniformByPrefix(program, lightPrefix, shadowPrefix);
    }

    updateUniformForDefer(program: WGLProgram) {
        if (this.shadow.enabled) {
            program.setUniform('viewMatrix', this.viewMatrix);
        }
        if (this.shadow.enabled) {
            program.setUniform('invViewMatrix', this.invViewMatrix);
        }
        this.updateUniformByPrefix(program, 'directionalLight', 'directionalLightShadowsInfo');
        this.shadow.updateMapUniform(program, 'directionalShadowMap');
    }

    updateUniformByPrefix(program: WGLProgram, lightPrefix: string, shadowPrefix: string) {
        program.setUniform(lightPrefix + '.direction', this.uniforms.direction);
        program.setUniform(lightPrefix + '.color', this.uniforms.color);
        this.shadow.updateUniforms(program, shadowPrefix);
    }

    destroy() {
        super.destroy();
        if (this.target) {
            this.target.destroy();
        }
        this.shadow.camera.destroy();
    }

    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     * @internal
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<DirectionalLight>(['target', 'shadow']);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     * @internal
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<DirectionalLight>(['target', 'shadow']);
    }
    /**
     * @internal
     */
    static getLightCollectShader() {
        return directionLightCollect;
    }

    static getHeader(isArray: boolean) {
        if (isArray) {
            return 'uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];';
        } else {
            return 'uniform DirectionalLight directionalLight;';
        }
    }

    /**
     * @internal
     */
    static getShaderInclude() {
        return directionalLightInclude;
    }
}

export const directionalLightInclude = createShaderBlock(`
struct DirectionalLight {
    vec3 direction;
    vec3 color;
};

void getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {
    directLight.color = directionalLight.color;
    directLight.direction = directionalLight.direction;
    directLight.visible = true;
}
`);

export const directionLightCollect = `
DirectionalLight directionalLight;

#if defined( USE_SHADOWMAP ) && ( 0 < NUM_DIR_LIGHT_SHADOWS )
DirectionalLightShadow shadowInfo;
#endif

float dir_light_bias;
#pragma unroll_loop_start
for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
    directionalLight = directionalLights[ i ];
    getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );

    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
    shadowInfo = directionalLightShadowsInfo[ i ];
    dir_light_bias = shadowInfo.shadowBias;
    if (shadowInfo.shadowAutoBias == 1.) {
        float lightDotView = dot(normalize(directionalLight.direction), normalize(normal));
        dir_light_bias = length(shadowInfo.shadowRenderSize / shadowInfo.shadowMapSize) * (1.0 - lightDotView) * -0.5 / (shadowInfo.shadowCameraFar - shadowInfo.shadowCameraNear);
        dir_light_bias = min(dir_light_bias, shadowInfo.shadowBias);
    }
    directLight.color *= getDirectionalShadow(directionalShadowMap[ i ], shadowInfo.shadowMapSize, dir_light_bias, shadowInfo.shadowRadius, vDirectionalShadowCoord[ i ], shadowInfo.shadowIntensity);
    #endif

    RE_Direct( directLight, geometry, material, reflectedLight);
}
#pragma unroll_loop_end
`;
