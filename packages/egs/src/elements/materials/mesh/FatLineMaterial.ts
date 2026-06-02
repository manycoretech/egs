import { LineBasicMaterial, ColorWithAlpha, LineDash, type LineDashParam, type ColorWithAlphaParam } from './LineMaterial';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderBuilder, ShaderVaryingTypes, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import type { ConvertMaterialParameters,MaterialParameters } from '../Material';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms';
import { Utils } from '../../../utils/Utils';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { materialProperty, shaderComponentInMaterial } from '../../../ContentAPI';
import { Renderer } from '../../../renderer/Renderer';
import { SceneClipMaterial } from '../base';

export type FatLineMaterialParameter = ConvertMaterialParameters<Pick<FatLineMaterial, 'enableDash' | 'fatLineWidth' | 'enableViewIndependentDashScale'>>
    & LineDashParam & ColorWithAlphaParam & MaterialParameters;
/**
 * This material is specifically used to draw line or dash-line which has width more than 1 pixel.
 */
export class FatLineMaterial extends SceneClipMaterial {
    fallback = new LineBasicMaterial();
    @shaderComponentInMaterial()
    color = new ColorWithAlpha();
    @materialProperty()
    enableDash = false;
    @shaderComponentInMaterial()
    dash = new LineDash();
    @materialProperty()
    fatLineWidth = 1;
    @materialProperty()
    enableViewIndependentDashScale = false;

    className() {
        return 'FatLineMaterial';
    }

    generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + this.enableDash;
    }

    constructor(p?: FatLineMaterialParameter) {
        super();
        this.setValues(p);
        this.dash.useInstance = true;
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

    setValues(p?: FatLineMaterialParameter) {
        if (p === undefined) {
            return;
        }
        super.setValues(p);
        Utils.copyPropertiesAndCheckRecompile(['enableDash', 'fatLineWidth'], ['enableDash'], this, p);
        this.color.setValues(p);
        this.dash.setValues(p);
        this.fallback.setValues(p);
    }

    updateShapeUniforms(program: WGLProgram, r: ShaderComponentRegistry) {
        super.updateShapeUniforms(program, r);
        program.setUniform('fatLineWidth', this.fatLineWidth);
        if (this.enableDash) {
            this.dash.updateShadingUniforms(program);
        }
    }

    updateShadingUniforms(program: WGLProgram): void {
        this.color.updateShadingUniforms(program);
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder.extend(this.color);
    }

    computeShapeKey(r: ShaderComponentRegistry) {
        return super.computeShapeKey(r) + 'fat';
    }

    extendShaderShape(builder: ShaderBuilder, registry: ShaderComponentRegistry) {
        super.extendShaderShape(builder, registry);
        builder
            .addVarying(ShaderVaryingTypes.fragUV)
            .addUniform('fatLineWidth', WebGLShaderDataType.Float)
            .addGlobalUniform(BuiltInUniformTypes.resolution)
            .addInstanceAttribute('instanceStart', WebGLShaderDataType.Vec3)
            .addInstanceAttribute('instanceEnd', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.gl_Position, FatlineVert)
            .addVertexCustom(FatlineLib)
            .inject(ShaderInjectionTypes.discard, RoundCornerDiscard)
            .when(this.enableDash, b => b.extend(this.dash));
    }

    copy(other: FatLineMaterial) {
        super.copyBase(other);
        this.color.copy(other.color);
        this.dash.copy(other.dash);
        this.enableDash = other.enableDash;
        return this;
    }

    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<FatLineMaterial>(['color', 'dash', 'fatLineWidth', 'enableDash']);
    }

    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<FatLineMaterial>(['color', 'dash', 'fatLineWidth', 'enableDash']);
    }

    clone() {
        return new FatLineMaterial().copy(this);
    }
}

const FatlineLib = `
void trimSegment( const in vec4 start, inout vec4 end ) {
    // trim end segment so it terminates between the camera plane and the near plane
    // conservative estimate of the near plane
    float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
    float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
    float nearEstimate = - 0.5 * b / a;
    float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );
    end.xyz = mix( start.xyz, end.xyz, alpha );
}
`;

const FatlineVert = `
float aspect = resolution.x / resolution.y;
// camera space
vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );
// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
// perhaps there is a more elegant solution -- WestLangley
bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column
if ( perspective ) {
    if ( start.z < 0.0 && end.z >= 0.0 ) {
        trimSegment( start, end );
    } else if ( end.z < 0.0 && start.z >= 0.0 ) {
        trimSegment( end, start );
    }
}
// clip space
vec4 clipStart = projectionMatrix * start;
vec4 clipEnd = projectionMatrix * end;
// ndc space
vec2 ndcStart = clipStart.xy / clipStart.w;
vec2 ndcEnd = clipEnd.xy / clipEnd.w;
// direction
vec2 dir = ndcEnd - ndcStart;
// account for clip-space aspect ratio
dir.x *= aspect;
dir = normalize( dir );
// perpendicular to dir
vec2 offset = vec2( dir.y, - dir.x );
// undo aspect ratio adjustment
dir.x /= aspect;
offset.x /= aspect;
// sign flip
if ( position.x < 0.0 ) offset *= - 1.0;
// endcaps
if ( position.y < 0.0 ) {
    offset += - dir;
} else if ( position.y > 1.0 ) {
    offset += dir;
}
// adjust for fatLineWidth
offset *= fatLineWidth;
// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
offset /= resolution.y;
// select end
vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;
// back to clip space
offset *= clip.w;
clip.xy += offset;
gl_Position = clip;

mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation
`;

const RoundCornerDiscard = `
if ( abs( vUv.y ) > 1.0 ) {
    float a = vUv.x;
    float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
    float len2 = a * a + b * b;
    if ( len2 > 1.0 ) discard;
}
`;
