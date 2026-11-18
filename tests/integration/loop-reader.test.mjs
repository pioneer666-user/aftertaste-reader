import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { api, legendId, readJSON } from '../fixtures/dependency-legends.mjs';
import { orderId, orderInput } from '../fixtures/loop-authoring.mjs';
import { artifact, createLoopReaderProject, explanationFile, git, legendLoopId, loopLayout } from '../fixtures/loop-reader.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const root = path.join(repository, '.local/D016', 'integration');
await mkdir(root, { recursive: true });
const route = id => '/api/loops/' + id;
const requestBody = (view, x) => ({
  graphVersion: view.graphVersion, expectedRevision: view.revision, revision: randomUUID(),
  layout: { ...view.layout, positions: Object.entries(view.layout.positions).map(([id, point]) => [id, { ...point, x: point.x + x }]) },
});

test('real reader lists both artifacts and publishes independent layouts with revisions', async () => {
  const project = await createLoopReaderProject(path.join(await mkdtemp(path.join(root, 'reader-')), 'project'));
  const { server, url } = await startReader(project.projectRoot, 0);
  const get = async resource => (await fetch(url + resource)).json();
  const put = (id, body, header = true) => fetch(url + route(id) + '/layout', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...(header ? { 'X-Aftertaste-Layout': '1' } : {}) },
    body: JSON.stringify(body),
  });
  try {
    const loopDirectory = path.join(project.data, 'loops');
    await rename(loopDirectory, loopDirectory + '.off');
    try { assert.deepEqual(await get('/api/loops'), { ok: true, loops: [], problems: [] }); }
    finally { await rename(loopDirectory + '.off', loopDirectory); }
    const list = await get('/api/loops');
    assert.deepEqual(list.loops.map(item => item.id).sort(), [orderId, legendLoopId].sort());
    assert.deepEqual(list.problems, []);
    const originalFiles = [artifact(project, orderId), artifact(project, legendLoopId), project.graph, project.layout];
    const original = await Promise.all(originalFiles.map(file => readFile(file)));
    const order = await get(route(orderId));
    const legend = await get(route(legendLoopId));
    assert.deepEqual(order.result.loop.reading_order, orderInput.reading_order);
    assert.deepEqual(order.result.loop.edges, orderInput.edges);
    assert.equal(order.revision, null);
    assert.ok(legend.layout.positions[legendId]);
    assert.equal(legend.result.sources.find(source => source.node_id === 'audit').status, 'not-applicable');
    assert.equal((await get(route('not-published'))).error.code, 'LOOP_NOT_FOUND');
    assert.equal((await get(route('CON'))).error.code, 'INVALID_ARGUMENT');

    const first = requestBody(order, 42);
    assert.equal((await put(orderId, first, false)).status, 403);
    assert.equal((await put(legendLoopId, first)).status, 409);
    const other = requestBody(legend, 83);
    // Simulate separate tabs sending the same saved revision to the real service.
    const competing = requestBody(order, 60);
    const results = await Promise.all([put(orderId, first), put(legendLoopId, other), put(orderId, competing)]);
    assert.equal(results[1].status, 200);
    assert.deepEqual([results[0].status, results[2].status].sort(), [200, 409]);
    const winner = results[0].status === 200 ? first : competing;
    assert.equal((await put(orderId, winner)).status, 200);
    assert.equal((await readJSON(loopLayout(project, orderId))).revision, winner.revision);
    assert.equal((await readJSON(loopLayout(project, legendLoopId))).revision, other.revision);
    assert.deepEqual(await Promise.all(originalFiles.map(file => readFile(file))), original);

    const layoutFile = loopLayout(project, legendLoopId);
    const parked = layoutFile + '.old';
    await rename(layoutFile, parked);
    await link(project.layout, layoutFile);
    try {
      const blocked = await get(route(legendLoopId));
      assert.equal(blocked.layoutProblem.code, 'LAYOUT_PATH_UNSAFE');
      assert.equal((await put(legendLoopId, requestBody(blocked, 30))).status, 403);
      assert.deepEqual(await readFile(project.layout), original[3]);
    } finally {
      await unlink(layoutFile);
      await rename(parked, layoutFile);
    }

    const doc = explanationFile(project, api);
    await writeFile(doc, (await readFile(doc, 'utf8')).replace('入口提取上传文件名。', '当前讲解改了。'));
    const oid = git(project, 'rev-parse', project.commit + ':' + api).trim();
    const object = path.join(project.projectRoot, '.git/objects', oid.slice(0, 2), oid.slice(2));
    await rename(object, object + '.off');
    try {
      const degraded = await get(route(legendLoopId));
      assert.deepEqual(degraded.result.loop, legend.result.loop);
      assert.equal(degraded.result.sources.find(source => source.node_id === 'upload').status, 'unavailable');
      assert.equal((await put(legendLoopId, requestBody(degraded, 100))).status, 200);
    } finally { await rename(object + '.off', object); }
  } finally { await server.close(); }
});
