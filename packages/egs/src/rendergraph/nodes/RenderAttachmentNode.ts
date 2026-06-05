import { SamplerDescriptor } from '../../elements/textures/Texture';
import { ResourceNode } from './ResourceNode';
import { type ResizeFN, defaultResizeFN, type Size } from './utils';
import { TextureViewDimension, TextureFormat } from '../../elements/textures/types';
import { SamplerFilter } from '../../utils/Constants';

export abstract class RenderAttachmentNode extends ResourceNode {
    private _width = 4;
    get width() {
        return this._width;
    }
    private _height = 4;
    get height() {
        return this._height;
    }
    depthOrArrayLayers = 1;
    dimension: TextureViewDimension = TextureViewDimension.D2;
    multiSample: boolean = false;
    resizeFn: ResizeFN = defaultResizeFN;

    abstract get formatKey(): string;

    updateSize(size: Size) {
        const { width, height, depthOrArrayLayers } = this.resizeFn(size);
        this._width = width;
        this._height = height;
        if (depthOrArrayLayers != null) {
            this.depthOrArrayLayers = depthOrArrayLayers;
        }
    }
}

export class RenderColorAttachmentNode extends RenderAttachmentNode {
    format: TextureFormat = TextureFormat.Rgba8Unorm;

    enableMipmap: boolean = false;
    sampler: SamplerDescriptor = SamplerDescriptor.CreateAttachmentSampler();

    get formatKey() {
        return `c-${this.width}-${this.height}-${this.depthOrArrayLayers}-${this.format}-${this.multiSample}-${this.enableMipmap}-${this.dimension}`;
    }

    constructor(name: string = 'DEFAULT') {
        super(name);
    }

    modify(fn: (node: RenderColorAttachmentNode) => void) {
        fn(this);
        return this;
    }

    setFilter(linearFilter: boolean, mipmap: boolean = this.enableMipmap) {
        this.enableMipmap = mipmap;
        const magFilter = linearFilter ? SamplerFilter.Linear : SamplerFilter.Nearest;
        const minFilter = !mipmap
            ? magFilter
            : linearFilter
              ? SamplerFilter.LinearMipmapLinear
              : SamplerFilter.NearestMipmapNearest;
        this.sampler.minFilter = minFilter;
        this.sampler.magFilter = magFilter;
        return this;
    }
}

export class RenderDepthAttachmentNode extends RenderAttachmentNode {
    enableTexture = true;
    enableStencil = true;

    sampler: SamplerDescriptor = SamplerDescriptor.CreateDepthAttachmentSampler();

    get formatKey() {
        return `d-${this.width}-${this.height}-${this.depthOrArrayLayers}-${this.enableTexture}-${this.enableStencil}-${this.multiSample}-${this.dimension}`;
    }

    constructor(name: string = 'DEFAULT') {
        super(name);
    }

    modify(fn: (node: RenderDepthAttachmentNode) => void) {
        fn(this);
        return this;
    }
}
