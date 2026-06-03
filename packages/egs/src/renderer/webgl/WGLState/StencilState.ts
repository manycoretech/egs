import type { Nullable } from '../../../utils/Utils';
import type { StencilFunc, StencilOp } from '../../../utils/Constants';

export class StencilState {
    private currentStencilMask: Nullable<number>;
    private currentStencilFunc: Nullable<number>;
    private currentStencilRef: Nullable<number>;
    private currentStencilFuncMask: Nullable<number>;
    private currentStencilFail: Nullable<number>;
    private currentStencilZFail: Nullable<number>;
    private currentStencilZPass: Nullable<number>;
    private currentStencilClear: Nullable<number>;
    private gl: WebGLRenderingContext | WebGL2RenderingContext;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
        this.gl = gl;
        this.currentStencilMask = null;
        this.currentStencilFunc = null;
        this.currentStencilRef = null;
        this.currentStencilFuncMask = null;
        this.currentStencilFail = null;
        this.currentStencilZFail = null;
        this.currentStencilZPass = null;
        this.currentStencilClear = null;
        this.setClear(0);
        this.setFunc(gl.ALWAYS, 0, 2 ^ 32 - 1);
    }

    setMask(stencilMask: number): void {
        if (this.currentStencilMask !== stencilMask) {
            this.gl.stencilMask(stencilMask);
            this.currentStencilMask = stencilMask;
        }
    }

    setFunc(stencilFunc: StencilFunc, stencilRef: number, stencilMask: number): void {
        if (this.currentStencilFunc !== stencilFunc ||
            this.currentStencilRef !== stencilRef ||
            this.currentStencilFuncMask !== stencilMask) {
            this.gl.stencilFunc(stencilFunc, stencilRef, stencilMask);
            this.currentStencilFunc = stencilFunc;
            this.currentStencilRef = stencilRef;
            this.currentStencilFuncMask = stencilMask;
        }
    }

    setOp(stencilFail: StencilOp, stencilZFail: number, stencilZPass: number): void {
        if (this.currentStencilFail !== stencilFail ||
            this.currentStencilZFail !== stencilZFail ||
            this.currentStencilZPass !== stencilZPass) {
            this.gl.stencilOp(stencilFail, stencilZFail, stencilZPass);
            this.currentStencilFail = stencilFail;
            this.currentStencilZFail = stencilZFail;
            this.currentStencilZPass = stencilZPass;
        }
    }

    setClear(stencil: number): void {
        if (this.currentStencilClear !== stencil) {
            this.gl.clearStencil(stencil);
            this.currentStencilClear = stencil;
        }
    }

    reset(): void {
        this.currentStencilMask = null;
        this.currentStencilFunc = null;
        this.currentStencilRef = null;
        this.currentStencilFuncMask = null;
        this.currentStencilFail = null;
        this.currentStencilZFail = null;
        this.currentStencilZPass = null;
        this.currentStencilClear = null;
    }
}
