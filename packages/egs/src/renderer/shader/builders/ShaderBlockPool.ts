import { createShaderBlock } from './ShaderBlock.js';

export const ShaderBlockPool = {
    Encode24: createShaderBlock(`
vec3 encode24(const in float x)
{
    const vec3 code = vec3(1.0, 255.0, 65025.0);
    vec3 pack = vec3(code * x);
    pack.gb = fract(pack.gb);
    pack.rg -= pack.gb * (1.0 / 256.0);
    return pack;
}
`),
    Decode24: createShaderBlock(`
float decode24(const in vec3 x)
{
    const vec3 decode = 1.0 / vec3(1.0, 255.0, 65025.0);
    return dot(x, decode);
}
`),
    IESLightEffectMock: createShaderBlock(`
float IESLightEffect(const in vec3 worldPos, const in vec3 lightPos, const in mat4 rotationMatrix, const in sampler2D textureIES, const in vec2 textureIESResolution) {
    return 1.;
}
`),
    IESLightEffect: createShaderBlock(`
float decode32(const in vec4 x) {
    const vec4 decode = 1.0 / vec4(1.0, 255.0, 65025.0, 16581375.0);
    return dot(x, decode);
}

float IESLightEffect(const in vec3 worldPos, const in vec3 lightPos, const in mat4 rotationMatrix, const in sampler2D textureIES, const in vec2 textureIESResolution) {
    vec3 ToLight = normalize(lightPos - worldPos);
    vec3 lightDir = normalize(mat3(rotationMatrix) * vec3(0, 0, -1));
    vec3 C0Dir = normalize(mat3(rotationMatrix) * vec3(1, 0, 0));
    vec3 C90Dir = normalize(mat3(rotationMatrix) * vec3(0, 1, 0));

    float verticalAngle = clamp(asin(dot(ToLight, lightDir)) / PI + 0.5, 0., 1.);
    vec3 toLightProjection = normalize(ToLight - lightDir * dot(ToLight, lightDir));
    float horizontalAngle = (1. - acos(dot(toLightProjection, C0Dir)) / PI) * .5;
    if (dot(toLightProjection, C90Dir) < 0.)
        horizontalAngle = 1. - horizontalAngle;
    horizontalAngle = clamp(horizontalAngle, 0., 1.);

    float verticalFraction = verticalAngle * (textureIESResolution.x - 1.);
    float verticalStart = floor(verticalFraction);
    verticalFraction -= verticalStart;
    float verticalEnd = verticalStart + 1.;

    float horizontalFraction = horizontalAngle * (textureIESResolution.y - 1.);
    float horizontalStart = floor(horizontalFraction);
    horizontalFraction -= horizontalStart;
    float horizontalEnd = horizontalStart + 1.;

    float upperLeft = decode32(texelFetch(textureIES, ivec2(verticalStart, horizontalStart), 0));
    float upperRight = decode32(texelFetch(textureIES, ivec2(verticalEnd, horizontalStart), 0));
    float lowerLeft = decode32(texelFetch(textureIES, ivec2(verticalStart, horizontalEnd), 0));
    float lowerRight = decode32(texelFetch(textureIES, ivec2(verticalEnd, horizontalEnd), 0));

    float upperInterpolation = (1. - verticalFraction) * upperLeft + verticalFraction * upperRight;
    float lowerInterpolation = (1. - verticalFraction) * lowerLeft + verticalFraction * lowerRight;
    return (1. - horizontalFraction) * upperInterpolation + horizontalFraction * lowerInterpolation;
}
`),
    PopComponentTransform: createShaderBlock(`
vec3 transformPosition(in vec3 maxLevelPosition) {
    if(popLODInfo[0] == 1.0 && popLODInfo[1] == 1.0){
        // when this pop value is zero means we don't need pop.
        return maxLevelPosition;
    }
    vec3 vertexConstant = vec3(popLODInfo[2], popLODInfo[3], popLODInfo[4]);
    float vertexGridSize = popLODInfo[0];
    float powPrecision = popLODInfo[1];

    float offset = 0.0;
    if (powPrecision > 1.0) {
        offset = 0.5;
    }
    vec3 gridPosition = (maxLevelPosition - vertexConstant) / vertexGridSize + offset;
    return floor(gridPosition / powPrecision) * powPrecision * vertexGridSize + vertexConstant;
}
`),

    LightTransmissionModel: createShaderBlock(`
struct IncidentLight {
    vec3 color;
    vec3 direction;
    bool visible;
};

struct ReflectedLight {
    vec3 directDiffuse;
    vec3 directSpecular;
    vec3 indirectDiffuse;
    vec3 indirectSpecular;
};

struct GeometricContext {
    vec3 position;
    vec3 normal;
    vec3 viewDir;
};

float pow2(const in float x) { return x*x; }

vec3 getAmbientLightIrradiance(const in vec3 ambientLightColor) {
    vec3 irradiance = ambientLightColor;
    #ifndef PHYSICALLY_CORRECT_LIGHTS
        irradiance *= PI;
    #endif
    return irradiance;
}
`),

    GetSpecularMIPLevel: createShaderBlock(`
// taken from here: http://casual-effects.blogspot.ca/2011/08/plausible-environment-lighting-in-two.html
float GetSpecularMIPLevel( const in float blinnShininessExponent, const in int maxMIPLevel ) {

    //float envMapWidth = pow( 2.0, maxMIPLevelScalar );
    //float desiredMIPLevel = log2( envMapWidth * sqrt( 3.0 ) ) - 0.5 * log2( pow2( blinnShininessExponent ) + 1.0 );

    float maxMIPLevelScalar = float( maxMIPLevel );
    float desiredMIPLevel = maxMIPLevelScalar + 0.79248 - 0.5 * log2( pow2( blinnShininessExponent ) + 1.0 );

    // clamp to allowable LOD ranges.
    return clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );
}
`),

    InverseTransformDirection: createShaderBlock(`
// http://en.wikibooks.org/wiki/GLSL_Programming/Applying_Matrix_Transformations
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
    return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
`),

    PerturbNormal2Arb: createShaderBlock(`
vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm ) {

    // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988

    vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );
    vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );
    vec2 st0 = dFdx( vUv.st );
    vec2 st1 = dFdy( vUv.st );

    float scale = sign( st1.t * st0.s - st0.t * st1.s ); // we do not care about the magnitude

    vec3 S = normalize( ( q0 * st1.t - q1 * st0.t ) * scale );
    vec3 T = normalize( ( - q0 * st1.s + q1 * st0.s ) * scale );
    vec3 N = normalize( surf_norm );
    mat3 tsn = mat3( S, T, N );

    vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;

    mapN.xy *= normalScale;
    mapN.xy *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );

    return normalize( tsn * mapN );

}
`),

    ShaderConst: `
#define PI 3.1415926535
#define PI2 6.28318530718
#define PI_HALF 1.5707963267949
#define RECIPROCAL_PI 0.31830988618
#define RECIPROCAL_PI2 0.15915494
#define LOG2 1.442695
#define EPSILON 1e-6
#define saturate(a) clamp(a, 0.0, 1.0)
`,

    Normal: `
vec3 transformedNormal = normalMatrix * normal;
vNormal = normalize(transformedNormal);
`,

    NormalInstance: `
    mat3 m = mat3(viewMatrix[0].xyz, viewMatrix[1].xyz, viewMatrix[2].xyz) * mat3(mcol0, mcol1, mcol2);
    mat3 invertTransform = transpose(inverse(m));
    vec3 transformedNormal = invertTransform * normal;
    vNormal = normalize(transformedNormal);
`,

    Projection: `
mvPosition = modelViewMatrix * vec4( position, 1.0 );
gl_Position = projectionMatrix * mvPosition;
`,

    ProjectionInstance: `
mat4 instanceMatrix = mat4(
    vec4(mcol0, 0),
    vec4(mcol1, 0),
    vec4(mcol2, 0),
    vec4(mcol3, 1)
);
vec3 p = (instanceMatrix * vec4(position, 1.0)).xyz;
mvPosition = viewMatrix * vec4( p, 1.0 );
gl_Position = projectionMatrix * mvPosition;
`,
    getShadowFrag: createShaderBlock(`
const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)
const float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)
const vec3 PackFactors = vec3(256. * 256. * 256., 256. * 256., 256.);
const vec4 UnpackFactors = UnpackDownscale / vec4(PackFactors, 1.);
float unpackRGBAToDepth(const in vec4 v) {
    return dot(v, UnpackFactors) * PackUpscale;
}

float texture2DCompare(sampler2D depths, vec2 uv, float compare) {
    return step(compare, unpackRGBAToDepth(texture2D(depths, uv)));
}

float textureCubeCompare(samplerCube depths, vec3 dir, float compare) {
    return step(compare, unpackRGBAToDepth(textureCube(depths, dir)));
}

float getShadow(sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowIntensity) {
    float shadow = 1.0;

    shadowCoord.xyz /= shadowCoord.w;
    shadowCoord.z += shadowBias;

    #if defined(SHADOWMAP_TYPE_PCF)
        vec2 texelSize = vec2(1.0) / shadowMapSize;
        float dx0 = - texelSize.x * shadowRadius;
        float dy0 = - texelSize.y * shadowRadius;
        float dx1 = + texelSize.x * shadowRadius;
        float dy1 = + texelSize.y * shadowRadius;
        float dx2 = dx0 / 2.0;
        float dy2 = dy0 / 2.0;
        float dx3 = dx1 / 2.0;
        float dy3 = dy1 / 2.0;

        shadow = (
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx0, dy0), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(0.0, dy0), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx1, dy0), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx2, dy2), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(0.0, dy2), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx3, dy2), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx0, 0.0), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx2, 0.0), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy, shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx3, 0.0), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx1, 0.0), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx2, dy3), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(0.0, dy3), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx3, dy3), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx0, dy1), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(0.0, dy1), shadowCoord.z) +
            texture2DCompare(shadowMap, shadowCoord.xy + vec2(dx1, dy1), shadowCoord.z)
       ) * (1.0 / 17.0);
    #elif defined(SHADOWMAP_TYPE_PCF_SOFT)
        vec2 texelSize = vec2(1.0) / shadowMapSize;
        float dx = texelSize.x;
        float dy = texelSize.y;

        vec2 uv = shadowCoord.xy;
        vec2 f = fract(uv * shadowMapSize + 0.5);
        uv -= f * texelSize;

        shadow = (
            texture2DCompare(shadowMap, uv, shadowCoord.z) +
            texture2DCompare(shadowMap, uv + vec2(dx, 0.0), shadowCoord.z) +
            texture2DCompare(shadowMap, uv + vec2(0.0, dy), shadowCoord.z) +
            texture2DCompare(shadowMap, uv + texelSize, shadowCoord.z) +
            mix(texture2DCompare(shadowMap, uv + vec2(-dx, 0.0), shadowCoord.z),
                texture2DCompare(shadowMap, uv + vec2(2.0 * dx, 0.0), shadowCoord.z),
                f.x) +
            mix(texture2DCompare(shadowMap, uv + vec2(-dx, dy), shadowCoord.z),
                texture2DCompare(shadowMap, uv + vec2(2.0 * dx, dy), shadowCoord.z),
                f.x) +
            mix(texture2DCompare(shadowMap, uv + vec2(0.0, -dy), shadowCoord.z),
                texture2DCompare(shadowMap, uv + vec2(0.0, 2.0 * dy), shadowCoord.z),
                f.y) +
            mix(texture2DCompare(shadowMap, uv + vec2(dx, -dy), shadowCoord.z),
                texture2DCompare(shadowMap, uv + vec2(dx, 2.0 * dy), shadowCoord.z),
                f.y) +
            mix(mix(texture2DCompare(shadowMap, uv + vec2(-dx, -dy), shadowCoord.z),
                    texture2DCompare(shadowMap, uv + vec2(2.0 * dx, -dy), shadowCoord.z),
                    f.x),
            mix(texture2DCompare(shadowMap, uv + vec2(-dx, 2.0 * dy), shadowCoord.z),
                texture2DCompare(shadowMap, uv + vec2(2.0 * dx, 2.0 * dy), shadowCoord.z),
                f.x),
                f.y)
       ) * (1.0 / 9.0);
    #else // no percentage-closer filtering:
        shadow = texture2DCompare(shadowMap, shadowCoord.xy, shadowCoord.z);
    #endif
    return mix(shadow, 1.0, saturate(shadowIntensity));
}

float getDirectionalShadow(sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowIntensity) {
    shadowCoord.xyz /= shadowCoord.w;
    shadowCoord.z += shadowBias;

    bvec4 inFrustumVec = bvec4 (shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0);
    bool inFrustum = all(inFrustumVec);
    bvec2 frustumTestVec = bvec2(inFrustum, shadowCoord.z <= 1.0);
    bool frustumTest = all(frustumTestVec);
    if (frustumTest) {
        return getShadow(shadowMap, shadowMapSize, shadowBias, shadowRadius, shadowCoord, shadowIntensity);
    }
    return 1.0;
}

float getPointShadow( samplerCube shadowMap, float shadowBias, vec4 shadowWorldCoord, float depth, float shadowIntensity) {
    // for point lights, the uniform @vShadowCoord is re-purposed to hold
    // the vector from the light to the world-space position of the fragment.
    vec3 lightToPosition = shadowWorldCoord.xyz;

    // dp = normalized distance from light to fragment position
    float dp = depth;
    dp += shadowBias;

    // bd3D = base direction 3D
    vec3 bd3D = normalize( lightToPosition );

    float shadow = textureCubeCompare(shadowMap, bd3D, dp);
    return mix(shadow, 1.0, saturate(shadowIntensity));
}
`),
    RGB2HSL: createShaderBlock(`
    vec3 rgb2hsl(vec3 rgb) {
        vec3 HSL = vec3(0.0, 0.0, 0.0);
        float RGB_Max = max(rgb.x, max(rgb.y, rgb.z));
        float RGB_Min = min(rgb.x, min(rgb.y, rgb.z));
        //H
        if (RGB_Max == RGB_Min) {
            HSL.x = 0.0;
        } else if (RGB_Max == rgb.x) {
            HSL.x = 60.0 * (rgb.y - rgb.z) / (RGB_Max - RGB_Min);
            if (HSL.x < 0.0) {
                HSL.x = HSL.x + 360.0;
            }
        } else if (RGB_Max == rgb.y) {
            HSL.x = 60.0 * (rgb.z - rgb.x) / (RGB_Max - RGB_Min) + 120.0;
        } else if (RGB_Max == rgb.z) {
            HSL.x = 60.0 * (rgb.x - rgb.y) / (RGB_Max - RGB_Min) + 240.0;
        }

        //L
        HSL.z = (RGB_Max + RGB_Min) / 2.0;

        //S
        if (HSL.z == 0.0 || RGB_Max == RGB_Min) {
            HSL.y = 0.0;
        } else if (HSL.z > 0.0 && HSL.z <= 0.5) {
            HSL.y = (RGB_Max - RGB_Min) / (RGB_Max + RGB_Min);
        } else if (HSL.z > 0.5) {
            HSL.y = (RGB_Max - RGB_Min) / (2.0 - (RGB_Max + RGB_Min));
        }

        return HSL;
    }
    `),

    HSL2RGB: createShaderBlock(`
    vec3 hsl2rgb(vec3 hsl) {
        vec3 RGB = vec3(0.0, 0.0, 0.0);
        if (hsl.y == 0.0) {
            RGB = vec3(hsl.z, hsl.z, hsl.z);
        } else {
            float q = 0.0;
            float p = 0.0;
            float h = 0.0;

            if (hsl.z < 0.5) {
                q = hsl.z * (1.0 + hsl.y);
            }  else {
                q = hsl.z + hsl.y - (hsl.z * hsl.y);
            }

            p = 2.0 * hsl.z - q;
            h = hsl.x / 360.0;

            float t_R = h + 1.0 / 3.0;
            float t_G = h;
            float t_B = h - 1.0 / 3.0;

            if (t_R > 1.0) {
                t_R = t_R - 1.0;
            } else if (t_R < 0.0) {
                t_R = t_R + 1.0;
            }

            if (t_G > 1.0) {
                t_G = t_G - 1.0;
            } else if (t_G < 0.0) {
                t_G = t_G + 1.0;
            }

            if (t_B > 1.0) {
                t_B = t_B - 1.0;
            } else if (t_B < 0.0) {
                t_B = t_B + 1.0;
            }
            //R
            if (t_R < 1.0 / 6.0) {
                RGB.x = p + ((q - p) * 6.0 * t_R);
            } else if (t_R < 0.5) {
                RGB.x = q;
            } else if (t_R < 2.0 / 3.0) {
                RGB.x = p + ((q - p) * 6.0 * (2.0 / 3.0 - t_R));
            } else {
                RGB.x = p;
            }
            //G
            if (t_G < 1.0 / 6.0) {
                RGB.y = p + ((q - p) * 6.0 * t_G);
            } else if (t_G < 0.5) {
                RGB.y = q;
            } else if (t_G < 2.0 / 3.0)  {
                RGB.y = p + ((q - p) * 6.0 * (2.0 / 3.0 - t_G));
            } else  {
                RGB.y = p;
            }
            //B
            if (t_B < 1.0 / 6.0) {
                RGB.z = p + ((q - p) * 6.0 * t_B);
            } else if (t_B < 0.5) {
                RGB.z = q;
            } else if (t_B < 2.0 / 3.0) {
                RGB.z = p + ((q - p) * 6.0 * (2.0 / 3.0 - t_B));
            } else {
                RGB.z = p;
            }
        }

        return RGB;
    }
    `),
    ColorTransferFunctions: createShaderBlock(`
float linearToSrgb(in float color) {
    return color < 0.0031308 ? 12.92 * color : 1.055 * pow(abs(color), 1.0 / 2.4) - 0.055;
}
vec3 linearToSrgb(in vec3 color) {
    return vec3(linearToSrgb(color.r), linearToSrgb(color.g), linearToSrgb(color.b));
}
vec4 linearToSrgb(in vec4 color) {
    return vec4(linearToSrgb(color.rgb), color.a);
}
float srgbToLinear(in float color) {
    return color < 0.04045 ? color / 12.92 : pow(abs(color + 0.055) / 1.055, 2.4);
}
vec3 srgbToLinear(in vec3 color) {
    return vec3(srgbToLinear(color.r), srgbToLinear(color.g), srgbToLinear(color.b));
}
vec4 srgbToLinear(in vec4 color) {
    return vec4(srgbToLinear(color.rgb), color.a);
}
`),
    QuaternionFunctions: createShaderBlock(`
vec3 applyQuat(in vec4 q, in vec3 v) {
    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
`),
    FastEXP: createShaderBlock(`
        float fastExp(float x) {
            return intBitsToFloat(int(x * 12102203.0) + 1064866808);
        }
    `),
    SplatHeader: createShaderBlock(`
        const float MIN_ALPHA = 1.0 / 255.0;
        const float INV_255 = 1.0 / 255.0;
        const float EXP4 = exp(-4.0);
        const float INV_EXP4 = 1.0 / (1.0 - EXP4);
        struct Splat {
            vec3 center;
            vec3 scales;
            vec4 quaternion;
            vec4 color;
        };
    `),
};
