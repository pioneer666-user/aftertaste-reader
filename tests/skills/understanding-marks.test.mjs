import { startTestReader, readerFetch } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createBookmarkProject, rulesPath, servicePath, sharedBlockId } from '../fixtures/bookmark-project.mjs';

test('feedback guide reads current self-assessment separately from literal annotation', async t => {
  const guide = await readFile(new URL('../../skills/aftertaste-reader/references/feedback.md', import.meta.url), 'utf8');
  const relative = guide.match(/`(docs\/aftertaste\/understanding-marks\.json)`/u)?.[1];
  assert.ok(relative, 'guide points to the project asset');
  for (const field of ['marks[]', 'documentPath', 'blockId', 'status', 'annotation', 'understood', 'unmarked', 'not-understood']) {
    assert.ok(guide.includes('`' + field + '`'), `guide identifies ${field}`);
  }
  const root = fileURLToPath(new URL('../../.local/D021/', import.meta.url));
  await mkdir(root, { recursive: true });
  const run = await mkdtemp(path.join(root, 'skill-'));
  const fixture = await createBookmarkProject(path.join(run, 'project'));
  const reader = await startTestReader(fixture.projectRoot, 0);
  t.after(() => reader.server.close());

  async function save(documentPath, field, previous, value) {
    const res = await readerFetch(reader.url + '/api/understanding-marks', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-aftertaste-understanding-marks': '1' },
      body: JSON.stringify({ documentPath, blockId: sharedBlockId, field, previous, value }),
    });
    assert.equal(res.status, 200);
  }

  const question = '为什么要先校验数量？';
  const explanation = '  规则先约束，再创建订单。\n原文保留。  ';
  await save(rulesPath, 'status', 'unmarked', 'not-understood');
  const emptyRevision = createHash('sha256').digest('hex');
  await save(rulesPath, 'annotation', emptyRevision, question);
  await save(rulesPath, 'status', 'not-understood', 'understood');
  await save(servicePath, 'annotation', emptyRevision, explanation);
  const fullPath = path.join(fixture.projectRoot, relative);
  const before = await readFile(fullPath);
  const data = JSON.parse(before);
  assert.equal(data.version, 1);
  const find = documentPath => data.marks.find(mark => mark.documentPath === documentPath && mark.blockId === sharedBlockId);
  assert.deepEqual([find(rulesPath).status, find(rulesPath).annotation], ['understood', question]);
  assert.deepEqual([find(servicePath).status, find(servicePath).annotation], ['unmarked', explanation]);
  assert.deepEqual(await readFile(fullPath), before);
});
