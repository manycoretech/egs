import type { TypedArray, Nullable } from '../../../utils/Utils';
import type { ShaderInputDescriptor, UniformBlockDescriptor, UniformArrayDescriptor } from '../Shader';
import type { WebGLShaderDataType } from '../../webgl/WGLConstants';
import type { WGLProgram } from '../../webgl/WGLProgram';
import { Capabilities } from '../../Capabilities';
import type { UniformGeneralTypes } from '../../webgl/WGLUniform';
import { createUniforms, createUniformArrays } from '../builders/ShaderHelper';

interface UBOItem {
    value: Flattenable | number;
    offset: number;
    isDirty: boolean;
}

interface Flattenable {
    toArray(arrayLike: number[] | TypedArray, offset?: number): void;
    copy(other: any): void;
}

// UniformBlockObject contains one Uniform at least, which are used in shader.
// 'uniforms' stores the Uniform's name and data type in instance of ShaderInputDescriptor.
// 'data' stores the value of each Uniform variable.
export class UniformBlockObject {
    uniforms: ShaderInputDescriptor[] = [];
    uniformArrays: UniformArrayDescriptor[] = [];
    buffer: Nullable<Float32Array> = null;
    isDirty = true;
    version: number = 0;
    data: Map<string, UBOItem> = new Map();
    arrayData: Map<string, UBOItem> = new Map();
    readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    static spawn(name: string) {
        return new UniformBlockObject(name);
    }

    createItem(name: string, type: WebGLShaderDataType, defaultValue: any) {
        // todo : constraint type to none texture type
        this.uniforms.push({ name, type });
        this.data.set(name, { value: defaultValue, offset: 0, isDirty: true });
        return this;
    }

    createItemArray(name: string, type: WebGLShaderDataType, length: number, defaultValue: any) {
        this.uniformArrays.push({ length, des: { name, type } });
        this.arrayData.set(name, { value: defaultValue, offset: 0, isDirty: true });
        return this;
    }

    getDescriptor(): UniformBlockDescriptor {
        return {
            name: this.name,
            uniforms: this.uniforms,
        };
    }

    setItem(name: string, value: any) {
        const data = this.data.get(name);
        if (!data) {
            return;
        }
        if (typeof data.value !== 'number') {
            data.value.copy(value);
        } else {
            data.value = value;
        }
        data.isDirty = true;
        this.version++;
        this.isDirty = true;
    }

    getItem(name: string): any {
        return this.data.get(name)!.value;
    }

    getUBOBuffer(): Float32Array {
        return this.buffer!;
    }

    private setupLayout(program: WGLProgram) {
        if (this.buffer === null) {
            const layouts = program.queryUBOLayout(this.name);
            if (layouts !== undefined) {
                this.buffer = new Float32Array(layouts.all / 4);
                let i = 0;
                this.data.forEach(g => {
                    // this is inset order, is same like shader
                    g.offset = layouts.offsets[i] / 4;
                    i++;
                });
                this.arrayData.forEach(g => {
                    g.offset = layouts.offsets[i] / 4;
                    i++;
                });
            }
        }
    }

    updateWebGL(program: WGLProgram) {
        if (Capabilities.IS_WEBGL2) {
            if (this.isDirty) {
                // set up buffer
                this.setupLayout(program);

                // update it
                this.data.forEach(d => {
                    if (d.isDirty) {
                        if (typeof d.value === 'number') {
                            this.buffer![d.offset] = d.value;
                        } else {
                            if ((d.value as any).toStd140Array) {
                                (d.value as any).toStd140Array(this.buffer, d.offset);
                            } else {
                                d.value.toArray(this.buffer!, d.offset);
                            }
                        }
                        d.isDirty = false;
                    }
                });
                this.arrayData.forEach(d => {
                    if (d.isDirty) {
                        if (typeof d.value === 'number') {
                            this.buffer![d.offset] = d.value;
                        } else {
                            if ((d.value as any).toStd140Array) {
                                (d.value as any).toStd140Array(this.buffer, d.offset);
                            } else if ((d.value as any).toArray) {
                                d.value.toArray(this.buffer!, d.offset);
                            } else {
                                this.buffer!.set(d.value as any, d.offset);
                            }
                        }
                        d.isDirty = false;
                    }
                });
                this.isDirty = false;
            }
            // bind point
            program.setUniformBlock(this.name, this);
        } else {
            // do normal uniform upload
            this.data.forEach((value, key) => {
                program.setUniform(key, value.value as UniformGeneralTypes, true); // todo refine type
            });
            this.arrayData.forEach((value, key) => {
                program.setUniform(key, value.value as UniformGeneralTypes, true); // todo refine type
            });
        }
    }

    createShaderHeader(supportUBO: boolean) {
        const uniforms = createUniforms(this.uniforms);
        const uniformArrays = createUniformArrays(this.uniformArrays);
        if (supportUBO) {
            return `
                layout (std140) uniform ${this.name}
                {
                    ${uniforms}
                    ${uniformArrays}
                };
            `;
        } else {
            return `
                ${uniforms}
                ${uniformArrays}
            `;
        }
    }
}
