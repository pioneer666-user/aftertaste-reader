import { CanvasError, defaultLayout, isRevision, layoutFormat, layoutObject, parseLayout,
  reconcileLayout, renewedPaths } from '../core/canvas-layout.js';
import type { CanvasLayout, LayoutRelations } from '../core/canvas-layout.js';
import { readRemovalMarks } from '../core/dependency-graph.js';
import type { RemovalMarks } from '../core/dependency-graph.js';
import type { ReaderProblem } from './file-reader.js';

export interface LayoutStore {
  read(): Promise<string | undefined>;
  save(raw: string, previous: string | undefined, checkGraph: () => Promise<void>): Promise<void>;
}

export interface LayoutReading {
  relations: LayoutRelations;
  graphVersion: string;
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

export interface LayoutGraphState {
  relations: LayoutRelations;
  graphVersion: string;
  ids: ReadonlySet<string>;
  confirmed: ReadonlySet<string>;
  nodeRemovals: RemovalMarks;
}

export interface LayoutTarget {
  graph: string;
  graphPath: string;
  layoutPath: string;
  store: LayoutStore;
  acceptsId: (id: string) => boolean;
  supportsRemovals?: boolean;
  readGraph: () => Promise<LayoutGraphState>;
}

export class CanvasLayoutService {
  private readonly writes = new Map<string, Promise<void>>();

  async read(target: LayoutTarget, graph: LayoutGraphState, graphProblem: ReaderProblem | null = null): Promise<LayoutReading> {
    const { graphVersion, ids, confirmed, nodeRemovals } = graph;
    const ordered = [...ids];
    let layout: CanvasLayout | undefined;
    let revision: string | null = null;
    let reconciled = false;
    let layoutProblem = graphProblem;
    try {
      const saved = this.savedLayout(target, await target.store.read());
      if (saved) {
        revision = saved.revision;
        const renewed = renewedPaths(ordered, saved.nodeRemovals, nodeRemovals);
        const positions = saved.layout.positions;
        reconciled = !!saved.layout.expanded?.some(id => !graph.relations.switches?.includes(id)) || renewed.size > 0 || Object.keys(positions).length !== ids.size ||
          ordered.some(id => !Object.hasOwn(positions, id));
        layout = reconciled ? reconcileLayout(saved.layout, ordered, renewed, graph.relations) : saved.layout;
        if (reconciled && !graphProblem) checkRemovals(target, saved.layout, ids, confirmed);
      }
    } catch (error) {
      if (!(error instanceof CanvasError)) throw error;
      layoutProblem = { code: error.code, message: error.message, nextStep: error.nextStep,
        context: { ...error.context, layoutPath: target.layoutPath } };
    }
    return { graphVersion, relations: graph.relations, layout: layout ?? defaultLayout(ordered, graph.relations), revision, reconciled, layoutProblem };
  }

  save(target: LayoutTarget, input: unknown): Promise<{ revision: string }> {
    const operation = (this.writes.get(target.graph) ?? Promise.resolve()).then(() => this.publish(target, input));
    const done = operation.then(() => {}, () => {});
    this.writes.set(target.graph, done);
    void done.then(() => {
      if (this.writes.get(target.graph) === done) this.writes.delete(target.graph);
    });
    return operation;
  }

  private savedLayout(target: LayoutTarget, raw: string | undefined) {
    if (raw === undefined) return undefined;
    const invalid = (message: string, field = '$') => new CanvasError('LAYOUT_INVALID', message,
      '保留原文件，检查布局格式。', { layoutPath: target.layoutPath, field });
    let data: unknown;
    try { data = JSON.parse(raw.replace(/^\uFEFF/u, '')); }
    catch { throw invalid('布局文件不是合法 JSON。'); }
    const keys = ['format', 'graph', 'revision', 'layout'];
    const hasMarks = target.supportsRemovals && !!data && typeof data === 'object' && Object.hasOwn(data, 'nodeRemovals');
    if (hasMarks) keys.push('nodeRemovals');
    const { format, graph, revision, layout, nodeRemovals } = layoutObject(data, keys, '$');
    if (format !== layoutFormat || graph !== target.graph || !isRevision(revision)) throw invalid('布局文件头无效。');
    const parsed = parseLayout(layout, 'file', target.acceptsId);
    const marks = hasMarks ? readRemovalMarks(nodeRemovals) : {};
    if (!marks || Object.keys(marks).some(id => !Object.hasOwn(parsed.positions, id))) {
      throw invalid('布局移除标记无效。', '$.nodeRemovals');
    }
    return { revision, layout: parsed, nodeRemovals: marks };
  }

  private async publish(target: LayoutTarget, input: unknown) {
    const { graphPath, layoutPath } = target;
    let request: Record<string, unknown>;
    let candidate: CanvasLayout;
    try {
      request = layoutObject(input, ['expectedRevision', 'revision', 'graphVersion', 'layout'], '$');
      candidate = parseLayout(request.layout, 'request', target.acceptsId);
    } catch (error) {
      if (!(error instanceof CanvasError)) throw error;
      throw new CanvasError(error.code, error.message, error.nextStep, { ...error.context, layoutPath });
    }
    const { expectedRevision, revision, graphVersion } = request;
    if ((expectedRevision !== null && !isRevision(expectedRevision)) || !isRevision(revision) || revision === expectedRevision ||
        typeof graphVersion !== 'string' || !/^[a-f0-9]{64}$/u.test(graphVersion)) {
      throw new CanvasError('LAYOUT_INVALID', '布局保存参数无效。', '刷新读取图及布局后重试。', { layoutPath, field: '$' });
    }
    const checkVersion = (current: string) => {
      if (current !== graphVersion) throw new CanvasError('LAYOUT_GRAPH_CHANGED', '图身份或内容已变化。', '刷新以读取当前图。', { graphPath });
    };
    const { ids, confirmed, nodeRemovals, graphVersion: currentVersion, relations } = await target.readGraph();
    checkVersion(currentVersion);
    if (Object.keys(candidate.positions).length !== ids.size ||
        Object.keys(candidate.positions).some(id => !ids.has(id))) {
      throw new CanvasError('LAYOUT_INVALID', '坐标名单与当前图不一致。', '刷新布局后重试。', { layoutPath, field: '$.layout.positions' });
    }
    if (candidate.expanded?.some(id => !relations.switches?.includes(id))) {
      throw new CanvasError('LAYOUT_INVALID', '展开状态引用了非开关成员。', '刷新布局后重试。', { layoutPath, field: '$.layout.expanded' });
    }
    const raw = await target.store.read();
    let saved;
    try { saved = this.savedLayout(target, raw); }
    catch (error) {
      if (!(error instanceof CanvasError)) throw error;
      throw new CanvasError('LAYOUT_STORED_INVALID', error.message, error.nextStep, { ...error.context, layoutPath });
    }
    if (saved) {
      // An exact replay can acknowledge a response lost after publication.
      if (saved.revision === revision && JSON.stringify(saved.layout) === JSON.stringify(candidate)) return { revision };
      checkRemovals(target, saved.layout, ids, confirmed);
    }
    if ((saved?.revision ?? null) !== expectedRevision || saved?.revision === revision) {
      throw new CanvasError('LAYOUT_CONFLICT', '另一个页面已保存更新的布局。', '可放弃本页草稿并读取磁盘布局。', { layoutPath });
    }
    const accepted = Object.fromEntries(Object.entries({ ...saved?.nodeRemovals, ...nodeRemovals }).filter(([id]) => ids.has(id)));
    const envelope = { format: layoutFormat, graph: target.graph, revision, layout: candidate,
      ...(Object.keys(accepted).length ? { nodeRemovals: accepted } : {}) };
    await target.store.save(JSON.stringify(envelope, null, 2) + '\n', raw, async () => {
      checkVersion((await target.readGraph()).graphVersion);
    });
    return { revision };
  }
}

function checkRemovals(target: LayoutTarget, layout: CanvasLayout, current: ReadonlySet<string>, confirmed: ReadonlySet<string>) {
  const unconfirmed = Object.keys(layout.positions).find(id => !current.has(id) && !confirmed.has(id));
  if (unconfirmed !== undefined) {
    throw new CanvasError('LAYOUT_GRAPH_UNCONFIRMED', '当前图缺少已保存的节点，已保留磁盘布局。',
      target.supportsRemovals ? '完成图更新或用依赖图工具明确确认移除，再刷新。' : '核对当前闭环成品后刷新。',
      { graphPath: target.graphPath, field: unconfirmed });
  }
}
