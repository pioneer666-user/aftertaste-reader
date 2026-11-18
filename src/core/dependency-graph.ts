import { isSourcePath } from './source-path.js';

export const graphFormat = 'aftertaste-dependency-graph/v1';
export const updateFormat = 'aftertaste-dependency-update/v1';
export const graphPath = 'docs/aftertaste/dependency-graph.json';
export type RemovalMarks = Readonly<Record<string, string>>;
const legendPrefix = 'legend:';

export function isLegendId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/u.test(value);
}

export function legendKey(id: string): string {
  return legendPrefix + id;
}

export function isLegendKey(value: string): boolean {
  return value.startsWith(legendPrefix) && isLegendId(value.slice(legendPrefix.length));
}

export function isCanvasId(value: unknown): value is string {
  return isSourcePath(value) || (typeof value === 'string' && isLegendKey(value));
}

export function readRemovalMarks(value: unknown): RemovalMarks | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.entries(value).every(([id, mark]) => isCanvasId(id) &&
    typeof mark === 'string' && /^[a-f0-9]{64}$/u.test(mark)) ? value as RemovalMarks : undefined;
}

export interface GraphNode { readonly path: string; readonly analysis: 'unreviewed' | 'reviewed' }
export interface GraphEdge { readonly dependency: string; readonly dependent: string; readonly reason: string }
export interface LibraryUse { readonly path: string; readonly reason: string }
export interface LibraryLegend {
  readonly id: string;
  readonly kind: 'standard' | 'third-party';
  readonly name: string;
  readonly description: string;
  readonly uses: readonly LibraryUse[];
}
type LegendPatch = Pick<LibraryLegend, 'id'> & Partial<Omit<LibraryLegend, 'id'>>;

export interface DependencyGraph {
  readonly format: typeof graphFormat;
  readonly source_commit: string;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly legends?: readonly LibraryLegend[];
}

export function canvasIds(graph: DependencyGraph): string[] {
  return [...graph.nodes.map(node => node.path), ...(graph.legends ?? []).map(legend => legendKey(legend.id))];
}
export interface GraphReview {
  readonly path: string;
  readonly analysis: 'reviewed';
  readonly dependencies: readonly { readonly path: string; readonly reason: string }[];
}
export interface GraphUpdate {
  readonly format: typeof updateFormat;
  readonly register: readonly string[];
  readonly reviews: readonly GraphReview[];
  readonly remove: readonly string[];
  readonly legendUpserts: readonly LegendPatch[];
  readonly legendRemove: readonly string[];
}
export interface GraphDiagnostic {
  readonly code: string;
  readonly field: string;
  readonly message: string;
  readonly nextStep: string;
  readonly params: Readonly<Record<string, string | number>>;
}
export type GraphErrorCode = 'GRAPH_INPUT_INVALID' | 'GRAPH_INPUT_READ_FAILED' | 'GRAPH_NOT_FOUND' |
  'GRAPH_INVALID' | 'GRAPH_VERSION_MISMATCH' | 'GRAPH_PATH_UNSAFE' | 'GRAPH_READ_FAILED' | 'GRAPH_WRITE_FAILED' | 'GRAPH_CHANGED';
export class GraphError extends Error {
  constructor(public readonly code: GraphErrorCode, message: string, public readonly nextStep: string,
    public readonly context: Readonly<Record<string, string | number>> = {},
    public readonly diagnostics: readonly GraphDiagnostic[] = []) {
    super(message);
    this.name = 'GraphError';
  }
}

class Fields {
  constructor(private readonly errorCode: 'GRAPH_INVALID' | 'GRAPH_INPUT_INVALID') {}
  fail(code: string, field: string, params: GraphDiagnostic['params'] = {}): never {
    const message = '图字段不符合文件依赖协议。';
    const nextStep = '按诊断字段核对图与局部输入契约，保留原文件后修正。';
    throw new GraphError(this.errorCode, message, nextStep, { graphPath }, [{ code, field, message, nextStep, params }]);
  }
  object(value: unknown, required: string[], optional: string[], field: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) this.fail('GRAPH_FIELDS', field);
    const keys = Object.keys(value);
    if (required.some(key => !Object.hasOwn(value, key)) || keys.some(key => !required.includes(key) && !optional.includes(key))) {
      this.fail('GRAPH_FIELDS', field);
    }
    return value as Record<string, unknown>;
  }
  array(value: unknown, field: string): unknown[] {
    if (!Array.isArray(value)) this.fail('GRAPH_FIELDS', field);
    const snapshot: unknown[] = [];
    const length = value.length;
    for (let index = 0; index < length; index++) {
      if (!Object.hasOwn(value, index)) this.fail('GRAPH_FIELDS', `${field}[${index}]`);
      snapshot.push(value[index]);
    }
    return snapshot;
  }
  path(value: unknown, field: string): string {
    if (!isSourcePath(value)) this.fail('GRAPH_PATH', field);
    return value;
  }
  legendId(value: unknown, field: string): string {
    if (!isLegendId(value)) this.fail('GRAPH_LEGEND_ID', field);
    return value;
  }
  reason(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.isWellFormed() || value.trim() === '') this.fail('GRAPH_REASON', field);
    return value;
  }
  unique(seen: Set<string>, key: string, field: string): void {
    if (seen.has(key)) this.fail('GRAPH_DUPLICATE', field, { key });
    seen.add(key);
  }
}

function readLegend(value: unknown, v: Fields, field: string, partial: boolean): LegendPatch {
  const keys = ['kind', 'name', 'description', 'uses'];
  const data = v.object(value, partial ? ['id'] : ['id', ...keys], partial ? keys : [], field);
  const id = v.legendId(data.id, field + '.id');
  const { kind } = data;
  if (Object.hasOwn(data, 'kind') && kind !== 'standard' && kind !== 'third-party') v.fail('GRAPH_LEGEND_KIND', field + '.kind');
  const seen = new Set<string>();
  const uses = Object.hasOwn(data, 'uses') ? v.array(data.uses, field + '.uses').map((entry, index): LibraryUse => {
    const location = `${field}.uses[${index}]`;
    const use = v.object(entry, ['path', 'reason'], [], location);
    const path = v.path(use.path, location + '.path');
    v.unique(seen, path, location + '.path');
    return { path, reason: v.reason(use.reason, location + '.reason') };
  }) : undefined;
  return { id, ...(kind === 'standard' || kind === 'third-party' ? { kind } : {}),
    ...(Object.hasOwn(data, 'name') ? { name: v.reason(data.name, field + '.name') } : {}),
    ...(Object.hasOwn(data, 'description') ? { description: v.reason(data.description, field + '.description') } : {}),
    ...(uses ? { uses } : {}) };
}

function completeLegend(patch: LegendPatch, v: Fields, field: string): LibraryLegend {
  const { id, kind, name, description, uses = [] } = patch;
  if (kind === undefined) v.fail('GRAPH_FIELDS', field + '.kind');
  if (name === undefined) v.fail('GRAPH_FIELDS', field + '.name');
  if (description === undefined) v.fail('GRAPH_FIELDS', field + '.description');
  return { id, kind, name, description, uses };
}

function checkUses(uses: readonly LibraryUse[], paths: { has(path: string): boolean }, v: Fields, field: string) {
  uses.forEach(({ path }, index) => {
    if (!paths.has(path)) v.fail('GRAPH_REFERENCE', `${field}.uses[${index}].path`, { path });
  });
}

export function parseGraph(raw: string): DependencyGraph {
  const v: Fields = new Fields('GRAPH_INVALID');
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^\uFEFF/u, '')); }
  catch { v.fail('GRAPH_JSON', '$'); }
  const data = v.object(value, ['format', 'source_commit', 'nodes', 'edges'], ['legends'], '$');
  if (data.format !== graphFormat) v.fail('GRAPH_FORMAT', '$.format');
  if (typeof data.source_commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(data.source_commit)) v.fail('GRAPH_COMMIT', '$.source_commit');
  const paths = new Set<string>();
  const nodes = v.array(data.nodes, '$.nodes').map((value, index): GraphNode => {
    const field = `$.nodes[${index}]`;
    const node = v.object(value, ['path', 'analysis'], [], field);
    const filePath = v.path(node.path, `${field}.path`);
    v.unique(paths, filePath, `${field}.path`);
    if (node.analysis !== 'unreviewed' && node.analysis !== 'reviewed') v.fail('GRAPH_ANALYSIS', `${field}.analysis`);
    return { path: filePath, analysis: node.analysis };
  });
  const pairs = new Set<string>();
  const edges = v.array(data.edges, '$.edges').map((value, index): GraphEdge => {
    const field = `$.edges[${index}]`;
    const edge = v.object(value, ['dependency', 'dependent', 'reason'], [], field);
    const dependency = v.path(edge.dependency, `${field}.dependency`);
    const dependent = v.path(edge.dependent, `${field}.dependent`);
    for (const [key, filePath] of [['dependency', dependency], ['dependent', dependent]]) {
      if (!paths.has(filePath!)) v.fail('GRAPH_REFERENCE', `${field}.${key}`, { path: filePath! });
    }
    v.unique(pairs, JSON.stringify([dependency, dependent]), field);
    return { dependency, dependent, reason: v.reason(edge.reason, `${field}.reason`) };
  });
  const ids = new Set<string>();
  const legends = Object.hasOwn(data, 'legends') ? v.array(data.legends, '$.legends').map((value, index) => {
    const field = `$.legends[${index}]`;
    const legend = completeLegend(readLegend(value, v, field, false), v, field);
    v.unique(ids, legend.id, field + '.id');
    checkUses(legend.uses, paths, v, field);
    return legend;
  }) : undefined;
  return { format: graphFormat, source_commit: data.source_commit, nodes, edges, ...(legends ? { legends } : {}) };
}

export function parseUpdate(value: unknown): GraphUpdate {
  const v: Fields = new Fields('GRAPH_INPUT_INVALID');
  const actions = ['register', 'reviews', 'remove', 'legendUpserts', 'legendRemove'];
  const data = v.object(value, ['format'], actions, '$');
  if (data.format !== updateFormat) v.fail('GRAPH_FORMAT', '$.format');
  if (!actions.some(key => Object.hasOwn(data, key))) v.fail('GRAPH_FIELDS', '$');
  const pathList = (key: string): string[] => {
    const seen = new Set<string>();
    return (Object.hasOwn(data, key) ? v.array(data[key], `$.${key}`) : []).map((value, index) => {
      const field = `$.${key}[${index}]`;
      const filePath = v.path(value, field);
      v.unique(seen, filePath, field);
      return filePath;
    });
  };
  const register = pathList('register');
  const remove = pathList('remove');
  const users = new Set<string>();
  const referenced = new Set(register);
  const reviews = (Object.hasOwn(data, 'reviews') ? v.array(data.reviews, '$.reviews') : []).map((value, index): GraphReview => {
    const field = `$.reviews[${index}]`;
    const review = v.object(value, ['path', 'analysis', 'dependencies'], [], field);
    const filePath = v.path(review.path, `${field}.path`);
    v.unique(users, filePath, `${field}.path`);
    referenced.add(filePath);
    if (review.analysis !== 'reviewed') v.fail('GRAPH_ANALYSIS', `${field}.analysis`);
    const seen = new Set<string>();
    const dependencies = v.array(review.dependencies, `${field}.dependencies`).map((value, index) => {
      const location = `${field}.dependencies[${index}]`;
      const entry = v.object(value, ['path', 'reason'], [], location);
      const dependency = v.path(entry.path, `${location}.path`);
      v.unique(seen, dependency, `${location}.path`);
      referenced.add(dependency);
      return { path: dependency, reason: v.reason(entry.reason, `${location}.reason`) };
    });
    return { path: filePath, analysis: 'reviewed', dependencies };
  });
  remove.forEach((filePath, index) => {
    if (referenced.has(filePath)) v.fail('GRAPH_CONFLICT', `$.remove[${index}]`, { path: filePath });
  });
  const ids = new Set<string>();
  const legendUpserts = (Object.hasOwn(data, 'legendUpserts') ? v.array(data.legendUpserts, '$.legendUpserts') : []).map((entry, index) => {
    const field = `$.legendUpserts[${index}]`;
    const patch = readLegend(entry, v, field, true);
    v.unique(ids, patch.id, field + '.id');
    return patch;
  });
  const legendRemove = (Object.hasOwn(data, 'legendRemove') ? v.array(data.legendRemove, '$.legendRemove') : []).map((entry, index) => {
    const field = `$.legendRemove[${index}]`;
    const id = v.legendId(entry, field);
    if (ids.has(id)) v.fail('GRAPH_CONFLICT', field, { id });
    ids.add(id);
    return id;
  });
  return { format: updateFormat, register, reviews, remove, legendUpserts, legendRemove };
}

function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function edgeOrder(a: GraphEdge, b: GraphEdge): number {
  return compare(a.dependent, b.dependent) || compare(a.dependency, b.dependency);
}

export function applyGraph(original: DependencyGraph, update: GraphUpdate): {
  graph: DependencyGraph; removedEdges: GraphEdge[]; affectedDependents: string[];
} {
  const nodes = new Map(original.nodes.map(node => [node.path, { ...node }]));
  const register = (filePath: string) => {
    if (!nodes.has(filePath)) nodes.set(filePath, { path: filePath, analysis: 'unreviewed' });
  };
  update.register.forEach(register);
  const users = new Set(update.reviews.map(review => review.path));
  let edges = original.edges.filter(edge => !users.has(edge.dependent));
  for (const review of update.reviews) {
    nodes.set(review.path, { path: review.path, analysis: 'reviewed' });
    for (const dependency of review.dependencies) {
      register(dependency.path);
      edges.push({ dependency: dependency.path, dependent: review.path, reason: dependency.reason });
    }
  }
  const removed = new Set(update.remove);
  const removedEdges = edges.filter(edge => removed.has(edge.dependency) || removed.has(edge.dependent));
  const affected = new Set(removedEdges.filter(edge => !removed.has(edge.dependent)).map(edge => edge.dependent));
  update.remove.forEach(filePath => nodes.delete(filePath));
  affected.forEach(filePath => nodes.set(filePath, { path: filePath, analysis: 'unreviewed' }));
  edges = edges.filter(edge => !removed.has(edge.dependency) && !removed.has(edge.dependent));
  const legends = new Map<string, LibraryLegend>((original.legends ?? []).map(legend => [legend.id, {
    ...legend, uses: legend.uses.filter(use => !removed.has(use.path)),
  }]));
  update.legendRemove.forEach(id => legends.delete(id));
  const fields = new Fields('GRAPH_INPUT_INVALID');
  update.legendUpserts.forEach((patch, index) => {
    const field = `$.legendUpserts[${index}]`;
    if (patch.uses) checkUses(patch.uses, nodes, fields, field);
    legends.set(patch.id, completeLegend({ ...legends.get(patch.id), ...patch }, fields, field));
  });
  return { graph: { format: graphFormat, source_commit: original.source_commit,
    nodes: [...nodes.values()].sort((a, b) => compare(a.path, b.path)), edges: edges.sort(edgeOrder),
    ...(legends.size ? { legends: [...legends.values()].sort((a, b) => compare(a.id, b.id)) } : {}) },
  removedEdges: removedEdges.sort(edgeOrder), affectedDependents: [...affected].sort(compare) };
}

export function queryGraph(graph: DependencyGraph, filePath: string) {
  const node = graph.nodes.find(node => node.path === filePath);
  return { source_commit: graph.source_commit, path: filePath, registered: node !== undefined, analysis: node?.analysis ?? null,
    dependencies: graph.edges.filter(edge => edge.dependent === filePath),
    dependents: graph.edges.filter(edge => edge.dependency === filePath),
    sourceCheck: 'not-run' as const, semanticQuality: 'unchecked' as const };
}
