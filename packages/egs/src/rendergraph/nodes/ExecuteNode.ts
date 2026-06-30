import { DAGNode } from './DAGNode.js';
import { EventType } from '../../utils/EventDispatcher.js';
import { EventDispatcher } from '../../utils/EventDispatcher.js';

export const ExecuteBeforeEvent = new EventType();
export const ExecuteAfterEvent = new EventType();

// Processing node class, which is abstract, could be a PassNode, TransformerNode or SourceNode
// Any class extends this is a node which could be regarded as a process of dealing the resources
export abstract class ExecuteNode<ExecuteCtx = unknown> extends DAGNode {
    protected readonly executeHooks = new EventDispatcher();

    before(callback: (ctx: ExecuteCtx) => void) {
        this.executeHooks.on(ExecuteBeforeEvent, callback);
        return this;
    }

    after(callback: (ctx: ExecuteCtx) => void) {
        this.executeHooks.on(ExecuteAfterEvent, callback);
        return this;
    }

    emit<T>(event: EventType<T>, data: T) {
        this.executeHooks.emit(event, data);
    }

    abstract execute(ctx: ExecuteCtx): void;
    abstract check(): boolean;
}
