import {
    type ShaderBuilder,
    ShaderExtensionTypes,
    ShaderVaryingTypes,
    ShaderInjectionTypes,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock.js';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms.js';
import { Side } from '../../../utils/Constants.js';
import { getDevicePixelRatio } from '../../../engine/RenderEngine.js';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry.js';
import { readonlyMath } from '../../../math/Readonly.js';
import { materialProperty, ContentBridge } from '../../../ContentAPI.js';
import { SceneMaterial } from '../base/index.js';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool.js';

export class GroundMaterial extends SceneMaterial {
    @materialProperty()
    groundColor = readonlyMath.color(0.7, 0.7, 0.7); // Ground floor's color
    @materialProperty()
    quat = readonlyMath.vec4(0, 0, 0, 1);
    @materialProperty()
    private _isGroundColorEnabled: number = 0; // isGround floor color enabled
    get isGroundColorEnabled() {
        return this._isGroundColorEnabled > 0;
    }
    set isGroundColorEnabled(v: boolean) {
        this._isGroundColorEnabled = v ? 1 : 0;
    }
    @materialProperty()
    groundIntensity = 1.5; // ground intensity

    @materialProperty()
    gridGapSizeA = 500; // Tile A's gap size
    @materialProperty()
    offsetA = readonlyMath.vec2(0, 0); // Tile A's offset
    @materialProperty()
    colorA = readonlyMath.color(1.0, 1.0, 1.0); // Tile A's color
    private _lineWidthA = 1;
    private lineFactorA = 1; // not expose, for precomputing, related for linewidth
    get lineWidthA() {
        return this._lineWidthA;
    }
    set lineWidthA(v) {
        this._lineWidthA = v;
        this.lineFactorA = 2 / (v * this.scaledDeviceRatio);
        ContentBridge.materialSetProperty(this, 'lineFactorA', this.lineFactorA);
    }

    @materialProperty()
    gridGapSizeB = 5000; // Tile B's gap size
    @materialProperty()
    offsetB = readonlyMath.vec2(0, 0); // Tile B's offset
    @materialProperty()
    colorB = readonlyMath.color(1.0, 1.0, 1.0); // Tile B's color
    private _lineWidthB = 1;
    private lineFactorB = 1; // not expose, for precomputing, related for linewidth
    get lineWidthB() {
        return this._lineWidthB;
    }
    set lineWidthB(v) {
        this._lineWidthB = v;
        this.lineFactorB = 2 / (v * this.scaledDeviceRatio);
        ContentBridge.materialSetProperty(this, 'lineFactorB', this.lineFactorB);
    }
    className() {
        return 'GroundMaterial';
    }

    constructor() {
        super();
        this.lineWidthA = 2;
        this.lineWidthB = 3;
        this.side = Side.DoubleSide;
        this.depthWrite = false;
        this.depthTest = false;
        this.transparent = true;
    }

    copy() {
        return this;
    }

    clone() {
        return new GroundMaterial();
    }

    private get scaledDeviceRatio(): number {
        return 1 + (getDevicePixelRatio() - 1) * 0.5;
    }

    extendShaderShading(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder
            .addExtension(ShaderExtensionTypes.derivatives)
            .addUniform('gridGapSizeA', WebGLShaderDataType.Float)
            .addUniform('offsetA', WebGLShaderDataType.Vec2)
            .addUniform('colorA', WebGLShaderDataType.Vec3)
            .addUniform('gridGapSizeB', WebGLShaderDataType.Float)
            .addUniform('offsetB', WebGLShaderDataType.Vec2)
            .addUniform('colorB', WebGLShaderDataType.Vec3)
            .addUniform('groundIntensity', WebGLShaderDataType.Float)
            .addUniform('lineFactorA', WebGLShaderDataType.Float)
            .addUniform('lineFactorB', WebGLShaderDataType.Float)
            .addUniform('groundColor', WebGLShaderDataType.Vec3)
            .addUniform('groundColorEnabled', WebGLShaderDataType.Float)
            .addUniform('groundRotation', WebGLShaderDataType.Vec4)
            .addGlobalUniform(BuiltInUniformTypes.cameraPosition)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addVaryingCustom('depth', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.vary_any, 'depth = gl_Position.z;')
            .addFragment(ShaderBlockPool.QuaternionFunctions)
            .addFragment(GroundFrag)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
            vec3 viewPosition = applyQuat(groundRotation, vWorldPosition);
            vec4 gridA = vec4(colorA, grid(viewPosition, gridGapSizeA, offsetA, lineFactorA));
            vec4 gridB = vec4(colorB, grid(viewPosition, gridGapSizeB, offsetB, lineFactorB));
            vec4 grid = mixColorByOpacity(gridA, gridB);
            vec4 res1 = mixColorByOpacity(grid, ground(viewPosition));
            vec4 res2 = grid * grid.w + vec4(groundColor, 1.0) * (1.0 - grid.w);
            gl_FragColor = res1 * (1.0 - groundColorEnabled) + res2 * groundColorEnabled;
            `,
            );
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('gridGapSizeA', this.gridGapSizeA);
        program.setUniform('offsetA', this.offsetA);
        program.setUniform('colorA', this.colorA);
        program.setUniform('gridGapSizeB', this.gridGapSizeB);
        program.setUniform('offsetB', this.offsetB);
        program.setUniform('colorB', this.colorB);

        program.setUniform('groundIntensity', this.groundIntensity);
        program.setUniform('lineFactorA', this.lineFactorA);
        program.setUniform('lineFactorB', this.lineFactorB);
        program.setUniform('groundColor', this.groundColor);
        program.setUniform('groundRotation', this.quat);
        program.setUniform('groundColorEnabled', this.isGroundColorEnabled ? 1.0 : 0.0);
    }
}

const GroundFrag = createShaderBlock(`
const float TO_RADIANS = 3.141592657 / 180.;
const float distanceOne = 2.0 * tan(45. * TO_RADIANS / 2.0);

float grid(vec3 viewPosition, float gridGapSize, vec2 offset, float lineFactor) {
    vec2 coord = viewPosition.xy + vec2(0.8 * gridGapSize);

    float fogAngleFactor = abs(applyQuat(groundRotation, cameraPosition).z) / depth;

    // Compute anti-aliased world-space grid lines
    // lineFactor = 1 / (widthRate * devicePixelRatio)；pre-compute uniform , affect line width
    vec2 grid = lineFactor * abs(fract(coord / gridGapSize) * gridGapSize - 0.8 * gridGapSize) / fwidth(coord);
    float line = min(grid.x, grid.y);

    float dense = sqrt(tan(45. / 500. * TO_RADIANS) * depth / (gridGapSize * fogAngleFactor)); // (0 - 1)

    float fogPixelFactor = 1. - dense;
    float fogFactor = fogPixelFactor;

    float weight = 1.0 - min(line, 1.0);
    return clamp(weight * fogFactor, 0.0, 1.0);
}

float rand(float n) {return fract(sin(n) * 43758.5453123);}

float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract(p);

    float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),
        u.y);
    return res;
}

vec4 ground(vec3 viewPosition) {
    vec2 coord = viewPosition.xy * 0.2;
    float opacity = 1.0 - smoothstep(300.0, 30000.0, depth);
    float noise = 1.0 - noise(coord) * 0.5 * opacity;
    return vec4(vec3(noise), opacity * 0.1 * groundIntensity * step(0.0, cameraPosition.z));
}

vec4 mixColorByOpacity(vec4 colorA, vec4 colorB) {
    return vec4(mix(colorA.xyz, colorB.xyz, step(colorA.w, colorB.w)), max(colorA.w, colorB.w));
}`);
