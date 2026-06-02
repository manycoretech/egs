import { logger } from '../utils/Logger';
import { RenderGraph } from './RenderGraph';
import { RendererAdaptor } from '../fx/RendererAdaptor';
import { AttachmentPool } from './AttachmentPool';
import { RenderTarget, RenderAttachment } from '../elements/textures/RenderTarget';
import { RenderTargetNode } from '../rendergraph/nodes/RenderTargetNode';
import { ExecuteBeforeEvent, ExecuteAfterEvent } from './nodes/ExecuteNode';
import type { OverrideScreenOutputTarget } from './nodes/PassNode';
import { Texture } from '../elements/textures/Texture';
import { RenderAttachmentNode } from './nodes/RenderAttachmentNode';

// Responsible for rendergraph execution
export class EffectComposer {
    overrideScreenOutputTarget?: OverrideScreenOutputTarget;

    private renderer: RendererAdaptor;
    private attachmentPool: AttachmentPool;
    private targets = new Map<string, RenderTarget>();
    private attachments = new Map<string, RenderAttachment>(); // alive attachments

    constructor(renderer: RendererAdaptor) {
        this.renderer = renderer;
        this.attachmentPool = new AttachmentPool();
    }

    _getFrameBuffer(key: string) {
        return this.targets.get(key);
    }

    private getAttachment(node: RenderAttachmentNode) {
        const { attachmentPool, attachments } = this;
        node.updateSize(this.renderer);
        const currentKey = node.formatKey;
        let attachment = attachments.get(node.name);
        if (attachment && attachment.metaData.cachedKey !== currentKey) {
            attachmentPool.release(attachment.metaData.cachedKey, attachment);
            attachments.delete(node.name);
            attachment = undefined;
        }
        if (!attachment) {
            attachment = attachmentPool.request(node, this.renderer.renderer);
            attachments.set(node.name, attachment);
        }
        attachment.metaData.cachedKey = currentKey;
        return attachment;
    }

    private getFrameBuffer(node: RenderTargetNode): RenderTarget {
        node.updateSize(this.renderer);
        let target = this.targets.get(node.name);
        if (target) {
            target.setSize(node.width, node.height, node.depthOrArrayLayers);
        } else {
            target = new RenderTarget(node.width, node.height, node.depthOrArrayLayers, node.multiSample);
            this.targets.set(node.name, target);
        }
        const colors = node.colorAttachments.map(v => this.getAttachment(v));
        const depth = node.depthAttachment ? this.getAttachment(node.depthAttachment) : undefined;
        target.setAttachments(colors, depth);
        return target;
    }

    // through a specific scene, execute all passes of the graph
    render(graph: RenderGraph) {
        if (!graph.isValid) {
            logger.invalidInput('graph is invalid.');
            return;
        }
        const passNodes = graph.passNodes;
        if (passNodes.length === 0) {
            logger.invalidInput('graph is empty, maybe missing build');
            return;
        }

        passNodes.forEach((pass, i) => {
            const target = pass.target.isScreenNode ? undefined : this.getFrameBuffer(pass.target);
            const resolveTarget = pass.resolveTarget ? this.getFrameBuffer(pass.resolveTarget) : undefined;
            pass.updateResource(node => {
                const resource = this.attachments.get(node.name);
                if (!resource) {
                    logger.unreachable(`attachment not found <${node.name}> in effect pipeline's render`);
                }
                return resource as Texture;
            });

            const ctx = { renderer: this.renderer, target, resolveTarget, overrideScreenOutputTarget: this.overrideScreenOutputTarget };
            pass.emit(ExecuteBeforeEvent, ctx);

            if (pass.isCustomPass) {
                pass.execute(ctx);
            } else {
                pass.bindTarget(ctx);
                pass.configRenderPass(ctx);
                ctx.renderer.renderer.beginPass(pass.needStoreOutput, pass.needResolveContent, pass.needResolveDepth, pass.needGenerateMipmap, pass.drivenMaterial);
                pass.execute(ctx);
                ctx.renderer.renderer.endPass();
            }

            pass.emit(ExecuteAfterEvent, ctx);

            graph.dropResources[i].forEach(node => {
                const resource = this.attachments.get(node.name)!;
                this.attachmentPool.release((node as RenderAttachmentNode).formatKey, resource);
                this.attachments.delete(node.name);
            });
        });
        this.renderer.renderer.flushCommands();
        this.attachmentPool.free();
    }

    clear() {
        this.targets.clear();
        this.attachments.forEach(v => v.destroy());
        this.attachments.clear();
        this.attachmentPool.clear();
    }
}
