import { DAGNode } from './DAGNode.js';
import { RenderTargetNode } from './RenderTargetNode.js';
import { RenderColorAttachmentNode } from './RenderAttachmentNode.js';

function target(name: string) {
    const target = new RenderTargetNode(name);
    target.attach(new RenderColorAttachmentNode(`${name}-default-color`));
    return target;
}

export class PingPongTargetNode extends DAGNode {
    private tickId: number = 0;

    tick() {
        this.tickId++;
    }

    get evenTick() {
        return this.tickId % 2 === 0;
    }

    // always for input
    ping() {
        return (this.evenTick ? target(this.name + '-A') : target(this.name + '-B')).keepContent();
    }

    // always for output
    pong() {
        return (this.evenTick ? target(this.name + '-B') : target(this.name + '-A')).keepContent();
    }
}
