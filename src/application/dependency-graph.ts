import { checkedFixedSource, FixedSourceService, SourceError, validateSourcePath } from './fixed-source.js';
import type { FixedSource } from './fixed-source.js';
import { applyGraph, graphFormat, graphPath, GraphError, parseGraph, parseUpdate, queryGraph } from '../core/dependency-graph.js';
import type { DependencyGraph, GraphDiagnostic, RemovalMarks } from '../core/dependency-graph.js';

export interface GraphStore {
  read(projectRoot: string): Promise<string | undefined>;
  removalMarks(projectRoot: string, raw: string): Promise<RemovalMarks>;
  save(projectRoot: string, raw: string, previous: string | undefined, removal?: {
    requested: readonly string[]; previousActive: ReadonlySet<string>;
  }): Promise<void>;
}

export interface GraphCheck {
  readonly graph?: DependencyGraph;
  readonly structureValid: boolean;
  readonly sourceCheck: 'completed' | 'unavailable' | 'not-run';
  readonly mechanicallyValid: boolean;
  readonly semanticQuality: 'unchecked';
  readonly diagnostics: readonly GraphDiagnostic[];
}

function versionError(graph: DependencyGraph, fixed: FixedSource): GraphError | undefined {
  if (graph.source_commit === fixed.commit) return undefined;
  const message = '图的固定提交与请求不一致。';
  const nextStep = '复用原图固定依据；跨版本适配不在此入口执行。';
  const params = { expectedCommit: fixed.commit, actualCommit: graph.source_commit };
  return new GraphError('GRAPH_VERSION_MISMATCH', message, nextStep, { ...params, graphPath }, [
    { code: 'GRAPH_VERSION_MISMATCH', field: '$.source_commit', message, nextStep, params },
  ]);
}

function sourceDiagnostic(error: SourceError, field: string): GraphDiagnostic {
  return { code: 'SOURCE_UNAVAILABLE', field, message: '固定源码校验未完成。', nextStep: error.nextStep,
    params: { ...error.context, sourceCode: error.code } };
}

export class GraphService {
  constructor(private readonly sources: FixedSourceService, private readonly store: GraphStore) {}

  private async existing(fixed: FixedSource): Promise<string> {
    const raw = await this.store.read(fixed.projectRoot);
    if (raw === undefined) throw new GraphError('GRAPH_NOT_FOUND', '文件依赖图不存在。', '明确登记本批文件以初始化；只读操作不创建图。', { projectRoot: fixed.projectRoot, graphPath });
    return raw;
  }

  private async checkFiles(fixed: FixedSource, graph: DependencyGraph): Promise<GraphDiagnostic[]> {
    const diagnostics: GraphDiagnostic[] = [];
    for (const [index, node] of graph.nodes.entries()) {
      try { await this.sources.read(fixed, node.path); }
      catch (error) {
        if (!(error instanceof SourceError)) throw error;
        diagnostics.push(sourceDiagnostic(error, `$.nodes[${index}].path`));
      }
    }
    return diagnostics;
  }

  async apply(input: FixedSource, value: unknown) {
    const fixed = checkedFixedSource(input);
    const update = parseUpdate(value);
    await this.sources.verify(fixed);
    const previous = await this.store.read(fixed.projectRoot);
    const original: DependencyGraph = previous === undefined ? { format: graphFormat, source_commit: fixed.commit, nodes: [], edges: [] } : parseGraph(previous);
    const mismatch = versionError(original, fixed);
    if (mismatch) throw mismatch;
    const result = applyGraph(original, update);
    const raw = JSON.stringify(result.graph, null, 2) + '\n';
    const candidate = parseGraph(raw);
    const diagnostics = await this.checkFiles(fixed, candidate);
    if (diagnostics.length) throw new GraphError('GRAPH_INVALID', '合并候选的固定源码校验未完成。', '核对诊断中的真实固定文件；保留输入和原图。', { projectRoot: fixed.projectRoot, graphPath }, diagnostics);
    if (raw !== previous || update.remove.length) await this.store.save(fixed.projectRoot, raw, previous,
      { requested: update.remove, previousActive: new Set(original.nodes.map(node => node.path)) });
    return result;
  }

  async query(input: FixedSource, filePath: string) {
    const fixed = checkedFixedSource(input);
    validateSourcePath(filePath);
    const graph = parseGraph(await this.existing(fixed));
    const mismatch = versionError(graph, fixed);
    if (mismatch) throw mismatch;
    return queryGraph(graph, filePath);
  }

  async validate(input: FixedSource): Promise<GraphCheck> {
    const fixed = checkedFixedSource(input);
    const raw = await this.existing(fixed);
    const base = { mechanicallyValid: false, semanticQuality: 'unchecked' as const };
    let graph: DependencyGraph;
    try { graph = parseGraph(raw); }
    catch (error) {
      if (!(error instanceof GraphError)) throw error;
      return { ...base, structureValid: false, sourceCheck: 'not-run', diagnostics: error.diagnostics };
    }
    const mismatch = versionError(graph, fixed);
    if (mismatch) return { ...base, graph, structureValid: true, sourceCheck: 'not-run', diagnostics: mismatch.diagnostics };
    try { await this.sources.verify(fixed); }
    catch (error) {
      if (!(error instanceof SourceError)) throw error;
      return { ...base, graph, structureValid: true, sourceCheck: 'unavailable', diagnostics: [sourceDiagnostic(error, '$.source_commit')] };
    }
    const diagnostics = await this.checkFiles(fixed, graph);
    return { ...base, graph, structureValid: true, sourceCheck: diagnostics.length ? 'unavailable' : 'completed',
      mechanicallyValid: diagnostics.length === 0, diagnostics };
  }
}
