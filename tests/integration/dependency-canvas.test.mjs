import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rename, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createCanvasProject, applyGraphUpdate, repository } from '../fixtures/dependency-canvas.mjs';
import { startReader } from '../../dist/server/reader.js';

const base = path.join(repository, '.local/D012');
await mkdir(base, { recursive: true });
const rules = 'src/rules.mjs', service = 'src/service.mjs', audit = 'support/audit.mjs', api = 'src/api.mjs';
const group = '10000000-0000-4000-8000-000000000000';
const get = async url => fetch(url + '/api/dependency-canvas').then(response => response.json());
const turn = (url, { revision, graphVersion, layout }, options = {}) => fetch(url + '/api/dependency-layout', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Layout': '1', ...options.headers },
  body: JSON.stringify({ expectedRevision: revision, revision: options.revision ?? randomUUID(), graphVersion, layout }),
});

test('真实项目的图和讲解读取，保存隔离、过期写入、校验与磁盘保护', async () => {
  const run = await mkdtemp(path.join(base, 'http-'));
  const fixture = await createCanvasProject(path.join(run, 'one'));
  const protectedPaths = [fixture.graph, path.join(fixture.data, 'current/src/service.mjs.md'), path.join(fixture.projectRoot, service),
    path.join(fixture.data, 'preferences.md')];
  const before = await Promise.all(protectedPaths.map(file => readFile(file)));
  const reader = await startReader(fixture.projectRoot, 0);
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
    assert.equal((await fetch(reader.url + '/api/documents', { method: 'PUT' })).status, 405);
    assert.equal((await fetch(reader.url + '/api/dependency-layout?project=elsewhere', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Layout': '1' },
      body: JSON.stringify({ expectedRevision: first.revision, revision: randomUUID(), graphVersion: first.graphVersion, layout: first.layout }),
    })).status, 400);
    const invalid = structuredClone(first);
    invalid.layout.positions['extra.mjs'] = { x: 0, y: 0 };
    assert.equal((await turn(reader.url, invalid)).status, 400);
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
  const independent = await startReader(other.projectRoot, 0);
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
  const reader = await startReader(fixture.projectRoot, 0);
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
    assert.equal((await turn(reader.url, changed)).status, 200);

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
  const reader = await startReader(fixture.projectRoot, 0);
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
