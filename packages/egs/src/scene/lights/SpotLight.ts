import { Object3D } from '../Object3D';
import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { Color } from '../../math/Color';
import { Vector3 } from '../../math/Vector3';
import { Matrix4 } from '../../math/Matrix4';
import { createShaderBlock } from '../../renderer/shader/builders/ShaderBlock';
import { Deserializer, Serializer } from '../../utils/Serialization';
import { SpotShadow } from '../shadows/SpotShadow';
import { Cone } from '../../math/Cone';
import { Quaternion } from '../../math/Quaternion';
import { Nullable, singleton } from '../../utils/Utils';
import { Light } from './Light';
import { Texture2D } from '../../elements/textures/Texture2D';
import { WatchedVector3 } from '../../math/WatchedVector3';
import { ContentBridge, lightProperty, lightPropertyDeclare } from '../../ContentAPI';
import { Drawable } from '../drawables/Drawable';
import { Vector2 } from '../../math/Vector2';
import { TextureV2 } from '../../elements/textures/TextureV2';

const quaternion = new Quaternion();
const matrix = new Matrix4();
const vector1 = new Vector3();
const vector2 = new Vector3();

const defaultTarget = singleton(() => new Object3D());
/**
 * This light gets emitted from a single point in one direction,
 * along a cone that increases in size the further from the light it gets.
 */
export class SpotLight<T extends TextureV2 | Texture2D = Texture2D> extends Light {
    @lightProperty()
    viewMatrix: Matrix4 = new Matrix4();
    invViewMatrix: Matrix4 = new Matrix4();

    static get DEFAULT_TARGET() {
        return defaultTarget();
    }
    /**
     * The target is a point in world space used to calculate the direction of light.
     */
    @lightProperty()
    private _target: Object3D = SpotLight.DEFAULT_TARGET;
    get target() {
        if (this._target) {
            return this._target;
        } else {
            return SpotLight.DEFAULT_TARGET;
        }
    }
    set target(t) {
        this._target = t;
    }

    @lightProperty()
    private _distance: number;
    /**
     * Maximum extent of the spotlight, in radians, from its direction. Should be no more than Math.PI/2.
     * @defaultValue `Math.PI/3`
     */
    @lightProperty()
    angle: number;
    /**
     * Percent of the spotlight cone that is attenuated due to penumbra. Takes values between zero and 1.
     * @defaultValue `0`
     */
    @lightProperty()
    penumbra: number;
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
     * The amount the light dims along the distance of the light
     * In physically correct mode, decay = 2 leads to physically realistic light falloff.
     * @defaultValue `1` representing the intensity do not decay with distance increasing.
     */
    @lightProperty()
    decay: number;
    @lightProperty()
    isIESEnabled: boolean = false;
    /**
     * To support IES, spotLight set isRotationModeOn as true to calculate intensity according to rotation of light.
     * @defaultValue `false` calculate intensity according to target of light.
     */
    @lightProperty()
    isRotationModeOn: boolean = false;
    /**
     * Check the type whether it belongs to PerspectiveCamera.
     * This value should not be changed by user.
     */
    isSpotLight = true;
    defaultDirection = new Vector3(0, 0, 1);
    direction = new Vector3();
    private uniforms = {
        position: new Vector3(),
        worldPosition: new Vector3(),
        direction: new Vector3(),
        iesTextureResolution: new Vector2(),
        color: new Color(),
        distance: 0,
        coneCos: 0,
        penumbraCos: 0,
        decay: 0,
        isIESEnabled: false,
        viewMatrix: new Matrix4(),
        transformMatrix: new Matrix4(),
        halfAngle: 0,
    };

    shadow = new SpotShadow<T>(this);

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

    isShadowNeedsUpdate = true;

    @lightPropertyDeclare()
    // will changed by setter/getter for up, defined blow.
    private _up = new WatchedVector3(0, 0, 1);

    /**
     * @internal
     */
    cone = new Cone();

    destroy() {
        super.destroy();
        if (this.target) {
            this.target.destroy();
        }
        this.shadow.camera.destroy();
    }

    /**
     * The name of instance's class.
     */
    className() {
        return 'SpotLight';
    }

    constructor(color?: number | string, intensity?: number, distance?: number,
        angle?: number, penumbra?: number, decay?: number, isIESEnabled?: boolean, textureIES?: T, iesIntensityScale?: number, iesTextureResolution?: Vector2) {
        super(color, intensity);
        this.position.copy(Object3D.DefaultUp);
        this.up.set(0, 0, 1);
        this._up.onChange = () => ContentBridge.lightSetProperty(this, 'up', this, this._up);
        this.distance = (distance !== undefined) ? distance : 50;
        this.angle = (angle !== undefined) ? angle : Math.PI / 3;
        this.penumbra = (penumbra !== undefined) ? penumbra : 0;
        this.iesIntensityScale = (iesIntensityScale !== undefined) ? iesIntensityScale : 1;
        this.iesTextureResolution = (iesTextureResolution !== undefined) ? iesTextureResolution : new Vector2(1, 1);
        this.decay = (decay !== undefined) ? decay : 1;	// for physically correct lights, should be 2.
        this.updateMatrix();
        this.isIESEnabled = (isIESEnabled !== undefined) ? isIESEnabled : false;
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
     * When distance is zero, light does not attenuate.
     * When distance is non-zero, light will attenuate linearly from maximum intensity at the light's position down to zero at this distance from the light.
     */
    get distance() {
        return this._distance;
    }
    set distance(dis: number) {
        this._distance = dis;
    }

    /**
     * Copy the data to this light instance from source.
     * This method need override in derived classes to copy extended data.
     * @param {SpotLight} source the data source.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    copy(source: SpotLight<T>, recursive?: boolean) {
        super.copy(source, recursive);
        this.distance = source.distance;
        this.angle = source.angle;
        this.penumbra = source.penumbra;
        this.decay = source.decay;
        this.isIESEnabled = source.isIESEnabled;
        this.iesTextureResolution = source.iesTextureResolution;
        this.iesIntensityScale = source.iesIntensityScale;
        this.textureIES = source.textureIES;
        this.shadow.copy(source.shadow);
        return this;
    }

    clone(recursive?: boolean) {
        return new SpotLight<T>().copy(this, recursive);
    }

    getDirection(): Vector3 {
        if (this.isRotationModeOn) {
            return this.direction.copy(this.defaultDirection).applyQuaternion(this.getWorldQuaternion(quaternion));
        } else {
            this.direction.setFromMatrixPosition(this.matrixWorld);
            this.direction.sub(this.target.position);
            return this.direction;
        }
    }
    /**
     * @internal
     */
    refreshUniforms(viewMatrix: Matrix4) {
        // scene camera view
        this.uniforms.position.setFromMatrixPosition(this.matrixWorld).applyMatrix4(viewMatrix);
        this.uniforms.worldPosition.setFromMatrixPosition(this.matrixWorld);

        if (this.isIESEnabled) {
            if (this.isRotationModeOn) {
                this.uniforms.transformMatrix.extractRotation(this.matrixWorld);
            } else {
                this.target.getWorldPosition(vector1);
                this.getWorldPosition(vector2);
                matrix.lookAt(vector2, vector1, this.up);
                this.uniforms.transformMatrix.extractRotation(matrix);
            }
        } // skip transformMatrix when ies is disabled

        this.uniforms.direction.copy(this.getDirection());
        this.uniforms.direction.transformDirection(viewMatrix);

        this.uniforms.viewMatrix = viewMatrix;
        this.uniforms.color.copy(this.color).multiplyScalar(this.getIntensity());
        this.uniforms.distance = this.distance;
        this.uniforms.decay = this.decay;
        this.uniforms.penumbraCos = Math.cos(this.angle / 2 * (1 - this.penumbra));
        this.uniforms.coneCos = Math.cos(this.angle / 2);
        this.uniforms.halfAngle = this.angle / 2;
        this.uniforms.isIESEnabled = this.isIESEnabled;
        this.uniforms.iesTextureResolution = this.iesTextureResolution;
    }

    updateUniformForForward(program: WGLProgram, index: number) {
        const prefix = `spotLights[${index}]`;
        const shadowPrefix = `spotLightShadowsInfo[${index}]`;
        this.updateUniformByPrefix(program, prefix, shadowPrefix);
    }

    updateUniformForDefer(program: WGLProgram) {
        if (this.shadow.enabled) {
            program.setUniform('viewMatrix', this.viewMatrix);
        }
        program.setUniform('invViewMatrix', this.invViewMatrix);
        program.setTexture2D('spotLightIES', this.getIESMapOrDefault());
        this.updateUniformByPrefix(program, 'spotLight', 'spotLightShadowsInfo');
        this.shadow.updateMapUniform(program, 'spotShadowMap');
    }

    updateUniformByPrefix(program: WGLProgram, lightPrefix: string, shadowPrefix: string) {
        program.setUniform(lightPrefix + '.position', this.uniforms.position);
        program.setUniform(lightPrefix + '.worldPosition', this.uniforms.worldPosition);
        program.setUniform(lightPrefix + '.direction', this.uniforms.direction);
        program.setUniform(lightPrefix + '.spotViewMatrix', this.uniforms.viewMatrix);
        program.setUniform(lightPrefix + '.color', this.uniforms.color);
        program.setUniform(lightPrefix + '.distance', this.uniforms.distance);
        program.setUniform(lightPrefix + '.coneCos', this.uniforms.coneCos);
        program.setUniform(lightPrefix + '.penumbraCos', this.uniforms.penumbraCos);
        program.setUniform(lightPrefix + '.decay', this.uniforms.decay);
        program.setUniform(lightPrefix + '.halfAngle', this.uniforms.halfAngle);
        program.setUniform(lightPrefix + '.transformMatrix', this.uniforms.transformMatrix);
        program.setUniform(lightPrefix + '.isIESEnabled', this.uniforms.isIESEnabled ? 1.0 : 0.0);
        program.setUniform(lightPrefix + '.iesTextureResolution', this.uniforms.iesTextureResolution);
        this.shadow.updateUniforms(program, shadowPrefix);
    }

    static getHeader(isArray: boolean) {
        if (isArray) {
            return `
                uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
                uniform sampler2D spotIES[ NUM_SPOT_LIGHTS ];
            `;
        } else {
            return `
                uniform SpotLight spotLight;
                uniform sampler2D spotLightIES;
            `;
        }
    }

    /**
     * @internal
     */
    static getLightCollectShader() {
        return spotLightCollect;
    }
    /**
     * @internal
     */
    static getShaderInclude() {
        return spotLightInclude;
    }

    getIESMapOrDefault() {
        return this.textureIES || Texture2D.default;
    }

    updateCone() {
        this.cone.tip.setFromMatrixPosition(this.matrixWorld);
        this.cone.fov = this.angle;
        this.cone.direction.copy(this.getDirection());
        this.cone.update();
    }

    isDrawableOutsideLightVolume(drawable: Drawable) {
        this.cone.tip.setFromMatrixPosition(this.matrixWorld);
        this.cone.fov = this.angle;
        this.cone.direction.copy(this.getDirection());
        this.cone.update();

        return this.cone.isSphereOutsideCone(drawable.worldBoundingSphere);
    }

    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<SpotLight>(['target', 'distance', 'angle', 'penumbra', 'decay', 'isIESEnabled', 'iesTextureResolution', 'iesIntensityScale', 'isRotationModeOn', 'defaultDirection', 'direction', 'shadow', 'textureIES', 'up']);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<SpotLight>(['target', 'distance', 'angle', 'penumbra', 'decay', 'isIESEnabled', 'iesTextureResolution', 'iesIntensityScale', 'isRotationModeOn', 'defaultDirection', 'direction', 'shadow', 'textureIES', 'up']);
    }
}

export const spotLightCollect = `
SpotLight spotLight;

#if defined( USE_SHADOWMAP ) && ( 0 < NUM_SPOT_LIGHT_SHADOWS )
SpotLightShadow spotShadowInfo;
#endif
vec4 spotViewPos;
float frustumTest, spotShadow, bias, lightDotView;
vec3 lightToView;
#pragma unroll_loop_start
for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
    spotLight = spotLights[ i ];
    getSpotDirectLightIrradiance(spotIES[ i ], spotLight, geometry, vWorldPosition, directLight);
    #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
    spotShadowInfo = spotLightShadowsInfo[ i ];
    spotViewPos = spotLight.spotViewMatrix * vec4(vWorldPosition, 1.0);
    lightToView = spotViewPos.xyz - spotLight.position;
    lightDotView = dot(normalize(spotLight.direction), normalize(lightToView));
    frustumTest = step(0.0, lightDotView - spotLight.halfAngle); // 0 is inner, 1 is outer
    bias = spotShadowInfo.shadowBias;
    if (spotShadowInfo.shadowAutoBias == 1.) {
        float distance = length(lightToView) * lightDotView;
        vec2 renderSize = spotShadowInfo.shadowCaptureScale * distance;
        bias = length(renderSize / spotShadowInfo.shadowMapSize) * (1.0 - lightDotView) * -0.5 / (spotShadowInfo.shadowCameraFar - spotShadowInfo.shadowCameraNear);
        bias = min(bias, spotShadowInfo.shadowBias);
    }
    spotShadow = mix(getShadow(spotShadowMap[ i ], spotShadowInfo.shadowMapSize, bias, spotShadowInfo.shadowRadius, vSpotShadowCoord[ i ], spotShadowInfo.shadowIntensity), 1.0, frustumTest);
    directLight.color *= spotShadow;
    #endif
    RE_Direct( directLight, geometry, material, reflectedLight );
}
#pragma unroll_loop_end
`;

export const spotLightInclude = createShaderBlock(`
struct SpotLight {
    vec3 position;
    vec3 worldPosition;
    vec3 direction;
    mat4 transformMatrix;
    vec3 color;
    float distance;
    float decay;
    float coneCos;
    float penumbraCos;
    mat4 spotViewMatrix;
    float halfAngle;
    float isIESEnabled;
    vec2 iesTextureResolution;
};

// directLight is an out parameter as having it as a return value caused compiler errors on some devices
void getSpotDirectLightIrradiance(const in sampler2D spotIES, const in SpotLight spotLight, const in GeometricContext geometry,const in vec3 worldPosition, out IncidentLight directLight ) {
    vec3 lVector = spotLight.position - geometry.position;
    directLight.direction = normalize( lVector );

    float lightDistance = length( lVector );
    float angleCos = dot( directLight.direction, spotLight.direction );

    if ( angleCos > spotLight.coneCos ) {
        float spotEffect = smoothstep( spotLight.coneCos, spotLight.penumbraCos, angleCos );
        directLight.color = spotLight.color;
         if (spotLight.isIESEnabled == 1.0) {
            float IESIntensity = IESLightEffect(worldPosition, spotLight.worldPosition, spotLight.transformMatrix, spotIES, spotLight.iesTextureResolution);
            float distanceRatio = spotLight.distance / max(lightDistance, 1e-4);
            directLight.color *= spotEffect * IESIntensity * pow( distanceRatio, spotLight.decay); // The unit is mm -> 1 / pow(d, 2);
        } else {
            directLight.color *= spotEffect * punctualLightIntensityToIrradianceFactor(lightDistance, spotLight.distance, spotLight.decay);
        }
        directLight.visible = true;
    } else {
        directLight.color = vec3( 0.0 );
        directLight.visible = false;
    }
}
`);

Object.defineProperty(SpotLight.prototype, 'up', {
    get() {
        return this._up;
    },
    set(value) {
        if (this._up) {
            this._up.set(value.x, value.y, value.z);
        }
    },
    enumerable: true,
    configurable: true
});
