import { DepthModes } from '../../../utils/Constants.js';
import type { Nullable } from '../../../utils/Utils.js';

export class DepthState {
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
    private currentDepthMask: Nullable<boolean>;
    private currentDepthFunc: Nullable<number>;
    currentDepthClear: Nullable<number>;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
        this.gl = gl;
        this.currentDepthMask = null;
        this.currentDepthFunc = null;
        this.currentDepthClear = null;
        this.setClear(1);
    }

    setMask(depthMask: boolean): void {
        if (this.currentDepthMask !== depthMask) {
            this.gl.depthMask(depthMask);
            this.currentDepthMask = depthMask;
        }
    }

    setFunc(depthFunc: DepthModes): void {
        if (this.currentDepthFunc !== depthFunc) {
            switch (depthFunc) {
                case DepthModes.NeverDepth:
                    this.gl.depthFunc(this.gl.NEVER);
                    break;
                case DepthModes.AlwaysDepth:
                    this.gl.depthFunc(this.gl.ALWAYS);
                    break;
                case DepthModes.LessDepth:
                    this.gl.depthFunc(this.gl.LESS);
                    break;
                case DepthModes.LessEqualDepth:
                    this.gl.depthFunc(this.gl.LEQUAL);
                    break;
                case DepthModes.EqualDepth:
                    this.gl.depthFunc(this.gl.EQUAL);
                    break;
                case DepthModes.GreaterEqualDepth:
                    this.gl.depthFunc(this.gl.GEQUAL);
                    break;
                case DepthModes.GreaterDepth:
                    this.gl.depthFunc(this.gl.GREATER);
                    break;
                case DepthModes.NotEqualDepth:
                    this.gl.depthFunc(this.gl.NOTEQUAL);
                    break;
                default:
                    this.gl.depthFunc(this.gl.LEQUAL);
            }
            this.currentDepthFunc = depthFunc;
        }
    }

    setClear(depth: number): void {
        if (this.currentDepthClear !== depth) {
            this.gl.clearDepth(depth);
            this.currentDepthClear = depth;
        }
    }

    reset(): void {
        this.currentDepthMask = null;
        this.currentDepthFunc = null;
        this.currentDepthClear = null;
    }
}
