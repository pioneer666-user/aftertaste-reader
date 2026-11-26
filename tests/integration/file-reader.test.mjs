import { startTestReader, readerFetch } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rename, symlink, link } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createReaderProject } from '../fixtures/reader-project.mjs';
import { checkAnonymous } from '../fixtures/anonymous-reader.mjs';
import { build } from '../fixtures/dependency-canvas.mjs';

const runs = fileURLToPath(new URL(`../../.local/${process.env.AFTERTASTE_TEST_TASK ?? 'D011'}/`, import.meta.url));
await mkdir(runs, { recursive: true });
const root = await mkdtemp(path.join(runs, 'integration-'));
const fixture = await createReaderProject(path.join(root, 'project'));
const doc = 'docs/aftertaste/current/src/rules.mjs.md';
const fullDoc = path.join(fixture.projectRoot, doc);
const original = await readFile(fullDoc, 'utf8');
let app;
let url;
test.before(async () => {
  app = await startTestReader(fixture.projectRoot, 0);
  url = app.url;
});
test.after(async () => { await app.server.close(); });
const get = (route, options) => readerFetch(`${url}${route}`, options);

test('anonymous requests to built assets and project routes receive only the terminal hint', async () => {
  await checkAnonymous(url, fixture.projectRoot, build);
});

test('a second instance rejects both credentials issued by the first', async () => {
  const other = await startTestReader(fixture.projectRoot, 0);
  try {
    const access = await fetch(app.entryUrl, { headers: { accept: 'application/json' } });
    const { username, password } = await access.json();
    const authorization = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
    const entry = new URL(app.entryUrl);
    const attempts = [
      await fetch(other.url + entry.pathname + entry.search),
      await fetch(other.url + '/api/documents', { headers: { authorization } }),
    ];
    for (const response of attempts) {
      assert.equal(response.status, 403);
      assert.ok(await response.text() === '请打开本次阅读的私密入口。');
    }
  } finally { await other.server.close(); }
});

test('built page, documents, same-name extensions and fixed source are readable', async () => {
  const page = await get('/');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /assets\/.*\.js/);
  const nonce = html.match(/name="reader-editor-style" nonce="([^"]+)"/u)?.[1];
  assert.ok(nonce);
  assert.ok(page.headers.get('content-security-policy').includes(`style-src 'self' 'nonce-${nonce}'`));
  assert.ok(!(await (await get('/')).text()).includes(nonce));
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  await writeFile(path.join(fixture.projectRoot, 'docs/aftertaste/current/src/rules.ts.md'), original);
  await mkdir(path.join(fixture.projectRoot, 'docs/aftertaste/current/lib'));
  await writeFile(path.join(fixture.projectRoot, 'docs/aftertaste/current/lib/rules.mjs.md'), original);
  await writeFile(path.join(fixture.projectRoot, 'docs/aftertaste/current/src/合成 空格.ts.md'), original);
  const list = await (await get('/api/documents')).json();
  assert.deepEqual(list.documents.map(d => d.sourcePath), ['lib/rules.mjs', 'src/rules.mjs', 'src/rules.ts', 'src/service.mjs', 'src/合成 空格.ts']);
  assert.equal((await get(`/api/document?path=${encodeURIComponent('docs/aftertaste/current/src/合成 空格.ts.md')}`)).status, 200);
  const result = (await (await get(`/api/document?path=${encodeURIComponent(doc)}`)).json()).result;
  assert.equal(result.commit, fixture.commit);
  assert.equal(result.mechanicallyValid, true);
  assert.match(result.sourceLines[0], /function parseQuantity/);
  assert.doesNotMatch(result.sourceLines.join('\n'), /WORKTREE_ONLY/);
  execFileSync('git', ['-C', fixture.projectRoot, '-c', 'user.name=Fixture', '-c', 'user.email=f@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'head advanced'], { windowsHide: true });
  const again = (await (await get(`/api/document?path=${encodeURIComponent(doc)}`)).json()).result;
  assert.equal(again.commit, fixture.commit);
  assert.deepEqual(again.sourceLines, result.sourceLines);
});

test('new disk content, range errors and missing Git retain readable Markdown', async () => {
  await writeFile(fullDoc, original.replace('lines=1-7', 'lines=2-7') + '\nUPDATED\n');
  let result = (await (await get(`/api/document?path=${encodeURIComponent(doc)}`)).json()).result;
  assert.equal(result.renderMode, 'markdown');
  assert.match(result.raw, /UPDATED/);
  assert.ok(result.diagnostics.some(d => d.code === 'SOURCE_GAP'));
  await writeFile(fullDoc, original);
  await rename(path.join(fixture.projectRoot, '.git'), path.join(fixture.projectRoot, 'git-unavailable'));
  try {
    assert.equal((await get('/api/documents')).status, 200);
    result = (await (await get(`/api/document?path=${encodeURIComponent(doc)}`)).json()).result;
    assert.equal(result.sourceCheck, 'unavailable');
    assert.equal(result.raw, original);
    assert.equal(result.sourceLines, undefined);
    assert.equal(result.sourceError.code, 'OBJECT_UNAVAILABLE');
  } finally { await rename(path.join(fixture.projectRoot, 'git-unavailable'), path.join(fixture.projectRoot, '.git')); }
});

test('path, encoded aliases, arbitrary resources and source override are denied', async () => {
  const bad = ['../secret', '/etc/passwd', 'C:/x', 'docs/aftertaste/current/../x.md',
    'docs/aftertaste/current/x\\..\\x.md', 'docs/aftertaste/current/a.ts:secret.md',
    'docs/aftertaste/current/%2e%2e/x.md', 'docs/aftertaste/current/NUL.md',
    'docs/aftertaste/current/src./a.md', 'docs/aftertaste/current/src /a.md'];
  for (const input of bad) {
    const response = await get(`/api/document?path=${encodeURIComponent(input)}`);
    assert.ok(response.status >= 400, input);
  }
  for (const route of ['/api/document?path=x&project=C:/', '/api/document?path=x&commit=a',
    '/api/document?path=x&path=y', '/src/cli/main.ts', '/.git/config', '/api/read?path=C:/x']) {
    assert.ok((await get(route)).status >= 400, route);
  }
  assert.equal((await get('/api/documents', { method: 'POST' })).status, 405);
});

test('Host, Origin and Fetch Metadata block foreign sites', async () => {
  // fetch controls Host itself. Use the actual HTTP transport with a valid launch credential.
  const hostStatus = await new Promise((resolve, reject) => {
    http.get(app.entryUrl, { headers: { host: 'evil.invalid' } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(hostStatus, 403);
  for (const headers of [{ Origin: 'https://evil.invalid' },
    { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' }]) {
    const result = await get('/api/documents', { headers });
    assert.equal(result.status, 403);
  }
  assert.equal((await get('/api/documents', { headers: { origin: url, 'sec-fetch-site': 'same-origin' } })).status, 200);
});

test('links, junction and hardlink documents do not expose disk resources', async () => {
  const outside = path.join(root, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'secret.md'), 'SECRET');
  const mirror = path.join(fixture.projectRoot, 'docs/aftertaste/current');
  await symlink(outside, path.join(mirror, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await link(path.join(outside, 'secret.md'), path.join(mirror, 'hard.md'));
  const list = await (await get('/api/documents')).json();
  assert.ok(list.problems.length >= 2);
  for (const relative of ['linked/secret.md', 'hard.md']) {
    const res = await get(`/api/document?path=${encodeURIComponent(`docs/aftertaste/current/${relative}`)}`);
    assert.ok(res.status >= 400);
    assert.doesNotMatch(await res.text(), /SECRET/);
  }
});

test('unreadable UTF-8 is an error and successful/failed requests leave documents unchanged', async () => {
  await writeFile(fullDoc, Buffer.from([0xff, 0xfe, 0x80]));
  const before = await readFile(fullDoc);
  const response = await get(`/api/document?path=${encodeURIComponent(doc)}`);
  assert.equal(response.status, 422);
  const error = (await response.json()).error;
  assert.equal(error.code, 'DOCUMENT_READ_FAILED');
  assert.equal(error.context.sourcePath, 'src/rules.mjs');
  assert.deepEqual(await readFile(fullDoc), before);
  await writeFile(fullDoc, original);
  await get(`/api/document?path=${encodeURIComponent(doc)}`);
  assert.equal(await readFile(fullDoc, 'utf8'), original);
});

test('empty project and startup failures are distinct', async () => {
  const empty = path.join(root, 'empty');
  await mkdir(empty);
  const reader = await startTestReader(empty, 0);
  const restartPort = Number(new URL(reader.url).port);
  try {
    const list = await (await readerFetch(`${reader.url}/api/documents`)).json();
    assert.deepEqual(list.documents, []);
    assert.deepEqual(list.problems, []);
    await assert.rejects(() => startTestReader(empty, Number(new URL(reader.url).port)), e => e.code === 'PORT_IN_USE');
  } finally { await reader.server.close(); }
  const restarted = await startTestReader(empty, restartPort);
  assert.equal((await readerFetch(`${restarted.url}/`)).status, 200);
  await restarted.server.close();
  await assert.rejects(() => startTestReader(path.join(root, 'missing'), 0), e => e.code === 'PROJECT_UNAVAILABLE');
});
