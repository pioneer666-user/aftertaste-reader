import { editorText, newQuickNote } from './note-controls.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmod, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { createLoopReaderProject } from '../fixtures/loop-reader.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D035');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'workbench-'));
const project = path.join(run, 'project');
const data = path.join(project, 'docs/aftertaste');
const input = process.env.AFTERTASTE_D035_INPUT;
if (input) await cp(path.resolve(input), project, { recursive: true, errorOnExist: true, force: false });
else {
  await createLoopReaderProject(project);
  await cp(new URL('../fixtures/page-preview/', import.meta.url), data, { recursive: true });
}
const file = path.join(data, 'notes.json');
const records = JSON.parse(await readFile(file, 'utf8'));
const order = records.notes.find(item => item.body.startsWith('数量无效时，订单去哪了？'));
const filler = Array.from({ length: 30 }, (_, i) => `第 ${i + 1} 段。回看边界规则与订单的关系。`).join('\n\n');
for (let i = 1; i <= 24; i++) {
  records.notes.push({ id: randomUUID(), revision: randomUUID(), body: '复习问题 ' + i, tags: ['回访'] });
}
const missing = '[失效的数量引用](<#aftertaste-block/docs%2Faftertaste%2Fcurrent%2Fsrc%2Frules.mjs.md/review01>)';
records.notes.push({ ...order, id: randomUUID(), revision: randomUUID(), body: '# 订单长笔记\n\n' + filler + '\n\n' + order.body + '\n\n' + missing + '\n\n' + filler });
await writeFile(file, JSON.stringify(records));
const report = { run, input, build, checks: [] };
const reader = await startReader(project, 0);
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(7000);
  const writes = [];
  page.on('request', request => { if (request.method() === 'PUT') writes.push(request.url()); });
  const notes = page.locator('#notes');
  const markdown = notes.locator('.note-preview');
  const aside = notes.locator('.record-navigation');
  const back = () => page.locator('[data-history=back]').click();
  const button = (scope, name) => scope.getByRole('button', { name, exact: true });
  const toggle = page.locator('.reader-navigation-toggle');
  const link = markdown.getByRole('link');
  await page.goto(reader.url);
  await page.locator('[data-page=notes]').click();
  await markdown.getByText('数量无效时，订单去哪了？', { exact: true }).waitFor();
  assert.equal(await notes.locator('#note-body').count(), 0);
  const search = aside.getByRole('searchbox');
  await search.fill('绝无此签');
  await aside.getByText('没有匹配的标签。').waitFor();
  await button(aside, '清除筛选').click();
  await search.fill('回');
  await aside.locator('select').selectOption('回访');
  await page.screenshot({ path: path.join(run, 'read.png') });
  for (const [i, name] of ['src/rules.mjs', 'src/service.mjs'].entries()) {
    await link.nth(i).press('Enter');
    await page.locator('#reading').getByRole('heading', { name, exact: true }).waitFor();
    await back();
    await link.nth(i).locator(':scope:focus').waitFor();
    assert.equal(await aside.locator('select').inputValue(), '回访');
  }
  report.checks.push('两处引用分别打开规则、服务文件，后退恢复回访标签和原引用焦点');
  const longNote = aside.locator('button').filter({ hasText: '订单长笔记' });
  await longNote.click();
  await link.first().evaluate(a => a.scrollIntoView({ block: 'center' }));
  const listTop = await aside.evaluate(el => el.scrollTop);
  const before = await link.first().boundingBox();
  assert.ok(listTop > 0 && before.y > 250 && before.y < 650);
  await link.first().click();
  await page.locator('#x4y6az2y:focus').waitFor();
  await back();
  await link.first().locator(':scope:focus').waitFor();
  const after = await link.first().boundingBox();
  assert.ok(Math.abs(after.y - before.y) < 2);
  assert.equal(await aside.evaluate(el => el.scrollTop), listTop);
  await page.keyboard.press('Tab');
  await link.nth(1).locator(':scope:focus').waitFor();
  report.longReturn = { before: before.y, after: after.y, listTop };
  const broken = markdown.getByRole('link', { name: '失效的数量引用' });
  await broken.evaluate(a => a.scrollIntoView({ block: 'center' }));
  await broken.press('Enter');
  const alert = notes.locator('.note-visit-problem:focus');
  await alert.waitFor();
  const box = await alert.boundingBox(), pane = await notes.locator('.record-detail').boundingBox();
  assert.ok(box.y >= pane.y && box.y + box.height <= pane.y + pane.height, 'failure reason is visible inside the reading pane');
  assert.match(await alert.innerText(), /review01/u);
  await link.first().press('Enter');
  await page.locator('#x4y6az2y:focus').waitFor();
  await back();
  await link.first().locator(':scope:focus').waitFor();
  report.invalidLink = { top: box.y, bottom: box.y + box.height, paneTop: pane.y };
  assert.deepEqual(writes, []);
  report.checks.push('长文中段返回后原句、非零列表位置及 Tab 续读，浏览期间零 PUT');
  await aside.locator('.note-list button').filter({ hasText: '数量无效时，订单去哪了？' }).click();
  await button(notes, '编辑').click();
  const inputBox = notes.locator('#note-body');
  const left = await inputBox.boundingBox(), right = await markdown.boundingBox();
  assert.ok(left.x + left.width <= right.x);
  await page.screenshot({ path: path.join(run, 'edit.png') });
  const originalBody = await editorText(inputBox);
  const originalFile = await readFile(file, 'utf8');
  const trigger = page.locator('.new-note'), quick = page.locator('#quick-note'), quickBody = quick.getByRole('textbox', {name:'笔记正文'});
  await newQuickNote(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'shou', selectionStart: 4, selectionEnd: 4 });
  await page.waitForTimeout(450);
  assert.equal(writes.length, 0);
  const response = () => page.waitForResponse(res => res.request().method() === 'PUT' && res.url().endsWith('/api/notes'));
  if (process.platform === 'win32') await chmod(file, 0o444);
  try {
    const attempt = response();
    await cdp.send('Input.insertText', { text: '随手记' });
    await quickBody.press('Escape');
    const result = await attempt;
    if (process.platform === 'win32') {
      assert.equal(result.status(), 422);
      assert.equal((await result.json()).error.code, 'NOTE_WRITE_FAILED');
      assert.equal(await readFile(file, 'utf8'), originalFile);
      await trigger.click();
      await quick.locator('.quick-list button').filter({hasText:'随手记'}).click();
      await quick.getByRole('alert').waitFor();
      assert.equal(await editorText(quickBody), '随手记');
      await page.screenshot({ path: path.join(run, 'quick-note-failure.png') });
    } else assert.equal(result.status(), 200);
  } finally {
    if (process.platform === 'win32') await chmod(file, 0o644);
    await cdp.detach();
  }
  if (process.platform === 'win32') {
    await button(quick, '重试保存').click();
    await quick.getByRole('status').filter({ hasText: /^已保存$/u }).waitFor();
    await quickBody.fill('');
    await quick.getByRole('status').filter({ hasText: /^已保存$/u }).waitFor();
    assert.equal(JSON.parse(await readFile(file, 'utf8')).notes.at(-1).body, '');
    await quickBody.press('Control+z');
    await quick.getByRole('status').filter({ hasText: /^已保存$/u }).waitFor();
    await quickBody.press('Escape');
  }
  const written = JSON.parse(await readFile(file, 'utf8')).notes;
  assert.deepEqual(written.slice(0, -1), JSON.parse(originalFile).notes);
  assert.equal(written.at(-1).body, '随手记');
  assert.equal(await editorText(inputBox), originalBody);
  report.checks.push('组合输入未提交时零写入，提交立即关面板后原工作台仍在编辑；重读新笔记恰好一篇');

  await button(notes, '完成').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await toggle.press('Enter');
  await longNote.press('Enter');
  assert.equal(await aside.isVisible(), false);
  await button(notes, '编辑').click();
  await inputBox.fill('窄窗写入并预览');
  await button(notes, '预览').click();
  await markdown.getByText('窄窗写入并预览').waitFor();
  await notes.locator('.note-view-switch').getByRole('button', { name: '编辑' }).click();
  assert.equal(await editorText(inputBox), '窄窗写入并预览');
  await notes.getByRole('status').filter({ hasText: /^已保存$/ }).waitFor();
  await button(notes, '完成').click();
  await markdown.getByText('窄窗写入并预览').waitFor();
  assert.ok(JSON.parse(await readFile(file, 'utf8')).notes.some(note => note.body === '窄窗写入并预览'));
  await page.screenshot({ path: path.join(run, 'narrow.png') });
  report.checks.push('桌面左右并排，窄窗键盘选择整宽详情、编辑预览切换、完成并读回落盘内容');
  await page.locator('.language-control select').selectOption('en');
  for (const [key, reason] of [['bookmarks', '这个边界例子讲得巧'], ['marks', '为什么要先校验数量？']]) {
    await page.locator('.app-page-menu-toggle').click();
    await page.locator('[data-page=' + key + ']').click();
    const panel = page.locator('#' + key);
    await toggle.press('Enter');
    const difficult = panel.getByRole('button', { name: 'Not understood', exact: true });
    if (key === 'marks') await difficult.click();
    const entry = panel.locator('.bookmark-entry').filter({ hasText: reason });
    await entry.press('Enter');
    assert.equal(await panel.locator('.record-navigation').isVisible(), false);
    const saved = key === 'bookmarks' ? JSON.parse(await readFile(path.join(data, 'bookmarks.json'), 'utf8')).bookmarks.map(item => item.note)
      : JSON.parse(await readFile(path.join(data, 'understanding-marks.json'), 'utf8')).marks.map(item => item.annotation);
    assert.equal(await panel.locator('.record-prose').innerText(), saved.find(text => text?.startsWith(reason)));
    await toggle.press('Enter');
    await entry.locator('..').locator('.record-visit').press('Enter');
    const sourceTarget = key === 'marks' ? '#mark-x4y6az2y:focus' : '#bookmark-892cf00e-fab8-4d6d-a307-74e0c4bbb89c:focus';
    await page.locator(sourceTarget).waitFor();
    await back();
    await entry.and(panel.locator('[aria-current="true"]')).waitFor();
    if (key === 'marks') assert.equal(await difficult.getAttribute('aria-pressed'), 'true');
  }
  report.checks.push('英文窄窗用键盘在书签和不理解标注里读原话，列表一步回原块后返回所选条目');
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await browser?.close();
  await reader.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
}
