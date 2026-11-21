import { chooseLoop } from './loop-controls.mjs';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { readJSON } from '../fixtures/dependency-legends.mjs';
import { orderId, orderInput } from '../fixtures/loop-authoring.mjs';
import { createLoopReaderProject, legendLoopId, loopLayout } from '../fixtures/loop-reader.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
const root = path.join(repository, '.local/' + (process.env.AFTERTASTE_TEST_TASK ?? 'D031'));
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'main-' + channel + '-'));
const project = await createLoopReaderProject(path.join(run, 'project'));
const browser = await (channel === 'firefox' ? firefox.launch() : chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel }));
const report = { run, browser: channel, version: browser.version(), os: release(), node: process.version, commit: project.commit, checks: [] };
const errors = [];
const writes = [];
const title = id => orderInput.nodes.find(node => node.id === id).title;
const lesson = (scope, id) => scope.locator(`[data-reading-step="${id}"]`);
const node = (scope, id) => scope.locator(`[data-step="${id}"]`);
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const sourceTrigger = scope => scope.locator('.loop-source-trigger');
const sourcePanel = page => page.locator('.loop-source-panel');
const position = target => target.evaluate(element => {
  const outer = element.closest('.vue-flow__node');
  const matrix = new DOMMatrixReadOnly(getComputedStyle(outer).transform);
  const viewport = new DOMMatrixReadOnly(getComputedStyle(element.closest('.vue-flow').querySelector('.vue-flow__transformationpane')).transform);
  const map = element.closest('.graph-area').querySelector('.dependency-minimap')?.getBoundingClientRect();
  return { node: [matrix.e, matrix.f], viewport: [viewport.e, viewport.f, viewport.a], map: map && [map.x, map.y, map.width, map.height] };
});

let reader;
let context;
try {
  reader = await startReader(project.projectRoot, 0);
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'PUT' && request.url().includes('/api/loops/')) writes.push(request.url()); });
  await page.goto(reader.url);
  await button(page, '闭环阅读').click();
  await chooseLoop(page, orderId);
  const loop = page.locator('#loop-canvas-' + orderId + '-reading');
  const panel = loop.locator('.canvas-inspector');
  const check = lesson(loop, 'check');
  await node(loop, 'check').click();
  await check.waitFor();
  assert.match(await check.locator('.loop-step-explanation').innerText(), /规则先把值转换成数字，再要求它是 1 到 9 的整数/u, 'step explanation is directly readable');
  assert.equal(await check.locator('.loop-step-explanation code').filter({ hasText: '0' }).count(), 1, 'inline Markdown remains formatted');
  assert.equal(await check.locator('.loop-original').evaluate(element => element.open), false, 'original explanation starts collapsed');
  assert.equal(await lesson(loop, 'start').count(), 0);
  await check.locator('.loop-step-heading').waitFor();
  report.checks.push('direct step explanation and collapsed original block');

  await button(check, title('start')).count().then(count => assert.equal(count, 0), 'no exact-title-only branch ambiguity');
  await node(loop, 'start').click();
  const start = lesson(loop, 'start');
  await start.locator('.loop-step-explanation').filter({ hasText: '接到业务输入和调用者提供的集合' }).waitFor();
  const choice = start.locator('[data-choice="check"]');
  assert.match(await choice.innerText(), /服务把原始数量作为参数交给规则/u);
  await choice.click();
  await check.waitFor();
  assert.equal(await check.locator('.loop-step-heading').evaluate(element => element === document.activeElement), true);
  for (const id of ['resume', 'stop']) {
    const reason = orderInput.edges.find(edge => edge.from === 'check' && edge.to === id).reason;
    assert.match(await check.locator(`[data-choice="${id}"]`).innerText(), new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
  assert.match(await loop.locator('[data-step-nav="previous"]').getAttribute('aria-label'), new RegExp(title('start'), 'u'));
  assert.match(await loop.locator('[data-step-nav="next"]').getAttribute('aria-label'), new RegExp(title('resume'), 'u'));
  report.checks.push('branch target and reason share one row; ordered controls name their destinations');

  const before = await position(node(loop, 'check'));
  const readLayout = () => readFile(loopLayout(project, orderId), 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
  const diskBefore = await readLayout();
  const historyBefore = await button(page, '前进').isDisabled();
  await sourceTrigger(check).hover();
  const preview = sourcePanel(page);
  await preview.waitFor();
  const geometry = await preview.boundingBox();
  const inspector = await panel.boundingBox();
  assert.ok(Math.abs(geometry.x + geometry.width - inspector.x) <= 2, 'source right edge meets inspector left edge');
  await preview.hover();
  const sourceOffsets = await preview.locator('.source-pane').evaluate(element => {
    element.scrollLeft = 20;
    element.scrollTop = 2;
    return [element.scrollLeft, element.scrollTop];
  });
  assert.ok(sourceOffsets.some(Boolean), 'the source pane itself scrolls');
  await page.mouse.move(12, 90);
  await preview.waitFor({ state: 'hidden' });
  await sourceTrigger(check).hover();
  await sourcePanel(page).waitFor();
  await sourceTrigger(check).click();
  assert.equal(await sourceTrigger(check).getAttribute('aria-expanded'), 'true');
  const pinnedOffsets = await sourcePanel(page).locator('.source-pane').evaluate(element => {
    element.scrollLeft = 20;
    element.scrollTop = 2;
    return [element.scrollLeft, element.scrollTop];
  });
  assert.deepEqual(pinnedOffsets, sourceOffsets);
  await check.locator('[data-choice="stop"]').click();
  const stop = lesson(loop, 'stop');
  await stop.locator('.loop-step-explanation').filter({ hasText: '建立订单和追加集合都在这次调用之后' }).waitFor();
  const pinned = sourcePanel(page);
  await pinned.waitFor();
  assert.match(await pinned.innerText(), /src\/rules\.mjs/u);
  assert.match(await pinned.innerText(), /1–7/u);
  assert.deepEqual(await pinned.locator('.source-pane').evaluate(element => [element.scrollLeft, element.scrollTop]), pinnedOffsets,
    'the same source reference keeps its own scroll position');
  await pinned.locator('.source-pane pre').selectText();
  assert.match(await page.evaluate(() => window.getSelection()?.toString() ?? ''), /parseQuantity/u);
  await page.keyboard.press('Control+c');
  assert.match(await page.evaluate(() => window.getSelection()?.toString() ?? ''), /parseQuantity/u);
  assert.equal(await sourceTrigger(stop).getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await position(node(loop, 'check')), before, 'source preview, pinning, copying and step switch preserve canvas geometry');
  assert.equal(await readLayout(), diskBefore);
  assert.equal(await button(page, '前进').isDisabled(), historyBefore);
  await pinned.getByRole('button', { name: '关闭源码', exact: true }).click();
  await pinned.waitFor({ state: 'hidden' });
  assert.equal(await sourceTrigger(stop).evaluate(element => element === document.activeElement), true);
  report.checks.push('temporary preview closes after leaving trigger and panel; pinned shared source keeps scroll and selection while lesson changes; no layout or history write');

  await sourceTrigger(stop).focus();
  await page.keyboard.press('Enter');
  await sourcePanel(page).waitFor();
  await page.keyboard.press('Escape');
  await sourcePanel(page).waitFor({ state: 'hidden' });
  assert.equal(await sourceTrigger(stop).evaluate(element => element === document.activeElement), true);
  await node(loop, 'check').click();
  await check.locator('[data-choice="resume"]').click();
  await sourceTrigger(lesson(loop, 'resume')).click();
  assert.match(await sourcePanel(page).innerText(), /4–6/u);
  await lesson(loop, 'resume').locator('[data-choice="store"]').click();
  assert.match(await sourcePanel(page).innerText(), /7–10/u);
  await sourcePanel(page).getByRole('button', { name: '关闭源码', exact: true }).click();
  report.checks.push('keyboard pin, Escape focus return and distinct service source ranges');

  await page.setViewportSize({ width: 1440, height: 600 });
  await node(loop, 'check').click();
  await check.waitFor();
  await check.locator('.loop-original summary').click();
  const longScroll = await panel.evaluate(element => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  assert.ok(longScroll > 0, 'the long step is actually scrolled before direct node selection');
  await node(loop, 'stop').click();
  await stop.waitFor();
  await page.waitForFunction(() => document.querySelector('.loop-canvas .canvas-inspector')?.scrollTop === 0);
  assert.equal(await stop.locator('.loop-step-heading').evaluate(element => element === document.activeElement), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  report.checks.push('direct node selection from a long step bottom returns to the new step heading');

  await loop.locator('.graph-area').click({ position: { x: 12, y: 12 } });
  await lesson(loop, 'store').waitFor({ state: 'hidden' });
  await loop.locator('.loop-overview').waitFor();
  assert.equal(await loop.locator('.canvas-inspector').evaluate(element => element.scrollTop), 0);
  const toggle = page.locator('.reader-navigation-toggle');
  assert.equal(await toggle.isEnabled(), true);
  assert.equal(await toggle.getAttribute('aria-controls'), 'loop-navigation');
  assert.equal(await toggle.getAttribute('aria-label'), '展开闭环目录');
  await toggle.click();
  await loop.locator('.canvas-rail').waitFor();
  await page.keyboard.press('Escape');
  await loop.locator('.canvas-dock').waitFor();
  await loop.locator('.dependency-minimap').waitFor();
  assert.match(await loop.locator('.canvas-node-hint').innerText(), /点击节点查看详情，点击空白关闭/u);
  report.checks.push('blank restores overview; shared toolbar, minimap and canvas hint');

  await chooseLoop(page, legendLoopId);
  const pathLoop = page.locator('#loop-canvas-' + legendLoopId + '-reading');
  await pathLoop.locator('.canvas-rail').waitFor();
  await chooseLoop(page, orderId);
  await button(page, '文件依赖图').click();
  assert.equal(await toggle.getAttribute('aria-controls'), 'dependency-tools');
  await toggle.click();
  await page.locator('#dependency-tools').waitFor({ state: 'hidden' });
  await button(page, '闭环阅读').click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await loop.locator('.canvas-rail').waitFor();
  report.checks.push('both loops retain tools independently of the dependency toggle');

  const readLift = target => target.evaluate(element => {
    const value = getComputedStyle(element).translate;
    return value === 'none' ? 0 : Number.parseFloat(value.split(/\s+/)[1] ?? '0') || 0;
  });
  assert.match(await node(loop, 'check').evaluate(element => getComputedStyle(element).transitionProperty), /translate/u);
  await node(loop, 'check').hover();
  await page.waitForTimeout(180);
  assert.ok(Math.abs(await readLift(node(loop, 'check')) + 2) < .1, 'loop card rises two CSS pixels');
  assert.deepEqual(await position(node(loop, 'check')), before, 'visual lift does not move Vue Flow geometry');
  await page.mouse.move(0, 0);
  await button(page, '文件依赖图').click();
  const dependency = page.locator('#canvas-reading');
  const dependencyNode = dependency.locator('.dependency-card').first();
  await dependencyNode.waitFor();
  await dependencyNode.hover();
  await page.waitForTimeout(180);
  assert.ok(Math.abs(await readLift(dependencyNode) + 2) < .1, 'dependency card rises two CSS pixels');
  await button(page, '后退').click();
  await loop.locator('.loop-overview').waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await node(loop, 'check').hover();
  assert.equal(await readLift(node(loop, 'check')), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  report.checks.push('both graph card types lift visually without graph geometry changes; reduced motion stays static');

  await page.getByLabel('界面语言', { exact: true }).selectOption('en');
  await loop.getByText('Click a node for details; click the canvas to close.', { exact: true }).waitFor();
  await page.getByLabel('Interface language', { exact: true }).selectOption('zh-CN');
  await chooseLoop(page, legendLoopId);
  const paths = page.locator('#loop-canvas-' + legendLoopId + '-reading');
  const audit = lesson(paths, 'audit');
  await paths.locator('[data-step="audit"]').click();
  await audit.locator('.loop-step-explanation').filter({ hasText: '这里有文件名，需要拼出日志路径。' }).waitFor();
  assert.equal(await sourceTrigger(audit).count(), 0);
  await paths.locator('[data-legend="node-path"]').click();
  await paths.locator('.library-description').waitFor();
  assert.equal(await sourcePanel(page).count(), 0);
  report.checks.push('English controls with original content; pure lesson and legend have no stale source');

  await chooseLoop(page, orderId);
  await node(loop, 'check').click();
  await sourceTrigger(check).click();
  await sourcePanel(page).waitFor();
  assert.equal(await sourcePanel(page).evaluate(element => element.classList.contains('loop-source-floating')), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const panel = document.querySelector('.loop-source-panel');
    return panel?.classList.contains('loop-source-inline') && !panel.style.width && !panel.style.left && !panel.style.top && !panel.style.maxHeight;
  });
  const resizedBox = await sourcePanel(page).boundingBox();
  const resizedClose = await sourcePanel(page).getByRole('button', { name: '关闭源码', exact: true }).boundingBox();
  assert.ok(resizedBox.x >= 0 && resizedBox.x + resizedBox.width <= 390, 'resized inline source fits the viewport');
  assert.ok(resizedClose.x >= 0 && resizedClose.x + resizedClose.width <= 390, 'resized close button remains reachable');
  await sourcePanel(page).getByRole('button', { name: '关闭源码', exact: true }).click();
  report.checks.push('desktop pinned source clears floating styles when resized directly to 390px');

  assert.ok(await loop.locator('.loop-overview-link').isVisible());
  assert.equal(await loop.getByTestId('layout-status').isVisible(), false);
  await sourceTrigger(check).click();
  await sourcePanel(page).waitFor();
  assert.equal(await sourcePanel(page).evaluate(element => element.classList.contains('loop-source-inline')), true);
  const inlineBox = await sourcePanel(page).boundingBox();
  assert.ok(inlineBox.x >= 0 && inlineBox.x + inlineBox.width <= 391);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const inlineSource = sourcePanel(page).locator('.source-pane');
  assert.equal(await inlineSource.evaluate(element => element.scrollWidth > element.clientWidth), true, 'long source line overflows its own pane');
  assert.ok(await inlineSource.evaluate(element => { element.scrollLeft = 40; return element.scrollLeft; }) > 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await sourcePanel(page).scrollIntoViewIfNeeded();
  const railBounds = await loop.locator('.canvas-rail').boundingBox();
  const graphBounds = await loop.locator('.graph-area').boundingBox();
  assert.ok(railBounds.y + railBounds.height <= graphBounds.y + graphBounds.height + 1,
    'graph tools stay inside the graph instead of overlaying inline source');
  await sourcePanel(page).getByRole('button', { name: '关闭源码', exact: true }).click();
  if (channel === 'edge') {
    await sourceTrigger(check).click();
    await page.screenshot({ path: path.join(run, 'mobile-source.png'), fullPage: true });
    await sourcePanel(page).getByRole('button', { name: '关闭源码', exact: true }).click();
  }
  report.checks.push('390px inline source opens, fits and closes');

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await touch.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(reader.url);
  await mobile.locator('.app-page-menu-toggle').click();
  await mobile.locator('[data-page="loops"]').click();
  await chooseLoop(mobile, orderId);
  await mobile.locator('[data-step="check"]').tap();
  await mobile.locator('.loop-source-trigger').tap();
  await mobile.locator('.loop-source-panel').waitFor();
  await mobile.getByRole('button', { name: '关闭源码', exact: true }).tap();
  await mobile.locator('.loop-source-panel').waitFor({ state: 'hidden' });
  await touch.close();
  report.checks.push('touch emulation selects a step and opens/closes inline source');
  assert.deepEqual(writes, [], 'reading and source controls must not write layout');
  assert.deepEqual(errors, []);
  if (channel === 'edge') await writeFile(path.join(run, 'order-layout.json'), await readLayout());
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  await context?.close();
  await reader?.server.close();
  await browser.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ run, channel, version: report.version, checks: report.checks.length, ok: !report.error }));
}
