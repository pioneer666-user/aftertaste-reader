import { startTestReader, openReader } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { chromium, firefox } from 'playwright';
import { applyGraphUpdate, repository } from '../fixtures/dependency-canvas.mjs';
import { audit, createLegendProject, legendId, readJSON, rules, standardLegend, thirdPartyLegend,
  updatedDescription, writeJSON } from '../fixtures/dependency-legends.mjs';
import { dependencySaved as saved, openDependencyGroups, refreshDependency } from './dependency-controls.mjs';

const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D014');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'browser-' + channel + '-'));
const project = await createLegendProject(path.join(run, 'project'));
const browser = await (channel === 'firefox' ? firefox.launch() : chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel }));
const report = { run, fixedCommit: project.commit, browser: channel, version: browser.version(), os: release(), node: process.version };
const button = (page, name) => page.getByRole('button', { name, exact: true });
const member = (page, name) => page.getByRole('checkbox', { name, exact: true });
const file = (page, name) => page.locator(`[data-file="${name}"]`);
const legend = (page, id = standardLegend.id) => page.locator(`[data-legend="${id}"]`);
const detail = page => page.locator('.canvas-details');
const summary = page => page.locator('.canvas-summary');
const disk = () => readJSON(project.layout);
const responseForLayout = page => page.waitForResponse(response => response.url().endsWith('/api/dependency-layout'));

async function withService(check) {
  const reader = await startTestReader(project.projectRoot, 0);
  const context = await browser.newContext({ viewport: { width: 1650, height: 980 } });
  const errors = [];
  context.on('page', page => {
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
  });
  try {
    const result = await check(context, reader.url);
    assert.deepEqual(errors, []);
    return result;
  } finally {
    try { await context.close(); }
    finally { await reader.server.close(); }
  }
}

async function openCanvas(context, url) {
  const page = await context.newPage();
  await openReader(page, url);
  await button(page, '文件依赖图').click();
  return page;
}

async function savedAction(page, action) {
  const [response] = await Promise.all([responseForLayout(page), action()]);
  assert.equal(response.status(), 200, await response.text());
  await saved(page);
  assert.equal((await disk()).revision, (await response.json()).revision);
}

async function drag(page, target, dx, dy, anchor = [0.5, 0.5]) {
  const box = await target.boundingBox();
  assert.ok(box, 'visible drag target');
  const x = box.x + box.width * anchor[0], y = box.y + box.height * anchor[1];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4, y);
  await page.mouse.move(x + 4 + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

async function assertVisibleLayout(page, layout) {
  const actual = await legend(page).evaluate(element => {
    const node = new DOMMatrixReadOnly(getComputedStyle(element.closest('.vue-flow__node')).transform);
    const view = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.vue-flow__transformationpane')).transform);
    return [node.e, node.f, view.e, view.f, view.a];
  });
  const point = layout.positions[legendId];
  const view = layout.viewport;
  for (const [index, expected] of [point.x, point.y, view.x, view.y, view.zoom].entries()) {
    assert.ok(Math.abs(actual[index] - expected) < 0.015, `canvas transform ${actual[index]} vs ${expected}`);
  }
}

try {
  const initial = await disk();
  let beforeUpdate;
  await withService(async (context, url) => {
    const page = await openCanvas(context, url);
    await saved(page);
    assert.deepEqual(await disk(), initial);
    const thirdParty = { ...thirdPartyLegend, name: rules };
    await applyGraphUpdate(project, { legendUpserts: [standardLegend, thirdParty] });
    const graphBytes = await readFile(project.graph);
    await savedAction(page, () => refreshDependency(page));
    const added = await disk();
    for (const [id, point] of Object.entries(initial.layout.positions)) assert.deepEqual(added.layout.positions[id], point);
    assert.deepEqual(added.layout.groups, initial.layout.groups);
    assert.deepEqual(added.layout.viewport, initial.layout.viewport);
    assert.equal(await page.locator('.library-use-edge').count(), 3);

    await legend(page).focus();
    await page.keyboard.press('Enter');
    await detail(page).getByText(standardLegend.description, { exact: true }).waitFor();
    for (const use of standardLegend.uses) await detail(page).getByText(use.reason, { exact: true }).waitFor();
    assert.equal(await summary(page).getByRole('button', { name: '阅读讲解' }).count(), 0);
    await page.getByLabel('界面语言').selectOption('en');
    await summary(page).getByText('Standard library', { exact: true }).waitFor();
    await detail(page).getByText(standardLegend.description, { exact: true }).waitFor();
    for (const use of standardLegend.uses) await detail(page).getByText(use.reason, { exact: true }).waitFor();
    await page.getByLabel('Interface language').selectOption('zh-CN');

    const thirdCard = legend(page, thirdParty.id);
    const box = await thirdCard.boundingBox();
    const pane = await page.locator('.graph-area').boundingBox();
    const pans = Math.ceil(Math.max(0, pane.x + 60 - box.x) / (pane.width * .2));
    for (let i = 0; i < pans; i++) await savedAction(page, () => page.locator('.dependency-minimap').press('ArrowLeft'));
    await thirdCard.click();
    await summary(page).getByRole('heading', { name: rules, exact: true }).waitFor();
    await summary(page).getByText('第三方库', { exact: true }).waitFor();
    assert.equal(await file(page, rules).getAttribute('aria-pressed'), 'false');
    assert.equal(await summary(page).getByRole('button', { name: '阅读讲解' }).count(), 0);
    await file(page, rules).click();
    assert.equal(await legend(page, thirdParty.id).getAttribute('aria-pressed'), 'false');
    await button(page, '阅读讲解').click();
    await page.locator('.document-header h1').filter({ hasText: rules }).waitFor();
    await button(page, '后退').click();
    await saved(page);

    await openDependencyGroups(page);
    await page.getByLabel('组名').fill('路径工具');
    await member(page, audit).check();
    await member(page, 'node:path · 标准库').check();
    await savedAction(page, () => button(page, '应用分组').click());
    await openDependencyGroups(page);
    await page.getByRole('combobox', { name: '编辑分组' }).selectOption('');
    await page.getByLabel('组名').fill('同名对象');
    await member(page, rules).check();
    await member(page, rules + ' · 第三方库').check();
    await savedAction(page, () => button(page, '应用分组').click());
    const grouped = await disk();
    assert.deepEqual(grouped.layout.groups.find(group => group.name === '同名对象').members, [rules, 'legend:zod']);
    await member(page, rules + ' · 第三方库').uncheck();
    await savedAction(page, () => button(page, '应用分组').click());
    const reassigned = await disk();
    assert.deepEqual(reassigned.layout.groups.find(group => group.name === '同名对象').members, [rules]);
    await button(page, '关闭分组').click();
    await button(page, '清除选择').click();
    await savedAction(page, async () => {
      await button(page, '重新布局').click();
      await button(page.getByRole('dialog'), '重新布局').click();
    });
    const rearranged = await disk();
    assert.deepEqual(rearranged.layout.groups, reassigned.layout.groups);
    assert.notDeepEqual(rearranged.layout.positions[legendId], reassigned.layout.positions[legendId]);

    await savedAction(page, () => drag(page, legend(page), 35, 36));
    const movedLegend = await disk();
    assert.notDeepEqual(movedLegend.layout.positions[legendId], rearranged.layout.positions[legendId]);
    assert.deepEqual(movedLegend.layout.positions[audit], rearranged.layout.positions[audit]);
    await savedAction(page, () => button(page, '放大画布').click());
    const beforeGroupDrag = await disk();
    await savedAction(page, () => drag(page, page.locator('.group-handle[title="路径工具"]'), 100, 60));
    const afterGroupDrag = await disk();
    const moved = afterGroupDrag.layout.positions[legendId];
    const before = beforeGroupDrag.layout.positions[legendId];
    assert.ok(moved.x > before.x && moved.y > before.y);
    assert.ok(Math.abs((moved.x - before.x) - (afterGroupDrag.layout.positions[audit].x - beforeGroupDrag.layout.positions[audit].x)) < 0.001);
    assert.ok(Math.abs((moved.y - before.y) - (afterGroupDrag.layout.positions[audit].y - beforeGroupDrag.layout.positions[audit].y)) < 0.001);
    assert.deepEqual(afterGroupDrag.layout.positions[rules], beforeGroupDrag.layout.positions[rules]);
    await savedAction(page, () => drag(page, page.locator('.graph-area'), 30, -20, [0.62, 0.75]));
    beforeUpdate = await disk();
    assert.notDeepEqual(beforeUpdate.layout.viewport, afterGroupDrag.layout.viewport);
    assert.deepEqual(await readFile(project.graph), graphBytes);
    report.savedBeforeUpdate = beforeUpdate;
  });

  await applyGraphUpdate(project, { legendUpserts: [{ id: standardLegend.id, description: updatedDescription }] });
  await withService(async (context, url) => {
    const page = await openCanvas(context, url);
    await saved(page);
    await assertVisibleLayout(page, beforeUpdate.layout);
    await legend(page).click();
    await detail(page).getByText(updatedDescription, { exact: true }).waitFor();
    for (const use of standardLegend.uses) await detail(page).getByText(use.reason, { exact: true }).waitFor();
    assert.deepEqual(await disk(), beforeUpdate);
    await page.screenshot({ path: path.join(run, 'reopened.png') });
    const graphBytes = await readFile(project.graph);
    const layoutBytes = await readFile(project.layout);
    const graph = JSON.parse(graphBytes);
    await writeJSON(project.graph, { ...graph, legends: graph.legends.filter(item => item.id !== standardLegend.id) });
    await refreshDependency(page);
    await page.getByRole('alert').getByText(/LAYOUT_GRAPH_UNCONFIRMED/u).waitFor();
    assert.deepEqual(await readFile(project.layout), layoutBytes);
    await writeJSON(project.graph, { ...graph, legends: null });
    await refreshDependency(page);
    await page.getByRole('alert').getByText(/GRAPH_INVALID.*\.legends/u).waitFor();
    assert.deepEqual(await readFile(project.layout), layoutBytes);
    await writeFile(project.graph, graphBytes);
    await refreshDependency(page);
    await saved(page);
    await assertVisibleLayout(page, beforeUpdate.layout);
    assert.deepEqual(await readFile(project.layout), layoutBytes);
    report.reopenedAndRecovered = true;

    await openDependencyGroups(page);
    await page.getByRole('combobox', { name: '编辑分组' }).selectOption(beforeUpdate.layout.groups.find(group => group.name === '路径工具').id);
    await member(page, audit).uncheck();
    await savedAction(page, () => button(page, '应用分组').click());
    const beforeRemoval = await disk();
    await applyGraphUpdate(project, { legendRemove: [standardLegend.id] });
    const [denied] = await Promise.all([responseForLayout(page), drag(page, legend(page), 30, 15)]);
    assert.equal(denied.status(), 409);
    await page.getByRole('alert').getByText(/LAYOUT_GRAPH_CHANGED/u).waitFor();
    assert.deepEqual(await disk(), beforeRemoval);
    const fresh = await context.newPage();
    await openReader(fresh, url);
    await savedAction(fresh, () => button(fresh, '文件依赖图').click());
    const afterRemoval = await disk();
    const { [legendId]: _, ...positions } = beforeRemoval.layout.positions;
    assert.deepEqual(afterRemoval.layout, { positions, groups: beforeRemoval.layout.groups.filter(group => group.name !== '路径工具'),
      viewport: beforeRemoval.layout.viewport });
    report.afterRemoval = afterRemoval;
    report.staleStatus = denied.status();
  });
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  await writeJSON(path.join(run, 'result.json'), report);
  console.log(JSON.stringify({ run, browser: channel, version: report.version, ok: !report.error }));
  await browser.close();
}
