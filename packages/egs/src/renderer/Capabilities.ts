import { CompressTextureType, CompressedPixelFormat } from '../utils/Constants';
import type { WebGLPixelFormat } from './webgl/WGLConstants';
import type { RendererParameters } from './IRenderer';

/**
 * WGLCapabilities indicates all capabilities in WebGl/WebGL2 context. It is used to prevent error from data over limitation.
 * It will be set up when the canvas or context is built and its values will never change. Each context only has one instance.
 */
export class Capabilities {
    /**
     * Whether or not enable WebGL2 backend.
     */
    static IS_WEBGL2: boolean;

    /**
     * Whether or not enable WEBGPU backend.
     */
    static get IS_WEBGPU() {
        return !!window.EGS_ENABLE_WEBGPU;
    }

    /**
     * Whether or not using advanced graphics backends. such as webgl2, webgpu.
     */
    static get IS_ADVANCED_BACKEND() {
        return Capabilities.IS_WEBGL2 || Capabilities.IS_WEBGPU;
    }

    /**
     * Shader precision. Can be "highp", "mediump" or "lowp".
     */
    static PRECISION: string;
    /**
     * Get the maximum precision by {@link _IS_SUPPORT_HIGH_FLOAT| high} and {@link _IS_SUPPORT_MEDIUM_FLOAT| medium}.
     */
    static MAX_PRECISION: string;
    /**
     * Maximum of the number of texture supported by browser.
     */
    static MAX_COMBINED_TEXTURE_IMAGE_UNITS: number;
    /**
     * Maximum of the number of texture supported by browser.
     */
    static MAX_TEXTURES: number;
    static MAX_VERTEX_TEXTURES: number;
    /**
     * The limitation of texture's pixel count.
     */
    static MAX_TEXTURE_SIZE: number;
    /**
     * The limitation of cube map's pixel count.
     */
    static MAX_CUBEMAP_SIZE: number;
    /**
     * The max number of vertex attributes supported by browser.
     */
    static MAX_ATTRIBUTES: number;
    static MAX_VERTEX_UNIFORMS: number;
    static MAX_VARYINGS: number;
    static MAX_FRAGMENT_UNIFORMS: number;
    static IS_SUPPORT_VERTEX_TEXTURES: boolean;
    static IS_SUPPORT_FLOAT_FRAGMENT_TEXTURES: boolean;
    static IS_SUPPORT_FLOAT_VERTEX_TEXTURES: boolean;
    static IS_SUPPORT_VAO: boolean;
    static IS_SUPPORT_INSTANCE: boolean;
    static MAX_SAMPLES: number;
    static MAX_ANISOTROPY: number;
    /**
     * High precision float is or not supported by WebGLContext.
     */
    static _IS_SUPPORT_HIGH_FLOAT: boolean;
    /**
     * Medium precision float is or not supported by WebGLContext.
     */
    static _IS_SUPPORT_MEDIUM_FLOAT: boolean;
    static IS_SUPPORT_DEPTH_TEXTURE: boolean;
    static IS_SUPPORT_SHADER_TEXTURE_LOD: boolean;

    static SUPPORTED_COMPRESS_TEXTURE_TYPES: CompressTextureType[] = [];
    static SUPPORTED_COMPRESS_TEXTURE_FORMATS: Array<WebGLPixelFormat | CompressedPixelFormat> = [];

    static isCompressTextureFormatSupport(glFormat: WebGLPixelFormat | CompressedPixelFormat): boolean {
        return Capabilities.SUPPORTED_COMPRESS_TEXTURE_FORMATS.indexOf(glFormat) > -1;
    }

    static getMaxPrecision(precision: string): string {
        if (precision === 'highp') {
            if (Capabilities._IS_SUPPORT_HIGH_FLOAT) {
                return 'highp';
            } else if (Capabilities._IS_SUPPORT_MEDIUM_FLOAT) {
                return 'mediump';
            }
        }

        if (precision === 'mediump' && Capabilities._IS_SUPPORT_MEDIUM_FLOAT) {
            return 'mediump';
        }

        return 'lowp';
    }
}

interface TextureCompressionSupportedInfo {
    textureCompressionBCSupported: boolean;
    textureCompressionETC2Supported: boolean;
    textureCompressionASTCSupported: boolean;
}

export function setupWebGPUCompressedTextureCapabilities(info: TextureCompressionSupportedInfo) {
    Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES = [];
    Capabilities.SUPPORTED_COMPRESS_TEXTURE_FORMATS = [];

    if (info.textureCompressionBCSupported) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.push(CompressTextureType.S3TC, CompressTextureType.BPTC);
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_FORMATS.push(
            CompressedPixelFormat.RGBA_BC1_UNORM_Format,
            CompressedPixelFormat.RGBA_BC2_UNORM_Format,
            CompressedPixelFormat.RGBA_BC3_UNORM_Format,
            CompressedPixelFormat.RGBA_BC7_UNORM_Format,
            CompressedPixelFormat.RGBA_BC7_SRGB_Format,
        );
    }

    if (info.textureCompressionETC2Supported) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.push(CompressTextureType.ETC2);
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_FORMATS.push(
            CompressedPixelFormat.RGB8_ETC2_UNORM_Format,
            CompressedPixelFormat.RGB8_ETC2_SRGB_Format,
            CompressedPixelFormat.RGBA8_ETC2_UNORM_Format,
            CompressedPixelFormat.RGBA8_ETC2_SRGB_Format,
        );
    }

    if (info.textureCompressionASTCSupported) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.push(CompressTextureType.ASTC);
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_FORMATS.push(
            CompressedPixelFormat.RGBA_ASTC_4x4_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_5x4_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_5x5_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_6x5_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_6x6_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_8x5_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_8x6_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_8x8_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_10x5_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_10x6_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_10x8_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_10x10_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_12x10_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_12x12_UNORM_Format,
            CompressedPixelFormat.RGBA_ASTC_4x4_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_5x4_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_5x5_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_6x5_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_6x6_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_8x5_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_8x6_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_8x8_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_10x5_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_10x6_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_10x8_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_10x10_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_12x10_SRGB_Format,
            CompressedPixelFormat.RGBA_ASTC_12x12_SRGB_Format,
        );
    }
}

export function setupWebGPUCapabilities(
    d: any,
    info: TextureCompressionSupportedInfo,
    parameters: RendererParameters,
): void {
    const device: GPUDevice = d;
    Capabilities.IS_WEBGL2 = true; // WebGPU is always considered as WebGL2 for compatibility.
    Capabilities.PRECISION = parameters.precision !== undefined ? parameters.precision : 'highp';
    Capabilities._IS_SUPPORT_HIGH_FLOAT = true;
    Capabilities._IS_SUPPORT_MEDIUM_FLOAT = true;
    Capabilities.MAX_PRECISION = 'highp';

    Capabilities.MAX_VERTEX_TEXTURES = device.limits.maxSampledTexturesPerShaderStage;
    Capabilities.MAX_TEXTURE_SIZE = device.limits.maxTextureDimension2D;
    Capabilities.MAX_CUBEMAP_SIZE = device.limits.maxTextureDimension2D;

    Capabilities.MAX_ATTRIBUTES = device.limits.maxVertexAttributes;
    Capabilities.MAX_VERTEX_UNIFORMS = device.limits.maxUniformBuffersPerShaderStage;
    Capabilities.MAX_VARYINGS = device.limits.maxInterStageShaderVariables;
    Capabilities.MAX_FRAGMENT_UNIFORMS = device.limits.maxUniformBuffersPerShaderStage;
    Capabilities.MAX_TEXTURES = device.limits.maxSampledTexturesPerShaderStage;
    Capabilities.MAX_COMBINED_TEXTURE_IMAGE_UNITS = device.limits.maxSampledTexturesPerShaderStage;

    Capabilities.IS_SUPPORT_VERTEX_TEXTURES = true;
    Capabilities.IS_SUPPORT_FLOAT_FRAGMENT_TEXTURES = true;
    Capabilities.IS_SUPPORT_FLOAT_VERTEX_TEXTURES = true;
    Capabilities.MAX_SAMPLES = 4;
    Capabilities.IS_SUPPORT_VAO = false;
    Capabilities.IS_SUPPORT_INSTANCE = true;
    Capabilities.MAX_ANISOTROPY = 16;
    Capabilities.IS_SUPPORT_DEPTH_TEXTURE = true;
    Capabilities.IS_SUPPORT_SHADER_TEXTURE_LOD = true;
    setupWebGPUCompressedTextureCapabilities(info);
}
