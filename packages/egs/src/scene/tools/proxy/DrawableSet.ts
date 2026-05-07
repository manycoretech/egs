import { EventDispatcher, EventType } from '../../../utils/EventDispatcher';
import { Drawable } from '../../drawables/Drawable';

export const DrawableAdd = new EventType<Drawable>();
export const DrawableDelete = new EventType<Drawable>();
export const DrawableChange = new EventType<Drawable>();

export class DrawableSet extends EventDispatcher {
    public drawables = new Set<Drawable>();

    public add(d: Drawable) {
        if (!this.drawables.has(d)) {
            this.emit(DrawableAdd, d);
        }
        this.drawables.add(d);
    }

    public changed(d: Drawable) {
        if (this.drawables.has(d)) {
            this.emit(DrawableChange, d);
        }
    }

    public delete(d: Drawable) {
        if (this.drawables.has(d)) {
            this.emit(DrawableDelete, d);
        }
        this.drawables.delete(d);
    }

    public forEach(f: (d: Drawable) => void) {
        this.drawables.forEach(f);
    }

    public clear() {
        this.drawables.forEach(d => {
            this.delete(d);
        });
    }
}
