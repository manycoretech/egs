import { type WGLExtensions, WebGLExtEnums } from './WGLExtensions';
import { WGLCapabilities } from './WGLCapabilities';
import { TextureDataType } from '../../utils/Constants';

export class WGLConstantsConvertor {
    static convertTextureDataType(gl: WebGLRenderingContext | WebGL2RenderingContext, p: TextureDataType, extensions: WGLExtensions): number {
        let extension: any;

        if (p === TextureDataType.UnsignedByteType) {
            return gl.UNSIGNED_BYTE;
        }
        if (p === TextureDataType.UnsignedShort4444Type) {
            return gl.UNSIGNED_SHORT_4_4_4_4;
        }
        if (p === TextureDataType.UnsignedShort5551Type) {
            return gl.UNSIGNED_SHORT_5_5_5_1;
        }
        if (p === TextureDataType.UnsignedShort565Type) {
            return gl.UNSIGNED_SHORT_5_6_5;
        }

        if (p === TextureDataType.ByteType) {
            return gl.BYTE;
        }
        if (p === TextureDataType.ShortType) {
            return gl.SHORT;
        }
        if (p === TextureDataType.UnsignedShortType) {
            return gl.UNSIGNED_SHORT;
        }
        if (p === TextureDataType.IntType) {
            return gl.INT;
        }
        if (p === TextureDataType.UnsignedIntType) {
            return gl.UNSIGNED_INT;
        }
        if (p === TextureDataType.FloatType) {
            return gl.FLOAT;
        }

        if (p === TextureDataType.HalfFloatType) {
            if (WGLCapabilities.IS_WEBGL2) {
                return (gl as WebGL2RenderingContext).HALF_FLOAT;
            }
            extension = extensions.get(WebGLExtEnums.OES_texture_half_float);
            if (extension !== null) {
                return extension.HALF_FLOAT_OES;
            }
        }

        if (p === TextureDataType.UnsignedInt248Type) {
            if (WGLCapabilities.IS_WEBGL2) {
                return (gl as WebGL2RenderingContext).UNSIGNED_INT_24_8;
            }
            extension = extensions.get(WebGLExtEnums.WEBGL_depth_texture);
            if (extension !== null) {
                return extension.UNSIGNED_INT_24_8_WEBGL;
            }
        }

        if (p === TextureDataType.UnsignedInt2101010Type) {
            if (WGLCapabilities.IS_WEBGL2) {
                return (gl as WebGL2RenderingContext).UNSIGNED_INT_2_10_10_10_REV;
            }
        }
        return 0;
    }
}
