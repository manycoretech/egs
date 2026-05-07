import { ShaderComponent } from '../Shader';
import { ShaderBuilder, ShaderInjectionTypes } from '../builders/ShaderBuilder';
import { WGLProgram } from '../../webgl/WGLProgram';
import { WebGLShaderDataType } from '../../webgl/WGLConstants';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { ConvertMaterialParameters } from '../../../elements/materials/Material';
import { Utils } from '../../../utils/Utils';
import { readonlyMath } from '../../../math/Readonly';
import { ContentBridge, materialProperty } from '../../../ContentAPI';

export enum SpottedType {
    dot = 0,
    diagonal
}

export type SpottedShaderComponentParameter = ConvertMaterialParameters<Pick<SpottedShaderComponent,
    'markerType' | 'markerColor' | 'markerSpacing' | 'diagonalProportion' | 'markerSize'>>;

const keys = ['markerType', 'markerColor', 'markerSpacing', 'diagonalProportion', 'markerSize'];

/**
 * SpottedShaderComponent controls the use of spotted effect.
 * Draw some grid-like points or lines on object.
 * This is coming from outside frontend team.
 */
export class SpottedShaderComponent extends ShaderComponent {
    constructor() {
        super();
        ContentBridge.shaderComponentCreateAttachable(this);
    }

    /**
     * Draw short lines or spots.
     * @defaultValue `SpottedType.dot`
     */
    @materialProperty()
    public markerType = SpottedType.dot;
    /**
     * The color of spots or lines.
     * @defaultValue `Color(0, 0, 0)`
     */
    @materialProperty()
    public markerColor = readonlyMath.color(0, 0, 0);
    /**
     * The gap of each spots or lines
     * The real spacing will add one.
     * @defaultValue `10`
     */
    @materialProperty()
    public markerSpacing = 10;
    /**
     * The value bigger, short lines longer.
     * @defaultValue `3`
     */
    @materialProperty()
    public diagonalProportion = 3;
    /**
     * This value influence the width of line or size of spot.
     * @defaultValue `1`
     */
    @materialProperty()
    public markerSize = 1;
    /**
     * The name of instance's class.
     */
    public className() {
        return 'SpottedShaderComponent';
    }
    /**
     * Change the parameter of this material.
     */
    public setValues(values: SpottedShaderComponentParameter) {
        Utils.copyProperties(keys, this, values);
    }
    /**
     * @ignore
     */
    public serialize(ctx: Serializer) {
        ctx.puts<SpottedShaderComponent>(['markerType', 'markerSize', 'markerColor', 'markerSpacing', 'diagonalProportion']);
    }
    /**
     * @ignore
     */
    public deserialize(ctx: Deserializer) {
        ctx.reads<SpottedShaderComponent>(['markerType', 'markerSize', 'markerColor', 'markerSpacing', 'diagonalProportion']);
    }
    /**
     * Copy the data to this object from other.
     * @param other the data source.
     */
    public copy(other: SpottedShaderComponent) {
        this.markerType = other.markerType;
        this.markerColor = other.markerColor;
        this.markerSpacing = other.markerSpacing;
        this.diagonalProportion = other.diagonalProportion;
        return this;
    }

    public clone() {
        return new SpottedShaderComponent().copy(this);
    }

    public extendShaderShading(builder: ShaderBuilder) {
        builder.addUniform('markerColor', WebGLShaderDataType.Vec3)
            .addUniform('markerSpacing', WebGLShaderDataType.Float)
            .addUniform('markerSize', WebGLShaderDataType.Float);

        if (this.markerType === SpottedType.dot) {
            builder.inject(ShaderInjectionTypes.gl_FragColor, `
            float unit = markerSpacing + 1.0;
            vec2 dotted = mod(floor(gl_FragCoord.xy), unit);
            if (dotted.x < markerSize && dotted.y < markerSize) {
                gl_FragColor = vec4( markerColor, 1.0 );
            }`);
        } else {
            builder.addUniform('diagonalProportion', WebGLShaderDataType.Float)
                .inject(ShaderInjectionTypes.gl_FragColor, `
            float unit = markerSpacing + 1.0;
            float threshold = unit / diagonalProportion;
            float dotted = mod(gl_FragCoord.x - gl_FragCoord.y, unit);
            bool isOnDiagonal = dotted < markerSize;
            vec2 pos = mod(floor(gl_FragCoord.xy), unit);
            bool isMarker = isOnDiagonal && pos.x > threshold && pos.y > threshold;
            if (isMarker){
                gl_FragColor = vec4( markerColor, 1.0 );
            }`);

        }
    }
    /**
     * @ignore
     */
    public updateShadingUniforms(program: WGLProgram) {
        program.setUniform('markerColor', this.markerColor);
        program.setUniform('markerSize', this.markerSize);
        program.setUniform('markerSpacing', this.markerSpacing);
        if (this.markerType === SpottedType.diagonal) {
            program.setUniform('diagonalProportion', this.diagonalProportion);
        }
    }
    /**
     * @ignore
     */
    public generateShaderKey() {
        return this.markerType.toString();
    }
}
