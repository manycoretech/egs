import type { WGLProgram } from './WGLProgram.js';
import type { UniformBlockDescriptor } from '../shader/Shader.js';
import type { UBOManager } from '../ResourceManager/UBOManager.js';

export interface WGLUniformBlockData {
    buffer: WebGLBuffer;
    byteSize: number;
    version: number;
}

// WGLUniformBlock provides an instance, which is bound to active uniform blocks and
// provides queryLayout function to get the ubo info inside the shader.
export class WGLUniformBlock {
    private gl: WebGL2RenderingContext;
    private program: WGLProgram;
    readonly uniformBlockIndex: number;
    readonly bindPoint: number;
    private UBOManager: UBOManager;
    readonly descriptor: UniformBlockDescriptor;

    constructor(
        program: WGLProgram,
        descriptor: UniformBlockDescriptor,
        uniformBlockIndex: number,
        uboManager: UBOManager,
    ) {
        this.descriptor = descriptor;
        this.program = program;
        this.UBOManager = uboManager!;
        this.gl = program.gl as WebGL2RenderingContext;
        this.uniformBlockIndex = uniformBlockIndex;
        this.bindPoint = this.uniformBlockIndex;
        this.gl.uniformBlockBinding(program.program, this.uniformBlockIndex, this.uniformBlockIndex);
    }

    use(ubo: WebGLBuffer) {
        this.UBOManager.bindUBO(ubo, this.bindPoint);
    }

    queryLayout() {
        const bufferByteLength: number = this.gl.getActiveUniformBlockParameter(
            this.program.program,
            this.bindPoint,
            this.gl.UNIFORM_BLOCK_DATA_SIZE,
        );

        const index = this.gl.getActiveUniformBlockParameter(
            this.program.program,
            this.bindPoint,
            this.gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES,
        );

        const offsets: number[] = this.gl.getActiveUniforms(this.program.program, index, this.gl.UNIFORM_OFFSET);

        return { all: bufferByteLength, offsets };
    }
}
