import { createHash } from 'node:crypto';
import { layoutGraph, layoutPath } from '../core/canvas-layout.js';
import { canvasIds, isLibrary, legendKey, GraphError, graphPath, isCanvasId, isLegendKey, parseGraph } from '../core/dependency-graph.js';
import type { DependencyGraph, RemovalMarks } from '../core/dependency-graph.js';
import { CanvasLayoutService } from './canvas-layout.js';
import type { LayoutReading, LayoutStore, LayoutTarget } from './canvas-layout.js';
import type { GraphStore } from './dependency-graph.js';
import { ReaderError } from './file-reader.js';
import type { DocumentEntry, FileReaderService, ReaderProblem } from './file-reader.js';

export interface CanvasReading extends LayoutReading {
  graph: DependencyGraph;
  confirmedRemovals: string[];
  nodeRemovals: RemovalMarks;
  documents: DocumentEntry[];
  documentsUnavailable: boolean;
}

export class DependencyCanvasService {
  private readonly layouts = new CanvasLayoutService();
  private readonly target: LayoutTarget;

  constructor(private readonly reader: FileReaderService, private readonly graphStore: Pick<GraphStore, 'read' | 'removalState'>,
    store: LayoutStore) {
    this.target = { graph: layoutGraph, graphPath, layoutPath, store, acceptsId: isCanvasId, supportsRemovals: true,
      readGraph: () => this.readGraph() };
  }
  private async readGraph(preview = false) {
    const raw = await this.graphStore.read(this.reader.projectRoot);
    if (raw === undefined) throw new GraphError('GRAPH_NOT_FOUND', '项目还没有依赖图。', '生成文件依赖图后刷新。', { graphPath });
    const graph = parseGraph(raw);
    const ids = new Set(canvasIds(graph));
    let receiptProblem: ReaderProblem | null = null;
    const state = await this.graphStore.removalState(this.reader.projectRoot, raw, ids).catch(error => {
      if (!preview || !(error instanceof GraphError)) throw error;
      receiptProblem = { code: error.code, message: error.message, nextStep: error.nextStep, context: error.context };
      return { removals: {} as RemovalMarks, registered: [], confirmed: [] };
    });
    const history = Object.keys(state.removals).sort().map(path => [path, state.removals[path]]);
    const confirmed = new Set(state.confirmed.filter(id => !ids.has(id)));
    const registered = new Set(state.registered);
    const nodeRemovals = Object.fromEntries(Object.entries(state.removals)
      .filter(([id]) => ids.has(id) && (registered.has(id) || isLegendKey(id))));
    const version = JSON.stringify([history, [...state.registered].sort(), [...confirmed].sort()]);
    const switches = (graph.legends ?? []).filter(legend => !isLibrary(legend)).map(legend => legendKey(legend.id));
    const relations = { ...(switches.length && { switches }), edges: graph.edges.map(edge => ({ from: edge.dependency, to: edge.dependent })),
      libraries: (graph.legends ?? []).filter(isLibrary).map(legend => ({ id: legendKey(legend.id), targets: legend.uses.map(use => use.path) })) };
    return { graph, ids, confirmed, nodeRemovals, receiptProblem, relations,
      graphVersion: createHash('sha256').update(JSON.stringify([this.reader.projectRoot, layoutGraph, raw, version])).digest('hex') };
  }

  async read(): Promise<CanvasReading> {
    const state = await this.readGraph(true);
    const files = new Set(state.graph.nodes.map(node => node.path));
    const listing = await this.reader.list().catch(error => {
      if (!(error instanceof ReaderError)) throw error;
      return { documents: [], problems: [error] };
    });
    return {
      ...await this.layouts.read(this.target, state, state.receiptProblem),
      graph: state.graph, confirmedRemovals: [...state.confirmed], nodeRemovals: state.nodeRemovals,
      documents: listing.documents.filter(document => files.has(document.sourcePath)),
      documentsUnavailable: listing.problems.length > 0,
    };
  }

  save(input: unknown) {
    return this.layouts.save(this.target, input);
  }
}
