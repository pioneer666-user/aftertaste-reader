import { startTestReader, openReader } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { createLoopReaderProject } from '../fixtures/loop-reader.mjs';

const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D039');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'margin-'));
const project = path.join(run, 'project');
const data = path.join(project, 'docs/aftertaste');
if (process.env.AFTERTASTE_READER_INPUT) await cp(path.resolve(process.env.AFTERTASTE_READER_INPUT), project, { recursive: true });
else {
  await createLoopReaderProject(project);
  await cp(new URL('../fixtures/page-preview/', import.meta.url), data, { recursive: true });
}
// The empty-rail visibility check needs an unrecorded first block in this copy.
const bookmarksFile = path.join(data, 'bookmarks.json');
const initial = JSON.parse(await readFile(bookmarksFile, 'utf8'));
initial.bookmarks = initial.bookmarks.filter(item => item.blockId !== 'zhidif44');
await writeFile(bookmarksFile, JSON.stringify(initial));
const marksFile = path.join(data, 'understanding-marks.json');
const marks = JSON.parse(await readFile(marksFile, 'utf8'));
marks.marks = marks.marks.filter(item => item.blockId !== 'zhidif44');
await writeFile(marksFile, JSON.stringify(marks));
const service = path.join(data, 'current/src/service.mjs.md');
const original = await readFile(service, 'utf8');
await writeFile(service, original.replace(/(<!-- aftertaste:block id=cj9208pf[^>]*-->)/u,
  '$1\n\n' + '这是一段用于核对长块中段入口的讲解。\n\n'.repeat(60)) + '\n<!-- aftertaste:block id=touch039 -->\n短块。\n<!-- aftertaste:end -->\n');
const reader = await startTestReader(project, 0);
const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
const report = { run, build, engine, geometry: {}, visits: [], checks: [] };
let browser;
try {
  browser = engine === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: engine === 'edge' ? 'msedge' : 'chrome' });
  report.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(6000);
  const writes = [];
  page.on('request', request => { if (request.method() === 'PUT') writes.push(request.url()); });
  await openReader(page, reader.url);
  const file = name => page.locator(`#reader-navigation button[title="${name}"]`);
  await file('src/service.mjs').click();
  const first = page.locator('#zhidif44');
  const bookmark = first.locator('[data-kind=bookmarks]');
  const mark = first.locator('[data-kind=mark]');
  const panel = first.getByRole('dialog');
  const button = (name, scope = panel) => scope.getByRole('button', { name, exact: true });
  const geometry = () => first.evaluate(el => {
    const phrase = '服务随后忽略这个返回值';
    const walker = document.createTreeWalker(el.querySelector('.explanation-text'), NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const offset = node.textContent.indexOf(phrase);
      if (offset < 0) continue;
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + phrase.length);
      return { lines: [...range.getClientRects()].map(r => [r.x,r.y,r.width,r.height]), scroll: el.closest('main').scrollTop,
        next: el.nextElementSibling.getBoundingClientRect().top };
    }
    throw new Error('Missing trial sentence');
  });
  await first.waitFor();
  await page.mouse.move(1,1);
  report.geometry.read = await geometry();
  const stationary = async stage => {
    report.geometry[stage] = await geometry();
    assert.deepEqual(report.geometry[stage], report.geometry.read, stage);
  };
  assert.equal(await bookmark.evaluate(el => getComputedStyle(el).opacity), '0');
  await first.locator('.explanation-text').hover();
  await stationary('hover');
  assert.equal(await bookmark.evaluate(el => getComputedStyle(el).opacity), '1');
  await bookmark.click();
  await panel.getByRole('textbox').waitFor();
  await stationary('bookmark');
  await mark.click();
  await stationary('mark');
  await button('编辑批注').click();
  const text = '服务为什么忽略返回值？\n审计记录去了哪里？';
  await panel.getByRole('textbox').fill(text);
  await stationary('draft');
  await page.keyboard.press('Escape');
  assert.ok(await mark.evaluate(el => document.activeElement === el));
  await mark.press('Enter');
  assert.equal(await panel.getByRole('textbox').inputValue(), text);
  assert.equal(writes.length, 0);
  await button('保存批注').click();
  await panel.getByText('批注已保存', { exact: true }).waitFor();
  await stationary('save');
  await page.screenshot({ path: path.join(run,'desktop-open.png') });
  await button('关闭').click();
  await page.mouse.move(1,1);
  await bookmark.focus();
  await page.keyboard.press('Tab');
  assert.ok(await mark.evaluate(el => document.activeElement === el));
  assert.ok(await mark.locator('.entry-tip').isVisible());
  await page.locator('.app-header button:enabled').first().focus();
  assert.match(await mark.getAttribute('aria-label'), /未标记.*有批注/u);
  assert.equal(await mark.evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await mark.locator('svg').count(), 1);
  await stationary('close');
  await page.screenshot({ path: path.join(run,'annotation-only.png') });
  await mark.click();
  for (const [status, glyph, color] of [['不理解','?','rgb(153, 53, 47)'], ['已理解','✓','rgb(25, 112, 71)'], ['未标记','○','rgb(82, 100, 91)']]) {
    await button(status).click();
    await page.waitForFunction(s => document.querySelector('#zhidif44 [data-kind=mark]').ariaLabel.includes(s), status);
    const symbol = button(status).locator('.state-symbol');
    assert.equal(await symbol.innerText(), glyph);
    assert.equal(await symbol.evaluate(el => getComputedStyle(el).color), color);
    await panel.getByText(text, { exact: true }).waitFor();
  }
  await page.emulateMedia({ forcedColors: 'active' });
  assert.deepEqual(await panel.locator('.state-symbol').allTextContents(), ['○','✓','?']);
  await page.screenshot({ path: path.join(run,'forced-colors.png') });
  await page.emulateMedia({ forcedColors: 'none' });
  await first.locator('.source-pane').click();
  await panel.waitFor({ state: 'hidden' });
  const long = page.locator('#cj9208pf');
  await long.evaluate(el => el.querySelectorAll('.explanation-text p')[30].scrollIntoView({block:'center'}));
  const longMark = long.locator('[data-kind=mark]');
  await longMark.hover();
  const longPos = await longMark.boundingBox();
  assert.ok(longPos.y >= 48 && longPos.y < 300);
  const scroll = await page.locator('#reading').evaluate(el => el.scrollTop);
  await longMark.click();
  await long.getByRole('dialog').getByText('理解标注', {exact:true}).waitFor();
  assert.equal(await page.locator('#reading').evaluate(el => el.scrollTop), scroll);
  await page.keyboard.press('Escape');
  report.checks.push('1440×900 同句逐行、滚动与下一块，草稿零写入，三态与仅批注，键盘、点外和长块中段');
  await file('src/rules.mjs').click();
  const rules = page.locator('#x4y6az2y');
  await rules.locator('[data-kind=bookmarks]').click();
  await button('再加一条',rules).click();
  await rules.getByRole('textbox').fill('第二条收藏：复查人数两个端点。');
  await button('保存书签',rules).click();
  await rules.getByText('书签已保存',{exact:true}).waitFor();
  const disk = JSON.parse(await readFile(path.join(data,'bookmarks.json'),'utf8'));
  const records = disk.bookmarks.filter(item => item.blockId === 'x4y6az2y');
  assert.ok(records.length >= 2);
  for (const [index, record] of [records[0],records.at(-1)].entries()) {
    await button('书签',page.locator('.app-header')).click();
    const entry = page.locator('#bookmarks .bookmark-entry').filter({ hasText: record.note });
    await entry.click();
    if (index) await button('回原文',page.locator('#bookmarks .record-detail')).click();
    else await entry.locator('..').locator('.record-visit').click();
    const row = page.locator(`#bookmark-${record.id}:focus`);
    assert.equal(await row.locator('.bookmark-note').textContent(),record.note);
    assert.ok(await rules.getByRole('dialog').isVisible());
    report.visits.push({ id: record.id, note: record.note });
    await page.locator('[data-history=back]').click();
    assert.equal(await entry.getAttribute('aria-current'),'true');
  }
  await button('标注',page.locator('.app-header')).click();
  const filter = page.getByRole('group',{name:'筛选标注'}).getByRole('button',{name:'不理解',exact:true});
  await filter.click();
  const question = page.locator('#marks .bookmark-entry').filter({hasText:'为什么要先校验数量？'});
  await question.locator('..').locator('.record-visit').click();
  await page.locator('#mark-x4y6az2y:focus').getByText(/为什么要先校验数量？/u).waitFor();
  await page.locator('[data-history=back]').click();
  assert.equal(await filter.getAttribute('aria-pressed'),'true');
  assert.equal(await question.getAttribute('aria-current'),'true');
  await page.close();
  const touch = await browser.newPage({ viewport:{width:390,height:844}, hasTouch:true });
  await openReader(touch, reader.url);
  await touch.getByRole('button',{name:'展开阅读导航'}).tap();
  await touch.locator('button[title="src/service.mjs"]').tap();
  const empty = touch.locator('#touch039');
  await empty.scrollIntoViewIfNeeded();
  assert.equal(await empty.locator('.recorded').count(), 0);
  for (const item of ['mark','bookmarks']) {
    const entry = empty.locator(`[data-kind=${item}]`);
    const box = await entry.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44);
    assert.equal(await entry.evaluate(el => getComputedStyle(el).opacity),'1');
    await entry.tap();
    const sheet = empty.getByRole('dialog');
    const bounds = await sheet.boundingBox();
    assert.ok(bounds.y > 0 && Math.abs(bounds.y + bounds.height - 844) <= 8);
    await touch.screenshot({path:path.join(run,'touch-'+item+'.png')});
    await sheet.getByRole('button',{name:'关闭'}).tap();
  }
  report.checks.push('同块两条书签分别从列表及详情回访，问题原话、返回选中和筛选，390px 触屏逐项点击和贴底浮层');
} finally {
  await browser?.close();
  await reader.server.close();
  await writeFile(path.join(run,'report.json'), JSON.stringify(report,null,2));
  console.log(run);
}

