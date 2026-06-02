
/**
 * All supported type of data in shader.
 */
export enum WebGLShaderDataType {
    Bool = 0x8B56,
    BoolVec2 = 0x8B57,
    BoolVec3 = 0x8B58,
    BoolVec4 = 0x8B59,
    Int = 0x1404,
    IntVec2 = 0x8B53,
    IntVec3 = 0x8B54,
    IntVec4 = 0x8B55,
    UInt = 0x1405,
    UIntVec2 = 0x8DC6,
    UIntVec3 = 0x8DC7,
    UIntVec4 = 0x8DC8,
    Float = 0x1406,
    Vec2 = 0x8B50,
    Vec3 = 0x8B51,
    Vec4 = 0x8B52,
    Mat2 = 0x8B5A,
    Mat3 = 0x8B5B,
    Mat4 = 0x8B5C,
    Sampler2D = 0x8B5E,
    Sampler2DArray = 0x8DC1,
    Sampler3D = 0x8B5F,
    SamplerCube = 0x8B60,

    USampler2D = 0x8DD2,
    USampler2DArray = 0x8DD7,
    USampler3D = 0x8DD3,

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
    Texture2D = 0x0DE1,
    TextureCubeMap = 0x8513,
}

/**
 * The cullFace method of the WebGL API specifies whether or not front- and/or back-facing polygons can be culled.
 */
export enum WebGLCullFace {
    None = 1000000, // it's not a gl const, let make a hole
    Back = 0x0404,
    Front = 0x0405,
    FrontBack = 0x0408
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

    RedInteger = 0x8D94,
    RGInteger = 0x8228,
    RGBInteger = 0x8D98,
    RGBAInteger = 0x8D99,

    Alpha = 0x1906,
    Luminance = 0x1909,
    LuminanceAlpha = 0x190A,
    Depth = 0x1902,
    DepthStencil = 0x84F9,
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
        case WebGLPixelFormat.Depth: return 1;

        case WebGLPixelFormat.RG:
        case WebGLPixelFormat.RGInteger:
        case WebGLPixelFormat.LuminanceAlpha:
        case WebGLPixelFormat.DepthStencil: return 2;

        case WebGLPixelFormat.RGB:
        case WebGLPixelFormat.RGBInteger: return 3;

        case WebGLPixelFormat.RGBA:
        case WebGLPixelFormat.RGBAInteger: return 4;

        default: {
            const v: never = t;
            return v;
        };
    }
}

/**
 * Additional WebGL blending source factors.
 */
export enum WebGLBlendingSrc {
    SrcAlphaSaturate = 0x0308,
}
