import { logger } from '../../utils/Logger';

// WGLShader contains a static function to createShader in WebGL it.
// and logger can record the shaders' information when error appears during compiling process.
export class WGLShader {
    private static reformatShaderStyle(string: string): string {
        const lines = string.split('\n');
        for (let i = 0; i < lines.length; i++) {
            lines[i] = i + 1 + ': ' + lines[i];
        }
        return lines.join('\n');
    }

    static createWebGLShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, string: string) {
        const shader = gl.createShader(type)!;
        if (shader === null) {
            logger.webglError('EGS webgl shader create failed');
        }
        gl.shaderSource(shader, string);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === false) {
            logger.webglError("EGS.WebGLShader: Shader couldn't compile.");
        }
        if (gl.getShaderInfoLog(shader) !== '') {
            logger.webglError(
                'EGS.WebGLShader: gl.getShaderInfoLog()' +
                    (type === gl.VERTEX_SHADER ? 'vertex' : 'fragment') +
                    gl.getShaderInfoLog(shader) +
                    WGLShader.reformatShaderStyle(string),
            );
        }
        return shader;
    }
}
