import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../../dist/core/dependency-graph.js';
import { update, review, graphFormat } from '../fixtures/dependency-graph.mjs';

const commit = 'a'.repeat(40);
const empty = () => ({ format: graphFormat, source_commit: commit, nodes: [], edges: [] });
const apply = (graph, actions) => rules.applyGraph(graph, rules.parseUpdate(update(actions)));
const analysis = (graph, filePath) => graph.nodes.find(node => node.path === filePath)?.analysis;

test('登记、重复登记、查询三种状态与 Git 路径大小写身份', () => {
  const initial = empty();
  const graph = apply(initial, { register: ['service.ts', 'Case.ts', 'case.ts'] }).graph;
  assert.equal(graph.nodes.length, 3);
  assert.equal(analysis(graph, 'service.ts'), 'unreviewed');
  assert.equal(rules.queryGraph(graph, 'missing.ts').registered, false);
  assert.equal(rules.queryGraph(graph, 'missing.ts').analysis, null);
  const checked = apply(graph, { reviews: [review('service.ts')] }).graph;
  assert.equal(rules.queryGraph(checked, 'service.ts').analysis, 'reviewed');
  assert.deepEqual(rules.queryGraph(checked, 'service.ts').dependencies, []);
  assert.deepEqual(apply(checked, { register: ['service.ts'] }).graph, checked);
  assert.deepEqual(initial, empty());
});

test('完整依赖仅替换指定使用者，范围外新引用未核对，空列表与未分析分开', () => {
  const original = apply(empty(), { reviews: [review('service.ts', ['schema.ts', 'old_repo.ts']), review('router.ts', ['service.ts'])] }).graph;
  const snapshot = structuredClone(original);
  const result = apply(original, { reviews: [review('service.ts', ['schema.ts', 'new_repo.ts'])] }).graph;
  assert.deepEqual(result.edges.filter(edge => edge.dependent === 'router.ts'), snapshot.edges.filter(edge => edge.dependent === 'router.ts'));
  assert.deepEqual(result.edges.filter(edge => edge.dependent === 'service.ts').map(edge => edge.dependency), ['new_repo.ts', 'schema.ts']);
  assert.equal(analysis(result, 'new_repo.ts'), 'unreviewed');
  assert.equal(analysis(result, 'old_repo.ts'), 'unreviewed');
  assert.equal(analysis(result, 'service.ts'), 'reviewed');
  assert.deepEqual(original, snapshot);
  assert.deepEqual(apply(result, { reviews: [review('service.ts', ['schema.ts', 'new_repo.ts'])] }).graph, result);
  const noDependencies = apply(result, { reviews: [review('service.ts')] }).graph;
  assert.equal(analysis(noDependencies, 'service.ts'), 'reviewed');
  assert.equal(rules.queryGraph(noDependencies, 'service.ts').dependencies.length, 0);
  assert.equal(rules.queryGraph(noDependencies, 'service.ts').dependents.length, 1);
  for (const entry of [{ path: 'service.ts', dependencies: [] }, { path: 'service.ts', analysis: 'unreviewed', dependencies: [] },
    { path: 'service.ts', analysis: 'reviewed' }]) {
    assert.throws(() => rules.parseUpdate(update({ reviews: [entry] })), { code: 'GRAPH_INPUT_INVALID' });
  }
});

test('明确删除反馈移除边与受影响存续者，降级被动失边状态，重复删除幂等', () => {
  const original = apply(empty(), { reviews: [review('service.ts', ['schema.ts', 'other.ts']), review('router.ts', ['service.ts']), review('schema.ts', ['schema.ts'])] }).graph;
  const { graph, removedEdges, affectedDependents } = apply(original, { remove: ['schema.ts'] });
  assert.deepEqual(affectedDependents, ['service.ts']);
  assert.equal(removedEdges.length, 2);
  assert.equal(analysis(graph, 'schema.ts'), undefined);
  assert.equal(analysis(graph, 'service.ts'), 'unreviewed');
  assert.equal(analysis(graph, 'router.ts'), 'reviewed');
  assert.equal(graph.edges.length, 2);
  assert.deepEqual(apply(graph, { remove: ['schema.ts'] }).graph, graph);
  assert.equal(original.nodes.length, 4);
});

test('结构/输入诊断定位具体字段，拒绝重复、悬空、非法路径和冲突', () => {
  const base = apply(empty(), { reviews: [review('a.ts', ['b.ts'])] }).graph;
  assert.deepEqual(rules.parseGraph('\uFEFF' + JSON.stringify(base)), base);
  const cases = [
    ['{', 'GRAPH_JSON', '$'],
    [{ ...base, unknown: 1 }, 'GRAPH_FIELDS', '$'],
    [{ ...base, source_commit: 'HEAD' }, 'GRAPH_COMMIT', '$.source_commit'],
    [{ ...base, format: 'future' }, 'GRAPH_FORMAT', '$.format'],
    [{ ...base, nodes: [...base.nodes, base.nodes[0]] }, 'GRAPH_DUPLICATE', '$.nodes[2].path'],
    [{ ...base, nodes: [{ path: '../x', analysis: 'reviewed' }] }, 'GRAPH_PATH', '$.nodes[0].path'],
    [{ ...base, nodes: [{ path: 'a.ts', analysis: 'unknown' }] }, 'GRAPH_ANALYSIS', '$.nodes[0].analysis'],
    [{ ...base, edges: [...base.edges, base.edges[0]] }, 'GRAPH_DUPLICATE', '$.edges[1]'],
    [{ ...base, edges: [{ ...base.edges[0], dependency: 'missing.ts' }] }, 'GRAPH_REFERENCE', '$.edges[0].dependency'],
    [{ ...base, edges: [{ ...base.edges[0], reason: '  ' }] }, 'GRAPH_REASON', '$.edges[0].reason'],
  ];
  for (const [value, code, field] of cases) {
    assert.throws(() => rules.parseGraph(typeof value === 'string' ? value : JSON.stringify(value)), error => {
      assert.equal(error.code, 'GRAPH_INVALID');
      assert.equal(error.diagnostics[0].code, code);
      assert.equal(error.diagnostics[0].field, field);
      return true;
    });
  }
  for (const actions of [{ register: ['a.ts', 'a.ts'] }, { remove: ['a.ts', 'a.ts'] },
    { reviews: [review('a.ts'), review('a.ts')] }, { reviews: [review('a.ts', ['b.ts', 'b.ts'])] },
    { register: ['a.ts'], remove: ['a.ts'] }, { reviews: [review('a.ts', ['b.ts'])], remove: ['b.ts'] },
    { register: null }, { remove: ['.git/config'] }, {}, { reviews: [{ ...review('a.ts'), extra: true }] }]) {
    assert.throws(() => rules.parseUpdate(update(actions)), { code: 'GRAPH_INPUT_INVALID' });
  }
  for (const bad of ['../x', '/x', 'x//y', 'x\\y', 'x/.GIT/y', 'x\0y', '\uD800']) {
    assert.throws(() => rules.parseUpdate(update({ register: [bad] })), { code: 'GRAPH_INPUT_INVALID' });
  }
});

test('有限小域性质：512 种有向图的替换隔离/幂等、删除引用一致与状态独立预期', () => {
  const paths = ['a.ts', 'b.ts', 'c.ts'];
  for (let mask = 0; mask < 512; mask++) {
    const source = { ...empty(), nodes: paths.map(path => ({ path, analysis: 'reviewed' })), edges: [] };
    for (let bit = 0; bit < 9; bit++) if (mask & (1 << bit)) source.edges.push({ dependency: paths[bit % 3], dependent: paths[Math.floor(bit / 3)], reason: `edge ${bit}` });
    for (const filePath of paths) {
      const actions = { reviews: [review(filePath, ['a.ts', 'c.ts'])] };
      const result = apply(source, actions).graph;
      assert.deepEqual(apply(result, actions).graph, result, `idempotence mask=${mask} path=${filePath}`);
      assert.deepEqual(result.edges.filter(edge => edge.dependent !== filePath).sort((a, b) => a.reason.localeCompare(b.reason)),
        source.edges.filter(edge => edge.dependent !== filePath).sort((a, b) => a.reason.localeCompare(b.reason)), `untouched mask=${mask}`);
      assert.equal(result.edges.filter(edge => edge.dependent === filePath).length, 2);
      const removed = apply(source, { remove: [filePath] });
      assert.ok(removed.graph.edges.every(edge => edge.dependency !== filePath && edge.dependent !== filePath));
      assert.equal(removed.graph.nodes.length, 2);
      for (const survivor of removed.graph.nodes) {
        const lost = source.edges.some(edge => edge.dependency === filePath && edge.dependent === survivor.path);
        assert.equal(survivor.analysis, lost ? 'unreviewed' : 'reviewed', `state mask=${mask}`);
      }
      assert.deepEqual(rules.parseGraph(JSON.stringify(result)), result);
    }
  }
});
