/**
 * All supported type of data in shader.
 */
export enum WebGLShaderDataType {
    Bool = 0x8b56,
    BoolVec2 = 0x8b57,
    BoolVec3 = 0x8b58,
    BoolVec4 = 0x8b59,
    Int = 0x1404,
    IntVec2 = 0x8b53,
    IntVec3 = 0x8b54,
    IntVec4 = 0x8b55,
    UInt = 0x1405,
    UIntVec2 = 0x8dc6,
    UIntVec3 = 0x8dc7,
    UIntVec4 = 0x8dc8,
    Float = 0x1406,
    Vec2 = 0x8b50,
    Vec3 = 0x8b51,
    Vec4 = 0x8b52,
    Mat2 = 0x8b5a,
    Mat3 = 0x8b5b,
    Mat4 = 0x8b5c,
    Sampler2D = 0x8b5e,
    Sampler2DArray = 0x8dc1,
    Sampler3D = 0x8b5f,
    SamplerCube = 0x8b60,

    USampler2D = 0x8dd2,
    USampler2DArray = 0x8dd7,
    USampler3D = 0x8dd3,

    // this is hole
    FloatV = 9999999,
    IntV = 9999998,
    UintV = 9999997,
    ArraySampler2D = 9999996,
    ArraySamplerCube = 9999995,
}
/**
 * Which type of encoding method supported by compressed texture.
 */
export enum WebGLTextureEncoding {
    Linear = 3000,
    sRGB = 3001,
    Gamma = 3007,
    RGBE = 3002,
    LogLuv = 3003,
    RGBM7 = 3004,
    RGBM16 = 3005,
    RGBD = 3006,
}
/**
 * Supported type of texture by webGL.
 */
export enum WebGLTextureType {
    Texture2D = 0x0de1,
    TextureCubeMap = 0x8513,
}

/**
 * The cullFace method of the WebGL API specifies whether or not front- and/or back-facing polygons can be culled.
 */
export enum WebGLCullFace {
    None = 1000000, // it's not a gl const, let make a hole
    Back = 0x0404,
    Front = 0x0405,
    FrontBack = 0x0408,
}
/**
 * Decide the color format in each pixel.
 */
export enum WebGLPixelFormat {
    Red = 0x1903,
    RG = 0x8227,
    /**
     * @deprecated 3 channel texture support dropped.
     */
    RGB = 0x1907,
    RGBA = 0x1908,

    RedInteger = 0x8d94,
    RGInteger = 0x8228,
    RGBInteger = 0x8d98,
    RGBAInteger = 0x8d99,

    Alpha = 0x1906,
    Luminance = 0x1909,
    LuminanceAlpha = 0x190a,
    Depth = 0x1902,
    DepthStencil = 0x84f9,
}

/**
 * Returns the number of color channels in a WebGL pixel format.
 */
export function getWebGLPixelFormatChannelSize(t: WebGLPixelFormat): number {
    switch (t) {
        case WebGLPixelFormat.Red:
        case WebGLPixelFormat.RedInteger:
        case WebGLPixelFormat.Alpha:
        case WebGLPixelFormat.Luminance:
        case WebGLPixelFormat.Depth:
            return 1;

        case WebGLPixelFormat.RG:
        case WebGLPixelFormat.RGInteger:
        case WebGLPixelFormat.LuminanceAlpha:
        case WebGLPixelFormat.DepthStencil:
            return 2;

        case WebGLPixelFormat.RGB:
        case WebGLPixelFormat.RGBInteger:
            return 3;

        case WebGLPixelFormat.RGBA:
        case WebGLPixelFormat.RGBAInteger:
            return 4;

        default: {
            const v: never = t;
            return v;
        }
    }
}

/**
 * Additional WebGL blending source factors.
 */
export enum WebGLBlendingSrc {
    SrcAlphaSaturate = 0x0308,
}
