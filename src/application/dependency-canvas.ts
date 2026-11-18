import { createHash } from 'node:crypto';
import { CanvasError, defaultLayout, isRevision, layoutFormat, layoutGraph, layoutObject, layoutPath, parseLayout,
  reconcileLayout, renewedPaths } from '../core/canvas-layout.js';
import type { CanvasLayout } from '../core/canvas-layout.js';
import { canvasIds, GraphError, graphPath, isLegendKey, parseGraph, readRemovalMarks } from '../core/dependency-graph.js';
import type { DependencyGraph, RemovalMarks } from '../core/dependency-graph.js';
import type { GraphStore } from './dependency-graph.js';
import { ReaderError } from './file-reader.js';
import type { DocumentEntry, FileReaderService, ReaderProblem } from './file-reader.js';

interface LayoutStore {
  read(): Promise<string | undefined>;
  save(raw: string, previous: string | undefined, checkGraph: () => Promise<void>): Promise<void>;
}

export interface CanvasReading {
  graph: DependencyGraph;
  graphVersion: string;
  confirmedRemovals: string[];
  nodeRemovals: RemovalMarks;
  documents: DocumentEntry[];
  documentsUnavailable: boolean;
  layout: CanvasLayout;
  revision: string | null;
  reconciled: boolean;
  layoutProblem: ReaderProblem | null;
}

export interface LayoutWrite {
  graphVersion: string;
  expectedRevision: string | null;
  revision: string;
  layout: CanvasLayout;
}

function savedLayout(raw: string | undefined) {
  if (raw === undefined) return undefined;
  let data: unknown;
  try { data = JSON.parse(raw.replace(/^\uFEFF/u, '')); }
  catch {
    throw new CanvasError('LAYOUT_INVALID', '布局文件不是合法 JSON。', '保留原文件，检查 JSON 格式。', { layoutPath, field: '$' });
  }
  const keys = ['format', 'graph', 'revision', 'layout'];
  const hasMarks = !!data && typeof data === 'object' && Object.hasOwn(data, 'nodeRemovals');
  if (hasMarks) keys.push('nodeRemovals');
  const { format, graph, revision, layout, nodeRemovals } = layoutObject(data, keys, '$');
  if (format !== layoutFormat || graph !== layoutGraph || !isRevision(revision)) {
    throw new CanvasError('LAYOUT_INVALID', '布局文件头无效。', '保留原文件，检查版本、所属图和修订。', { layoutPath, field: '$' });
  }
  const parsed = parseLayout(layout);
  const marks = hasMarks ? readRemovalMarks(nodeRemovals) : {};
  if (!marks || Object.keys(marks).some(path => !Object.hasOwn(parsed.positions, path))) {
    throw new CanvasError('LAYOUT_INVALID', '布局移除标记无效。', '保留原文件，检查标记与坐标名单。', { layoutPath, field: '$.nodeRemovals' });
  }
  return { revision, layout: parsed, nodeRemovals: marks };
}

function activeMarks(ids: ReadonlySet<string>, removals: RemovalMarks, saved?: RemovalMarks): RemovalMarks {
  return Object.fromEntries(Object.entries({ ...saved, ...removals }).filter(([path]) => ids.has(path)));
}

export class DependencyCanvasService {
  private writes = Promise.resolve();

  constructor(private readonly reader: FileReaderService, private readonly graphStore: Pick<GraphStore, 'read' | 'removalState'>,
    private readonly store: LayoutStore) {}

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
    return { graph, ids, confirmed, nodeRemovals, receiptProblem,
      graphVersion: createHash('sha256').update(raw).update('\0').update(version).digest('hex') };
  }

  async read(): Promise<CanvasReading> {
    const { graph, graphVersion, ids: active, confirmed, nodeRemovals, receiptProblem } = await this.readGraph(true);
    const ids = [...active];
    const files = new Set(graph.nodes.map(node => node.path));
    const listing = await this.reader.list().catch(error => {
      if (!(error instanceof ReaderError)) throw error;
      return { documents: [], problems: [error] };
    });
    const result: CanvasReading = {
      graph, graphVersion, confirmedRemovals: [...confirmed], nodeRemovals,
      documents: listing.documents.filter(document => files.has(document.sourcePath)),
      documentsUnavailable: listing.problems.length > 0, layout: defaultLayout(ids), revision: null, reconciled: false, layoutProblem: receiptProblem,
    };
    try {
      const saved = savedLayout(await this.store.read());
      if (saved) {
        result.revision = saved.revision;
        const positions = saved.layout.positions;
        const renewed = renewedPaths(ids, saved.nodeRemovals, result.nodeRemovals);
        result.reconciled = renewed.size > 0 || Object.keys(positions).length !== ids.length || ids.some(id => !Object.hasOwn(positions, id));
        result.layout = result.reconciled ? reconcileLayout(saved.layout, ids, renewed) : saved.layout;
        if (result.reconciled && !receiptProblem) checkRemovals(saved.layout, active, confirmed);
      }
    } catch (error) {
      if (!(error instanceof CanvasError)) throw error;
      result.layoutProblem = { code: error.code, message: error.message, nextStep: error.nextStep, context: error.context };
    }
    return result;
  }

  save(input: unknown): Promise<{ revision: string }> {
    const operation = this.writes.then(() => this.publish(input));
    this.writes = operation.then(() => {}, () => {});
    return operation;
  }

  private async publish(input: unknown) {
    const { expectedRevision, revision, graphVersion, layout } = layoutObject(input,
      ['expectedRevision', 'revision', 'graphVersion', 'layout'], '$');
    if ((expectedRevision !== null && !isRevision(expectedRevision)) || !isRevision(revision) || revision === expectedRevision ||
        typeof graphVersion !== 'string' || !/^[a-f0-9]{64}$/u.test(graphVersion)) {
      throw new CanvasError('LAYOUT_INVALID', '布局保存参数无效。', '刷新读取图及布局后重试。', { field: '$' });
    }
    const candidate = parseLayout(layout, 'request');
    const checkVersion = (current: string) => {
      if (current !== graphVersion) throw new CanvasError('LAYOUT_GRAPH_CHANGED', '依赖图在保存前已变化。', '刷新以读取更新后的图。',
        { graphPath });
    };
    const { ids, confirmed, nodeRemovals, graphVersion: currentVersion } = await this.readGraph();
    checkVersion(currentVersion);
    if (Object.keys(candidate.positions).length !== ids.size ||
        Object.keys(candidate.positions).some(id => !ids.has(id))) {
      throw new CanvasError('LAYOUT_INVALID', '坐标名单与当前图不一致。', '刷新布局后重试。', { field: '$.layout.positions' });
    }
    const raw = await this.store.read();
    let saved;
    try { saved = savedLayout(raw); }
    catch (error) {
      if (!(error instanceof CanvasError)) throw error;
      throw new CanvasError('LAYOUT_STORED_INVALID', error.message, error.nextStep, error.context);
    }
    if (saved) {
      // An exact replay can acknowledge a response lost after publication.
      if (saved.revision === revision && JSON.stringify(saved.layout) === JSON.stringify(candidate)) return { revision };
      checkRemovals(saved.layout, ids, confirmed);
    }
    if ((saved?.revision ?? null) !== expectedRevision) {
      throw new CanvasError('LAYOUT_CONFLICT', '另一个页面已保存更新的布局。', '可放弃本页草稿并读取磁盘布局。', { layoutPath });
    }
    const accepted = activeMarks(ids, nodeRemovals, saved?.nodeRemovals);
    const envelope = { format: layoutFormat, graph: layoutGraph, revision, layout: candidate,
      ...(Object.keys(accepted).length ? { nodeRemovals: accepted } : {}) };
    await this.store.save(JSON.stringify(envelope, null, 2) + '\n', raw, async () => {
      const current = await this.readGraph();
      checkVersion(current.graphVersion);
    });
    return { revision };
  }
}

function checkRemovals(layout: CanvasLayout, current: ReadonlySet<string>, confirmed: ReadonlySet<string>) {
  const unconfirmed = Object.keys(layout.positions).find(id => !current.has(id) && !confirmed.has(id));
  if (unconfirmed !== undefined) {
    throw new CanvasError('LAYOUT_GRAPH_UNCONFIRMED', '依赖图暂缺原布局中的文件或图例，移除尚未确认。',
      '完成图更新或用依赖图工具明确确认移除，再刷新。', { graphPath, field: unconfirmed });
  }
}
