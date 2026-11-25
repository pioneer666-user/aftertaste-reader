import assert from 'node:assert/strict';
import test from 'node:test';
import { applyGraph, graphFormat, parseGraph, parseUpdate, updateFormat } from '../../dist/core/dependency-graph.js';
import { defaultLayout, parseLayout, rearrange, reconcileLayout } from '../../dist/core/canvas-layout.js';
import { parseLoopInput } from '../../dist/core/loops.js';
import { switchVisibility } from '../../dist/core/switch-visibility.js';
import { orderInput } from '../fixtures/loop-authoring.mjs';

const edge = { from: 'a.js', to: 'b.js' };
const one = { id: 'one', type: 'switch', question: '谁写入日志？', nodes: ['a.js'], edges: [edge] };
const two = { ...one, id: 'two' };
const graph = { format: graphFormat, source_commit: 'a'.repeat(40),
  nodes: [edge.from, edge.to].map(path => ({ path, analysis: 'reviewed' })),
  edges: [{ dependency: edge.from, dependent: edge.to, reason: '写日志' }], legends: [one, two] };
const apply = (original, changes) => applyGraph(original, parseUpdate({ format: updateFormat, ...changes })).graph;

test('同图引用校验于最终关系，错类型、重复、空目标和跨图引用均定位', () => {
  for (const legend of [{ ...one, type: 'quiz' }, { ...one, nodes: [], edges: [] }, { ...one, nodes: ['x.js'] },
    { ...one, edges: [{ from: 'b.js', to: 'a.js' }] }, { ...one, nodes: ['a.js', 'a.js'] }, { ...one, edges: [edge, edge] }]) {
    assert.throws(() => parseGraph(JSON.stringify({ ...graph, legends: [legend] })),
      e => e.code === 'GRAPH_INVALID' && e.diagnostics[0].field.startsWith('$.legends[0]') && !!e.context.graphPath);
  }
  assert.throws(() => apply(graph, { remove: ['a.js'] }), { code: 'GRAPH_INPUT_INVALID' });
  assert.deepEqual(apply(graph, { remove: ['a.js'], legendRemove: ['one', 'two'] }).nodes.map(n => n.path), ['b.js']);
  const updated = apply(graph, { legendUpserts: [{ ...two, question: '何时写日志？' }] });
  assert.deepEqual(updated.legends[0], one);
  assert.deepEqual(apply(updated, { legendUpserts: [updated.legends[1]] }), updated);
  assert.throws(() => parseLoopInput({ ...orderInput, legends: [one] }),
    e => e.code === 'LOOP_INPUT_INVALID' && e.context.field === '$.legends[0].nodes[0]');
});

test('共享目标的任一开关展开即可见，单控线也须两端可见', () => {
  const legends = [one, two, { ...one, id: 'edge', nodes: [] }];
  for (const expanded of [[], ['legend:edge'], ['legend:one'], ['legend:two'], ['legend:one', 'legend:two']]) {
    const view = switchVisibility(legends, expanded);
    const nodeOpen = expanded.includes('legend:one') || expanded.includes('legend:two');
    assert.equal(view.node('a.js'), nodeOpen);
    assert.equal(view.edge(edge.from, edge.to), nodeOpen);
    assert.equal(view.node('b.js'), true);
  }
});

test('关合时保存全部成员，重排保留展开，重建身份丢弃旧开关状态', () => {
  const ids = ['a.js','b.js','legend:one','legend:two'];
  const relations = { edges: [edge], libraries: [], switches: ids.slice(2) };
  const layout = { ...defaultLayout(ids, relations), expanded: ['legend:one'],
    groups: [{ id: '11111111-1111-4111-8111-111111111111', name: '审计', members: ['legend:one','a.js'] }] };
  assert.deepEqual(parseLayout(layout), layout);
  assert.deepEqual(rearrange(layout, ids, relations).expanded, layout.expanded);
  const next = reconcileLayout(layout, [...ids, 'c.js'], new Set(), relations);
  assert.deepEqual(next.groups, layout.groups);
  assert.deepEqual(next.positions['a.js'], layout.positions['a.js']);
  assert.ok(next.positions['c.js']);
  const renewed = reconcileLayout(next, ids, new Set(['legend:one']), relations);
  assert.deepEqual(renewed.expanded, []);
  assert.deepEqual(renewed.groups[0].members, ['a.js']);
  for (const expanded of [['legend:missing'], ['a.js'], ['legend:one','legend:one']]) {
    assert.throws(() => parseLayout({ ...layout, expanded }), { code: 'LAYOUT_INVALID' });
  }
});
