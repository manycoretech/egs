import { readonlyMath } from '../../../math/Readonly.js';
import type { Nullable } from '../../../utils/Utils.js';
import { materialProperty } from '../../../ContentAPI.js';
import { JsNoImplMaterial } from '../base/index.js';
import type { TextureV2 } from '../../textures/TextureV2.js';
import type { Texture2D } from '../../textures/Texture2D.js';

/**
 * Material facade for physically based shading.
 * @deprecated
 */
export class PhysicalMaterial extends JsNoImplMaterial {
    className(): string {
        return 'PhysicalMaterial';
    }

    // when set true, this alpha channel of diffuse texture will be used as opacity.
    @materialProperty()
    transparentMask = false;

    @materialProperty()
    diffuse = readonlyMath.color();

    @materialProperty()
    specular = readonlyMath.color();

    @materialProperty()
    roughness = 1;

    @materialProperty()
    refract = readonlyMath.color(0x000000);

    @materialProperty()
    emission = readonlyMath.color(0x000000);

    @materialProperty()
    opacity = 1;

    @materialProperty()
    diffuseMap: Nullable<Texture2D | TextureV2> = null;

    @materialProperty()
    specularMap: Nullable<Texture2D | TextureV2> = null;

    @materialProperty()
    refractMap: Nullable<Texture2D | TextureV2> = null;

    @materialProperty()
    glossMap: Nullable<Texture2D | TextureV2> = null;

    clone() {
        return new PhysicalMaterial().copy(this);
    }
    copy(other: PhysicalMaterial) {
        this.copyBase(other);
        this.diffuse = other.diffuse;
        this.specular = other.specular;
        this.roughness = other.roughness;
        this.refract = other.refract;
        this.emission = other.emission;
        this.opacity = other.opacity;
        this.diffuseMap = other.diffuseMap;
        this.specularMap = other.specularMap;
        this.glossMap = other.glossMap;
        return this;
    }
}
