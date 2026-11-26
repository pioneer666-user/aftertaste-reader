import { startTestReader, readerFetch } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, writeFile, rename, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createCanvasProject, applyGraphUpdate, repository } from '../fixtures/dependency-canvas.mjs';
import { GraphFileStore } from '../../dist/adapters/graph-store.js';

const base = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D012');
await mkdir(base, { recursive: true });
const rules = 'src/rules.mjs', service = 'src/service.mjs', audit = 'support/audit.mjs', api = 'src/api.mjs';
const group = '10000000-0000-4000-8000-000000000000';
const publicationFailure = (projectRoot, published) => ({ code: 'GRAPH_WRITE_FAILED',
  context: { projectRoot, graphPath: 'docs/aftertaste/dependency-graph.json', published, reason: 'EPERM' } });
const get = async url => readerFetch(url + '/api/dependency-canvas').then(response => response.json());
const turn = (url, { revision, graphVersion, layout }, options = {}) => readerFetch(url + '/api/dependency-layout', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Layout': '1', ...options.headers },
  body: JSON.stringify({ expectedRevision: revision, revision: options.revision ?? randomUUID(), graphVersion,
    layout: { ...layout, positions: options.positions ?? Object.entries(layout.positions) } }),
});

test('真实项目的图和讲解读取，保存隔离、过期写入、校验与磁盘保护', async () => {
  const run = await mkdtemp(path.join(base, 'http-'));
  const fixture = await createCanvasProject(path.join(run, 'one'));
  const protectedPaths = [fixture.graph, path.join(fixture.data, 'current/src/service.mjs.md'), path.join(fixture.projectRoot, service),
    path.join(fixture.data, 'preferences.md')];
  const before = await Promise.all(protectedPaths.map(file => readFile(file)));
  const reader = await startTestReader(fixture.projectRoot, 0);
  let disk;
  try {
    const first = await get(reader.url);
    assert.equal(first.ok, true);
    assert.deepEqual(first.graph.edges.map(({ dependency, dependent }) => [dependency, dependent]), [[rules, service], [audit, service]]);
    assert.deepEqual(first.documents.map(document => document.sourcePath), [rules, service]);
    assert.equal(first.revision, null);
    assert.equal(first.layoutProblem, null);
    await assert.rejects(readFile(fixture.layout), { code: 'ENOENT' });
    for (const headers of [{ Origin: 'http://localhost:5555' }, { 'X-Aftertaste-Layout': '' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
      assert.equal((await turn(reader.url, first, { headers })).status, 403);
    }
    assert.equal((await readerFetch(reader.url + '/api/documents', { method: 'PUT' })).status, 405);
    assert.equal((await readerFetch(reader.url + '/api/dependency-layout?project=elsewhere', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Layout': '1' },
      body: JSON.stringify({ expectedRevision: first.revision, revision: randomUUID(), graphVersion: first.graphVersion, layout: first.layout }),
    })).status, 400);
    const invalid = structuredClone(first);
    invalid.layout.positions['extra.mjs'] = { x: 0, y: 0 };
    assert.equal((await turn(reader.url, invalid)).status, 400);
    const entries = Object.entries(first.layout.positions);
    for (const positions of [first.layout.positions, [...entries, entries[0]], [rules, ...entries.slice(1)],
      [[rules, { x: 0, y: 0, extra: true }], ...entries.slice(1)]]) {
      assert.equal((await turn(reader.url, first, { positions })).status, 400);
    }
    first.layout.positions[rules] = { x: -42.875, y: 82.625 };
    first.layout.groups = [{ id: group, name: '共同阅读', members: [rules, service] }];
    first.layout.viewport = { x: 99.25, y: -77.125, zoom: 0.625 };
    const competing = structuredClone(first);
    competing.layout.positions[rules].x = 454;
    const revisions = [randomUUID(), randomUUID()];
    const responses = await Promise.all([turn(reader.url, first, { revision: revisions[0] }),
      turn(reader.url, competing, { revision: revisions[1] })]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const winner = responses[0].ok ? first : competing;
    const winningRevision = revisions[responses[0].ok ? 0 : 1];
    disk = await readFile(fixture.layout);
    assert.deepEqual(JSON.parse(disk).layout, winner.layout);
    const replay = await turn(reader.url, winner, { revision: winningRevision });
    assert.deepEqual(await replay.json(), { ok: true, revision: winningRevision });
    const different = structuredClone(winner);
    different.layout.viewport.x += 1;
    assert.equal((await turn(reader.url, different, { revision: winningRevision })).status, 409);
    assert.deepEqual(await Promise.all(protectedPaths.map(file => readFile(file))), before);
    assert.equal((await turn(reader.url, first)).status, 409);
    assert.deepEqual(await readFile(fixture.layout), disk);
  } finally { await reader.server.close(); }

  const other = await createCanvasProject(path.join(run, 'two'));
  const independent = await startTestReader(other.projectRoot, 0);
  try {
    const layout = await get(independent.url);
    assert.equal(layout.revision, null);
    assert.deepEqual(layout.layout.groups, []);
    assert.equal((await turn(independent.url, layout)).status, 200);
    assert.deepEqual(await readFile(fixture.layout), disk);
  } finally { await independent.server.close(); }
});

test('真实图工具发布完整快照才协调，读写失败与布局坏文件保全原件', async () => {
  const run = await mkdtemp(path.join(base, 'updates-'));
  const fixture = await createCanvasProject(path.join(run, 'project'));
  const reader = await startTestReader(fixture.projectRoot, 0);
  try {
    const first = await get(reader.url);
    assert.equal(first.ok, true);
    first.layout.groups = [{ id: group, name: '审计', members: [audit] }];
    assert.equal((await turn(reader.url, first)).status, 200);
    const saved = await get(reader.url);
    const oldLayout = await readFile(fixture.layout);
    const graph = await readFile(fixture.graph);
    await rename(fixture.graph, fixture.graph + '.held');
    assert.equal((await get(reader.url)).error.code, 'GRAPH_NOT_FOUND');
    assert.equal((await turn(reader.url, saved)).status, 422);
    await writeFile(fixture.graph, '{"nodes":[]}');
    assert.equal((await get(reader.url)).error.code, 'GRAPH_INVALID');
    assert.deepEqual(await readFile(fixture.layout), oldLayout);
    await writeFile(fixture.graph, graph);

    const partial = JSON.parse(graph);
    partial.nodes = partial.nodes.filter(node => node.path !== audit);
    partial.edges = partial.edges.filter(edge => edge.dependency !== audit);
    await writeFile(fixture.graph, JSON.stringify(partial, null, 2) + '\n');
    const unconfirmed = await get(reader.url);
    assert.equal(unconfirmed.layoutProblem.code, 'LAYOUT_GRAPH_UNCONFIRMED');
    assert.equal((await turn(reader.url, unconfirmed)).status, 409);
    assert.deepEqual(await readFile(fixture.layout), oldLayout);
    await applyGraphUpdate(fixture, { remove: [audit] });
    assert.equal((await get(reader.url)).layoutProblem, null);
    const confirmedPartial = await readFile(fixture.graph);
    await writeFile(fixture.graph, graph);
    assert.deepEqual((await get(reader.url)).layout, saved.layout);
    await writeFile(fixture.graph, confirmedPartial);
    assert.equal((await get(reader.url)).layoutProblem.code, 'LAYOUT_GRAPH_UNCONFIRMED');
    await writeFile(fixture.graph, graph);

    await applyGraphUpdate(fixture, { reviews: [{ path: service, analysis: 'reviewed', dependencies: [
      { path: service, reason: 'self' }, { path: rules, reason: 'updated' }] },
    { path: rules, analysis: 'reviewed', dependencies: [{ path: service, reason: 'cycle' }] }] });
    const updated = await get(reader.url);
    assert.deepEqual(updated.layout, saved.layout);
    assert.equal(updated.reconciled, false);
    assert.ok(updated.graph.edges.some(edge => edge.dependency === service && edge.dependent === service));
    assert.equal((await turn(reader.url, saved)).status, 409);

    await applyGraphUpdate(fixture, { register: [api], remove: [audit] });
    const changed = await get(reader.url);
    assert.equal(changed.reconciled, true);
    assert.deepEqual(changed.layout.positions[rules], saved.layout.positions[rules]);
    assert.deepEqual(changed.layout.positions[service], saved.layout.positions[service]);
    assert.ok(changed.layout.positions[api].x > saved.layout.positions[audit].x + 212);
    assert.deepEqual(changed.layout.groups, []);
    assert.equal(Object.hasOwn(changed.layout.positions, audit), false);
    assert.deepEqual(await readFile(fixture.layout), oldLayout);

    const receipt = path.join(fixture.data, 'dependency-graph-removals.json');
    const proofs = JSON.parse(await readFile(receipt, 'utf8'));
    await writeFile(receipt, JSON.stringify(proofs.map(({ publication, removals }) => ({ publication, paths: Object.keys(removals) }))));
    assert.deepEqual((await get(reader.url)).confirmedRemovals, [audit]);

    const beforeFailure = await readFile(fixture.graph, 'utf8');
    const interrupted = JSON.parse(beforeFailure);
    interrupted.edges[0].reason = '图发布期间失败';
    const attempted = JSON.stringify(interrupted, null, 2) + '\n';
    const failingStore = new GraphFileStore({ open, link, unlink, rename: async (from, to) => {
      if (to === fixture.graph) throw Object.assign(new Error('graph replacement denied'), { code: 'EPERM' });
      await rename(from, to);
    } });
    const active = new Set(interrupted.nodes.map(node => node.path));
    await assert.rejects(failingStore.save(fixture.projectRoot, attempted, beforeFailure,
      { requested: [], previousActive: active, active }), publicationFailure(fixture.projectRoot, 0));
    assert.equal(await readFile(fixture.graph, 'utf8'), beforeFailure);
    assert.deepEqual((await get(reader.url)).confirmedRemovals, [audit]);
    const beforeRetry = interrupted.edges[0];
    await applyGraphUpdate(fixture, { reviews: [{ path: beforeRetry.dependent, analysis: 'reviewed',
      dependencies: interrupted.edges.filter(edge => edge.dependent === beforeRetry.dependent)
        .map(edge => ({ path: edge.dependency, reason: edge.reason })) }] });
    const retried = await get(reader.url);
    assert.deepEqual(retried.confirmedRemovals, [audit]);
    assert.equal(retried.layoutProblem, null);
    assert.deepEqual(retried.layout, changed.layout);
    assert.equal((await turn(reader.url, retried)).status, 200);

    const validLayout = await readFile(fixture.layout);
    await applyGraphUpdate(fixture, { remove: [api, service, rules] });
    const empty = await get(reader.url);
    assert.equal(empty.ok, true);
    assert.equal(empty.graph.nodes.length, 0);
    assert.equal(empty.reconciled, true);
    assert.deepEqual(empty.layout.positions, {});
    await writeFile(fixture.layout, '{ corrupt');
    const corrupt = await get(reader.url);
    assert.equal(corrupt.layoutProblem.code, 'LAYOUT_INVALID');
    assert.equal((await turn(reader.url, empty)).status, 422);
    assert.equal(await readFile(fixture.layout, 'utf8'), '{ corrupt');
    await writeFile(fixture.layout, validLayout);

    const alias = path.join(run, 'layout-hardlink.json');
    await link(fixture.layout, alias);
    try {
      assert.equal((await get(reader.url)).layoutProblem.code, 'LAYOUT_PATH_UNSAFE');
      assert.equal((await turn(reader.url, empty)).status, 403);
      assert.deepEqual(await readFile(alias), validLayout);
    } finally { await unlink(alias); }
    assert.equal((await turn(reader.url, empty)).status, 200);
    assert.deepEqual(JSON.parse(await readFile(fixture.layout)).layout.positions, {});
  } finally { await reader.server.close(); }
});

test('原坐标在边界时向可用外侧放置并真实落盘', async () => {
  const run = await mkdtemp(path.join(base, 'coordinate-boundary-'));
  const fixture = await createCanvasProject(path.join(run, 'project'));
  const reader = await startTestReader(fixture.projectRoot, 0);
  try {
    const first = await get(reader.url);
    first.layout.positions[rules].x = 1e9;
    assert.equal((await turn(reader.url, first)).status, 200);
    await applyGraphUpdate(fixture, { register: [api] });
    const expanded = await get(reader.url);
    assert.equal(expanded.layout.positions[rules].x, 1e9);
    assert.ok(expanded.layout.positions[api].x + 212 < first.layout.positions[service].x);
    assert.equal((await turn(reader.url, expanded)).status, 200);
    assert.deepEqual(JSON.parse(await readFile(fixture.layout)).layout, expanded.layout);
  } finally { await reader.server.close(); }
});

test('正式重加的身份跨直接编辑和撤销保留，旧页写入始终被拒绝', async () => {
  const run = await mkdtemp(path.join(base, 'identity-'));
  const fixture = await createCanvasProject(path.join(run, 'project'));
  await applyGraphUpdate(fixture, { reviews: [{ path: service, analysis: 'reviewed',
    dependencies: [{ path: rules, reason: '数量校验' }] }] });
  const original = await readFile(fixture.graph);
  let reader = await startTestReader(fixture.projectRoot, 0);
  try {
    const first = await get(reader.url);
    first.layout.positions[audit] = { x: 722, y: 55 };
    first.layout.groups = [{ id: group, name: 'Audit', members: [audit] }];
    assert.equal((await turn(reader.url, first)).status, 200);
    const stale = await get(reader.url);
    const disk = await readFile(fixture.layout);
    await applyGraphUpdate(fixture, { remove: [audit] });
    await applyGraphUpdate(fixture, { register: [audit] });
    assert.deepEqual(await readFile(fixture.graph), original);
    const verify = async () => {
      const next = await get(reader.url);
      assert.equal(next.layoutProblem, null);
      const point = next.layout.positions[audit];
      assert.notDeepEqual(point, first.layout.positions[audit]);
      assert.ok(point.x > Math.max(next.layout.positions[rules].x, next.layout.positions[service].x) + 212);
      assert.deepEqual(next.layout.groups, []);
      const rejected = await turn(reader.url, stale);
      assert.equal(rejected.status, 409);
      assert.equal((await rejected.json()).error.code, 'LAYOUT_GRAPH_CHANGED');
      assert.deepEqual(await readFile(fixture.layout), disk);
      return next;
    };
    const registered = await verify();
    const graph = JSON.parse(original);
    graph.edges[0].reason += '（修订）';
    const replacement = path.join(run, 'edited.json');
    await writeFile(replacement, JSON.stringify(graph));
    await rename(replacement, fixture.graph);
    assert.deepEqual((await verify()).nodeRemovals, registered.nodeRemovals);
    await writeFile(fixture.graph, original);
    assert.deepEqual((await verify()).nodeRemovals, registered.nodeRemovals);
    await reader.server.close();
    reader = await startTestReader(fixture.projectRoot, 0);
    assert.equal((await verify()).graphVersion, registered.graphVersion);
    assert.equal((await turn(reader.url, registered)).status, 200);
    graph.nodes = graph.nodes.filter(node => node.path !== audit);
    await writeFile(fixture.graph, JSON.stringify(graph));
    await applyGraphUpdate(fixture, { reviews: [{ path: service, analysis: 'reviewed',
      dependencies: [{ path: rules, reason: '核对另一条边' }] }] });
    const partial = await get(reader.url);
    assert.equal(partial.layoutProblem.code, 'LAYOUT_GRAPH_UNCONFIRMED');
    assert.equal((await turn(reader.url, partial)).status, 409);
    await writeFile(fixture.graph, original);
    assert.deepEqual((await get(reader.url)).nodeRemovals, registered.nodeRemovals);
  } finally { await reader.server.close(); }
});

test('旧标记凭据按快照迁移，发布失败和收尾中断保留可证明的身份', async () => {
  const run = await mkdtemp(path.join(base, 'proofs-'));
  const fixture = await createCanvasProject(path.join(run, 'project'));
  const receipt = path.join(fixture.data, 'dependency-graph-removals.json');
  await applyGraphUpdate(fixture, { remove: [audit] });
  await applyGraphUpdate(fixture, { register: [audit] });
  const [proof] = JSON.parse(await readFile(receipt, 'utf8'));
  await writeFile(receipt, JSON.stringify([{ publication: proof.publication, removals: proof.removals }]));
  const reader = await startTestReader(fixture.projectRoot, 0);
  try {
    const legacy = await get(reader.url);
    assert.deepEqual(legacy.nodeRemovals, proof.removals);
    assert.equal((await turn(reader.url, legacy)).status, 200);
    const disk = await readFile(fixture.layout);
    const original = await readFile(fixture.graph, 'utf8');
    await writeFile(fixture.graph, original + ' ');
    const uncertain = await get(reader.url);
    assert.equal(uncertain.layoutProblem.code, 'GRAPH_READ_FAILED');
    assert.equal((await turn(reader.url, legacy)).status, 422);
    assert.deepEqual(await readFile(fixture.layout), disk);
    await applyGraphUpdate(fixture, { remove: [audit] });
    const absent = await readFile(fixture.graph, 'utf8');
    const before = new Set(JSON.parse(absent).nodes.map(node => node.path));
    const update = { previousActive: before, active: new Set([...before, audit]), requested: [] };
    const failRename = (predicate) => new GraphFileStore({ open, link, unlink, rename: async (from, to) => {
      if (predicate(to)) throw Object.assign(new Error('synthetic publication failure'), { code: 'EPERM' });
      await rename(from, to);
    } });
    await assert.rejects(failRename(to => to === fixture.graph).save(fixture.projectRoot, original, absent, update),
      publicationFailure(fixture.projectRoot, 0));
    await writeFile(fixture.graph, original);
    assert.deepEqual((await get(reader.url)).nodeRemovals, {});
    assert.deepEqual((await get(reader.url)).layout, legacy.layout);
    await writeFile(fixture.graph, absent);
    let receipts = 0;
    await assert.rejects(failRename(to => to === receipt && ++receipts === 2).save(fixture.projectRoot, original, absent, update),
      publicationFailure(fixture.projectRoot, 1));
    const published = await get(reader.url);
    assert.equal(published.layoutProblem, null);
    assert.notEqual(published.nodeRemovals[audit], proof.removals[audit]);
    assert.equal(published.reconciled, true);
    assert.deepEqual(await readFile(fixture.layout), disk);
    await applyGraphUpdate(fixture, { register: [api] });
    await writeFile(fixture.graph, (await readFile(fixture.graph, 'utf8')) + ' ');
    assert.deepEqual((await get(reader.url)).nodeRemovals, published.nodeRemovals);
  } finally { await reader.server.close(); }
});

test('首次建图失败恢复原凭据，正式 CLI 重试后可保存布局', async () => {
  const run = await mkdtemp(path.join(base, 'init-retry-'));
  const fixture = await createCanvasProject(path.join(run, 'project'));
  await applyGraphUpdate(fixture, { remove: [audit] });
  const receipt = path.join(fixture.data, 'dependency-graph-removals.json');
  const originalReceipt = await readFile(receipt);
  const { format, source_commit } = JSON.parse(await readFile(fixture.graph));
  const empty = JSON.stringify({ format, source_commit, nodes: [], edges: [] }, null, 2) + '\n';
  await rename(fixture.graph, path.join(run, 'original-graph.json'));
  const failing = new GraphFileStore({ open, rename, unlink, link: async () => {
    throw Object.assign(new Error('first link denied'), { code: 'EPERM' });
  } });
  const attempt = () => failing.save(fixture.projectRoot, empty, undefined,
    { requested: [audit], previousActive: new Set(), active: new Set() });
  await assert.rejects(attempt(), publicationFailure(fixture.projectRoot, 0));
  assert.deepEqual(await readFile(receipt), originalReceipt);
  await rename(receipt, path.join(run, 'original-receipt.json'));
  await assert.rejects(attempt(), publicationFailure(fixture.projectRoot, 0));
  for (const file of [fixture.graph, receipt]) await assert.rejects(readFile(file), { code: 'ENOENT' });
  await applyGraphUpdate(fixture, { register: [audit] });
  const reader = await startTestReader(fixture.projectRoot, 0);
  try {
    const current = await get(reader.url);
    assert.equal(current.layoutProblem, null);
    assert.deepEqual(current.nodeRemovals, {});
    assert.deepEqual(Object.keys(current.layout.positions), [audit]);
    current.layout.positions[audit] = { x: 668, y: 155 };
    assert.equal((await turn(reader.url, current)).status, 200);
    assert.deepEqual(JSON.parse(await readFile(fixture.layout)).layout, current.layout);
  } finally { await reader.server.close(); }
});
