import { Viewer, ViewerUnInitializeEvent } from './Viewer.js';
import type { EngineInitializeConfig } from './engine/EngineConfig.js';
import { hasManagedContentAPI, ManagedContentBridge, type WorldRebuildConfig } from './ContentAPI.js';
// @ts-ignore
import p from '../package.json';

export const projectName = 'ExaGraphics Graphics System';

// EGS global entrance
/**
 * The most outside wrapper of the whole engine, contains the version information and could create
 * a viewer
 * @public
 */
export class Application {
    static version: string = p.version;
    private static instance: Application;
    private viewers = new Map<string, Viewer>();

    constructor() {
        (window as any).EGS = this;
        this.logVersion();
    }

    /**
     * static function to get the app instance, to reduce duplication.
     */
    static getInstance(): Application {
        return Application.instance || (Application.instance = new Application());
    }

    /**
     * create a viewer. see {@link Viewer| Viewer }
     * @param {string} name the name of the viewer.
     * @param {HTMLElement} container source data.
     * @param {EngineInitializeConfig} engineInitConfig configuration of the viewer such as if turn the shadow on.
     * engineInitConfig
     */
    createViewer(name: string, container: HTMLElement, engineInitConfig: EngineInitializeConfig): Viewer {
        const viewer = new Viewer(container, {
            name,
            ...engineInitConfig,
        });
        viewer.name = name;
        this.viewers.set(name, viewer);
        viewer.on(ViewerUnInitializeEvent, this.onViewerUninitialise);
        return viewer;
    }

    /**
     * get viewer object by ID.
     */
    getViewer(name: string): Viewer {
        return this.viewers.get(name)!;
    }

    getViewers(): Viewer[] {
        return Array.from(this.viewers.values());
    }

    rebuildWorld(config?: WorldRebuildConfig): Promise<void> {
        if (hasManagedContentAPI()) {
            return ManagedContentBridge.rebuildWorld(config);
        }
        return Promise.resolve();
    }

    private logVersion(): void {
        // oxlint-disable-next-line
        console.log(
            '\n%c%s%c%s%c%s%c%s%c%s%c%s%c%s\n',
            'background-color: #369;font-size: 12px;',
            ' ',
            'background-color: #58a;font-size: 12px;',
            ' ',
            'background-color: #7ac;font-size: 12px;',
            ' ',
            'background-color: #9ce;color: #fff; font-weight: lighter;font-size: 12px;',
            ` ${projectName} ${Application.version} `,
            'background-color: #7ac;font-size: 12px;',
            ' ',
            'background-color: #58a;font-size: 12px;',
            ' ',
            'background-color: #369;font-size: 12px;',
            ' ',
        );
    }

    private onViewerUninitialise = (event: { target: Viewer }) => {
        const viewer = event.target;
        this.viewers.delete(viewer.name);
        viewer.off(ViewerUnInitializeEvent, this.onViewerUninitialise);
    };
}
