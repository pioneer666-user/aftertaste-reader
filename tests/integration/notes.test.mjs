import { startTestReader, readerFetch } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, rename, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../.local/D020/', import.meta.url));

test('real HTTP restricts and atomically persists individual notes, including a project without documents', async t => {
  await mkdir(root, { recursive: true });
  const run = await mkdtemp(path.join(root, 'api-'));
  const project = path.join(run, 'project');
  await mkdir(project);
  let service = await startTestReader(project, 0);
  t.after(async () => service.server.close());
  const call = async (url = '/api/notes', init) => {
    const response = await readerFetch(service.url + url, init);
    return { status: response.status, ...(response.headers.get('content-type')?.includes('application/json') ? await response.json() : {}) };
  };
  const put = (action, headers = {}, url) => call(url, { method: 'PUT', headers: {
    'content-type': 'application/json', 'x-aftertaste-notes': '1', ...headers,
  }, body: JSON.stringify(action) });
  const create = (body, tags = []) => ({ action: 'save', id: randomUUID(), previousRevision: null, revision: randomUUID(), body, tags });
  const edit = (record, body) => ({ action: 'save', ...record, previousRevision: record.revision, revision: randomUUID(), body });
  const remove = note => ({ action: 'remove', id: note.id, previousRevision: note.revision });
  const first = create('  原文 📝\n', [' 甲 ', '乙,丙']);
  const second = create('问题');

  assert.deepEqual(await call(), { status: 200, ok: true, notes: [] });
  assert.equal((await put(first, { 'x-aftertaste-notes': '' })).status, 403);
  assert.equal((await put(first, { origin: 'https://elsewhere.invalid' })).status, 403);
  assert.equal((await put(first, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await put(first, { 'content-type': 'text/plain' })).status, 400);
  assert.equal((await put(first, {}, '/api/notes?project=../other')).status, 400);
  assert.equal((await put({ ...first, project: '../other' })).status, 400);
  assert.equal((await call('/api/notes?project=../other')).status, 400);

  assert.deepEqual((await Promise.all([put(first), put(second)])).map(result => result.status), [200, 200]);
  assert.equal((await put(first)).status, 200);
  assert.equal((await put({ ...first, body: 'different content, same revision' })).status, 409);
  const newer = edit(first, '更新');
  assert.equal((await put(newer)).status, 200);
  assert.equal((await put(newer)).status, 200);
  assert.equal((await put(edit(first, '陈旧修订'))).status, 409);
  assert.equal((await put(remove(first))).status, 409);
  assert.equal((await put(remove(second))).status, 200);
  assert.equal((await put(remove(second))).status, 200);
  assert.equal((await put(edit(second, '已删除'))).status, 409);

  const directory = path.join(project, 'docs/aftertaste');
  const file = path.join(directory, 'notes.json');
  const saved = await readFile(file);
  await service.server.close();
  service = await startTestReader(project, 0);
  assert.deepEqual((await call()).notes, [{ id: first.id, revision: newer.revision, body: newer.body, tags: first.tags }]);

  for (const invalid of [Buffer.from('{bad'), Buffer.from([0xff])]) {
    await writeFile(file, invalid);
    assert.equal((await call()).status, 422);
    assert.equal((await put(create('拒绝覆盖'))).status, 422);
    assert.deepEqual(await readFile(file), invalid);
  }

  const outside = path.join(run, 'outside.json');
  await writeFile(outside, saved);
  await unlink(file);
  await link(outside, file);
  assert.equal((await call()).error.code, 'NOTE_PATH_UNSAFE');
  assert.equal((await put(create('拒绝硬链接'))).status, 403);
  assert.deepEqual(await readFile(outside), saved);
  const moved = path.join(run, 'moved');
  await rename(directory, moved);
  await symlink(moved, directory, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await call()).error.code, 'NOTE_PATH_UNSAFE');
  assert.equal((await put(create('拒绝链接目录'))).status, 403);
  assert.deepEqual(await readFile(outside), saved);
});
