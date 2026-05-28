import { EventDispatcher, EventType } from '../../utils/EventDispatcher';
export const LayerChangeEvent = new EventType<number>();

/**
 * A Layers object assigns an Object3D to 1 or more of 32 layers numbered 0 to 31 - internally the layers are stored as a bit mask,
 * and by default all Object3Ds are a member of layer 0.
 * This can be used to control visibility - an object must share a layer with a camera to be visible when that camera's view is renderered.
 * All classes that inherit from Object3D have an {@link Object3D.layers| layers } property which is an instance of this class.
 */
export class Layers extends EventDispatcher {
    /**
     * @internal
     */
    isDefault = false;

    get mask(): number {
        return this._mask;
    }
    set mask(value: number) {
        if (this._mask !== value || this.isDefault) {
            this._mask = value;
            this.emit(LayerChangeEvent, this._mask);
        }
        this.isDefault = false;
    }

    /**
     * A bit mask storing which of the 32 layers this layers object is currently a member of.
     */
    private _mask = 1 | 0;
    /**
     * Set membership to layer, and remove membership all other layers.
     * @param channel an integer from 0 to 31.
     */
    public set(channel: number) {
        this.mask = 1 << channel | 0;
        return this;
    }
    /**
     * Add membership of this layer.
     * @param channel an integer from 0 to 31.
     */
    public enable(channel: number) {
        this.mask |= 1 << channel | 0;
        return this;
    }
    /**
     * Toggle membership of layer.
     * @param channel an integer from 0 to 31.
     */
    public toggle(channel: number) {
        this.mask ^= 1 << channel | 0;
        return this;
    }
    /**
     * Remove membership of this layer.
     * @param channel an integer from 0 to 31.
     */
    public disable(channel: number) {
        this.mask &= ~(1 << channel | 0);
        return this;
    }
    /**
     * Returns true if this and the passed layers object are members of the same set of layers.
     * @param layers a Layers object.
     */
    public test(layers: Layers) {
        return (this._mask & layers._mask) !== 0;
    }
    /**
     * @internal
     */
    public getSerializeData() {
        return this._mask;
    }
    /**
     * @internal
     */
    public setSerializeData(value: number) {
        this.mask = value;
    }
    /**
     * Copies the {@link mask| mask} of given layers to this.
     */
    public copy(value: Layers) {
        this.mask = value._mask;
    }
    /**
     * Returns a new Layers with the same {@link mask| mask} as this one.
     */
    public clone() {
        const layers = new Layers();
        layers._mask = this._mask;
        layers.isDefault = this.isDefault;
        return layers;
    }
}
