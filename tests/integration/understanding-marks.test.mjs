import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, rename, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { startReader } from '../../dist/server/reader.js';
import { createBookmarkProject, rulesPath, servicePath, sharedBlockId } from '../fixtures/bookmark-project.mjs';

const root = fileURLToPath(new URL('../../.local/D021/', import.meta.url));
const route = '/api/understanding-marks';
const emptyRevision = createHash('sha256').digest('hex');

test('real HTTP merges independent edits, rejects stale writes and preserves unavailable records', async t => {
  await mkdir(root, { recursive: true });
  const run = await mkdtemp(path.join(root, 'api-'));
  const project = await createBookmarkProject(path.join(run, 'project'));
  const directory = path.dirname(project.bookmarks);
  const file = path.join(directory, 'understanding-marks.json');
  const notes = path.join(directory, 'notes.json');
  await writeFile(project.bookmarks, '{"version":1,"bookmarks":[]}\n');
  await writeFile(notes, '{"version":1,"notes":[]}\n');
  let reader = await startReader(project.projectRoot, 0);
  t.after(() => reader.server.close());

  async function request(endpoint = route, init) {
    const res = await fetch(reader.url + endpoint, init);
    return { status: res.status, ...await res.json() };
  }
  const target = { documentPath: rulesPath, blockId: sharedBlockId };
  const status = { ...target, field: 'status', previous: 'unmarked', value: 'not-understood' };
  const annotation = { ...target, field: 'annotation', previous: emptyRevision, value: '  为什么？\r\n🌱  ' };
  const put = (body, headers, endpoint = route) => request(endpoint, { method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-aftertaste-understanding-marks': '1', ...headers },
    body: JSON.stringify(body) });

  assert.deepEqual(await request(), { status: 200, ok: true, marks: [] });
  assert.equal((await put(status, { 'x-aftertaste-understanding-marks': '' })).status, 403);
  assert.equal((await put(status, { origin: 'https://example.org' })).status, 403);
  assert.equal((await put(status, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await put(status, { 'content-type': 'text/plain' })).status, 400);
  assert.equal((await put(status, {}, route + '?project=outside')).status, 400);
  assert.equal((await put({ ...status, documentPath: '../outside.js.md' })).status, 400);
  assert.equal((await put({ ...status, blockId: 'absent01' })).error.code, 'MARK_TARGET_UNAVAILABLE');
  await assert.rejects(readFile(file), { code: 'ENOENT' });

  const together = await Promise.all([put(annotation), put(status), put({ ...status, documentPath: servicePath })]);
  assert.deepEqual(together.map(result => result.status), [200, 200, 200]);
  const first = { ...target, status: status.value, annotation: annotation.value };
  const second = { ...first, documentPath: servicePath, annotation: '' };
  const byPath = marks => new Map(marks.map(({ annotationRevision, ...mark }) => [mark.documentPath, mark]));
  const initial = (await request()).marks;
  const revision = initial.find(mark => mark.documentPath === rulesPath).annotationRevision;
  assert.equal(revision, createHash('sha256').update(annotation.value).digest('hex'));
  assert.equal(initial.find(mark => mark.documentPath === servicePath).annotationRevision, emptyRevision);
  assert.deepEqual(byPath(initial), byPath([first, second]));
  assert.equal((await put(annotation)).status, 200);
  assert.equal((await put({ ...annotation, value: '陈旧草稿' })).status, 409);
  assert.equal((await put({ ...status, value: 'understood' })).status, 409);
  const understood = { ...status, previous: status.value, value: 'understood' };
  assert.equal((await put(understood)).status, 200);

  await reader.server.close();
  reader = await startReader(project.projectRoot, 0);
  const saved = await readFile(file);
  const originalDoc = await readFile(project.rules);
  await writeFile(project.rules, originalDoc.toString().replace(sharedBlockId, 'changed1'));
  assert.deepEqual(byPath((await request()).marks), byPath([{ ...first, status: 'understood' }, second]));
  assert.equal((await put({ ...understood, previous: 'understood', value: 'unmarked' })).error.code, 'MARK_TARGET_UNAVAILABLE');
  assert.deepEqual(await readFile(file), saved);
  await writeFile(project.rules, originalDoc);
  assert.equal((await put({ ...understood, previous: 'understood', value: 'unmarked' })).status, 200);
  assert.deepEqual(byPath((await request()).marks), byPath([{ ...first, status: 'unmarked' }, second]));
  assert.deepEqual(byPath((await put({ ...annotation, previous: revision, value: '' })).marks), byPath([second]));
  assert.equal(await readFile(project.bookmarks, 'utf8'), '{"version":1,"bookmarks":[]}\n');
  assert.equal(await readFile(notes, 'utf8'), '{"version":1,"notes":[]}\n');

  const longText = '例'.repeat(180_000);
  const created = await put({ ...annotation, value: longText });
  assert.equal(created.status, 200);
  const longRevision = created.marks.find(mark => mark.documentPath === rulesPath).annotationRevision;
  const extended = await put({ ...annotation, previous: longRevision, value: longText + '。' });
  assert.equal(extended.status, 200);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).marks.find(mark => mark.documentPath === rulesPath).annotation, longText + '。');
  assert.equal((await put({ ...annotation, previous: longRevision, value: '过期的批注' })).status, 409);

  for (const corrupt of [Buffer.from('{bad'), Buffer.from([0xff, 0xfe]),
    Buffer.from(JSON.stringify({ version: 1, marks: [{ ...first, documentPath: '../outside.js.md' }] }))]) {
    await writeFile(file, corrupt);
    assert.equal((await request()).status, 422);
    assert.equal((await put(status)).status, 422);
    assert.deepEqual(await readFile(file), corrupt);
  }
  const outside = path.join(run, 'outside.json');
  await writeFile(outside, saved);
  await unlink(file);
  await link(outside, file);
  assert.equal((await request()).error.code, 'MARK_PATH_UNSAFE');
  assert.equal((await put(status)).status, 403);
  assert.deepEqual(await readFile(outside), saved);
  await unlink(file);
  const moved = path.join(run, 'moved-data');
  await rename(directory, moved);
  await writeFile(path.join(moved, 'understanding-marks.json'), saved);
  await symlink(moved, directory, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await request()).error.code, 'MARK_PATH_UNSAFE');
  assert.equal((await put(status)).status, 403);
  assert.deepEqual(await readFile(path.join(moved, 'understanding-marks.json')), saved);
});
