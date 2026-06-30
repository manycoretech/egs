import type { DAGNode } from './DAGNode.js';
import { PassNode, type PassExecuteCtx } from './PassNode.js';
import type { MaterialDispatcher } from '../../renderer/MaterialDispatcher.js';
import {
    type DrawableList,
    type DrawcallListClassifyType,
    DrawcallListClassifyList,
} from '../../scene/tools/DrawcallList.js';
import type { CubeCamera } from '../../scene/cameras/CubeCamera.js';
import { RenderTargetNode } from './RenderTargetNode.js';
import type { RenderTarget } from '../../elements/textures/RenderTarget.js';
import type { ResizeFN } from './utils.js';
import { TextureViewDimension } from '../../elements/textures/types.js';

export class CubePassNode {
    private passes: PassNode[];

    constructor(name: string) {
        this.passes = [0, 1, 2, 3, 4, 5].map(i => new PassNode(name + '_cube_pass' + i));
        for (let i = 0; i < 5; i++) {
            const pass = this.passes[i];
            const next = this.passes[i + 1];
            next.depend(pass);
        }
    }

    useDispatcher(d: MaterialDispatcher) {
        this.passes.forEach(p => p.useDispatcher(d));
        return this;
    }

    // camera assume updated!
    useIfAndDisableClear(
        shouldRender: () => boolean,
        content: () => DrawableList,
        camera: () => CubeCamera,
        classifyType: DrawcallListClassifyType = DrawcallListClassifyList.default,
    ) {
        this.passes.forEach((p, i) => {
            p.useIfAndDisableClear(shouldRender, r =>
                r.render(content().project(camera().cameras[i], undefined, undefined, classifyType)),
            );
        });
        return this;
    }

    before(callback: (ctx: PassExecuteCtx) => any) {
        this.passes[0].before(callback);
        return this;
    }

    after(callback: (ctx: PassExecuteCtx) => any) {
        this.passes[5].after(callback);
        return this;
    }

    traverse(callback: (pass: PassNode, index: number) => void) {
        this.passes.forEach((pass, i) => callback(pass, i));
    }
}

export class CubeRenderTargetNode {
    target: RenderTargetNode;

    constructor(name: string) {
        this.target = new RenderTargetNode(name + '_cube_target').modify(
            node => (node.dimension = TextureViewDimension.Cube),
        );
        this.target.depthOrArrayLayers = 6;
    }

    keepContent() {
        this.target.keepContent();
        return this;
    }

    resize(updater: ResizeFN) {
        this.target.resize(updater);
        return this;
    }

    connect(node: DAGNode) {
        this.target.connect(node);
        return this;
    }

    from(cubePass: CubePassNode) {
        cubePass.traverse((pass, i) => this.target.from([pass.before(r => ((r.target as RenderTarget).layer = i))]));
        return this;
    }
}
