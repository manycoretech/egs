import { type Material, MaterialDisposeEvent } from '../../elements/materials/Material';
import type { RenderState } from '../RenderState/RenderState';
import { WGLProgram } from '../webgl/WGLProgram';
import type { UBOManager } from './UBOManager';
import type { RenderInfo } from '../../utils/RenderInfo';
import { IterableWeakMap } from '../../utils/WeakCollections';

// ProgramManager manages WebGl program or instanced program for resource manger.
// it controls the shader and problem in the engine. There are plenty of maps to record all the usage of
// each program.
export class ProgramManager {
    static PROGRAM_DELETE_TIMEOUT = 1000 * 10; // in ms
    uboManager: UBOManager;
    private renderState: RenderState;
    private programs: IterableWeakMap<Material, WGLProgram> = new IterableWeakMap();
    private cacheMap: Map<string, WGLProgram> = new Map();
    private deletingMap: Map<string, number> = new Map();
    private currentTimeStamp = 0;

    get activeShaderComponentRegistry() {
        return this.renderState.activeShaderComponentRegistry;
    }

    constructor(renderState: RenderState, private info: RenderInfo) {
        this.renderState = renderState;
    }

    tick(timestamp: number) {
        this.currentTimeStamp = timestamp;
        this.deletingMap.forEach((insertTime, key) => {
            if (this.currentTimeStamp - insertTime > ProgramManager.PROGRAM_DELETE_TIMEOUT) {
                this.deletingMap.delete(key);
                const program = this.cacheMap.get(key);
                if (!program) {
                    return;
                }
                program.destroy();
                this.cacheMap.delete(key);
                this.info.objectInfo.programs--;
            }
        });
    }

    get(material: Material) {
        let program = this.programs.get(material);
        if (program && !program._disposed && program.key === material.getShaderKey(this.activeShaderComponentRegistry)) {
            return program;
        }

        this.delete(material);

        const shaderKey = material.getShaderKey(this.activeShaderComponentRegistry);
        material.once(MaterialDisposeEvent, this.delete);
        program = this.cacheMap.get(shaderKey);
        if (program) {
            program.attach(material);
        } else {
            program = new WGLProgram(this.renderState, material.createShader(this.activeShaderComponentRegistry), material, shaderKey);
            this.cacheMap.set(shaderKey, program);
            this.info.objectInfo.programs++;
        }
        this.programs.set(material, program);
        this.deletingMap.delete(shaderKey);
        material.programId = program.id;
        return program;
    }

    delete = (material: Material) => {
        if (this.uboManager) {
            material.traverseUBO(ubo => {
                this.uboManager.delete(ubo);
            });
        }

        const program = this.programs.get(material);
        if (!program) {
            return;
        }
        this.programs.delete(material);
        const detach = program.detach(material);
        if (detach) {
            this.deletingMap.set(program.key, this.currentTimeStamp);
        }
    };

    freeGPU(): void {
        this.programs.forEach((_, material) => {
            material.freeGPU();
        });
        this.programs.clear();
        this.cacheMap.clear();
        this.deletingMap.clear();
    }
}
