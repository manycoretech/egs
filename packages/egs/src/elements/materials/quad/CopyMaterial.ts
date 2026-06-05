import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import {
    ShaderInjectionTypes,
    ShaderExtensionTypes,
    type ShaderBuilder,
    ShaderVaryingTypes,
} from '../../../renderer/shader/builders/ShaderBuilder';
import { Blending } from '../../../utils/Constants';
import type { Texture } from '../../textures/Texture';
import { Matrix3 } from '../../../math/Matrix3';
import { materialProperty } from '../../../ContentAPI';

export class CopyMaterial extends PassQuadMaterialBase {
    @materialProperty()
    tDiffuse: Texture;
    @materialProperty()
    opacity = 1;
    @materialProperty()
    isRepeat = true;
    @materialProperty()
    matrix = new Matrix3();

    className() {
        return 'CopyMaterial';
    }

    extendShaderShape(builder: ShaderBuilder) {
        builder
            .addVarying(ShaderVaryingTypes.fragUV)
            .addUniform('uvTransform', WebGLShaderDataType.Mat3)
            .inject(ShaderInjectionTypes.vary_uv, 'vUv = (uvTransform * vec3(uv, 1.)).xy;')
            .inject(ShaderInjectionTypes.gl_Position, 'gl_Position = vec4(position, 1.0);');
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('opacity', WebGLShaderDataType.Float)
            .addUniform('uIsRepeat', WebGLShaderDataType.Float)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
            if (uIsRepeat < 0.5 && (vUv.x > 1.0 || vUv.x < 0.0 || vUv.y > 1.0 || vUv.y < 0.0)) {
                discard;
            }
            gl_FragColor = opacity * texture2D(tDiffuse, vUv);
            `,
            );
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDiffuse', this.tDiffuse);
        program.setUniform('opacity', this.opacity);
    }

    updateShapeUniforms(p: WGLProgram) {
        p.setUniform('uvTransform', this.matrix);
        p.setUniform('uIsRepeat', this.isRepeat ? 1.0 : 0.0);
    }
}

export class CopyColorAndDepthMaterial extends CopyMaterial {
    @materialProperty()
    depth: Texture;
    depthTest = true;
    depthWrite = true;

    className() {
        return 'CopyColorAndDepthMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        super.extendShaderShading(b);
        b.addUniform('tDepth', WebGLShaderDataType.Sampler2D)
            .addExtension(ShaderExtensionTypes.GL_EXT_frag_depth)
            .inject(ShaderInjectionTypes.gl_FragDepthEXT, 'gl_FragDepthEXT = texture2D(tDepth, vUv).x;');
    }

    updateShadingUniforms(program: WGLProgram) {
        super.updateShadingUniforms(program);
        program.setTexture2D('tDepth', this.depth);
    }
}

export class MixColorAndDepthMaterial extends CopyMaterial {
    @materialProperty()
    depth: Texture;

    blending = Blending.NoBlending;

    className() {
        return 'MixColorAndDepthMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        super.extendShaderShading(b);
        b.addUniform('tDepth', WebGLShaderDataType.Sampler2D).inject(
            ShaderInjectionTypes.gl_FragColor,
            `
                float originDepth = texture2D(tDepth, vUv).x;
                vec4 rgba = texture2D(tDiffuse, vUv);
                float d = 1.0 - originDepth;
                float res = 0.0;
                res += floor(d * 63.0);
                if(rgba.a > 0.001 && rgba.a < 0.167)rgba.a = 0.167;
                res += round(rgba.a * 3.0) * 64.0; // 0 ~ 0.333   1 ~ 0.833;
                if(rgba.a <0.001){
                    res = 0.0; // do it for alpha picking
                }
                gl_FragColor = vec4(rgba.rgb, res / 255.0);
            `,
        );
    }

    updateShadingUniforms(program: WGLProgram) {
        super.updateShadingUniforms(program);
        program.setTexture2D('tDepth', this.depth);
    }
}

export class CopyDepthMaterial extends PassQuadMaterialBase {
    @materialProperty()
    depth: Texture;
    depthTest = true;
    depthWrite = true;
    colorWrite = false;

    className() {
        return 'CopyDepthMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDepth', WebGLShaderDataType.Sampler2D)
            .addExtension(ShaderExtensionTypes.GL_EXT_frag_depth)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragDepthEXT = texture2D(tDepth, vUv).x;');
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDepth', this.depth);
    }
}
