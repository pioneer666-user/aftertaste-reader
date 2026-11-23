import { chooseLoop, openCatalog } from './loop-controls.mjs';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { api, audit, legendId, readJSON, standardLegend } from '../fixtures/dependency-legends.mjs';
import { orderId, orderInput } from '../fixtures/loop-authoring.mjs';
import { artifact, createLoopReaderProject, explanationFile, git, legendLoopId, loopLayout } from '../fixtures/loop-reader.mjs';
import { dependencySaved as saved, openDependencyGroups } from './dependency-controls.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
const root = path.join(repository, '.local/' + (process.env.AFTERTASTE_TEST_TASK ?? 'D016'));
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'browser-' + channel + '-'));
const project = await createLoopReaderProject(path.join(run, 'project'));
const browser = await (channel === 'firefox' ? firefox.launch() : chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel }));
const report = { run, browser: channel, version: browser.version(), os: release(), node: process.version, commit: project.commit, checks: [] };
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const canvas = (page, id) => page.locator(id ? '#loop-canvas-' + id + '-reading' : '#canvas-reading');
const step = (scope, id) => scope.locator(`[data-step="${id}"]`);
const lesson = (scope, id) => scope.locator(`[data-reading-step="${id}"]`);
const legend = scope => scope.locator(`[data-legend="${standardLegend.id}"]`);
const legendPath = loopLayout(project, legendLoopId);
const orderPath = loopLayout(project, orderId);
const orderRoute = '/api/loops/' + orderId;
const legendRoute = '/api/loops/' + legendLoopId;
const title = id => orderInput.nodes.find(node => node.id === id).title;
const errors = [];

async function openPage(context, url) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await button(page, '闭环阅读').click();
  await page.locator('#loop-navigation [data-loop]').first().waitFor();
  return page;
}

async function choose(page, id) {
  await chooseLoop(page, id);
  return canvas(page, id);
}

async function drag(page, target, dx, dy, anchor = [0.5, 0.5]) {
  const box = await target.boundingBox();
  assert.ok(box, 'visible drag target');
  const x = box.x + box.width * anchor[0], y = box.y + box.height * anchor[1];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4, y);
  await page.mouse.move(x + 4 + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

async function saveAction(page, scope, route, file, action) {
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith(route) && response.request().method() === 'PUT'), action(),
  ]);
  assert.equal(response.status(), 200, await response.text());
  await saved(scope);
  const disk = await readJSON(file);
  assert.equal(disk.revision, (await response.json()).revision);
  return disk;
}

async function addGroup(scope, name, members) {
  if (!await scope.locator('.canvas-groups').isVisible()) await button(scope, '编辑分组').click();
  await scope.getByRole('combobox', { name: '编辑分组' }).selectOption('');
  await scope.getByLabel('组名').fill(name);
  for (const member of members) await scope.getByRole('checkbox', { name: member, exact: true }).check();
  await button(scope, '应用分组').click();
}

async function assertLayout(target, point, viewport) {
  const actual = await target.evaluate(element => {
    const transform = item => new DOMMatrixReadOnly(getComputedStyle(item).transform);
    const node = transform(element.closest('.vue-flow__node'));
    const view = transform(element.closest('.vue-flow').querySelector('.vue-flow__transformationpane'));
    return [node.e, node.f, view.e, view.f, view.a];
  });
  for (const [index, expected] of [point.x, point.y, viewport.x, viewport.y, viewport.zoom].entries()) {
    assert.ok(Math.abs(actual[index] - expected) < 0.015, `canvas transform ${actual[index]} vs ${expected}`);
  }
}

let reader;
let context;
let delayedRead;
let delayedWrite;
try {
  reader = await startReader(project.projectRoot, 0);
  context = await browser.newContext({ viewport: { width: 1650, height: 980 } });
  context.setDefaultTimeout(10_000);
  const page = await openPage(context, reader.url);
  const files = [artifact(project, orderId), artifact(project, legendLoopId), project.graph];
  const contents = await Promise.all(files.map(file => readFile(file)));
  const oldDependency = await readJSON(project.layout);
  const releaseRead = Promise.withResolvers();
  delayedRead = releaseRead.resolve;
  const readArrived = Promise.withResolvers();
  await page.route('**' + orderRoute, async route => {
    const response = await route.fetch();
    readArrived.resolve();
    await releaseRead.promise;
    await route.fulfill({ response });
  }, { times: 1 });
  const readRequested = page.waitForRequest(request => request.url().endsWith(orderRoute));
  const order = await choose(page, orderId);
  await readRequested;
  await readArrived.promise;
  const paths = await choose(page, legendLoopId);
  await paths.locator('.loop-reader-toggle').click();
  await paths.locator('.loop-overview').waitFor();
  const orderLoaded = page.waitForResponse(response => response.url().endsWith(orderRoute));
  releaseRead.resolve();
  await orderLoaded;
  await paths.locator('.loop-overview').waitFor();
  await order.waitFor({ state: 'hidden' });
  await legend(paths).focus();
  await page.keyboard.press('Enter');
  await paths.getByText(standardLegend.description, { exact: true }).waitFor();
  for (const use of standardLegend.uses) await paths.getByText(use.reason, { exact: true }).waitFor();
  assert.equal(await paths.locator('.library-use-edge').count(), 1);
  await page.getByLabel('界面语言').selectOption('en');
  await paths.getByText('Participating files that use this library').waitFor();
  await paths.getByText(standardLegend.description, { exact: true }).waitFor();
  await page.getByLabel('Interface language').selectOption('zh-CN');
  report.checks.push('late A load stayed in A; saved legend uses files; English and keyboard selection');

  await choose(page, orderId);
  await order.getByRole('button', { name: /^打开闭环概览/u }).click();
  await order.locator('.loop-overview').waitFor();
  await order.getByText('串讲', { exact: true }).click();
  await order.getByText(/假设示例/).waitFor();
  await order.getByText('推荐阅读顺序', { exact: true }).click();
  assert.deepEqual(await order.locator('.loop-order button').allTextContents(), orderInput.reading_order.map(title));
  await order.getByText('推荐阅读顺序', { exact: true }).click();
  await order.getByText('串讲', { exact: true }).click();
  await step(order, 'start').click();
  const readCode = async id => {
    const panel = lesson(order, id);
    await panel.locator('.loop-original summary').click();
    const trigger = panel.locator('.loop-source-trigger');
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    const source = page.locator('#loop-source-' + orderId);
    await source.locator('pre').waitFor();
    return { detail: await panel.locator('.loop-step-reading').innerText(), code: await source.locator('pre').innerText(),
      range: await trigger.innerText() };
  };
  const start = await readCode('start');
  await lesson(order, 'start').locator('[data-choice="check"]').click();
  const branching = lesson(order, 'check');
  assert.equal(await branching.getByRole('heading', { name: title('check'), exact: true }).evaluate(element => element === document.activeElement), true);
  for (const edge of orderInput.edges.filter(edge => edge.from === 'check')) {
    await branching.getByText(edge.reason, { exact: true }).waitFor();
  }
  if (channel === 'edge') await page.screenshot({ path: path.join(run, 'order-branch.png') });
  await branching.locator('[data-choice="resume"]').click();
  const resume = await readCode('resume');
  assert.equal(start.code, resume.code);
  assert.equal(start.range, resume.range);
  assert.notEqual(start.detail, resume.detail);
  await lesson(order, 'resume').locator('[data-choice="store"]').click();
  await lesson(order, 'store').waitFor();
  await step(order, 'check').click();
  await lesson(order, 'check').locator('[data-choice="stop"]').click();
  await lesson(order, 'stop').waitFor();
  report.checks.push('saved order and connection reasons; both order endings; distinct lessons share original code and line range');

  const releaseWrite = Promise.withResolvers();
  delayedWrite = releaseWrite.resolve;
  const writeReachedDisk = Promise.withResolvers();
  await page.route('**' + orderRoute + '/layout', async route => {
    const response = await route.fetch();
    writeReachedDisk.resolve(response.status());
    await releaseWrite.promise;
    await route.fulfill({ response });
  }, { times: 1 });
  const startX = await step(order, 'start').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el.closest('.vue-flow__node')).transform).e);
  const writeRequested = page.waitForRequest(request => request.url().endsWith(orderRoute + '/layout'));
  await drag(page, step(order, 'start'), 35, 24);
  await writeRequested;
  assert.equal(await writeReachedDisk.promise, 200);
  const whileSaving = await readJSON(orderPath);
  assert.notEqual(whileSaving.layout.positions.start.x, startX);
  await order.getByTestId('layout-status').filter({ hasText: '正在保存布局' }).waitFor();
  await choose(page, legendLoopId);
  const pathsGrouped = await saveAction(page, paths, legendRoute + '/layout', legendPath,
    () => addGroup(paths, '闭环路径', ['日志路径', 'node:path · 标准库']));
  const pathsEdited = await saveAction(page, paths, legendRoute + '/layout', legendPath, async () => {
    await paths.getByRole('button', { name: '分组操作 · 闭环路径' }).click();
    await button(paths, '调整成员').click();
    await paths.getByRole('checkbox', { name: '日志路径', exact: true }).uncheck();
    await button(paths, '应用分组').click();
  });
  assert.deepEqual(pathsEdited.layout.groups[0].members, [legendId]);
  assert.deepEqual(pathsGrouped.layout.groups[0].members, ['audit', legendId]);
  const reordered = await saveAction(page, paths, legendRoute + '/layout', legendPath, () => button(paths, '重新布局').click());
  assert.deepEqual(reordered.layout.groups, pathsEdited.layout.groups);
  const movedGroup = await saveAction(page, paths, legendRoute + '/layout', legendPath,
    () => drag(page, paths.locator('.group-handle').filter({ hasText: '闭环路径' }), 80, 55));
  assert.notDeepEqual(movedGroup.layout.positions[legendId], reordered.layout.positions[legendId]);
  for (const id of ['upload', 'audit']) assert.deepEqual(movedGroup.layout.positions[id], reordered.layout.positions[id]);
  await saveAction(page, paths, legendRoute + '/layout', legendPath, () => drag(page, legend(paths), 20, 37));
  await paths.locator('.loop-reader-toggle').click();
  await paths.locator('.canvas-inspector').waitFor({ state: 'hidden' });
  await saveAction(page, paths, legendRoute + '/layout', legendPath, () => drag(page, paths.locator('.graph-area'), -30, 48, [0.9, 0.85]));
  const pathsFinal = await saveAction(page, paths, legendRoute + '/layout', legendPath, () => button(paths, '放大画布').click());
  const lateResponse = page.waitForResponse(response => response.url().endsWith(orderRoute + '/layout'));
  releaseWrite.resolve();
  await lateResponse;
  await saved(paths);
  assert.deepEqual(await readJSON(legendPath), pathsFinal);
  assert.deepEqual(await readJSON(orderPath), whileSaving);
  await choose(page, orderId);
  await saved(order);
  const orderMoved = await saveAction(page, order, orderRoute + '/layout', orderPath, () => drag(page, step(order, 'resume'), -48, 55));
  assert.deepEqual(orderMoved.layout.positions.start, whileSaving.layout.positions.start);
  assert.notEqual(orderMoved.layout.positions.resume.x, whileSaving.layout.positions.resume.x);
  report.checks.push('late A save completed during B edits; members-only group drag, removal, rearrange, separate step coordinates');

  await button(page, '文件依赖图').click();
  const dependency = canvas(page);
  await saved(dependency);
  const dependencyInitial = await readJSON(project.layout);
  for (const [id, point] of Object.entries(oldDependency.layout.positions)) assert.deepEqual(dependencyInitial.layout.positions[id], point);
  assert.deepEqual(dependencyInitial.layout.groups, oldDependency.layout.groups);
  assert.deepEqual(dependencyInitial.layout.viewport, oldDependency.layout.viewport);
  const dependencyRoute = '/api/dependency-layout';
  await saveAction(page, dependency, dependencyRoute, project.layout,
    async () => {
      await openDependencyGroups(page);
      await addGroup(dependency, '依赖图路径', [audit, 'node:path · 标准库']);
    });
  await button(dependency, '关闭分组').click();
  const arranged = await saveAction(page, dependency, dependencyRoute, project.layout, () => button(dependency, '重新布局').click());
  const depLegend = await saveAction(page, dependency, dependencyRoute, project.layout, () => drag(page, legend(dependency), 57, 61));
  assert.notDeepEqual(depLegend.layout.positions[legendId], arranged.layout.positions[legendId]);
  await saveAction(page, dependency, dependencyRoute, project.layout, () => drag(page, dependency.locator('.graph-area'), 65, 18, [0.9, 0.85]));
  const dependencyFinal = await saveAction(page, dependency, dependencyRoute, project.layout, () => button(dependency, '缩小画布').click());
  assert.deepEqual(dependencyFinal.layout.groups.find(group => group.name === '依赖图路径').members, [audit, legendId]);
  assert.notDeepEqual(dependencyFinal.layout.positions[legendId], pathsFinal.layout.positions[legendId]);
  assert.notDeepEqual(dependencyFinal.layout.viewport, pathsFinal.layout.viewport);
  await button(page, '文件讲解').click();
  await page.locator('#reading').waitFor();
  await context.close();
  await reader.server.close();
  report.checks.push('legacy dependency layout reconciles; same library has different position, membership and viewport');

  reader = await startReader(project.projectRoot, 0);
  context = await browser.newContext({ viewport: { width: 1650, height: 980 } });
  context.setDefaultTimeout(10_000);
  const reopened = await openPage(context, reader.url);
  const afterOrder = await choose(reopened, orderId);
  await saved(afterOrder);
  for (const id of ['start', 'resume']) await assertLayout(step(afterOrder, id), orderMoved.layout.positions[id], orderMoved.layout.viewport);
  const afterPaths = await choose(reopened, legendLoopId);
  await saved(afterPaths);
  await assertLayout(legend(afterPaths), pathsFinal.layout.positions[legendId], pathsFinal.layout.viewport);
  await afterPaths.locator('.group-handle').filter({ hasText: '闭环路径' }).waitFor();
  await button(reopened, '文件依赖图').click();
  const afterDependency = canvas(reopened);
  await saved(afterDependency);
  await assertLayout(legend(afterDependency), dependencyFinal.layout.positions[legendId], dependencyFinal.layout.viewport);
  await afterDependency.getByRole('button', { name: '分组操作 · 依赖图路径', exact: true }).waitFor();
  assert.deepEqual(await Promise.all([orderPath, legendPath, project.layout].map(readJSON)), [orderMoved, pathsFinal, dependencyFinal]);
  report.checks.push('new browser context and restarted service restored all three disk layouts');

  await button(reopened, '闭环阅读').click();
  await choose(reopened, orderId);
  const other = await openPage(context, reader.url);
  const otherOrder = await choose(other, orderId);
  await saved(otherOrder);
  const winner = await saveAction(other, otherOrder, orderRoute + '/layout', orderPath, () => button(otherOrder, '放大画布').click());
  await button(afterOrder, '缩小画布').click();
  await afterOrder.getByRole('alert').filter({ hasText: 'LAYOUT_CONFLICT' }).waitFor();
  assert.deepEqual(await readJSON(orderPath), winner);
  assert.equal(await afterOrder.locator('.canvas-zoom output').innerText(), '83%');
  reopened.once('dialog', dialog => dialog.accept());
  await button(afterOrder, '读取已保存布局').click();
  await saved(afterOrder);
  assert.equal(await afterOrder.locator('.canvas-zoom output').innerText(), '120%');
  await reopened.route('**' + orderRoute + '/layout', route => route.fulfill({ status: 422, json: { ok: false, error: {
    code: 'LAYOUT_WRITE_FAILED', message: '', nextStep: '', context: { reason: 'EACCES' },
  } } }), { times: 1 });
  await button(afterOrder, '放大画布').click();
  await afterOrder.getByRole('alert').filter({ hasText: 'LAYOUT_WRITE_FAILED' }).waitFor();
  await choose(reopened, legendLoopId);
  await saved(afterPaths);
  await choose(reopened, orderId);
  await afterOrder.getByRole('alert').filter({ hasText: 'LAYOUT_WRITE_FAILED' }).waitFor();
  assert.deepEqual(await readJSON(orderPath), winner);
  assert.equal(await afterOrder.locator('.canvas-zoom output').innerText(), '144%');
  await saveAction(reopened, afterOrder, orderRoute + '/layout', orderPath, () => button(afterOrder, '重试保存').click());
  assert.deepEqual(await Promise.all(files.map(file => readFile(file))), contents);
  report.checks.push('stale tab conflict preserved disk and draft; injected EACCES response stayed with A and exact draft retried');

  const doc = explanationFile(project, api);
  await writeFile(doc, (await readFile(doc, 'utf8')).replace('入口提取上传文件名。', '新的当前文件讲解。'));
  const oid = git(project, 'rev-parse', project.commit + ':' + api).trim();
  const object = path.join(project.projectRoot, '.git/objects', oid.slice(0, 2), oid.slice(2));
  await rename(object, object + '.off');
  try {
    await choose(reopened, legendLoopId);
    await button(afterPaths, '刷新图和布局').click();
    await step(afterPaths, 'upload').click();
    await afterPaths.locator('.loop-reader-toggle').click();
    await lesson(afterPaths, 'upload').locator('.loop-source-trigger').click();
    await reopened.locator('#loop-source-' + legendLoopId).getByRole('alert').getByText('固定源码不可用', { exact: true }).waitFor();
    await lesson(afterPaths, 'upload').getByText('读这段代码的完整讲解', { exact: true }).click();
    await lesson(afterPaths, 'upload').getByText('入口提取上传文件名。', { exact: true }).waitFor();
    await lesson(afterPaths, 'upload').locator('[data-choice="audit"]').click();
    await lesson(afterPaths, 'audit').getByText('这里有文件名，需要拼出日志路径。', { exact: true }).waitFor();
    assert.equal(await lesson(afterPaths, 'audit').locator('.loop-source-trigger').count(), 0);
    await saveAction(reopened, afterPaths, legendRoute + '/layout', legendPath, () => button(afterPaths, '放大画布').click());
  } finally { await rename(object + '.off', object); }
  report.checks.push('old saved explanation, missing source diagnostic, pure explanation and usable layout');

  if (channel === 'edge') {
    await reopened.setViewportSize({ width: 390, height: 844 });
    assert.ok(await reopened.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await reopened.screenshot({ path: path.join(run, 'mobile.png'), fullPage: true });
  }
  const orderArtifact = artifact(project, orderId);
  const savedOrder = await readFile(orderArtifact);
  const invalidOrder = JSON.parse(savedOrder);
  invalidOrder.nodes[0].title = '';
  await writeFile(orderArtifact, JSON.stringify(invalidOrder));
  try {
    await openCatalog(reopened);
    await button(reopened, '刷新闭环列表').click();
    const problem = reopened.locator('#loop-navigation').getByRole('alert').filter({ hasText: 'LOOP_INVALID' });
    await problem.getByText('LOOP_INVALID order-quantity $.nodes[0].title TEXT', { exact: true }).waitFor();
    await reopened.getByLabel('界面语言').selectOption('en');
    await problem.getByText(/Check the indicated field/u).waitFor();
    await problem.getByText('LOOP_INVALID order-quantity $.nodes[0].title TEXT', { exact: true }).waitFor();
    await lesson(afterPaths, 'audit').waitFor();
  } finally { await writeFile(orderArtifact, savedOrder); }
  report.checks.push('invalid loop list shows field and reason in both languages while the valid loop stays readable');
  assert.deepEqual(errors, []);
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  delayedRead?.();
  delayedWrite?.();
  await context?.close();
  await reader?.server.close();
  await browser.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ run, channel, version: report.version, checks: report.checks.length, ok: !report.error }));
}
