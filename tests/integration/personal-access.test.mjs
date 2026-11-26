import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, link, mkdir, mkdtemp, open, readdir, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { createBookmarkProject, rulesPath, sharedBlockId } from '../fixtures/bookmark-project.mjs';
import { readerFetch, startTestReader } from '../fixtures/reader-session.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const runRoot = process.env.AFTERTASTE_ACCESS_TEST_ROOT ?? path.join(repository, '.local/D057');
const windows = process.platform === 'win32';
const digest = raw => createHash('sha256').update(raw).digest('hex');

function windowsAcl(target, action) {
  const script = Buffer.from(String.raw`
    $ErrorActionPreference='Stop'
    $target=$env:D057_ACL_TEST_FILE
    $sections=[Security.AccessControl.AccessControlSections]'Access, Owner, Group'
    $isDirectory=[IO.Directory]::Exists($target)
    $acl=if ($isDirectory) { [IO.Directory]::GetAccessControl($target, $sections) } else { [IO.File]::GetAccessControl($target, $sections) }
    $me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    switch ($env:D057_ACL_TEST_ACTION) {
      'parent' { $acl.SetSecurityDescriptorSddlForm("D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;$me)(A;OICI;FR;;;WD)", 'Access') }
      'restricted-parent' { $acl.SetSecurityDescriptorSddlForm("D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;$me)", 'Access') }
      'private' { $acl.SetSecurityDescriptorSddlForm("D:P(A;;FA;;;SY)(A;;FA;;;$me)", 'Access') }
      'shared' { $acl.SetSecurityDescriptorSddlForm("D:P(A;;FA;;;SY)(A;;FA;;;$me)(A;;FR;;;BG)", 'Access') }
      'read' {}
      default { throw 'Unexpected test action' }
    }
    if ($env:D057_ACL_TEST_ACTION -ne 'read') {
      if ($isDirectory) { [IO.Directory]::SetAccessControl($target, $acl) }
      else { [IO.File]::SetAccessControl($target, $acl) }
      $acl=if ($isDirectory) { [IO.Directory]::GetAccessControl($target, $sections) } else { [IO.File]::GetAccessControl($target, $sections) }
    }
    [Console]::Write($acl.GetSecurityDescriptorSddlForm($sections))
  `, 'utf16le').toString('base64');
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', script],
    { encoding: 'utf8', windowsHide: true, env: { ...process.env, D057_ACL_TEST_FILE: target, D057_ACL_TEST_ACTION: action } });
}

async function permissions(file) {
  // NTFS recomputes the auto-inherited descriptor flag on creation. Preserve all ACEs and the protection flag.
  if (windows) return windowsAcl(file, 'read').replace(/D:(P?)AI(?=\()/u, 'D:$1');
  const item = await stat(file);
  return [item.mode & 0o777, item.uid, item.gid];
}

test('reader preserves private and explicitly shared access for notes, bookmarks and marks', async t => {
  const oldUmask = process.umask(0);
  t.after(() => process.umask(oldUmask));
  await mkdir(runRoot, { recursive: true });
  const run = await mkdtemp(path.join(runRoot, 'access-'));
  const fixture = await createBookmarkProject(path.join(run, 'project'));
  const directory = path.dirname(fixture.bookmarks);
  if (windows) windowsAcl(directory, 'parent');
  else await chmod(directory, 0o777);
  const parent = await permissions(directory);
  if (windows) assert.match(parent, /;;;WD\)/u);
  else assert.equal(parent[0], 0o777);
  const reader = await startTestReader(fixture.projectRoot, 0);
  t.after(() => reader.server.close());
  const noteId = randomUUID(), noteRevision = randomUUID(), newRevision = randomUUID(), bookmarkId = randomUUID();
  const locator = { documentPath: rulesPath, blockId: sharedBlockId };
  const records = [
    {
      name: 'notes', id: noteId, initial: { action: 'save', id: noteId, previousRevision: null, revision: noteRevision, body: '初始笔记', tags: [] },
      edit: { action: 'save', id: noteId, previousRevision: noteRevision, revision: newRevision, body: '修改后的笔记', tags: [] },
      field: 'body', private: true,
    },
    {
      name: 'bookmarks', id: bookmarkId, initial: { action: 'create', id: bookmarkId, ...locator, note: '初始书签' },
      edit: { action: 'edit', id: bookmarkId, previousNote: '初始书签', note: '修改后的书签' }, field: 'note', private: false,
    },
    {
      name: 'understanding-marks', initial: { ...locator, field: 'annotation', previous: digest(''), value: '初始批注' },
      edit: { ...locator, field: 'annotation', previous: digest('初始批注'), value: '修改后的批注' }, field: 'annotation', private: true,
    },
  ];
  for (const record of records) {
    const url = reader.url + '/api/' + record.name;
    const put = async body => readerFetch(url, { method: 'PUT', headers: {
      'content-type': 'application/json', ['x-aftertaste-' + record.name]: '1',
    }, body: JSON.stringify(body) });
    const file = path.join(directory, record.name + '.json');
    assert.equal((await fetch(url)).status, 403);
    const created = await put(record.initial);
    assert.equal(created.status, 200, JSON.stringify(await created.json()));
    const first = await permissions(file);
    if (windows) {
      assert.match(first, /D:P/u);
      assert.doesNotMatch(first, /;;;WD\)|;;;BG\)|;ID;/u);
      windowsAcl(file, record.private ? 'private' : 'shared');
    } else {
      assert.equal(first[0], 0o600);
      await chmod(file, record.private ? 0o600 : 0o640);
    }
    const before = await permissions(file);
    if (windows && !record.private) assert.match(before, /;;;BG\)/u);
    const updated = await put(record.edit);
    assert.equal(updated.status, 200, JSON.stringify(await updated.json()));
    assert.deepEqual(await permissions(file), before);
    const read = await readerFetch(url);
    const result = await read.json();
    assert.equal((result[record.name === 'understanding-marks' ? 'marks' : record.name])[0][record.field],
      record.edit[record.field] ?? record.edit.value);
    t.diagnostic(`${record.name}: new ${windows ? 'protected owner + SYSTEM DACL' : '0600'}, edit ${record.private ? 'private' : 'explicitly shared'} ACL/mode preserved`);
  }
  assert.deepEqual(await permissions(directory), parent);

  const build = path.resolve(repository, process.env.AFTERTASTE_BUILD ?? 'dist');
  const { PersonalFile } = await import(pathToFileURL(path.join(build, 'adapters/personal-file.js')));
  const problems = Object.fromEntries(['unsafe', 'conflict', 'read', 'write'].map(code =>
    [code, () => Object.assign(new Error(code), { nextStep: 'test' })]));
  const notes = new PersonalFile(fixture.projectRoot, 'notes', false, problems);
  const old = await notes.read();
  const notePath = path.join(directory, 'notes.json');
  const oldPermissions = await permissions(notePath);
  if (windows) {
    const { windowsPersonalAccess } = await import(pathToFileURL(path.join(build, 'adapters/personal-access.js')));
    const stage = path.join(directory, 'isolated-candidate.tmp');
    try {
      await windowsPersonalAccess(notePath, stage, true, { raw: 'synthetic candidate' });
      assert.equal(await readFile(stage, 'utf8'), 'synthetic candidate');
      assert.equal(await permissions(stage), oldPermissions);
      t.diagnostic('NTFS temporary payload has the protected ACL before publication');
    } finally { await unlink(stage); }
  }
  await assert.rejects(notes.save('candidate rejected on conflict', old + 'changed'), /conflict/u);
  assert.equal(await notes.read(), old);
  assert.deepEqual(await permissions(notePath), oldPermissions);
  assert.equal((await readdir(directory)).some(file => file.endsWith('.tmp')), false);
  t.diagnostic('conflict leaves file bytes and permissions intact and removes the candidate');
});

test('lesson staging and publication inherit the destination directory', async () => {
  await mkdir(runRoot, { recursive: true });
  const project = await mkdtemp(path.join(runRoot, 'lesson-access-'));
  execFileSync('git', ['-C', project, 'init', '-q'], { windowsHide: true });
  const gitDir = path.join(project, '.git');
  const relative = 'docs/aftertaste/current/lesson.js.md';
  const target = path.join(project, relative);
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });
  if (windows) {
    windowsAcl(gitDir, 'parent');
    windowsAcl(directory, 'restricted-parent');
    assert.match(await permissions(gitDir), /;;;WD\)/u);
  } else {
    await chmod(gitDir, 0o755);
    await chmod(directory, 0o2700);
  }
  const build = path.resolve(repository, process.env.AFTERTASTE_BUILD ?? 'dist');
  const { DocumentFileStore } = await import(pathToFileURL(path.join(build, 'adapters/document-store.js')));
  const { temporaryFilePath } = await import(pathToFileURL(path.join(build, 'core/project-write-paths.js')));
  let stagedPermissions;
  const store = new DocumentFileStore({ open, async link(temporary, final) {
    assert.equal(temporary, path.join(project, temporaryFilePath(relative)));
    assert.equal(path.dirname(temporary), directory);
    assert.equal(await readFile(temporary, 'utf8'), 'synthetic lesson');
    stagedPermissions = await permissions(temporary);
    if (windows) assert.doesNotMatch(stagedPermissions, /;;;WD\)/u);
    else assert.equal((await stat(directory)).mode & 0o2777, 0o2700);
    await link(temporary, final);
  } });
  await store.create(project, relative, 'synthetic lesson');
  assert.equal(await readFile(target, 'utf8'), 'synthetic lesson');
  assert.deepEqual(await permissions(target), stagedPermissions);
  assert.deepEqual(await readdir(directory), [path.basename(target)]);
});
