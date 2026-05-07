import { DAGNode } from './DAGNode';

// resource node class, which is abstract. It could be a renderTargetNode or a drawcallListNode
// any class extends this in the Graph is includes only the data needs to be rendered
export abstract class ResourceNode extends DAGNode {
    isKeepContent: boolean = false;
    keepContent() {
        this.isKeepContent = true;
        return this;
    }
}
