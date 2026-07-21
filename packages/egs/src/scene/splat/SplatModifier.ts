import { Vector3 } from '../../math/Vector3.js';
import { Vector4 } from '../../math/Vector4.js';
import { UniformBlockObject } from '../../renderer/shader/components/UniformBlockObject.js';
import { WebGLShaderDataType } from '../../renderer/webgl/WGLConstants.js';
import { EventDispatcher, EventType } from '../../utils/EventDispatcher.js';

export const SplatModifierUpdateEvent = new EventType();

type UniformValue = boolean | number | Vector3 | Vector4;
type UniformValues = Record<string, UniformValue>;

interface SplatModifierShaderBlock {
    header?: string;
    content: string;
}

type SplatModifierShaderBlockFactory<T extends UniformValues> = (
    input: Readonly<{ idx: string; splat: string }>,
    uniform: Readonly<{ [K in keyof T]: string }>,
    isWebgpu: boolean,
) => SplatModifierShaderBlock;

export class SplatModifier<T extends UniformValues = UniformValues> extends EventDispatcher {
    readonly name: string;
    /** @internal */
    header: string;
    /** @internal */
    content: string;
    /** @internal */
    UBO: UniformBlockObject;

    private readonly uniformValues: Readonly<T>;
    private readonly shaderUniforms: Readonly<{ [K in keyof T]: string }>;
    private readonly createShaderBlock: SplatModifierShaderBlockFactory<T>;

    constructor(name: string, uniformValues: T, createShaderBlock: SplatModifierShaderBlockFactory<T>) {
        super();
        this.name = name;
        this.uniformValues = uniformValues;
        this.createShaderBlock = createShaderBlock;

        const shaderName = `Modifier_${name}`;
        const shaderUniforms: Record<string, string> = {};
        Object.keys(uniformValues).forEach(key => (shaderUniforms[key] = `${shaderName}_${key}`));
        this.shaderUniforms = shaderUniforms as { [K in keyof T]: string };

        const shaderBlock = createShaderBlock({ idx: 'idx', splat: 'splat' }, this.shaderUniforms, false);
        this.header = shaderBlock.header ?? '';
        this.content = shaderBlock.content;

        const ubo = (this.UBO = UniformBlockObject.spawn(shaderName));
        Object.keys(uniformValues).forEach(key => {
            const uniformName = shaderUniforms[key];
            const v = uniformValues[key];
            if (typeof v === 'boolean') {
                ubo.createItem(uniformName, WebGLShaderDataType.Bool, Number(v));
            } else if (typeof v === 'number') {
                ubo.createItem(uniformName, WebGLShaderDataType.Float, v);
            } else if (v instanceof Vector4) {
                ubo.createItem(uniformName, WebGLShaderDataType.Vec4, v.clone());
            } else if (v instanceof Vector3) {
                ubo.createItem(uniformName, WebGLShaderDataType.Vec3, v.clone());
            }
        });
    }

    update(uniforms: Partial<T>) {
        const { UBO, shaderUniforms } = this;
        Object.keys(uniforms).forEach(key => {
            const v = uniforms[key];
            UBO.setItem(shaderUniforms[key], typeof v === 'boolean' ? Number(v) : v);
        });
        this.emit(SplatModifierUpdateEvent);
    }

    copy(uniforms: Partial<T> = {}) {
        const modifier = new SplatModifier(this.name, this.uniformValues, this.createShaderBlock);
        modifier.header = this.header;
        modifier.content = this.content;
        modifier.update(uniforms);
        return modifier;
    }
}
