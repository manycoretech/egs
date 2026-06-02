import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderBuilder, ShaderVaryingTypes, ShaderInjectionTypes, ShaderAttributeTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { ShaderComponent } from '../../../renderer/shader/Shader';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { MaterialParameters, ConvertMaterialParameters } from '../Material';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { Renderer } from '../../../renderer/Renderer';
import { Utils } from '../../../utils/Utils';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { readonlyMath } from '../../../math/Readonly';
import { materialProperty, shaderComponentInMaterial } from '../../../ContentAPI';
import { SceneClipMaterial } from '../base';

export type LineBasicMaterialParameters = MaterialParameters & ColorWithAlphaParam;
/**
 * Give linear object a specific color.
 */
export class LineBasicMaterial extends SceneClipMaterial {
    /**
     * The name of instance's class.
     */
    className() {
        return 'LineBasicMaterial';
    }

    constructor(p?: LineBasicMaterialParameters) {
        super();
        this.setValues(p);
    }
    /**
     * Let color become to gradient from one end to another end.
     */
    @materialProperty()
    enableVertexColor = false;
    /**
     * @deprecated
     */
    bias = 0;
    /**
     * The basic color of lines.
     * @tips change the color by {@link setValues| setValues()} that is a better way.
     */
    @shaderComponentInMaterial()
    readonly color = new ColorWithAlpha();
    /**
     * Generate a key to make engine know user changes attribute {@link enableVertexColor| enableVertexColor}.
     * This method may override in extended class.
     */
    generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + this.enableVertexColor;
    }
    /**
     * Change the corresponding attribute according to the values of given {@link LineBasicMaterialParameters| parameters}.
     * @param {LineBasicMaterialParameters} values a object of specified type contains parameters.
     */
    setValues(values?: LineBasicMaterialParameters) {
        if (values === undefined) {
            return;
        }
        super.setValues(values);
        this.color.setValues(values);
    }
    /**
     * @internal
     */
    updateShadingUniforms(program: WGLProgram): void {
        if (!this.enableVertexColor) {
            this.color.updateShadingUniforms(program);
        }
    }

    /**
     * @internal
     */
    extendShaderShading(b: ShaderBuilder, _r: ShaderComponentRegistry) {
        b
            .when(this.enableVertexColor, b => b.addVarying(ShaderVaryingTypes.vertexColor)
                .inject(ShaderInjectionTypes.channel_color, 'color.rgb  *= vColor;')
                .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(color, 1.0);')
            )
            .when(!this.enableVertexColor, b => b.extend(this.color));
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<LineBasicMaterial>(['color', 'enableVertexColor']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<LineBasicMaterial>(['color', 'enableVertexColor']);
    }
    /**
     * Copy the data to this instance from other instance.
     * @param {LineBasicMaterial} other the source of copied data.
     */
    copy(other: LineBasicMaterial) {
        super.copyBase(other);
        this.color.copy(other.color);
        return this;
    }
    /**
     * Return a cloned instance of this class.
     */
    clone() {
        return new LineBasicMaterial().copy(this);
    }
}

export type LineDashedMaterialParameters = LineBasicMaterialParameters
    & Partial<Pick<LineDashedMaterial, 'enableViewIndependentDashScale'>>
    & LineDashParam;
/**
 * Draw the line with some segments. The color attribute extends from {@link LineBasicMaterial| LineBasicMaterial}.
 */
export class LineDashedMaterial extends LineBasicMaterial {
    /**
     * The name of instance's class.
     */
    className() {
        return 'LineDashedMaterial';
    }
    constructor(p?: LineDashedMaterialParameters) {
        super();
        this.setValues(p);
    }
    /**
     * Use this instance to set dash's length.
     */
    @shaderComponentInMaterial()
    dash = new LineDash();
    /**
     * If this value is set to true, this object's scale do not change with zoom of camera.
     * @defaultValue `false`
     */
    @materialProperty()
    enableViewIndependentDashScale = false;
    /**
     * Change the corresponding attribute according to the values of given {@link LineDashedMaterialParameters| parameters}.
     * @param {LineDashedMaterialParameters} values a object of specified type contains parameters.
     */
    setValues(values?: LineDashedMaterialParameters) {
        if (values === undefined) {
            return;
        }
        super.setValues(values);
        this.dash.setValues(values);
    }
    /**
     * @internal
     */
    extendShaderShape(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        super.extendShaderShape(builder, _);
        builder.extend(this.dash);
    }
    /**
     * @internal
     */
    computeShapeKey(_: ShaderComponentRegistry) {
        // LineDashedMaterial
        return super.computeShapeKey(_) + 'd';
    }
    /**
     * @internal
     */
    updateShapeUniforms(p: WGLProgram, _: ShaderComponentRegistry) {
        this.dash.updateShadingUniforms(p);
    }
    /**
     * This method will be used automatically before
     * @param {Renderer} renderer instance of renderer for engine.
     */
    onBeforeRender = (renderer: Renderer) => {
        if (!this.enableViewIndependentDashScale) {
            return;
        }
        const camera = renderer.getCurrentCamera();
        const object = renderer.getCurrentDrawable();
        this.dash.viewScale = camera.getViewIndependentScaleRatio(object.z, renderer.getDrawingBufferSize().height);
    };
    /**
     * Copy the data to this instance from other instance.
     * @param {LineDashedMaterial} other the source of copied data.
     */
    copy(other: LineDashedMaterial) {
        super.copy(other);
        this.dash.copy(other.dash);
        return this;
    }
    /**
     * Return a cloned instance of this class.
     */
    clone() {
        return new LineDashedMaterial().copy(this);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<LineDashedMaterial>(['dash']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<LineDashedMaterial>(['dash']);
    }
}

export type ColorWithAlphaParam = ConvertMaterialParameters<Pick<ColorWithAlpha, 'color' | 'opacity'>>;

const colorWithAlphaKeys = ['color', 'opacity'];
/**
 * This class give a simple shading method for the objects which does not need complicated shading,
 * such as {@link PointsMaterial| PointsMaterial}, {@link FatLineMaterial| FatLineMaterial} and {@link LineBasicMaterial| LineBasicMaterial}.
 */
export class ColorWithAlpha extends ShaderComponent {
    /**
     * Determine the color's rgb.
     */
    @materialProperty()
    color = readonlyMath.color();
    /**
     * Determine the alpha of color's rgba.
     */
    @materialProperty()
    opacity = 1;
    /**
     * The name of instance's class.
     */
    className() {
        return 'ColorWithAlpha';
    }
    /**
     * Change the corresponding attribute according to the values of given {@link ColorWithAlphaParam| parameters}.
     * @param {ColorWithAlphaParam} values a object of specified type contains parameters.
     */
    setValues(param: ColorWithAlphaParam) {
        Utils.copyProperties(colorWithAlphaKeys, this, param);
    }
    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('color', WebGLShaderDataType.Vec3)
            .addUniform('opacity', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(color, opacity);');
    }
    /**
     * @internal
     */
    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('color', this.color);
        program.setUniform('opacity', this.opacity);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        ctx.puts<ColorWithAlpha>(['color', 'opacity']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        ctx.reads<ColorWithAlpha>(['color', 'opacity']);
    }
    /**
     * Copy the data to this instance from other instance.
     * @param {ColorWithAlpha} other the source of copied data.
     */
    copy(other: ColorWithAlpha) {
        this.color = other.color;
        this.opacity = other.opacity;
        return this;
    }
    /**
     * Return a cloned instance of this class.
     */
    clone() {
        return new ColorWithAlpha().copy(this);
    }
}
/**
 * @scale This parameter influence the length both of gaps and segments.
 * @gapSize This parameter influence the length of gaps.
 * @dashSize This parameter influence the length of segments.
 * @viewScale This parameter influence the length of one dash with one gap and segment.
 * This parameter commonly do not need user to set it.
 * It is automatically updated when the zoom of camera is changed.
 */
export type LineDashParam = ConvertMaterialParameters<Pick<LineDash, 'scale' | 'gapSize' | 'viewScale' | 'dashSize' | 'gapSize2' | 'dashSize2'>>;

const lineDashParamKeys = ['scale', 'gapSize', 'dashSize', 'viewScale', 'gapSize2', 'dashSize2'];
/**
 * This class is used to control the length of gaps and segments for dashed line material,
 * which includes {@link FatLineMaterial| FatLineMaterial} and {@link LineDashedMaterial| LineDashedMaterial}.
 */
export class LineDash extends ShaderComponent {
    /**
     * This parameter influence the length both of gaps and segments.
     */
    @materialProperty()
    scale = 1;
    /**
     * This parameter influence the length of gaps.
     */
    @materialProperty()
    gapSize = 2;
    /**
     * This parameter influence the length of segments.
     */
    @materialProperty()
    dashSize = 1;

    /**
     * secondary gap
     * @defaultValue 0
     */
    @materialProperty()
    gapSize2 = 0;

    /**
    * secondary dash
    * @defaultValue 0
    */
    @materialProperty()
    dashSize2 = 0;

    /**
     * This parameter influence the length of one dash with one gap and segment.
     * This parameter commonly do not need user to set it.
     * It is automatically updated when the zoom of camera is changed.
     */
    @materialProperty()
    viewScale = 1;

    /**
     * This material can not be used to instanced object.
     */
    useInstance = false;
    /**
     * The name of instance's class.
     */
    className() {
        return 'LineDash';
    }
    /**
     * Change the corresponding attribute according to the values of given {@link LineDashParam | parameters}.
     * @param {LineDashParam} values a object of specified type contains parameters.
     */
    setValues(param: LineDashParam) {
        Utils.copyProperties(lineDashParamKeys, this, param);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        ctx.puts<LineDash>(['scale', 'gapSize', 'dashSize', 'viewScale', 'gapSize2', 'dashSize2']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        ctx.reads<LineDash>(['scale', 'gapSize', 'dashSize', 'viewScale', 'gapSize2', 'dashSize2']);
    }
    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('scale', WebGLShaderDataType.Float)
            .addUniform('totalSize', WebGLShaderDataType.Float)
            .addUniform('gapSize', WebGLShaderDataType.Float)
            .addUniform('dashSize', WebGLShaderDataType.Float)
            .addUniform('dashSize2', WebGLShaderDataType.Float)
            .addVaryingCustom('vLineDistance', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.discard, DashDiscard);

        if (this.useInstance) {
            builder
                .addInstanceAttribute('instanceDistanceStart', WebGLShaderDataType.Float)
                .addInstanceAttribute('instanceDistanceEnd', WebGLShaderDataType.Float)
                .inject(ShaderInjectionTypes.vary_any, 'vLineDistance = ( position.y < 0.5 ) ? scale * instanceDistanceStart : scale * instanceDistanceEnd;');
        } else {
            builder
                .addDefaultAttribute(ShaderAttributeTypes.lineDistance)
                .inject(ShaderInjectionTypes.vary_any, 'vLineDistance = scale * lineDistance;');
        }
    }
    /**
     * @internal
     */
    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('scale', this.scale);
        program.setUniform('totalSize', (this.gapSize + this.dashSize + this.gapSize2 + this.dashSize2) * this.viewScale);
        program.setUniform('gapSize', this.gapSize * this.viewScale);
        program.setUniform('dashSize', this.dashSize * this.viewScale);
        program.setUniform('dashSize2', this.dashSize2 * this.viewScale);
    }
    /**
     * Copy the data to this instance from other instance.
     * @param {LineDash} other the source of copied data.
     */
    copy(other: LineDash) {
        this.scale = other.scale;
        this.gapSize = other.gapSize;
        this.dashSize = other.dashSize;
        this.gapSize2 = other.gapSize2;
        this.dashSize2 = other.dashSize2;
        this.viewScale = other.viewScale;
        return other;
    }
    /**
     * Return a cloned instance of this class.
     */
    clone() {
        return new LineDash().copy(this);
    }
}

const DashDiscard = `
float segment = mod( vLineDistance, totalSize );
if ( (segment > dashSize && segment < dashSize + gapSize) || segment > dashSize2 + dashSize + gapSize ) {
    discard;
}
`;
