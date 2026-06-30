import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import {
    type ShaderBuilder,
    ShaderInjectionTypes,
    ShaderVaryingTypes,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { Side } from '../../../utils/Constants.js';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry.js';
import { Utils } from '../../../utils/Utils.js';
import type { Texture } from '../../textures/Texture.js';
import { materialProperty } from '../../../ContentAPI.js';
import { BackgroundLikeMaterial } from '../base/index.js';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool.js';

export class EnvMapMaterial extends BackgroundLikeMaterial {
    @materialProperty()
    verticalRotation = 0.0;
    @materialProperty()
    horizonRotation = 0.0;
    @materialProperty()
    luma = 1.0;
    @materialProperty()
    tEquirect: Texture;
    @materialProperty()
    reverseVertical = false;
    @materialProperty()
    reverseHorizon = true;

    className() {
        return 'EnvMapMaterial';
    }

    constructor() {
        super();
        this.side = Side.BackSide;
        this.depthWrite = false;
        this.depthTest = false;
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setUniform('verticalRotation', this.verticalRotation);
        p.setUniform('horizonRotation', this.horizonRotation);
        p.setUniform('luma', this.luma);
        p.setTexture2D('tEquirect', this.tEquirect);
    }

    traverseTexture(visitor: (tex: Texture) => void) {
        super.traverseTexture(visitor);
        Utils.visitTexture([this.tEquirect], visitor);
    }

    generateShaderKey(r: ShaderComponentRegistry): string {
        return super.generateShaderKey(r) + this.reverseVertical + this.reverseHorizon;
    }

    extendShaderShading(builder: ShaderBuilder, _: any) {
        builder
            .addUniform('verticalRotation', WebGLShaderDataType.Float)
            .addUniform('horizonRotation', WebGLShaderDataType.Float)
            .addUniform('luma', WebGLShaderDataType.Float)
            .addUniform('tEquirect', WebGLShaderDataType.Sampler2D)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addFragment(ShaderBlockPool.QuaternionFunctions)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
            vec3 direction = normalize( applyQuat(backgroundRotation, vWorldPosition) );
            vec2 sampleUV;
            sampleUV.y = (asin( clamp( direction.z, - 1.0, 1.0 ) ) + verticalRotation) * RECIPROCAL_PI + 0.5;
            sampleUV.x = (atan( direction.y, direction.x ) + horizonRotation) * RECIPROCAL_PI2 + 0.5;
            ${this.reverseVertical ? 'sampleUV.y = 1.0 - sampleUV.y;' : ''}
            ${this.reverseHorizon ? '' : 'sampleUV.x = 1.0 - sampleUV.x;'}
            vec4 texColor = texture2D( tEquirect, sampleUV );
            gl_FragColor = vec4(luma * texColor.rgb, 1.0);
            `,
            );
    }

    copy() {
        return this;
    }

    clone() {
        return new EnvMapMaterial();
    }
}
