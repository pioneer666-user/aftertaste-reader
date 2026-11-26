import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, cli, repository } from '../fixtures/dependency-canvas.mjs';
import { createLoopReaderProject, git } from '../fixtures/loop-reader.mjs';
import { checkAnonymous } from '../fixtures/anonymous-reader.mjs';
import { newQuickNote } from './note-controls.mjs';

const parent = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D056');
await mkdir(parent, { recursive: true });
const run = await mkdtemp(path.join(parent, 'sessions-'));
const a = await createLoopReaderProject(path.join(run, 'A'));
const b = path.join(run, 'B');
await cp(a.projectRoot, b, { recursive: true });
for (const [project, name] of [[a.projectRoot, 'A'], [b, 'B']]) {
  const data = path.join(project, 'docs/aftertaste');
  const doc = path.join(data, 'current/src/rules.mjs.md');
  await writeFile(doc, (await readFile(doc, 'utf8')).replace('## 数量规则', '## ' + name + ' 的数量规则'));
  await writeFile(path.join(data, 'notes.json'), JSON.stringify({ version: 1, notes: [{
    id: crypto.randomUUID(), revision: crypto.randomUUID(), body: name + ' 的私有笔记', tags: [],
  }] }));
}
const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));

let processA;
async function startA() {
  processA = spawn(process.execPath, [cli, 'serve', '--project', a.projectRoot, '--port', String(port)],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = createInterface({ input: processA.stdout });
  try {
    for await (const line of lines) {
      const ready = JSON.parse(line);
      if (ready.status === 'ready') return ready.url;
    }
    throw new Error('阅读服务未就绪');
  } finally { lines.close(); }
}
async function stopA() {
  if (!processA || processA.exitCode !== null || processA.signalCode !== null) return;
  const stopped = once(processA, 'exit');
  processA.kill();
  await stopped;
}

async function enter(page, entry) {
  // A Playwright navigation error may contain its URL. Only report the outcome.
  try { await page.goto(entry); } catch { throw new Error('导航至私密入口失败'); }
  await page.locator('meta[name="reader-editor-style"]').waitFor({ state: 'attached' });
  assert.ok(page.url() === new URL(entry).origin + '/');
}
async function notes(page) {
  return page.evaluate(async () => (await (await fetch('/api/notes')).json()).notes.map(note => note.body));
}
async function save(page, body) {
  await newQuickNote(page);
  const ack = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith('/api/notes'));
  await page.locator('#quick-note').getByRole('textbox', { name: '笔记正文' }).fill(body);
  assert.equal((await ack).status(), 200);
  assert.ok((await notes(page)).includes(body));
}
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
let serviceB, browser;
try {
  let entry = await startA();
  const origin = new URL(entry).origin;
  const assets = await checkAnonymous(origin, a.projectRoot, build);
  serviceB = await startReader(b, 0);
  const rules = path.join(a.data, 'current/src/rules.mjs.md');
  const explanation = await readFile(rules, 'utf8');
  await writeFile(rules, explanation.replace('<!-- aftertaste:end -->', '[打开项目 B](' + serviceB.url + '/)\n<!-- aftertaste:end -->'));
  await writeFile(path.join(a.data, 'current/src/missing.mjs.md'), explanation);
  let checkingB = false, visits = 0, sentCredential = false;
  serviceB.server.server.prependListener('request', req => {
    if (!checkingB) return;
    visits++;
    sentCredential ||= Boolean(req.headers.authorization || req.headers.cookie || req.headers.referer);
  });
  const report = { build, run, assets, browsers: [] };
  const deep = origin + '/#aftertaste-loop/order-quantity/check';
  for (const name of ['msedge', 'chrome', 'firefox']) {
    browser = name === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: name });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await enter(page, entry);
    await page.reload();
    assert.ok((await notes(page)).includes('A 的私有笔记'));
    const reopened = await context.newPage();
    await reopened.goto(deep);
    await reopened.locator('[data-reading-step="check"]').waitFor();
    await reopened.locator('.loop-source-trigger:visible').click();
    const source = reopened.locator('.loop-source-panel:visible');
    const pinned = git(a, 'show', a.commit + ':src/rules.mjs').split('\n')[0];
    await source.getByText(pinned, { exact: false }).first().waitFor();
    assert.ok(!(await source.innerText()).includes('WORKTREE_ONLY'));
    await save(page, name + ' 阅读 A');
    const fresh = await browser.newPage();
    const denied = await fresh.goto(deep);
    assert.equal(denied.status(), 403);
    assert.equal(await fresh.locator('body').innerText(), '请打开本次阅读的私密入口。');
    await fresh.close();

    const files = await context.newPage();
    await files.goto(origin);
    await files.locator('#reader-navigation button[title="src/missing.mjs"]').click();
    const repair = await files.getByRole('textbox', { name: '可选择复制的修复信息' }).inputValue();
    const { password } = await (await fetch(entry, { headers: { accept: 'application/json' } })).json();
    assert.ok(repair.includes('missing.mjs') && !repair.includes(password) && !repair.includes(new URL(entry).searchParams.get('token')));
    await files.locator('#reader-navigation button[title="src/rules.mjs"]').click();
    visits = 0;
    checkingB = true;
    const popup = context.waitForEvent('page');
    await files.getByRole('link', { name: '打开项目 B' }).click();
    const second = await popup;
    await second.getByText('请打开本次阅读的私密入口。', { exact: true }).waitFor();
    assert.equal((await second.reload()).status(), 403);
    checkingB = false;
    assert.ok(visits > 0);
    assert.equal(sentCredential, false);
    await enter(second, serviceB.entryUrl);
    assert.ok((await notes(second)).includes('B 的私有笔记'));
    await save(second, name + ' 阅读 B');
    assert.ok(!(await notes(page)).includes(name + ' 阅读 B'));
    assert.ok(!(await notes(second)).includes(name + ' 阅读 A'));
    const old = entry;
    await stopA();
    entry = await startA();
    assert.equal((await fetch(old)).status, 403);
    assert.equal((await (await context.newPage()).goto(deep)).status(), 403);
    assert.ok((await notes(second)).includes(name + ' 阅读 B'));
    await enter(page, entry);
    assert.ok((await notes(page)).includes(name + ' 阅读 A'));
    report.browsers.push({ name, version: browser.version(), passed: true });
    console.log(name, browser.version(), '通过');
    await browser.close();
    browser = undefined;
  }
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
  console.log(run, assets);
} finally {
  await browser?.close();
  await serviceB?.server.close();
  await stopA();
}
