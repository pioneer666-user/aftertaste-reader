import { chooseLoop } from './loop-controls.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { api, audit, legendId, readJSON, rules, service, standardLegend, writeJSON } from '../fixtures/dependency-legends.mjs';
import { orderId, orderInput } from '../fixtures/loop-authoring.mjs';
import { createLoopReaderProject, loopLayout } from '../fixtures/loop-reader.mjs';
import { dependencySaved } from './dependency-controls.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
const root = path.join(repository, '.local/' + (process.env.AFTERTASTE_TEST_TASK ?? 'D026'));
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'browser-' + channel + '-'));
const fixture = await createLoopReaderProject(path.join(run, 'project'));
const names = ['bookmarks.json', 'understanding-marks.json', 'notes.json'];
for (const name of names) await copyFile(new URL('../fixtures/page-preview/' + name, import.meta.url), path.join(fixture.data, name));
const protectedFiles = [fixture.graph, ...names.map(name => path.join(fixture.data, name))];
const protectedBefore = await Promise.all(protectedFiles.map(file => readFile(file)));
const seed = await readJSON(fixture.layout);
// Leave an ungrouped file inside the eventual frame but partly outside the first drag.
seed.layout.positions = {
  [rules]: { x: 32, y: 64 }, [service]: { x: 620, y: 64 },
  [audit]: { x: 14, y: 174 }, [api]: { x: 590, y: 220 },
  [legendId]: { x: 290, y: 270 },
};
await writeJSON(fixture.layout, seed);
const report = { run, project: fixture.projectRoot, fixedCommit: fixture.commit, build, browser: channel,
  os: release(), node: process.version, checks: [], errors: [] };
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const desktop = { width: 1440, height: 880 };
const layoutRoute = '/api/dependency-layout';
const loopRoute = '/api/loops/' + orderId + '/layout';
const header = page => page.locator('header.app-header');
const compactToggle = page => header(page).locator('[popovertarget="app-page-menu"]');
const visiblePages = page => header(page).locator('[data-page]:visible');
const activePage = page => header(page).locator('[data-page][aria-current="page"]:visible');
const dep = page => page.locator('#canvas-reading');
const area = page => dep(page).locator('.graph-area');
const file = (page, source) => dep(page).locator(`[data-file="${source}"]`);
const library = page => dep(page).locator(`[data-legend="${standardLegend.id}"]`);
const groupAction = page => button(dep(page), '分组');
const groupName = page => dep(page).locator('#canvas-selection-name');
const frame = (page, name) => dep(page).locator('.group-frame').filter({ has: button(page, '分组操作 · ' + name) });
const selected = page => dep(page).locator('[data-box-selected="true"]');
const transform = scope => scope.locator('.vue-flow__transformationpane').evaluate(element => getComputedStyle(element).transform);
const saveResponse = (page, route) => page.waitForResponse(response =>
  response.url().endsWith(route) && response.request().method() === 'PUT');
let reader, browser, context, page;

async function screenshot(page, name) {
  if (channel === 'edge') await page.screenshot({ path: path.join(run, name + '.png') });
}

async function newPage(viewport = desktop) {
  context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(reader.url);
  return page;
}

async function bounds(target) {
  const box = await target.boundingBox();
  assert.ok(box, 'expected a visible target: ' + target);
  return box;
}

function contains(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + (inner.width ?? 0) <= outer.x + outer.width &&
    inner.y + (inner.height ?? 0) <= outer.y + outer.height;
}

async function drag(page, from, to, { selecting = false, movingNode = false } = {}) {
  await page.mouse.move(from.x, from.y);
  if (selecting) await page.keyboard.down('Control');
  await page.mouse.down();
  try {
    if (movingNode) await page.mouse.move(from.x + 4, from.y);
    await page.mouse.move(to.x, to.y, { steps: 12 });
  } finally {
    await page.mouse.up();
    if (selecting) await page.keyboard.up('Control');
  }
}

async function assertSelected(page, expected) {
  const ids = await selected(page).evaluateAll(elements => elements.map(element => {
    const node = element.matches('.file-node') ? element : element.querySelector('.file-node');
    return node?.dataset.file ?? (node?.dataset.legend && 'legend:' + node.dataset.legend);
  }));
  assert.deepEqual(ids.sort(), [...expected].sort());
}

async function dependencyWrite(page, action) {
  const [response] = await Promise.all([saveResponse(page, layoutRoute), action()]);
  assert.equal(response.status(), 200, await response.text());
  await dependencySaved(dep(page));
  const disk = await readJSON(fixture.layout);
  assert.equal(disk.revision, (await response.json()).revision);
  return disk;
}

async function lockLayout() {
  const locker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'try { $f = [IO.File]::Open($env:AFTERTASTE_D026_LAYOUT, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); [Console]::WriteLine("LOCKED"); [void][Console]::ReadLine() } finally { if ($f) { $f.Close() } }'],
  { windowsHide: true, env: { ...process.env, AFTERTASTE_D026_LAYOUT: fixture.layout } });
  try {
    const [output] = await once(locker.stdout, 'data', { signal: AbortSignal.timeout(8000) });
    assert.match(output.toString(), /^LOCKED/u);
  } catch (error) {
    locker.kill();
    throw error;
  }
  return async () => {
    const ended = once(locker, 'exit');
    locker.stdin.end('\n');
    await ended;
  };
}

async function checkNavigation(page) {
  const pages = ['文件讲解', '文件依赖图', '闭环阅读', '书签', '标注', '笔记'];
  const english = ['File explanations', 'File dependencies', 'Reading loops', 'Bookmarks', 'Marks', 'Notes'];
  await page.locator('.document-header h1').waitFor();
  assert.deepEqual(await visiblePages(page).allInnerTexts(), pages);
  const sidebar = header(page).locator('[aria-controls="reader-navigation"]');
  const refresh = button(header(page), '刷新资料');
  const language = header(page).getByLabel('界面语言');
  const first = await bounds(button(header(page), pages[0]));
  const toggle = await bounds(sidebar);
  assert.ok(first.x >= toggle.x + toggle.width && first.x - toggle.x - toggle.width <= 24);
  assert.ok((await bounds(refresh)).x > (await bounds(button(header(page), pages.at(-1)))).x);
  assert.equal(await activePage(page).innerText(), pages[0]);
  const noteTab = button(header(page), '笔记');
  const background = target => target.evaluate(element => getComputedStyle(element).backgroundColor);
  const rest = await background(noteTab);
  assert.notEqual(await background(activePage(page)), rest);
  await noteTab.hover();
  assert.notEqual(await background(noteTab), rest);
  await button(header(page), '标注').focus();
  await page.keyboard.press('Tab');
  assert.ok(await noteTab.evaluate(element => element.matches(':focus-visible') && getComputedStyle(element).outlineStyle !== 'none'));
  await screenshot(page, 'desktop-chinese');

  await language.selectOption('en');
  await page.reload();
  await page.locator('.document-header h1').waitFor();
  await page.setViewportSize({ width: 851, height: 844 });
  assert.deepEqual(await visiblePages(page).allInnerTexts(), english);
  assert.ok(await button(header(page), 'Refresh documents').isVisible());
  assert.ok(await header(page).getByLabel('Interface language').isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot(page, 'english-inline-851');
  await page.setViewportSize({ width: 850, height: 844 });
  await compactToggle(page).waitFor();
  await compactToggle(page).press('Enter');
  assert.deepEqual(await visiblePages(page).allInnerTexts(), english);
  await screenshot(page, 'english-compact-850');
  await page.keyboard.press('Escape');
  assert.equal(await visiblePages(page).count(), 0);
  assert.ok(await compactToggle(page).evaluate(element => element === document.activeElement));
  await header(page).getByLabel('Interface language').selectOption('zh-CN');
  await page.reload();
  await page.locator('.document-header h1').waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, target] of [
    [pages[1], '#canvas-reading'], [pages[2], '#loop-navigation'], [pages[3], '#bookmarks'],
    [pages[4], '#marks'], [pages[5], '#notes'], [pages[0], '#reading'],
  ]) {
    await compactToggle(page).press('Enter');
    assert.deepEqual(await visiblePages(page).allInnerTexts(), pages);
    await button(header(page), label).press('Enter');
    await page.locator(target).waitFor();
    assert.equal((await compactToggle(page).innerText()).trim(), label);
  }
  await sidebar.press('Enter');
  await page.locator('#reader-navigation').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#reader-navigation').waitFor({ state: 'hidden' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot(page, 'narrow-chinese-390');
  await page.setViewportSize(desktop);
  const bookmarkPage = button(header(page), '书签');
  await bookmarkPage.click();
  await page.locator('#bookmarks .record-refresh:enabled').waitFor();
  const [refreshed] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/bookmarks') && response.request().method() === 'GET'),
    bookmarkPage.click(),
  ]);
  assert.equal(refreshed.status(), 200);
  await button(header(page), '文件讲解').click();
  report.checks.push('六页同序及当前态、桌面悬停/焦点、英文 851/850、390 窗宽键盘与侧栏、重选书签页刷新');
}

try {
  browser = await (channel === 'firefox' ? firefox.launch() : chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel }));
  report.version = browser.version();
  reader = await startReader(fixture.projectRoot, 0);
  page = await newPage();
  await checkNavigation(page);

  await button(header(page), '文件依赖图').click();
  await library(page).waitFor();
  await dependencySaved(dep(page));
  await page.getByRole('main', { name: '文件依赖图' }).waitFor();
  assert.equal(await dep(page).getByRole('heading').count(), 0);
  assert.equal(await dep(page).getByText('布局已保存', { exact: true }).isVisible(), false);
  assert.equal(await dep(page).locator('#canvas-group-picker').isVisible(), false);
  assert.ok(await button(dep(page), '刷新图和布局').isVisible());
  assert.ok(await button(dep(page), '重新布局').isVisible());
  assert.ok(await button(dep(page), '缩小画布').isVisible());
  const full = await bounds(area(page));
  assert.ok(full.width >= desktop.width * 0.90 && full.height >= desktop.height * 0.70);
  const originalView = await transform(dep(page));
  await screenshot(page, 'graph-first-view');
  await file(page, api).click();
  const summary = dep(page).locator('.canvas-summary');
  const detail = dep(page).locator('.canvas-details');
  await button(dep(page), service + ' → ' + api).press('Enter');
  await summary.getByText('调用 createOrder 处理订单。', { exact: true }).waitFor();
  await screenshot(page, 'file-detail');
  await file(page, service).click();
  await button(summary, '阅读讲解').click();
  await page.getByRole('heading', { level: 1, name: service }).waitFor();
  await button(header(page), '后退').click();
  await summary.getByRole('heading', { name: 'service.mjs', exact: true }).waitFor();
  assert.equal(await transform(dep(page)), originalView);
  assert.deepEqual(await bounds(area(page)), full);
  await button(dep(page), '清除选择').click();
  assert.deepEqual(await bounds(area(page)), full);
  await library(page).click();
  await detail.getByText(standardLegend.description, { exact: true }).waitFor();
  await button(dep(page), '清除选择').click();
  report.checks.push('画布首屏、API 关系读到 service 讲解及原视野返回、文件和库详情按需关闭');

  const passiveDisk = await readFile(fixture.layout);
  let puts = 0;
  page.on('request', request => { if (request.method() === 'PUT' && request.url().endsWith(layoutRoute)) puts++; });
  const rule = await bounds(file(page, rules)), lib = await bounds(library(page));
  const oldFrame = await bounds(frame(page, '订单处理'));
  const from = { x: Math.floor(rule.x - 6), y: Math.floor(rule.y - 8) };
  const to = { x: Math.ceil(lib.x + lib.width + 6), y: Math.ceil(lib.y + lib.height + 6) };
  assert.ok(contains(oldFrame, from), 'first drag starts in the old group background');
  assert.equal(await page.evaluate(({ x, y }) =>
    !!document.elementFromPoint(x, y)?.closest('.file-node, .group-handle'), from), false);
  const auditBox = await bounds(file(page, audit));
  assert.ok(auditBox.x < from.x && auditBox.x + auditBox.width > from.x && auditBox.y + auditBox.height < to.y,
    'the ungrouped file is only partially in the rectangle');
  const firstSelection = () => drag(page, from, to, { selecting: true });
  await drag(page, { x: full.x + 20, y: full.y + full.height - 88 },
    { x: full.x + 50, y: full.y + full.height - 61 }, { selecting: true });
  assert.equal(await groupAction(page).isVisible(), false);
  await firstSelection();
  await assertSelected(page, [rules, legendId]);
  await groupAction(page).waitFor();
  const near = await bounds(groupAction(page));
  assert.ok(Math.abs(near.x - to.x) <= 35 && Math.abs(near.y - to.y) <= 35);
  await screenshot(page, 'box-selected');
  await page.keyboard.press('Tab');
  assert.ok(await groupAction(page).evaluate(element => element.matches(':focus-visible')));
  await groupAction(page).click();
  await groupName(page).waitFor();
  await dep(page).getByText('已选 2 项', { exact: true }).waitFor();
  await dep(page).getByText(/src\/rules\.mjs.*订单处理/u).waitFor();
  await screenshot(page, 'group-name-transfer');
  await groupName(page).fill('取消的名字');
  await groupName(page).evaluate(input => {
    input.addEventListener('keydown', function recordShortcut(event) {
      if (!event.ctrlKey || event.key.toLowerCase() !== 'g') return;
      input.removeEventListener('keydown', recordShortcut);
      requestAnimationFrame(() => { input.dataset.ctrlGPrevented = String(event.defaultPrevented); });
    });
  });
  await groupName(page).press('Control+g');
  await dep(page).locator('#canvas-selection-name[data-ctrl-g-prevented="false"]').waitFor();
  assert.equal(await groupName(page).inputValue(), '取消的名字');
  await groupName(page).press('Escape');
  await groupName(page).waitFor({ state: 'hidden' });
  assert.equal(await selected(page).count(), 0);
  await firstSelection();
  await button(header(page), '笔记').click();
  await page.keyboard.press('Control+g');
  await button(header(page), '文件依赖图').click();
  assert.equal(await groupAction(page).isVisible(), false);
  assert.equal(await selected(page).count(), 0);
  assert.equal(await transform(dep(page)), originalView);
  assert.equal(puts, 0);
  assert.deepEqual(await readFile(fixture.layout), passiveDisk);
  await frame(page, '订单处理').locator('.group-more').click();
  await button(dep(page), '改名').click();
  const oldEditor = dep(page).locator('.canvas-groups');
  const formerMember = oldEditor.getByRole('checkbox', { name: rules, exact: true });
  const oldGroupName = oldEditor.getByLabel('组名', { exact: true });
  assert.equal(await formerMember.isChecked(), true);
  await oldGroupName.fill('订单处理（改名）');
  await firstSelection();
  await groupAction(page).click();
  await groupName(page).fill('鼠标创建');
  const grouped = await dependencyWrite(page, () => groupName(page).press('Enter'));
  assert.deepEqual(grouped.layout.groups.find(group => group.name === '订单处理').members, [service]);
  assert.deepEqual([...grouped.layout.groups.find(group => group.name === '鼠标创建').members].sort(), [rules, legendId].sort());
  assert.equal(await formerMember.isChecked(), false);
  assert.equal(await oldGroupName.inputValue(), '订单处理（改名）');
  const renamed = await dependencyWrite(page, () => button(oldEditor, '应用分组').click());
  assert.deepEqual(renamed.layout.groups.map(group => [group.name, group.members]),
    grouped.layout.groups.map(group => [group.name === '订单处理' ? '订单处理（改名）' : group.name, group.members]));
  await oldEditor.waitFor({ state: 'hidden' });
  assert.ok(contains(await bounds(frame(page, '鼠标创建')), auditBox), 'unselected file lies fully inside the new frame');
  const handle = await bounds(frame(page, '鼠标创建').locator('.group-handle'));
  const handleCenter = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
  const groupMoved = await dependencyWrite(page, () => drag(page, handleCenter,
    { x: handleCenter.x + 76, y: handleCenter.y + 72 }, { movingNode: true }));
  const delta = id => ['x', 'y'].map(axis => groupMoved.layout.positions[id][axis] - grouped.layout.positions[id][axis]);
  assert.ok(delta(rules)[0] > 20 && delta(rules)[1] > 20);
  assert.ok(delta(rules).every((value, index) => Math.abs(value - delta(legendId)[index]) < 0.015));
  assert.deepEqual(delta(audit), [0, 0]);
  assert.deepEqual(delta(service), [0, 0]);
  report.checks.push('组框内起拖、部分命中排除、浮钮就近且 Tab 可达、输入时快捷键不接管、取消/空选/切页不写、旧组编辑同步、仅显式成员随组移动');

  await page.setViewportSize({ width: 920, height: 800 });
  const zoomed = await dependencyWrite(page, () => button(dep(page), '缩小画布').click());
  const graph = await bounds(area(page));
  const blank = { x: graph.x + 170, y: graph.y + graph.height - 150 };
  const panned = await dependencyWrite(page, () => drag(page, blank, { x: blank.x + 10, y: blank.y + 12 }));
  assert.notEqual(panned.layout.viewport.x, zoomed.layout.viewport.x);
  const reverseStart = { x: Math.floor(((await bounds(file(page, audit))).x + (await bounds(file(page, rules))).x) / 2),
    y: Math.ceil((await bounds(library(page))).y + (await bounds(library(page))).height + 10) };
  const nearEdge = { x: Math.floor(graph.x + graph.width - 2), y: Math.ceil(graph.y + 8) };
  assert.ok(page.viewportSize().width - nearEdge.x <= 24);
  await button(header(page), '展开闭环目录').click();
  await dep(page).locator('#loop-navigation').waitFor();
  await page.keyboard.press('Escape');
  await dep(page).locator('#loop-navigation').waitFor({ state: 'hidden' });
  await drag(page, reverseStart, nearEdge, { selecting: true });
  await assertSelected(page, [rules, service, api, legendId]);
  const edgeButton = await bounds(groupAction(page));
  assert.ok(edgeButton.x + edgeButton.width <= nearEdge.x && edgeButton.x > nearEdge.x - 160);
  assert.ok(contains({ x: 0, y: 0, ...page.viewportSize() }, edgeButton));
  await screenshot(page, 'edge-group-action');
  await page.keyboard.press('Control+g');
  await groupName(page).waitFor();
  await dep(page).getByText('已选 4 项', { exact: true }).waitFor();
  await dep(page).getByText(/src\/service\.mjs.*订单处理/u).waitFor();
  await dep(page).getByText(/node:path.*鼠标创建/u).waitFor();
  const naming = await bounds(groupName(page));
  assert.ok(contains({ x: 0, y: 0, ...page.viewportSize() }, naming));
  await groupName(page).fill('键盘创建');
  const originalDisk = await readFile(fixture.layout);
  const unlock = process.platform === 'win32' ? await lockLayout() : undefined;
  try {
    if (unlock) {
      const [failure] = await Promise.all([saveResponse(page, layoutRoute), groupName(page).press('Enter')]);
      assert.equal((await failure.json()).error.code, 'LAYOUT_WRITE_FAILED');
    } else {
      await page.route('**' + layoutRoute, route => route.abort('failed'), { times: 1 });
      await groupName(page).press('Enter');
    }
    await dep(page).getByRole('alert').getByText(unlock ? /LAYOUT_WRITE_FAILED/u : /NETWORK_ERROR/u).waitFor();
    assert.deepEqual(await readFile(fixture.layout), originalDisk);
    await frame(page, '键盘创建').waitFor();
    await screenshot(page, 'layout-write-failed');
  } finally { await unlock?.(); }
  const retried = await dependencyWrite(page, () => button(dep(page), '重试保存').click());
  assert.deepEqual(retried.layout.groups.map(group => group.name), ['键盘创建']);
  assert.deepEqual([...retried.layout.groups[0].members].sort(), [rules, service, api, legendId].sort());
  assert.deepEqual(retried.layout.positions, panned.layout.positions);
  assert.deepEqual(retried.layout.viewport, panned.layout.viewport);
  report.checks.push('实际平移缩放后的逆向边缘命中、Ctrl+G、旧组移空、真实失败时保留草稿及可重试');

  await button(dep(page), '编辑分组').press('Enter');
  const picker = dep(page).locator('#canvas-group-picker');
  await picker.press('End');
  await page.waitForFunction(id => document.querySelector('#canvas-group-picker')?.value === id, retried.layout.groups[0].id);
  const editName = dep(page).getByLabel('组名', { exact: true });
  await editName.fill('键盘编排');
  await dep(page).getByRole('checkbox', { name: audit, exact: true }).press('Space');
  await dep(page).getByRole('checkbox', { name: api, exact: true }).press('Space');
  const edited = await dependencyWrite(page, () => button(dep(page), '应用分组').press('Enter'));
  assert.deepEqual(edited.layout.groups.map(group => group.name), ['键盘编排']);
  assert.deepEqual([...edited.layout.groups[0].members].sort(), [rules, service, audit, legendId].sort());

  await button(header(page), '闭环阅读').click();
  await chooseLoop(page, orderId);
  const loop = page.locator('#loop-canvas-' + orderId + '-reading');
  const check = loop.locator('[data-step="check"]');
  await check.click();
  await loop.locator('.loop-reader-toggle').click();
  await loop.locator('[data-reading-step="check"]').getByRole('heading', { name: orderInput.nodes.find(node => node.id === 'check').title }).waitFor();
  await page.keyboard.press('Control+g');
  assert.equal(await groupName(page).isVisible(), false);
  const [loopAck] = await Promise.all([saveResponse(page, loopRoute), button(loop, '缩小画布').click()]);
  assert.equal(loopAck.status(), 200);
  const loopDisk = await readJSON(loopLayout(fixture, orderId));
  assert.equal(loopDisk.revision, (await loopAck.json()).revision);
  assert.notEqual(loopDisk.layout.viewport.zoom, edited.layout.viewport.zoom);
  assert.deepEqual(await readJSON(fixture.layout), edited);
  report.checks.push('键盘进入现有组改名和增减成员；真实闭环点读及保存的单独布局');

  await context.close();
  context = undefined;
  const stoppedUrl = reader.url;
  await reader.server.close();
  reader = undefined;
  await assert.rejects(fetch(stoppedUrl), TypeError);
  reader = await startReader(fixture.projectRoot, 0);
  page = await newPage();
  await button(header(page), '文件依赖图').click();
  await dependencySaved(dep(page));
  assert.deepEqual(await readJSON(fixture.layout), edited);
  await frame(page, '键盘编排').waitFor();
  const shown = await dep(page).evaluate(scope => {
    const matrix = element => new DOMMatrixReadOnly(getComputedStyle(element).transform);
    const view = matrix(scope.querySelector('.vue-flow__transformationpane'));
    return { viewport: [view.e, view.f, view.a], positions: Object.fromEntries([...scope.querySelectorAll('.file-node')].map(node => {
      const point = matrix(node.closest('.vue-flow__node'));
      return [node.dataset.file ?? 'legend:' + node.dataset.legend, [point.e, point.f]];
    })) };
  });
  const assertNear = (actual, expected) => expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) < 0.015));
  assertNear(shown.viewport, [edited.layout.viewport.x, edited.layout.viewport.y, edited.layout.viewport.zoom]);
  for (const [id, point] of Object.entries(edited.layout.positions)) assertNear(shown.positions[id], [point.x, point.y]);
  await screenshot(page, 'reopened');
  const more = button(dep(page), '分组操作 · 键盘编排');
  await more.click();
  await dep(page).locator('.loop-group-menu').waitFor();
  await more.click();
  await dep(page).locator('.loop-group-menu').waitFor({ state: 'hidden' });
  assert.equal(await more.getAttribute('aria-expanded'), 'false');
  await more.press('Enter');
  await dep(page).getByRole('button', { name: /解散分组/u }).press('Tab');
  assert.ok(await dep(page).locator('.dependency-minimap').evaluate(el => el === document.activeElement));
  assert.equal(await more.getAttribute('aria-expanded'), 'false');
  await more.press('Enter');
  await page.keyboard.press('Escape');
  assert.ok(await more.evaluate(el => el === document.activeElement));
  await more.press('Enter');
  await screenshot(page, 'group-menu');
  const dissolve = dep(page).getByRole('button', { name: /解散分组.*节点保留在原位/u });
  const dissolved = await dependencyWrite(page, () => dissolve.press('Enter'));
  assert.deepEqual(dissolved.layout, { ...edited.layout, groups: [] });
  await frame(page, '键盘编排').waitFor({ state: 'detached' });
  await page.reload();
  await button(header(page), '文件依赖图').click();
  await dependencySaved(dep(page));
  assert.equal(await dep(page).locator('.group-frame').count(), 0);
  assert.deepEqual(await readJSON(fixture.layout), dissolved);
  assert.deepEqual(await readJSON(loopLayout(fixture, orderId)), loopDisk);
  assert.deepEqual(await Promise.all(protectedFiles.map(file => readFile(file))), protectedBefore);
  assert.deepEqual(report.errors, []);
  report.checks.push('关闭标签页和服务后恢复成员、坐标及视野；键盘解散组；图内容和个人记录文件字节一致');
} catch (error) {
  report.failure = error.stack;
  if (page && !page.isClosed()) await screenshot(page, 'failure').catch(() => {});
  throw error;
} finally {
  await context?.close();
  await browser?.close();
  await reader?.server.close();
  await writeJSON(path.join(run, 'report.json'), report);
  console.log(JSON.stringify(report));
}
