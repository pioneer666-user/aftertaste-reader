import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { link, mkdir, mkdtemp, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { GraphFileStore } from '../../dist/adapters/graph-store.js';
import { GraphService } from '../../dist/application/dependency-graph.js';
import { GitSourceRepository } from '../../dist/adapters/git-source.js';
import { FixedSourceService } from '../../dist/application/fixed-source.js';
import { startReader } from '../../dist/server/reader.js';
import { applyGraphUpdate, cli, repository } from '../fixtures/dependency-canvas.mjs';
import { api, audit, createLegendProject, legendId, readJSON, rules, service, standardLegend, thirdPartyLegend,
  updatedDescription, writeJSON } from '../fixtures/dependency-legends.mjs';

const root = path.join(repository, '.local/D014');
await mkdir(root, { recursive: true });
const fixture = async tag => createLegendProject(path.join(await mkdtemp(path.join(root, tag + '-')), 'project'));
const fixed = project => ({ projectRoot: project.projectRoot, repositoryRoot: project.projectRoot, projectPrefix: '', commit: project.commit });
const graphCommand = (project, command, ...args) => spawnSync(process.execPath, [cli, command, '--project', project.projectRoot,
  '--repository', project.projectRoot, '--prefix', '', '--commit', project.commit, ...args], { encoding: 'utf8', windowsHide: true });
function result(project, command, ...args) {
  const { stdout, stderr, status } = graphCommand(project, command, ...args);
  assert.equal(status, 0, stderr);
  return JSON.parse(stdout).result;
}
const canvas = url => fetch(url + '/api/dependency-canvas').then(response => response.json());
const payload = state => ({ graphVersion: state.graphVersion, expectedRevision: state.revision, revision: randomUUID(),
  layout: { ...state.layout, positions: Object.entries(state.layout.positions) } });
const put = (url, body, route = '/api/dependency-layout') => fetch(url + route, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Layout': '1' }, body: JSON.stringify(body),
});

test('正式 CLI 管理和校验库图例，重复提交、无效关联和文件删除保持契约', async () => {
  const project = await fixture('cli');
  const initial = result(project, 'query-graph', '--path', service);
  assert.deepEqual(result(project, 'query-legends').legends, []);
  const actions = { legendUpserts: [standardLegend, { ...thirdPartyLegend, name: rules }] };
  await applyGraphUpdate(project, actions);
  const beforeReplay = await readFile(project.graph);
  await applyGraphUpdate(project, actions);
  assert.deepEqual(await readFile(project.graph), beforeReplay);
  assert.deepEqual(result(project, 'query-legends', '--id', standardLegend.id).legends, [standardLegend]);
  assert.equal(result(project, 'query-legends').legends.length, 2);
  assert.deepEqual(result(project, 'query-graph', '--path', service), initial);
  assert.equal(result(project, 'validate-graph').sourceCheck, 'completed');

  const input = path.join(path.dirname(project.projectRoot), 'invalid.json');
  const invalid = [
    [{ legendUpserts: [{ ...standardLegend, id: '../path' }] }, 'GRAPH_LEGEND_ID'],
    [{ legendUpserts: [{ ...standardLegend, kind: 'other' }] }, 'GRAPH_LEGEND_KIND'],
    [{ legendUpserts: [{ id: 'new-id', description: 'Missing name and kind' }] }, 'GRAPH_FIELDS'],
    [{ legendUpserts: [standardLegend, standardLegend] }, 'GRAPH_DUPLICATE'],
    [{ legendUpserts: [{ ...standardLegend, uses: [standardLegend.uses[0], standardLegend.uses[0]] }] }, 'GRAPH_DUPLICATE'],
    [{ legendUpserts: [standardLegend], legendRemove: [standardLegend.id] }, 'GRAPH_CONFLICT'],
    [{ legendUpserts: [{ ...standardLegend, uses: [{ path: 'missing.mjs', reason: 'Missing endpoint' }] }] }, 'GRAPH_REFERENCE'],
    [{ remove: [api], legendUpserts: [standardLegend] }, 'GRAPH_REFERENCE'],
  ];
  for (const [update, code] of invalid) {
    await writeJSON(input, { format: 'aftertaste-dependency-update/v1', ...update });
    const run = graphCommand(project, 'apply-graph', '--input', input);
    assert.equal(run.status, 2, run.stderr);
    assert.equal(JSON.parse(run.stderr).error.diagnostics[0].code, code);
    assert.deepEqual(await readFile(project.graph), beforeReplay);
  }
  const patch = { id: standardLegend.id, description: updatedDescription };
  await applyGraphUpdate(project, { legendUpserts: [patch] });
  const updated = { ...standardLegend, description: updatedDescription };
  assert.deepEqual(result(project, 'query-legends', '--id', patch.id).legends, [updated]);
  const reviewed = [{ path: service, analysis: 'reviewed', dependencies: [{ path: rules, reason: '更新文件依赖理由' }] }];
  await applyGraphUpdate(project, { reviews: reviewed });
  assert.deepEqual(result(project, 'query-graph', '--path', service).dependencies,
    [{ dependency: rules, dependent: service, reason: reviewed[0].dependencies[0].reason }]);
  assert.deepEqual(result(project, 'query-legends', '--id', patch.id).legends, [updated]);
  const replacement = [{ path: audit, reason: '更新使用理由并移除已选的另一关联' }];
  await applyGraphUpdate(project, { legendUpserts: [{ id: patch.id, uses: replacement }] });
  assert.deepEqual(result(project, 'query-legends', '--id', patch.id).legends, [{ ...updated, uses: replacement }]);
  assert.equal(result(project, 'query-graph', '--path', service).analysis, 'reviewed');
  await applyGraphUpdate(project, { remove: [audit] });
  assert.deepEqual(result(project, 'query-legends', '--id', patch.id).legends, [{ ...updated, uses: [] }]);
  assert.equal(result(project, 'validate-graph').mechanicallyValid, true);
  await applyGraphUpdate(project, { legendRemove: [patch.id] });
  const after = [await readFile(project.graph), await readFile(project.receipt)];
  await applyGraphUpdate(project, { legendRemove: [patch.id] });
  assert.deepEqual([await readFile(project.graph), await readFile(project.receipt)], after);
  assert.deepEqual(result(project, 'query-legends', '--id', patch.id).legends, []);
});

test('真实 HTTP 仅写布局，暂缺和坏图保全原件，正式删除和重加拒绝旧快照', async () => {
  const project = await fixture('http');
  const reader = await startReader(project.projectRoot, 0);
  try {
    const first = await canvas(reader.url);
    const legacy = await readJSON(project.layout);
    assert.deepEqual(first.layout, legacy.layout);
    await applyGraphUpdate(project, { legendUpserts: [standardLegend] });
    const added = await canvas(reader.url);
    assert.equal(added.reconciled, true);
    for (const [id, point] of Object.entries(first.layout.positions)) assert.deepEqual(added.layout.positions[id], point);
    assert.deepEqual(added.layout.groups, first.layout.groups);
    assert.deepEqual(added.layout.viewport, first.layout.viewport);
    const defaultPoint = added.layout.positions[legendId];
    added.layout.positions[legendId] = { x: 77, y: 123 };
    added.layout.groups.push({ id: randomUUID(), name: 'Library only', members: [legendId] });
    const graphBytes = await readFile(project.graph);
    const layoutRequest = payload(added);
    const requestedEdit = [{ ...standardLegend, description: 'Unauthorized', uses: [] }];
    for (const body of [{ ...layoutRequest, graph: { legends: requestedEdit } },
      { ...layoutRequest, layout: { ...layoutRequest.layout, legends: requestedEdit } },
      { ...layoutRequest, layout: { ...layoutRequest.layout,
        groups: [...layoutRequest.layout.groups.slice(0, -1), { ...layoutRequest.layout.groups.at(-1), uses: [] }] } }]) {
      assert.equal((await put(reader.url, body)).status, 400);
    }
    assert.equal((await put(reader.url, requestedEdit, '/api/dependency-canvas')).status, 405);
    assert.deepEqual(await readJSON(project.layout), legacy);
    assert.equal((await put(reader.url, layoutRequest)).status, 200);
    assert.deepEqual(await readFile(project.graph), graphBytes);

    const saved = await canvas(reader.url);
    const stale = payload(saved);
    const layoutBytes = await readFile(project.layout);
    assert.equal(saved.layoutProblem, null);
    const { legends, ...withoutLegends } = saved.graph;
    await writeJSON(project.graph, withoutLegends);
    const missing = await canvas(reader.url);
    assert.equal(missing.layoutProblem.code, 'LAYOUT_GRAPH_UNCONFIRMED');
    assert.equal(missing.layoutProblem.context.field, legendId);
    assert.equal((await put(reader.url, payload(missing))).status, 409);
    assert.deepEqual(await readFile(project.layout), layoutBytes);
    await writeJSON(project.graph, { ...withoutLegends, legends: [{ ...legends[0], uses: [{ path: 'missing.mjs', reason: 'Invalid' }] }] });
    const broken = await canvas(reader.url);
    assert.equal(broken.error.code, 'GRAPH_INVALID');
    assert.equal(broken.error.context.field, '$.legends[0].uses[0].path');
    assert.deepEqual(await readFile(project.layout), layoutBytes);
    await writeFile(project.graph, graphBytes);
    assert.deepEqual((await canvas(reader.url)).layout, saved.layout);

    await applyGraphUpdate(project, { legendRemove: [standardLegend.id] });
    const removed = await canvas(reader.url);
    assert.deepEqual(removed.confirmedRemovals, [legendId]);
    assert.deepEqual(removed.layout, first.layout);
    const denied = await put(reader.url, stale);
    assert.equal(denied.status, 409);
    assert.equal((await denied.json()).error.code, 'LAYOUT_GRAPH_CHANGED');
    assert.deepEqual(await readFile(project.layout), layoutBytes);
    const removedBytes = await readFile(project.graph);
    await writeFile(project.graph, graphBytes);
    const editedBack = await canvas(reader.url);
    assert.match(editedBack.nodeRemovals[legendId], /^[0-9a-f]{64}$/u);
    assert.deepEqual(editedBack.layout.groups, first.layout.groups);
    assert.deepEqual(editedBack.layout.positions[legendId], defaultPoint);
    assert.equal((await put(reader.url, stale)).status, 409);
    assert.deepEqual(await readFile(project.layout), layoutBytes);
    await writeFile(project.graph, removedBytes);
    await applyGraphUpdate(project, { legendUpserts: [standardLegend] });
    assert.deepEqual(await readFile(project.graph), graphBytes);
    assert.notEqual((await canvas(reader.url)).graphVersion, stale.graphVersion);
    assert.equal((await put(reader.url, stale)).status, 409);
    assert.deepEqual(await readFile(project.layout), layoutBytes);
    const renewed = await canvas(reader.url);
    assert.deepEqual(renewed.layout, { ...first.layout, positions: { ...first.layout.positions, [legendId]: defaultPoint } });
    assert.notDeepEqual(renewed.layout.positions[legendId], saved.layout.positions[legendId]);
    assert.equal((await put(reader.url, payload(renewed))).status, 200);
  } finally {
    await reader.server.close();
  }
});

test('库图例移除的图发布中途失败时还原凭据，正常 CLI 重试后清理落盘', async () => {
  const project = await fixture('publication');
  await applyGraphUpdate(project, { legendUpserts: [standardLegend], remove: [service] });
  const reader = await startReader(project.projectRoot, 0);
  try {
    const added = await canvas(reader.url);
    assert.equal((await put(reader.url, payload(added))).status, 200);
    const before = await canvas(reader.url);
    const snapshot = [await readFile(project.graph), await readFile(project.receipt), await readFile(project.layout)];
    let staged = false;
    const graphStore = new GraphFileStore({ open, link, unlink, async rename(from, to) {
      if (to === project.graph) {
        const records = await readJSON(project.receipt);
        staged = records.length === 2 && records[1].confirmed.includes(legendId);
        throw Object.assign(new Error('synthetic graph publication failure'), { code: 'EPERM' });
      }
      await rename(from, to);
    } });
    const graphs = new GraphService(new FixedSourceService(new GitSourceRepository()), graphStore);
    const update = { legendRemove: [standardLegend.id] };
    await assert.rejects(graphs.apply(fixed(project), { format: 'aftertaste-dependency-update/v1', ...update }),
      error => error.code === 'GRAPH_WRITE_FAILED' && error.context.published === 0 && error.context.reason === 'EPERM');
    assert.equal(staged, true);
    assert.deepEqual([await readFile(project.graph), await readFile(project.receipt), await readFile(project.layout)], snapshot);
    assert.deepEqual(await canvas(reader.url), before);
    await applyGraphUpdate(project, update);
    const current = await canvas(reader.url);
    assert.equal(current.layoutProblem, null);
    assert.equal(Object.hasOwn(current.layout.positions, legendId), false);
    const save = payload(current);
    assert.equal((await put(reader.url, save)).status, 200);
    const disk = await readJSON(project.layout);
    assert.equal(disk.revision, save.revision);
    assert.deepEqual(disk.layout, current.layout);
  } finally {
    await reader.server.close();
  }
});
