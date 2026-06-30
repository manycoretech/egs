import { Light } from './Light.js';
import { Color } from '../../math/Color.js';
import { Object3D } from '../Object3D.js';
import type { Deserializer, Serializer } from '../../utils/Serialization.js';

/**
 * A light source positioned directly above the scene, with color fading from the sky color to the ground color.
 * This light cannot be used to cast shadows.
 */
export class HemisphereLight extends Light {
    /**
     * Check the type whether it belongs to HemisphereLight.
     * This value should not be changed by user.
     */
    isHemisphereLight = true;
    /**
     * The light's ground color, as passed in the constructor. Default is a new Color set to white (0xffffff).
     */
    groundColor: Color;
    /**
     * The name of instance's class.
     */
    className() {
        return 'HemisphereLight';
    }

    constructor(skyColor?: number | string, groundColor?: number | string, intensity?: number) {
        super(skyColor, intensity);

        this.position.copy(Object3D.DefaultUp);
        this.updateMatrix();

        this.groundColor = new Color(groundColor);
    }

    copy(source: HemisphereLight) {
        super.copy(source);
        this.groundColor.copy(source.groundColor);
        return this;
    }
    /**
     * @internal
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<HemisphereLight>(['groundColor']);
    }
    /**
     * @internal
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<HemisphereLight>(['groundColor']);
    }
}
