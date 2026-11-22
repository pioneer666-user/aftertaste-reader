import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { createLoopReaderProject } from '../fixtures/loop-reader.mjs';

const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D040');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'editors-'));
const project = path.join(run, 'project');
const data = path.join(project, 'docs/aftertaste');
if (process.env.AFTERTASTE_READER_INPUT) await cp(process.env.AFTERTASTE_READER_INPUT, project, { recursive: true });
else {
  await createLoopReaderProject(project);
  await cp(new URL('../fixtures/page-preview/', import.meta.url), data, { recursive: true });
}
const bookmarksFile = path.join(data, 'bookmarks.json');
const marksFile = path.join(data, 'understanding-marks.json');
const target = { blockId: 'zhidif44', documentPath: 'docs/aftertaste/current/src/service.mjs.md' };
const first = { ...target, id: crypto.randomUUID(), note: '对照审计的返回值。' };
const second = { ...target, id: crypto.randomUUID(), note: '再读数量规则。'.repeat(40) };
const read = async file => JSON.parse(await readFile(file, 'utf8'));
const bookmarks = await read(bookmarksFile);
bookmarks.bookmarks.push(first, second);
await writeFile(bookmarksFile, JSON.stringify(bookmarks));
const noteOnDisk = async id => (await read(bookmarksFile)).bookmarks.find(b => b.id === id)?.note;
const markOnDisk = async () => (await read(marksFile)).marks.find(m => m.blockId === target.blockId && m.documentPath === target.documentPath);
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const reader = await startReader(project, 0);
const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
const report = { build, project, engine, checks: [], touch: {}, paint: {}, menuGeometry: {}, errors: [] };
let browser;
async function open(page) {
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(reader.url);
  if (page.viewportSize().width < 650) await page.getByRole('button', { name: '展开阅读导航' }).click();
  await page.locator('button[title="src/service.mjs"]').click();
  const block = page.locator('#zhidif44');
  await block.waitFor();
  const panel = block.getByRole('dialog');
  const button = (name, scope = panel) => scope.getByRole('button', { name, exact: true });
  const row = record => panel.locator('#bookmark-' + record.id);
  const trigger = kind => block.locator('[data-kind=' + kind + ']');
  return { block, panel, button, row, trigger, input: panel.getByRole('textbox'),
    edit: record => button('编辑备注', row(record)).click() };
}
async function put(page, button, status = 200) {
  const response = page.waitForResponse(r => r.request().method() === 'PUT');
  await button.click();
  assert.equal((await response).status(), status);
}
async function checkMenu(ui, record, size) {
  const more = ui.button('更多', ui.row(record));
  await more.scrollIntoViewIfNeeded();
  const measure = () => ui.panel.evaluate(panel => {
    const box = el => {
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    };
    return { panel: box(panel), scroll: panel.querySelector('.margin-body').scrollTop,
      rows: [...panel.querySelectorAll('.block-bookmarks li')].map(box) };
  });
  const before = await measure();
  await more.press('Enter');
  const open = await measure();
  const remove = ui.button('移除书签', ui.row(record));
  await remove.locator(':scope:focus').waitFor();
  await ui.panel.screenshot({ path: path.join(run, 'more-' + size + '.png') });
  await remove.press('Escape');
  await more.locator(':scope:focus').waitFor();
  const closed = await measure();
  report.menuGeometry[size] = { before, open, closed };
  assert.deepEqual(open, before, size + ' open');
  assert.deepEqual(closed, before, size + ' close');
}
async function paint(name, locator) {
  if (engine !== 'firefox') return;
  await locator.evaluate(el => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  report.paint[name] = await locator.evaluate(el => {
    const s = getComputedStyle(el);
    const id = s.borderImageSource.match(/#([^)"']+)/)?.[1];
    const svg = id && document.getElementById(id);
    return { radius: s.getPropertyValue('--corner-size'), image: s.borderImageSource,
      paths: svg ? [...svg.children].map(p => [p.getAttribute('fill'), p.getAttribute('stroke-width')]) : [] };
  });
  assert.ok(report.paint[name].paths.length, name);
}
async function locked(file, act) {
  const locker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$f=[IO.File]::Open($env:D040_LOCK_FILE,"Open","Read","Read"); try { [Console]::WriteLine("ready"); [void][Console]::ReadLine() } finally { $f.Close() }'],
    { env: { ...process.env, D040_LOCK_FILE: file }, windowsHide: true, stdio: ['pipe', 'pipe', 'inherit'] });
  const done = once(locker, 'exit');
  try {
    assert.deepEqual(await once(createInterface({ input: locker.stdout }), 'line', { signal: AbortSignal.timeout(10000) }), ['ready']);
    await act();
  } finally { locker.stdin.end('\n'); await done; }
}

try {
  browser = engine === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: engine === 'chrome' ? 'chrome' : 'msedge' });
  report.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const ui = await open(page);
  const { panel, button, row, input, trigger } = ui;
  const badge = row(first).getByText('未保存', { exact: true });
  await trigger('bookmarks').click();
  await checkMenu(ui, first, 'desktop');
  await ui.edit(first);
  assert.equal(await badge.count(), 0);
  await input.fill('草稿 A');
  await badge.waitFor();
  await input.fill(first.note);
  assert.equal(await badge.count(), 0);
  await input.fill('草稿 A');
  await ui.edit(second);
  await input.fill('草稿 B');
  await button('再加一条').click();
  await input.fill('新增草稿');
  await page.keyboard.press('Escape');
  await trigger('bookmarks').click();
  assert.equal(await input.inputValue(), '新增草稿');
  await ui.edit(second);
  assert.equal(await input.inputValue(), '草稿 B');
  await button('取消').click();
  await row(second).getByText(second.note).waitFor();
  await button('更多', row(first)).click();
  assert.ok(await button('移除书签', row(first)).isDisabled());
  await page.keyboard.press('Escape');
  await button('更多', row(first)).locator(':scope:focus').waitFor();
  await page.keyboard.press('Escape');
  await trigger('bookmarks').locator(':scope:focus').waitFor();
  await trigger('bookmarks').click();
  await ui.edit(first);
  assert.equal(await input.inputValue(), '草稿 A');
  assert.equal(await row(first).locator('textarea').count(), 1);
  await paint('editor', panel.locator('.record-editor'));
  await paint('panel', panel);
  await panel.screenshot({ path: path.join(run, 'focused-editor.png') });
  await ui.block.locator('.source-pane').click();
  await trigger('bookmarks').click();
  assert.equal(await input.inputValue(), '草稿 A');
  await button('再加一条').click();
  assert.equal(await input.inputValue(), '新增草稿');
  await input.fill('');
  await put(page, button('保存书签'));
  assert.equal((await read(bookmarksFile)).bookmarks.at(-1).note, '');
  assert.equal(await noteOnDisk(first.id), first.note);
  await button('更多', row(second)).press('Enter');
  await button('移除书签', row(second)).locator(':scope:focus').waitFor();
  const menu = row(second).locator('.record-menu');
  await paint('menu', menu);
  const inFrame = await menu.evaluate(el => {
    const r = el.getBoundingClientRect(), area = el.closest('.margin-body').getBoundingClientRect();
    return r.top >= area.top && r.bottom <= area.bottom + 1;
  });
  assert.ok(inFrame, 'menu remains inside the scrolling body after a long reason');

  await panel.screenshot({ path: path.join(run, 'menu.png') });
  await put(page, button('移除书签', row(second)));
  assert.equal(await noteOnDisk(second.id), undefined);
  assert.equal(await noteOnDisk(first.id), first.note);
  report.checks.push('三份草稿、原行替换、改回原话、Esc/点外、取消、移除保护、指定条移除、空理由新增');

  const other = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const otherUi = await open(other);
  await otherUi.trigger('bookmarks').click();
  await otherUi.edit(first);
  await otherUi.input.fill('另一页已存的原话');
  await put(other, otherUi.button('保存书签'));
  await ui.edit(first);
  await put(page, button('保存书签'), 409);
  await row(first).getByText(/已保存的备注.*另一页已存的原话/).waitFor();
  assert.equal(await input.inputValue(), '草稿 A');
  assert.equal(await noteOnDisk(first.id), '另一页已存的原话');
  await put(page, button('保存书签'));
  assert.equal(await noteOnDisk(first.id), '草稿 A');
  await other.close();
  if (engine === 'edge' && process.platform === 'win32') {
    await ui.edit(first);
    await input.fill('解锁后的理由');
    await locked(bookmarksFile, () => put(page, button('保存书签'), 422));
    await panel.getByRole('alert').waitFor();
    assert.equal(await input.inputValue(), '解锁后的理由');
    assert.equal(await noteOnDisk(first.id), '草稿 A');
    await put(page, button('保存书签'));
    assert.equal(await noteOnDisk(first.id), '解锁后的理由');
  }

  await trigger('mark').click();
  await button('编辑批注').click();
  await input.fill('已存批注');
  await put(page, button('保存批注'));
  if (await button('已理解').getAttribute('aria-pressed') !== 'true') await put(page, button('已理解'));
  await button('编辑批注').click();
  await input.fill('批注草稿');
  await put(page, button('不理解'));
  assert.equal((await markOnDisk()).annotation, '已存批注');
  assert.equal((await markOnDisk()).status, 'not-understood');
  await paint('selected', button('不理解'));
  await button('关闭').click();
  await trigger('mark').click();
  assert.equal(await input.inputValue(), '批注草稿');
  await button('取消').click();
  await panel.getByText('已存批注', { exact: true }).waitFor();
  await button('编辑批注').click();
  await input.fill('写入后的批注');
  if (engine === 'edge' && process.platform === 'win32') {
    await locked(marksFile, () => put(page, button('保存批注'), 422));
    assert.equal(await input.inputValue(), '写入后的批注');
    assert.equal((await markOnDisk()).annotation, '已存批注');
    await panel.getByRole('alert').waitFor();
  }
  await put(page, button('保存批注'));
  assert.equal((await markOnDisk()).annotation, '写入后的批注');
  await button('编辑批注').click();
  await input.fill('');
  await put(page, button('保存批注'));
  assert.equal((await markOnDisk()).annotation, '');
  report.checks.push('陈旧书签 409 核对双方并重试，切换自评只写状态，关闭续写、取消、保存及清空批注');
  if (engine === 'edge' && process.platform === 'win32') report.checks.push('两份作者副本记录在 Windows 文件锁下均返回 422，解锁后重试落盘');
  await page.close();

  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const narrow = await open(touch);
  async function measure(state) {
    const sizes = await narrow.panel.locator('button:visible').evaluateAll(els => els.map(el => {
      const r = el.getBoundingClientRect();
      return [el.ariaLabel || el.textContent.trim(), r.width, r.height];
    }));
    assert.ok(sizes.every(([, w, h]) => w >= 44 && h >= 44), JSON.stringify(sizes));
    report.touch[state] = sizes;
  }
  await narrow.trigger('bookmarks').tap();
  await checkMenu(narrow, first, 'touch');
  await narrow.button('更多', narrow.row(first)).tap();
  await measure('more');
  await narrow.edit(first);
  await measure('bookmark');
  await narrow.trigger('mark').tap();
  await measure('mark');
  await narrow.button('编辑批注').tap();
  await measure('annotation');
  await touch.screenshot({ path: path.join(run, 'touch.png') });
  await touch.emulateMedia({ forcedColors: 'active' });
  await narrow.input.focus();
  const forced = await narrow.input.evaluate(el => {
    const outer = getComputedStyle(el.closest('form'));
    return { outer: outer.outlineStyle, width: outer.outlineWidth, inner: getComputedStyle(el).outlineStyle };
  });
  assert.deepEqual(forced, { outer: 'solid', width: '2px', inner: 'none' });
  await touch.screenshot({ path: path.join(run, 'forced-editor.png') });
  assert.deepEqual(report.errors, []);
} finally {
  await browser?.close();
  await reader.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
  console.log(run);
}
