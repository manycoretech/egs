import type { ViewerConfig } from './engine/EngineConfig';
import type { SnapshotRenderer } from './snapshot/SnapshotRendererV2';
import type { Viewer } from './Viewer';
import type { Viewport } from './Viewport';
import type { HighlightGroup } from './fx/plugins/Highlight';
import type { SnapshotResult } from './snapshot/SnapshotResult';
import type { IRange } from './utils/Utils';

/**
 * Context object for viewport
 */
export interface IViewerContext {
    /**
     * @internal
     */
    viewer: Viewer;
    config: ViewerConfig;
    snapshotRenderer: SnapshotRenderer;
    setHighlightGroups(groups: HighlightGroup[]): void;
    snapshotRenderResult(range?: IRange): Promise<SnapshotResult> | undefined;
}

/**
 * Creates a viewer context for a viewer and viewport.
 */
export function createViewerContext(viewer: Viewer, viewport: Viewport = viewer.defaultViewport): IViewerContext {
    return {
        viewer,
        config: viewport.config,
        setHighlightGroups: viewport.setHighlightGroups.bind(viewport),
        snapshotRenderResult: viewport.snapshotRenderResult.bind(viewport),
        snapshotRenderer: viewer.snapshotRendererV2,
    };
}
