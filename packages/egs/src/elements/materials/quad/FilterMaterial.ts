import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import type { Texture } from '../../textures/Texture';
import { materialProperty } from '../../../ContentAPI';
import type { Nullable } from '../../../utils/Utils';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { Vector3 } from '../../../math/Vector3';

/**
 * Target region selected by a filter material.
 */
export enum FilterTarget {
    All,
    Foreground,
    Background
}

export class FilterMaterial extends PassQuadMaterialBase {
    transparent = false;

    @materialProperty()
    tDiffuse: Texture;
    @materialProperty()
    depth: Nullable<Texture> = null;
    @materialProperty()
    temperature = 0;
    @materialProperty()
    tint = 0;
    @materialProperty()
    brightness = 20;
    @materialProperty()
    contrast = 12;
    @materialProperty()
    saturation = 36;
    @materialProperty()
    hue = 0;
    @materialProperty()
    colorBalance = new Vector3(0.0, 0.0, 0.0);
    @materialProperty()
    texture: Nullable<Texture> = null;
    @materialProperty()
    lut: Nullable<Texture> = null;
    @materialProperty()
    target: FilterTarget = FilterTarget.All;

    className() {
        return 'FilterMaterial';
    }

    generateShaderKey(r: ShaderComponentRegistry) {
        const keyBuilder = HashKeyBuilder.getInstance()
            .raw(this.target)
            .hasItem(this.depth)
            .bool(!!this.brightness)
            .bool(!!this.contrast)
            .bool(!!this.saturation)
            .bool(!!this.temperature)
            .bool(!!this.hue)
            .bool(!!this.tint)
            .hasItem(this.lut)
            .hasItem(this.texture);
        return super.generateShaderKey(r) + keyBuilder.getKey();
    }

    extendShaderShading(b: ShaderBuilder) {
        if (this.texture !== null) {
            b.addUniform('map', WebGLShaderDataType.Sampler2D);
        }

        if (this.lut !== null) {
            b.addUniform('lut', WebGLShaderDataType.Sampler2D)
                .addFragmentCustom(lookup);
        }

        if (this.depth !== null) {
            b.addUniform('depth', WebGLShaderDataType.Sampler2D);
        }

        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('brightness', WebGLShaderDataType.Float)
            .addUniform('contrast', WebGLShaderDataType.Float)
            .addUniform('saturation', WebGLShaderDataType.Float)
            .addUniform('temperature', WebGLShaderDataType.Float)
            .addUniform('tint', WebGLShaderDataType.Float)
            .addUniform('hue', WebGLShaderDataType.Float)
            .addUniform('colorBalance', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                vec4 res = texture2D(tDiffuse, vUv);
                ${this.depth !== null && this.target !== FilterTarget.All ? `
                    vec4 d = texture2D(depth, vUv);
                    if (d.x ${this.target === FilterTarget.Foreground ? '==' : '!='} 1.) {
                        gl_FragColor = res;
                        return;
                    }
                ` : ``}

                vec3 color = res.rgb;
                ${!!this.temperature ? `
                    vec3 temperatureFilter = temperature > 0.0 ? vec3(1.06, 0.93, 0.82) : vec3(0.99, 1.02, 1.25);
                    color = saturate(mix(color, color * temperatureFilter, abs(temperature)));
                ` : ``}
                ${!!this.tint ? `
                    vec3 tintFilter = tint > 0.0 ? vec3(1.05, 0.90, 1.05) : vec3(0.90, 1.10, 0.90);
                    color = saturate(mix(color, color * tintFilter, abs(tint)));
                ` : ``}
                ${!!this.brightness ? `
                    color = saturate(color + brightness);
                ` : ``}
                ${!!this.contrast ? `
                    color = saturate((color - 0.5) / (1.0 + contrast * (contrast > 0.0 ? -1.0 : 1.0)) + 0.5);
                ` : ``}
                ${!!this.saturation ? `
                    float rgbMax = max(max(color.r, color.g), color.b);
                    float rgbMin = min(min(color.r, color.g), color.b);
                    float delta = rgbMax - rgbMin;
                    float total = rgbMax + rgbMin;

                    // HSL
                    float L = total / 2.0;
                    float S =  delta / (L < 0.5 ? total : (2.0 - total));

                    if (total != 0.0 && total != 2.0) {
                        if (saturation < 0.0) {
                            color = vec3(L) + (color - vec3(L)) * (1.0 + saturation);
                        } else {
                            float alpha;
                            if (saturation + S >= 1.0) {
                                alpha = S;
                            } else {
                                alpha = 1.0 - saturation;
                            }
                            alpha = 1.0 / alpha - 1.0;
                            color = color + (color - vec3(L)) * alpha;
                        }
                    }
                    color = saturate(color);
                ` : ``}

                ${!!this.hue ? `
                    float s = sin(-hue);
                    float c = cos(-hue);
                    color = (color * c) + (color * s) *
                        mat3(
                            vec3(0.167444, 0.329213, -0.496657),
                            vec3(-0.327948, 0.035669, 0.292279),
                            vec3(1.250268, -1.047561, -0.202707)
                        ) +
                        dot(vec3(0.299, 0.587, 0.114), color) * (1.0 - c);
                    color = saturate(color);
                ` : ''}

                // colorBalance
                color = saturate(color + colorBalance / 255.);

                ${this.lut !== null ? `
                    color.rgb = saturate(lookup(color));
                ` : ``}

                gl_FragColor = vec4(color, res.a);

                ${this.texture !== null ? `
                    vec4 tex = texture2D(map, vUv);
                    gl_FragColor = gl_FragColor * tex;
                ` : ``}
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDiffuse', this.tDiffuse);
        program.setUniform('temperature', this.temperature * 0.01, true);
        program.setUniform('tint', this.tint * 0.01, true);
        program.setUniform('brightness', this.brightness * 0.01, true);
        program.setUniform('contrast', this.contrast * 0.01, true);
        program.setUniform('saturation', this.saturation * 0.01, true);
        program.setUniform('hue', this.hue, true);
        program.setUniform('colorBalance', this.colorBalance);
        if (this.depth !== null) {
            program.setTexture2D('depth', this.depth);
        }
        if (this.texture !== null) {
            program.setTexture2D('map', this.texture);
        }
        if (this.lut !== null) {
            program.setTexture2D('lut', this.lut);
        }
    }
}

const lookup = `
vec3 lookup(in vec3 color) {
    mediump float blueColor = color.b * 63.0;

    vec2 quad1;
    quad1.y = floor(floor(blueColor) / 8.0);
    quad1.x = floor(blueColor) - (quad1.y * 8.0);

    vec2 quad2;
    quad2.y = floor(ceil(blueColor) / 8.0);
    quad2.x = ceil(blueColor) - (quad2.y * 8.0);

    vec2 texPos1;
    texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.r);
    texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.g);

    vec2 texPos2;
    texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.r);
    texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * color.g);

    lowp vec4 newColor1 = texture2D(lut, texPos1);
    lowp vec4 newColor2 = texture2D(lut, texPos2);
    lowp vec4 newColor = mix(newColor1, newColor2, fract(blueColor));
    return newColor.rgb;
}
`;
