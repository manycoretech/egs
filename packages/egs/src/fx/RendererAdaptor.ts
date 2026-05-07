import { Quad } from '../scene/renderables/Quad';
import { RenderSource } from '../rendergraph/nodes/PassNode';
import { IRenderer } from '../renderer/IRenderer';
import { Vector4 } from '../math/Vector4';
import { Color } from '../math/Color';
import { Material } from '../elements/materials/Material';
import { Renderable } from '../scene/renderables/IRenderable';
import { RenderTarget } from '../elements/textures/RenderTarget';
import { QuadPoints } from '../scene/renderables/QuadPoints';
import { singleton } from '../utils/Utils';
import { Texture } from '../elements/textures/Texture';

const quadPointsGetter = singleton(() => new QuadPoints());
export function drawPoint(m: Material, n: number = 128): RenderSource {
    const quadPoints = quadPointsGetter();
    return {
        config: renderer => {
            return quadPoints.config(renderer.renderer);
        },
        render: (renderer) => {
            quadPoints.setMaterial(m);
            quadPoints.setGeometry(n);
            renderer.activeResources.forEach((input, name) => (m as any)[name] = input);
            quadPoints.render(renderer.renderer);
        }
    };
}

const quadGetter = singleton(() => new Quad());
function renderQuad(renderer: RendererAdaptor, m: Material, quad: Quad) {
    quad.setMaterial(m);
    renderer.activeResources.forEach((input, name) => (m as any)[name] = input);
    quad.render(renderer.renderer);
}

export function drawQuadDynamic(getMaterial: () => Material, getQuad: () => Quad = quadGetter): RenderSource {
    return {
        config: renderer => {
            return getQuad().config(renderer.renderer);
        },
        render: (renderer) => {
            renderQuad(renderer, getMaterial(), getQuad());
        }
    };
}

export function drawQuad(m: Material, quad: Quad = quadGetter()): RenderSource {
    return {
        config: renderer => {
            return quad.config(renderer.renderer);
        },
        render: (renderer) => {
            renderQuad(renderer, m, quad);
        }
    };
}

export class RendererAdaptor {
    public renderer: IRenderer;
    public width: number = 1920; // just default value
    public height: number = 1080;
    public activeResources: Map<string, Texture>; // uniformName, resource

    constructor(renderer: IRenderer) {
        this.renderer = renderer;
    }

    public setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public setClearColor(color: Vector4) {
        this.renderer.setClearColor(new Color(color.x, color.y, color.z), color.w);
    }

    public render(renderable: Renderable) {
        this.renderer.renderRenderable(renderable);
    }

    public clear(color: boolean, depth: boolean, stencil: boolean = false) {
        if (!depth && !color && !stencil) {
            return;
        }
        this.renderer.clear(color, depth, stencil);
    }

    public setRenderTarget(target: RenderTarget, resolveTarget?: RenderTarget) {
        this.renderer.setRenderTarget(target, resolveTarget);
    }

    public setRenderToScreen() {
        this.renderer.setRenderTarget();
    }
}
