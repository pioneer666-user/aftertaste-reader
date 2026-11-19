import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, readdir, rename, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { startReader } from '../../dist/server/reader.js';
import { createBookmarkProject, rulesPath, servicePath, sharedBlockId } from '../fixtures/bookmark-project.mjs';

const base = fileURLToPath(new URL('../../.local/D019/', import.meta.url));
const route = '/api/bookmarks';

test('real reader API persists individual operations and protects project files', async t => {
  await mkdir(base, { recursive: true });
  const run = await mkdtemp(path.join(base, 'api-'));
  const project = await createBookmarkProject(path.join(run, 'project'));
  let service = await startReader(project.projectRoot, 0);
  t.after(async () => { await service.server.close(); });
  const request = async (endpoint = route, init) => {
    const response = await fetch(service.url + endpoint, init);
    return { status: response.status, ...await response.json() };
  };
  const put = (body, headers = {}, endpoint = route) => request(endpoint, { method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-aftertaste-bookmarks': '1', ...headers },
    body: JSON.stringify(body) });
  const record = (documentPath, note) => ({ id: randomUUID(), documentPath, blockId: sharedBlockId, note });
  const first = record(rulesPath, '  原文\n<字>  ');
  const second = record(rulesPath, '');
  const third = record(servicePath, '另一文件，同块 ID');
  const add = value => put({ action: 'create', ...value });
  const originalDoc = await readFile(project.rules);
  const worktree = path.join(project.projectRoot, 'src/rules.mjs');
  const originalSource = await readFile(worktree);
  const layout = path.join(path.dirname(project.bookmarks), 'dependency-layout.json');
  await writeFile(layout, 'layout sentinel');

  assert.deepEqual(await request(), { status: 200, ok: true, bookmarks: [] });
  assert.equal((await add({ ...first, documentPath: '../other.ts.md' })).status, 400);
  assert.equal((await add({ ...first, blockId: 'absent01' })).error.code, 'BOOKMARK_TARGET_UNAVAILABLE');
  assert.equal((await put({ action: 'create', ...first, projectRoot: run })).status, 400);
  assert.equal((await put({ action: 'create', ...first }, {}, route + '?project=outside')).status, 400);
  assert.equal((await put({ action: 'create', ...first }, { 'x-aftertaste-bookmarks': '' })).status, 403);
  assert.equal((await put({ action: 'create', ...first }, { origin: 'https://elsewhere.invalid' })).status, 403);
  assert.equal((await put({ action: 'create', ...first }, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await put({ action: 'create', ...first }, { 'content-type': 'text/plain' })).status, 400);
  assert.equal((await put({ action: 'create', ...first }, {}, '/api/document')).status, 405);
  assert.equal((await put({ action: 'create', ...first }, {}, '/api/dependency-layout')).status, 403);
  await assert.rejects(readFile(project.bookmarks), { code: 'ENOENT' });

  const results = await Promise.all([add(first), add(second), add(third)]);
  assert.deepEqual(results.map(r => r.status), [200, 200, 200]);
  assert.equal((await add(first)).bookmarks.length, 3);
  assert.equal((await add({ ...first, note: 'different' })).status, 409);
  const edit = (value, note) => put({ action: 'edit', id: value.id, previousNote: value.note, note });
  const remove = value => put({ action: 'remove', id: value.id, previousNote: value.note });
  const edits = await Promise.all([edit(first, 'edited'), remove(second)]);
  assert.deepEqual(edits.map(r => r.status), [200, 200]);
  assert.equal((await edit(first, 'edited')).status, 200);
  assert.equal((await edit(first, 'stale edit')).status, 409);
  assert.equal((await remove(first)).status, 409);
  assert.equal((await edit(second, 'gone')).status, 404);
  assert.equal((await remove(second)).status, 200);

  const saved = await readFile(project.bookmarks);
  await service.server.close();
  service = await startReader(project.projectRoot, 0);
  assert.deepEqual((await request()).bookmarks, JSON.parse(saved).bookmarks);
  assert.deepEqual(new Map((await request()).bookmarks.map(item => [item.id, item])),
    new Map([[first.id, { ...first, note: 'edited' }], [third.id, third]]));
  assert.deepEqual(await readFile(project.rules), originalDoc);
  assert.deepEqual(await readFile(worktree), originalSource);
  assert.equal(await readFile(layout, 'utf8'), 'layout sentinel');

  for (const corrupt of [Buffer.from('{bad'), Buffer.from([0xff, 0xfe])]) {
    await writeFile(project.bookmarks, corrupt);
    assert.equal((await request()).status, 422);
    assert.equal((await add(second)).status, 422);
    assert.deepEqual(await readFile(project.bookmarks), corrupt);
  }

  const outside = path.join(run, 'outside.json');
  await writeFile(outside, saved);
  await unlink(project.bookmarks);
  await link(outside, project.bookmarks);
  assert.equal((await request()).error.code, 'BOOKMARK_PATH_UNSAFE');
  assert.equal((await add(second)).status, 403);
  assert.deepEqual(await readFile(outside), saved);
  await unlink(project.bookmarks);

  const directory = path.dirname(project.bookmarks);
  const moved = path.join(run, 'moved-data');
  await rename(directory, moved);
  await writeFile(path.join(moved, 'bookmarks.json'), saved);
  await symlink(moved, directory, process.platform === 'win32' ? 'junction' : 'dir');
  const symbolic = await request();
  assert.equal(symbolic.status, 403);
  assert.equal(symbolic.error.code, 'BOOKMARK_PATH_UNSAFE');
  assert.equal((await add(second)).status, 403);
  assert.deepEqual(await readFile(path.join(moved, 'bookmarks.json')), saved);
  assert.equal((await readdir(moved)).some(name => name.startsWith('.aftertaste-bookmarks-')), false);
});
