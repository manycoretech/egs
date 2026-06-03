import { EventDispatcher, EventType } from '../../../utils/EventDispatcher';
import type { Drawable } from '../../drawables/Drawable';

export const DrawableAdd = new EventType<Drawable>();
export const DrawableDelete = new EventType<Drawable>();
export const DrawableChange = new EventType<Drawable>();

export class DrawableSet extends EventDispatcher {
    drawables = new Set<Drawable>();

    add(d: Drawable) {
        if (!this.drawables.has(d)) {
            this.emit(DrawableAdd, d);
        }
        this.drawables.add(d);
    }

    changed(d: Drawable) {
        if (this.drawables.has(d)) {
            this.emit(DrawableChange, d);
        }
    }

    delete(d: Drawable) {
        if (this.drawables.has(d)) {
            this.emit(DrawableDelete, d);
        }
        this.drawables.delete(d);
    }

    forEach(f: (d: Drawable) => void) {
        this.drawables.forEach(f);
    }

    clear() {
        this.drawables.forEach(d => {
            this.delete(d);
        });
    }
}
