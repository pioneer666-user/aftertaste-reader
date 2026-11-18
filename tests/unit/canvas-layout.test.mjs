import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultLayout, groupBounds, moveMembers, reconcileLayout, rearrange, updateGroup, parseLayout } from '../../dist/core/canvas-layout.js';

const a = 'src/a.mjs';
const b = 'src/b.mjs';
const c = 'constructor';
const d = '__proto__';
const first = '10000000-0000-4000-8000-000000000000';
const second = '20000000-0000-4000-8000-000000000000';

test('缩放后拖组只改变显式成员及组框，覆盖多组、非成员和原型同名路径', () => {
  let seed = 237;
  const int = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % 300) - 150;
  for (let i = 0; i < 80; i++) {
    const x = int(), y = int();
    const positions = Object.fromEntries([[a, { x, y }], [b, { x: x + 232, y: y + 80 }],
      [c, { x: x + 10, y: y + 10 }], [d, { x: x + 110, y: y + 40 }]]);
    const boundsOf = positions => groupBounds(positions, [a, b], id =>
      id === a ? { width: 250, height: 90 } : { width: 212, height: 56 });
    const bounds = boundsOf(positions);
    assert.deepEqual(bounds, { x: x - 20, y: y - 44, width: 484, height: 200 });
    const zoom = i % 2 ? 0.5 : 1.6;
    const dx = int(), dy = int();
    const moved = { ...positions, ...moveMembers(positions, [a, b], bounds,
      { x: bounds.x + dx / zoom, y: bounds.y + dy / zoom }) };
    for (const id of [a, b]) {
      assert.ok(Math.abs((moved[id].x - positions[id].x) * zoom - dx) < 1e-9);
      assert.ok(Math.abs((moved[id].y - positions[id].y) * zoom - dy) < 1e-9);
    }
    assert.deepEqual(moved[c], positions[c]);
    assert.deepEqual(moved[d], positions[d]);
    assert.ok(Math.abs(boundsOf(moved).width - bounds.width) < 1e-9);
  }
});

test('增删按身份协调，显式转组和保组重排', () => {
  const layout = defaultLayout([a, b, c]);
  layout.groups = [ { id: first, name: '一组', members: [a] }, { id: second, name: '二组', members: [b, c] } ];
  const next = reconcileLayout(layout, [b, c, d]);
  assert.deepEqual(next.positions[b], layout.positions[b]);
  assert.deepEqual(next.positions[c], layout.positions[c]);
  assert.ok(next.positions[d].x > Math.max(...Object.values(layout.positions).map(p => p.x)) + 212);
  assert.ok(Object.hasOwn(next.positions, d));
  assert.equal(Object.hasOwn(next.positions, a), false);
  assert.deepEqual(next.groups, [layout.groups[1]]);
  assert.deepEqual(reconcileLayout(next, [b, c, d]), next);
  const readded = new Set([a]);
  assert.deepEqual(reconcileLayout(layout, [a, b], readded),
    reconcileLayout(reconcileLayout(layout, [b]), [a, b], readded));
  const updated = updateGroup(layout.groups, { id: first, name: '改名', members: [a, b, c] });
  assert.deepEqual(updated, [{ id: first, name: '改名', members: [a, b, c] }]);
  assert.deepEqual(rearrange({ ...layout, groups: updated }, [a, b, c]).groups, updated);
  assert.deepEqual(parseLayout(JSON.parse(JSON.stringify(next))), next);
  assert.throws(() => parseLayout({ ...next, groups: [...next.groups, { id: first, name: '重复', members: [c] }] }),
    { code: 'LAYOUT_INVALID' });
});

test('已有排布逼近坐标边界时，新增位置仍有效且不重叠', () => {
  const layout = defaultLayout([a, b, c, d, 'middle']);
  layout.positions[a] = { x: 1e9, y: 0 };
  layout.positions[b] = { x: -1e9, y: 0 };
  layout.positions[c] = { x: 0, y: 1e9 };
  layout.positions[d] = { x: 0, y: -1e9 };
  layout.positions.middle = { x: 30, y: 64 };
  const ids = [...Object.keys(layout.positions), 'new'];
  const next = reconcileLayout(layout, ids);
  for (const [id, point] of Object.entries(layout.positions)) assert.deepEqual(next.positions[id], point);
  assert.deepEqual(next.positions.new, { x: 30, y: 176 });
  assert.deepEqual(parseLayout(next), next);
});
