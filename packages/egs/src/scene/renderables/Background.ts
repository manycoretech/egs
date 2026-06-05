import { Color } from '../../math/Color';
import { Mesh } from '../drawables/Mesh';
import type { Renderable } from './IRenderable';
import { GradientMaterial } from '../../elements/materials/mesh/GradientMaterial';
import { SkyMaterial } from '../../elements/materials/mesh/SkyMaterial';
import { EnvMapMaterial } from '../../elements/materials/mesh/EnvMapMaterial';
import type { Texture } from '../../elements/textures/Texture';
import { logger } from '../../utils/Logger';
import { sphere } from '../../elements/geometries/builder/Index';
import type { IRenderer } from '../../renderer/IRenderer';
import { Quad } from './Quad';
import { CopyMaterial } from '../../elements/materials/quad/CopyMaterial';
import type { Nullable } from '../../utils/Utils';
import type { BackgroundLikeMaterial } from '../../elements/materials/base';
import { Quaternion } from '../../math/Quaternion';
import { Vector3 } from '../../math/Vector3';
import { readonlyMath } from '../../math/Readonly';

/**
 * Union of supported viewer background configurations.
 * @deprecated
 */
export type Background = SolidColorBackground | BasicBackground | SkyBackground | GradientBackground | EnvMapBackground;

/**
 * Background modes supported by the viewer.
 */
export enum BackgroundMode {
    BasicBackground = 'basic',
    /**
     * @deprecated use BackgroundMode.BasicBackground
     */
    SolidColorBackground = 'solid',
    SkyBackground = 'sky',
    GradientBackground = 'gradient',
    EnvMapBackground = 'env',
}

/**
 * Parameters for a solid-color background.
 * @deprecated
 */
export interface SolidColorBackgroundParameter {
    color: Color;
    alpha: number;
}

/**
 * Parameters for a vertical gradient background.
 * @deprecated
 */
export interface GradientBackgroundParameter {
    skyColor: Color;
    groundColor: Color;
}

/**
 * Parameters for a procedural sky background.
 * @deprecated
 */
export interface SkyBackgroundParameter {
    enableSkyMap: boolean;
    luminance: number;
    turbidity: number;
    rayleigh: number;
    mieCoefficient: number;
    mieDirectionalG: number;
}

/**
 * Parameters for an environment-map background.
 * @deprecated
 */
export interface EnvMapBackgroundParameter {
    texture: Texture;
    luma: number;
    verticalRotation: number;
    horizonRotation: number;
}

/**
 * Parameters for the legacy basic background mode.
 * @deprecated
 */
export interface BasicBackgroundParameter {
    color: Color;
    alpha: number;
    texture: Texture;
}

/**
 * Background mode and partial parameters applied to a viewer.
 * @deprecated
 */
export interface BackgroundParameter {
    mode: BackgroundMode;
    parameter?: Partial<
        | BasicBackgroundParameter
        | SolidColorBackgroundParameter
        | GradientBackgroundParameter
        | SkyBackgroundParameter
        | EnvMapBackgroundParameter
    >;
}

/**
 * Draw background with a solid color.
 */
export class SolidColorBackground implements Renderable {
    color: Color;

    // alpha channel, range [0.0, 1.0]
    alpha: number = 1;

    constructor(color?: Color, alpha: number = 1.0) {
        this.color = color || new Color(0xe8e8e8);
        this.alpha = alpha;
    }

    config(renderer: IRenderer) {
        renderer.setClearColor(this.color, this.alpha);
        renderer.clear();
        return false;
    }

    render(_: IRenderer): void {
        //
    }
}

/**
 * Draw background with a picture.
 */
export class BasicBackground implements Renderable {
    color: Color;
    alpha: number = 1;

    texture: Nullable<Texture> = null;
    private quad = new Quad(false, false);
    private copy = new CopyMaterial();

    constructor(color?: Color, alpha: number = 1.0) {
        this.color = color || new Color(0xe8e8e8);
        this.alpha = alpha;
        this.quad.setMaterial(this.copy);
    }

    config(renderer: IRenderer) {
        renderer.setClearColor(this.color, this.alpha);
        renderer.clear();
        return false;
    }

    render(renderer: IRenderer): void {
        if (this.texture) {
            this.copy.tDiffuse = this.texture;
            this.quad.render(renderer);
        }
    }

    destroy() {
        this.texture?.destroy();
        this.quad.destroy();
        this.copy.destroy();
    }
}

const BACKGROUND_DEFAULT_UP = new Vector3(0, 0, 1);

class MeshBackground<T extends BackgroundLikeMaterial> implements Renderable {
    protected box: Mesh;
    protected geometry = sphere({ radius: 10, widthSegments: 10, heightSegments: 10 });
    protected rotation = new Quaternion();
    readonly material: T;

    constructor(material: T) {
        this.material = material;
        this.box = new Mesh(this.geometry, this.material);
        this.box.up.copy(BACKGROUND_DEFAULT_UP);
    }

    get up() {
        return this.box.up;
    }

    set up(up: Vector3) {
        if (!this.box.up.equals(up)) {
            this.material.up = up.cloneReadonly();
            this.rotation.setFromUnitVectors(BACKGROUND_DEFAULT_UP, up);
            this.material.quat = readonlyMath.vec4(this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w);
            this.box.up.copy(up);
        }
    }

    config(renderer: IRenderer) {
        renderer.clear();
        return false;
    }

    render(renderer: IRenderer): void {
        const camera = renderer.getCurrentCamera();
        if (camera === null) {
            logger.unreachable('camera not set before in render background');
            return;
        }
        this.box.modelViewMatrix.multiplyMatrices(camera.viewRotation, this.box.matrixWorld);
        renderer.renderDrawcall(this.box.geometry, this.material, this.box, null);
    }

    destroy() {
        this.box.destroyAllResourcesOwned();
    }
}

/**
 * Draw background with a gradient color.
 */
export class GradientBackground extends MeshBackground<GradientMaterial> {
    constructor() {
        super(new GradientMaterial());
    }
}

/**
 * Draw background with a gray ground and blue sky.
 */
export class SkyBackground extends MeshBackground<SkyMaterial> {
    constructor() {
        super(new SkyMaterial());
    }

    /**
     * @internal
     */
    enableSkyMap = false;
    /**
     * @internal
     */
    setSkyMapEnable(enable: boolean) {
        if (this.enableSkyMap === enable) {
            return;
        }
        this.enableSkyMap = enable;
        this.material.tEquirect = null;
        this.material.notifyRecompileShader();
    }

    /**
     * @internal
     */
    setSkyMap(texture: Nullable<Texture>) {
        this.material.tEquirect = texture;
    }
}

/**
 * Draw background with a picture.
 */
export class EnvMapBackground extends MeshBackground<EnvMapMaterial> {
    constructor() {
        super(new EnvMapMaterial());
    }
}
