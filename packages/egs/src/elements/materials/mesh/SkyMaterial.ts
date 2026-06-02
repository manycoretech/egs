import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { Side } from '../../../utils/Constants';
import { ContentBridge, materialProperty } from '../../../ContentAPI';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { Nullable } from '../../../utils/Utils';
import { Texture } from '../../textures/Texture';
import { PassQuadMaterialBase } from '../quad/PassMaterialBase';
import { BackgroundLikeMaterial } from '../base';
import { ReadonlyVector3 } from '../../../math/Vector3';
import { readonlyMath } from '../../../math/Readonly';

export class SkyMaterial extends BackgroundLikeMaterial {
    private _luminance = 0.3;
    private _turbidity = 1;
    private _rayleigh = 1;
    private _mieCoefficient = 0.003;
    private _mieDirectionalG = 0.8;
    get luminance() { return this._luminance; }
    set luminance(v) {
        if (v === this._luminance) { return; }
        ContentBridge.materialSetProperty(this, 'luminance', v);
        this._luminance = v;
        this.tEquirect = null;
    }
    get turbidity() { return this._turbidity; }
    set turbidity(v) {
        if (v === this._turbidity) { return; }
        ContentBridge.materialSetProperty(this, 'turbidity', v);
        this._turbidity = v;
        this.tEquirect = null;
    }
    get rayleigh() { return this._rayleigh; }
    set rayleigh(v) {
        if (v === this._rayleigh) { return; }
        ContentBridge.materialSetProperty(this, 'rayleigh', v);
        this._rayleigh = v;
        this.tEquirect = null;
    }
    get mieCoefficient() { return this._mieCoefficient; }
    set mieCoefficient(v) {
        if (v === this._luminance) { return; }
        ContentBridge.materialSetProperty(this, 'mieCoefficient', v);
        this._mieCoefficient = v;
        this.tEquirect = null;
    }
    get mieDirectionalG() { return this._mieDirectionalG; }
    set mieDirectionalG(v) {
        if (v === this._mieDirectionalG) { return; }
        ContentBridge.materialSetProperty(this, 'mieDirectionalG', v);
        this._mieDirectionalG = v;
        this.tEquirect = null;
    }

    @materialProperty()
    tEquirect: Nullable<Texture> = null;

    className() {
        return 'SkyMaterial';
    }

    constructor() {
        super({
            side: Side.DoubleSide,
            depthWrite: false,
            depthTest: false,
        });
    }

    updateShadingUniforms(p: WGLProgram) {
        if (this.tEquirect) { // fast path
            p.setTexture2D('skyMap', this.tEquirect);
            return;
        }

        p.setUniform('luminance', this.luminance);
        p.setUniform('turbidity', this.turbidity);
        p.setUniform('rayleigh', this.rayleigh);
        p.setUniform('mieCoefficient', this.mieCoefficient);
        p.setUniform('mieDirectionalG', this.mieDirectionalG);
    }

    extendShaderShading(b: ShaderBuilder, _: any) {
        if (this.tEquirect) { // fast path
            b.addUniform('skyMap', WebGLShaderDataType.Sampler2D)
                .addVarying(ShaderVaryingTypes.worldPosition)
                .inject(ShaderInjectionTypes.gl_FragColor, `
                    const float pi = 3.141592653589793238462643383279502884197169;
                    const float halfPI = 3.141592653589793238462643383279502884197169 * 0.5;
                    const vec3 cameraPos = vec3(0.0, 0.0, 0.0);
                    vec3 skyColor = vec3(0.0);
                    vec3 direction = normalize(vWorldPosition - cameraPos);
                    float longitude = atan(direction.z, direction.x); // Calculate the longitude angle
                    float latitude = asin(direction.y); // Calculate the latitude angle
                    vec2 uv = vec2(
                        (longitude + pi) / (2.0 * pi), // Normalize longitude to range [0, 1]
                        (latitude + halfPI) / pi // Normalize latitude to range [0, 1]
                    );
                    gl_FragColor = vec4(texture2D(skyMap, uv).xyz, 1.0);
                `);
            return;
        }

        b.addUniform('luminance', WebGLShaderDataType.Float)
            .addUniform('turbidity', WebGLShaderDataType.Float)
            .addUniform('rayleigh', WebGLShaderDataType.Float)
            .addUniform('mieCoefficient', WebGLShaderDataType.Float)
            .addUniform('mieDirectionalG', WebGLShaderDataType.Float)
            .addVaryingCustom('vSunDirection', WebGLShaderDataType.Vec3)
            .addVaryingCustom('vSunfade', WebGLShaderDataType.Float)
            .addVaryingCustom('vSunE', WebGLShaderDataType.Float)
            .addVaryingCustom('vBetaR', WebGLShaderDataType.Vec3)
            .addVaryingCustom('vBetaM', WebGLShaderDataType.Vec3)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addFragment(SkyFrag)
            .addVertex(SkyVert)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                    gl_FragColor = vec4(sky(vWorldPosition, cameraPos), 1.0);
                `)
            .inject(ShaderInjectionTypes.vary_any, SkyVray);
    }

    generateShaderKey(r: ShaderComponentRegistry): string {
        return super.generateShaderKey(r) + (this.tEquirect ? 1 : 0);
    }

    copy() {
        return this;
    }

    clone() {
        return new SkyMaterial();
    }

    traverseTexture(visitor: (tex: Texture) => void) {
        super.traverseTexture(visitor);
        if (this.tEquirect !== null) {
            visitor(this.tEquirect);
        }
    }
}

export class PreSkyMapMaterial extends PassQuadMaterialBase {
    @materialProperty()
    luminance = 0.3;
    @materialProperty()
    turbidity = 1;
    @materialProperty()
    rayleigh = 1;
    @materialProperty()
    mieCoefficient = 0.003;
    @materialProperty()
    mieDirectionalG = 0.8;
    @materialProperty()
    up: ReadonlyVector3 = readonlyMath.vec3(0, 0, 1);

    className() {
        return 'PreSkyMapMaterial';
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setUniform('luminance', this.luminance);
        p.setUniform('turbidity', this.turbidity);
        p.setUniform('rayleigh', this.rayleigh);
        p.setUniform('mieCoefficient', this.mieCoefficient);
        p.setUniform('mieDirectionalG', this.mieDirectionalG);
        p.setUniform('backgroundUp', this.up);
    }

    extendShaderShading(builder: ShaderBuilder, _: any) {
        builder.addUniform('luminance', WebGLShaderDataType.Float)
            .addUniform('turbidity', WebGLShaderDataType.Float)
            .addUniform('rayleigh', WebGLShaderDataType.Float)
            .addUniform('mieCoefficient', WebGLShaderDataType.Float)
            .addUniform('mieDirectionalG', WebGLShaderDataType.Float)
            .addVaryingCustom('vSunDirection', WebGLShaderDataType.Vec3)
            .addVaryingCustom('vSunfade', WebGLShaderDataType.Float)
            .addVaryingCustom('vSunE', WebGLShaderDataType.Float)
            .addVaryingCustom('vBetaR', WebGLShaderDataType.Vec3)
            .addVaryingCustom('vBetaM', WebGLShaderDataType.Vec3)
            .addUniform('backgroundUp', WebGLShaderDataType.Vec3)
            .addVarying(ShaderVaryingTypes.fragUV)
            .addFragment(SkyFrag)
            .addVertex(SkyVert)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                float longitude = (vUv.x * 2.0 * pi) - pi; // Convert back to longitude angle
                float latitude = (vUv.y * pi) - halfPI; // Convert back to latitude angle
                float cosLatitude = cos(latitude);

                vec3 direction = normalize(
                    vec3(
                        cosLatitude * cos(longitude), // Calculate x component of the normal
                        sin(latitude), // Calculate y component of the normal
                        cosLatitude * sin(longitude) // Calculate z component of the normal
                    )
                );
                gl_FragColor = vec4(sky(direction, vec3(0.0)), 1.0);
            `)
            .inject(ShaderInjectionTypes.vary_any, SkyVray);
    }

}

const SkyVray = `
    vSunDirection = normalize(sunPosition);

    vSunE = sunIntensity(abs(dot(vSunDirection, backgroundUp)));

    vSunfade = 1.0 - clamp(1.0 - exp((sunPosition.y / 450000.0)), 0.0, 1.0);

    float rayleighCoefficient = rayleigh - (1.0 * (1.0 - vSunfade));

    // extinction (absorbtion + out scattering)
    // rayleigh coefficients
    vBetaR = totalRayleigh * rayleighCoefficient;

    // mie coefficients
    vBetaM = totalMie(turbidity) * mieCoefficient;
`;

const SkyVert = createShaderBlock(`
const vec3 sunPosition = vec3(1.0);

// constants for atmospheric scattering
const float e = 2.71828182845904523536028747135266249775724709369995957;
const float pi = 3.141592653589793238462643383279502884197169;

// wavelength of used primaries, according to preetham
const vec3 lambda = vec3(680E-9, 550E-9, 450E-9);
// this pre-calculation replaces older TotalRayleigh(vec3 lambda) function:
// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);

// mie stuff
// K coefficient for the primaries
const float v = 4.0;
const vec3 K = vec3(0.686, 0.678, 0.666);
// MieConst = pi * pow((2.0 * pi) / lambda, vec3(v - 2.0)) * K
const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);

// earth shadow hack
// cutoffAngle = pi / 1.95;
const float cutoffAngle = 1.6110731556870734;
const float steepness = 1.5;
const float EE = 1000.0;

float sunIntensity(float zenithAngleCos) {
    zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
    return EE * max(0.0, 1.0 - pow(e, -((cutoffAngle - acos(zenithAngleCos)) / steepness)));
}

vec3 totalMie(float T) {
    float c = (0.2 * T) * 10E-18;
    return 0.434 * c * MieConst;
}
`);

const SkyFrag = createShaderBlock(`
const vec3 cameraPos = vec3(0.0, 0.0, 0.0);

// constants for atmospheric scattering
const float pi = 3.141592653589793238462643383279502884197169;
const float halfPI = 3.141592653589793238462643383279502884197169 * 0.5;

const float n = 1.0003;     // refractive index of air
const float N = 2.545E25;   // number of molecules per unit volume for air at
                            // 288.15K and 1013mb (sea level -45 celsius)

// optical length at zenith for molecules
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;
// 66 arc seconds -> degrees, and the cosine of that
const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

// 3.0 / (16.0 * pi)
const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
// 1.0 / (4.0 * pi)
const float ONE_OVER_FOURPI = 0.07957747154594767;

float rayleighPhase(float cosTheta) {
    return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0));
}

float hgPhase(float cosTheta, float g) {
    float g2 = pow(g, 2.0);
    float inverse = 1.0 / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5);
    return ONE_OVER_FOURPI * ((1.0 - g2) * inverse);
}

// Filmic ToneMapping http://filmicgames.com/archives/75
const float A = 0.15;
const float B = 0.50;
const float C = 0.10;
const float D = 0.20;
const float E = 0.02;
const float F = 0.30;

const float whiteScale = 1.0748724675633854; // 1.0 / Uncharted2Tonemap(1000.0)

vec3 Uncharted2Tonemap(vec3 x) {
    return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

vec3 sky(vec3 worldPosition, vec3 cameraPosition){
    // optical length
    // cutoff angle at 90 to avoid singularity in next formula.
    float zenithAngle = acos(max(0.0, dot(backgroundUp, normalize(worldPosition - cameraPosition))));
    float inverse = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));
    float sR = rayleighZenithLength * inverse;
    float sM = mieZenithLength * inverse;

    // combined extinction factor
    vec3 Fex = exp(-(vBetaR * sR + vBetaM * sM));

    // in scattering
    float cosTheta = dot(normalize(worldPosition - cameraPosition), vSunDirection);

    float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
    vec3 betaRTheta = vBetaR * rPhase;

    float mPhase = hgPhase(cosTheta, mieDirectionalG);
    vec3 betaMTheta = vBetaM * mPhase;

    vec3 Lin = pow(vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM)) * (1.0 - Fex), vec3(1.5));
    Lin *= mix(vec3(1.0), pow(vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM)) * Fex, vec3(1.0 / 2.0)), clamp(pow(1.0 - abs(dot(backgroundUp, vSunDirection)), 5.0), 0.0, 1.0));

    // nightsky
    vec3 direction = normalize(worldPosition - cameraPosition);
    float theta = acos(direction.y); // elevation --> y-axis, [-pi/2, pi/2],
    float phi = atan(direction.z, direction.x); // azimuth --> x-axis [-pi/2, pi/2]
    vec2 uv = vec2(phi, theta) / vec2(2.0 * pi, pi) + vec2(0.5, 0.0);
    vec3 L0 = vec3(0.1) * Fex;

    // composition + solar disc
    float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);
    L0 += (vSunE * 19000.0 * Fex) * sundisk;

    vec3 texColor = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);

    vec3 curr = Uncharted2Tonemap((log2(2.0 / pow(luminance, 4.0))) * texColor);
    vec3 color = curr * whiteScale;

    vec3 retColor = pow(color, vec3(1.0 / (1.2 + (1.2 * vSunfade))));

    return retColor;
}`);
