import { type WGLExtensions, WebGLExtEnums } from './WGLExtensions';
import type { RendererParameters } from '../IRenderer';
import { CompressTextureType } from '../../utils/Constants';
import { logger } from '../../utils/Logger';
import { Capabilities } from '../Capabilities';

/**
 * @deprecated use Capabilities instead.
 */
export { Capabilities as WGLCapabilities };

// This will set the capabilities with defaults when context is initialized.
export function setupWebGLCapabilities(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    parameters: RendererParameters,
    extensions: WGLExtensions,
): void {
    Capabilities.IS_WEBGL2 =
        typeof WebGL2RenderingContext !== 'undefined' ? gl instanceof WebGL2RenderingContext : false;
    Capabilities.PRECISION = parameters.precision !== undefined ? parameters.precision : 'highp';
    // getShaderPrecisionFormat has been patched
    Capabilities._IS_SUPPORT_HIGH_FLOAT =
        (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)?.precision ?? 0) > 0 &&
        (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ?? 0) > 0;
    Capabilities._IS_SUPPORT_MEDIUM_FLOAT =
        (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT)?.precision ?? 0) > 0 &&
        (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT)?.precision ?? 0) > 0;
    Capabilities.MAX_PRECISION = Capabilities.getMaxPrecision(Capabilities.PRECISION);

    if (Capabilities.MAX_PRECISION !== Capabilities.PRECISION) {
        logger.unsupported(
            '' + Capabilities.PRECISION + 'not supported, using' + Capabilities.MAX_PRECISION + 'instead.',
        );
        Capabilities.PRECISION = Capabilities.MAX_PRECISION;
    }

    Capabilities.MAX_VERTEX_TEXTURES = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    Capabilities.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    Capabilities.MAX_CUBEMAP_SIZE = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);

    Capabilities.MAX_ATTRIBUTES = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    Capabilities.MAX_VERTEX_UNIFORMS = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    Capabilities.MAX_VARYINGS = gl.getParameter(gl.MAX_VARYING_VECTORS);
    Capabilities.MAX_FRAGMENT_UNIFORMS = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    Capabilities.MAX_TEXTURES = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    Capabilities.MAX_COMBINED_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);

    Capabilities.IS_SUPPORT_VERTEX_TEXTURES = Capabilities.MAX_VERTEX_TEXTURES > 0;
    Capabilities.IS_SUPPORT_FLOAT_FRAGMENT_TEXTURES =
        Capabilities.IS_WEBGL2 || !!extensions.get(WebGLExtEnums.OES_texture_float);
    Capabilities.IS_SUPPORT_FLOAT_VERTEX_TEXTURES =
        Capabilities.IS_SUPPORT_VERTEX_TEXTURES && Capabilities.IS_SUPPORT_FLOAT_FRAGMENT_TEXTURES;
    Capabilities.MAX_SAMPLES = Capabilities.IS_WEBGL2 ? gl.getParameter((gl as WebGL2RenderingContext).MAX_SAMPLES) : 0;
    Capabilities.IS_SUPPORT_VAO =
        Capabilities.IS_WEBGL2 || extensions.get(WebGLExtEnums.OES_vertex_array_object) !== null;
    Capabilities.IS_SUPPORT_INSTANCE =
        Capabilities.IS_WEBGL2 || extensions.get(WebGLExtEnums.ANGLE_instanced_arrays) !== null;
    Capabilities.IS_SUPPORT_DEPTH_TEXTURE =
        Capabilities.IS_WEBGL2 || extensions.get(WebGLExtEnums.WEBGL_depth_texture) !== null;
    Capabilities.IS_SUPPORT_SHADER_TEXTURE_LOD =
        Capabilities.IS_WEBGL2 || extensions.get(WebGLExtEnums.EXT_shader_texture_lod) !== null;
    Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES = [];

    const extension = extensions.get(WebGLExtEnums.EXT_texture_filter_anisotropic);
    if (extension !== null) {
        Capabilities.MAX_ANISOTROPY = gl.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    } else {
        Capabilities.MAX_ANISOTROPY = 0;
    }

    // compressed textures
    if (extensions.get(WebGLExtEnums.WEBGL_compressed_texture_s3tc)) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.push(CompressTextureType.S3TC);
    }
    if (extensions.get(WebGLExtEnums.EXT_texture_compression_bptc)) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.push(CompressTextureType.BPTC);
    }
    if (extensions.get(WebGLExtEnums.WEBGL_compressed_texture_pvrtc)) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.push(CompressTextureType.PVRTC);
    }
    if (extensions.get(WebGLExtEnums.WEBGL_compressed_texture_etc)) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.push(CompressTextureType.ETC2);
    }
    if (extensions.get(WebGLExtEnums.WEBGL_compressed_texture_astc)) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.push(CompressTextureType.ASTC);
    }
    if (Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES.length) {
        Capabilities.SUPPORTED_COMPRESS_TEXTURE_FORMATS = gl.getParameter(gl.COMPRESSED_TEXTURE_FORMATS);
    }
}
