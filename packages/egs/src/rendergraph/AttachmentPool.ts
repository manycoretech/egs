import {
    RenderColorAttachmentNode,
    type RenderAttachmentNode,
    RenderDepthAttachmentNode,
} from './nodes/RenderAttachmentNode';
import { WGLCapabilities } from '../renderer/webgl/WGLCapabilities';
import { RenderAttachment } from '../elements/textures/RenderTarget';
import { getDepthFormat, toTextureDimension } from '../elements/textures/types';
import type { IRenderer } from '../renderer/IRenderer';

// Maintain the fbo storage in rendergraph
export class AttachmentPool {
    private availableAttachments = new Map<string, RenderAttachment[]>();
    private lastUsages = new Set<RenderAttachment>();

    request(node: RenderAttachmentNode, renderer: IRenderer): RenderAttachment {
        let attachment: RenderAttachment | undefined;
        const releaseList = this.availableAttachments.get(node.formatKey);
        if (releaseList && releaseList.length > 0) {
            attachment = releaseList.pop();
        }
        if (!attachment) {
            if (node instanceof RenderColorAttachmentNode) {
                attachment = new RenderAttachment(
                    toTextureDimension(node.dimension),
                    node.dimension,
                    node.format,
                    node.width,
                    node.height,
                    node.depthOrArrayLayers,
                    node.enableMipmap,
                    node.multiSample ? 4 : 1,
                    false,
                    node.sampler,
                );
            } else if (node instanceof RenderDepthAttachmentNode) {
                const format = getDepthFormat(node.enableStencil, renderer.backend);
                const forceRenderBuffer = !(WGLCapabilities.IS_SUPPORT_DEPTH_TEXTURE && node.enableTexture);
                attachment = new RenderAttachment(
                    toTextureDimension(node.dimension),
                    node.dimension,
                    format,
                    node.width,
                    node.height,
                    node.depthOrArrayLayers,
                    false,
                    node.multiSample ? 4 : 1,
                    forceRenderBuffer,
                    node.sampler,
                );
            } else {
                throw new Error('unknown attachment node type.');
            }
        }
        attachment.name = node.name;
        this.lastUsages.add(attachment);
        return attachment;
    }

    release(key: string, attachment: RenderAttachment) {
        const releaseList = this.availableAttachments.get(key) ?? [];
        releaseList.push(attachment);
        this.availableAttachments.set(key, releaseList);
    }

    free() {
        const { availableAttachments, lastUsages: lastUsageResource } = this;
        const keys = Array.from(availableAttachments.keys());
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const result: RenderAttachment[] = [];
            const attachments = availableAttachments.get(key)!;
            for (let j = 0; j < attachments.length; j++) {
                const attachment = attachments[j];
                if (!lastUsageResource.has(attachment)) {
                    attachment.destroy();
                    continue;
                }
                result.push(attachment);
            }
            availableAttachments.set(key, result);
        }
        lastUsageResource.clear();
    }

    clear() {
        const attachments = Array.from(this.availableAttachments.values());
        for (let i = 0; i < attachments.length; i++) {
            const attachment = attachments[i];
            attachment.forEach(v => v.destroy());
        }
        this.availableAttachments.clear();
        this.lastUsages.clear();
    }
}
