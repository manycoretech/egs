import { RendererBackend } from '../../renderer/IRenderer';
import { logger } from '../../utils/Logger';

/**
 * Dimensionality of texture storage.
 */
export enum TextureDimension {
    D2,
    D3,
}

/**
 * View shape used when sampling a texture.
 */
export enum TextureViewDimension {
    D2,
    D2Array,
    Cube,
    D3
}

/**
 * Texture formats
 * values same as GPUTextureFormat
 * sorted by channels, channel type, [unorm, snorm, uint, sint, float]
 */
export enum TextureFormat {
    R8Snorm = 'r8snorm',
    R8Unorm = 'r8unorm',
    R8Uint = 'r8uint',
    R8Sint = 'r8sint',
    R16Float = 'r16float',
    R16Sint = 'r16sint',
    R16Uint = 'r16uint',
    R32Float = 'r32float',
    R32Sint = 'r32sint',
    R32Uint = 'r32uint',

    Rg8Snorm = 'rg8snorm',
    Rg8Unorm = 'rg8unorm',
    Rg8Sint = 'rg8sint',
    Rg8Uint = 'rg8uint',
    Rg16Float = 'rg16float',
    Rg16Sint = 'rg16sint',
    Rg16Uint = 'rg16uint',
    Rg32Float = 'rg32float',
    Rg32Sint = 'rg32sint',
    Rg32Uint = 'rg32uint',

    Rgba8Snorm = 'rgba8snorm',
    Rgba8Unorm = 'rgba8unorm',
    Rgba8Sint = 'rgba8sint',
    Rgba8Uint = 'rgba8uint',
    Rgba8UnormSrgb = 'rgba8unorm-srgb',
    Rgb10a2Unorm = 'rgb10a2unorm',
    Rgba16Float = 'rgba16float',
    Rgba16Sint = 'rgba16sint',
    Rgba16Uint = 'rgba16uint',
    Rgba32Float = 'rgba32float',
    Rgba32Sint = 'rgba32sint',
    Rgba32Uint = 'rgba32uint',
    Bgra8Unorm = 'bgra8unorm',
    Bgra8UnormSrgb = 'bgra8unorm-srgb',

    // depth and stencil formats
    Depth16Unorm = 'depth16unorm',
    Depth24Plus = 'depth24plus',
    Depth24PlusStencil8 = 'depth24plus-stencil8',

    // ASTC
    Astc4x4Unorm = 'astc-4x4-unorm',
    Astc4x4UnormSrgb = 'astc-4x4-unorm-srgb',
    Astc5x4Unorm = 'astc-5x4-unorm',
    Astc5x4UnormSrgb = 'astc-5x4-unorm-srgb',
    Astc5x5Unorm = 'astc-5x5-unorm',
    Astc5x5UnormSrgb = 'astc-5x5-unorm-srgb',
    Astc6x5Unorm = 'astc-6x5-unorm',
    Astc6x5UnormSrgb = 'astc-6x5-unorm-srgb',
    Astc6x6Unorm = 'astc-6x6-unorm',
    Astc6x6UnormSrgb = 'astc-6x6-unorm-srgb',
    Astc8x5Unorm = 'astc-8x5-unorm',
    Astc8x5UnormSrgb = 'astc-8x5-unorm-srgb',
    Astc8x6Unorm = 'astc-8x6-unorm',
    Astc8x6UnormSrgb = 'astc-8x6-unorm-srgb',
    Astc8x8Unorm = 'astc-8x8-unorm',
    Astc8x8UnormSrgb = 'astc-8x8-unorm-srgb',
    Astc10x5Unorm = 'astc-10x5-unorm',
    Astc10x5UnormSrgb = 'astc-10x5-unorm-srgb',
    Astc10x6Unorm = 'astc-10x6-unorm',
    Astc10x6UnormSrgb = 'astc-10x6-unorm-srgb',
    Astc10x8Unorm = 'astc-10x8-unorm',
    Astc10x8UnormSrgb = 'astc-10x8-unorm-srgb',
    Astc10x10Unorm = 'astc-10x10-unorm',
    Astc10x10UnormSrgb = 'astc-10x10-unorm-srgb',
    Astc12x10Unorm = 'astc-12x10-unorm',
    Astc12x10UnormSrgb = 'astc-12x10-unorm-srgb',
    Astc12x12Unorm = 'astc-12x12-unorm',
    Astc12x12UnormSrgb = 'astc-12x12-unorm-srgb',

    // BC
    Bc1RgbaUnorm = 'bc1-rgba-unorm',
    Bc2RgbaUnorm = 'bc2-rgba-unorm',
    Bc3RgbaUnorm = 'bc3-rgba-unorm',
    Bc7RgbaUnorm = 'bc7-rgba-unorm',
    Bc7RgbaUnormSrgb = 'bc7-rgba-unorm-srgb',

    // ETC2
    Etc2Rgb8Unorm = 'etc2-rgb8unorm',
    Etc2Rgb8UnormSrgb = 'etc2-rgb8unorm-srgb',
    Etc2Rgba8Unorm = 'etc2-rgba8unorm',
    Etc2Rgba8UnormSrgb = 'etc2-rgba8unorm-srgb',
}

export const CUBE_FACES = [
    0x8515, // WebGLRenderingContext.TEXTURE_CUBE_MAP_POSITIVE_X
    0x8516, // WebGLRenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_X
    0x8517, // WebGLRenderingContext.TEXTURE_CUBE_MAP_POSITIVE_Y
    0x8518, // WebGLRenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_Y
    0x8519, // WebGLRenderingContext.TEXTURE_CUBE_MAP_POSITIVE_Z
    0x851A, // WebGLRenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_Z
];

const WebGLFormatEnums = {
    // internal
    R8: 0x8229,
    R8_SNORM: 0x8F94,
    R16F: 0x822D,
    R32F: 0x822E,
    R8UI: 0x8232,
    R8I: 0x8231,
    R16UI: 0x8234,
    R16I: 0x8233,
    R32UI: 0x8236,
    R32I: 0x8235,
    RG8: 0x822B,
    RG8_SNORM: 0x8F95,
    RG16F: 0x822F,
    RG32F: 0x8230,
    RG8UI: 0x8238,
    RG8I: 0x8237,
    RG16UI: 0x823A,
    RG16I: 0x8239,
    RG32UI: 0x823C,
    RG32I: 0x823B,
    RGB8: 0x8051,
    SRGB8: 0x8C41,
    RGB565: 0x8D62,
    RGB8_SNORM: 0x8F96,
    R11F_G11F_B10F: 0x8C3A,
    RGB9_E5: 0x8C3D,
    RGB16F: 0x881B,
    RGB32F: 0x8815,
    RGB8UI: 0x8D7D,
    RGB8I: 0x8D8F,
    RGB16UI: 0x8D77,
    RGB16I: 0x8D89,
    RGB32UI: 0x8D71,
    RGB32I: 0x8D83,
    RGBA8: 0x8058,
    SRGB8_ALPHA8: 0x8C43,
    RGBA8_SNORM: 0x8F97,
    RGB5_A1: 0x8057,
    RGBA4: 0x8056,
    RGB10_A2: 0x8059,
    RGBA16F: 0x881A,
    RGBA32F: 0x8814,
    RGBA8UI: 0x8D7C,
    RGBA8I: 0x8D8E,
    RGBA16UI: 0x8D76,
    RGBA16I: 0x8D88,
    RGBA32UI: 0x8D70,
    RGBA32I: 0x8D82,
    // depth/stencil internal
    DEPTH_COMPONENT16: 0x81A5,
    DEPTH_COMPONENT24: 0x81A6,
    DEPTH_COMPONENT32F: 0x8CAC,
    DEPTH24_STENCIL8: 0x88F0,
    DEPTH32F_STENCIL8: 0x8CAD,

    // external
    RED: 0x1903,
    RED_INTEGER: 0x8D94,
    RG: 0x8227,
    RG_INTEGER: 0x8228,
    RGB: 0x1907,
    RGB_INTEGER: 0x8D98,
    RGBA: 0x1908,
    RGBA_INTEGER: 0x8D99,
    ALPHA: 0x1906,
    LUMINANCE: 0x1909,
    LUMINANCE_ALPHA: 0x190A,
    // depth/stencil external
    DEPTH_COMPONENT: 0x1902,
    DEPTH_STENCIL: 0x84F9,

    // data type
    BYTE: 0x1400,
    UNSIGNED_BYTE: 0x1401,
    SHORT: 0x1402,
    UNSIGNED_SHORT: 0x1403,
    UNSIGNED_SHORT_4_4_4_4: 0x8033,
    UNSIGNED_SHORT_5_5_5_1: 0x8034,
    UNSIGNED_SHORT_5_6_5: 0x8363,
    INT: 0x1404,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
    HALF_FLOAT: 0x140B,
    UNSIGNED_INT_2_10_10_10_REV: 0x8368,
    UNSIGNED_INT_24_8: 0x84FA,
    UNSIGNED_INT_10F_11F_11F_REV: 0x8C3B,
    UNSIGNED_INT_5_9_9_9_REV: 0x8C3E,
    FLOAT_32_UNSIGNED_INT_24_8_REV: 0x8DAD,
    // ext data type
    HALF_FLOAT_OES: 0x8D61,

    // ASTC
    COMPRESSED_RGBA_ASTC_4x4_KHR: 0x93B0,
    COMPRESSED_RGBA_ASTC_5x4_KHR: 0x93B1,
    COMPRESSED_RGBA_ASTC_5x5_KHR: 0x93B2,
    COMPRESSED_RGBA_ASTC_6x5_KHR: 0x93B3,
    COMPRESSED_RGBA_ASTC_6x6_KHR: 0x93B4,
    COMPRESSED_RGBA_ASTC_8x5_KHR: 0x93B5,
    COMPRESSED_RGBA_ASTC_8x6_KHR: 0x93B6,
    COMPRESSED_RGBA_ASTC_8x8_KHR: 0x93B7,
    COMPRESSED_RGBA_ASTC_10x5_KHR: 0x93B8,
    COMPRESSED_RGBA_ASTC_10x6_KHR: 0x93B9,
    COMPRESSED_RGBA_ASTC_10x8_KHR: 0x93BA,
    COMPRESSED_RGBA_ASTC_10x10_KHR: 0x93BB,
    COMPRESSED_RGBA_ASTC_12x10_KHR: 0x93BC,
    COMPRESSED_RGBA_ASTC_12x12_KHR: 0x93BD,
    COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR: 0x93D0,
    COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR: 0x93D1,
    COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR: 0x93D2,
    COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR: 0x93D3,
    COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR: 0x93D4,
    COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR: 0x93D5,
    COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR: 0x93D6,
    COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR: 0x93D7,
    COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR: 0x93D8,
    COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR: 0x93D9,
    COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR: 0x93DA,
    COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR: 0x93DB,
    COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR: 0x93DC,
    COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR: 0x93DD,

    // S3TC
    COMPRESSED_RGBA_S3TC_DXT1_EXT: 0x83F1,
    COMPRESSED_RGBA_S3TC_DXT3_EXT: 0x83F2,
    COMPRESSED_RGBA_S3TC_DXT5_EXT: 0x83F3,

    // BPTC
    COMPRESSED_RGBA_BPTC_UNORM_EXT: 0x8E8C,
    COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT: 0x8E8D,
    COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT: 0x8E8E,
    COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT: 0x8E8F,

    // ETC
    COMPRESSED_R11_EAC: 0x9270,
    COMPRESSED_SIGNED_R11_EAC: 0x9271,
    COMPRESSED_RG11_EAC: 0x9272,
    COMPRESSED_SIGNED_RG11_EAC: 0x9273,
    COMPRESSED_RGB8_ETC2: 0x9274,
    COMPRESSED_SRGB8_ETC2: 0x9275,
    COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2: 0x9276,
    COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2: 0x9277,
    COMPRESSED_RGBA8_ETC2_EAC: 0x9278,
    COMPRESSED_SRGB8_ALPHA8_ETC2_EAC: 0x9279,
};

export class WebGLTextureFormat {
    private _cache: {
        [key: string]: {
            internal: number,
            external: number,
            dataType: number,
        }
    };
    constructor(private _internal: number, private _external: number, private _dataType: number, readonly compressed: boolean) {
        this._cache = {};
    }

    internal(backend: RendererBackend) {
        return this.backendSpecified(backend).internal;
    }

    external(backend: RendererBackend) {
        return this.backendSpecified(backend).external;
    }

    dataType(backend: RendererBackend) {
        return this.backendSpecified(backend).dataType;
    }

    private specifyInternal(backend: RendererBackend) {
        if (!this.compressed && backend === RendererBackend.WEBGL_JS) {
            return this._external;
        }
        return this._internal;
    }

    private specifyExternal(_backend: RendererBackend) {
        return this._external;
    }

    private specifyDataType(backend: RendererBackend) {
        if (backend === RendererBackend.WEBGL_JS) {
            if (this._dataType === WebGLFormatEnums.HALF_FLOAT) {
                return WebGLFormatEnums.HALF_FLOAT_OES;
            }
        }
        return this._dataType;
    }

    private backendSpecified(backend: RendererBackend) {
        let specified = this._cache[backend];
        if (!specified) {
            specified = {
                internal: this.specifyInternal(backend),
                external: this.specifyExternal(backend),
                dataType: this.specifyDataType(backend)
            };
            this._cache[backend] = specified;
        }
        return specified;
    }
}

interface TextureCopyInfo {
    blockCopySize: number,
    blockDimensions: { x: number, y: number },
}

interface TextureFormatMeta {
    copyInfo: TextureCopyInfo,
    glFormat: WebGLTextureFormat
}

const _metaCache: {
    [key: string]: TextureFormatMeta
} = {};

const DUMMY_META: TextureFormatMeta = {
    copyInfo: {
        blockCopySize: 0,
        blockDimensions: { x: 0, y: 0 }
    },
    glFormat: new WebGLTextureFormat(0, 0, 0, false)
};

export function formatMeta(format: TextureFormat) {
    let meta = _metaCache[format];
    if (!meta) {
        const gl = WebGLFormatEnums;
        switch (format) {
            case TextureFormat.R8Snorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 1,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R8_SNORM, gl.RED, gl.BYTE, false)
                };
                break;
            }
            case TextureFormat.R8Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 1,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R8, gl.RED, gl.UNSIGNED_BYTE, false)
                };
                break;
            }
            case TextureFormat.R8Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 1,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R8I, gl.RED_INTEGER, gl.BYTE, false)
                };
                break;
            }
            case TextureFormat.R8Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 1,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, false)
                };
                break;
            }
            case TextureFormat.R16Float: {
                meta = {
                    copyInfo: {
                        blockCopySize: 2,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R16F, gl.RED, gl.HALF_FLOAT, false)
                };
                break;
            }
            case TextureFormat.R16Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 2,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R16I, gl.RED_INTEGER, gl.SHORT, false)
                };
                break;
            }
            case TextureFormat.R16Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 2,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R16UI, gl.RED_INTEGER, gl.UNSIGNED_SHORT, false)
                };
                break;
            }
            case TextureFormat.R32Float: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R32F, gl.RED, gl.FLOAT, false)
                };
                break;
            }
            case TextureFormat.R32Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R32I, gl.RED_INTEGER, gl.INT, false)
                };
                break;
            }
            case TextureFormat.R32Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, false)
                };
                break;
            }
            case TextureFormat.Rg8Snorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 2,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG8_SNORM, gl.RG, gl.BYTE, false)
                };
                break;
            }
            case TextureFormat.Rg8Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 2,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG8, gl.RG, gl.UNSIGNED_BYTE, false)
                };
                break;
            }
            case TextureFormat.Rg8Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 2,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG8I, gl.RG_INTEGER, gl.BYTE, false)
                };
                break;
            }
            case TextureFormat.Rg8Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 2,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG8UI, gl.RG_INTEGER, gl.UNSIGNED_BYTE, false)
                };
                break;
            }
            case TextureFormat.Rg16Float: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG16F, gl.RG, gl.HALF_FLOAT, false)
                };
                break;
            }
            case TextureFormat.Rg16Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG16I, gl.RG_INTEGER, gl.SHORT, false)
                };
                break;
            }
            case TextureFormat.Rg16Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG16I, gl.RG_INTEGER, gl.UNSIGNED_SHORT, false)
                };
                break;
            }
            case TextureFormat.Rg32Float: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG32F, gl.RG, gl.FLOAT, false)
                };
                break;
            }
            case TextureFormat.Rg32Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG32I, gl.RG_INTEGER, gl.INT, false)
                };
                break;
            }
            case TextureFormat.Rg32Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RG32UI, gl.RG_INTEGER, gl.UNSIGNED_INT, false)
                };
                break;
            }
            case TextureFormat.Rgba8Snorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA8_SNORM, gl.RGBA, gl.BYTE, false)
                };
                break;
            }
            case TextureFormat.Rgba8Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, false)
                };
                break;
            }
            case TextureFormat.Rgba8Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA8I, gl.RGBA_INTEGER, gl.BYTE, false)
                };
                break;
            }
            case TextureFormat.Rgba8Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA8UI, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, false)
                };
                break;
            }
            case TextureFormat.Rgba8UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, false)
                };
                break;
            }
            case TextureFormat.Rgb10a2Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGB10_A2, gl.RGBA, gl.UNSIGNED_INT_2_10_10_10_REV, false)
                };
                break;
            }
            case TextureFormat.Rgba16Float: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, false)
                };
                break;
            }
            case TextureFormat.Rgba16Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA16I, gl.RGBA_INTEGER, gl.SHORT, false)
                };
                break;
            }
            case TextureFormat.Rgba16Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA16UI, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT, false)
                };
                break;
            }
            case TextureFormat.Rgba32Float: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA32F, gl.RGBA, gl.FLOAT, false)
                };
                break;
            }
            case TextureFormat.Rgba32Sint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA32I, gl.RGBA_INTEGER, gl.INT, false)
                };
                break;
            }
            case TextureFormat.Rgba32Uint: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.RGBA32UI, gl.RGBA_INTEGER, gl.UNSIGNED_INT, false)
                };
                break;
            }
            case TextureFormat.Bgra8Unorm:
            case TextureFormat.Bgra8UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    // unsupported in webgl
                    glFormat: new WebGLTextureFormat(0, 0, 0, false)
                };
                break;
            }
            case TextureFormat.Depth16Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 2,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.DEPTH_COMPONENT16, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, false)
                };
                break;
            }
            case TextureFormat.Depth24Plus: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, false)
                };
                break;
            }
            case TextureFormat.Depth24PlusStencil8: {
                meta = {
                    copyInfo: {
                        blockCopySize: 4,
                        blockDimensions: { x: 1, y: 1 }
                    },
                    glFormat: new WebGLTextureFormat(gl.DEPTH24_STENCIL8, gl.DEPTH_STENCIL, gl.UNSIGNED_INT_24_8, false)
                };
                break;
            }
            case TextureFormat.Astc4x4Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_4x4_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc4x4UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc5x4Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 5, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_5x4_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc5x4UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 5, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc5x5Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 5, y: 5 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_5x5_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc5x5UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 5, y: 5 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc6x5Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 6, y: 5 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_6x5_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc6x5UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 6, y: 5 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc6x6Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 6, y: 6 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_6x6_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc6x6UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 6, y: 6 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc8x5Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 8, y: 5 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_8x5_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc8x5UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 8, y: 5 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc8x6Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 8, y: 6 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_8x6_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc8x6UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 8, y: 6 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc8x8Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 8, y: 8 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_8x8_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc8x8UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 8, y: 8 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc10x5Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 10, y: 5 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_10x5_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc10x5UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 10, y: 5 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc10x6Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 10, y: 6 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_10x6_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc10x6UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 10, y: 6 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc10x8Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 10, y: 8 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_10x8_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc10x8UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 10, y: 8 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc10x10Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 10, y: 10 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_10x10_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc10x10UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 10, y: 10 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc12x10Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 12, y: 10 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_12x10_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc12x10UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 12, y: 10 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc12x12Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 12, y: 12 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_ASTC_12x12_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Astc12x12UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 12, y: 12 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Bc1RgbaUnorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_S3TC_DXT1_EXT, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Bc2RgbaUnorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_S3TC_DXT3_EXT, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Bc3RgbaUnorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_S3TC_DXT5_EXT, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Bc7RgbaUnorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA_BPTC_UNORM_EXT, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Bc7RgbaUnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT, gl.RGBA, 0, true)
                };
                break;
            }

            case TextureFormat.Etc2Rgb8Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGB8_ETC2, gl.RGB, 0, true)
                };
                break;
            }
            case TextureFormat.Etc2Rgb8UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 8,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ETC2, gl.RGB, 0, true)
                };
                break;
            }
            case TextureFormat.Etc2Rgba8Unorm: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_RGBA8_ETC2_EAC, gl.RGBA, 0, true)
                };
                break;
            }
            case TextureFormat.Etc2Rgba8UnormSrgb: {
                meta = {
                    copyInfo: {
                        blockCopySize: 16,
                        blockDimensions: { x: 4, y: 4 }
                    },
                    glFormat: new WebGLTextureFormat(gl.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC, gl.RGBA, 0, true)
                };
                break;
            }
            default: {
                logger.unsupported(`Unsupported texture format ${format}`);
                return DUMMY_META;
            }
        }
        _metaCache[format] = meta;
    }
    return meta;
}

export function describeWebGLFormat(format: TextureFormat): WebGLTextureFormat {
    return formatMeta(format).glFormat;
}

export function textureCopyInfo(format: TextureFormat) {
    return formatMeta(format).copyInfo;
}

export function getBindableTarget(viewDimension: TextureViewDimension): number {
    switch (viewDimension) {
        case TextureViewDimension.D2: return 0x0DE1; // WebGL2RenderingContext.TEXTURE_2D;
        case TextureViewDimension.Cube: return 0x8513; // WebGL2RenderingContext.TEXTURE_CUBE_MAP;
        case TextureViewDimension.D2Array: return 0x8C1A; // WebGL2RenderingContext.TEXTURE_2D_ARRAY;
        case TextureViewDimension.D3: return 0x806F; // WebGL2RenderingContext.TEXTURE_3D;
    }
}

export function toTextureDimension(viewDimension: TextureViewDimension): TextureDimension {
    switch (viewDimension) {
        case TextureViewDimension.D2:
        case TextureViewDimension.Cube:
        case TextureViewDimension.D2Array:
            return TextureDimension.D2;
        case TextureViewDimension.D3:
            return TextureDimension.D3;
    }
}

export function getDepthFormat(enableStencil: boolean, backend: RendererBackend) {
    if (enableStencil) {
        return TextureFormat.Depth24PlusStencil8;
    } else {
        // for wasm use depth24plus
        return backend === RendererBackend.WEBGL2_JS || backend === RendererBackend.WEBGL_JS ? TextureFormat.Depth16Unorm
            : TextureFormat.Depth24Plus;
    }
}

export function maxMipLevels(width: number, height: number, depthOrArrayLayers: number, dimension: TextureDimension) {
    if (dimension === TextureDimension.D2) {
        return Math.floor(Math.log2(Math.max(width, height))) + 1;
    } else {
        return Math.floor(Math.log2(Math.max(width, height, depthOrArrayLayers))) + 1;
    }
}

export function mipLevelSize(level: number, width: number, height: number, depthOrArrayLayers: number, dimension: TextureDimension) {
    return {
        width: Math.max(1, width >>> level),
        height: Math.max(1, height >>> level),
        depthOrArrayLayers: dimension === TextureDimension.D2 ? depthOrArrayLayers : Math.max(1, depthOrArrayLayers >>> level)
    };
}

export function textureCopyFootprint(width: number, height: number, copyInfo: TextureCopyInfo) {
    const blockWidth = Math.ceil(width / copyInfo.blockDimensions.x);
    const blockHeight = Math.ceil(height / copyInfo.blockDimensions.y);

    return {
        bytesPerRow: blockWidth * copyInfo.blockCopySize,
        rowsPerImage: blockHeight
    };
}

export function textureByteSize(width: number, height: number, copyInfo: TextureCopyInfo) {
    const { bytesPerRow, rowsPerImage } = textureCopyFootprint(width, height, copyInfo);
    return bytesPerRow * rowsPerImage;
}
