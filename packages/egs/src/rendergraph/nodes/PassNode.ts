import type { RendererAdaptor } from '../../fx/RendererAdaptor.js';
import { Vector4 } from '../../math/Vector4.js';
import type { MaterialDispatcher } from '../../renderer/MaterialDispatcher.js';
import type { Nullable } from '../../utils/Utils.js';
import { ExecuteNode } from './ExecuteNode.js';
import type { Renderable } from '../../scene/renderables/IRenderable.js';
import type { RenderTargetNode } from './RenderTargetNode.js';
import { logger } from '../../utils/Logger.js';
import type { RenderTarget } from '../../elements/textures/RenderTarget.js';
import type { DrivenMaterial } from '../../elements/materials/driven/DrivenMaterial.js';
import type { ResourceNode } from './ResourceNode.js';
import type { Texture } from '../../elements/textures/Texture.js';

export type RenderMethod = (renderer: RendererAdaptor, target?: RenderTarget, i?: number) => void;
export type ConfigMethod = (renderer: RendererAdaptor) => boolean;
export type CustomPassMethod = (node: PassNode, ctx: PassExecuteCtx) => void;

export interface RenderSource {
    /**
     * used to update render pass, such as clear
     */
    config?: ConfigMethod;
    /**
     * do render
     */
    render: RenderMethod;
}

export const EMPTY_RENDER_SOURCE: RenderSource = {
    render() {},
};

type AttachmentDescriptor = number | 'depth';

export interface OverrideScreenOutputTarget {
    target: RenderTarget;
    resolveTarget?: RenderTarget;
}

export interface PassExecuteCtx {
    renderer: RendererAdaptor;
    target?: RenderTarget;
    resolveTarget?: RenderTarget;
    overrideScreenOutputTarget?: OverrideScreenOutputTarget;
}

/**
 * render processing class, as a render pass, can customize uniform、target and renderMethod
 * normal pass: beforeHook -> bindTarget -> configRenderPass -> renderer.beginPass(composer) -> execute -> renderer.endPass(composer) -> afterHook
 * custom pass(when customPassMethod configured): beforeHook -> execute -> afterHook
 */
export class PassNode extends ExecuteNode<PassExecuteCtx> {
    target: RenderTargetNode;
    resolveTarget?: RenderTargetNode;
    dependResources: Set<ResourceNode> = new Set();

    private writeTargetLevel = 0;
    writeLevel(level: number) {
        this.writeTargetLevel = level;
        return this;
    }

    private writeTargetBuffers?: number[] = undefined;
    writeBuffers(buffers?: number[]) {
        this.writeTargetBuffers = buffers;
        return this;
    }

    private dispatcher: Nullable<MaterialDispatcher> = null;
    useDispatcher(d: MaterialDispatcher | undefined) {
        this.dispatcher = d ?? null;
        return this;
    }

    private clearColor = new Vector4(1, 1, 1, 1);
    setClearColor(c: Vector4) {
        this.clearColor.copy(c);
        return this;
    }

    private isColorClearEnabled: boolean = true;
    private isDepthClearEnabled: boolean = true;
    enableClear(color: boolean = true, depth: boolean = true) {
        this.isColorClearEnabled = color;
        this.isDepthClearEnabled = depth;
        return this;
    }
    disableClear() {
        this.isColorClearEnabled = false;
        this.isDepthClearEnabled = false;
        return this;
    }

    private clearConfig: Nullable<() => boolean> = null;
    setClearConfig(isClear: () => boolean) {
        this.clearConfig = isClear;
        return this;
    }

    private _needResolveContent: boolean = false;
    private _needResolveDepth: boolean = false;
    private _needGenerateMipmap: boolean = false;
    resolveTo(resolveTarget?: RenderTargetNode, resolveDepth = false, generateMipmap = false) {
        this.resolveTarget = resolveTarget;
        if (resolveTarget) {
            resolveTarget.depend(this);
        }
        this._needResolveContent = true;
        this._needResolveDepth = resolveDepth;
        this._needGenerateMipmap = generateMipmap;
        return this;
    }

    resolveToScreen(resolveDepth = false, generateMipmap = false) {
        if (this.resolveTarget) {
            this.resolveTarget.disconnect(this);
            this.resolveTarget = undefined;
        }
        this._needResolveContent = true;
        this._needResolveDepth = resolveDepth;
        this._needGenerateMipmap = generateMipmap;
    }

    get needResolveContent() {
        return this._needResolveContent;
    }

    get needResolveDepth() {
        return this._needResolveDepth;
    }

    get needGenerateMipmap() {
        return this._needGenerateMipmap;
    }

    drivenMaterial?: DrivenMaterial;
    useDriven(material?: DrivenMaterial) {
        this.drivenMaterial = material;
        return this;
    }

    private _needStoreOutput: boolean = true;
    /**
     * whether discard attachments.
     * for webgpu set storeOp to 'discard' in begin render pass
     * for webgl will call invalidateFramebuffer.
     */
    discardOutput() {
        this._needStoreOutput = false;
        return this;
    }

    get needStoreOutput() {
        return this._needStoreOutput;
    }

    // if this pass use a override material, input will act as override material texture input
    private renderMethods: RenderMethod[] = [];
    private configMethods: ConfigMethod[] = [];
    private inputs = new Map<string, ResourceNode>();
    private resources = new Map<string, Texture>();
    private customPassMethod: CustomPassMethod | undefined | null = undefined;

    get isCustomPass() {
        return !!this.customPassMethod;
    }

    input(key: string, dependNode: RenderTargetNode, attachment: AttachmentDescriptor = 0) {
        const prev = this.inputs.get(key);
        if (prev) {
            this.dependResources.delete(prev);
            prev.disconnect(this);
        }
        const resource =
            attachment === 'depth' ? dependNode.depthAttachment! : dependNode.colorAttachments[attachment]!;
        this.inputs.set(key, resource);
        this.dependResources.add(resource);
        resource.connect(this);
        dependNode.connect(this);
        return this;
    }

    modify(fn: (node: PassNode) => void) {
        fn(this);
        return this;
    }

    updateResource(getResource: (node: ResourceNode) => Texture) {
        this.inputs.forEach((node, name) => {
            this.resources.set(name, getResource(node));
        });
    }

    clear() {
        this.renderMethods = [];
        this.inputs.forEach(n => n.disconnect(this));
        this.inputs.clear();
        this.dependResources.clear();
        return this;
    }

    use(source: RenderSource | RenderMethod) {
        if (typeof source === 'function') {
            this.renderMethods.push(source);
        } else {
            this.renderMethods.push(source.render);
            if (source.config) {
                this.configMethods.push(source.config);
            }
        }
        return this;
    }

    // full control all the process of this pass.
    // includes bind target, config, render and resolve.
    customPass(source: CustomPassMethod) {
        this.customPassMethod = source;
        return this;
    }

    render(source: RenderMethod) {
        this.renderMethods.push(source);
        return this;
    }

    config(source: ConfigMethod) {
        this.configMethods.push(source);
        return this;
    }

    useIf(shouldRender: () => boolean, source: RenderSource | RenderMethod) {
        if (typeof source === 'function') {
            this.renderMethods.push((r, t) => {
                if (shouldRender()) {
                    source(r, t);
                }
            });
        } else {
            this.renderMethods.push((r, t) => {
                if (shouldRender()) {
                    source.render(r, t);
                }
            });
            if (source.config) {
                this.configMethods.push(r => {
                    if (shouldRender()) {
                        return source.config?.(r) ?? true;
                    }
                    return true;
                });
            }
        }
        return this;
    }

    useIfAndDisableClear(shouldRender: () => boolean, source: RenderSource | RenderMethod) {
        this.useIf(shouldRender, source);
        this.setClearConfig(shouldRender);
        return this;
    }

    draw(renderable: () => Renderable) {
        this.configMethods.push(r => renderable().config(r.renderer));
        this.renderMethods.push(r => renderable().render(r.renderer));
        return this;
    }

    // set pass render target info.
    bindTarget(ctx: PassExecuteCtx) {
        const { renderer, target, resolveTarget, overrideScreenOutputTarget } = ctx;

        let outputTarget = target;
        let resolveOutputTarget = resolveTarget;
        if (this.target.isScreenNode && overrideScreenOutputTarget) {
            outputTarget = overrideScreenOutputTarget.target;
            resolveOutputTarget = overrideScreenOutputTarget.resolveTarget;
        }
        if (outputTarget) {
            outputTarget.setBindInfo(this.writeTargetLevel, this.writeTargetBuffers);
            renderer.setRenderTarget(outputTarget, resolveOutputTarget);
        } else {
            renderer.setRenderToScreen();
        }
    }

    /**
     * setup clear or other render pass configs.
     * @returns whether current pass can be merged into previous pass.
     */
    configRenderPass(ctx: PassExecuteCtx) {
        const { renderer } = ctx;

        renderer.setClearColor(this.clearColor);

        // set clear value & flags.
        let batchable = true;
        if (this.clearConfig) {
            const enable = this.clearConfig();
            this.isColorClearEnabled = enable;
            this.isDepthClearEnabled = enable;
        }
        renderer.clear(this.isColorClearEnabled, this.isDepthClearEnabled);
        batchable = !this.isColorClearEnabled && !this.isDepthClearEnabled;
        for (const config of this.configMethods) {
            const r = config(renderer);
            batchable = batchable && r;
        }
        return batchable;
    }

    execute(ctx: PassExecuteCtx) {
        const { renderMethods: source, dispatcher: overrideDispatcher, drivenMaterial } = this;
        const { renderer, target } = ctx;

        if (overrideDispatcher) {
            overrideDispatcher.update();
        }
        renderer.renderer.overrideDispatcher = overrideDispatcher;
        renderer.activeResources = this.resources;
        if (drivenMaterial) {
            this.resources.forEach((resource, name) => ((drivenMaterial as any)[name] = resource));
        }

        // run custom pass and ignore all processes
        // active resources and dispatcher already updated
        if (this.customPassMethod) {
            this.customPassMethod(this, ctx);
            renderer.renderer.overrideDispatcher = null;
            return;
        }

        // render
        for (let i = 0; i < source.length; i++) {
            source[i](renderer, target);
        }

        renderer.renderer.overrideDispatcher = null;
    }

    check(): boolean {
        if (this.renderMethods.length === 0 && !this.customPassMethod) {
            logger.unsupported('your pass has no render source');
            return false;
        }

        return true;
    }
}
