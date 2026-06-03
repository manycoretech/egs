import { materialProperty } from '../../../ContentAPI';
import { DrivenMaterial } from './DrivenMaterial';
import { Matrix4 } from '../../../math/Matrix4';
import type { DrivenCullingConfig } from '../../../fx/plugins/PipelinePlugin';
import type { RenderAttachment } from '../../textures/RenderTarget';

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
