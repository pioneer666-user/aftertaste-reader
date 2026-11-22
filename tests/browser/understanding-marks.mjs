import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { createBookmarkProject, rulesPath, servicePath, sharedBlockId } from '../fixtures/bookmark-project.mjs';

const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
assert.ok(['edge', 'chrome', 'firefox'].includes(engine));
const serverModule = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2], 'server/reader.js')) :
  new URL('../../dist/server/reader.js', import.meta.url);
const { startReader } = await import(serverModule.href);
const root = fileURLToPath(new URL(`../../.local/${process.env.AFTERTASTE_TEST_TASK ?? 'D021'}/`, import.meta.url));
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, `${engine}-`));
const fixture = await createBookmarkProject(path.join(run, 'project'));
const file = path.join(path.dirname(fixture.bookmarks), 'understanding-marks.json');
const notes = path.join(path.dirname(file), 'notes.json');
const noteSentinel = JSON.stringify({ version: 1, notes: [{
  id: 'bbb00000-0000-4000-8000-000000000001', revision: 'bbb00000-0000-4000-8000-000000000002',
  body: '单独记在项目笔记里', tags: [],
}] }) + '\n';
await writeFile(notes, noteSentinel);
const browser = engine === 'firefox' ? await firefox.launch() :
  await chromium.launch({ channel: engine === 'edge' ? 'msedge' : 'chrome' });
const evidence = { run, engine, browser: browser.version(), node: process.version, checks: [], errors: [] };
let reader, context, page, locker;
const question = '为什么要先校验数量？';
const explanation = '  先排除无效订单，后续处理只接受合法数量。\n<我的理解> 🌱  ';
const bookmark = '这个边界例子讲得巧';
const block = (target = page) => target.locator(`section[id="${sharedBlockId}"]`);
const selectedStatus = (target = page) => block(target).locator('.mark-controls [aria-pressed="true"]').getAttribute('data-status');
async function openMark(target = page) {
  const toggle = block(target).locator('[data-kind=mark]');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}
const editor = (target = page) => block(target).getByRole('textbox', { name: '批注（选填）' });
const button = (name, target = page) => target.getByRole('button', { name, exact: true });
const readMarks = async () => JSON.parse(await readFile(file, 'utf8')).marks;
const panel = () => page.locator('#marks');
const entry = target => panel().getByRole('button').filter({ hasText: target });
const responseTo = target => target.waitForResponse(response => response.request().method() === 'PUT' &&
  response.url().endsWith('/api/understanding-marks'));

async function selectFile(source, target = page) {
  const file = target.locator(`#reader-navigation button[title="${source}"]`);
  await target.locator('#reading .document-block').first().waitFor();
  if (await file.getAttribute('aria-current') !== 'page') await file.click();
  await target.getByRole('heading', { name: source, exact: true }).waitFor();
}

async function start() {
  reader = await startReader(fixture.projectRoot, 0);
  context = await browser.newContext({ viewport: { width: 1200, height: 720 } });
  page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.goto(reader.url);
}

async function restart() {
  await context.close();
  await reader.server.close();
  await start();
}

async function status(value, target = page) {
  await openMark(target);
  const saved = responseTo(target);
  await block(target).locator(`button[data-status="${value}"]:not(.margin-entry)`).click();
  assert.equal((await saved).status(), 200);
  await block(target).getByText('标注已保存', { exact: true }).waitFor();
  assert.equal(await selectedStatus(target), value);
}

async function openAnnotation(target = page, keyboard = false) {
  if (await editor(target).isVisible()) return;
  const control = block(target).locator('[data-kind=mark]');
  if (await control.getAttribute('aria-expanded') !== 'true') {
    if (keyboard) await control.press('Enter');
    else await control.click();
  }
  const edit = button('编辑批注', block(target));
  if (keyboard) await edit.press('Enter');
  else await edit.click();
  await editor(target).locator(':scope:focus').waitFor();
}

async function saveAnnotation(text, target = page) {
  await editor(target).fill(text);
  const saved = responseTo(target);
  await button('保存批注', block(target)).click();
  assert.equal((await saved).status(), 200);
  await editor(target).waitFor({ state: 'hidden' });
}

async function openMarks() {
  await button('标注').click();
  await panel().locator(':scope:focus').waitFor();
}

async function visit(target, name) {
  await entry(target).press('Enter');
  assert.equal(await panel().locator('.record-prose').textContent(), await entry(target).locator('.bookmark-note').textContent());
  const visitButton = target === rulesPath ? button('回原文', panel().locator('.record-detail')) : entry(target).locator('..').locator('.record-visit');
  await visitButton.and(page.locator('button:enabled')).press('Enter');
  await page.getByRole('heading', { name, exact: true }).waitFor();
  await block().locator(`#mark-${sharedBlockId}:focus`).waitFor();
  assert.ok(await block().evaluate(element => {
    const pane = element.closest('.reading-pane').getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    return bounds.bottom > pane.top && bounds.top < pane.bottom;
  }));
}

async function unlock() {
  if (!locker) return;
  const exited = once(locker, 'exit');
  locker.stdin.end('\n');
  await exited;
  locker = undefined;
}

try {
  await start();
  await selectFile('src/rules.mjs');
  assert.equal(await block().locator('.source-pane').count(), 1);
  assert.equal(await selectedStatus(), 'unmarked');
  await status('not-understood');
  await openAnnotation(page, true);
  await saveAnnotation(question);
  await block().locator('button.block-bookmarks-toggle').click();
  await block().getByRole('textbox', { name: '备注（选填）' }).fill(bookmark);
  await button('保存书签', block()).click();
  await block().getByText('书签已保存', { exact: true }).waitFor();

  await selectFile('src/service.mjs');
  assert.equal(await block().locator('.source-pane').count(), 0);
  await status('understood');
  await openAnnotation();
  await saveAnnotation('参数如何经过两个函数');
  await status('not-understood');
  await openAnnotation();
  await saveAnnotation('');
  await restart();
  await openMarks();
  await panel().getByRole('combobox', { name: '筛选标注' }).selectOption('not-understood');
  assert.match(await entry(rulesPath).innerText(), /为什么要先校验数量？/u);
  assert.match(await entry(servicePath).innerText(), /无批注/u);
  await visit(servicePath, 'src/service.mjs');
  assert.equal(await selectedStatus(), 'not-understood');
  await openMarks();
  await visit(rulesPath, 'src/rules.mjs');
  assert.equal(await selectedStatus(), 'not-understood');
  await status('understood');
  await openAnnotation();
  assert.equal(await editor().inputValue(), question);
  await openMarks();
  await entry(rulesPath).waitFor({ state: 'hidden' });
  await entry(servicePath).waitFor();
  await panel().getByRole('combobox', { name: '筛选标注' }).selectOption('all');
  assert.match(await entry(rulesPath).innerText(), /已理解/u);
  await page.screenshot({ path: path.join(run, 'marks.png') });
  await visit(rulesPath, 'src/rules.mjs');
  await openAnnotation();
  await editor().waitFor();
  await saveAnnotation(explanation);
  await status('unmarked');
  await restart();
  await openMarks();
  assert.match(await entry(rulesPath).innerText(), /未标记/u);
  await visit(rulesPath, 'src/rules.mjs');
  assert.equal(await selectedStatus(), 'unmarked');
  await openAnnotation();
  assert.equal(await editor().inputValue(), explanation);
  assert.equal((await readMarks()).find(mark => mark.documentPath === rulesPath).annotation, explanation);
  evidence.checks.push('two block types, independent state and annotation, reopens, keyboard focus and filtering');

  const second = await context.newPage();
  await second.goto(reader.url);
  await selectFile('src/rules.mjs', second);
  await openAnnotation(second);
  await saveAnnotation('另一页已经修改', page);
  await editor(second).fill('陈旧页的草稿');
  const conflict = responseTo(second);
  await button('保存批注', block(second)).click();
  assert.equal((await conflict).status(), 409);
  await block(second).getByRole('alert').filter({ hasText: '已保存的批注' }).waitFor();
  await block(second).getByRole('alert').getByText('另一页已经修改', { exact: true }).waitFor();
  assert.equal(await editor(second).inputValue(), '陈旧页的草稿');
  assert.equal((await readMarks()).find(mark => mark.documentPath === rulesPath).annotation, '另一页已经修改');
  const confirmed = responseTo(second);
  await button('保存我的批注', block(second)).click();
  assert.equal((await confirmed).status(), 200);
  await editor(second).waitFor({ state: 'hidden' });
  assert.equal((await readMarks()).find(mark => mark.documentPath === rulesPath).annotation, '陈旧页的草稿');
  await second.close();
  await page.reload();
  await selectFile('src/rules.mjs');

  if (engine === 'edge' && process.platform === 'win32') {
    const before = await readFile(file);
    locker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'try { $f = [IO.File]::Open($env:D021_LOCK_FILE, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); [Console]::WriteLine("LOCKED"); [void][Console]::ReadLine() } finally { if ($f) { $f.Close() } }'],
    { env: { ...process.env, D021_LOCK_FILE: file }, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
    assert.deepEqual(await once(createInterface({ input: locker.stdout }), 'line', { signal: AbortSignal.timeout(12000) }), ['LOCKED']);
    await openAnnotation();
    await editor().fill('真实保存失败时保留的输入');
    const release = Promise.withResolvers();
    const annotation = block().locator('[data-kind=mark]');
    await page.route('**/api/understanding-marks', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      const response = await route.fetch();
      await release.promise;
      await route.fulfill({ response });
    });
    let response;
    try {
      const failure = responseTo(page);
      await button('保存批注', block()).click();
      await annotation.click();
      assert.equal(await annotation.getAttribute('aria-expanded'), 'false');
      release.resolve();
      response = await failure;
    } finally {
      release.resolve();
      await page.unrouteAll({ behavior: 'wait' });
    }
    assert.equal(response.status(), 422);
    assert.equal((await response.json()).error.code, 'MARK_WRITE_FAILED');
    await block().getByRole('alert').filter({ hasText: '无法保存标注' }).waitFor();
    assert.equal(await editor().isVisible(), false);
    await annotation.click();
    assert.equal(await editor().inputValue(), '真实保存失败时保留的输入');
    assert.deepEqual(await readFile(file), before);
    assert.ok((await readdir(path.dirname(file))).every(name => !name.startsWith('.aftertaste-understanding-marks-')));
    await page.screenshot({ path: path.join(run, 'write-failed.png') });
    await unlock();
    await saveAnnotation('真实保存失败时保留的输入');
  }
  evidence.checks.push('stale annotation protected until explicit confirmation; Windows file lock reports failure while collapsed and preserves the original and draft');

  const original = await readFile(fixture.rules, 'utf8');
  await writeFile(fixture.rules, original.replace('数量超出范围时', '后来改写的标题'));
  await openMarks();
  await visit(rulesPath, 'src/rules.mjs');
  await block().getByRole('heading', { name: '后来改写的标题' }).waitFor();
  assert.equal(await block().getByText(/内容已变更/u).count(), 0);
  const serviceDocument = await readFile(fixture.service, 'utf8');
  const pure = serviceDocument.indexOf(`<!-- aftertaste:block id=${sharedBlockId} -->`);
  const first = serviceDocument.indexOf('<!-- aftertaste:block');
  assert.ok(pure > first && first > 0);
  await writeFile(fixture.service, serviceDocument.slice(0, first) + serviceDocument.slice(pure) + '\n' + serviceDocument.slice(first, pure));
  await openMarks();
  await visit(servicePath, 'src/service.mjs');
  assert.equal(await selectedStatus(), 'not-understood');
  assert.equal(await page.locator('.document-block').first().getAttribute('id'), sharedBlockId);
  await writeFile(fixture.rules, original.replace(sharedBlockId, 'changed1'));
  await openMarks();
  await entry(rulesPath).locator('..').locator('.record-visit').click();
  await panel().getByText(/当前讲解中没有目标块/u).waitFor();
  await button('文件讲解').click();
  await page.getByRole('heading', { name: 'src/service.mjs', exact: true }).waitFor();
  await page.locator('#reader-navigation button[title="src/rules.mjs"]').click();
  await page.locator('#changed1 [data-kind=mark]').click();
  assert.equal(await page.locator('#changed1 .mark-controls [aria-pressed=true]').getAttribute('data-status'), 'unmarked');
  await rename(fixture.rules, fixture.rules + '.offline');
  await openMarks();
  await entry(rulesPath).locator('..').locator('.record-visit').click();
  await panel().getByText(/当前讲解文档暂时缺失/u).waitFor();
  await entry(rulesPath).waitFor();
  await rename(fixture.rules + '.offline', fixture.rules);
  await writeFile(fixture.rules, '损坏的讲解');
  await entry(rulesPath).locator('..').locator('.record-visit').click();
  await panel().getByText(/当前讲解无法按块读取/u).waitFor();
  await writeFile(fixture.rules, original);
  await visit(rulesPath, 'src/rules.mjs');
  await openAnnotation();
  await saveAnnotation('');
  await block().locator('button.block-bookmarks-toggle').click();
  await block().getByText(bookmark, { exact: true }).waitFor();
  assert.equal(await readFile(notes, 'utf8'), noteSentinel);
  assert.deepEqual((await readMarks()).map(mark => mark.documentPath), [servicePath]);
  assert.equal(JSON.parse(await readFile(fixture.bookmarks, 'utf8')).bookmarks[0].note, bookmark);
  evidence.checks.push('identity survives rewrite, absent/malformed document and new ID; clearing stays independent of other assets');

  await selectFile('src/service.mjs');
  await openAnnotation();
  await saveAnnotation(explanation);
  await page.setViewportSize({ width: 380, height: 700 });
  await page.getByRole('combobox', { name: '界面语言' }).selectOption('en');
  await page.locator('header [popovertarget="app-page-menu"]').click();
  await button('Marks').click();
  await button('Open mark list').click();
  await panel().getByRole('combobox', { name: 'Filter marks' }).waitFor();
  assert.equal(await entry(servicePath).locator('.bookmark-note').textContent(), explanation);
  assert.ok(await panel().evaluate(element => element.scrollWidth <= element.clientWidth));
  await page.screenshot({ path: path.join(run, 'english-narrow.png') });
  evidence.checks.push('English narrow layout and original text');
  assert.deepEqual(evidence.errors, []);
} catch (error) {
  evidence.failure = error.stack;
  if (page) await page.screenshot({ path: path.join(run, 'failed.png') }).catch(() => {});
  throw error;
} finally {
  await unlock();
  await context?.close();
  await browser.close();
  await reader?.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
}
