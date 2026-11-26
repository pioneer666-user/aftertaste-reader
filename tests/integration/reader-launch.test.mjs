import assert from 'node:assert/strict';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { checkAnonymous } from '../fixtures/anonymous-reader.mjs';
import { build } from '../fixtures/dependency-canvas.mjs';
import { launchFixture } from '../fixtures/reader-launch.mjs';
import { createReaderProject } from '../fixtures/reader-project.mjs';
import { readerFetch, registerEntry } from '../fixtures/reader-session.mjs';

const fixture = await launchFixture('integration');
const a = (await createReaderProject(path.join(fixture.run, '项目 A'))).projectRoot;
const b = (await createReaderProject(path.join(fixture.run, '项目 B'))).projectRoot;
const document = 'docs/aftertaste/current/src/rules.mjs.md';
const block = '#aftertaste-block/' + encodeURIComponent(document) + '/x4y6az2y';
const step = '#aftertaste-loop/order-quantity/check';

async function listen(server, port = 0) {
  await new Promise((resolve, reject) => server.listen(port, '127.0.0.1', resolve).once('error', reject));
  return String(server.address().port);
}

async function authorization(entry) {
  const { username, password } = await (await fetch(entry, { headers: { accept: 'application/json' } })).json();
  return 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
}

test.after(async () => {
  await fixture.stop(a);
  await fixture.stop(b);
});

test('validates location and mode before creating a service, and reports a failed start without a link', async () => {
  for (const args of [['--target', '#aftertaste-block/%GG/rule0001'], ['--mode', 'silent'], ['--port', '0']]) {
    const { output, code } = await fixture.command('open-reader', a, args);
    assert.equal(code, 2);
    assert.equal(output.error.code, 'INVALID_ARGUMENT');
    assert.ok(!('url' in output));
  }
  const result = await fixture.command('open-reader', path.join(fixture.run, 'missing'));
  assert.equal(result.code, 1);
  assert.equal(result.output.error.code, 'PROJECT_UNAVAILABLE');
  assert.ok(!('url' in result.output));
  assert.equal(await fixture.stop(a), 'not-running');
});

test('keeps instance secrets outside the target Git repository', async () => {
  const home = path.join(a, 'host-profile');
  const project = path.join(a, 'subproject');
  await mkdir(home);
  await mkdir(project);
  const env = { ...fixture.environment, [process.platform === 'win32' ? 'USERPROFILE' : 'HOME']: home };
  const { output, code } = await fixture.command('open-reader', project, ['--mode', 'link'], env);
  if (output.ok) await fixture.command('stop-reader', project, [], env);
  assert.equal(code, 1);
  assert.equal(output.error.code, 'READER_INSTANCE_UNAVAILABLE');
  assert.equal(output.error.context.reason, 'STATE_INSIDE_PROJECT');
  await assert.rejects(lstat(path.join(home, '.aftertaste-reader')), { code: 'ENOENT' });
});

test('coalesces concurrent launchers, reuses the project at new locations and protects copies', async () => {
  const replies = await Promise.allSettled([fixture.link(a, ['--target', block]), fixture.link(a, ['--target', step])]);
  for (const reply of replies) assert.equal(reply.status, 'fulfilled', String(reply.reason));
  const [first, second] = replies.map(reply => reply.value);
  assert.deepEqual([first.reused, second.reused].sort(), [false, true]);
  const urlA = new URL(first.url);
  assert.equal(urlA.hash, block);
  assert.equal(new URL(second.url).hash, step);
  assert.ok(urlA.search === new URL(second.url).search && urlA.origin === new URL(second.url).origin);
  assert.ok(!first.location.includes('token='));

  await registerEntry(first.url);
  await checkAnonymous(urlA.origin, a, build);
  const entry = urlA.origin + '/api/reader-entry';
  const headers = { 'X-Aftertaste-Entry': '1' };
  assert.equal((await fetch(entry, { headers })).status, 403);
  assert.equal((await readerFetch(entry)).status, 404);
  assert.equal((await readerFetch(entry, { headers: { ...headers, Origin: 'http://127.0.0.1:1' } })).status, 403);
  const copy = await readerFetch(entry, { headers });
  assert.equal(copy.headers.get('cache-control'), 'no-store');
  assert.ok((await copy.json()).entryPath === urlA.pathname + urlA.search);
  assert.equal((await readerFetch(urlA.origin + '/api/documents')).status, 200);

  const other = await fixture.link(b, ['--port', urlA.port]);
  assert.notEqual(new URL(other.url).origin, urlA.origin);
  assert.equal((await fetch(new URL(urlA.pathname + urlA.search, other.location))).status, 403);
  assert.equal((await fetch(new URL('/api/documents', other.location), {
    headers: { Authorization: await authorization(first.url) },
  })).status, 403);
  assert.equal(await fixture.stop(a), 'stopped');
  const restarted = await fixture.link(a, ['--port', urlA.port]);
  assert.equal(new URL(restarted.url).origin, urlA.origin);
  assert.equal((await fetch(first.url)).status, 403);
  assert.equal((await readerFetch(urlA.origin + '/api/documents')).status, 403);
  assert.equal((await fetch(other.url)).status, 200);
  assert.equal(await fixture.stop(a), 'stopped');
  assert.equal(await fixture.stop(b), 'stopped');
});

test('ignores stale state and occupied ports without sending credentials to their owner', async () => {
  const requests = [];
  const unrelated = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, headers: req.headers });
    res.writeHead(200).end('unrelated');
  });
  const occupied = await listen(unrelated);
  try {
    const database = new DatabaseSync(path.join(fixture.profile, '.aftertaste-reader', 'instances.sqlite'));
    database.prepare('INSERT INTO instances_v1 VALUES (?, ?, ?)').run(a, Number(occupied), 'c'.repeat(64));
    database.close();
    const next = await fixture.link(a, ['--port', occupied]);
    assert.equal(next.reused, false);
    assert.notEqual(new URL(next.url).port, occupied);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'HEAD');
    assert.equal(requests[0].url, '/');
    assert.equal(typeof requests[0].headers['x-aftertaste-challenge'], 'string');
    for (const name of ['authorization', 'cookie', 'x-aftertaste-stop', 'referer']) assert.ok(!(name in requests[0].headers));
    assert.equal(await fixture.stop(a), 'stopped');
    assert.equal(await (await fetch('http://127.0.0.1:' + occupied)).text(), 'unrelated');
  } finally {
    await new Promise(resolve => unrelated.close(resolve));
  }
});

test('browser launcher failure leaves a ready service with a copyable link', async () => {
  const preload = path.join(fixture.run, 'failing-browser.cjs');
  await writeFile(preload, `
    const { basename } = require('node:path');
    const subprocess = require('node:child_process');
    const run = subprocess.execFile;
    subprocess.execFile = (file, args, options, callback) => {
      if (['powershell.exe', 'open', 'xdg-open'].includes(basename(file))) {
        return run(process.execPath, ['-e', 'process.exit(1)'], options, callback);
      }
      return run(file, args, options, callback);
    };
    require('node:module').syncBuiltinESMExports();
  `);
  const environment = { ...fixture.environment,
    NODE_OPTIONS: `--require "${preload.replaceAll('\\', '/')}"`,
  };
  const { output, code } = await fixture.command('open-reader', a, [], environment);
  assert.equal(code, 0, output.error?.code);
  assert.equal(output.browser, 'failed');
  assert.equal((await fetch(output.url)).status, 200);
  const reopened = await fixture.link(a);
  assert.ok(reopened.reused && reopened.url === output.url);
  assert.equal(await fixture.stop(a), 'stopped');
});
