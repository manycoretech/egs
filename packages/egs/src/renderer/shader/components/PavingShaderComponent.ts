import { WGLProgram } from '../../webgl/WGLProgram';
import { ShaderComponent } from '../Shader';
import { ShaderBuilder, ShaderInjectionTypes } from '../builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../webgl/WGLConstants';
import { Nullable } from '../../../utils/Utils';
import { Texture } from '../../../elements/textures/Texture';
import { createShaderBlock } from '../builders/ShaderBlock';
import { readonlyMath } from '../../../math/Readonly';
import { Texture2D } from '../../../elements/textures/Texture2D';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { ContentBridge, materialProperty } from '../../../ContentAPI';
import { TextureV2 } from '../../../elements/textures/TextureV2';

export enum PavingMethod {
    ContinuousStraight = 0,
    IPattern,
    ThreeSixNine,
    Herringbone,
    HexagonPattern,
    Fishbone,
}

export class PavingShaderComponent<T extends TextureV2 | Texture2D = Texture2D> extends ShaderComponent {
    constructor() {
        super();
        ContentBridge.shaderComponentCreateAttachable(this);
    }

    @materialProperty()
    public tileTexture: Texture;
    @materialProperty()
    public tileSize = readonlyMath.vec2();
    @materialProperty()
    public outlineSize = readonlyMath.vec2();
    @materialProperty()
    public tileCount: number;

    @materialProperty()
    private _randomTexture: T;
    get randomTexture() {
        return this._randomTexture;
    }
    set randomTexture(v) {
        if (v) {
            this._randomTexture = v;
            this.randomSize = readonlyMath.vec2(v.width, v.height);
        }
    }
    @materialProperty()
    private randomSize = readonlyMath.vec2();

    private __hashId: String = '';
    @materialProperty()
    // for sync...
    // @ts-ignore
    private _hashId: number = 0;
    get hashId(): String {
        return this.__hashId;
    }
    set hashId(value: String) {
        this.__hashId = value;
        this._hashId = this.hashCode(value);
    }

    @materialProperty()
    public gapTexture: Nullable<Texture> = null;
    @materialProperty()
    public gapSize: number = 10;
    @materialProperty()
    public gapColor = readonlyMath.color(0x0000ff);
    @materialProperty()
    public isRealGap: number = 1.0;

    @materialProperty()
    public alignPos = readonlyMath.vec2();
    @materialProperty()
    public offset = readonlyMath.vec2();
    @materialProperty()
    public rotateAngle: number = 0;

    @materialProperty()
    public pavingMethod: PavingMethod = PavingMethod.ContinuousStraight;

    @materialProperty()
    public fishboneAngle: number = 0;

    public className() {
        return 'PavingShaderComponent';
    }

    public updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tileTexture', this.tileTexture);
        program.setUniform('tileSize', this.tileSize);
        program.setUniform('outlineSize', this.outlineSize);
        program.setUniform('tileCount', this.tileCount);
        program.setTexture2D('randomTexture', this.randomTexture, true);
        program.setUniform('randomSize', this.randomSize);
        program.setUniform('instanceIdHash', this.hashCode(this.hashId));

        if (this.gapTexture) {
            program.setTexture2D('gapTexture', this.gapTexture);
        } else {
            program.setUniform('gapColor', this.gapColor);
        }
        program.setUniform('gapSize', this.gapSize);
        program.setUniform('isRealGap', this.isRealGap);

        program.setUniform('alignPos', this.alignPos);
        program.setUniform('offset', this.offset);
        program.setUniform('rotateAngle', this.rotateAngle);

        if (this.pavingMethod === PavingMethod.Fishbone) {
            program.setUniform('fishboneAngle', this.fishboneAngle);
        }
    }

    public extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('tileTexture', WebGLShaderDataType.Sampler2D)
            .addUniform('tileSize', WebGLShaderDataType.Vec2)
            .addUniform('outlineSize', WebGLShaderDataType.Vec2)
            .addUniform('tileCount', WebGLShaderDataType.Float)
            .addUniform('randomTexture', WebGLShaderDataType.Sampler2D)
            .addUniform('randomSize', WebGLShaderDataType.Vec2)
            .addUniform('instanceIdHash', WebGLShaderDataType.Int)
            .when(this.gapTexture !== null, b =>
                b.addUniform('gapTexture', WebGLShaderDataType.Sampler2D)
            )
            .addUniform('gapSize', WebGLShaderDataType.Float)
            .addUniform('gapColor', WebGLShaderDataType.Vec3)
            .addUniform('isRealGap', WebGLShaderDataType.Float)
            .addUniform('alignPos', WebGLShaderDataType.Vec2)
            .addUniform('offset', WebGLShaderDataType.Vec2)
            .addUniform('rotateAngle', WebGLShaderDataType.Float)
            .when(this.pavingMethod === PavingMethod.Fishbone, b =>
                b.addUniform('fishboneAngle', WebGLShaderDataType.Float)
            )
            .addVaryingCustom('v_position', WebGLShaderDataType.Vec3)
            .addFragment(PavingFrag)
            .inject(ShaderInjectionTypes.vary_any, 'v_position = position;')
            .inject(ShaderInjectionTypes.channel_color, buildFragment(this.gapTexture, this.pavingMethod, this.tileCount));
    }

    public generateShaderKey() {
        let s = this.gapTexture === null ? '0' : '1';
        s += this.pavingMethod.toString();
        s += this.tileCount;
        return s;
    }

    public copy(other: PavingShaderComponent<T>) {
        this.tileTexture = other.tileTexture;
        this.tileSize = other.tileSize;
        this.outlineSize = other.outlineSize;
        this.tileCount = other.tileCount;
        this.randomTexture = other.randomTexture;
        this.randomSize = other.randomSize;
        this.hashId = other.hashId;

        this.gapTexture = other.gapTexture;
        this.gapSize = other.gapSize;
        this.gapColor = other.gapColor;
        this.isRealGap = other.isRealGap;

        this.alignPos = other.alignPos;
        this.offset = other.offset;
        this.rotateAngle = other.rotateAngle;

        this.pavingMethod = other.pavingMethod;
        this.fishboneAngle = other.fishboneAngle;
        return this;
    }

    public clone() {
        return new PavingShaderComponent<T>().copy(this);
    }

    public serialize(ctx: Serializer) {
        ctx.puts<PavingShaderComponent>(['tileTexture', 'tileSize', 'outlineSize', 'tileCount', 'randomTexture', 'gapSize', 'gapColor', 'isRealGap', 'alignPos', 'offset', 'pavingMethod']);
    }

    public deserialize(ctx: Deserializer) {
        return ctx.reads<PavingShaderComponent>(['tileTexture', 'tileSize', 'outlineSize', 'tileCount', 'randomTexture', 'gapSize', 'gapColor', 'isRealGap', 'alignPos', 'offset', 'pavingMethod']);
    }

    private hashCode(value: String) {
        let h = 0;
        for (let index = 0; index < value.length; index++) {
            h = h * 31 + value.charCodeAt(index);
            if (h > 0xffffffffff) {
                h = h & 0xffffffff;
            }
        }

        if (h > 2147483647 || h < -2147483648) {
            h = h & 0xffffffff;
        }
        return h;
    }
}

const PavingFrag = createShaderBlock(`
    struct PavingCalcResult {
        vec3 localPercent;  // vec3(xLocalPercent, yLocalPercent, isTile)
        vec2 uv;            // which tile
        float isFirstTile;  // 1.0 is first
    };

    vec3 calculateLocalPercent(vec2 local, float w, float h, float gapSize, float GW, float isRealGap) {
        float xLocal = mod(local.x, w);
        float yLocal = mod(local.y, h);
        float w_recip = 1.0 / w;
        float h_recip = 1.0 / h;
        // for condition1
        float uPercent = mod(local.x, w + GW) * w_recip;
        float vPercent = mod(local.y, h + GW) * h_recip;

        float condition1 = floor(uPercent) + floor(vPercent);  // 0 is tile, 1 or 2 is gap
        float condition2 = (1.0 - step(gapSize * 0.5, xLocal)) + step(w - gapSize * 0.5, xLocal) + (1.0 - step(gapSize * 0.5, yLocal)) + step(h - gapSize * 0.5, yLocal);
        float condition = mix(condition2, condition1, isRealGap);
        condition = step(0.5, condition);

        vec3 localPercentTile = vec3(xLocal  * w_recip, yLocal * h_recip, 1.0);
        vec3 localPercentGap = vec3(0.0, 0.0, 0.0);

        return mix(localPercentTile, localPercentGap, condition);
    }

    PavingCalcResult pavingContinuousStraight(float x, float y, float w, float h, float GW, float GW_half, float gapSize, float isRealGap) {
        float u = floor((x - GW_half) / (w + GW));
        float v = floor((y - GW_half) / (h + GW));

        float x0 = GW_half + (w + GW) * u;
        float y0 = GW_half + (h + GW) * v;

        vec2 local = vec2(x - x0, y - y0);

        PavingCalcResult result;
        result.localPercent = calculateLocalPercent(local, w, h, gapSize, GW, isRealGap);
        result.uv = vec2(u, v);
        result.isFirstTile = 1.0;
        return result;
    }

    PavingCalcResult pavingIPattern(float _x, float _y, float _w, float _h, float GW, float GW_half, float gapSize, float isRealGap) {
        float x = _x - GW_half;
        float y = _y - GW_half;
        float w = _w + GW;
        float h = _h + GW;

        float h_recip = 1.0 / h;
        float w_recip = 1.0 / w;

        float v = ceil((y - h) * h_recip);
        float u = floor((x - 0.5 * w * v) * w_recip);

        float x0 = GW_half + w * u + 0.5 * w * v;
        float y0 = GW_half + h * v;

        vec2 local = vec2(_x - x0, _y - y0);

        PavingCalcResult result;
        result.localPercent = calculateLocalPercent(local, _w, _h, gapSize, GW, isRealGap);
        result.uv = vec2(u, v);
        result.isFirstTile = 1.0;
        return result;
    }

    PavingCalcResult paving369(float _x, float _y, float _w, float _h, float GW, float GW_half, float gapSize, float isRealGap) {
        float x = _x - GW_half;
        float y = _y - GW_half;
        float w = _w + GW;
        float h = _h + GW;

        float h_recip = 1.0 / h;
        float w_recip = 1.0 / w;

        float v = ceil((y - h) * h_recip);
        float u = floor((x - 2.0 / 3.0 * w * v) * w_recip);

        float x0 = GW_half + w * u + 2.0 / 3.0 * w * v;
        float y0 = GW_half + h * v;

        vec2 local = vec2(_x - x0, _y - y0);

        PavingCalcResult result;
        result.localPercent = calculateLocalPercent(local, _w, _h, gapSize, GW, isRealGap);
        result.uv = vec2(u, v);
        result.isFirstTile = 1.0;
        return result;
    }

    vec3 pavingHerringboneWH(float p, float q, float w, float h, out vec2 uv) {
        float xLocal = 0.0;
        float yLocal = 0.0;

        float u = 0.0;
        float v = 0.0;
        float isFirstTile = 0.0;

        float w_recip_half = 0.5 / w;
        float h_recip = 1.0 / h;

        // first tile
        float u1Low = ceil((p + q - h - w) * w_recip_half);
        float u1High = floor((p + q)  * w_recip_half);
        float u1 = u1High;

        float v1Low = ceil((p - h * 0.5 - w * u1) * h_recip);
        float v1High = floor((p + h * 0.5 - w * u1) * h_recip);
        float v1 = v1High;

        float u1Local = (h * 0.5 + w * u1 - h * v1 + w - q);
        float v1Local = (p + h * 0.5 - w * u1 - h * v1);

        // second tile
        float u2Low = ceil((p + q - h - 2.0 * w)  * w_recip_half);
        float u2High = floor((p + q - w)  * w_recip_half);
        float u2 = u2High;

        float v2Low = ceil((w * u2 - q + h * 0.5 + w) * h_recip);
        float v2High = floor((w * u2 - q + h * 1.5 + w) * h_recip);
        float v2 = v2High;

        float u2Local = (p + h * 0.5 - w * u2 - h * v2);
        float v2Local = (q - h * 1.5 - w * u2 + h * v2 - w);

        float condition = step(0.0, u1Local) + (1.0 - step(w, u1Local)) + step(0.0, v1Local) + (1.0 - step(h, v1Local));
        condition = step(4.0, condition);

        u = mix(u2, u1, condition);
        v = mix(v2, v1, condition);
        xLocal = mix(u2Local, u1Local, condition);
        yLocal = mix(v2Local, v1Local, condition);
        isFirstTile = mix(0.0, 1.0, condition);

        uv = vec2(u, v);
        return vec3(xLocal, yLocal, isFirstTile);
    }

    vec3 pavingHerringboneHW(float p, float q, float w, float h, out vec2 uv) {
        float xLocal = 0.0;
        float yLocal = 0.0;

        float u = 0.0;
        float v = 0.0;
        float isFirstTile = 0.0;

        float w_recip = 1.0 / w;
        float h_recip_half = 0.5 / h;

        // first tile
        float v1Low = ceil((p - q) * h_recip_half);
        float v1High = floor((p - q + h + w) * h_recip_half);
        float v1 = v1High;

        float u1Low = ceil((q - h * 0.5 - w + h * v1) * w_recip);
        float u1High = floor((q - h  * 0.5 + h * v1) * w_recip);
        float u1 = u1High;

        float u1Local = (h * 0.5 + w * u1 - h * v1 + w - q);
        float v1Local = (p + h * 0.5 - w * u1 - h * v1);

        // second tile
        float v2Low = ceil((p - q + h) * h_recip_half);
        float v2High = floor((p - q + 2.0 * h + w) * h_recip_half);
        float v2 = v2High;

        float u2Low = ceil((q - h * 1.5 - w + h * v2) * w_recip);
        float u2High = floor((q - h * 0.5 - w + h * v2) * w_recip);
        float u2 = u2High;

        float u2Local = (p + h * 0.5 - w * u2 - h * v2);
        float v2Local = (q - h * 1.5 - w * u2 + h * v2 - w);

        float condition = step(0.0, u1Local) + (1.0 - step(w, u1Local)) + step(0.0, v1Local) + (1.0 - step(h, v1Local));
        condition = step(4.0, condition);

        u = mix(u2, u1, condition);
        v = mix(v2, v1, condition);
        xLocal = mix(u2Local, u1Local, condition);
        yLocal = mix(v2Local, v1Local, condition);
        isFirstTile = mix(0.0, 1.0, condition);

        uv = vec2(u, v);
        return vec3(xLocal, yLocal, isFirstTile);
    }

    PavingCalcResult pavingHerringbone(float x, float y, float _w, float _h, float GW, float GW_half, float gapSize, float isRealGap) {
        PavingCalcResult result;

        float halfGapSize = gapSize * 0.5;
        float w = _w + GW;
        float h = _h + GW;

        float p = (x - y) * 0.7072135;
        float q = (x + y) * 0.7072135;

        vec3 local = vec3(0.0);
        if (w > h) {
            local = pavingHerringboneWH(p, q, w, h, result.uv);
        } else {
            local = pavingHerringboneHW(p, q, w, h, result.uv);
        }

        float xLocal = mod(local.x, w);
        float yLocal = mod(local.y, h);

        float condition = (1.0 - step(halfGapSize, xLocal)) + step(w - halfGapSize, xLocal) + (1.0 - step(halfGapSize, yLocal)) + step(h - halfGapSize, yLocal);
        condition = step(0.5, condition);

        vec3 localPercentTile = vec3((xLocal - halfGapSize) / _w, (yLocal - halfGapSize) / _h, 1.0);
        vec3 localPercentGap = vec3(0.0, 0.0, 0.0);

        result.localPercent = mix(localPercentTile, localPercentGap, condition);
        result.isFirstTile = 1.0 - local.z; // pavingHerringbone 1 is left, 0 is right
        return result;
    }

    vec3 HexagonPatternInner(vec2 uv, vec2 percent, vec4 distance, float gapRatio) {
        vec3 result = vec3(0.0);
        if (distance.x > gapRatio && distance.y > gapRatio && distance.z > gapRatio && distance.w > gapRatio
            && percent.y > gapRatio && percent.y < 1.0 - gapRatio)
        {
            result = vec3(percent, 1.0);
        } else {
            result = vec3(0.0, 0.0, 0.0);
        }

        return result;
    }

    vec3 HexagonPatternOuter(vec2 uv, vec2 percent, vec4 distance, float gapRatio, vec4 f, out vec2 refixedUV) {
        // to refix percent and uv
        vec3 refixedPercent = vec3(0.0);

        if (f.x > 0.0) {
            refixedPercent = vec3(percent + vec2(0.75, -0.5), 1.0);
            refixedUV = uv + vec2(-1.0, 1.0);
        }
        if (f.y > 0.0) {
            refixedPercent = vec3(percent + vec2(-0.75, -0.5), 1.0);
            refixedUV = uv + vec2(1.0, 0.0);
        }
        if (f.z < 0.0) {
            refixedPercent = vec3(percent + vec2(0.75, 0.5), 1.0);
            refixedUV = uv + vec2(-1.0, 0.0);
        }
        if (f.w < 0.0) {
            refixedPercent = vec3(percent + vec2(-0.75, 0.5), 1.0);
            refixedUV = uv + vec2(1.0, -1.0);
        }

        vec3 result = vec3(0.0);
        if (distance.x > gapRatio && distance.y > gapRatio && distance.z > gapRatio && distance.w > gapRatio) {
            result = refixedPercent;
        } else {
            result = vec3(0.0, 0.0, 0.0);
        }

        return result;
    }

    PavingCalcResult pavingHexagonPattern(float x, float y, float _w, float _h, float GW, float GW_half, float gapSize, float isRealGap) {
        // apply gap
        float w = _w + GW * 2.0 * sqrt(3.0) / 3.0;
        float h = _w * sqrt(3.0) * 0.5 + GW;

        // output
        float u = 0.0;
        float v = 0.0;

        float w_recip = 1.0 / w;
        u = floor(4.0 / 3.0 * x * w_recip);
        v = ceil((2.0 * sqrt(3.0) / 3.0 * y - 2.0 / 3.0 * x - w) * w_recip);

        float x0 = 0.75 * w * u;     // because the boundary shrinks, remove GW_half
        float y0 = sqrt(3.0) / 4.0 * w * u + sqrt(3.0) / 2.0 * w * v;

        float uPercent = 0.0;
        float vPercent = 0.0;
        uPercent = mod(x - x0, w) * w_recip;
        vPercent = mod(y - y0, h) / h;

        u += floor((x - x0) / w);
        v += floor((y - y0) / h);

        float uPercent_double = uPercent * 2.0;
        float gapRatio = gapSize / (w * sqrt(3.0));

        // distance
        float d1 = abs( uPercent_double - vPercent + 0.5) / sqrt(5.0);
        float d2 = abs(-uPercent_double - vPercent + 2.5) / sqrt(5.0);
        float d3 = abs(-uPercent_double - vPercent + 0.5) / sqrt(5.0);
        float d4 = abs( uPercent_double - vPercent - 1.5) / sqrt(5.0);

        // four lines, inner
        float f1 = vPercent - uPercent_double - 0.5; // <0
        float f2 = vPercent + uPercent_double - 2.5; // <0
        float f3 = vPercent + uPercent_double - 0.5; // >0
        float f4 = vPercent - uPercent_double + 1.5; // >0

        float condition = step(0.0, f1) + step(0.0, f2) + (1.0 - step(0.0, f3)) + (1.0 - step(0.0, f4));  // 0 is inner, 1-4 is outer
        condition = step(0.5, condition);

        PavingCalcResult result;
        result.uv = vec2(u, v);
        result.isFirstTile = 1.0;

        if (condition < 0.5) {
            result.localPercent = HexagonPatternInner(vec2(u, v), vec2(uPercent, vPercent), vec4(d1, d2, d3, d4), gapRatio);
        } else {
            result.localPercent = HexagonPatternOuter(vec2(u, v), vec2(uPercent, vPercent), vec4(d1, d2, d3, d4), gapRatio, vec4(f1, f2, f3, f4), result.uv);
        }

        return result;
    }

    PavingCalcResult pavingFishbone(float x, float y, float _w, float _h, float GW, float GW_half, float gapSize, float isRealGap, float fishboneRadian) {
        float radian_sin = sin(fishboneRadian);
        float radian_cos = cos(fishboneRadian);
        float radian_tan = tan(fishboneRadian);
        float radian_cot = 1.0 / tan(fishboneRadian);

        // apply gap
        float h = (_h + GW) / radian_sin;
        float w = (_w - h * radian_cos) + GW / radian_sin;

        // output
        float u = 0.0;
        float v = 0.0;
        float uPercent = 0.0;
        float vPercent = 0.0;

        // calculate u, v
        v = floor(x / (2.0 * radian_sin * w));
        float isSecondTile = step(0.0, x - 2.0 * radian_sin * w * (v + 0.5)); // 0 is first, 1 is second

        float u1 = floor((y - x * radian_cot + 2.0 * radian_cos * w * v) / h);
        float u2 = floor((y + x * radian_cot - 2.0 * radian_cos * w * (v + 1.0)) / h);
        u = mix(u1, u2, isSecondTile);

        // calculate uPercent、vPercent
        float border1x = y + x * radian_tan - h * u - 2.0 * w * v * radian_sin * radian_tan;                                // first tile, line-3
        float border1y = y - x * radian_cot - h * u + 2.0 * w * v * radian_cos;                                             // first tile, line-1
        float border2x = y - x * radian_tan - h * u - w * radian_cos - h + 2.0 * w * radian_sin * radian_tan * (v + 0.5);   // second tile, line-3
        float border2y = y + x * radian_cot - 2.0 * w * radian_cos * (v + 1.0) - h * u - h;                                 // second tile, line-2

        float divisor1_recip = 1.0 / sqrt(1.0 + pow(radian_tan, 2.0));
        float divisor2_recip = 1.0 / sqrt(1.0 + pow(radian_cot, 2.0));
        float dBorder1x = abs(border1x) * divisor1_recip;
        float dBorder1y = abs(border1y) * divisor2_recip;
        float dBorder2x = abs(border2x) * divisor1_recip;
        float dBorder2y = abs(border2y) * divisor2_recip;

        float dBorderX = mix(dBorder1x, dBorder2x, isSecondTile);
        float dBorderY = mix(dBorder1y, dBorder2y, isSecondTile);

        uPercent = dBorderX / (_w + GW);
        vPercent = dBorderY / (_h + GW);
        uPercent = mix(1.0 - uPercent, uPercent, isSecondTile);
        vPercent = mix(1.0 - vPercent, vPercent, isSecondTile);

        // gap
        float xScale = w * radian_sin;
        vec2 gapRatio = vec2(gapSize * 0.5 / xScale, gapSize * 0.5 / (_h + GW));

        float x0 = 2.0 * w * v * radian_sin;
        float uPercentTemp = mod(x - x0, xScale) / xScale;

        float condition = (1.0-step(gapRatio.x, uPercentTemp)) + step(1.0-gapRatio.x, uPercentTemp) + (1.0 - step(gapRatio.y, vPercent)) + step(1.0-gapRatio.y, vPercent);  // 0 is tile, 1-4 is gap
        condition = step(0.5, condition);

        PavingCalcResult result;
        result.localPercent = mix(vec3(uPercent, vPercent, 1.0), vec3(0.0, 0.0, 0.0), condition);
        result.uv = vec2(u, v);
        result.isFirstTile = 1.0 - isSecondTile;
        return result;
    }

    vec3 applyRotateZ(vec3 pos, float angle) {
        vec3 newPos = vec3(0.0);
        newPos.x = cos(angle) * pos.x - sin(angle) * pos.y;
        newPos.y = sin(angle) * pos.x + cos(angle) * pos.y;
        newPos.z = pos.z;
        return newPos;
    }

    int modFunc(int x, int y) {
        return x - x / y * y;
    }

    int absFunc(int x) {
        if (x >= 0) {
            return x;
        } else {
            return -x;
        }
    }

    int getBit(int value, int bit) {
        // bit range 0~31
        if (bit == 31 && value < 0) {
            return 1;
        }
        if(bit > 31 || bit < 0) {
            return 0;
        }
        // valueAbsFor31Bit is the value of 0~30bit of value
        // when value is greater than 0 ,should not change
        // if value is less than 0, we change it into a value greater than 0
        int valueAbsFor31Bit = value;
        if(value < 0) {
            valueAbsFor31Bit = value + 2147483647 + 1;
        }
        // right shift n bit, and get last bit.
        return modFunc( valueAbsFor31Bit / int(pow(2.0, float(bit))), 2 );
    }

    int rightShift(int value, int bit) {
        if (value >= 0) {
            return value / int(pow(2.0, float(bit)));
        }
        int tmp = 2147483647 + value + 1;
        for(int i = 0; i < 32; i++) {
            if (i < bit) {
                tmp = (tmp / 2) + int(pow(2.0, 30.0));
            }
        }
        return -(2147483647 - tmp + 1);
    }
`);

function buildFragment(gapTexture: Nullable<Texture>, pavingMethod: PavingMethod, tileCount: number) {
    let s = '';
    switch (pavingMethod) {
        case PavingMethod.ContinuousStraight:
            s += 'PavingCalcResult result = pavingContinuousStraight(x, y, w, h, GW, GW_half, gapSize, isRealGap);';
            break;
        case PavingMethod.IPattern:
            s += 'PavingCalcResult result = pavingIPattern(x, y, w, h, GW, GW_half, gapSize, isRealGap);';
            break;
        case PavingMethod.ThreeSixNine:
            s += 'PavingCalcResult result = paving369(x, y, w, h, GW, GW_half, gapSize, isRealGap);';
            break;
        case PavingMethod.Herringbone:
            s += 'PavingCalcResult result = pavingHerringbone(x, y, w, h, GW, GW_half, gapSize, isRealGap);';
            break;
        case PavingMethod.HexagonPattern:
            s += 'PavingCalcResult result = pavingHexagonPattern(x, y, w, h, GW, GW_half, gapSize, isRealGap);';
            break;
        case PavingMethod.Fishbone:
            s += `
                float fishboneRadian = fishboneAngle / 180.0 * PI;
                w = w + h * cos(fishboneRadian);
                h = h * sin(fishboneRadian);
                PavingCalcResult result = pavingFishbone(x, y, w, h, GW, GW_half, gapSize, isRealGap, fishboneRadian);
                fishPaving = mix(1.0, 0.0, result.isFirstTile);
            `;
    }

    if (gapTexture !== null) {
        s += 'vec3 colorGap = texture2D(gapTexture, result.localPercent.xy).xyz;';
    } else {
        s += 'vec3 colorGap = gapColor;';
    }

    let t = '';
    const randomArray = [1, 4, 9, 4, 25, 16, 25, 16, 9, 16, 16, 16, 25, 25, 25, 16];
    const randomIndex = tileCount > 16 ? 25 : randomArray[tileCount - 1];
    switch (randomIndex) {
        case 1:
            s += 'int stepSize = 1;';
            t += 'float random = 1.0;';
            break;
        case 4:
            s += 'int stepSize = 4;';
            t += 'float random = floor(randomPixel.r * 255.0 / 16.0);';
            break;
        case 9:
            s += 'int stepSize = 9;';
            t += 'float random = mod(randomPixel.r * 255.0, 16.0);';
            break;
        case 16:
            s += 'int stepSize = 16;';
            t += 'float random = randomPixel.g * 255.0;';
            break;
        case 25:
            s += 'int stepSize = 25;';
            t += 'float random = randomPixel.b * 255.0;';
            break;
    }

    return `
        float angle = -rotateAngle / 180.0 * PI;
        vec3 newPos = v_position - vec3(alignPos + offset, 0.0);
        vec2 localPos = applyRotateZ(newPos, angle).xy;

        float x = localPos.x;
        float y = localPos.y;
        float w = outlineSize.x;
        float h = outlineSize.y;
        float GW = gapSize * isRealGap;
        float GW_half = GW * 0.5;
        float fishPaving = 0.0;
        ${s}
        vec3 localPercent = result.localPercent;
        vec2 uv = result.uv;
        int n = int(1.0 - result.isFirstTile);

        // new localPercent
        vec2 scale = vec2(w, h) / tileSize;
        vec3 newLocalPercent = vec3(fract(localPercent.xy * scale), localPercent.z);
        newLocalPercent.y = mix(newLocalPercent.y, 1.0 - newLocalPercent.y, fishPaving);

        // random
        int randSeed = instanceIdHash;
        if (n != 0 && n != 32) {
            int leftShiftValue = int(randSeed * int(pow(2.0, float(31 - n))) * 2);
            int rightShiftValue = rightShift(randSeed, n);

            int result = 0;
            for(int i = 31; i >= 0; i--) {
                result = result * 2;
                if(getBit(rightShiftValue, i) == 1 || getBit(leftShiftValue, i) == 1) {
                    result = result + 1;
                }
            }
            randSeed = result;
        }

        int uOffset;
        int vOffset;
        if (randSeed < 0) {
            uOffset = modFunc( modFunc( absFunc(randSeed + 2147483647 + 1), 65536 ), int(randomSize.x) ) / stepSize * stepSize;
            vOffset = modFunc( absFunc(rightShift(randSeed, 16)), int(randomSize.y) ) / stepSize * stepSize;
        } else {
            uOffset = modFunc( modFunc( randSeed, 65536 ), int(randomSize.x) ) / stepSize * stepSize;
            vOffset = modFunc( modFunc( randSeed / 65536, 65536 ), int(randomSize.y) ) / stepSize * stepSize;
        }
        vec2 offset = vec2(uOffset, vOffset);
        vec2 uvFinal = uv + offset + 0.5;
        vec2 isNegative = 1.0 - step(0.0, uvFinal);
        vec4 randomPixel = texture2D(randomTexture, fract(abs(uvFinal - 1.0 * isNegative) / randomSize));
        ${t}
        float newY = fract((random - 1.0 + newLocalPercent.y) / tileCount);
        vec3 colorTile = texture2D(tileTexture, vec2(newLocalPercent.x, newY)).xyz;
        color *= mix(colorGap, colorTile, newLocalPercent.z);
    `;
}
