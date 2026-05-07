import { ViewerConfig } from './engine/EngineConfig';
import { SnapshotRenderer } from './snapshot/SnapshotRendererV2';
import { Viewer } from './Viewer';
import { Viewport } from './Viewport';
import { HighlightGroup } from './fx/plugins/Highlight';
import { SnapshotResult } from './snapshot/SnapshotResult';
import { IRange } from './utils/Utils';

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

export function createViewerContext(viewer: Viewer, viewport: Viewport = viewer.defaultViewport): IViewerContext {
    return {
        viewer,
        config: viewport.config,
        setHighlightGroups: viewport.setHighlightGroups.bind(viewport),
        snapshotRenderResult: viewport.snapshotRenderResult.bind(viewport),
        snapshotRenderer: viewer.snapshotRendererV2,
    };
}
