import { GraphError, isLegendId, parseLibraryLegends } from './dependency-graph.js';
import type { LibraryLegend } from './dependency-graph.js';
import { readRange } from './document-blocks.js';
import type { LineRange } from './document-blocks.js';
import { isSourcePath } from './source-path.js';

export const loopInputFormat = 'aftertaste-loop-input/v1';
export const loopFormat = 'aftertaste-loop/v1';

type LoopErrorCode = 'LOOP_INPUT_INVALID' | 'LOOP_INPUT_READ_FAILED' | 'LOOP_BLOCK_INVALID' | 'LOOP_LEGEND_INVALID' |
  'LOOP_EXISTS' | 'LOOP_INVALID' | 'LOOP_NOT_FOUND' | 'LOOP_PATH_UNSAFE' | 'LOOP_READ_FAILED' | 'LOOP_WRITE_FAILED' | 'LOOP_LIST_FAILED';

export class LoopError extends Error {
  constructor(public readonly code: LoopErrorCode, message: string, public readonly nextStep: string,
    public readonly context: Readonly<Record<string, string | number>> = {}) {
    super(message);
    this.name = 'LoopError';
  }
}

interface LoopNode {
  id: string;
  path: string;
  block_id: string;
  title: string;
  explanation: string;
  hint?: string;
  annotation?: string;
  library_uses?: { id: string; reason: string }[];
}

export interface SavedNode extends LoopNode {
  block_explanation: string;
  lines?: LineRange;
}

interface LegendSelection {
  id: string;
  paths: string[];
}

interface Route<Node> {
  title: string;
  goal: string;
  explanation: string;
  entry: string;
  nodes: Node[];
  edges: { from: string; to: string; reason: string }[];
  reading_order: string[];
}

export interface LoopInput extends Route<LoopNode> {
  legends: LegendSelection[];
}

export interface SavedLoop extends Route<SavedNode> {
  format: typeof loopFormat;
  id: string;
  source_commit: string;
  project_prefix: string;
  legends: LibraryLegend[];
}

export function isNodeId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
}

export function isLoopId(value: unknown): value is string {
  return isNodeId(value) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/u.test(value);
}

const routeKeys = ['title', 'goal', 'explanation', 'entry', 'nodes', 'edges', 'reading_order'];
const nodeKeys = ['id', 'path', 'block_id', 'title', 'explanation'];

class Fields {
  constructor(private readonly code: 'LOOP_INPUT_INVALID' | 'LOOP_INVALID') {}

  fail(field: string, reason: string): never {
    throw new LoopError(this.code, '闭环字段无效。', '按闭环契约核对字段和引用，再重试。', { field, reason });
  }

  object(value: unknown, required: string[], optional: string[], field: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value) ||
        required.some(key => !Object.hasOwn(value, key)) ||
        Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) this.fail(field, 'FIELDS');
    return value as Record<string, unknown>;
  }

  array(value: unknown, field: string): unknown[] {
    if (!Array.isArray(value)) this.fail(field, 'ARRAY');
    return Array.from(value);
  }

  text(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.isWellFormed() || value.trim() === '') this.fail(field, 'TEXT');
    return value;
  }

  unique(seen: Set<string>, key: string, field: string): void {
    if (seen.has(key)) this.fail(field, 'DUPLICATE');
    seen.add(key);
  }
}

function readNode(data: Record<string, unknown>, v: Fields, field: string): LoopNode {
  if (!isNodeId(data.id)) v.fail(field + '.id', 'ID');
  if (!isSourcePath(data.path)) v.fail(field + '.path', 'PATH');
  if (typeof data.block_id !== 'string' || !/^[a-z0-9]{8}$/u.test(data.block_id)) v.fail(field + '.block_id', 'BLOCK_ID');
  const seen = new Set<string>();
  const uses = Object.hasOwn(data, 'library_uses') ? v.array(data.library_uses, field + '.library_uses').map((value, index) => {
    const location = field + '.library_uses[' + index + ']';
    const use = v.object(value, ['id', 'reason'], [], location);
    if (!isLegendId(use.id)) v.fail(location + '.id', 'LEGEND_ID');
    v.unique(seen, use.id, location + '.id');
    return { id: use.id, reason: v.text(use.reason, location + '.reason') };
  }) : undefined;
  return { ...(uses && { library_uses: uses }), id: data.id, path: data.path, block_id: data.block_id,
    title: v.text(data.title, field + '.title'), explanation: v.text(data.explanation, field + '.explanation'),
    ...(Object.hasOwn(data, 'annotation') ? { annotation: v.text(data.annotation, field + '.annotation') } : {}),
    ...(Object.hasOwn(data, 'hint') ? { hint: v.text(data.hint, field + '.hint') } : {}) };
}

function readRoute<Node extends LoopNode>(data: Record<string, unknown>, v: Fields,
  parseNode: (value: unknown, field: string) => Node): Route<Node> {
  const ids = new Set<string>();
  const nodes = v.array(data.nodes, '$.nodes').map((value, index) => {
    const field = '$.nodes[' + index + ']';
    const node = parseNode(value, field);
    v.unique(ids, node.id, field + '.id');
    return node;
  });
  if (new Set(nodes.map(node => node.path)).size < 2) v.fail('$.nodes', 'CROSS_FILE');
  const nodeId = (value: unknown, field: string) => {
    if (typeof value !== 'string' || !ids.has(value)) v.fail(field, 'UNKNOWN_NODE');
    return value;
  };
  const entry = nodeId(data.entry, '$.entry');
  const outgoing = new Map<string, Set<string>>();
  const edges = v.array(data.edges, '$.edges').map((value, index) => {
    const field = '$.edges[' + index + ']';
    const edge = v.object(value, ['from', 'to', 'reason'], [], field);
    const from = nodeId(edge.from, field + '.from');
    const to = nodeId(edge.to, field + '.to');
    const targets = outgoing.get(from) ?? new Set<string>();
    v.unique(targets, to, field);
    outgoing.set(from, targets);
    return { from, to, reason: v.text(edge.reason, field + '.reason') };
  });
  const reached = new Set([entry]);
  for (const from of reached) for (const to of outgoing.get(from) ?? []) reached.add(to);
  if (reached.size !== nodes.length) v.fail('$.edges', 'UNREACHABLE_NODE');

  const seen = new Set<string>();
  const reading_order = v.array(data.reading_order, '$.reading_order').map((value, index) => {
    const field = '$.reading_order[' + index + ']';
    const id = nodeId(value, field);
    v.unique(seen, id, field);
    return id;
  });
  if (seen.size !== nodes.length) v.fail('$.reading_order', 'MISSING_NODE');

  return { title: v.text(data.title, '$.title'), goal: v.text(data.goal, '$.goal'),
    explanation: v.text(data.explanation, '$.explanation'), entry, nodes, edges, reading_order };
}

function checkStepUses(nodes: LoopNode[], paths: Map<string, Set<string>>, v: Fields) {
  nodes.forEach((node, index) => node.library_uses?.forEach((use, useIndex) => {
    if (!paths.get(use.id)?.has(node.path)) v.fail(`$.nodes[${index}].library_uses[${useIndex}]`, 'UNKNOWN_FILE_USE');
  }));
}

export function parseLoopInput(value: unknown): LoopInput {
  const v: Fields = new Fields('LOOP_INPUT_INVALID');
  const data = v.object(value, ['format', ...routeKeys], ['legends'], '$');
  if (data.format !== loopInputFormat) v.fail('$.format', 'FORMAT');
  const route = readRoute(data, v, (value, field) => readNode(v.object(value, nodeKeys, ['annotation', 'hint', 'library_uses'], field), v, field));
  const participants = new Set(route.nodes.map(node => node.path));
  const ids = new Set<string>();
  const legends = Object.hasOwn(data, 'legends') ? v.array(data.legends, '$.legends').map((value, index) => {
    const field = '$.legends[' + index + ']';
    const legend = v.object(value, ['id', 'paths'], [], field);
    if (!isLegendId(legend.id)) v.fail(field + '.id', 'LEGEND_ID');
    v.unique(ids, legend.id, field + '.id');
    const selected = new Set<string>();
    const paths = v.array(legend.paths, field + '.paths').map((value, index) => {
      const location = field + '.paths[' + index + ']';
      if (typeof value !== 'string' || !participants.has(value)) v.fail(location, 'UNKNOWN_PARTICIPANT');
      v.unique(selected, value, location);
      return value;
    });
    if (!paths.length) v.fail(field + '.paths', 'MISSING_USE');
    return { id: legend.id, paths };
  }) : [];
  checkStepUses(route.nodes, new Map(legends.map(legend => [legend.id, new Set(legend.paths)])), v);
  return { ...route, legends };
}

export function parseSavedLoop(raw: string, id: string): SavedLoop {
  const v: Fields = new Fields('LOOP_INVALID');
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^\uFEFF/u, '')); }
  catch { v.fail('$', 'JSON'); }
  const data = v.object(value, ['format', 'id', 'source_commit', 'project_prefix', ...routeKeys, 'legends'], [], '$');
  if (data.format !== loopFormat) v.fail('$.format', 'FORMAT');
  if (!isLoopId(data.id) || data.id !== id) v.fail('$.id', 'ID_MISMATCH');
  if (typeof data.source_commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(data.source_commit)) {
    v.fail('$.source_commit', 'COMMIT');
  }
  if (data.project_prefix !== '' && !isSourcePath(data.project_prefix)) v.fail('$.project_prefix', 'PATH');
  const route = readRoute<SavedNode>(data, v, (value, field) => {
    const node = v.object(value, [...nodeKeys, 'block_explanation'], ['annotation', 'hint', 'lines', 'library_uses'], field);
    const lines = readRange(node.lines);
    if (Object.hasOwn(node, 'lines') && !lines) v.fail(field + '.lines', 'RANGE');
    return { ...readNode(node, v, field), block_explanation: v.text(node.block_explanation, field + '.block_explanation'),
      ...(lines ? { lines } : {}) };
  });
  let legends: LibraryLegend[];
  try { legends = parseLibraryLegends(data.legends, new Set(route.nodes.map(node => node.path))); }
  catch (error) {
    if (!(error instanceof GraphError)) throw error;
    v.fail(error.diagnostics[0]?.field ?? '$.legends', error.diagnostics[0]?.code ?? error.code);
  }
  if (legends.some(legend => legend.uses.length === 0)) v.fail('$.legends', 'MISSING_USE');
  checkStepUses(route.nodes, new Map(legends.map(legend => [legend.id, new Set(legend.uses.map(use => use.path))])), v);
  return { format: loopFormat, id, source_commit: data.source_commit, project_prefix: data.project_prefix, ...route, legends };
}
