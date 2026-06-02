import { Color } from '../../math/Color';
import { Matrix4 } from '../../math/Matrix4';
import { Vector3 } from '../../math/Vector3';
import { createShaderBlock } from '../../renderer/shader/builders/ShaderBlock';
import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { Deserializer, Serializer } from '../../utils/Serialization';
import { PointShadow } from '../shadows/PointShadow';
import { Light } from './Light';
import { Nullable } from '../../utils/Utils';
import { lightProperty } from '../../ContentAPI';
import { Vector2 } from '../../math/Vector2';
import { Texture2D } from '../../elements/textures/Texture2D';
import { TextureV2 } from '../../elements/textures/TextureV2';
/**
 * A light that gets emitted from a single point in all directions.
 * A common use case for this is to replicate the light emitted from a bare lightbulb.
 */
export class PointLight<T extends TextureV2 | Texture2D = Texture2D> extends Light {
    viewMatrix: Matrix4 = new Matrix4();
    invViewMatrix: Matrix4 = new Matrix4();

    /**
     * When distance is zero, light does not attenuate.
     * When distance is non-zero, light will attenuate linearly from maximum intensity at the light's position down to zero at this distance from the light.
     */
    @lightProperty()
    distance: number;
    @lightProperty()
    isIESEnabled: boolean = false;
    /**
     * The amount the light dims along the distance of the light
     * In physically correct mode, decay = 2 leads to physically realistic light falloff.
     * @defaultValue `1` representing the intensity do not decay with distance increasing.
     */
    @lightProperty()
    decay: number;
    /**
     * Check the type whether it belongs to PerspectiveCamera.
     * This value should not be changed by user.
     */
    isPointLight = true;
    private uniforms = {
        position: new Vector3(),
        worldPosition: new Vector3(),
        color: new Color(),
        distance: 0,
        decay: 0,
        isIESEnabled: false,
        iesTextureResolution: new Vector2(),
        transformMatrix: new Matrix4(),
    };
    /**
     * Use this attribute to set the shadow's config.
     * @remarks See example '3d shadow' for more details.
     */
    shadow = new PointShadow<T>(this);
    isShadowNeedsUpdate = true;

    private _textureIES_inner: Nullable<T> = null;
    @lightProperty()
    protected _textureIES: T = Texture2D.default as any;
    get textureIES(): Nullable<T> {
        return this._textureIES_inner;
    }
    set textureIES(value: Nullable<T>) {
        this._textureIES_inner = value;
        this._textureIES = value || Texture2D.default as any;
    }
    /**
     * The intensity scale of IES file.
     * @defaultValue `1`
     */
    @lightProperty()
    iesIntensityScale: number;
    /**
     * Resolution of ies texture.
     * @defaultValue `Vector2(182, 1)`
     */
    @lightProperty()
    iesTextureResolution: Vector2 = new Vector2();
    /**
     * The name of instance's class.
     */
    className() {
        return 'PointLight';
    }

    constructor(color?: number | string, intensity?: number, distance?: number, decay?: number, isIESEnabled?: boolean,
        textureIES?: T, iesIntensityScale?: number, iesTextureResolution?: Vector2) {
        super(color, intensity);
        this.distance = (distance !== undefined) ? distance : 0;
        this.decay = (decay !== undefined) ? decay : 1;	// for physically correct lights, should be 2.
        this.isIESEnabled = (isIESEnabled !== undefined) ? isIESEnabled : false;
        this.iesIntensityScale = (iesIntensityScale !== undefined) ? iesIntensityScale : 1;
        this.iesTextureResolution = (iesTextureResolution !== undefined) ? iesTextureResolution : new Vector2(1, 1);
        this.textureIES = textureIES ? textureIES : null;
    }
    /**
     * The light's power.
     * In physically correct mode, the luminous power of the light measured in lumens.
     * This is directly related to the {@link intensity | intensity } in the ratio
     */
    get power() {
        return this.intensity * 4 * Math.PI;
    }
    set power(power: number) {
        this.intensity = power / (4 * Math.PI);
    }
    getIntensity() {
        const scale = 3 / (this.color.r + this.color.g + this.color.b);
        return this.isIESEnabled ? scale * 2.1 * this.intensity * this.iesIntensityScale / Math.PI / 1000 : this.intensity;
    }
    /**
     * Copy the data to this light instance from source.
     * This method need override in derived classes to copy extended data.
     * @param {PointLight} source the data source.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    copy(source: PointLight<T>, recursive?: boolean) {
        super.copy(source, recursive);
        this.distance = source.distance;
        this.decay = source.decay;
        this.isIESEnabled = source.isIESEnabled;
        this.textureIES = source.textureIES;
        this.iesTextureResolution = source.iesTextureResolution;
        this.iesIntensityScale = source.iesIntensityScale;
        this.shadow.copy(source.shadow);
        return this;
    }
    clone(recursive?: boolean) {
        return new PointLight<T>().copy(this, recursive);
    }
    /**
     * @internal
     */
    refreshUniforms(viewMatrix: Matrix4) {
        this.uniforms.position.setFromMatrixPosition(this.matrixWorld).applyMatrix4(viewMatrix);
        this.uniforms.worldPosition.setFromMatrixPosition(this.matrixWorld);
        this.uniforms.transformMatrix.extractRotation(this.matrixWorld);
        this.uniforms.color.copy(this.color).multiplyScalar(this.getIntensity());
        this.uniforms.iesTextureResolution = this.iesTextureResolution;
        this.uniforms.distance = this.distance; // ok this may simpler later? TODO
        this.uniforms.decay = this.decay;
        this.uniforms.isIESEnabled = this.isIESEnabled;
    }
    /**
     * @internal
     */
    updateUniformForForward(program: WGLProgram, index: number) {
        const lightPrefix = `pointLights[${index}]`;
        const shadowPrefix = `pointLightShadowsInfo[${index}]`;
        this.updateUniformByPrefix(program, lightPrefix, shadowPrefix);
    }

    updateUniformForDefer(program: WGLProgram) {
        program.setTexture2D('pointLightIES', this.textureIES || Texture2D.default);
        if (this.shadow.enabled) {
            program.setUniform('viewMatrix', this.viewMatrix);
        }
        program.setUniform('invViewMatrix', this.invViewMatrix);
        this.updateUniformByPrefix(program, 'pointLight', 'pointLightShadowsInfo');
        this.shadow.updateMapUniform(program, 'pointShadowMap');
    }

    updateUniformByPrefix(program: WGLProgram, lightPrefix: string, shadowPrefix: string) {
        program.setUniform(lightPrefix + '.position', this.uniforms.position);
        program.setUniform(lightPrefix + '.worldPosition', this.uniforms.worldPosition);
        program.setUniform(lightPrefix + '.transformMatrix', this.uniforms.transformMatrix);
        program.setUniform(lightPrefix + '.color', this.uniforms.color);
        program.setUniform(lightPrefix + '.distance', this.uniforms.distance);
        program.setUniform(lightPrefix + '.decay', this.uniforms.decay);
        program.setUniform(lightPrefix + '.isIESEnabled', this.uniforms.isIESEnabled ? 1.0 : 0.0);
        program.setUniform(lightPrefix + '.iesTextureResolution', this.uniforms.iesTextureResolution);
        this.shadow.updateUniforms(program, shadowPrefix);
    }

    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<PointLight>(['distance', 'decay', 'isIESEnabled', 'iesTextureResolution', 'iesIntensityScale', 'shadow']);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<PointLight>(['distance', 'decay', 'isIESEnabled', 'iesTextureResolution', 'iesIntensityScale', 'shadow']);
    }
    /**
     * @internal
     */
    static getLightCollectShader() {
        return pointLightCollect;
    }
    /**
     * @internal
     */
    static getShaderInclude() {
        return pointLightInclude;
    }

    static getHeader(isArray: boolean) {
        if (isArray) {
            return `
                uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
                uniform sampler2D pointIES[ NUM_POINT_LIGHTS ];
            `;
        } else {
            return `
                uniform PointLight pointLight;
                uniform sampler2D pointLightIES;
            `;
        }
    }

    destroy() {
        super.destroy();
        this.shadow.camera.destroy();
    }

    getIESMapOrDefault() {
        return this.textureIES || Texture2D.default;
    }
}

export const punctualLightIntensityToIrradianceFactor = createShaderBlock(
    `
        float punctualLightIntensityToIrradianceFactor(const in float lightDistance, const in float cutoffDistance, const in float decayExponent) {

        #if defined(PHYSICALLY_CORRECT_LIGHTS)

            // based upon Frostbite 3 Moving to Physically-based Rendering
            // page 32, equation 26: E[window1]
            // https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
            // this is intended to be used on spot and point lights who are represented as luminous intensity
            // but who must be converted to luminous irradiance for surface lighting calculation
            float distanceFalloff = 1.0 / max(pow(lightDistance, decayExponent), 0.01);

            if (cutoffDistance > 0.0) {
                distanceFalloff *= pow2(saturate(1.0 - pow4(lightDistance / cutoffDistance)));
            }
            return distanceFalloff;

        #else
            if (cutoffDistance > 0.0 && decayExponent > 0.0) {
                return pow(saturate(-lightDistance / cutoffDistance + 1.0), decayExponent);
            }
            return 1.0;
        #endif
        }
        `);

// any light should has a struct of data
// and from given geometry ctx, provide a IncidentLight
const pointLightInclude = createShaderBlock(`
        struct PointLight {
            vec3 position;
            vec3 worldPosition;
            mat4 transformMatrix;
            vec3 color;
            float distance;
            float decay;
            float isIESEnabled;
            vec2 iesTextureResolution;
        };

        // directLight is an out parameter as having it as a return value caused compiler errors on some devices
        void getPointDirectLightIrradiance(const in sampler2D pointIES, const in PointLight pointLight, const in GeometricContext geometry,const in vec3 worldPosition, out IncidentLight directLight ) {
            vec3 lVector = pointLight.position - geometry.position;
            directLight.direction = normalize(lVector);
            float lightDistance = length(lVector);
            directLight.color = pointLight.color;
            if (pointLight.isIESEnabled == 1.0) {
                float IESIntensity = IESLightEffect(worldPosition, pointLight.worldPosition, pointLight.transformMatrix, pointIES, pointLight.iesTextureResolution);
                float distanceRatio = pointLight.distance / max(lightDistance, 1e-4);
                directLight.color *= IESIntensity * pow( distanceRatio, pointLight.decay); // The unit is mm -> 1 / pow(d, 2);
            } else {
                directLight.color *= punctualLightIntensityToIrradianceFactor(lightDistance, pointLight.distance, pointLight.decay);
            }
            directLight.visible = (directLight.color != vec3(0.0));
        }
        `);

export const pointLightCollect = `
PointLight pointLight;

#if defined( USE_SHADOWMAP ) && ( 0 < NUM_POINT_LIGHT_SHADOWS )
PointLightShadow pointShadowInfo;
#endif

#pragma unroll_loop_start
for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
    pointLight = pointLights[ i ];
    getPointDirectLightIrradiance(pointIES[ i ], pointLight, geometry, vWorldPosition, directLight);
    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
    pointShadowInfo = pointLightShadowsInfo[ i ];
    if (all(bvec2(UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS, directLight.visible))) {
        float depth;

        vec3 origin = (vPointShadowWorldCoord[ i ].xyz - pointLight.worldPosition);
        vec3 originAbs = abs(origin);
        vec3 directionAbs = normalize(originAbs);

        float c = - (pointShadowInfo.shadowCameraFar + pointShadowInfo.shadowCameraNear) / (pointShadowInfo.shadowCameraFar - pointShadowInfo.shadowCameraNear);
        float d = - 2.0 * pointShadowInfo.shadowCameraFar * pointShadowInfo.shadowCameraNear / (pointShadowInfo.shadowCameraFar - pointShadowInfo.shadowCameraNear);

        float xy = step(originAbs.y, originAbs.x);
        float xz = step(originAbs.z, originAbs.x);
        float yz = step(originAbs.z, originAbs.y);
        float h = xy * xz;
        float j = (1. - xy) * yz;
        float k = (1. - xz) * (1. - yz);
        vec3 forward = vec3(h * sign(origin.x), j * sign(origin.y), k * sign(origin.z));

        depth = dot(origin, forward);
        float distance = depth;
        depth = (-depth * c + d) / depth;
        depth = clamp(depth * 0.5 + 0.5, 0.0, 1.0);
        float bias = pointShadowInfo.shadowBias;
        float shadowIntensity = pointShadowInfo.shadowIntensity;
        if (pointShadowInfo.shadowAutoBias == 1.) {
            float dotNormal = distance / length(origin);
            vec2 renderSize = pointShadowInfo.shadowCaptureScale * distance;
            bias = length(renderSize / pointShadowInfo.shadowMapSize) * (1.0 - dotNormal) * -0.5 / (pointShadowInfo.shadowCameraFar - pointShadowInfo.shadowCameraNear);
            bias = min(bias, pointShadowInfo.shadowBias);
        }
        directLight.color *= getPointShadow(pointShadowMap[ i ],
                             bias,
                             vPointShadowWorldCoord[ i ] - vec4(pointLight.worldPosition, 0.0),
                             depth,
                             shadowIntensity);
    }
    #endif
    RE_Direct(directLight, geometry, material, reflectedLight);
}
#pragma unroll_loop_end
            `;
