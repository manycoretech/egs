import { materialProperty } from '../../../ContentAPI';
import { Color } from '../../../math/Color';
import { DrivenMaterial } from './DrivenMaterial';
import { Matrix4 } from '../../../math/Matrix4';
import { DepthPackingStrategies } from '../mesh/MeshDepthMaterial';

export enum DrivenShadingMode {
    PhongShading = 0,
    OutlineEncode = 1,
    OutlineShading = 2,
    OutlineSolidShading = 3,
    OutlineSolidPhongShading = 4,
    OutlineMaskShading = 5,
    DeferredEncode = 6,
    ToonShading = 7,
    PlanarShadow = 8,
    DepthShading = 9,
    NormalShading = 10,
}

export class DrivenShadingMaterial extends DrivenMaterial {
    className(): string {
        return 'DrivenShadingMaterial';
    }

    @materialProperty()
    shadingMode: DrivenShadingMode = DrivenShadingMode.PhongShading;
    @materialProperty()
    oitEncode: boolean = false;
    @materialProperty()
    decodeSrgb: boolean = false;
    @materialProperty()
    planarShadowOcclusion: boolean = false;
    @materialProperty()
    depthPackMode: DepthPackingStrategies = DepthPackingStrategies.RGBADepthPacking;

    @materialProperty()
    outlineSolidColor: Color = new Color(1, 1, 1);

    @materialProperty()
    toonColor = new Color(1.0, 1.0, 1.0);
    @materialProperty()
    diffuseColor = new Color(0.12, 0.12, 0.12);
    @materialProperty()
    colorGradation = 24;
    @materialProperty()
    smoothnessMin = 0.32;
    @materialProperty()
    smoothnessMax = 0.34;

    @materialProperty()
    planarShadowMaxGroundHeight = 50.0;
    @materialProperty()
    planarShadowMaxGroundThickness = 50.0;

    @materialProperty()
    shadowMatrix: Matrix4 = new Matrix4();
    @materialProperty()
    shadowIntensity = 0.5;
}
