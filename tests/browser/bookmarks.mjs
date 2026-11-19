import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { chromium, firefox } from 'playwright';
import { startReader } from '../../dist/server/reader.js';
import { createBookmarkProject, rulesPath, servicePath, sharedBlockId } from '../fixtures/bookmark-project.mjs';

const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
assert.ok(['edge', 'chrome', 'firefox'].includes(engine));
const root = fileURLToPath(new URL('../../.local/D019/', import.meta.url));
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, `${engine}-`));
const fixture = await createBookmarkProject(path.join(run, 'project'));
const browser = engine === 'firefox' ? await firefox.launch({ headless: true }) :
  await chromium.launch({ channel: engine === 'edge' ? 'msedge' : 'chrome', headless: true });
const report = { run, engine, browser: browser.version(), node: process.version, checks: [], pageErrors: [] };
let reader, context, page, locker;
const raw = () => readFile(fixture.bookmarks, 'utf8');
const disk = async () => JSON.parse(await raw()).bookmarks;
const block = (target = page) => target.locator(`section[id="${sharedBlockId}"]`);
const button = (name, target = page) => target.getByRole('button', { name, exact: true });
const field = (target = block()) => target.getByRole('textbox', { name: '备注（选填）' });
const row = id => page.locator(`#bookmark-${id}`);
const note = '  下次回看 <b>边界</b>\n完整保留  ';
const pureNote = '订单说明中的相同块 ID';

async function session() {
  reader = await startReader(fixture.projectRoot, 0);
  context = await browser.newContext({ viewport: { width: 1200, height: 720 } });
  page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.goto(reader.url);
  await block().waitFor();
}

async function restart() {
  await context.close();
  await reader.server.close();
  await session();
}

async function openDocument(file, target = page) {
  await button(file, target).click();
  await target.getByRole('heading', { name: file, exact: true }).waitFor();
  await block(target).waitFor();
}

async function draft(text, target = page, keyboard = false) {
  const add = button('加书签', block(target));
  if (keyboard) {
    await add.focus();
    await target.keyboard.press('Enter');
    await field(block(target)).evaluate(assertFocused);
  } else await add.click();
  await field(block(target)).fill(text);
}

async function save(target = page, status = '书签已保存') {
  await button('保存书签', block(target)).click();
  await block(target).getByText(status, { exact: true }).waitFor();
}

async function openBookmarks() {
  await button('书签').click();
  await page.getByRole('heading', { name: '书签', exact: true }).waitFor();
}

function assertFocused(element) {
  if (document.activeElement !== element) throw new Error('Expected bookmark focus');
}

function listEntry(bookmark) {
  return page.locator('#bookmarks button.bookmark-entry').filter({ hasText: bookmark.documentPath })
    .filter({ hasText: bookmark.note.trim() ? bookmark.note.trim().split('\n')[0] : '无备注' });
}

async function visit(bookmark, file, keyboard = false) {
  const entry = listEntry(bookmark);
  if (keyboard) {
    await entry.focus();
    await page.keyboard.press('Enter');
  } else await entry.click();
  await page.getByRole('heading', { name: file, exact: true }).waitFor();
  await page.locator(`#bookmark-${bookmark.id}:focus`).waitFor();
  assert.equal(await row(bookmark.id).locator('.bookmark-note').textContent(), bookmark.note || '无备注');
  assert.equal(await row(bookmark.id).locator('.bookmark-note b').count(), 0);
  assert.equal(await row(bookmark.id).evaluate(element => element.closest('.document-block').id), sharedBlockId);
  assert.equal(await row(bookmark.id).getByText('回访书签', { exact: true }).count(), 1);
}

async function unlock() {
  if (!locker) return;
  const exited = once(locker, 'exit');
  locker.stdin.end('\n');
  await exited;
  locker = undefined;
}

try {
  await session();
  assert.ok(await block().locator('.source-pane').count());
  await draft(note, page, true);
  await save();
  await draft('');
  await save();
  await openDocument('src/service.mjs');
  assert.equal(await block().locator('.source-pane').count(), 0);
  await draft(pureNote);
  await save();
  const [first, blank, pure] = await disk();
  assert.deepEqual([first.documentPath, blank.note, pure.documentPath], [rulesPath, '', servicePath]);
  assert.equal(first.note, note);
  assert.equal(new Set([first.id, blank.id, pure.id]).size, 3);
  report.checks.push('comparison and pure block creation, duplicate block identity, raw note, keyboard');

  await restart();
  await openBookmarks();
  await visit(first, 'src/rules.mjs', true);
  assert.ok(await page.locator('#reading').evaluate(element => element.scrollTop > 0));
  await page.screenshot({ path: path.join(run, 'revisit.png') });
  await openBookmarks();
  await visit(blank, 'src/rules.mjs');
  await openBookmarks();
  await visit(pure, 'src/service.mjs');
  await openBookmarks();
  await visit(first, 'src/rules.mjs');
  await button('编辑备注', row(first.id)).click();
  const edited = { ...first, note: '改过的备注' };
  await field().fill(edited.note);
  await save();
  await button('移除书签', row(blank.id)).click();
  await block().getByText('书签已移除', { exact: true }).waitFor();
  assert.deepEqual(await disk(), [edited, pure]);
  await restart();
  await openBookmarks();
  await visit(edited, 'src/rules.mjs');
  report.checks.push('service and browser restart, same- and cross-file scroll and focus, edit/remove restart');

  const original = await readFile(fixture.service, 'utf8');
  const pureBlockStart = original.indexOf(`<!-- aftertaste:block id=${sharedBlockId} -->`);
  const firstBlockStart = original.indexOf('<!-- aftertaste:block');
  assert.ok(pureBlockStart > firstBlockStart && firstBlockStart > 0);
  const rewritten = original.slice(0, firstBlockStart) +
    original.slice(pureBlockStart).replace('从数量规则到订单', '改写后的订单讲解') + '\n' +
    original.slice(firstBlockStart, pureBlockStart);
  await writeFile(fixture.service, rewritten);
  await openBookmarks();
  await visit(pure, 'src/service.mjs');
  await block().getByRole('heading', { name: '改写后的订单讲解' }).waitFor();
  const beforeUnavailable = await raw();
  for (const [breakTarget, restore] of [
    [() => rename(fixture.service, fixture.service + '.hidden'), () => rename(fixture.service + '.hidden', fixture.service)],
    [() => writeFile(fixture.service, 'broken markdown'), () => writeFile(fixture.service, rewritten)],
    [() => writeFile(fixture.service, rewritten.replace(sharedBlockId, 'other000')), () => writeFile(fixture.service, rewritten)],
  ]) {
    await breakTarget();
    try {
      await openBookmarks();
      await listEntry(pure).click();
      const unavailable = page.getByRole('status').filter({ hasText: '暂时无法定位这个块' });
      await unavailable.waitFor();
      await unavailable.evaluate(assertFocused);
      assert.match(await unavailable.innerText(), /service\.mjs\.md.*visit001/s);
      assert.match(await unavailable.innerText(), /订单说明中的相同块 ID/);
      assert.equal(await raw(), beforeUnavailable);
      await page.screenshot({ path: path.join(run, 'unavailable.png') });
    } finally { await restore(); }
    await visit(pure, 'src/service.mjs');
  }
  report.checks.push('rewritten and reordered ID, missing, invalid and absent block, preserved disk, restored revisit');

  if (engine === 'edge' && process.platform === 'win32') {
    await openDocument('src/rules.mjs');
    const before = await raw();
    locker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'try { $f = [IO.File]::Open($env:D019_LOCK_FILE, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); [Console]::WriteLine("LOCKED"); [void][Console]::ReadLine() } finally { if ($f) { $f.Close() } }'],
    { env: { ...process.env, D019_LOCK_FILE: fixture.bookmarks }, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
    const output = createInterface({ input: locker.stdout });
    assert.deepEqual(await once(output, 'line', { signal: AbortSignal.timeout(12000) }), ['LOCKED']);
    await button('编辑备注', row(first.id)).click();
    const pending = '写失败时保留这段输入';
    await field().fill(pending);
    const failed = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith('/api/bookmarks'));
    await button('保存书签', block()).click();
    const response = await failed;
    assert.equal(response.status(), 422);
    assert.equal((await response.json()).error.code, 'BOOKMARK_WRITE_FAILED');
    await block().getByRole('alert').filter({ hasText: '书签未保存' }).waitFor();
    assert.equal(await field().inputValue(), pending);
    assert.equal(await raw(), before);
    assert.ok((await readdir(path.dirname(fixture.bookmarks))).every(name => !name.startsWith('.aftertaste-bookmarks-')));
    await page.screenshot({ path: path.join(run, 'write-failed.png') });
    await unlock();
    const refreshed = page.waitForResponse(response => response.url().includes('/api/document?path=') && response.ok());
    await button('刷新资料').click();
    await refreshed;
    await block().waitFor();
    assert.equal(await field().count(), 1, 'document refresh keeps the failed draft open');
    assert.equal(await field().inputValue(), pending);
    await block().getByRole('alert').filter({ hasText: '书签未保存' }).waitFor();
    await openDocument('src/service.mjs');
    assert.equal(await field().count(), 0, 'same block ID in another document does not share the draft');
    await openDocument('src/rules.mjs');
    assert.equal(await field().inputValue(), pending);
    await save();
    assert.equal((await disk()).find(item => item.id === first.id).note, pending);
    report.checks.push('real Windows replacement denied, original kept, draft survives refresh and remains scoped by document, retry saved');
  }

  await openDocument('src/rules.mjs');
  const other = await context.newPage();
  await other.goto(reader.url);
  await block(other).waitFor();
  await draft('页面一并发新建');
  await draft('页面二并发新建', other);
  await Promise.all([save(), save(other)]);
  assert.deepEqual(new Set((await disk()).slice(-2).map(item => item.note)), new Set(['页面一并发新建', '页面二并发新建']));
  await other.close();
  await restart();
  await openBookmarks();
  const list = page.locator('#bookmarks .project-bookmarks');
  await list.getByText('页面一并发新建', { exact: true }).waitFor();
  await list.getByText('页面二并发新建', { exact: true }).waitFor();

  await page.locator('.language-control select').selectOption('en');
  await button('Bookmarks').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(run, 'mobile-list.png'), fullPage: true });
  report.checks.push('two real tabs merge, restart, English and 390px layout');
  assert.deepEqual(report.pageErrors, []);
  report.passed = true;
  console.log(JSON.stringify(report));
} finally {
  if (locker && locker.exitCode === null) await unlock();
  await context?.close();
  await reader?.server.close();
  await browser.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
}
