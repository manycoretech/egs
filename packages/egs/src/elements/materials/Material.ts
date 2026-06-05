import { EventType, ElementEventDispatcher } from '../../utils/EventDispatcher';
import type { ShaderInfo, ShaderComponent } from '../../renderer/shader/Shader';
import type { WGLProgram } from '../../renderer/webgl/WGLProgram';
import type {
    Serializer,
    Deserializer,
    SerializerablePartKeys,
    SerializerableDelegatedAsReference,
} from '../../utils/Serialization';
import {
    Side,
    DepthModes,
    Blending,
    BlendingFactor,
    BlendingEquation,
    StencilOp,
    StencilFunc,
} from '../../utils/Constants';
import { type Nullable, type PickSubTypeProperty, Utils } from '../../utils/Utils';
import type { Renderer } from '../../renderer/Renderer';
import type { Texture } from '../textures/Texture';
import type { ReadonlyColor } from '../../math/Color';
import type { UniformBlockObject } from '../../renderer/shader/components/UniformBlockObject';
import { ShaderBuilder } from '../../renderer/shader/builders/ShaderBuilder';
import type { ElementsWithGPUResource } from '../../utils/ElementBase';
import { ContentBridge, materialProperty } from '../../ContentAPI';
import type { ShaderComponentRegistry } from '../../scene/ShaderComponentRegistry';
import { logger } from '../../utils/Logger';

let materialId = 0;

/**
 * Event emitted when a material is disposed.
 */
export const MaterialDisposeEvent = new EventType<Material>();
/**
 * Event emitted when a material property changes.
 */
export const MaterialPropertyChangeEvent = new EventType<Material>();
/**
 * Event emitted when a material needs shader recompilation.
 */
export const MaterialRecompileShaderEvent = new EventType<Material>();

/**
 * Copies one nullable material property from another instance.
 */
export function copyItem<T>(source: T, other: T, key: keyof T) {
    if (source[key] !== null && other[key] !== null) {
        (source[key] as any).copy(other[key]);
    }
    if (other[key] !== null && source[key] === null && (other[key] as any).clone) {
        source[key] = (other[key] as any).clone();
    }
    if (other[key] === null) {
        (source as any)[key] = null;
    }
}

export type PickedBySubType<T, U> = Pick<T, PickSubTypeProperty<T, U>>;
export type NotPickedBySubType<T, U> = Omit<T, keyof PickedBySubType<T, U>>;

export type SubTypeMap<T, U, V> = Record<keyof PickedBySubType<T, U>, V> & NotPickedBySubType<T, U>;

export type ConvertMaterialParameters<T> = Partial<SubTypeMap<T, ReadonlyColor, number | string | ReadonlyColor>>;

/**
 * Common parameter bag accepted by material constructors and setters.
 */
export type MaterialParameters = ConvertMaterialParameters<
    Pick<
        Material,
        | 'transparent'
        | 'visible'
        | 'side'
        | 'blending'
        | 'blendSrc'
        | 'blendDst'
        | 'blendEquation'
        | 'blendSrcAlpha'
        | 'blendDstAlpha'
        | 'blendEquationAlpha'
        | 'depthFunc'
        | 'depthTest'
        | 'depthWrite'
        | 'colorWrite'
        | 'polygonOffset'
        | 'polygonOffsetFactor'
        | 'polygonOffsetUnits'
        | 'stencilWriteMask'
        | 'stencilFunc'
        | 'stencilRef'
        | 'stencilFuncMask'
        | 'stencilFail'
        | 'stencilZFail'
        | 'stencilZPass'
        | 'stencilWrite'
    >
>;

const materialKeys = [
    'transparent',
    'visible',
    'side',
    'blending',
    'blendSrc',
    'blendDst',
    'blendEquation',
    'blendSrcAlpha',
    'blendDstAlpha',
    'blendEquationAlpha',
    'depthFunc',
    'depthTest',
    'depthWrite',
    'colorWrite',
    'polygonOffset',
    'polygonOffsetFactor',
    'polygonOffsetUnits',
    'stencilWriteMask',
    'stencilFunc',
    'stencilRef',
    'stencilFuncMask',
    'stencilFail',
    'stencilZFail',
    'stencilZPass',
    'stencilWrite',
];
/**
 * Render-state values shared by all materials.
 */
export interface MaterialState {
    transparent: boolean;
    visible: boolean;
    side: Side;

    blending: Blending;
    blendSrc: BlendingFactor;
    blendDst: BlendingFactor;
    blendEquation: BlendingEquation;
    blendSrcAlpha: Nullable<BlendingFactor>;
    blendDstAlpha: Nullable<BlendingFactor>;
    blendEquationAlpha: Nullable<BlendingEquation>;

    stencilWriteMask: number;
    stencilFunc: StencilFunc;
    stencilRef: number;
    stencilFuncMask: number;
    stencilFail: StencilOp;
    stencilZFail: StencilOp;
    stencilZPass: StencilOp;
    stencilWrite: boolean;
    depthFunc: DepthModes;
    depthTest: boolean;
    depthWrite: boolean;

    colorWrite: boolean;
    colorWriteMasks: [boolean, boolean, boolean, boolean];

    polygonOffset: boolean;
    polygonOffsetFactor: number;
    polygonOffsetUnits: number;

    premultipliedAlpha: boolean;
}

/**
 * Color transfer functions.
 */
export enum ColorTransfer {
    Linear, // do nothing.
    SrgbToLinear,
    LinearToSrgb,
    // PQToLinear,
    // LinearToPQ,
}

/**
 * A base class for all materials with some abstract functions.
 * Materials describe the appearance of the objects.
 * They are defined in a (mostly) renderer-independent way, so you don't have to rewrite materials if you decide to use a different renderer.
 * The following properties and methods are inherited by all other material types (although they may have different defaults).
 */
export abstract class Material
    extends ElementEventDispatcher
    implements SerializerableDelegatedAsReference, MaterialState, ElementsWithGPUResource
{
    /**
     * @internal
     */
    isMaterial = true;

    private components: ShaderComponent[] = [];
    private componentNameList = new Set<string>();

    getComponents(): ReadonlyArray<ShaderComponent> {
        return this.components;
    }

    deleteComponent(index: number) {
        const deleted = this.components.splice(index, 1);
        if (deleted.length) {
            ContentBridge.materialDeleteShaderComponent(this, deleted[0], index);
            this.componentNameList.delete(deleted[0].className());
        }
        this.notifyRecompileShader();
    }

    addComponent(c: ShaderComponent, index?: number) {
        if (this.componentNameList.has(c.className())) {
            logger.invalidInput(`material is forbidden to add similar component.`);
            return;
        }

        if (index !== undefined) {
            this.components.splice(index, 0, c);
        } else {
            this.components.push(c);
        }
        this.componentNameList.add(c.className());

        ContentBridge.materialAddShaderComponent(this, c, index);

        this.notifyRecompileShader();
    }

    /**
     * Mark this shape of this material is largely affect by shader.
     * Hint the engine that pick, culling is disabled
     * @deprecated
     */
    isDynamicShape = false;
    /**
     * Mark this material uses volume like rendering technology.
     * Hint the engine that some effect is disabled
     * @deprecated
     */
    isVolumeRendering = false;

    /**
     * max texture count, just in case some platform will take use of some channels by default,
     * so set to 6 instead of 8
     */
    static readonly MAX_TEXTURES = 6;
    /**
     * Optional name of the object (doesn't need to be unique). Default is an empty string.
     */
    name = '';
    /**
     * Unique number for this material instance.
     */
    id: number;
    /**
     * If use transparent effect, this value must be set to true to enable blending.
     * @defaultValue `false`
     */
    @materialProperty()
    transparent = false;

    /**
     * Defines whether this material is visible.
     * @defaultValue `true`
     */
    @materialProperty()
    visible = true;
    /**
     * The id of shader program which this material shader belongs to.
     */
    programId = 0;
    /**
     * This just for control the shader compile behavior, not a state.
     * If this value is set to true, {@link isSupportInstance| isSupportInstance } must be set to true.
     * @internal
     */
    useInstance = false;
    refreshInstanceInBuilding(enable: boolean) {
        this.useInstance = enable;
    }
    /**
     * Set which side of the object will be seen on screen.
     */
    @materialProperty()
    side = Side.FrontSide;
    /**
     * Which blending to use when displaying objects with this material.
     * This must be set to CustomBlending to use custom
     * {@link blendSrc| blendSrc }, {@link blendDst| blendDst } or {@link blendEquation| blendEquation }.
     * See the blending mode constants for all possible values. Default is NormalBlending.
     * @defaultValue {@link Blending.NormalBlending| NormalBlending }
     */
    @materialProperty()
    blending = Blending.NormalBlending;
    /**
     * Blending source. Default is SrcAlphaFactor. See the source factors constants for all possible values.
     * @defaultValue {@link BlendingFactor.SrcAlphaFactor| SrcAlphaFactor }
     */
    @materialProperty()
    blendSrc = BlendingFactor.SrcAlphaFactor;
    /**
     * Blending destination. Default is OneMinusSrcAlphaFactor. See the destination factors constants for all possible values.
     * @defaultValue {@link BlendingFactor.OneMinusSrcAlpha| OneMinusSrcAlpha }
     */
    @materialProperty()
    blendDst = BlendingFactor.OneMinusSrcAlpha;
    /**
     * Blending equation to use when applying blending. Default is AddEquation. See the blending equation constants for all possible values.
     * @defaultValue {@link BlendingEquation.Add| Add }
     */
    @materialProperty()
    blendEquation = BlendingEquation.Add;
    /**
     * The transparency of the {@link blendSrc| blendSrc }.
     */
    @materialProperty()
    blendSrcAlpha: Nullable<BlendingFactor> = null;
    /**
     * The transparency of the {@link blendDst| blendDst }.
     */
    @materialProperty()
    blendDstAlpha: Nullable<BlendingFactor> = null;
    /**
     * The transparency of the {@link blendEquation| blendEquation }.
     */
    @materialProperty()
    blendEquationAlpha: Nullable<BlendingEquation> = null;
    /**
     * Whether rendering this material has any effect on the stencil buffer.
     * @defaultValue `false`
     */
    @materialProperty()
    stencilWrite = false;
    /**
     * The bit mask to use when writing to the stencil buffer.
     * @defaultValue `0xFF`
     */
    @materialProperty()
    stencilWriteMask = 0xff;
    /**
     * The bit mask to use when comparing against the stencil buffer.
     * @defaultValue `0xFF`
     */
    @materialProperty()
    stencilFuncMask = 0xff;
    /**
     * The stencil comparison function to use.
     * @defaultValue {@link StencilFunc.AlwaysStencilFunc| AlwaysStencilFunc }
     */
    @materialProperty()
    stencilFunc = StencilFunc.AlwaysStencilFunc;
    /**
     * The value to use when performing stencil comparisons or stencil operations.
     * @defaultValue `0`
     */
    @materialProperty()
    stencilRef = 0;
    /**
     * Which stencil operation to perform when the comparison function returns false.
     * @defaultValue {@link StencilOp.KeepStencilOp| KeepStencilOp }
     */
    @materialProperty()
    stencilFail = StencilOp.KeepStencilOp;
    /**
     * Which stencil operation to perform when the comparison function returns true but the depth test fails.
     * @defaultValue {@link StencilOp.KeepStencilOp| KeepStencilOp }
     */
    @materialProperty()
    stencilZFail = StencilOp.KeepStencilOp;
    /**
     * Which stencil operation to perform when the comparison function returns true and the depth test passes.
     * @defaultValue {@link StencilOp.KeepStencilOp| KeepStencilOp }
     */
    @materialProperty()
    stencilZPass = StencilOp.KeepStencilOp;
    /**
     * Which depth function to use.
     * @defaultValue {@link DepthModes.LessEqualDepth| LessEqualDepth }
     */
    @materialProperty()
    depthFunc = DepthModes.LessEqualDepth;
    /**
     * Whether to have depth test enabled when rendering this material.
     * If this is set to false, this object's occluding relationship will depend on {@link Object3D.renderOrder| renderOrder }.
     * @defaultValue `true`
     */
    @materialProperty()
    depthTest = true;
    /**
     * Whether rendering this material has any effect on the depth buffer.
     * @defaultValue `true`
     */
    @materialProperty()
    depthWrite = true;
    /**
     * Whether to render the material's color.
     * This can be used in conjunction with a {@link Object3D.renderOrder| renderOrder } property to create invisible objects that occlude other objects.
     * @defaultValue `true`
     */
    @materialProperty()
    colorWrite = true;
    @materialProperty()
    colorWriteMasks: [boolean, boolean, boolean, boolean] = [true, true, true, true];
    setColorWriteMasks(r: boolean, g: boolean, b: boolean, a: boolean) {
        this.colorWriteMasks = [r, g, b, a];
    }
    /**
     * Whether to use polygon offset.
     * @defaultValue `false`
     */
    @materialProperty()
    polygonOffset = false;
    /**
     * Sets the polygon offset factor.
     * @defaultValue `0`
     */
    @materialProperty()
    polygonOffsetFactor = 0;
    /**
     * Sets the polygon offset units.
     * @defaultValue `0`
     */
    @materialProperty()
    polygonOffsetUnits = 0;
    /**
     * Whether to premultiply the alpha (transparency) value.
     * @defaultValue `false`
     */
    @materialProperty()
    premultipliedAlpha = false;
    private _shaderKey?: string;
    private _shapeKey?: string;
    /**
     * An optionally overriding method for extents to get data from renderer before update uniforms.
     * @param {Renderer} renderer instance of renderer for engine.
     */
    onBeforeRender?: (renderer: Renderer) => void;
    /**
     * When user change the material property manually, this method need to use to refresh data.
     */
    notifyMaterialPropertyChanged() {
        this.emit(MaterialPropertyChangeEvent, this);
    }
    /**
     * User can give any parameter to create new instance with corresponding properties.
     */
    constructor(params?: MaterialParameters) {
        super();
        ContentBridge.materialCreate(this);
        this.setValues(params);
        this.id = materialId++;
    }
    colorWriteMask: [boolean, boolean, boolean, boolean];
    /**
     * UUID of this material instance. This gets automatically assigned, so this shouldn't be edited.
     */
    getUUID(): string {
        return this.uuid;
    }
    /**
     * @internal
     */
    createShader(registry: ShaderComponentRegistry): ShaderInfo {
        const builder = new ShaderBuilder();
        this.extendShader(builder, registry);
        return builder.build();
    }
    /**
     * @internal
     */
    extendShader(builder: ShaderBuilder, registry: ShaderComponentRegistry) {
        this.extendShaderShape(builder, registry);
        this.extendShaderShading(builder, registry);
        this.components.forEach(c => {
            c.extendShaderShape(builder);
            c.extendShaderShading(builder);
        });
    }
    /**
     * @internal
     */
    updateUniforms(program: WGLProgram, registry: ShaderComponentRegistry) {
        this.updateShadingUniforms(program, registry);
        this.updateShapeUniforms(program, registry);
        for (let i = 0; i < this.components.length; i++) {
            const c = this.components[i];
            if (c.updateShapeUniforms) {
                c.updateShapeUniforms(program);
            }
            if (c.updateShadingUniforms) {
                c.updateShadingUniforms(program);
            }
        }
    }
    /**
     * The name of instance's class.
     */
    abstract className(): string;
    /**
     * @internal
     */
    abstract extendShaderShape(builder: ShaderBuilder, registry: ShaderComponentRegistry): void;
    /**
     * @internal
     */
    abstract extendShaderShading(builder: ShaderBuilder, registry: ShaderComponentRegistry): void;
    /**
     * @internal
     */
    abstract updateShapeUniforms(program: WGLProgram, registry: ShaderComponentRegistry): void;
    /**
     * @internal
     */
    abstract updateShadingUniforms(program: WGLProgram, registry: ShaderComponentRegistry): void;

    /**
     * abstract function to clone each instance of the class
     */
    abstract clone(): Material;
    /**
     * abstract function to copy a same type material instance
     */
    abstract copy(other: Material): void;
    /**
     * @internal
     */
    canDraw() {
        return true;
    }
    /**
     * Sets the properties with the given values.
     * In extents class, this method need to override in extended material for corresponding parameters.
     */
    setValues(values?: MaterialParameters) {
        this.notifyMaterialPropertyChanged();
        if (values === undefined) {
            return;
        }
        Utils.copyProperties(materialKeys, this, values);
    }
    /**
     * Generate a unique key for shader.
     * @internal
     */
    getShaderKey(registry: ShaderComponentRegistry) {
        if (this._shaderKey === undefined) {
            this._shaderKey = this.generateShaderKey(registry); // including component shader keys
        }
        return this._shaderKey;
    }
    /**
     * Generate a unique shape key for ShapeExtractableDispatcher.
     * @internal
     */
    getShapeKey(registry: ShaderComponentRegistry): string {
        if (this._shapeKey === undefined) {
            this._shapeKey =
                this.computeShapeKey(registry) +
                this.components.map(c => {
                    // include className only if it has computeShapeKey
                    return c.computeShapeKey ? c.className() + c.computeShapeKey() : '';
                });
        }
        return this._shapeKey;
    }
    /**
     * Reset the key of shader and force engine to compile shader again.
     */
    notifyRecompileShader() {
        this.emit(MaterialRecompileShaderEvent, this);
        this._shaderKey = undefined;
        this._shapeKey = undefined;
    }
    /**
     * Copy basic properties from other material.
     * @param {Material} other the source of copied data
     */
    copyBase(other: Material) {
        this.visible = other.visible;
        this.transparent = other.transparent;
        this.side = other.side;
        this.blending = other.blending;
        this.blendSrc = other.blendSrc;
        this.blendDst = other.blendDst;
        this.blendEquation = other.blendEquation;
        this.blendSrcAlpha = other.blendSrcAlpha;
        this.blendDstAlpha = other.blendDstAlpha;
        this.blendEquationAlpha = other.blendEquationAlpha;
        this.depthFunc = other.depthFunc;
        this.depthTest = other.depthTest;
        this.depthWrite = other.depthWrite;
        this.colorWrite = other.colorWrite;
        this.polygonOffset = other.polygonOffset;
        this.polygonOffsetFactor = other.polygonOffsetFactor;
        this.polygonOffsetUnits = other.polygonOffsetUnits;
        this.premultipliedAlpha = other.premultipliedAlpha;
        other.components.forEach(c => {
            this.addComponent(c.clone());
        });
        this.metaData = { ...other.metaData };
        this.notifyRecompileShader();
    }
    /**
     * Make engine clear the current material's data in Ubo.
     */
    freeGPU() {
        this.emit(MaterialDisposeEvent, this);
        this.notifyRecompileShader();
        ContentBridge.materialFreeGPU(this);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx this parameter has not supported external Serializer yet.
     * It may cause that this method can not be used directly.
     */
    serialize(ctx: Serializer): any {
        ctx.puts<Material>(keys);
        const componentsData = this.components.map(component => {
            const data = ctx.serialize(component);
            return {
                typeName: component.className(),
                data,
            };
        });
        ctx.putRaw('components', componentsData);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx this parameter has not supported external Deserializer yet.
     * It may cause that this method can not be used directly.
     */
    deserialize(ctx: Deserializer) {
        ctx.reads<Material>(keys);
        const componentsData = ctx.readRaw('components');
        if (componentsData) {
            componentsData.forEach((componentData: any) => {
                const component = ctx.deserialize<ShaderComponent>(componentData);
                if (component instanceof Promise) {
                    component.then(c => {
                        this.addComponent(c);
                    });
                } else {
                    this.addComponent(component as ShaderComponent);
                }
            });
        }
    }
    /**
     * Use this to traverse material which has texture need to process.
     * @param {function} _visitor a method to process {@link Texture| texture}.
     * @internal
     */
    traverseTexture(_visitor: (tex: Texture) => void) {}
    /**
     * Execute the given method for every ubo.
     * @param {function} _visitor a method to process ubo.
     * @internal
     */
    traverseUBO(_visitor: (ubo: UniformBlockObject) => void) {}
    /**
     * Generate a basic key for material, and engine will recompile shader if this key is changed.
     * This method may override in extended class.
     * @internal
     */
    generateShaderKey(_registry: ShaderComponentRegistry): string {
        return (
            this.className() +
            this.components.map(c => {
                return c.className() + (c.generateShaderKey ? c.generateShaderKey() : '');
            })
        );
    }
    /**
     * @internal
     */
    abstract computeShapeKey(registry: ShaderComponentRegistry): string;

    destroyAllResourcesOwned() {
        this.traverseTexture(t => t.destroy());
        this.destroy();
    }

    freeAllGpuResourceOwned() {
        this.traverseTexture(t => t.freeGPU());
        this.freeGPU();
    }
}

const keys: Array<SerializerablePartKeys<Material>> = [
    'name',
    'id',
    'transparent',
    'visible',
    'side',
    'blending',
    'blendSrc',
    'blendDst',
    'blendEquation',
    'blendSrcAlpha',
    'blendDstAlpha',
    'blendEquationAlpha',
    'depthFunc',
    'depthTest',
    'depthWrite',
    'colorWrite',
    'polygonOffset',
    'polygonOffsetFactor',
    'polygonOffsetUnits',
    'premultipliedAlpha',
    'stencilWriteMask',
    'stencilFunc',
    'stencilRef',
    'stencilFuncMask',
    'stencilFail',
    'stencilZFail',
    'stencilZPass',
    'stencilWrite',
];
