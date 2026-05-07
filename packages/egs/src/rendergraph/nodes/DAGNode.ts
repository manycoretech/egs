let GLOBAL_ID = 0;

// base class of node for the DAG graph, which provides the basic connection functions of the graph
export abstract class DAGNode {
    readonly name: string;
    private readonly uid: number = GLOBAL_ID++;
    protected toNodes = new Set<DAGNode>();
    protected fromNodes = new Set<DAGNode>();

    constructor(name: string) {
        this.name = name;
    }

    private addFromRef(node: DAGNode) {
        this.fromNodes.add(node);
    }

    private removeFromRef(node: DAGNode) {
        this.fromNodes.delete(node);
    }

    private addToRef(node: DAGNode) {
        this.toNodes.add(node);
    }

    private removeToRef(node: DAGNode) {
        this.toNodes.delete(node);
    }

    depend(node: DAGNode) {
        node.connect(this);
        return this;
    }

    connect(node: DAGNode) {
        this.addToRef(node);
        node.addFromRef(this);
        return this;
    }

    disconnect(node: DAGNode) {
        this.removeToRef(node);
        node.removeFromRef(this);
        return this;
    }

    disconnectAll(to: boolean = true, from: boolean = true) {
        if (to) {
            this.toNodes.forEach(node => node.removeFromRef(this));
            this.toNodes.clear();
        }
        if (from) {
            this.fromNodes.forEach(node => node.removeToRef(this));
            this.fromNodes.clear();
        }

        return this;
    }

    traverseDFS(callback: (node: DAGNode) => void, visited: Set<DAGNode> = new Set(), actives: Set<DAGNode> = new Set()) {
        if (actives.has(this)) {
            throw 'node graph contains cycles.';
        }
        if (visited.has(this)) {
            return;
        }
        actives.add(this);
        callback(this);
        this.fromNodes.forEach(n => n.traverseDFS(callback, visited, actives));
        actives.delete(this);
        visited.add(this);
    }

    // get the topological sort of the node
    private fulfills = new Set<number>();
    getTopologicalSortedList(): DAGNode[] {
        const nodes: DAGNode[] = [];
        this.traverseDFS(n => { nodes.push(n); });
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            node.fulfills.clear();
            node.fromNodes.forEach(n => {
                node.fulfills.add(n.uid);
            });
        }

        const result: DAGNode[] = [];
        const visited = new Set<DAGNode>();
        while (result.length !== nodes.length) {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (visited.has(node) || node.fulfills.size > 0) {
                    continue;
                }
                visited.add(node);
                result.push(node);
                node.toNodes.forEach(n => n.fulfills.delete(node.uid));
            }
        }
        return result;
    }
}
