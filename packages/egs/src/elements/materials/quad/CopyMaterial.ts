import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderInjectionTypes, ShaderExtensionTypes, ShaderBuilder, ShaderVaryingTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { Blending } from '../../../utils/Constants';
import { Texture } from '../../textures/Texture';
import { Matrix3 } from '../../../math/Matrix3';
import { materialProperty } from '../../../ContentAPI';

export class CopyMaterial extends PassQuadMaterialBase {
    @materialProperty()
    public tDiffuse: Texture;
    @materialProperty()
    public opacity = 1;
    @materialProperty()
    public isRepeat = true;
    @materialProperty()
    public matrix = new Matrix3();

    public className() {
        return 'CopyMaterial';
    }

    public extendShaderShape(builder: ShaderBuilder) {
        builder.addVarying(ShaderVaryingTypes.fragUV)
            .addUniform('uvTransform', WebGLShaderDataType.Mat3)
            .inject(ShaderInjectionTypes.vary_uv, 'vUv = (uvTransform * vec3(uv, 1.)).xy;')
            .inject(ShaderInjectionTypes.gl_Position, 'gl_Position = vec4(position, 1.0);');
    }

    public extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('opacity', WebGLShaderDataType.Float)
            .addUniform('uIsRepeat', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.gl_FragColor, `
            if (uIsRepeat < 0.5 && (vUv.x > 1.0 || vUv.x < 0.0 || vUv.y > 1.0 || vUv.y < 0.0)) {
                discard;
            }
            gl_FragColor = opacity * texture2D(tDiffuse, vUv);
            `);
    }

    public updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDiffuse', this.tDiffuse);
        program.setUniform('opacity', this.opacity);
    }

    public updateShapeUniforms(p: WGLProgram) {
        p.setUniform('uvTransform', this.matrix);
        p.setUniform('uIsRepeat', this.isRepeat ? 1.0 : 0.0);
    }
}

export class CopyColorAndDepthMaterial extends CopyMaterial {
    @materialProperty()
    public depth: Texture;
    public depthTest = true;
    public depthWrite = true;

    public className() {
        return 'CopyColorAndDepthMaterial';
    }

    public extendShaderShading(b: ShaderBuilder) {
        super.extendShaderShading(b);
        b
            .addUniform('tDepth', WebGLShaderDataType.Sampler2D)
            .addExtension(ShaderExtensionTypes.GL_EXT_frag_depth)
            .inject(ShaderInjectionTypes.gl_FragDepthEXT, 'gl_FragDepthEXT = texture2D(tDepth, vUv).x;');
    }

    public updateShadingUniforms(program: WGLProgram) {
        super.updateShadingUniforms(program);
        program.setTexture2D('tDepth', this.depth);
    }
}

export class MixColorAndDepthMaterial extends CopyMaterial {
    @materialProperty()
    public depth: Texture;

    public blending = Blending.NoBlending;

    public className() {
        return 'MixColorAndDepthMaterial';
    }

    public extendShaderShading(b: ShaderBuilder) {
        super.extendShaderShading(b);
        b
            .addUniform('tDepth', WebGLShaderDataType.Sampler2D)
            .inject(ShaderInjectionTypes.gl_FragColor, `
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
            `);
    }

    public updateShadingUniforms(program: WGLProgram) {
        super.updateShadingUniforms(program);
        program.setTexture2D('tDepth', this.depth);
    }

}

export class CopyDepthMaterial extends PassQuadMaterialBase {
    @materialProperty()
    public depth: Texture;
    public depthTest = true;
    public depthWrite = true;
    public colorWrite = false;

    public className() {
        return 'CopyDepthMaterial';
    }

    public extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDepth', WebGLShaderDataType.Sampler2D)
            .addExtension(ShaderExtensionTypes.GL_EXT_frag_depth)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragDepthEXT = texture2D(tDepth, vUv).x;');
    }

    public updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDepth', this.depth);
    }
}
