import { editorText, newQuickNote } from './note-controls.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { chromium, firefox } from 'playwright';
import { startReader } from '../../dist/server/reader.js';
import { createBookmarkProject, rulesPath, servicePath, sharedBlockId } from '../fixtures/bookmark-project.mjs';

const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
assert.ok(['edge', 'chrome', 'firefox'].includes(engine));
const root = fileURLToPath(new URL(`../../.local/${process.env.AFTERTASTE_TEST_TASK ?? 'D020'}/`, import.meta.url));
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, `${engine}-`));
const fixture = await createBookmarkProject(path.join(run, 'project'));
const file = path.join(fixture.projectRoot, 'docs/aftertaste/notes.json');
const browser = engine === 'firefox' ? await firefox.launch({ headless: true }) :
  await chromium.launch({ channel: engine === 'edge' ? 'msedge' : 'chrome', headless: true });
const evidence = { run, engine, browser: browser.version(), node: process.version, checks: [], errors: [] };
let reader, context, page, locker;
const firstQuote = '边界校验拒绝不符合要求的数量。';
const secondQuote = '本块回顾订单创建时怎样使用数量规则。';
const firstTag = '边界,数量';
const secondTag = ' 待核对 ';
const button = (name, target = page) => target.getByRole('button', { name, exact: true });
const quick = () => page.locator('#quick-note');
const quickBody = () => quick().getByRole('textbox', { name: /^(笔记正文|Note body)$/u });
const quickSaved = () => quick().getByRole('status').filter({ hasText: /^(已保存|Saved)$/u }).waitFor();
const body = (target = page) => notes(target).getByRole('textbox', { name: '笔记正文' });
const notes = (target = page) => target.locator('#notes');
const block = () => page.locator(`section[id="${sharedBlockId}"]`);
const raw = () => readFile(file, 'utf8');
const disk = async () => JSON.parse(await raw()).notes;
const saved = (target = page) => notes(target).getByRole('status').filter({ hasText: /^已保存$/u }).waitFor();
const openNotes = async (target = page) => { await button('笔记', target).click(); await notes(target).waitFor(); };
const row = (text, target = page) => notes(target).locator('.note-list button').filter({ hasText: text });

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

async function selectFile(name) {
  await page.locator(`#reader-navigation button[title="${name}"]`).click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
}

async function selectText(locator, text) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((element, text) => {
    const node = element.firstChild;
    const i = text === undefined ? 0 : node.textContent.indexOf(text);
    if (i < 0) throw new Error('Missing fixture quote');
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, text === undefined ? node.textContent.length : i + text.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, text);
}

async function selectQuote(text) {
  await selectText(block().locator('.explanation-text p'), text);
  await button('加入笔记').click();
  await quick().locator('.note-reference').getByText(text, { exact: true }).waitFor();
}

async function addTag(text) {
  await page.getByRole('textbox', { name: '新标签' }).fill(text);
  await button('添加标签').click();
}

async function visit(text, source) {
  await notes().getByRole('link', { name: text, exact: true }).click();
  await page.getByRole('heading', { name: source, exact: true }).waitFor();
  await block().locator(':scope:focus').waitFor();
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
  const newNote = button('笔记列表');
  const writes = [];
  page.on('request', req => { if (req.method() === 'PUT' && req.url().endsWith('/api/notes')) writes.push(req.postDataJSON()); });
  const originalFile = await raw().catch(error => { assert.equal(error.code, 'ENOENT'); return null; });
  await newNote.dblclick();
  await button('新建笔记', quick()).click();
  await quickBody().locator(':scope:focus').waitFor();
  assert.equal(await editorText(quickBody()), '');
  await button('预览', quick()).click();
  await button('编辑', quick()).press('Escape');
  await newNote.locator(':scope:focus').waitFor();
  await page.waitForTimeout(500);
  assert.equal(writes.length, 0);
  assert.equal(await raw().catch(error => { assert.equal(error.code, 'ENOENT'); return null; }), originalFile);
  await newQuickNote(page);
  const put = page.waitForResponse(res => res.request().method() === 'PUT' && res.url().endsWith('/api/notes'));
  if (engine === 'firefox') await quickBody().fill('先写一个独立问题');
  else {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => navigator.clipboard.writeText('先写一个独立问题'));
    await quickBody().press('Control+v');
  }
  await quickBody().press('Escape');
  assert.equal((await put).status(), 200);
  assert.equal((await disk()).length, 1);
  const standalone = (await disk())[0];
  await restart();
  assert.deepEqual(await disk(), [standalone]);

  await button('文件讲解').click();
  await selectFile('src/rules.mjs');
  assert.equal(await block().locator('.source-pane').count(), 1);
  await selectText(block().locator('.source-line > span:last-child').filter({ hasText: /\w/u }).first());
  assert.equal(await button('加入笔记').count(), 0);
  await selectQuote(firstQuote);
  await quickBody().press('Control+End');
  await page.keyboard.insertText('~~~text\n这里是尚未合上的示例');
  await quickSaved();
  await selectFile('src/service.mjs');
  assert.equal(await block().locator('.source-pane').count(), 0);
  await selectQuote(secondQuote);
  await quickBody().press('Control+Home');
  await page.keyboard.insertText('这里为什么要先判断数量？\n\n[普通网址](https://example.org/)\n\n');
  await quickSaved();
  await quickBody().press('Escape');
  await openNotes();
  await row('这里为什么').click();
  await button('编辑').click();
  await addTag(firstTag);
  await addTag(secondTag);
  await saved();
  const linked = (await disk()).find(note => note.body.includes(firstQuote));
  assert.deepEqual(linked.tags, [firstTag, secondTag]);
  assert.ok(linked.body.startsWith('这里为什么要先判断数量？\n\n'));
  assert.match(linked.body, /~~~text\n这里是尚未合上的示例\n~~~\n\n/u);
  assert.equal(await notes().getByRole('link', { name: '普通网址' }).getAttribute('target'), '_blank');
  assert.equal(await notes().getByRole('link', { name: firstQuote, exact: true }).getAttribute('title'), '回到讲解块');
  await notes().locator('.note-preview').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(run, 'linked-note.png') });
  assert.equal((await disk()).length, 2);
  evidence.checks.push('standalone create, selection from comparison and pure explanation, append and two literal tags');

  await restart();
  await openNotes();
  const filter = notes().getByRole('combobox', { name: '按标签筛选' });
  for (const tag of [firstTag, secondTag]) {
    await filter.selectOption(tag);
    assert.equal(await row('先写一个独立问题').count(), 0);
    await row('这里为什么').waitFor();
  }
  await filter.selectOption('');
  await row('这里为什么').click();
  await visit(firstQuote, 'src/rules.mjs');
  await openNotes();
  await visit(secondQuote, 'src/service.mjs');
  await openNotes();
  await filter.selectOption('');
  await row('先写一个独立问题').click();
  page.once('dialog', dialog => dialog.accept());
  await button('编辑').click();
  await button('删除笔记').click();
  await row('先写一个独立问题').waitFor({ state: 'detached' });
  await restart();
  await openNotes();
  await row('这里为什么').click();
  assert.deepEqual(await disk(), [linked]);
  evidence.checks.push('restart tag lookup, two same-ID file visits scroll and focus, individual deletion persists');

  const original = await readFile(fixture.service, 'utf8');
  const changed = original.replace(secondQuote, '这段讲解已经改写。');
  await writeFile(fixture.service, changed);
  await visit(secondQuote, 'src/service.mjs');
  await block().getByText('这段讲解已经改写。', { exact: true }).waitFor();
  await openNotes();
  const variants = [
    ['缺失', () => rename(fixture.service, fixture.service + '.away'), () => rename(fixture.service + '.away', fixture.service)],
    ['文档块发生嵌套', () => writeFile(fixture.service, changed.replace('<!-- aftertaste:end -->', '<!-- broken -->')), () => writeFile(fixture.service, changed)],
    ['没有目标块', () => writeFile(fixture.service, changed.replace(sharedBlockId, 'changed1')), () => writeFile(fixture.service, changed)],
  ];
  for (const [reason, hide, restore] of variants) {
    await hide();
    try {
      await notes().getByRole('link', { name: secondQuote, exact: true }).click();
      const problem = notes().locator('.note-visit-problem:focus');
      await problem.waitFor();
      assert.match(await problem.innerText(), new RegExp(reason, 'u'));
      assert.equal(await notes().getByRole('link', { name: secondQuote, exact: true }).textContent(), secondQuote);
      await visit(firstQuote, 'src/rules.mjs');
      await openNotes();
    } finally { await restore(); }
    await visit(secondQuote, 'src/service.mjs');
    await openNotes();
  }
  assert.deepEqual(await disk(), [linked]);
  await assert.rejects(readFile(fixture.bookmarks), { code: 'ENOENT' });
  evidence.checks.push('same ID rewrite, missing file, invalid document, missing block, recovery and link/bookmark preservation');

  await button('编辑').click();
  await body().press('Control+Home');
  await page.keyboard.insertText('甲');
  await saved();
  const firstEdit = await editorText(body());
  await body().press('Control+End');
  await page.keyboard.insertText('乙');
  await saved();
  await body().press('Control+z');
  await saved();
  assert.equal(await editorText(body()), firstEdit);
  assert.equal((await disk())[0].body, firstEdit);
  await page.reload();
  await openNotes();
  await row('甲这里为什么').click();
  await button('编辑').click();
  assert.equal(await editorText(body()), firstEdit);
  evidence.checks.push('Ctrl+Z after completed autosave, resave and refresh');

  let releaseFirst, releaseSecond;
  const checkpoints = new EventEmitter();
  const firstWait = new Promise(resolve => { releaseFirst = resolve; });
  const secondWait = new Promise(resolve => { releaseSecond = resolve; });
  let count = 0;
  const handler = async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    if (++count === 1) {
      const response = await route.fetch();
      checkpoints.emit('committed');
      await firstWait;
      return route.fulfill({ response });
    }
    checkpoints.emit('started');
    await secondWait;
    return route.continue();
  };
  await page.route('**/api/notes', handler);
  try {
    await Promise.all([once(checkpoints, 'committed', { signal: AbortSignal.timeout(15000) }), body().fill('较早输入')]);
    await body().fill('最新输入');
    const started = once(checkpoints, 'started', { signal: AbortSignal.timeout(15000) });
    releaseFirst();
    await started;
    assert.equal(await editorText(body()), '最新输入');
    await notes().getByRole('status').filter({ hasText: '正在保存' }).waitFor();
    assert.equal((await disk())[0].body, '较早输入');
  } finally { releaseFirst(); releaseSecond(); }
  await saved();
  assert.equal((await disk())[0].body, '最新输入');
  await page.unroute('**/api/notes', handler);
  evidence.checks.push('delayed older response did not replace latest input or report it saved');

  if (engine === 'edge' && process.platform === 'win32') {
    const before = await raw();
    locker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'try { $f = [IO.File]::Open($env:D020_LOCK_FILE, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); [Console]::WriteLine("LOCKED"); [void][Console]::ReadLine() } finally { if ($f) { $f.Close() } }'],
    { env: { ...process.env, D020_LOCK_FILE: file }, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
    const output = createInterface({ input: locker.stdout });
    assert.deepEqual(await once(output, 'line', { signal: AbortSignal.timeout(12000) }), ['LOCKED']);
    const put = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith('/api/notes'));
    await body().fill('真实写失败的草稿');
    const response = await put;
    assert.equal(response.status(), 422);
    assert.equal((await response.json()).error.code, 'NOTE_WRITE_FAILED');
    await notes().getByRole('alert').filter({ hasText: '笔记未保存' }).waitFor();
    assert.equal(await editorText(body()), '真实写失败的草稿');
    assert.equal(await raw(), before);
    assert.ok((await readdir(path.dirname(file))).every(name => !name.startsWith('.aftertaste-notes-')));
    await body().fill('失败后继续编辑的草稿');
    await page.screenshot({ path: path.join(run, 'write-failed.png') });
    await newQuickNote(page);
    const failure = page.waitForResponse(res => res.request().method() === 'PUT' && res.url().endsWith('/api/notes'));
    await quickBody().fill('锁定期间另一篇随手记');
    await quickBody().press('Escape');
    assert.equal((await failure).status(), 422);
    await button('笔记列表').click();
    await quick().getByRole('button').filter({hasText:'锁定期间另一篇随手记'}).click();
    assert.equal(await editorText(quickBody()), '锁定期间另一篇随手记');
    assert.equal(await editorText(body()), '失败后继续编辑的草稿');
    await quick().getByRole('alert').waitFor();
    assert.equal(await raw(), before);
    await unlock();
    await button('重试保存', quick()).click();
    await quickSaved();
    await quickBody().press('Escape');
    await button('完成').click();
    await row('锁定期间另一篇随手记').click();
    await button('编辑').click();
    page.once('dialog', dialog => dialog.accept());
    await button('删除笔记').click();
    await row('失败后继续编辑的草稿').click();
    await notes().getByRole('alert').waitFor();
    await button('编辑').click();
    assert.equal(await editorText(body()), '失败后继续编辑的草稿');
    await button('重试保存').click();
    await saved();
    assert.deepEqual((await disk()).map(record => record.body), ['失败后继续编辑的草稿']);
    evidence.checks.push('real Windows write failure, original intact, editable draft and retry without duplicate');
  }

  for (const committed of [false, true]) {
    await newQuickNote(page);
    const original = `断开前的笔记 ${committed}`;
    const changed = `结果未知的编辑 ${committed}`;
    await quickBody().fill(original);
    await quickSaved();
    await quickBody().press('Escape');
    await row(original).click();
    await button('编辑').click();
    const record = (await disk()).find(note => note.body === original);
    await page.route('**/api/notes', async route => {
      assert.equal(route.request().method(), 'PUT');
      if (committed) assert.equal((await route.fetch()).status(), 200);
      await route.abort('failed');
    }, { times: 1 });
    await body().fill(changed);
    await notes().getByRole('alert').filter({ hasText: '无法连接本地阅读服务' }).waitFor();
    assert.equal((await disk()).find(note => note.id === record.id).body, committed ? changed : original);
    page.once('dialog', dialog => dialog.accept());
    await button('删除笔记').click();
    await body().waitFor({ state: 'detached' });
    assert.equal((await disk()).some(note => note.id === record.id), false);
  }
  evidence.checks.push('delete after interrupted save checks confirmed or committed candidate revision');

  await newQuickNote(page);
  await quickBody().fill('另一条可并行编辑');
  await quickSaved();
  await quickBody().press('Escape');
  await row('另一条可并行编辑').click();
  await button('编辑').click();
  const previous = (await disk())[0].body;
  const other = await context.newPage();
  await other.goto(reader.url);
  await openNotes(other);
  await row(previous, other).click();
  await button('编辑', other).click();
  await Promise.all([body().fill('第一页面修改第二条'), body(other).fill('第二页面修改第一条')]);
  await saved();
  await saved(other);
  assert.deepEqual((await disk()).map(record => record.body), ['第二页面修改第一条', '第一页面修改第二条']);
  await row(previous).click();
  await button('编辑').click();
  await body().fill('陈旧草稿保留');
  await notes().getByRole('alert').filter({ hasText: '已保存版本已变化' }).waitFor();
  assert.equal(await editorText(body()), '陈旧草稿保留');
  assert.equal((await disk())[0].body, '第二页面修改第一条');
  await other.close();
  evidence.checks.push('two real pages save distinct records, stale edit retains unsaved draft and durable edit');

  await page.getByRole('combobox', { name: '界面语言' }).selectOption('en');
  await page.setViewportSize({ width: 390, height: 760 });
  await notes().getByRole('alert').filter({ hasText: 'The saved version' }).waitFor();
  assert.equal(await editorText(page.getByRole('textbox', { name: 'Note body' })), '陈旧草稿保留');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await button('Preview').click();
  await notes().locator('.note-preview').getByText('陈旧草稿保留').waitFor();
  assert.equal(await notes().locator('#note-body').isVisible(), false);
  await notes().locator('.note-view-switch').getByRole('button', { name: 'Edit', exact: true }).click();
  assert.equal(await editorText(notes().locator('#note-body')), '陈旧草稿保留');
  await button('Done').click();
  await notes().locator('.note-preview').getByText('陈旧草稿保留').waitFor();
  await page.screenshot({ path: path.join(run, 'narrow-en.png') });
  const stored = await disk();
  await button('Note list').press('Enter');
  await button('New note', quick()).press('Enter');
  await quickBody().locator(':scope:focus').waitFor();
  assert.equal(await editorText(quickBody()), '');
  await quickBody().fill(Array.from({ length: 40 }, (_, i) => 'Line ' + i).join('\n'));
  await quickBody().press('Control+End');
  await quickBody().press('Shift+ArrowLeft');
  const selection = () => quickBody().evaluate(el => [getSelection().toString(), el.closest('.cm-scroller').scrollTop]);
  const beforePreview = await selection();
  assert.ok(beforePreview[0] && beforePreview[1] > 0);
  await button('Preview', quick()).click();
  await button('Edit', quick()).click();
  assert.deepEqual(await selection(), beforePreview);
  await quickBody().fill('Narrow keyboard note');
  await quickSaved();
  assert.deepEqual((await disk()).filter(note => note.body !== 'Narrow keyboard note'), stored);
  evidence.checks.push('English icon-only global action opens a focused blank editor at 390px; older notes stay intact');
  assert.deepEqual(evidence.errors, []);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await unlock();
  await context?.close();
  await reader?.server.close();
  await browser.close();
  await writeFile(path.join(run, 'evidence.json'), JSON.stringify(evidence, null, 2));
}
