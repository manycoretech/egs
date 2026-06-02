import { Vector4 } from '../../../math/Vector4';

import { ColorState } from './ColorState';
import { DepthState } from './DepthState';
import { StencilState } from './StencilState';
import { AttributeState } from './AttributeState';
import { Nullable } from '../../../utils/Utils';
import { TextureState } from './TextureState';
import { WGLProgram } from '../WGLProgram';
import { WebGLCullFace, WebGLTextureType } from '../WGLConstants';
import { Blending, DepthModes, Side, BlendingEquation, StencilFunc, StencilOp } from '../../../utils/Constants';
import { BlendState } from './BlendState';
import { MaterialState } from '../../../elements/materials/Material';
import { WGLExtensions } from '../WGLExtensions';

// WGLState contains functions to control the switch and record of states in WebGL/WebGL2,
// Such as depth_test, blend_mode, view_port, cull_face and so on.
export class WGLState {
    readonly colorState: ColorState;
    readonly depthState: DepthState;
    readonly blendState: BlendState;
    readonly stencilState: StencilState;
    readonly textureState: TextureState;
    readonly attributeState: AttributeState;

    private enabledStates: any = {};
    private currentProgram: Nullable<WebGLProgram> = null;

    private currentFlipSided: Nullable<boolean>;
    private currentCullFace: Nullable<WebGLCullFace>;
    private currentPolygonOffsetFactor: Nullable<number>;
    private currentPolygonOffsetUnits: Nullable<number>;

    private currentScissor = new Vector4();
    private currentViewport = new Vector4();
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, extensions: WGLExtensions) {
        this.gl = gl;
        this.textureState = new TextureState(gl);
        this.attributeState = new AttributeState(gl, extensions);
        this.colorState = new ColorState(gl);
        this.depthState = new DepthState(gl);
        this.stencilState = new StencilState(gl);
        this.blendState = new BlendState(gl);

        // too easy to set, no need to create a new file for them
        this.currentFlipSided = null;
        this.currentCullFace = null;
        this.currentPolygonOffsetFactor = null;
        this.currentPolygonOffsetUnits = null;

        // init
        this.enable(gl.DEPTH_TEST);
        this.depthState.setFunc(DepthModes.LessEqualDepth);
        this.setFlipSided(false);
        this.setCullFace(WebGLCullFace.Back);
        this.enable(gl.CULL_FACE);
        this.setBlending(Blending.NoBlending);
    }

    private enable(id: number): void {
        if (this.enabledStates[id] !== true) {
            this.gl.enable(id);
            this.enabledStates[id] = true;
        }
    }

    private disable(id: number): void {
        if (this.enabledStates[id] !== false) {
            this.gl.disable(id);
            this.enabledStates[id] = false;
        }
    }

    setDepthTest(depthTest: boolean): void {
        if (depthTest) {
            this.enable(this.gl.DEPTH_TEST);
        } else {
            this.disable(this.gl.DEPTH_TEST);
        }
    }

    setStencilTest(stencilTest: boolean): void {
        if (stencilTest) {
            this.enable(this.gl.STENCIL_TEST);
        } else {
            this.disable(this.gl.STENCIL_TEST);
        }
    }

    setStencilClear(stencil: number) {
        this.stencilState.setClear(stencil);
    }

    setDepthMask(depthMask: boolean): void {
        this.depthState.setMask(depthMask);
    }

    setColorClear(r: number, g: number, b: number, a: number, premultipliedAlpha?: boolean): void {
        this.colorState.setClear(r, g, b, a, premultipliedAlpha);
    }

    bindTextureAndActiveForUploading(webglType: WebGLTextureType, webglTexture: WebGLTexture) {
        this.textureState.bindTextureAndActiveForUploading(webglType, webglTexture);
    }

    bindTextureAt(webglType: WebGLTextureType, webglTexture: WebGLTexture, slot: number) {
        this.textureState.bindTextureAt(webglType, webglTexture, slot);
    }

    resetTextureSlotIndex() {
        this.textureState.resetSlotIndex();
    }

    getFreeTextureSlot(namedSlot?: number): number {
        if (namedSlot !== undefined) {
            return namedSlot;
        }
        return this.textureState.getFreeSlot();
    }

    useProgram(program: WGLProgram): boolean {
        if (this.currentProgram !== program) {
            this.gl.useProgram(program.program);
            this.currentProgram = program;
            return true;
        }
        return false;
    }

    setFlipSided(flipSided: boolean): void {
        if (this.currentFlipSided !== flipSided) {
            if (flipSided) {
                this.gl.frontFace(this.gl.CW);
            } else {
                this.gl.frontFace(this.gl.CCW);
            }
            this.currentFlipSided = flipSided;
        }
    }

    setCullFace(cullFace: WebGLCullFace): void {
        if (cullFace !== WebGLCullFace.None) {
            this.enable(this.gl.CULL_FACE);
            if (cullFace !== this.currentCullFace) {
                if (cullFace === WebGLCullFace.Back) {
                    this.gl.cullFace(this.gl.BACK);
                } else if (cullFace === WebGLCullFace.Front) {
                    this.gl.cullFace(this.gl.FRONT);
                } else {
                    this.gl.cullFace(this.gl.FRONT_AND_BACK);
                }
            }
        } else {
            this.disable(this.gl.CULL_FACE);
        }
        this.currentCullFace = cullFace;
    }

    setPolygonOffset(polygonOffset: boolean, factor: number, units: number): void {
        if (polygonOffset) {
            this.enable(this.gl.POLYGON_OFFSET_FILL);
            if (this.currentPolygonOffsetFactor !== factor || this.currentPolygonOffsetUnits !== units) {
                this.gl.polygonOffset(factor, units);
                this.currentPolygonOffsetFactor = factor;
                this.currentPolygonOffsetUnits = units;
            }
        } else {
            this.disable(this.gl.POLYGON_OFFSET_FILL);
        }
    }

    setMaterial(material: MaterialState, frontFaceCW: boolean): void {
        material.side === Side.DoubleSide ? this.disable(this.gl.CULL_FACE) : this.enable(this.gl.CULL_FACE);
        const flipSided = material.side === Side.BackSide;
        this.setFlipSided(frontFaceCW ? !flipSided : flipSided);
        if (material.blending === Blending.NormalBlending && material.transparent === false) {
            this.setBlending(Blending.NoBlending);
        } else {
            this.setBlending(
                material.blending, material.blendEquation, material.blendSrc, material.blendDst,
                material.blendEquationAlpha ?? undefined, material.blendSrcAlpha ?? undefined, material.blendDstAlpha ?? undefined,
                material.premultipliedAlpha,
            );
        }

        this.setDepthTest(material.depthTest);
        this.depthState.setFunc(material.depthFunc);
        this.depthState.setMask(material.depthWrite);
        this.colorState.setMask(
            material.colorWrite && material.colorWriteMasks[0],
            material.colorWrite && material.colorWriteMasks[1],
            material.colorWrite && material.colorWriteMasks[2],
            material.colorWrite && material.colorWriteMasks[3],
        );

        this.setStencil(material.stencilWrite, material.stencilWriteMask,
            material.stencilFunc, material.stencilRef, material.stencilFuncMask,
            material.stencilFail, material.stencilZFail, material.stencilZPass);

        this.setPolygonOffset(material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits);
    }

    setStencil(
        stencilWrite: boolean,
        stencilWriteMask: number,
        stencilFunc: StencilFunc,
        stencilRef: number,
        stencilFuncMask: number,
        stencilFail: StencilOp,
        stencilZFail: number,
        stencilZPass: number,
    ) {
        this.setStencilTest(stencilWrite);
        if (stencilWrite) {
            this.stencilState.setMask(stencilWriteMask);
            this.stencilState.setFunc(stencilFunc, stencilRef, stencilFuncMask);
            this.stencilState.setOp(stencilFail, stencilZFail, stencilZPass);
        }
    }

    setBlending(blending: Blending.NoBlending): void;
    setBlending(blending: Blending, blendEquation: BlendingEquation, blendSrc: number, blendDst: number, blendEquationAlpha?: number, blendSrcAlpha?: number, blendDstAlpha?: number, premultipliedAlpha?: boolean): void;
    setBlending(blending: Blending, blendEquation?: BlendingEquation, blendSrc?: number, blendDst?: number, blendEquationAlpha?: number, blendSrcAlpha?: number, blendDstAlpha?: number, premultipliedAlpha?: boolean): void {
        if (blending === Blending.NoBlending) {
            this.disable(this.gl.BLEND);
            return;
        }
        this.enable(this.gl.BLEND);
        this.blendState.setBlending(blending, blendEquation!, blendSrc!, blendDst!, blendEquationAlpha, blendSrcAlpha, blendDstAlpha, premultipliedAlpha);
    }

    setScissorTest(scissorTest: boolean): void {
        if (scissorTest) {
            this.enable(this.gl.SCISSOR_TEST);
        } else {
            this.disable(this.gl.SCISSOR_TEST);
        }
    }

    setScissor(scissor: Vector4): void {
        if (this.currentScissor.equals(scissor) === false) {
            this.gl.scissor(scissor.x, scissor.y, scissor.z, scissor.w);
            this.currentScissor.copy(scissor);
        }
    }

    setViewport(viewport: Vector4): void {
        if (this.currentViewport.equals(viewport) === false) {
            this.gl.viewport(viewport.x, viewport.y, viewport.z, viewport.w);
            this.currentViewport.copy(viewport);
        }
    }

    clear(color: boolean = true, depth: boolean = true, stencil: boolean = true): void {
        let bits = 0;
        if (color) {
            bits |= this.gl.COLOR_BUFFER_BIT;
        }
        if (depth) {
            this.setDepthMask(true);
            bits |= this.gl.DEPTH_BUFFER_BIT;
        }
        if (stencil) {
            bits |= this.gl.STENCIL_BUFFER_BIT;
        }
        this.gl.clear(bits);
    }

    reset(): void {
        this.attributeState.reset();
        this.colorState.reset();
        this.depthState.reset();
        this.stencilState.reset();
        this.currentProgram = null;
        this.currentFlipSided = null;
        this.currentCullFace = null;
        this.enabledStates = {};
    }
}
