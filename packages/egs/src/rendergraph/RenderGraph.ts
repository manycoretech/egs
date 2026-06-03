import { PassNode } from './nodes/PassNode';
import type { RenderTargetNode } from './nodes/RenderTargetNode';
import { ResourceNode } from './nodes/ResourceNode';
import type { DAGNode } from './nodes/DAGNode';

export class RenderGraph {
    private initialized: boolean = false;

    private _isValid = false;
    get isValid() {
        return this._isValid;
    }

    private root: RenderTargetNode;
    private nodes: DAGNode[] = [];

    private _depthTarget?: RenderTargetNode;
    get depthTarget() {
        return this._depthTarget;
    }
    set depthTarget(v: RenderTargetNode | undefined) {
        if (!this._depthTarget) {
            this._depthTarget = v;
        }
    }

    sceneCullingPass?: PassNode;

    dropResources: Array<Set<ResourceNode>> = [];

    private cachedPassNodes?: PassNode[];
    get passNodes(): PassNode[] {
        if (!this.cachedPassNodes) {
            this.cachedPassNodes = this.nodes.filter(node => node instanceof PassNode) as PassNode[];
        }
        return this.cachedPassNodes;
    }

    constructor(root: RenderTargetNode) {
        this.root = root;
    }

    reset() {
        this.nodes = [];
        this.dropResources = [];
        this.cachedPassNodes = undefined;
        this.initialized = false;
        return this;
    }

    private passList: Array<PassNode | undefined> = [];
    addPass(node: PassNode | Array<PassNode | undefined>) {
        const nodes = Array.isArray(node) ? node : [node];
        this.passList.push(...nodes);
    }

    removePass(name: string): PassNode | undefined {
        let result: PassNode | undefined;
        const i = this.passList.findIndex(pass => pass?.name === name);
        if (i > -1) {
            result = this.passList[i];
            this.passList[i] = undefined;
        }
        return result;
    }

    removeAllPasses(): PassNode[] {
        const result = this.passList.filter(pass => !!pass) as PassNode[];
        this.passList = [];
        return result;
    }

    lastValidPass(): PassNode | undefined {
        while (!this.passList[this.passList.length - 1]) {
            this.passList.pop(); // remove tailing undefined passes.
        }
        return this.passList[this.passList.length - 1];
    }

    // build the pass queue from current graph structure
    build() {
        if (this.initialized) {
            return this;
        }

        // create topological sort
        this.nodes = this.root
            .from(this.passList)
            .getTopologicalSortedList();

        // compute dropList
        const passNodes = this.passNodes;
        const resourceNodes = new Set(this.nodes.filter(node => node instanceof ResourceNode) as ResourceNode[]);
        for (let i = passNodes.length - 1; i >= 0; i--) {
            const passNode = passNodes[i];
            const targetNode = passNode.target;
            const resources: ResourceNode[] = [
                ...targetNode.colorAttachments,
                ...Array.from(passNode.dependResources),
            ];
            if (targetNode.depthAttachment) {
                resources.push(targetNode.depthAttachment);
            }
            const dropResources = this.dropResources[i] = new Set<ResourceNode>();
            for (let j = 0; j < resources.length; j++) {
                const resource = resources[j];
                if (resource.isKeepContent) {
                    continue;
                }
                if (!resourceNodes.has(resource)) {
                    continue;
                }
                resourceNodes.delete(resource);
                dropResources.add(resource);
            }
        }

        // check graph valid
        let isValid: boolean = true;
        const checkedTargets = new Set<RenderTargetNode>();
        for (let i = 0; i < passNodes.length; i++) {
            const pass = passNodes[i];
            isValid = isValid && pass.check();
            const target = pass.target;
            if (!checkedTargets.has(target)) {
                isValid = isValid && target.check();
                checkedTargets.add(target);
            }
            if (!isValid) {
                break;
            }
        }
        this._isValid = isValid;
        this.initialized = true;

        return this;
    }
}
