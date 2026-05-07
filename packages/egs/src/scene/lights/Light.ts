import { Object3D } from '../Object3D';
import { Color } from '../../math/Color';
import { Deserializer, Serializer } from '../../utils/Serialization';
import { ContentBridge, lightProperty } from '../../ContentAPI';

/**
 * This class is base class of all types of light source.
 * Every lights have two basic attributes which are color and intensity.
 */
export abstract class Light extends Object3D {
    /**
     * The type of this Object3D.
     */
    public type = 'Light';
    /**
     * Check the type whether it belongs to Light.
     * This value should not be changed by user.
     */
    public isLight = true;
    /**
     * Color of the light. This value can influence the color of model's surface according to the material.
     * Defaults to a new {@link Color | color } set to white, if not passed in the constructor.
     */
    @lightProperty()
    public color: Color;
    /**
     * The light's intensity, or strength.
     * In physically correct mode, the product of color * intensity is interpreted as luminous intensity measured in candela.
     * @defaultValue `1`
     */
    @lightProperty()
    public intensity: number;

    @lightProperty('enabled')
    private _enabled: boolean;

    public get enabled() {
        return this._enabled;
    }

    public set enabled(v: boolean) {
        if (this._enabled !== v) {
            this._enabled = v;
        }
    }

    /**
     * The name of instance's class.
     */
    public className() {
        return 'Light';
    }

    constructor(color?: number | string, intensity?: number) {
        super();
        ContentBridge.lightInit(this);
        this._enabled = true;
        this.color = new Color(color);
        this.intensity = intensity !== undefined ? intensity : 1;
    }
    /**
     * Copy the data to this light instance from source.
     * This method need override in derived classes to copy extended data.
     * @param {Light} source the data source.
     */
    public copy(source: Light, recursive?: boolean) {
        super.copy(source, recursive);
        this.color.copy(source.color);
        this.intensity = source.intensity;
        this.enabled = source.enabled;
        return this;
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Light>(['color', 'intensity', 'enabled']);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Light>(['color', 'intensity', 'enabled']);
    }
}
