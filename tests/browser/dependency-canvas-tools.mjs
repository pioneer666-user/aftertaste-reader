import { chooseLoop } from './loop-controls.mjs';
import assert from 'node:assert/strict';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build } from '../fixtures/dependency-canvas.mjs';
import { preparePolishProject } from '../fixtures/dependency-canvas-polish.mjs';
import { readJSON, rules, service, writeJSON } from '../fixtures/dependency-legends.mjs';
import { orderId } from '../fixtures/loop-authoring.mjs';
import { dependencySaved } from './dependency-controls.mjs';

const { channel, run, project, source, disk } = await preparePolishProject('tools');
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const desktop = { width: 1440, height: 900 };
const report = { channel, source, project, run, os: release(), checks: [], errors: [] };
const reader = await startReader(project, 0);
const layoutRoute = '/api/dependency-layout';
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const near = (value, expected, tolerance = 1) => assert.ok(Math.abs(value - expected) <= tolerance,
  `expected ${value} within ${tolerance} of ${expected}`);
let browser, page;

try {
  browser = channel === 'firefox' ? await firefox.launch() :
    await chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel });
  report.version = browser.version();
  page = await browser.newPage({ viewport: desktop });
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => report.errors.push(error.message));
  const canvas = page.locator('#canvas-reading');
  const area = canvas.locator('.graph-area');
  const map = canvas.locator('.dependency-minimap');
  const frame = map.locator('.minimap-view');
  const hand = button(canvas, '抓手工具'), select = button(canvas, '选择工具');
  const card = key => canvas.locator(`[data-file="${key}"]`);
  const view = () => canvas.locator('.vue-flow__transformationpane').evaluate(el => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, zoom: m.a };
  });
  const screenshot = async name => {
    if (channel === 'edge') await page.screenshot({ path: path.join(run, name + '.png') });
  };
  async function tool(name) {
    await canvas.locator(`[data-tool="${name}"]`).waitFor();
    assert.equal(await (name === 'hand' ? hand : select).getAttribute('aria-pressed'), 'true');
    assert.equal(await (name === 'hand' ? select : hand).getAttribute('aria-pressed'), 'false');
    const cursor = await area.locator('.vue-flow__pane').evaluate(el => getComputedStyle(el).cursor);
    assert.ok(name === 'hand' ? ['grab', 'grabbing'].includes(cursor) : cursor === 'crosshair', cursor);
  }
  async function saved(action, route = layoutRoute) {
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith(route) &&
      r.request().method() === 'PUT', { timeout: 8000 }), action()]);
    assert.equal(response.status(), 200, await response.text());
    if (route !== layoutRoute) return response.json();
    await dependencySaved(canvas);
    const file = await readJSON(disk);
    assert.equal(file.revision, (await response.json()).revision);
    return file;
  }
  async function drag(from, to, midway) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    try {
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
      if (midway) await midway();
      await page.mouse.move(to.x, to.y, { steps: 6 });
    } finally { await page.mouse.up(); }
  }
  async function mapSync() {
    const v = await view();
    const pane = await area.locator('.vue-flow').boundingBox();
    const r = await frame.evaluate(el => ({ x: el.x.baseVal.value, y: el.y.baseVal.value,
      width: el.width.baseVal.value, height: el.height.baseVal.value }));
    near(r.x * v.zoom, -v.x);
    near(r.y * v.zoom, -v.y);
    near(r.width * v.zoom, pane.width);
    near(r.height * v.zoom, pane.height);
  }
  async function open() {
    await page.goto(reader.url);
    await page.locator('header [data-page="canvas"]:visible').click();
    await dependencySaved(canvas);
    await canvas.locator('button[aria-label="抓手工具"]:enabled').waitFor();
    await card(service).waitFor();
  }

  const seed = await readJSON(disk);
  await open();
  assert.equal(await canvas.locator('output').innerText(), '79%');
  await tool('hand');
  await mapSync();
  assert.deepEqual(await readJSON(disk), seed);
  const startView = await view();
  const group = canvas.locator('.group-frame').filter({ has: button(page, '订单处理') });
  async function reverseBox(releaseControl) {
    const endCard = await card(service).boundingBox(), startCard = await card(rules).boundingBox();
    const from = { x: Math.ceil(endCard.x + endCard.width + 5), y: Math.ceil(endCard.y + endCard.height + 5) };
    const to = { x: Math.floor(startCard.x - 5), y: Math.floor(startCard.y - 5) };
    const bounds = await group.boundingBox();
    assert.ok(from.x < bounds.x + bounds.width && from.y < bounds.y + bounds.height);
    assert.ok(await page.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('.file-node, .group-handle'), from));
    await drag(from, to, async () => {
      await canvas.locator('.canvas-selection-rect').waitFor();
      if (releaseControl) await page.keyboard.up('Control');
      await tool('select');
    });
    const picked = await canvas.locator('[data-box-selected="true"]').evaluateAll(els => els.map(el => el.dataset.file));
    assert.deepEqual(picked.sort(), [rules, service].sort());
    const floating = await button(canvas, '分组').boundingBox();
    assert.ok(floating && Math.abs(floating.x - to.x) < 40 && Math.abs(floating.y - to.y) < 40);
  }

  await area.focus();
  await page.keyboard.down('Control');
  await tool('select');
  await reverseBox(true);
  await tool('hand');
  assert.deepEqual(await view(), startView);
  await page.keyboard.press('Control+g');
  const input = canvas.locator('#canvas-selection-name');
  await input.fill('旧组名');
  await input.press('Control+a');
  await page.keyboard.insertText('新组名');
  assert.equal(await input.inputValue(), '新组名');
  await input.press('Escape');
  assert.deepEqual(await readJSON(disk), seed);

  const blank = { x: 400, y: 235 }, to = { x: 438, y: 258 };
  const panned = await saved(() => drag(blank, to));
  near(panned.layout.viewport.x - seed.layout.viewport.x, to.x - blank.x);
  near(panned.layout.viewport.y - seed.layout.viewport.y, to.y - blank.y);
  await mapSync();
  await select.press('Enter');
  await tool('select');
  await page.keyboard.down('Control');
  await tool('hand');
  const reversed = await saved(() => drag(to, blank, async () => {
    await page.keyboard.up('Control');
    await tool('hand');
  }));
  near(reversed.layout.viewport.x, seed.layout.viewport.x);
  near(reversed.layout.viewport.y, seed.layout.viewport.y);
  await tool('select');
  await reverseBox(false);
  await page.keyboard.press('Escape');
  assert.deepEqual(await readJSON(disk), reversed);
  report.checks.push('两种固定工具，按 Ctrl 在组内反向框选或平移，中途松 Ctrl 完成本拖，下一拖回到固定工具。Ctrl+G 命名、Ctrl+A 和取消。');

  await page.keyboard.down('Control');
  await tool('hand');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await tool('select');
  await page.keyboard.up('Control');
  await page.keyboard.down('Control');
  await page.locator('header [data-page="loops"]:visible').click();
  await page.locator('header [data-page="canvas"]:visible').click();
  await tool('select');
  await page.keyboard.up('Control');
  const h = await button(group, '订单处理').boundingBox();
  const origin = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
  const grouped = await saved(() => drag(origin, { x: origin.x + 25, y: origin.y + 18 }));
  const endHandle = await button(group, '订单处理').boundingBox();
  const dx = endHandle.x - h.x, dy = endHandle.y - h.y;
  assert.ok(dx > 18 && dy > 12, 'the group handle moved past the drag threshold');
  for (const [id, previous] of Object.entries(reversed.layout.positions)) {
    const point = grouped.layout.positions[id];
    if (grouped.layout.groups[0].members.includes(id)) {
      near((point.x - previous.x) * grouped.layout.viewport.zoom, dx);
      near((point.y - previous.y) * grouped.layout.viewport.zoom, dy);
    } else assert.deepEqual(point, previous);
  }
  report.checks.push('窗口 blur 事件和实际切页恢复固定工具。选择工具下拖组名，只移动显式成员。');

  const target = await frame.evaluate(el => {
    const r = el.getBoundingClientRect();
    const x = Math.round(r.left + r.width * .31), y = Math.round(r.top + r.height * .48);
    const p = new DOMPoint(x, y).matrixTransform(el.getScreenCTM().inverse());
    return { x, y, worldX: p.x, worldY: p.y };
  });
  const centered = await saved(() => page.mouse.click(target.x, target.y));
  const pane = await area.locator('.vue-flow').boundingBox();
  near(centered.layout.viewport.x + target.worldX * centered.layout.viewport.zoom, pane.width / 2, 2);
  near(centered.layout.viewport.y + target.worldY * centered.layout.viewport.zoom, pane.height / 2, 2);
  const frameData = await frame.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), scale: el.getScreenCTM().a };
  });
  const moved = await saved(() => drag(frameData, { x: frameData.x + 9, y: frameData.y - 4 }));
  near(moved.layout.viewport.x - centered.layout.viewport.x, -9 / frameData.scale * moved.layout.viewport.zoom, 2);
  near(moved.layout.viewport.y - centered.layout.viewport.y, 4 / frameData.scale * moved.layout.viewport.zoom, 2);
  assert.deepEqual(moved.layout.positions, grouped.layout.positions);
  await mapSync();
  await screenshot('map-after-navigation');
  await page.setViewportSize({ width: 390, height: 844 });
  await button(canvas, '小地图').click();
  await map.waitFor({ state: 'detached' });
  await hand.click();
  await tool('hand');
  await select.click();
  await tool('select');
  const final = await saved(() => button(canvas, '放大画布').click());
  assert.ok(final.layout.viewport.zoom > moved.layout.viewport.zoom);
  assert.deepEqual(final.layout.positions, moved.layout.positions);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot('narrow-controls');
  await button(canvas, '小地图').click();
  await mapSync();
  assert.deepEqual(await readJSON(disk), final);
  report.checks.push('从小地图定位和拖视野框，主图平移及缩放同步到地图；390px 实点工具、缩放与地图收放，坐标保持。');

  await page.setViewportSize(desktop);
  await page.locator('header [data-page="loops"]:visible').click();
  await chooseLoop(page, orderId);
  const loop = page.locator('#loop-canvas-' + orderId + '-reading');
  await loop.locator('[data-step="check"]').click();
  await loop.locator('.loop-reader-toggle').click();
  await loop.locator('[data-reading-step="check"]').waitFor();
  const ack = await saved(() => button(loop, '缩小画布').click(), '/api/loops/' + orderId + '/layout');
  const loopDisk = path.join(path.dirname(disk), 'loops', orderId, 'layout.json');
  assert.equal((await readJSON(loopDisk)).revision, ack.revision);
  assert.deepEqual(await readJSON(disk), final);
  await open();
  await tool('hand');
  await mapSync();
  const restored = await view();
  near(restored.x, final.layout.viewport.x, .01);
  near(restored.y, final.layout.viewport.y, .01);
  near(restored.zoom, final.layout.viewport.zoom, .00001);
  const positions = await canvas.locator('.file-node').evaluateAll(nodes => Object.fromEntries(nodes.map(node => {
    const m = new DOMMatrixReadOnly(getComputedStyle(node.closest('.vue-flow__node')).transform);
    return [node.dataset.file ?? 'legend:' + node.dataset.legend, { x: m.e, y: m.f }];
  })));
  assert.deepEqual(Object.keys(positions).sort(), Object.keys(final.layout.positions).sort());
  for (const [id, point] of Object.entries(positions)) {
    near(point.x, final.layout.positions[id].x, .01);
    near(point.y, final.layout.positions[id].y, .01);
  }
  assert.deepEqual(report.errors, []);
  report.checks.push('闭环步骤可选择并写入独立视野；重开依赖图恢复所有坐标和视野，默认工具为抓手。');
} catch (error) {
  report.failure = error.stack;
  await page?.screenshot({ path: path.join(run, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await reader.server.close();
  await writeJSON(path.join(run, 'report.json'), report);
  console.log(JSON.stringify(report));
}
