import { createHash } from 'node:crypto';
import { CanvasError, defaultLayout, isRevision, layoutFormat, layoutGraph, layoutObject, layoutPath, parseLayout, reconcileLayout } from '../core/canvas-layout.js';
import type { CanvasLayout } from '../core/canvas-layout.js';
import { GraphError, graphPath, parseGraph } from '../core/dependency-graph.js';
import type { DependencyGraph } from '../core/dependency-graph.js';
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
  const { format, graph, revision, layout } = layoutObject(data, ['format', 'graph', 'revision', 'layout'], '$');
  if (format !== layoutFormat || graph !== layoutGraph || !isRevision(revision)) {
    throw new CanvasError('LAYOUT_INVALID', '布局文件头无效。', '保留原文件，检查版本、所属图和修订。', { layoutPath, field: '$' });
  }
  return { revision, layout: parseLayout(layout) };
}

export class DependencyCanvasService {
  private writes = Promise.resolve();

  constructor(private readonly reader: FileReaderService, private readonly graphStore: Pick<GraphStore, 'read' | 'confirmedRemovals'>,
    private readonly store: LayoutStore) {}

  private async readGraph() {
    const raw = await this.graphStore.read(this.reader.projectRoot);
    if (raw === undefined) throw new GraphError('GRAPH_NOT_FOUND', '项目还没有依赖图。', '生成文件依赖图后刷新。', { graphPath });
    return { raw, graph: parseGraph(raw), graphVersion: createHash('sha256').update(raw).digest('hex') };
  }

  async read(): Promise<CanvasReading> {
    const { raw, graph, graphVersion } = await this.readGraph();
    const ids = graph.nodes.map(node => node.path);
    const paths = new Set(ids);
    const confirmedRemovals = await this.graphStore.confirmedRemovals(this.reader.projectRoot, raw);
    const listing = await this.reader.list().catch(error => {
      if (!(error instanceof ReaderError)) throw error;
      return { documents: [], problems: [error] };
    });
    const result: CanvasReading = {
      graph, graphVersion, confirmedRemovals, documents: listing.documents.filter(document => paths.has(document.sourcePath)),
      documentsUnavailable: listing.problems.length > 0, layout: defaultLayout(ids), revision: null, reconciled: false, layoutProblem: null,
    };
    try {
      const saved = savedLayout(await this.store.read());
      if (saved) {
        result.revision = saved.revision;
        const positions = saved.layout.positions;
        result.reconciled = Object.keys(positions).length !== ids.length || ids.some(id => !Object.hasOwn(positions, id));
        result.layout = result.reconciled ? reconcileLayout(saved.layout, ids) : saved.layout;
        if (result.reconciled) checkRemovals(saved.layout, paths, confirmedRemovals);
      }
    } catch (error) {
      if (!(error instanceof CanvasError)) throw error;
      result.layoutProblem = { code: error.code, message: error.message, nextStep: error.nextStep, context: error.context };
    }
    return result;
  }

  private async checkRemovals(layout: CanvasLayout, current: Set<string>, raw: string) {
    if (!Object.keys(layout.positions).some(path => !current.has(path))) return;
    checkRemovals(layout, current, await this.graphStore.confirmedRemovals(this.reader.projectRoot, raw));
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
    const candidate = parseLayout(layout);
    const checkVersion = (current: string) => {
      if (current !== graphVersion) throw new CanvasError('LAYOUT_GRAPH_CHANGED', '依赖图在保存前已变化。', '刷新以读取更新后的图。',
        { graphPath });
    };
    const { raw: graphRaw, graph, graphVersion: currentVersion } = await this.readGraph();
    checkVersion(currentVersion);
    if (Object.keys(candidate.positions).length !== graph.nodes.length ||
        graph.nodes.some(node => !Object.hasOwn(candidate.positions, node.path))) {
      throw new CanvasError('LAYOUT_INVALID', '坐标名单与当前图不一致。', '刷新布局后重试。', { field: '$.layout.positions' });
    }
    const raw = await this.store.read();
    let saved;
    try { saved = savedLayout(raw); }
    catch (error) {
      if (!(error instanceof CanvasError)) throw error;
      throw new CanvasError('LAYOUT_STORED_INVALID', error.message, error.nextStep, error.context);
    }
    const ids = new Set(graph.nodes.map(node => node.path));
    if (saved) {
      // An exact replay can acknowledge a response lost after publication.
      if (saved.revision === revision && JSON.stringify(saved.layout) === JSON.stringify(candidate)) return { revision };
      await this.checkRemovals(saved.layout, ids, graphRaw);
    }
    if ((saved?.revision ?? null) !== expectedRevision) {
      throw new CanvasError('LAYOUT_CONFLICT', '另一个页面已保存更新的布局。', '可放弃本页草稿并读取磁盘布局。', { layoutPath });
    }
    const envelope = { format: layoutFormat, graph: layoutGraph, revision, layout: candidate };
    await this.store.save(JSON.stringify(envelope, null, 2) + '\n', raw, async () => {
      const current = await this.readGraph();
      checkVersion(current.graphVersion);
      if (saved) await this.checkRemovals(saved.layout, ids, current.raw);
    });
    return { revision };
  }
}

function checkRemovals(layout: CanvasLayout, current: Set<string>, removals: string[]) {
  const confirmed = new Set(removals);
  const unconfirmed = Object.keys(layout.positions).find(path => !current.has(path) && !confirmed.has(path));
  if (unconfirmed !== undefined) {
    throw new CanvasError('LAYOUT_GRAPH_UNCONFIRMED', '依赖图暂缺原布局中的文件，移除尚未确认。',
      '完成图更新或用依赖图工具明确确认移除，再刷新。', { graphPath, field: unconfirmed });
  }
}
