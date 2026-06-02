/**
 * Specified the showing side of objects, which the fround side is normal vector's direction.
 */
export enum Side {
    FrontSide = 0,
    BackSide = 1,
    DoubleSide = 2,
}

/**
 * Specified the color blending mode for transparent effect.
 */
export enum Blending {
    NoBlending = 0,
    NormalBlending = 1,
    AdditiveBlending = 2,
    SubtractiveBlending = 3,
    MultiplyBlending = 4,
    CustomBlending = 5,
}

/**
 * The depth test {@link https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/depthFunc| function}.
 */
export enum DepthModes {
    NeverDepth = 0,
    AlwaysDepth = 1,
    LessDepth = 2,
    LessEqualDepth = 3,
    EqualDepth = 4,
    GreaterEqualDepth = 5,
    GreaterDepth = 6,
    NotEqualDepth = 7,
}

/**
 * Specify the data type of texture.
 */
export enum TextureDataType {
    UnsignedByteType = 0x1401,
    ByteType = 0x1400,
    ShortType = 0x1402,
    UnsignedShortType = 0x1403,
    IntType = 0x1404,
    UnsignedIntType = 0x1405,
    FloatType = 0x1406,
    HalfFloatType = 0x140B,
    UnsignedShort4444Type = 0x8033,
    UnsignedShort5551Type = 0x8034,
    UnsignedShort565Type = 0x8363,
    UnsignedInt248Type = 0x84FA,
    UnsignedInt2101010Type = 0x8368,
}

/**
 * Returns the byte size of one texture channel.
 */
export function getTextureDataTypeSize(t: TextureDataType) {
    switch (t) {
        case TextureDataType.UnsignedByteType: return 1;
        case TextureDataType.ByteType: return 1;
        case TextureDataType.UnsignedInt2101010Type: return 1;
        case TextureDataType.ShortType: return 2;
        case TextureDataType.UnsignedShortType: return 2;
        case TextureDataType.IntType: return 4;
        case TextureDataType.UnsignedIntType: return 4;
        case TextureDataType.FloatType: return 4;
        case TextureDataType.HalfFloatType: return 2;
        default: return 4;
    }
}

/**
 * compressed format of pixel data.
 */
export enum CompressedPixelFormat {
    /**
     * @deprecated DXT1 3 channel format not supported. use `RGBA_S3TC_DXT1_Format` instead
     */
    RGB_S3TC_DXT1_Format = 33776,
    /**
     * @deprecated use RGBA_BC1_UNORM_Format
     */
    RGBA_S3TC_DXT1_Format = 33777,
    /**
     * @deprecated use RGBA_BC2_UNORM_Format
     */
    RGBA_S3TC_DXT3_Format = 33778,
    /**
     * @deprecated use RGBA_BC3_UNORM_Format
     */
    RGBA_S3TC_DXT5_Format = 33779,
    /**
     * @deprecated PVRTC not supported.
     */
    RGB_PVRTC_4BPPV1_Format = 35840,
    /**
     * @deprecated PVRTC not supported.
     */
    RGB_PVRTC_2BPPV1_Format = 35841,
    /**
     * @deprecated PVRTC not supported.
     */
    RGBA_PVRTC_4BPPV1_Format = 35842,
    /**
     * @deprecated PVRTC not supported.
     */
    RGBA_PVRTC_2BPPV1_Format = 35843,
    /**
     * @deprecated ETC1 not supported.
     */
    RGB_ETC1_Format = 36196,

    /**
     * @deprecated use RGBA_ASTC_4x4_UNORM_Format
     */
    RGBA_ASTC_4x4_Format = 37808,
    /**
     * @deprecated use RGBA_ASTC_4x4_UNORM_Format
     */
    RGBA_ASTC_5x4_Format = 37809,
    /**
     * @deprecated use RGBA_ASTC_5x5_UNORM_Format
     */
    RGBA_ASTC_5x5_Format = 37810,
    /**
     * @deprecated use RGBA_ASTC_6x5_UNORM_Format
     */
    RGBA_ASTC_6x5_Format = 37811,
    /**
     * @deprecated use RGBA_ASTC_6x6_UNORM_Format
     */
    RGBA_ASTC_6x6_Format = 37812,
    /**
     * @deprecated use RGBA_ASTC_8x5_UNORM_Format
     */
    RGBA_ASTC_8x5_Format = 37813,
    /**
     * @deprecated use RGBA_ASTC_8x6_UNORM_Format
     */
    RGBA_ASTC_8x6_Format = 37814,
    /**
     * @deprecated use RGBA_ASTC_8x8_UNORM_Format
     */
    RGBA_ASTC_8x8_Format = 37815,
    /**
     * @deprecated use RGBA_ASTC_10x5_UNORM_Format
     */
    RGBA_ASTC_10x5_Format = 37816,
    /**
     * @deprecated use RGBA_ASTC_10x6_UNORM_Format
     */
    RGBA_ASTC_10x6_Format = 37817,
    /**
     * @deprecated use RGBA_ASTC_10x8_UNORM_Format
     */
    RGBA_ASTC_10x8_Format = 37818,
    /**
     * @deprecated use RGBA_ASTC_10x10_UNORM_Format
     */
    RGBA_ASTC_10x10_Format = 37819,
    /**
     * @deprecated use RGBA_ASTC_12x10_UNORM_Format
     */
    RGBA_ASTC_12x10_Format = 37820,
    /**
     * @deprecated use RGBA_ASTC_12x12_UNORM_Format
     */
    RGBA_ASTC_12x12_Format = 37821,

    // ASTC
    RGBA_ASTC_4x4_UNORM_Format = 37808,
    RGBA_ASTC_5x4_UNORM_Format = 37809,
    RGBA_ASTC_5x5_UNORM_Format = 37810,
    RGBA_ASTC_6x5_UNORM_Format = 37811,
    RGBA_ASTC_6x6_UNORM_Format = 37812,
    RGBA_ASTC_8x5_UNORM_Format = 37813,
    RGBA_ASTC_8x6_UNORM_Format = 37814,
    RGBA_ASTC_8x8_UNORM_Format = 37815,
    RGBA_ASTC_10x5_UNORM_Format = 37816,
    RGBA_ASTC_10x6_UNORM_Format = 37817,
    RGBA_ASTC_10x8_UNORM_Format = 37818,
    RGBA_ASTC_10x10_UNORM_Format = 37819,
    RGBA_ASTC_12x10_UNORM_Format = 37820,
    RGBA_ASTC_12x12_UNORM_Format = 37821,
    RGBA_ASTC_4x4_SRGB_Format = 37840,
    RGBA_ASTC_5x4_SRGB_Format = 37841,
    RGBA_ASTC_5x5_SRGB_Format = 37842,
    RGBA_ASTC_6x5_SRGB_Format = 37843,
    RGBA_ASTC_6x6_SRGB_Format = 37844,
    RGBA_ASTC_8x5_SRGB_Format = 37845,
    RGBA_ASTC_8x6_SRGB_Format = 37846,
    RGBA_ASTC_8x8_SRGB_Format = 37847,
    RGBA_ASTC_10x5_SRGB_Format = 37848,
    RGBA_ASTC_10x6_SRGB_Format = 37849,
    RGBA_ASTC_10x8_SRGB_Format = 37850,
    RGBA_ASTC_10x10_SRGB_Format = 37851,
    RGBA_ASTC_12x10_SRGB_Format = 37852,
    RGBA_ASTC_12x12_SRGB_Format = 37853,

    // S3TC
    RGBA_BC1_UNORM_Format = 33777,
    RGBA_BC2_UNORM_Format = 33778,
    RGBA_BC3_UNORM_Format = 33779,

    // BPTC
    RGBA_BC7_UNORM_Format = 36492,
    RGBA_BC7_SRGB_Format = 36493,

    // ETC2
    RGB8_ETC2_UNORM_Format = 37492,
    RGBA8_ETC2_UNORM_Format = 37496,
    RGB8_ETC2_SRGB_Format = 37493,
    RGBA8_ETC2_SRGB_Format = 37497,
}

/**
 * Supported texture compressed method.
 * @remarks see {@link https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Compressed_texture_formats| Graphics lineStyle} for more details.
 */
export enum CompressTextureType {
    S3TC = 1,
    /**
     * @deprecated PVRTC not supported
     */
    PVRTC = 2,
    BPTC = 3,
    ETC2 = 4,
    ASTC = 5,
}

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants
/**
 * This is used to decide how the vertex array is drawing.
 */
export enum DrawMode {
    Points = 0x0000,
    Lines = 0x0001,
    LineLoop = 0x0002,
    LineStrip = 0x0003,
    Triangles = 0x0004,
    TriangleStrip = 0x0005,
    TriangleFan = 0x0006,
}

/**
 * These define the texture's wrapS and wrapT properties, which define horizontal and vertical texture wrapping.
 */
export enum SamplerWrap {
    /**
     * With RepeatWrapping the texture will simply repeat to infinity.
     */
    Repeat = 0x2901,
    /**
     * ClampToEdgeWrapping is the default. The last pixel of the texture stretches to the edge of the mesh.
     */
    ClampToEdge = 0x812F,
    /**
     * With MirroredRepeatWrapping the texture will repeats to infinity, mirroring on each repeat.
     */
    MirroredRepeat = 0x8370
}

/**
 * With MirroredRepeatWrapping the texture will repeats to infinity, mirroring on each repeat.
 */
export enum SamplerFilter {
    Nearest = 0x2600,
    Linear = 0x2601,
    NearestMipmapNearest = 0x2700,
    LinearMipmapNearest = 0x2701,
    NearestMipmapLinear = 0x2702,
    LinearMipmapLinear = 0x2703
}

/**
 * The blendEquation method of the WebGL API is used to set both the RGB blend equation and alpha blend equation to a single equation.
 */
export enum BlendingEquation {
    Add = 0x8006,
    Subtract = 0x800A,
    ReverseSubtract = 0x800B,
    Min = 0x8007,
    Max = 0x8008,
}

/**
 * The following constants can be used for sfactor and dfactor.
 * The formula for the blending color can be described like this: color(RGBA) = (sourceColor * sfactor) + (destinationColor * dfactor).
 * The RBGA values are between 0 and 1.
 */
export enum BlendingFactor {
    Zero = 0,
    One = 1,
    SrcColor = 0x0300,
    OneMinusSrcColor = 0x0301,
    SrcAlphaFactor = 0x0302,
    OneMinusSrcAlpha = 0x0303,
    DstAlpha = 0x0304,
    OneMinusDstAlpha = 0x0305,
    DstColor = 0x0306,
    OneMinusDstColor = 0x0307,
}

/**
 * The stencilOp method of the WebGL API sets both the front and back-facing stencil test actions.
 */
export enum StencilOp {
    ZeroStencilOp = 0,
    KeepStencilOp = 7680,
    ReplaceStencilOp = 7681,
    IncrementStencilOp = 7682,
    DecrementStencilOp = 7683,
    IncrementWrapStencilOp = 34055,
    DecrementWrapStencilOp = 34056,
    InvertStencilOp = 5386
}
/**
 * The stencilFunc method of the WebGL API sets the front and back function and reference value for stencil testing.
 * Stenciling enables and disables drawing on a per-pixel basis. It is typically used in multipass rendering to achieve special effects.
 */
export enum StencilFunc {
    NeverStencilFunc = 512,
    LessStencilFunc = 513,
    EqualStencilFunc = 514,
    LessEqualStencilFunc = 515,
    GreaterStencilFunc = 516,
    NotEqualStencilFunc = 517,
    GreaterEqualStencilFunc = 518,
    AlwaysStencilFunc = 519
}
