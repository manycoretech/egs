import { materialProperty } from '../../../ContentAPI.js';
import { DrivenMaterial } from './DrivenMaterial.js';
import { Matrix4 } from '../../../math/Matrix4.js';
import type { DrivenCullingConfig } from '../../../fx/plugins/PipelinePlugin.js';
import type { RenderAttachment } from '../../textures/RenderTarget.js';

export class DrivenCullingMaterial extends DrivenMaterial {
    @materialProperty()
    enableFrustumCulling: boolean = true;
    @materialProperty()
    enableOcclusionCulling: boolean = true;
    @materialProperty()
    enableDetailCulling: boolean = true;
    @materialProperty()
    enableLayersCulling: boolean = true;
    @materialProperty()
    enableTriCulling: boolean = true;
    @materialProperty()
    occlusionCullingBias = 0;
    @materialProperty()
    planarShadowMaxGroundHeight = 50.0;
    @materialProperty()
    planarShadowMatrix: Matrix4 = new Matrix4();

    @materialProperty()
    depthPyramid: RenderAttachment | null = null;

    className(): string {
        return 'DrivenCullingMaterial';
    }

    update(config: DrivenCullingConfig) {
        this.enableFrustumCulling = config.frustumCullingEnabled;
        this.enableOcclusionCulling = config.occlusionCullingEnabled;
        this.enableDetailCulling = config.detailCullingEnabled;
        this.enableLayersCulling = config.layersCullingEnabled;
        this.enableTriCulling = config.triCullingEnabled;
        this.occlusionCullingBias = config.occlusionCullingBias;
    }
}
