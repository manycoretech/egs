import { Material } from '../Material.js';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import {
    type ShaderBuilder,
    ShaderVaryingTypes,
    ShaderInjectionTypes,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import type { Texture } from '../../textures/Texture.js';
import { Vector4 } from '../../../math/Vector4.js';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms.js';
import type { TextureCube } from '../../textures/TextureCube.js';
import { readonlyMath } from '../../../math/Readonly.js';
import { Utils } from '../../../utils/Utils.js';
import { ContentBridge, materialProperty, materialPropertyDeclare } from '../../../ContentAPI.js';
import type { TextureV2 } from '../../textures/TextureV2.js';

abstract class PanoBackGroundMaterial extends Material {
    extendShaderShape(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder
            .addGlobalUniform(BuiltInUniformTypes.projectionMatrix)
            .addGlobalUniform(BuiltInUniformTypes.modelViewMatrix)
            .inject(
                ShaderInjectionTypes.gl_Position,
                `
            mvPosition = modelViewMatrix * vec4(position.x, position.z, position.y, 1.0 );
            gl_Position = projectionMatrix * mvPosition;
            gl_Position.z = gl_Position.w; // set z to camera.far
            `,
            );
    }
    computeShapeKey(_: ShaderComponentRegistry) {
        // PanoBackGroundMaterial
        return 'cpb';
    }

    updateShapeUniforms(_1: WGLProgram, _: ShaderComponentRegistry) {}
}

/**
 * Per-model color and depth parameters for panoramic environment materials.
 */
export class ModelParameter {
    static shaderStruct = `
    struct ColorParams {
        vec4 color;
        float depth;
    };
    `;

    static shaderEffect = `
    vec4 applySelectEffect(vec4 color, ColorParams params) {
        return vec4(color.xyz * params.color.a + params.color.xyz * (1.0 - params.color.a), 1.0);
    }
    `;

    color = new Vector4(1, 1, 1, 0.5);
    depth = 0;

    updateUniforms(program: WGLProgram, prefix: string) {
        program.setUniform(prefix + '.color', this.color);
        program.setUniform(prefix + '.depth', this.depth);
    }
}
/**
 * This class is used to update parameter for {@link PanoEnvMapMaterial | PanoEnvMapMaterial }.
 */
export class GlobalParams {
    brightness = 0;
    contrast = 0;
    saturation = 0;
    hue = 0;
    b = 1;
    r = 1;
    g = 1;

    updateUniforms(program: WGLProgram, prefix: string) {
        program.setUniform(prefix + '.brightness', this.brightness);
        program.setUniform(prefix + '.contrast', this.contrast);
        program.setUniform(prefix + '.saturation', this.saturation);
        program.setUniform(prefix + '.hue', this.hue);
        program.setUniform(prefix + '.r', this.r);
        program.setUniform(prefix + '.g', this.g);
        program.setUniform(prefix + '.b', this.b);
    }
}

/**
 * Material that renders selection identifiers from a cube-map background.
 */
export class PanoSelectionMaterial<T extends TextureCube | TextureV2 = TextureCube> extends PanoBackGroundMaterial {
    @materialProperty()
    indexBackground: T;

    className(): string {
        return 'PanoSelectionMaterial';
    }

    extendShaderShading(b: ShaderBuilder, _: ShaderComponentRegistry) {
        b.addUniform('indexBackground', WebGLShaderDataType.SamplerCube)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                vec3 direction = normalize( vWorldPosition );
                vec4 color = textureCube(indexBackground, direction);
                gl_FragColor = color;
            `,
            );
    }

    traverseTexture(visitor: (tex: Texture) => void) {
        super.traverseTexture(visitor);
        Utils.visitTexture([this.indexBackground], visitor);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture('indexBackground', this.indexBackground);
    }

    clone() {
        return new PanoSelectionMaterial<T>().copy(this);
    }

    copy(other: PanoSelectionMaterial<T>) {
        super.copyBase(other);
        return this;
    }
}

/**
 * Material that renders a panoramic environment map with selectable regions.
 */
export class PanoEnvMapMaterial<T extends TextureCube | TextureV2 = TextureCube> extends PanoBackGroundMaterial {
    @materialProperty()
    cubeMapBackground: T;
    @materialProperty()
    indexBackground: T;
    @materialProperty()
    selectedColorId = Number.MAX_SAFE_INTEGER;
    @materialProperty()
    hoverColor = readonlyMath.vec3(1, 1, 1);

    // updateGlobalParams() to upload to wasm
    @materialPropertyDeclare()
    private _globalParams: GlobalParams = new GlobalParams();
    // updateParams() to upload to wasm
    @materialPropertyDeclare()
    private _params: ModelParameter[] = [new ModelParameter()];

    get globalParams(): GlobalParams {
        return this._globalParams;
    }
    set globalParams(value: GlobalParams) {
        this._globalParams = value;
        this.updateGlobalParams(value);
    }
    updateGlobalParams(value: GlobalParams) {
        ContentBridge.materialSetProperty(this, 'globalParams', value);
    }
    get params(): ModelParameter[] {
        return this._params;
    }
    set params(value: ModelParameter[]) {
        this._params = value;
        this.updateParams(value);
    }
    updateParams(value: ModelParameter[]) {
        ContentBridge.materialSetProperty(this, 'params', value);
    }

    className(): string {
        return 'PanoEnvMapMaterial';
    }

    private readonly getColorIdShader = `
    float getColorId(vec4 color) {
        return (color.r + color.g * 256.0 + color.b * 256.0 * 256.0) * 255.0;
    }
    `;

    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        program.setTexture('cubeMapBackground', this.cubeMapBackground);
        program.setTexture('indexBackground', this.indexBackground);
        this.globalParams.updateUniforms(program, 'globalParams');
        this.params.forEach((p, i) => {
            p.updateUniforms(program, `params[${i}]`);
        });
        program.setUniform('selectedColorId', this.selectedColorId);
        program.setUniform('hoverColor', this.hoverColor);
    }

    traverseTexture(visitor: (tex: Texture) => void) {
        super.traverseTexture(visitor);
        Utils.visitTexture([this.cubeMapBackground, this.indexBackground], visitor);
    }

    generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + this.params.length;
    }

    extendShaderShading(b: ShaderBuilder, _: ShaderComponentRegistry) {
        b.addUniform('cubeMapBackground', WebGLShaderDataType.SamplerCube)
            .addUniform('indexBackground', WebGLShaderDataType.SamplerCube)
            .addUniform('selectedColorId', WebGLShaderDataType.Float)
            .addUniform('hoverColor', WebGLShaderDataType.Vec3)
            .addUniformStruct('globalParams', GlobalParams)
            .addUniformStructArray('params', ModelParameter, this.params.length)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addFragmentCustom(this.getColorIdShader)
            .addFragmentCustom(ModelParameter.shaderStruct)
            .addFragmentCustom(ModelParameter.shaderEffect)
            .addFragmentCustom(`
                struct GlobalParams {
                    float brightness;
                    float contrast;
                    float saturation;
                    float hue;
                    float b;
                    float r;
                    float g;
                };
                uniform ColorParams params[ ${this.params.length} ];
                uniform GlobalParams globalParams;
            `)
            .addFragmentCustom(includes)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
            vec3 direction = normalize( vWorldPosition );
            vec4 indexColor = textureCube( indexBackground, direction );
            float result = getColorId(indexColor);
            vec4 color = textureCube( cubeMapBackground, direction );

            for (int i = 0; i < ${this.params.length}; i++) {
                if (abs(params[i].depth - result) < 1.0) {
                    color = applySelectEffect(color, params[i]);
                    break;
                }
            }

            if (globalParams.brightness != 0.0 || globalParams.contrast != 0.0) {
                color = applyBrightness(color, globalParams.brightness, globalParams.contrast);
            }
            if (globalParams.hue != 0.0 || globalParams.saturation != 0.0) {
                color = applyHun(color, globalParams.hue, globalParams.saturation);
            }

            if (abs(result - selectedColorId) > 1.0) {
                gl_FragColor = vec4(color.r * globalParams.r, color.g * globalParams.g, color.b * globalParams.b, 1.0);
                return;
            }

            gl_FragColor = vec4(hoverColor, 1.0) * color;
            `,
            );
    }

    clone() {
        return new PanoEnvMapMaterial<T>();
    }

    copy(other: PanoEnvMapMaterial<T>) {
        super.copyBase(other);
        return this;
    }
}

const includes = `
int isMeshEdge(vec3 texCoord){
    float dis = 1.0;

    vec4 target = textureCube(
        indexBackground,
        texCoord
    );

    return abs(getColorId(target) - selectedColorId) > dis ? 1 : 0;
}

vec4 applyGamma(vec4 color,float gamma){
  return vec4(
      pow(color.r, gamma),
      pow(color.g, gamma),
      pow(color.b, gamma),
      color.a
  );
}

vec4 applyBrightness(vec4 color, float brightness, float contrast){
  color.rgb += brightness;
  if (contrast > 0.0) {
  color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
  } else {
  color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
  }
  return color;
}

vec4 applyHun(vec4 color , float hun, float saturation){
  float angle = hun * 3.14159265;
  float s = sin(angle), c = cos(angle);
  vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
  float len = length(color.rgb);
  color.rgb = vec3(
  dot(color.rgb, weights.xyz),
  dot(color.rgb, weights.zxy),
  dot(color.rgb, weights.yzx)
  );

  float average = (color.r + color.g + color.b) / 3.0;
  if (saturation > 0.0) {
  color.rgb += (average - color.rgb) * (1.0 - 1.0 / (1.001 - saturation));
  } else {
  color.rgb += (average - color.rgb) * (-saturation);
  }
  return color;
}
`;
