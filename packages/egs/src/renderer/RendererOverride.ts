import type { RendererParameters, IRenderer } from './IRenderer.js';
import { Renderer } from './Renderer.js';

const DEFAULT_RENDERER_IMPL = (p: RendererParameters) => new Renderer(p);

export let globalOverrideDefaultRendererImpl: (p: RendererParameters) => IRenderer = DEFAULT_RENDERER_IMPL;

export function registerGlobal3DRendererOverride(f: (p: RendererParameters) => IRenderer) {
    globalOverrideDefaultRendererImpl = f;
}

export function resetGlobal3DRendererOverride() {
    globalOverrideDefaultRendererImpl = DEFAULT_RENDERER_IMPL;
}
