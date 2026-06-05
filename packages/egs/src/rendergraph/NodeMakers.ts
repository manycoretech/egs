import { CubeRenderTargetNode, CubePassNode } from './nodes/CubeNode';
import { PingPongTargetNode } from './nodes/PingPongTargetNode';
import type { DAGNode } from './nodes/DAGNode';
import { PassNode } from './nodes/PassNode';
import { RenderTargetNode } from './nodes/RenderTargetNode';
import { RenderColorAttachmentNode, RenderDepthAttachmentNode } from './nodes/RenderAttachmentNode';
import { TextureViewDimension } from '../elements/textures/types';

export function disableClear(passes: Array<PassNode | undefined>) {
    return (passes.filter(v => !!v) as PassNode[]).map(v => v.disableClear());
}

export function when<Y extends DAGNode, N extends DAGNode>(condition: boolean, yes: Y, no?: N): Y | N | undefined {
    return condition ? yes : no;
}

export function pass(name: string) {
    return new PassNode(name);
}

export function colorAttachment(name: string) {
    return new RenderColorAttachmentNode(name);
}

export function depthAttachment(name: string) {
    return new RenderDepthAttachmentNode(name);
}

export function target(
    name: string,
    enableDefaultColorAttach: boolean = true,
    enableDefaultDepthAttach: boolean = true,
) {
    const target = new RenderTargetNode(name);
    if (enableDefaultColorAttach) {
        const color = colorAttachment(`${name}_color`);
        target.attach(color);
    }
    if (enableDefaultDepthAttach) {
        const depth = depthAttachment(`${name}_depth`);
        target.attach(depth);
    }
    return target;
}

export const SCREEN_ROOT_NAME: string = 'screen-target';
export function screen(name: string = SCREEN_ROOT_NAME) {
    return new RenderTargetNode(name, true);
}

export function pingpong(name: string) {
    return new PingPongTargetNode(name);
}

export function cubePass(name: string): CubePassNode {
    return new CubePassNode(name);
}

export function cubeTarget(
    name: string,
    enableDefaultColorAttach: boolean = true,
    enableDefaultDepthAttach: boolean = true,
): CubeRenderTargetNode {
    const target = new CubeRenderTargetNode(name);
    if (enableDefaultColorAttach) {
        const color = colorAttachment(`${name}_color`);
        color.dimension = TextureViewDimension.Cube;
        color.depthOrArrayLayers = 6;
        target.target.attach(color);
    }
    if (enableDefaultDepthAttach) {
        const depth = depthAttachment(`${name}_depth`);
        depth.dimension = TextureViewDimension.Cube;
        depth.depthOrArrayLayers = 6;
        target.target.attach(depth);
    }
    return target;
}
