import { materialProperty } from '../../../ContentAPI';
import { DrivenMaterial } from './DrivenMaterial';
import { Matrix4 } from '../../../math/Matrix4';
import { DrivenCullingConfig } from '../../../fx/plugins/PipelinePlugin';
import { RenderAttachment } from '../../textures/RenderTarget';

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
    public occlusionCullingBias = 0;
    @materialProperty()
    public planarShadowMaxGroundHeight = 50.0;
    @materialProperty()
    public planarShadowMatrix: Matrix4 = new Matrix4();

    @materialProperty()
    public depthPyramid: RenderAttachment | null = null;

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
