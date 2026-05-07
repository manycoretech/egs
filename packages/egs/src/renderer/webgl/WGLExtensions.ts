export enum WebGLExtEnums {
    WEBGL_lose_context = 'WEBGL_lose_context',
    WEBGL_debug_renderer_info = 'WEBGL_debug_renderer_info',
    ANGLE_instanced_arrays = 'ANGLE_instanced_arrays',
    OES_texture_float = 'OES_texture_float',
    OES_texture_half_float = 'OES_texture_half_float',
    OES_texture_float_linear = 'OES_texture_float_linear',
    OES_texture_half_float_linear = 'OES_texture_half_float_linear',
    OES_standard_derivatives = 'OES_standard_derivatives',
    OES_vertex_array_object = 'OES_vertex_array_object',
    OES_element_index_uint = 'OES_element_index_uint',
    WEBGL_depth_texture = 'WEBGL_depth_texture',
    WEBGL_color_buffer_float = 'WEBGL_color_buffer_float',
    WEBGL_draw_buffers = 'WEBGL_draw_buffers',
    EXT_texture_filter_anisotropic = 'EXT_texture_filter_anisotropic',
    EXT_shader_texture_lod = 'EXT_shader_texture_lod',
    EXT_color_buffer_half_float = 'EXT_color_buffer_half_float',
    EXT_color_buffer_float = 'EXT_color_buffer_float',
    EXT_frag_depth = 'EXT_frag_depth',
    EXT_sRGB = 'EXT_sRGB',
    EXT_blend_minmax = 'EXT_blend_minmax',
    WEBGL_compressed_texture_s3tc = 'WEBGL_compressed_texture_s3tc',
    WEBGL_compressed_texture_astc = 'WEBGL_compressed_texture_astc',
    WEBGL_compressed_texture_etc1 = 'WEBGL_compressed_texture_etc1',
    WEBGL_compressed_texture_etc = 'WEBGL_compressed_texture_etc',
    WEBGL_compressed_texture_pvrtc = 'WEBGL_compressed_texture_pvrtc',
    EXT_texture_compression_bptc = 'EXT_texture_compression_bptc'
}

const EXTENSION_LIST = Object.keys(WebGLExtEnums);

// WGLExtensions is a static class provides a feature with only one instance
// which check if an extension is supported by the browser or hardware.
export class WGLExtensions {
    public _extensions: { [index: string]: any } = {};

    public get(name: WebGLExtEnums) {
        return this._extensions[name];
    }

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
        for (let i = 0; i < EXTENSION_LIST.length; i++) {
            const extName = EXTENSION_LIST[i];
            let ext = gl.getExtension(extName);
            if (!ext) {
                ext = gl.getExtension('MOZ_' + extName);
            }
            if (!ext) {
                ext = gl.getExtension('WEBKIT_' + extName);
            }
            this._extensions[extName] = ext;
        }
    }
}
