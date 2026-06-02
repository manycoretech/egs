import { Nullable, Utils } from '../../../utils/Utils';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderVaryingTypes, ShaderInjectionTypes, ShaderBuilder, ShaderAttributeTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { MaterialParameters, ConvertMaterialParameters } from '../Material';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { UniformBlockObject } from '../../../renderer/shader/components/UniformBlockObject';
import { ReadonlyColor, Color } from '../../../math/Color';
import { LightableMaterial } from './LightableMaterial';
import { readonlyMath } from '../../../math/Readonly';
import { Texture } from '../../textures/Texture';
import { materialProperty } from '../../../ContentAPI';
import { Matrix3, ReadonlyMatrix3 } from '../../../math/Matrix3';
import { Side } from '../../../utils/Constants';
import { DeferredMaterial } from '../base';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { Texture2D } from '../../textures/Texture2D';
import { TextureV2 } from '../../textures/TextureV2';

export type MeshPhongMaterialParameters<T extends Texture2D | TextureV2 = Texture2D> = MaterialParameters
    & ConvertMaterialParameters<Pick<MeshPhongMaterial<T>,
        'color' | 'texture' | 'specular' | 'opacity' | 'opacityTex' | 'shininess' | 'specularStrength' | 'uvTransform'>>;

const keys = ['color', 'texture', 'specular', 'opacity', 'opacityTex', 'shininess', 'specularStrength', 'uvTransform'];
/**
 * This material can apply illumination on model surface, which makes model looks shiny and specular.
 * Performance will generally be greater when using this material over the {@link PBRMaterial| PBRMaterial}, at the cost of some graphical accuracy.
 */
export class MeshPhongMaterial<T extends Texture2D | TextureV2 = Texture2D> extends LightableMaterial implements DeferredMaterial {
    /**
     * @internal
     */
    static DefaultSceneClipEnabled: boolean = true;

    readonly isSupportDeferred: true = true;

    static constructMaterialFromGBufferForLight(): string {
        return `
        BlinnPhongMaterial material;
        material.diffuseColor = texture2D(c2, vUv).xyz;
        material.specularColor = texture2D(c3, vUv).xyz;
        material.specularShininess = tan(texture2D(c1, vUv).z * PI_HALF * 254. / 255.) * 162.;
        material.specularStrength = texture2D(c3, vUv).w;
        `;
    }

    static extendDeferredLight(builder: ShaderBuilder) {
        builder
            .addFragment(BRDFSpecularBlinnPhong)
            .addFragment(BlinnPhong);
    }

    extendEncodeDeferred(builder: ShaderBuilder) {
        builder
            .when(this.side === Side.DoubleSide, b =>
                b.addFragDefine('#define DOUBLE_SIDE'))
            .addUBO(this.UBO)
            .addVarying(ShaderVaryingTypes.viewPosition)
            .addVarying(ShaderVaryingTypes.fragNormal)
            .inject(ShaderInjectionTypes.channel_color, 'color = u_color;')
            .inject(ShaderInjectionTypes.channel_specular, 'specular = u_specular;')
            .inject(ShaderInjectionTypes.channel_specularStrength, 'specularStrength = u_specularStrength;')
            .inject(ShaderInjectionTypes.channel_shininess, 'shininess = u_shininess;')
            .when(this.texture !== null, b =>
                b.addVarying(ShaderVaryingTypes.fragUV)
                    .inject(ShaderInjectionTypes.vary_uv, 'vUv = (uvTransformColor * vec3(uv, 1.)).xy;')
                    .addUniform('map', WebGLShaderDataType.Sampler2D)
                    .inject(ShaderInjectionTypes.channel_color, 'color *= texture2D( map, vUv ).xyz;')
            )
            .addFragment(ENCODE_NORMAL)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(encodeNormal(normal), atan(shininess / 162.) * RECIPROCAL_PI * 2.0 * 255. / 254., 1.);')
            .inject(ShaderInjectionTypes.frag_any, 'fragOut1 = vec4(color.rgb, 1.);')
            .inject(ShaderInjectionTypes.frag_any, 'fragOut2 = vec4(specular, specularStrength);');
    }

    updateDeferredUniform(p: WGLProgram) {
        this.UBO.updateWebGL(p);
        if (this.texture !== null) {
            p.setTexture2D('map', this.texture);
        }
        this.getComponents().forEach(c => {
            if (c.updateShapeUniforms) {
                c.updateShapeUniforms(p);
            }
            if (c.updateShadingUniforms) {
                c.updateShadingUniforms(p);
            }
        });
    }
    /**
     * The name of instance's class.
     */
    className() {
        return 'MeshPhongMaterial';
    }
    /**
     * Check the type whether it belongs to MeshPhongMaterial.
     * This value should not be changed by user.
     */
    isMeshPhongMaterial = true;

    constructor(p?: MeshPhongMaterialParameters<T>) {
        super();
        this.enableSceneClipping = MeshPhongMaterial.DefaultSceneClipEnabled;
        this.setValues(p);
    }

    private UBO = UniformBlockObject
        .spawn('meshPhong')
        .createItem('uvTransformColor', WebGLShaderDataType.Mat3, new Matrix3())
        .createItem('u_color', WebGLShaderDataType.Vec3, new Color(0xffffff))
        .createItem('u_specular', WebGLShaderDataType.Vec3, new Color(0x111111))
        .createItem('u_opacity', WebGLShaderDataType.Float, 1)
        .createItem('u_shininess', WebGLShaderDataType.Float, 30)
        .createItem('u_specularStrength', WebGLShaderDataType.Float, 1);
    /**
     * The basic color of object.
     * The final color on screen is also influenced by color and intensity of light and other parameters.
     */
    @materialProperty()
    protected _color: ReadonlyColor = readonlyMath.color(0xffffff);
    get color() { return this.UBO.getItem('u_color'); }
    set color(v: ReadonlyColor) { this.UBO.setItem('u_color', v); this._color = v; }
    /**
     * Use texture cover object, if it is given.
     */
    @materialProperty()
    texture: Nullable<T> = null;
    /**
     * Apply opacity texture to change the transparency on object's some part.
     * The opacity is decided by the value of texture's red channel.
     */
    @materialProperty()
    opacityTex: Nullable<T> = null;
    /**
     * The color of specular. This value and color of light influence the color of the edge part of specular area together.
     */
    @materialProperty()
    protected _specular: ReadonlyColor = readonlyMath.color(0x111111);
    get specular() { return this.UBO.getItem('u_specular'); }
    set specular(v: ReadonlyColor) { this.UBO.setItem('u_specular', v); this._specular = v; }
    /**
     * Opacity decide the transparency of whole surface of object.
     */
    @materialProperty()
    protected _opacity: number = 1;
    get opacity() { return this.UBO.getItem('u_opacity'); }
    set opacity(v: number) { this.UBO.setItem('u_opacity', v); this._opacity = v; }
    /**
     * This value determines the area of specular reflect and the ratio of white part.
     */
    @materialProperty()
    protected _shininess: number = 30;
    get shininess() { return this.UBO.getItem('u_shininess'); }
    set shininess(v: number) { this.UBO.setItem('u_shininess', v); this._shininess = v; }
    /**
     * This value determines the area of specular reflection. This influence is similar with {@link Light.intensity| intensity} of light.
     */
    @materialProperty()
    protected _specularStrength: number = 1;
    get specularStrength() { return this.UBO.getItem('u_specularStrength'); }
    set specularStrength(v: number) { this.UBO.setItem('u_specularStrength', v); this._specularStrength = v; }
    /**
     * If set to true, uv used for opacityTex is independent
     * @internal
     */
    @materialProperty()
    isOpacityTexUseIndependentUv: boolean = false;

    /**
     * Change the corresponding attribute according to the values of given {@link MeshPhongMaterialParameters| parameters}.
     * @param {MeshPhongMaterialParameters} values a object of specified type contains parameters.
     */
    setValues(values?: MeshPhongMaterialParameters<T>) {
        if (values === undefined) {
            return;
        }
        super.setValues(values);
        Utils.copyPropertiesAndCheckRecompile(keys, ['texture', 'opacityTex'], this, values);
    }

    traverseTexture(visitor: (tex: Texture) => void) {
        super.traverseTexture(visitor);
        Utils.visitTexture([this.texture, this.opacityTex], visitor);
    }
    /**
     * Execute the given method for every ubo.
     * @param {function} _visitor a method to process ubo.
     */
    traverseUBO(visitor: (ubo: UniformBlockObject) => void) {
        visitor(this.UBO);
    }
    /**
     * Generate a key for texture of material, and engine will recompile shader if the texture added or removed.
     * This method may override in extended class.
     * @internal
     */
    generateShaderKey(r: ShaderComponentRegistry) {
        const keyBuilder = HashKeyBuilder.getInstance()
            .hasItem(this.texture)
            .hasItem(this.opacityTex)
            .bool(this.isOpacityTexUseIndependentUv);
        return super.generateShaderKey(r) + keyBuilder.getKey();
    }
    /**
     * Copy the data to this instance from other instance.
     * @param {MeshPhongMaterial} other the source of copied data
     */
    copy(other: MeshPhongMaterial<T>) {
        super.copyBase(other);
        this.color = other.color;
        this.texture = other.texture;
        this.opacityTex = other.opacityTex;
        this.specular = other.specular;
        this.opacity = other.opacity;
        this.shininess = other.shininess;
        this.specularStrength = other.specularStrength;
        this.uvTransform = other.uvTransform;
        return this;
    }
    /**
     * Return a cloned instance of this class.
     */
    clone() {
        return new MeshPhongMaterial<T>().copy(this);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<MeshPhongMaterial>(['color', 'texture', 'specular', 'opacity', 'opacityTex', 'shininess', 'specularStrength', 'uvTransform']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<MeshPhongMaterial>(['color', 'texture', 'specular', 'opacity', 'opacityTex', 'shininess', 'specularStrength', 'uvTransform']);
    }
    /**
     * Change the uv data by this matrix.
     */
    @materialProperty()
    _uvTransform = readonlyMath.mat3();
    get uvTransform() { return this.UBO.getItem('uvTransformColor'); }
    set uvTransform(v: ReadonlyMatrix3) {
        this.UBO.setItem('uvTransformColor', v);
        this._uvTransform = v;
    }

    /**
     * @internal
     */
    updateShadingUniforms(program: WGLProgram, r: ShaderComponentRegistry): void {
        super.updateShadingUniforms(program, r);

        this.UBO.updateWebGL(program);

        if (this.texture !== null || this.opacityTex !== null) {
            if (this.texture !== null) {
                program.setTexture2D('map', this.texture);
            }
            if (this.opacityTex !== null) {
                program.setTexture2D('mapOpacity', this.opacityTex);
            }
        }
    }
    /**
     * @internal
     */
    extendShaderShading(b: ShaderBuilder, r: ShaderComponentRegistry) {
        super.extendShaderShading(b, r);
        const lightComponent = this.getLightSystem(r);
        b.addUBO(this.UBO)
            .inject(ShaderInjectionTypes.channel_color, 'color = u_color;')
            .inject(ShaderInjectionTypes.channel_alpha, 'opacity = u_opacity;')
            .inject(ShaderInjectionTypes.channel_specular, 'specular = u_specular;')
            .inject(ShaderInjectionTypes.channel_specularStrength, 'specularStrength = u_specularStrength;')
            .inject(ShaderInjectionTypes.channel_shininess, 'shininess = u_shininess;')
            .addLight(this)
            .extend(lightComponent)
            .addFragment(BRDFSpecularBlinnPhong)
            .addFragment(BlinnPhong)
            .when(lightComponent.rectAreaLights.length > 0 || lightComponent.diskAreaLights.length > 0, b =>
                b.addFragment(AreaBlinnPhong))
            .when(lightComponent.rectAreaLights.length > 0, b =>
                b.addFragment(RectAreaBlinnPhong))
            .when(lightComponent.diskAreaLights.length > 0, b =>
                b.addFragment(DiskAreaBlinnPhong));
        // case only for animation-plugin using
        if (this.opacityTex !== null && this.isOpacityTexUseIndependentUv) {
            b.addVaryingCustom('vUvs', WebGLShaderDataType.Vec4)
                .addDefaultAttribute(ShaderAttributeTypes.uv)
                .inject(ShaderInjectionTypes.vary_any, 'vUvs = vec4((uvTransformColor * vec3(uv, 1.)).xy, uv);')
                .when(this.texture !== null, b =>
                    b.addUniform('map', WebGLShaderDataType.Sampler2D)
                        .inject(ShaderInjectionTypes.channel_color, 'color *= texture2D( map, vUvs.xy ).xyz;')
                        .inject(ShaderInjectionTypes.channel_alpha, 'opacity *= texture2D( map, vUvs.xy ).a;'))
                .addUniform('mapOpacity', WebGLShaderDataType.Sampler2D)
                .inject(ShaderInjectionTypes.channel_alpha, 'opacity *= texture2D( mapOpacity, vUvs.zw ).r;');
        } else if (this.texture !== null || this.opacityTex !== null) {
            b.addVarying(ShaderVaryingTypes.fragUV)
                .inject(ShaderInjectionTypes.vary_uv, 'vUv = (uvTransformColor * vec3(uv, 1.)).xy;')
                .when(this.texture !== null, b =>
                    b.addUniform('map', WebGLShaderDataType.Sampler2D)
                        .inject(ShaderInjectionTypes.channel_color, 'color *= texture2D( map, vUv ).xyz;')
                        .when(this.opacityTex === null, b => b.inject(ShaderInjectionTypes.channel_alpha, 'opacity *= texture2D( map, vUv ).a;')))
                .when(this.opacityTex !== null, b =>
                    b.addUniform('mapOpacity', WebGLShaderDataType.Sampler2D)
                        .inject(ShaderInjectionTypes.channel_alpha, 'opacity *= texture2D( mapOpacity, vUv ).r;'));
        }
    }
    /**
     * @internal
     */
    generateMaterialForLight() {
        return `
        BlinnPhongMaterial material;
        material.diffuseColor = color;
        material.specularColor = specular;
        material.specularShininess = shininess;
        material.specularStrength = specularStrength;
        `;
    }
    /**
     * @internal
     */
    RE_Direct(): string {
        return '#define RE_Direct RE_Direct_BlinnPhong';
    }
    /**
     * @internal
     */
    RE_Direct_RectArea(): string {
        return '#define RE_Direct_RectArea RE_Direct_RectArea_BlinnPhong';
    }
    /**
     * @internal
     */
    RE_Direct_DiskArea(): string {
        return '#define RE_Direct_DiskArea RE_Direct_DiskArea_BlinnPhong';
    }
    /**
     * @internal
     */
    RE_IndirectDiffuse(): string {
        return '#define RE_IndirectDiffuse RE_IndirectDiffuse_BlinnPhong';
    }
}
// Method #4: Spheremap Transform https://aras-p.info/texts/CompactNormalStorage.html
const ENCODE_NORMAL = createShaderBlock(`
vec2 encodeNormal(vec3 n) {
    float p = sqrt(n.z*8.+8.);
    return n.xy/p + 0.5;
}
`);

/**
 * Shader block containing shared Blinn-Phong area-light helpers.
 */
export const AreaBlinnPhong = createShaderBlock(`
mat3 transposeMat3( const in mat3 m ) {
    mat3 tmp;
    tmp[0] = vec3(m[0].x, m[1].x, m[2].x);
    tmp[1] = vec3(m[0].y, m[1].y, m[2].y);
    tmp[2] = vec3(m[0].z, m[1].z, m[2].z);
    return tmp;
}

// Real-Time Polygonal-Light Shading with Linearly Transformed Cosines
// by Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt
// code: https://github.com/selfshadow/ltc_code/
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
    const float LUT_SIZE = 64.0;
    const float LUT_SCALE = (LUT_SIZE - 1.0) / LUT_SIZE;
    const float LUT_BIAS = 0.5 / LUT_SIZE;
    float dotNV = saturate(dot(N, V));
    // texture parameterized by sqrt( GGX alpha ) and sqrt( 1 - cos( theta ) )
    vec2 uv = vec2(roughness, sqrt(1.0 - dotNV));
    uv = uv * LUT_SCALE + LUT_BIAS;
    return uv;
}
`);
/**
 * Shader block for rectangle area-light Blinn-Phong evaluation.
 */
export const RectAreaBlinnPhong = createShaderBlock(`
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
    float x = dot(v1, v2);
    float y = abs(x);
    // rational polynomial approximation to theta / sin( theta ) / 2PI
    float a = 0.8543985 + (0.4965155 + 0.0145206 * y) * y;
    float b = 3.4175940 + (4.1616724 + y) * y;
    float v = a / b;

    float theta_sintheta = (x > 0.0) ? v : 0.5 * inversesqrt(max(1.0 - x * x, 1e-7)) - v;
    return cross(v1, v2) * theta_sintheta;
}

float LTC_ClippedSphereFormFactor( const in vec3 f ) {
    // Real-Time Area Lighting: a Journey from Research to Production (p.102)
    // An approximation of the form factor of a horizon-clipped rectangle.
    float l = length(f);
    return max((l * l + f.z) / (l + 1.0), 0.0);
}

vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[4] ) {
    // bail if point is on back side of plane of light
    // assumes ccw winding order of light vertices
    vec3 v1 = rectCoords[1] - rectCoords[0];
    vec3 v2 = rectCoords[3] - rectCoords[0];
    vec3 lightNormal = cross(v1, v2);

    if (dot(lightNormal, P - rectCoords[0]) < 0.0) return vec3(0.0);

    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize(V - N * dot(V, N));
    T2 = - cross(N, T1); // negated from paper; possibly due to a different handedness of world coordinate system

    // compute transform
    mat3 mat = mInv * transposeMat3(mat3(T1, T2, N));

    // transform rect
    vec3 coords[4];
    coords[0] = mat * (rectCoords[0] - P);
    coords[1] = mat * (rectCoords[1] - P);
    coords[2] = mat * (rectCoords[2] - P);
    coords[3] = mat * (rectCoords[3] - P);

    // project rect onto sphere
    coords[0] = normalize(coords[0]);
    coords[1] = normalize(coords[1]);
    coords[2] = normalize(coords[2]);
    coords[3] = normalize(coords[3]);

    // calculate vector form factor
    vec3 vectorFormFactor = vec3(0.0);
    vectorFormFactor += LTC_EdgeVectorFormFactor(coords[0], coords[1]);
    vectorFormFactor += LTC_EdgeVectorFormFactor(coords[1], coords[2]);
    vectorFormFactor += LTC_EdgeVectorFormFactor(coords[2], coords[3]);
    vectorFormFactor += LTC_EdgeVectorFormFactor(coords[3], coords[0]);

    // adjust for horizon clipping
    float result = LTC_ClippedSphereFormFactor(vectorFormFactor);
    return vec3(result);
}

void RE_Direct_RectArea_BlinnPhong(const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight) {
    vec3 normal = geometry.normal;
    vec3 viewDir = geometry.viewDir;
    vec3 position = geometry.position;
    vec3 lightPos = rectAreaLight.position;
    vec3 halfWidth = rectAreaLight.halfWidth;
    vec3 halfHeight = rectAreaLight.halfHeight;
    vec3 lightColor = rectAreaLight.color;
    float specularStrength = rectAreaLight.specularStrength;
    float roughness =  1.0 - material.specularStrength;

    vec3 rectCoords[4];
    rectCoords[0] = lightPos + halfWidth - halfHeight; // counterclockwise; light shines in local neg z direction
    rectCoords[1] = lightPos - halfWidth - halfHeight;
    rectCoords[2] = lightPos - halfWidth + halfHeight;
    rectCoords[3] = lightPos + halfWidth + halfHeight;

    vec2 uv = LTC_Uv(normal, viewDir, roughness);
    vec4 t1 = texture2D(ltc_1, uv);
    vec4 t2 = texture2D(ltc_2, uv);
    mat3 mInv = mat3(
        vec3(t1.x, 0, t1.y),
        vec3(0, 1, 0),
        vec3(t1.z, 0, t1.w)
    );

    // LTC Fresnel Approximation by Stephen Hill
    // http://blog.selfshadow.com/publications/s2016-advances/s2016_ltc_fresnel.pdf
    vec3 fresnel = (material.specularColor * t2.x + (vec3(1.0) - material.specularColor) * t2.y);

    #if defined(DEBUG_INCIDENT)
        reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate(normal, viewDir, position, mat3(1.0), rectCoords);
        return;
    #endif

    reflectedLight.directSpecular += specularStrength * lightColor * fresnel * LTC_Evaluate(normal, viewDir, position, mInv, rectCoords);
    reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate(normal, viewDir, position, mat3(1.0), rectCoords);
}
#define RE_Direct_RectArea       RE_Direct_RectArea_BlinnPhong
`);

/**
 * Shader block for disk area-light Blinn-Phong evaluation.
 */
export const DiskAreaBlinnPhong = createShaderBlock(`
float sqr(float x) { return x * x; }

// http://momentsingraphics.de/?p=105
vec3 SolveCubic(vec4 Coefficient)
{
    // Normalize the polynomial
    Coefficient.xyz /= Coefficient.w;
    // Divide middle coefficients by three
    Coefficient.yz /= 3.0;

    float A = Coefficient.w;
    float B = Coefficient.z;
    float C = Coefficient.y;
    float D = Coefficient.x;

    // Compute the Hessian and the discriminant
    vec3 Delta = vec3(
        -Coefficient.z * Coefficient.z + Coefficient.y,
        -Coefficient.y * Coefficient.z + Coefficient.x,
        dot(vec2(Coefficient.z, -Coefficient.y), Coefficient.xy)
    );

    float Discriminant = dot(vec2(4.0 * Delta.x, -Delta.y), Delta.zy);
    vec3 RootsA, RootsD;
    vec2 xlc, xsc;
    // Algorithm A
    {
        float A_a = 1.0;
        float C_a = Delta.x;
        float D_a = -2.0 * B * Delta.x + Delta.y;
        // Take the cubic root of a normalized complex number
        float Theta = atan(sqrt(Discriminant), -D_a) / 3.0;
        float x_1a = 2.0 * sqrt(-C_a) * cos(Theta);
        float x_3a = 2.0 * sqrt(-C_a) * cos(Theta + (2.0 / 3.0) * PI);
        float xl;
        if ((x_1a + x_3a) > 2.0 * B)
            xl = x_1a;
        else
            xl = x_3a;
        xlc = vec2(xl - B, A);
    }
    // Algorithm D
    {
        float A_d = D;
        float C_d = Delta.z;
        float D_d = -D * Delta.y + 2.0 * C * Delta.z;

        // Take the cubic root of a normalized complex number
        float Theta = atan(D * sqrt(Discriminant), -D_d) / 3.0;

        float x_1d = 2.0 * sqrt(-C_d) * cos(Theta);
        float x_3d = 2.0 * sqrt(-C_d) * cos(Theta + (2.0 / 3.0) * PI);

        float xs;
        if (x_1d + x_3d < 2.0 * C)
            xs = x_1d;
        else
            xs = x_3d;

        xsc = vec2(-D, xs + C);
    }

    float E = xlc.y * xsc.y;
    float F = -xlc.x * xsc.y - xlc.y * xsc.x;
    float G = xlc.x * xsc.x;

    vec2 xmc = vec2(C * F - B * G, -B * F + C * E);
    vec3 Root = vec3(xsc.x / xsc.y, xmc.x / xmc.y, xlc.x / xlc.y);

    if (Root.x < Root.y && Root.x < Root.z)
        Root.xyz = Root.yxz;
    else if (Root.z < Root.x && Root.z < Root.y)
        Root.xyz = Root.xzy;
    return Root;
}

mat3 mat3_from_columns(vec3 c0, vec3 c1, vec3 c2)
{
    mat3 m = mat3(c0, c1, c2);
    return m;
}

vec3 LTC_Evaluate_Disk( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 diskCoords[4]) {
    const float LUT_SIZE = 64.0;
    const float LUT_SCALE = (LUT_SIZE - 1.0) / LUT_SIZE;
    const float LUT_BIAS = 0.5 / LUT_SIZE;
    // bail if point is on back side of plane of light
    // assumes ccw winding order of light vertices
    vec3 v1 = diskCoords[1] - diskCoords[0];
    vec3 v2 = diskCoords[3] - diskCoords[0];
    vec3 lightNormal = cross(v1, v2);

    if (dot(lightNormal, P - diskCoords[0]) < 0.0) return vec3(0.0);

    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize(V - N * dot(V, N));
    T2 = - cross(N, T1); // negated from paper; possibly due to a different handedness of world coordinate system

    // compute transform
    mat3 mat = transposeMat3(mat3(T1, T2, N));

    // transform rect
    vec3 coords[3];
    coords[0] = mat * (diskCoords[0] - P);
    coords[1] = mat * (diskCoords[1] - P);
    coords[2] = mat * (diskCoords[2] - P);

    // init ellipse
    vec3 C = 0.5 * (coords[0] + coords[2]);
    vec3 V1 = 0.5 * (coords[1] - coords[2]);
    vec3 V2 = 0.5 * (coords[1] - coords[0]);
    C = mInv * C;
    V1 = mInv * V1;
    V2 = mInv * V2;

    if (dot(cross(V1, V2), C) < 0.0)
        return vec3(0.0);

    // compute eigenvectors of ellipse
    float a, b;
    float d11 = dot(V1, V1);
    float d22 = dot(V2, V2);
    float d12 = dot(V1, V2);
    if (abs(d12) / sqrt(d11 * d22) > 0.0001) {
        float tr = d11 + d22;
        float det = -d12 * d12 + d11 * d22;

        // use sqrt matrix to solve for eigenvalues
        det = sqrt(det);
        float u = 0.5 * sqrt(tr - 2.0 * det);
        float v = 0.5 * sqrt(tr + 2.0 * det);
        float e_max = sqr(u + v);
        float e_min = sqr(u - v);

        vec3 V1_, V2_;

        if (d11 > d22) {
            V1_ = d12 * V1 + (e_max - d11) * V2;
            V2_ = d12 * V1 + (e_min - d11) * V2;
        }
        else {
            V1_ = d12 * V2 + (e_max - d22) * V1;
            V2_ = d12 * V2 + (e_min - d22) * V1;
        }

        a = 1.0 / e_max;
        b = 1.0 / e_min;
        V1 = normalize(V1_);
        V2 = normalize(V2_);
    } else {
        a = 1.0 / dot(V1, V1);
        b = 1.0 / dot(V2, V2);
        V1 *= sqrt(a);
        V2 *= sqrt(b);
    }

    vec3 V3 = cross(V1, V2);
    if (dot(C, V3) < 0.0)
        V3 *= -1.0;

    float L = dot(V3, C);
    float x0 = dot(V1, C) / L;
    float y0 = dot(V2, C) / L;

    float E1 = inversesqrt(a);
    float E2 = inversesqrt(b);

    a *= L * L;
    b *= L * L;

    float c0 = a * b;
    float c1 = a * b * (1.0 + x0 * x0 + y0 * y0) - a - b;
    float c2 = 1.0 - a * (1.0 + x0 * x0) - b * (1.0 + y0 * y0);
    float c3 = 1.0;

    vec3 roots = SolveCubic(vec4(c0, c1, c2, c3));
    float e1 = roots.x;
    float e2 = roots.y;
    float e3 = roots.z;

    vec3 avgDir = vec3(a * x0 / (a - e2), b * y0 / (b - e2), 1.0);

    mat3 rotate = mat3_from_columns(V1, V2, V3);

    avgDir = rotate * avgDir;
    avgDir = normalize(avgDir);

    float L1 = sqrt(-e2 / e3);
    float L2 = sqrt(-e2 / e1);

    float formFactor = L1 * L2 * inversesqrt((1.0 + L1 * L1) * (1.0 + L2 * L2));

    // use tabulated horizon-clipped sphere
    vec2 uv = vec2(avgDir.z * 0.5 + 0.5, formFactor);
    uv = uv * LUT_SCALE + LUT_BIAS;
    float scale = texture2D(ltc_2, uv).w;

    float spec = clamp(formFactor * scale * 0.5, 0.0, 1.0);
    return vec3(spec, spec, spec);
}

void RE_Direct_DiskArea_BlinnPhong(const in DiskAreaLight diskAreaLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight) {
    vec3 normal = geometry.normal;
    vec3 viewDir = geometry.viewDir;
    vec3 position = geometry.position;
    vec3 lightPos = diskAreaLight.position;
    vec3 halfWidth = diskAreaLight.halfWidth;
    vec3 halfHeight = diskAreaLight.halfHeight;
    vec3 lightColor = diskAreaLight.color;
    float specularStrength = diskAreaLight.specularStrength;
    float roughness = 1.0 - material.specularStrength;

    vec3 diskCoords[4];
    diskCoords[0] = lightPos + halfWidth - halfHeight; // counterclockwise; light shines in local neg z direction
    diskCoords[1] = lightPos - halfWidth - halfHeight;
    diskCoords[2] = lightPos - halfWidth + halfHeight;
    diskCoords[3] = lightPos + halfWidth + halfHeight;

    vec2 uv = LTC_Uv(normal, viewDir, roughness);
    vec4 t1 = texture2D(ltc_1, uv);
    vec4 t2 = texture2D(ltc_2, uv);
    mat3 mInv = mat3(
        vec3(t1.x, 0, t1.y),
        vec3(0, 1, 0),
        vec3(t1.z, 0, t1.w)
    );

    // LTC Fresnel Approximation by Stephen Hill
    // http://blog.selfshadow.com/publications/s2016-advances/s2016_ltc_fresnel.pdf
    vec3 fresnel = (material.specularColor * t2.x + (vec3(1.0) - material.specularColor) * t2.y);

    #if defined(DEBUG_INCIDENT)
        reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate_Disk(normal, viewDir, position, mat3(1.0), diskCoords);
        return;
    #endif

    reflectedLight.directSpecular += specularStrength * lightColor * fresnel * LTC_Evaluate_Disk(normal, viewDir, position, mInv, diskCoords);
    reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate_Disk(normal, viewDir, position, mat3(1.0), diskCoords);
}
#define RE_Direct_DiskArea       RE_Direct_DiskArea_BlinnPhong
`);

const BlinnPhong = createShaderBlock(`
struct BlinnPhongMaterial {
    vec3    diffuseColor;
    vec3    specularColor;
    float   specularShininess;
    float   specularStrength;
};

void RE_Direct_BlinnPhong(const in IncidentLight directLight,
                          const in GeometricContext geometry,
                          const in BlinnPhongMaterial material,
                        inout ReflectedLight reflectedLight) {

    float dotNL = saturate(dot(geometry.normal, directLight.direction));
    vec3 irradiance = dotNL * directLight.color;
    irradiance *= PI;

    #if defined(DEBUG_INCIDENT)
        reflectedLight.directDiffuse += irradiance * RECIPROCAL_PI;
        return;
    #endif

    reflectedLight.directDiffuse += irradiance * RECIPROCAL_PI * material.diffuseColor;
    vec3 halfDir = normalize(directLight.direction + geometry.viewDir);
    float dotNH = saturate(dot(geometry.normal, halfDir));
    float dotLH = saturate(dot(directLight.direction, halfDir));
    float fresnel = exp2((-5.55473 * dotLH - 6.98316) * dotLH);
    vec3 F = (1.0 - material.specularColor) * fresnel + material.specularColor;
    float D = RECIPROCAL_PI * (material.specularShininess * 0.5 + 1.0) * pow(dotNH, material.specularShininess);
    reflectedLight.directSpecular += irradiance * F * D * material.specularStrength * 0.25;
}

void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
    #if defined(DEBUG_INCIDENT)
        return;
    #endif

    reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert(material.diffuseColor);
}

#define RE_Direct                RE_Direct_BlinnPhong
#define RE_IndirectDiffuse       RE_IndirectDiffuse_BlinnPhong
#define Material_LightProbeLOD(material)(0) // TODO
 `);

const BRDFSpecularBlinnPhong = createShaderBlock(`
vec3 BRDF_Diffuse_Lambert( const in vec3 diffuseColor ) {
    return RECIPROCAL_PI * diffuseColor;
} // validated

vec3 F_Schlick( const in vec3 specularColor, const in float dotVH ) {

    // Original approximation by Christophe Schlick '94
    // float fresnel = pow( 1.0 - dotVH, 5.0 );

    // Optimized variant (presented by Epic at SIGGRAPH '13)
    // https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
    float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);

    return (1.0 - fresnel) * specularColor + fresnel;

} // validated

float G_BlinnPhong_Implicit( /* const in float dotNL, const in float dotNV */) {
    // geometry term is (n dot l)(n dot v) / 4(n dot l)(n dot v)
    return 0.25;
}

float D_BlinnPhong( const in float shininess, const in float dotNH ) {
    return RECIPROCAL_PI * (shininess * 0.5 + 1.0) * pow(dotNH, shininess);
}

vec3 BRDF_Specular_BlinnPhong( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float shininess ) {

    vec3 halfDir = normalize(incidentLight.direction + geometry.viewDir);

    float dotNH = saturate(dot(geometry.normal, halfDir));
    float dotVH = saturate(dot(geometry.viewDir, halfDir));

    vec3 F = F_Schlick(specularColor, dotVH);

    float G = G_BlinnPhong_Implicit( /* dotNL, dotNV */);

    float D = D_BlinnPhong(shininess, dotNH);

    return F * (G * D);

} // validated
`);
