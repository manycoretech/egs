import { type Size, type ResizeFN, defaultResizeFN } from './utils';
import { DAGNode } from './DAGNode';
import {
    RenderColorAttachmentNode,
    RenderDepthAttachmentNode,
    type RenderAttachmentNode,
} from './RenderAttachmentNode';
import type { PassNode } from './PassNode';
import { TextureViewDimension } from '../../elements/textures/types';

export class RenderTargetNode extends DAGNode {
    readonly isScreenNode: boolean;

    width: number = 4;
    height: number = 4;
    depthOrArrayLayers: number = 1;
    multiSample: boolean = false;
    dimension: TextureViewDimension = TextureViewDimension.D2;
    resizeFn: ResizeFN = defaultResizeFN;

    colorAttachments: RenderColorAttachmentNode[] = [];
    depthAttachment?: RenderDepthAttachmentNode;

    constructor(name: string, isScreenNode: boolean = false) {
        super(name);
        this.isScreenNode = isScreenNode;
    }

    modify(fn: (node: RenderTargetNode) => void) {
        fn(this);
        return this;
    }

    keepContent() {
        this.colorAttachments.forEach(color => color.keepContent());
        if (this.depthAttachment) {
            this.depthAttachment.keepContent();
        }
        return this;
    }

    resize(fn: ResizeFN) {
        this.resizeFn = fn;
        this.colorAttachments.forEach(color => (color.resizeFn = fn));
        if (this.depthAttachment) {
            this.depthAttachment.resizeFn = fn;
        }
        return this;
    }

    enableMultiSample() {
        this.multiSample = true;
        this.colorAttachments.forEach(color => (color.multiSample = true));
        if (this.depthAttachment) {
            this.depthAttachment.multiSample = true;
        }
        return this;
    }

    disableStencil() {
        if (this.depthAttachment) {
            this.depthAttachment.enableStencil = false;
        }
        return this;
    }

    setFilter(linearFilter: boolean, mipmap?: boolean, range?: number[]) {
        const attachments = range ? range.map(r => this.colorAttachments[r]) : this.colorAttachments;
        for (let i = 0; i < attachments.length; i++) {
            const attachment = attachments[i];
            attachment.setFilter(linearFilter, mipmap);
        }
        return this;
    }

    attach(node: RenderAttachmentNode, attachIndex?: number) {
        if (node instanceof RenderColorAttachmentNode) {
            if (attachIndex === undefined) {
                this.colorAttachments.push(node);
                node.connect(this);
                return this;
            }
            const prev = this.colorAttachments[attachIndex];
            if (prev) {
                prev.disconnect(this);
            }
            this.colorAttachments[attachIndex] = node;
            node.connect(this);
        } else if (node instanceof RenderDepthAttachmentNode) {
            this.depthAttachment?.disconnect(this);
            this.depthAttachment = node;
            node.connect(this);
        }
        return this;
    }

    from(node: PassNode | Array<PassNode | undefined>) {
        const nodes = Array.isArray(node) ? (node.filter(n => n !== undefined) as PassNode[]) : [node];
        // keep nodes order
        for (let i = 0; i < nodes.length - 1; i++) {
            nodes[i].connect(nodes[i + 1]);
        }
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            node.connect(this);
            node.target = this;
        }
        return this;
    }

    private checkAttachmentNode(node: RenderAttachmentNode): boolean {
        return (
            node.dimension === this.dimension &&
            node.multiSample === this.multiSample &&
            node.resizeFn === this.resizeFn
        );
    }

    check(): boolean {
        const { colorAttachments, depthAttachment } = this;
        for (let i = 0; i < colorAttachments.length; i++) {
            const color = colorAttachments[i];
            if (!this.checkAttachmentNode(color)) {
                return false;
            }
        }
        if (depthAttachment && !this.checkAttachmentNode(depthAttachment)) {
            return false;
        }
        return true;
    }

    updateSize(size: Size) {
        const { width, height, depthOrArrayLayers } = this.resizeFn(size);
        this.width = width;
        this.height = height;
        if (depthOrArrayLayers != null) {
            this.depthOrArrayLayers = depthOrArrayLayers;
        }
    }
}
