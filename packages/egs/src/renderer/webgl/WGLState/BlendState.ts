import { Blending, type BlendingFactor, BlendingEquation } from '../../../utils/Constants';
import { logger } from '../../../utils/Logger';

export class BlendState {
    private currentBlending?: Blending;
    private currentBlendEquation?: BlendingEquation;
    private currentBlendSrc?: BlendingFactor;
    private currentBlendDst?: BlendingFactor;
    private currentBlendEquationAlpha?: BlendingEquation;
    private currentBlendSrcAlpha?: BlendingFactor;
    private currentBlendDstAlpha?: BlendingFactor;
    private currentPremultipliedAlpha: boolean = false;
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
        this.gl = gl;
    }

    setBlending(
        blending: Blending,
        blendEquation: BlendingEquation,
        blendSrc: number,
        blendDst: number,
        blendEquationAlpha?: number,
        blendSrcAlpha?: number,
        blendDstAlpha?: number,
        premultipliedAlpha: boolean = false,
    ): void {
        if (blending !== Blending.CustomBlending) {
            if (blending !== this.currentBlending || premultipliedAlpha !== this.currentPremultipliedAlpha) {
                if (
                    this.currentBlendEquation !== BlendingEquation.Add ||
                    this.currentBlendEquationAlpha !== BlendingEquation.Add
                ) {
                    this.gl.blendEquation(this.gl.FUNC_ADD);
                    this.currentBlendEquation = BlendingEquation.Add;
                    this.currentBlendEquationAlpha = BlendingEquation.Add;
                }

                if (premultipliedAlpha) {
                    switch (blending) {
                        case Blending.NormalBlending:
                            this.gl.blendFuncSeparate(
                                this.gl.ONE,
                                this.gl.ONE_MINUS_SRC_ALPHA,
                                this.gl.ONE,
                                this.gl.ONE_MINUS_SRC_ALPHA,
                            );
                            break;
                        case Blending.AdditiveBlending:
                            this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
                            break;
                        case Blending.SubtractiveBlending:
                            this.gl.blendFuncSeparate(
                                this.gl.ZERO,
                                this.gl.ZERO,
                                this.gl.ONE_MINUS_SRC_COLOR,
                                this.gl.ONE_MINUS_SRC_ALPHA,
                            );
                            break;
                        case Blending.MultiplyBlending:
                            this.gl.blendFuncSeparate(this.gl.ZERO, this.gl.SRC_COLOR, this.gl.ZERO, this.gl.SRC_ALPHA);
                            break;
                        default:
                            logger.unsupported('EGS.WGLState: Invalid blending: ' + blending);
                            break;
                    }
                } else {
                    switch (blending) {
                        case Blending.NormalBlending:
                            this.gl.blendFuncSeparate(
                                this.gl.SRC_ALPHA,
                                this.gl.ONE_MINUS_SRC_ALPHA,
                                this.gl.ONE,
                                this.gl.ONE_MINUS_SRC_ALPHA,
                            );
                            break;
                        case Blending.AdditiveBlending:
                            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
                            break;
                        case Blending.SubtractiveBlending:
                            this.gl.blendFunc(this.gl.ZERO, this.gl.ONE_MINUS_SRC_COLOR);
                            break;
                        case Blending.MultiplyBlending:
                            this.gl.blendFunc(this.gl.ZERO, this.gl.SRC_COLOR);
                            break;
                        default:
                            logger.unsupported('EGS.WGLState: Invalid blending: ' + blending);
                            break;
                    }
                }
                this.currentBlendSrc = undefined;
                this.currentBlendDst = undefined;
                this.currentBlendSrcAlpha = undefined;
                this.currentBlendDstAlpha = undefined;
                this.currentBlending = blending;
                this.currentPremultipliedAlpha = premultipliedAlpha;
            }
            return;
        }

        // custom blending
        blendEquationAlpha = blendEquationAlpha || blendEquation;
        if (blendEquation !== this.currentBlendEquation || blendEquationAlpha !== this.currentBlendEquationAlpha) {
            this.gl.blendEquationSeparate(blendEquation, blendEquationAlpha);
            this.currentBlendEquation = blendEquation;
            this.currentBlendEquationAlpha = blendEquationAlpha;
        }
        blendSrcAlpha = blendSrcAlpha ?? blendSrc;
        blendDstAlpha = blendDstAlpha ?? blendDst;
        if (
            blendSrc !== this.currentBlendSrc ||
            blendDst !== this.currentBlendDst ||
            blendSrcAlpha !== this.currentBlendSrcAlpha ||
            blendDstAlpha !== this.currentBlendDstAlpha
        ) {
            this.gl.blendFuncSeparate(blendSrc, blendDst, blendSrcAlpha, blendDstAlpha);
            this.currentBlendSrc = blendSrc;
            this.currentBlendDst = blendDst;
            this.currentBlendSrcAlpha = blendSrcAlpha;
            this.currentBlendDstAlpha = blendDstAlpha;
        }
        this.currentBlending = blending;
        this.currentPremultipliedAlpha = false;
    }
}
