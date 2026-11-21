import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { chooseLoop } from './loop-controls.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const root = path.join(repository, '.local/D033');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'panel-'));
const project = path.join(run, 'project');
await cp(process.env.AFTERTASTE_TRIAL_PROJECT ?? path.join(repository, '.local/2026-11-19-page-preview/project'), project, { recursive: true });
const graphDir = path.join(project, 'docs/aftertaste/loops/order-quantity');
const layout = async () => JSON.parse(await readFile(path.join(graphDir, 'layout.json'), 'utf8')).layout;
const content = () => readFile(path.join(graphDir, 'current/loop.json'), 'utf8');
const before = await content();
const graph = JSON.parse(before);
const reader = await startReader(project, 0);
let browser;
const report = { build, run, frames: [], writes: [], errors: [] };
try {
  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 780 } });
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('request', r => { if (r.method() === 'PUT') report.writes.push(new URL(r.url()).pathname); });
  const loop = page.locator('#loop-canvas-order-quantity-reading');
  const node = id => loop.locator('[data-step="' + id + '"]');
  const select = id => loop.locator('[data-relation="' + id + '"]').click();
  const lesson = id => loop.locator('[data-reading-step="' + id + '"]');
  const panel = loop.locator('.canvas-inspector');
  const toggle = loop.locator('.loop-reader-toggle');
  const area = loop.locator('.graph-area');
  const shot = name => page.screenshot({ path: path.join(run, name + '.png') });
  const press = (scope, name) => scope.getByRole('button', { name, exact: true }).press('Enter');
  async function save(action) {
    const [ack] = await Promise.all([page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith('/order-quantity/layout')), action()]);
    assert.equal(ack.status(), 200, await ack.text());
    await loop.locator('[data-state="canvasSaved"]').waitFor({ state: 'attached' });
    return layout();
  }
  async function drag(x, y, dx, dy) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  }
  async function open() {
    await page.goto(reader.url);
    await press(page, '闭环阅读');
    await chooseLoop(page, 'order-quantity');
    await loop.locator('.loop-overview').waitFor();
  }
  await open();
  await save(() => drag(560, 230, 15, 12));
  await save(() => press(loop, '放大画布'));
  await node('check').click();
  await lesson('check').locator('.loop-original summary').click();
  await loop.locator('.loop-source-trigger').click();
  const scroll = await panel.evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
  assert.ok(scroll > 0);
  const readingWrites = report.writes.length;
  await page.evaluate(() => {
    const scope = document.querySelector('#loop-canvas-order-quantity-reading');
    const box = selector => {
      const { x, y, width, height } = scope.querySelector(selector).getBoundingClientRect();
      return [x,y,width,height];
    };
    window.readingFrames = [];
    function sample() {
      window.readingFrames.push({ node: box('[data-id="file:check"]'), map: box('.dependency-minimap'), handle: box('.loop-reader-toggle')[0] });
      window.readingFrame = requestAnimationFrame(sample);
    }
    sample();
  });
  await toggle.press('Enter');
  await panel.waitFor({ state: 'hidden' });
  await page.locator('.loop-source-panel').waitFor({ state: 'hidden' });
  assert.ok(await toggle.evaluate(el => el === document.activeElement));
  assert.ok(await page.evaluate(() => document.elementFromPoint(innerWidth - 90, innerHeight - 160)?.closest('.vue-flow')));
  await toggle.press('Enter');
  await page.locator('.loop-source-floating').waitFor();
  await page.waitForFunction(() => !document.querySelector('.loop-reader-toggle').parentElement.getAnimations().length);
  report.frames = await page.evaluate(() => { cancelAnimationFrame(window.readingFrame); return window.readingFrames; });
  assert.ok(report.frames.some(f => f.handle > report.frames[0].handle + 10 && f.handle < 1380));
  for (const f of report.frames) {
    assert.deepEqual(f.node, report.frames[0].node);
    assert.deepEqual(f.map, report.frames[0].map);
  }
  assert.equal(await panel.evaluate(el => el.scrollTop), scroll);
  await toggle.click();
  await panel.waitFor({ state: 'hidden' });
  assert.deepEqual(await loop.locator('[data-relation]').evaluateAll(els => els.map(el => el.dataset.relation)), ['start','resume','stop']);
  await press(loop, '关系详情');
  for (const e of graph.edges.filter(e => e.to === 'check' || e.from === 'check')) {
    await loop.locator('.loop-relations').getByText(e.reason, { exact: true }).waitFor();
  }
  await press(loop, '收起关系详情');
  await shot('collapsed-branches');
  await select('stop');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await loop.locator('.loop-relations').getByText('路线终点').waitFor();
  await toggle.click();
  await lesson('stop').locator('.loop-step-explanation').getByText(/集合/u).waitFor();
  await page.locator('.loop-source-floating').waitFor();
  await page.getByRole('button', { name: '关闭源码' }).click();
  await page.waitForFunction(() => !document.querySelector('.loop-edge-controls').getAnimations().length);
  await shot('failure-reading');
  await select('check');
  await select('stop');
  await loop.locator('[data-step-nav="previous"]').click();
  await lesson('store').waitFor();
  await loop.locator('.loop-entry').click();
  await lesson('start').waitFor();
  assert.ok(await loop.locator('[data-step-nav="previous"]').isDisabled());
  await toggle.click();
  await loop.locator('.loop-overview-link').click();
  await loop.locator('.loop-overview').waitFor();
  assert.equal(await loop.locator('.loop-relations').count(), 0);
  assert.equal(report.writes.length, readingWrites);

  // Work in the expanded graph with the existing personal group still present.
  await toggle.click();
  await panel.waitFor({ state: 'hidden' });
  await node('check').click();
  const a = await node('start').boundingBox();
  const b = await node('check').boundingBox();
  const x = Math.min(a.x,b.x) - 9, y = Math.min(a.y,b.y) - 9;
  await page.keyboard.down('Control');
  await drag(x,y,Math.max(a.x+a.width,b.x+b.width)+9-x,Math.max(a.y+a.height,b.y+b.height)+9-y);
  await page.keyboard.up('Control');
  await page.keyboard.press('Control+g');
  const name = loop.locator('#canvas-selection-name');
  await name.fill('校验分组');
  const created = await save(() => name.press('Enter'));
  const group = created.groups.find(g => g.name === '校验分组');
  assert.deepEqual([...group.members].sort(), ['check','start']);
  const frame = loop.locator('[data-group="group:' + group.id + '"]');
  const more = frame.locator('.group-more');
  const handle = await frame.locator('.group-handle').boundingBox();
  const moved = await save(() => drag(handle.x + handle.width / 2, handle.y + handle.height / 2, 46, -32));
  assert.notDeepEqual(moved.positions.check, created.positions.check);
  const menu = loop.locator('.loop-group-menu');
  const count = report.writes.length;
  await more.press('Enter');
  await page.keyboard.press('Escape');
  assert.ok(await more.evaluate(el => document.activeElement === el));
  assert.equal(report.writes.length, count);
  await more.click();
  await press(menu, '改名');
  const editor = loop.locator('.loop-edit-panel');
  await editor.getByLabel('组名', { exact: true }).fill('移动后的校验');
  await save(() => press(editor, '应用分组'));
  await more.click();
  await press(menu, '调整成员');
  await editor.locator('input[value="resume"]').check();
  const beforeDissolve = await save(() => press(editor, '应用分组'));
  assert.deepEqual(beforeDissolve.positions, moved.positions);
  assert.ok(beforeDissolve.groups.find(g => g.id === group.id).members.includes('resume'));
  await more.press('Enter');
  await shot('group-before');
  const edges = () => loop.locator('.vue-flow__edge').evaluateAll(els => els.map(el => el.dataset.id).sort());
  const savedEdges = await edges();
  await page.route('**/order-quantity/layout', route => route.fulfill({ status: 500, json: { ok: false, error: { code:'LAYOUT_WRITE_FAILED',context:{} } } }), { times: 1 });
  await menu.getByRole('button', { name: /解散分组.*节点保留在原位/u }).press('Enter');
  await frame.waitFor({ state: 'detached' });
  assert.ok(await area.evaluate(el => el === document.activeElement));
  const after = await save(() => press(loop, '重试保存'));
  assert.deepEqual(after, { ...beforeDissolve, groups: beforeDissolve.groups.filter(g => g.id !== group.id) });
  assert.deepEqual(await edges(), savedEdges);
  await open();
  await toggle.click();
  await panel.waitFor({ state: 'hidden' });
  await node('check').click();
  assert.equal(await frame.count(), 0);
  assert.deepEqual(await layout(), after);
  assert.deepEqual(await edges(), savedEdges);
  for (const [id,point] of Object.entries(after.positions)) {
    const position = await node(id).evaluate(el => { const m = new DOMMatrixReadOnly(getComputedStyle(el.closest('.vue-flow__node')).transform); return {x:m.e,y:m.f}; });
    assert.ok(Math.abs(position.x - point.x) < .001 && Math.abs(position.y - point.y) < .001, 'rendered position for ' + id);
  }
  await shot('group-reopened');
  report.group = { id: group.id, before: beforeDissolve, reopened: after, edges: savedEdges };
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const mobile = await touch.newPage();
  mobile.setDefaultTimeout(8000);
  const longTitle = '订单加入集合并返回给发起这次调用的上游服务'.repeat(3);
  const extraReason = '校验成功时，可以直接阅读集合追加后的结果。';
  await mobile.route('**/api/loops/order-quantity', async route => {
    const response = await route.fetch();
    const body = await response.json();
    const model = body.result.loop;
    model.nodes.find(n => n.id === 'store').title = longTitle;
    model.edges.push({ from: 'check', to: 'store', reason: extraReason });
    await route.fulfill({ response, json: body });
  });
  await mobile.goto(reader.url);
  await mobile.locator('.app-page-menu-toggle').tap();
  await mobile.locator('[data-page="loops"]').tap();
  await chooseLoop(mobile, 'order-quantity');
  await mobile.locator('.loop-entry').tap();
  await mobile.locator('[data-step-nav="next"]').tap();
  const mobileToggle = mobile.locator('.loop-reader-toggle');
  await mobileToggle.tap();
  assert.equal(await mobileToggle.evaluate(el => getComputedStyle(el.parentElement).transitionDuration), '0s');
  const relations = mobile.locator('.loop-relations');
  await relations.getByRole('button', { name: '查看全部关系与理由' }).tap();
  const third = relations.locator('[data-relation="store"]');
  assert.equal(await third.locator('span').innerText(), longTitle);
  assert.equal(await third.locator('small').innerText(), extraReason);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await third.tap();
  assert.equal(await mobileToggle.getAttribute('aria-expanded'), 'false');
  await mobileToggle.tap();
  await mobile.locator('[data-reading-step="store"]').getByRole('heading', { name: longTitle }).waitFor();
  await mobile.screenshot({ path: path.join(run, 'narrow-reading.png') });
  await touch.close();
  assert.equal(await content(), before);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await browser?.close();
  await reader.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({run, frames:report.frames.length, ok: !report.failure}));
}
