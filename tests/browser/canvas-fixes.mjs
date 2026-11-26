import { startTestReader, openReader, fetchReaderRoute, readerFetch } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { chromium, firefox } from 'playwright';
import { applyGraphUpdate, createCanvasProject, repository } from '../fixtures/dependency-canvas.mjs';
import { dependencyOptions, dependencySaved as saved, openDependencyGroups, refreshDependency } from './dependency-controls.mjs';

const rules = 'src/rules.mjs', service = 'src/service.mjs', audit = 'support/audit.mjs';
const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
const root = path.join(repository, '.local/D013');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'browser-' + channel + '-'));
const browser = await (channel === 'firefox' ? firefox.launch() : chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel }));
const report = { run, browser: channel, version: browser.version(), os: release(), node: process.version, cases: {} };
const fixture = name => createCanvasProject(path.join(run, name));
const button = (page, name) => page.getByRole('button', { name, exact: true });
const node = (page, id) => page.locator(`[data-file="${id}"]`);
const disk = async project => JSON.parse(await readFile(project.layout, 'utf8'));
const write = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n');
const viewport = page => page.locator('.vue-flow__transformationpane').evaluate(element => getComputedStyle(element).transform);

async function withService(project, check) {
  const reader = await startTestReader(project.projectRoot, 0);
  const context = await browser.newContext({ viewport: { width: 1600, height: 980 } });
  const problems = [];
  context.on('page', page => {
    page.setDefaultTimeout(6500);
    page.on('pageerror', error => problems.push(error.message));
  });
  try {
    const result = await check(reader.url, context);
    assert.deepEqual(problems, []);
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

const layoutResponse = page => page.waitForResponse(response => response.url().endsWith('/api/dependency-layout'));
async function savedAction(page, action) {
  const [response] = await Promise.all([layoutResponse(page), action()]);
  assert.equal(response.status(), 200, await response.text());
  await saved(page);
  return (await response.json()).revision;
}

async function drag(page, target, dx, dy) {
  const box = await target.boundingBox();
  assert.ok(box, 'visible drag target');
  const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4, y);
  await page.mouse.move(x + 4 + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

function moved(before, after, id) {
  assert.notDeepEqual(after.positions[id], before.positions[id]);
  for (const [path, point] of Object.entries(before.positions)) {
    if (path !== id) assert.deepEqual(after.positions[path], point);
  }
}

async function expectPoint(page, id, expected) {
  const actual = await node(page, id).evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element.closest('.vue-flow__node')).transform);
    return { x: matrix.e, y: matrix.f };
  });
  for (const axis of ['x', 'y']) assert.ok(Math.abs(actual[axis] - expected[axis]) < 0.015,
    `${id} ${axis}: ${actual[axis]} vs ${expected[axis]}`);
}

function seedLayout(project, positions, groups = [], viewport = { x: 0, y: 0, zoom: 1 }) {
  return write(project.layout, { format: 'aftertaste-canvas-layout/v1', graph: 'dependency', revision: randomUUID(),
    layout: { positions, groups, viewport } });
}

async function emptyGraph() {
  const project = await fixture('empty');
  const initial = await withService(project, async (url, context) => {
    const page = await openCanvas(context, url);
    await openDependencyGroups(page);
    await page.getByLabel('组名').fill('Start');
    await page.getByRole('checkbox', { name: rules, exact: true }).check();
    await savedAction(page, () => button(page, '应用分组').click());
    await savedAction(page, () => button(page, '放大画布').click());
    return disk(project);
  });
  const original = await readFile(project.graph);
  const graph = JSON.parse(original);
  await write(project.graph, { ...graph, nodes: [], edges: [] });
  await withService(project, async (url, context) => {
    const page = await openCanvas(context, url);
    await page.getByText(/LAYOUT_GRAPH_UNCONFIRMED/u).waitFor();
    assert.deepEqual(await disk(project), initial);
  });
  await writeFile(project.graph, original);
  await applyGraphUpdate(project, { remove: [rules, service, audit] });
  const final = await withService(project, async (url, context) => {
    const page = await context.newPage();
    await openReader(page, url);
    await savedAction(page, () => button(page, '文件依赖图').click());
    await page.getByText('依赖图已建立，当前没有文件。').waitFor();
    const empty = await disk(project);
    assert.deepEqual(empty.layout, { positions: {}, groups: [], viewport: initial.layout.viewport });
    assert.notEqual(empty.revision, initial.revision);
    assert.ok(await button(await dependencyOptions(page), '刷新图和布局').isEnabled());
    await applyGraphUpdate(project, { register: [rules] });
    await savedAction(page, () => refreshDependency(page));
    await node(page, rules).waitFor();
    const returned = (await disk(project)).layout;
    await savedAction(page, () => drag(page, node(page, rules), 80, 50));
    const placed = await disk(project);
    moved(returned, placed.layout, rules);
    return { empty, returned, placed };
  });
  await withService(project, async (url, context) => {
    const page = await openCanvas(context, url);
    await saved(page);
    await expectPoint(page, rules, final.placed.layout.positions[rules]);
    assert.equal(await page.locator('.canvas-zoom output').innerText(), '120%');
    assert.deepEqual(await disk(project), final.placed);
  });
  return { initial, ...final, unconfirmedEmptyProtected: true };
}

async function samePath() {
  const positions = { [rules]: { x: 30, y: 64 }, [service]: { x: 300, y: 64 }, [audit]: { x: 722, y: 55 } };
  const groups = [{ id: randomUUID(), name: 'Audit', members: [audit] }];
  const view = { x: 20, y: 18, zoom: 1.2 };
  const expected = { positions: { ...positions, [audit]: { x: 570, y: 64 } }, groups: [], viewport: view };
  const results = {};
  for (const name of ['closed', 'between']) {
    const project = await fixture(name);
    await applyGraphUpdate(project, { reviews: [{ path: service, analysis: 'reviewed',
      dependencies: [{ path: rules, reason: '数量校验' }] }] });
    const originalGraph = await readFile(project.graph);
    await seedLayout(project, positions, groups, view);
    await applyGraphUpdate(project, { remove: [audit] });
    if (name === 'between') {
      await withService(project, async (url, context) => {
        const page = await openCanvas(context, url);
        await saved(page);
        assert.deepEqual((await disk(project)).layout, {
          positions: { [rules]: positions[rules], [service]: positions[service] }, groups: [], viewport: view,
        });
      });
    }
    await applyGraphUpdate(project, { register: [audit] });
    assert.deepEqual(await readFile(project.graph), originalGraph);
    results[name] = await withService(project, async (url, context) => {
      const page = await openCanvas(context, url);
      await saved(page);
      const reset = (await disk(project)).layout;
      assert.deepEqual(reset, expected);
      await savedAction(page, () => drag(page, node(page, audit), 65, 85));
      const placed = (await disk(project)).layout;
      moved(reset, placed, audit);
      await refreshDependency(page);
      await saved(page);
      assert.deepEqual((await disk(project)).layout, placed);
      return { reset, placed };
    });
    if (name === 'closed') {
      results.stale = await withService(project, async (url, context) => {
        const page = await openCanvas(context, url);
        await saved(page);
        await expectPoint(page, audit, results[name].placed.positions[audit]);
        await openDependencyGroups(page);
        await page.getByLabel('组名').fill('Old tab');
        await page.getByRole('checkbox', { name: audit, exact: true }).check();
        await savedAction(page, () => button(page, '应用分组').click());
        const old = await disk(project);
        await applyGraphUpdate(project, { remove: [audit] });
        await applyGraphUpdate(project, { register: [audit] });
        assert.deepEqual(await readFile(project.graph), originalGraph);
        const edited = JSON.parse(originalGraph);
        edited.edges[0].reason += '（文字修订）';
        await write(project.graph, edited);
        const preview = await readerFetch(url + '/api/dependency-canvas').then(response => response.json());
        assert.deepEqual(preview.layout.positions[audit], expected.positions[audit]);
        assert.deepEqual(preview.layout.groups, []);
        await writeFile(project.graph, originalGraph);
        const reply = layoutResponse(page);
        await button(page, '放大画布').click();
        const rejected = await reply;
        assert.equal(rejected.status(), 409);
        assert.equal((await rejected.json()).error.code, 'LAYOUT_GRAPH_CHANGED');
        assert.deepEqual(await disk(project), old);
        await savedAction(page, () => button(page, '刷新图并保留本页布局').click());
        const recovered = (await disk(project)).layout;
        assert.deepEqual(recovered.positions, expected.positions);
        assert.deepEqual(recovered.groups, []);
        assert.equal(recovered.viewport.zoom, 1.44);

        await openDependencyGroups(page);
        await page.getByLabel('组名').fill('Temporary');
        await page.getByRole('checkbox', { name: audit, exact: true }).check();
        await savedAction(page, () => button(page, '应用分组').click());
        const beforePartial = await disk(project);
        const graph = JSON.parse(originalGraph);
        await write(project.graph, { ...graph, nodes: graph.nodes.filter(node => node.path !== audit) });
        await refreshDependency(page);
        await page.getByText(/LAYOUT_GRAPH_UNCONFIRMED/u).waitFor();
        assert.deepEqual(await disk(project), beforePartial);
        await writeFile(project.graph, originalGraph);
        await refreshDependency(page);
        await saved(page);
        assert.deepEqual(await disk(project), beforePartial);
        await expectPoint(page, audit, beforePartial.layout.positions[audit]);
        await button(page, '分组操作 · Temporary').waitFor();
        return { http: rejected.status(), recovered, temporary: beforePartial.layout };
      });
    }
  }
  assert.deepEqual(results.closed.reset, results.between.reset);
  results.latestDraft = await retainReaddedDraft();
  return results;
}

async function retainReaddedDraft() {
  const project = await fixture('latest-draft');
  const group = async (page, name) => {
    await openDependencyGroups(page);
    await page.getByLabel('组名').fill(name);
    await page.getByRole('checkbox', { name: audit, exact: true }).check();
    await button(page, '应用分组').click();
  };
  await seedLayout(project, { [rules]: { x: 30, y: 64 }, [service]: { x: 300, y: 64 }, [audit]: { x: 722, y: 55 } },
    [{ id: randomUUID(), name: 'Original', members: [audit] }]);
  await applyGraphUpdate(project, { remove: [audit] });
  await applyGraphUpdate(project, { register: [audit] });
  const final = await withService(project, async (url, context) => {
    const page = await openCanvas(context, url);
    await saved(page);
    await savedAction(page, () => group(page, 'First accepted'));
    const first = await disk(project);
    await applyGraphUpdate(project, { remove: [audit] });
    const marks = async () => JSON.parse(await readFile(path.join(project.data, 'dependency-graph-removals.json'))).at(-1).removals;
    const removed = await marks();
    await applyGraphUpdate(project, { remove: [audit] });
    assert.deepEqual(await marks(), removed);
    await applyGraphUpdate(project, { register: [audit] });
    const full = await readFile(project.graph);
    const current = await readerFetch(url + '/api/dependency-canvas').then(response => response.json());
    assert.notEqual(first.nodeRemovals[audit], current.nodeRemovals[audit]);
    assert.equal(current.nodeRemovals[audit], removed[audit]);
    assert.deepEqual(current.layout.positions[audit], { x: 570, y: 64 });
    const release = Promise.withResolvers();
    await page.route('**/api/dependency-layout', async route => {
      await release.promise;
      await route.continue();
    }, { times: 1 });
    try {
      await Promise.all([page.waitForRequest(request => request.url().endsWith('/api/dependency-layout')),
        refreshDependency(page)]);
      await drag(page, node(page, audit), 98, 91);
      await group(page, 'Second latest');
      await button(page, '分组操作 · Second latest').waitFor();
      const point = { x: current.layout.positions[audit].x + 98, y: current.layout.positions[audit].y + 91 };
      await expectPoint(page, audit, point);
      const graph = JSON.parse(full);
      await write(project.graph, { ...graph, nodes: graph.nodes.filter(item => item.path !== service),
        edges: graph.edges.filter(edge => edge.dependent !== service && edge.dependency !== service) });
      const rejected = layoutResponse(page);
      release.resolve();
      const conflict = await rejected;
      assert.equal(conflict.status(), 409);
      assert.equal((await conflict.json()).error.code, 'LAYOUT_GRAPH_CHANGED');
      await button(page, '刷新图并保留本页布局').click();
      await page.getByText(/LAYOUT_GRAPH_UNCONFIRMED/u).waitFor();
      await expectPoint(page, audit, point);
      await button(page, '分组操作 · Second latest').waitFor();
      assert.deepEqual(await disk(project), first);
      await writeFile(project.graph, full);
      await savedAction(page, () => button(page, '刷新图并保留本页布局').click());
      const placed = await disk(project);
      assert.deepEqual(placed.layout.positions[audit], point);
      assert.deepEqual(placed.layout.groups.map(({ name, members }) => [name, members]), [['Second latest', [audit]]]);
      assert.equal(placed.nodeRemovals[audit], current.nodeRemovals[audit]);
      return placed;
    } finally { release.resolve(); }
  });
  await withService(project, async (url, context) => {
    const page = await openCanvas(context, url);
    await saved(page);
    await expectPoint(page, audit, final.layout.positions[audit]);
    await button(page, '分组操作 · Second latest').waitFor();
    assert.deepEqual(await disk(project), final);
  });
  return final;
}

async function specialName() {
  const project = await fixture('special-name');
  const special = '__proto__', neighbor = 'neighbor.mjs';
  for (const id of [special, neighbor]) await writeFile(path.join(project.projectRoot, id), 'export const value = 1;\n');
  const git = (...args) => execFileSync('git', ['-C', project.projectRoot, '-c', 'core.autocrlf=false', '-c', 'user.name=Synthetic Fixture',
    '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', windowsHide: true });
  git('add', '--', special, neighbor);
  git('commit', '-m', 'fixture for path keys');
  project.commit = git('rev-parse', 'HEAD').trim();
  await unlink(project.graph);
  await applyGraphUpdate(project, { register: [neighbor] });
  const oldPosition = { x: 160, y: 120 };
  await seedLayout(project, { [neighbor]: oldPosition });
  await applyGraphUpdate(project, { register: [special] });
  const final = await withService(project, async (url, context) => {
    const page = await context.newPage();
    await openReader(page, url);
    await savedAction(page, () => button(page, '文件依赖图').click());
    const initial = (await disk(project)).layout;
    assert.deepEqual(initial.positions[neighbor], oldPosition);
    assert.ok(Object.hasOwn(initial.positions, special));
    await savedAction(page, () => drag(page, node(page, neighbor), 65, 45));
    const first = (await disk(project)).layout;
    moved(initial, first, neighbor);
    await savedAction(page, () => drag(page, node(page, special), 85, 75));
    const second = (await disk(project)).layout;
    moved(first, second, special);
    return { initial, first, second };
  });
  await withService(project, async (url, context) => {
    const page = await openCanvas(context, url);
    await saved(page);
    for (const id of [special, neighbor]) await expectPoint(page, id, final.second.positions[id]);
  });
  return final;
}

async function lateList() {
  const project = await fixture('late-list');
  const file = path.join(project.data, 'current', service + '.md');
  const waiting = path.join(run, 'new-explanation.md');
  await rename(file, waiting);
  return withService(project, async (url, context) => {
    const page = await context.newPage();
    const intercepted = Promise.withResolvers(), releaseList = Promise.withResolvers();
    await page.route('**/api/documents', async route => {
      const response = await fetchReaderRoute(route);
      intercepted.resolve(await response.json());
      await releaseList.promise;
      await route.fulfill({ response });
    }, { times: 1 });
    const title = page.locator('.document-header h1');
    const refresh = button(page, '刷新资料');
    const body = () => page.locator('.explanation-pane .markdown').allTextContents();
    try {
      await openReader(page, url);
      const { documents } = await intercepted.promise;
      assert.deepEqual(documents.map(entry => entry.sourcePath), [rules]);
      await rename(waiting, file);
      await button(page, '文件依赖图').click();
      await savedAction(page, () => button(page, '放大画布').click());
      const view = await viewport(page);
      await node(page, service).click();
      await button(page, '阅读讲解').click();
      await title.filter({ hasText: service }).waitFor();
      const before = await body();
      assert.ok(before.some(text => text.includes('数量')));
      releaseList.resolve();
      await refresh.and(page.locator(':enabled')).waitFor();
      assert.equal(await title.textContent(), service);
      assert.deepEqual(await body(), before);
      await button(page, '后退').click();
      assert.equal(await viewport(page), view);
      await button(page, '文件讲解').click();
      await refresh.click();
      await refresh.and(page.locator(':enabled')).waitFor();
      assert.equal(await title.textContent(), service);
      assert.deepEqual(await body(), before);
      await page.locator('#reader-navigation .file-list').getByTitle(rules, { exact: true }).click();
      await title.filter({ hasText: rules }).waitFor();
      await page.locator('#reader-navigation .file-list').getByTitle(service, { exact: true }).click();
      await title.filter({ hasText: service }).waitFor();
      const fresh = await context.newPage();
      await openReader(fresh, url);
      await fresh.locator('.document-header h1').filter({ hasText: rules }).waitFor();
      return { staleList: [rules], title: service, blocks: before.length, viewport: view, default: rules };
    } finally { releaseList.resolve(); }
  });
}

try {
  for (const [id, check] of Object.entries({ F1: emptyGraph, F2: samePath, F3: specialName, F4: lateList })) {
    if (process.argv.length > 2 && !process.argv.includes(id)) continue;
    try {
      report.cases[id] = await check();
      console.log(id + ' passed');
    } catch (error) {
      report.cases[id] = { error: error.stack };
      console.error(id, error);
      process.exitCode = 1;
    }
  }
} finally {
  await browser.close();
  await write(path.join(run, 'result.json'), report);
  console.log(path.join(run, 'result.json'));
}
