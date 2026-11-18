import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium, firefox } from 'playwright';
import { applyGraphUpdate, cli, createCanvasProject, repository } from '../fixtures/dependency-canvas.mjs';

const name = process.env.AFTERTASTE_BROWSER ?? 'edge';
const runRoot = path.join(repository, '.local/D012');
await mkdir(runRoot, { recursive: true });
const run = await mkdtemp(path.join(runRoot, `browser-${name}-`));
const fixture = await createCanvasProject(path.join(run, 'project'));
const port = process.env.AFTERTASTE_CANVAS_PORT ?? '4320';
const rules = 'src/rules.mjs', service = 'src/service.mjs', audit = 'support/audit.mjs', api = 'src/api.mjs';
const report = { run, project: fixture.projectRoot, commit: fixture.commit, serverPids: [], browser: name, checks: {} };
const problems = [];
let child, browser, page, locker;

async function readyProcess(command, args, pattern, extra = {}) {
  const proc = spawn(command, args, { cwd: run, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], ...extra });
  let stdout = '', stderr = '';
  try {
    const line = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Start timed out: ${stderr}`)), 15000);
      proc.once('error', error => { clearTimeout(timer); reject(error); });
      proc.once('exit', code => { clearTimeout(timer); reject(new Error(`Process exited ${code}: ${stdout} ${stderr}`)); });
      proc.stderr.on('data', chunk => { stderr += chunk; });
      proc.stdout.on('data', chunk => {
        stdout += chunk;
        const matched = stdout.split(/\r?\n/u).find(line => pattern.test(line));
        if (matched) { clearTimeout(timer); resolve(matched); }
      });
    });
    return { proc, line };
  } catch (error) {
    if (proc.exitCode === null && proc.pid) proc.kill();
    throw error;
  }
}

async function start() {
  const { proc, line } = await readyProcess(process.execPath,
    [cli, 'serve', '--project', fixture.projectRoot, '--port', port], /"status":"ready"/u);
  child = proc;
  report.serverPids.push(proc.pid);
  return JSON.parse(line).url;
}

async function stop() {
  if (browser) { await browser.close(); browser = undefined; }
  if (child && child.exitCode === null && child.signalCode === null) {
    const ended = once(child, 'exit');
    child.kill();
    await ended;
  }
  child = undefined;
}

async function open(url) {
  browser = await (name === 'firefox' ? firefox.launch() : chromium.launch({ channel: name === 'edge' ? 'msedge' : 'chrome' }));
  report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  page = await context.newPage();
  page.on('pageerror', error => problems.push(error.message));
  await page.goto(url);
  await page.getByRole('button', { name: '文件依赖图', exact: true }).click({ timeout: 5000 });
  await node(service).waitFor();
}

const node = id => page.locator(`[data-file="${id}"]`);
const status = () => page.getByTestId('layout-status');
const disk = async () => JSON.parse(await readFile(fixture.layout, 'utf8'));
const saved = async () => { await status().filter({ hasText: '布局已保存' }).waitFor(); return (await disk()).layout; };
const equalWithin = (actual, expected, epsilon = 0.015) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} vs ${expected}`);

async function drag(locator, dx, dy) {
  const box = await locator.boundingBox();
  assert.ok(box, 'visible drag target');
  const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Vue Flow captures the drag origin once the threshold is crossed.
  await page.mouse.move(x + 4, y);
  await page.mouse.move(x + 4 + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

async function addGroup(title, ids) {
  await page.getByLabel('编辑分组').selectOption('');
  await page.getByLabel('组名').fill(title);
  for (const id of ids) await page.getByRole('checkbox', { name: id, exact: true }).check();
  await page.getByRole('button', { name: '应用分组', exact: true }).click();
  await saved();
}

function visibleLayout() {
  return page.evaluate(() => {
    const matrix = element => new DOMMatrixReadOnly(getComputedStyle(element).transform);
    const view = matrix(document.querySelector('.vue-flow__transformationpane'));
    const coordinates = element => {
      const parent = element.closest('.vue-flow__node');
      const point = matrix(parent);
      return { x: point.e, y: point.f, width: parent.offsetWidth, height: parent.offsetHeight };
    };
    return {
      viewport: { x: view.e, y: view.f, zoom: view.a },
      nodes: Object.fromEntries([...document.querySelectorAll('[data-file]')].map(element => [element.dataset.file, coordinates(element)])),
      groups: Object.fromEntries([...document.querySelectorAll('[data-group]')].map(element => [
        element.querySelector('button').textContent, coordinates(element),
      ])),
    };
  });
}

function compareVisible(view, layout) {
  assert.deepEqual(Object.keys(view.nodes).sort(), Object.keys(layout.positions).sort());
  for (const [id, pos] of Object.entries(layout.positions)) {
    for (const axis of ['x', 'y']) equalWithin(view.nodes[id][axis], pos[axis]);
  }
  for (const axis of ['x', 'y', 'zoom']) equalWithin(view.viewport[axis], layout.viewport[axis]);
  assert.equal(Object.keys(view.groups).length, layout.groups.length);
  for (const group of layout.groups) {
    const bounds = view.groups[group.name];
    const nodes = group.members.map(id => view.nodes[id]);
    equalWithin(bounds.x, Math.min(...nodes.map(n => n.x)) - 20);
    equalWithin(bounds.y, Math.min(...nodes.map(n => n.y)) - 44);
    equalWithin(bounds.x + bounds.width, Math.max(...nodes.map(n => n.x + n.width)) + 20, 1.01);
    equalWithin(bounds.y + bounds.height, Math.max(...nodes.map(n => n.y + n.height)) + 20, 1.01);
  }
}

try {
  const url = await start();
  await open(url);
  const protectedFiles = [fixture.graph, path.join(fixture.projectRoot, service), path.join(fixture.data, 'current/src/service.mjs.md')];
  const protectedBefore = await Promise.all(protectedFiles.map(file => readFile(file)));
  const rawGraph = JSON.parse(protectedBefore[0]);
  const partialGraph = { ...rawGraph, nodes: rawGraph.nodes.filter(node => node.path !== audit),
    edges: rawGraph.edges.filter(edge => edge.dependency !== audit) };
  await writeFile(fixture.graph, JSON.stringify(partialGraph, null, 2) + '\n');
  await page.getByRole('button', { name: '缩小画布' }).click();
  await page.getByText(/LAYOUT_GRAPH_CHANGED/u).waitFor();
  const draft = await visibleLayout();
  await page.getByRole('button', { name: '刷新图并保留本页布局' }).click();
  await page.getByText(/LAYOUT_GRAPH_UNCONFIRMED/u).waitFor();
  assert.deepEqual(await visibleLayout(), draft);
  await assert.rejects(readFile(fixture.layout), { code: 'ENOENT' });
  await writeFile(fixture.graph, protectedBefore[0]);
  await page.getByRole('button', { name: '刷新图并保留本页布局' }).click();
  compareVisible(draft, await saved());
  await page.getByRole('button', { name: '放大画布' }).click();
  await saved();
  report.checks.unsavedDraftSurvivedPartialGraph = true;
  const drawnEdges = page.locator('.vue-flow__edge');
  assert.equal(await drawnEdges.count(), 2);
  assert.equal(await page.locator('.vue-flow__edge-path[marker-end]').count(), 2);
  assert.deepEqual((await drawnEdges.locator('title').allTextContents()).sort(), rawGraph.edges.map(edge => edge.reason).sort());
  await node(service).click();
  const selection = page.locator('.canvas-selection');
  assert.equal(await selection.locator('h2').innerText(), service);
  for (const { reason } of rawGraph.edges) await selection.getByText(reason, { exact: true }).waitFor();
  await page.getByRole('button', { name: '放大画布' }).click();
  const beforeReading = await saved();
  const atReading = (await visibleLayout()).viewport;
  await page.getByRole('button', { name: '阅读讲解' }).click();
  await page.locator('.document-header h1').filter({ hasText: service }).waitFor();
  assert.match(await page.locator('.source-scroll').first().innerText(), /parseQuantity/u);
  await page.getByRole('button', { name: '返回依赖图' }).click();
  assert.deepEqual((await visibleLayout()).viewport, atReading);
  assert.equal((await disk()).layout.viewport.zoom, beforeReading.viewport.zoom);
  await node(audit).focus();
  await node(audit).press('Enter');
  await selection.getByText('依赖尚未核对', { exact: true }).waitFor();
  await selection.getByText('暂无讲解', { exact: true }).waitFor();
  assert.equal(await selection.getByRole('button', { name: '阅读讲解' }).count(), 0);
  await node(rules).click();
  await selection.getByText('已核对，无直接依赖', { exact: true }).waitFor();
  report.checks.reading = { edges: rawGraph.edges, viewport: atReading, returnsToSameViewport: true };

  await drag(node(rules), 24, 168);
  await saved();
  await drag(node(audit), -438, 78);
  await saved();
  await addGroup('读服务', [rules, service]);
  await addGroup('看审计', [audit]);
  const beforeGroup = (await disk()).layout;
  const bounds = (await visibleLayout()).groups['读服务'];
  assert.ok(beforeGroup.positions[audit].x > bounds.x && beforeGroup.positions[audit].y > bounds.y &&
    beforeGroup.positions[audit].x + 212 < bounds.x + bounds.width &&
    beforeGroup.positions[audit].y + 56 < bounds.y + bounds.height, 'other group member lies inside this group');
  await drag(page.getByRole('button', { name: '读服务', exact: true }), 36, 60);
  const afterGroup = await saved();
  for (const id of [rules, service]) {
    equalWithin(afterGroup.positions[id].x - beforeGroup.positions[id].x, 30);
    equalWithin(afterGroup.positions[id].y - beforeGroup.positions[id].y, 50);
  }
  assert.deepEqual(afterGroup.positions[audit], beforeGroup.positions[audit]);
  assert.deepEqual(afterGroup.groups, beforeGroup.groups);
  compareVisible(await visibleLayout(), afterGroup);
  report.checks.groupDrag = { before: beforeGroup, after: afterGroup };

  await page.getByRole('button', { name: '重新布局' }).click();
  const rearranged = await saved();
  assert.deepEqual(rearranged.groups, afterGroup.groups);
  assert.notDeepEqual(rearranged.positions, afterGroup.positions);
  const graphArea = await page.locator('.graph-area').boundingBox();
  await page.mouse.move(graphArea.x + 720, graphArea.y + 340);
  await page.mouse.down();
  await page.mouse.move(graphArea.x + 795, graphArea.y + 380, { steps: 10 });
  await page.mouse.up();
  const panned = await saved();
  assert.ok(Math.abs(panned.viewport.x - rearranged.viewport.x) > 20);
  assert.ok(Math.abs(panned.viewport.y - rearranged.viewport.y) > 20);

  let releaseAck, reachedDisk;
  const ack = new Promise(resolve => { releaseAck = resolve; });
  const onDisk = new Promise(resolve => { reachedDisk = resolve; });
  await page.route('**/api/dependency-layout', async route => {
    const response = await route.fetch();
    reachedDisk();
    await ack;
    await route.fulfill({ response });
  }, { times: 1 });
  const delayedRequest = page.waitForRequest(request => request.url().endsWith('/api/dependency-layout'));
  await page.getByRole('button', { name: '放大画布' }).click();
  try {
    await delayedRequest;
    await onDisk;
    const midpoint = (await disk()).layout;
    await page.getByRole('button', { name: '放大画布' }).click();
    await status().filter({ hasText: '正在保存布局' }).waitFor();
    assert.equal((await disk()).layout.viewport.zoom, midpoint.viewport.zoom);
    report.checks.delayedAcknowledgement = midpoint.viewport;
  } finally { releaseAck(); }
  const delayed = await saved();
  assert.ok(delayed.viewport.zoom > report.checks.delayedAcknowledgement.zoom);
  await page.route('**/api/dependency-layout', async route => {
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    await route.abort('failed');
  }, { times: 1 });
  await page.getByRole('button', { name: '缩小画布' }).click();
  await page.getByText(/NETWORK_ERROR/u).waitFor();
  const lost = await disk();
  assert.ok(lost.layout.viewport.zoom < delayed.viewport.zoom);
  await page.getByRole('button', { name: '放大画布' }).click();
  assert.deepEqual(await disk(), lost);
  await page.getByRole('button', { name: '重试保存' }).click();
  const beforeRestart = await saved();
  assert.deepEqual(beforeRestart.viewport, delayed.viewport);
  report.checks.lostAcknowledgement = { published: lost.layout.viewport, draftSaved: beforeRestart.viewport };
  const beforeRestartView = await visibleLayout();
  compareVisible(beforeRestartView, beforeRestart);
  const originalLayout = await readFile(fixture.layout);
  await page.screenshot({ path: path.join(run, 'before-restart.png'), fullPage: true });
  await stop();
  await assert.rejects(fetch(url), TypeError);
  await open(await start());
  assert.deepEqual(await saved(), beforeRestart);
  assert.deepEqual(await readFile(fixture.layout), originalLayout);
  const afterRestartView = await visibleLayout();
  compareVisible(afterRestartView, beforeRestart);
  assert.deepEqual(afterRestartView, beforeRestartView);
  report.checks.restart = { before: beforeRestartView, after: afterRestartView, disk: beforeRestart };
  await page.screenshot({ path: path.join(run, 'after-restart.png'), fullPage: true });
  assert.deepEqual(await Promise.all(protectedFiles.map(file => readFile(file))), protectedBefore);

  if (process.platform === 'win32') {
    const opened = await readyProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'try { $f = [IO.File]::Open($env:D012_LOCK_FILE, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); [Console]::WriteLine("LOCKED"); [void][Console]::ReadLine() } finally { if ($f) { $f.Close() } }'],
    /^LOCKED$/u, { env: { ...process.env, D012_LOCK_FILE: fixture.layout } });
    locker = opened.proc;
    await drag(node(rules), 32, -18);
    await page.getByText(/LAYOUT_WRITE_FAILED/u).waitFor();
    await status().filter({ hasText: '布局未保存' }).waitFor();
    assert.deepEqual(await readFile(fixture.layout), originalLayout);
    const pending = await visibleLayout();
    assert.notEqual(pending.nodes[rules].x, beforeRestartView.nodes[rules].x);
    await page.screenshot({ path: path.join(run, 'write-failed.png'), fullPage: true });
    const ended = once(locker, 'exit');
    locker.stdin.end('\n');
    await ended;
    locker = undefined;
    await page.getByRole('button', { name: '重试保存' }).click();
    const retried = await saved();
    compareVisible(pending, retried);
    report.checks.lockedWrite = { originalPreserved: true, draft: pending, retry: retried };
  }

  const stale = await browser.newPage();
  await stale.goto(url);
  await stale.getByRole('button', { name: '文件依赖图', exact: true }).click();
  await stale.getByTestId('layout-status').filter({ hasText: '布局已保存' }).waitFor();
  await page.getByRole('button', { name: '缩小画布' }).click();
  const lastSaved = await saved();
  const staleRequest = stale.waitForResponse(response => response.url().endsWith('/api/dependency-layout'));
  await stale.getByRole('button', { name: '放大画布' }).click();
  assert.equal((await staleRequest).status(), 409);
  await stale.getByText(/LAYOUT_CONFLICT/u).waitFor();
  assert.deepEqual((await disk()).layout, lastSaved);
  stale.once('dialog', dialog => dialog.accept());
  await stale.getByRole('button', { name: '读取已保存布局' }).click();
  await stale.getByTestId('layout-status').filter({ hasText: '布局已保存' }).waitFor();
  await stale.close();
  report.checks.staleTab = { conflict: 409, latestPreserved: true };

  const validGraph = await readFile(fixture.graph);
  const authoritative = await readFile(fixture.layout);
  await writeFile(fixture.graph, '{"nodes":[]}');
  await page.getByRole('button', { name: '刷新图和布局' }).click();
  await page.getByText(/GRAPH_INVALID/u).waitFor();
  assert.equal(await page.locator('[data-file]').count(), 3);
  assert.deepEqual(await readFile(fixture.layout), authoritative);
  await writeFile(fixture.graph, JSON.stringify(partialGraph, null, 2) + '\n');
  await page.getByRole('button', { name: '刷新图和布局' }).click();
  await page.getByText(/LAYOUT_GRAPH_UNCONFIRMED/u).waitFor();
  assert.deepEqual(await readFile(fixture.layout), authoritative);
  await writeFile(fixture.graph, validGraph);
  await page.getByRole('button', { name: '刷新图和布局' }).click();
  await node(audit).waitFor();
  assert.deepEqual(await saved(), lastSaved);
  compareVisible(await visibleLayout(), lastSaved);
  await applyGraphUpdate(fixture, { register: [api], remove: [audit], reviews: [
    { path: service, analysis: 'reviewed', dependencies: [{ path: rules, reason: 'updated' }, { path: service, reason: 'self' }] },
    { path: rules, analysis: 'reviewed', dependencies: [{ path: service, reason: 'cycle' }] },
  ] });
  await page.getByRole('button', { name: '刷新图和布局' }).click();
  await node(api).waitFor({ state: 'attached' });
  const updated = await saved();
  assert.deepEqual(updated.positions[rules], lastSaved.positions[rules]);
  assert.deepEqual(updated.positions[service], lastSaved.positions[service]);
  assert.deepEqual(updated.viewport, lastSaved.viewport);
  assert.ok(updated.positions[api].x > Math.max(...Object.values(lastSaved.positions).map(p => p.x)) + 212);
  assert.equal(Object.hasOwn(updated.positions, audit), false);
  assert.deepEqual(updated.groups, lastSaved.groups.filter(group => !group.members.includes(audit)));
  assert.equal(await page.locator('.vue-flow__edge-path[marker-end]').count(), 3);
  const selfLoop = page.locator('.vue-flow__edge').filter({ has: page.locator('title').getByText('self', { exact: true }) });
  assert.match(await selfLoop.locator('.vue-flow__edge-path').getAttribute('d'), / C .* Q /u);
  compareVisible(await visibleLayout(), updated);
  report.checks.graphUpdate = { incompletePreserved: true, validPartialPreserved: true, after: updated, selfAndCycle: true };

  const validLayout = await readFile(fixture.layout);
  await writeFile(fixture.layout, '{"format":');
  await page.getByRole('button', { name: '刷新图和布局' }).click();
  await page.getByText(/LAYOUT_INVALID/u).waitFor();
  assert.equal(await readFile(fixture.layout, 'utf8'), '{"format":');
  assert.equal(await page.getByRole('button', { name: '重新布局' }).isDisabled(), true);
  await writeFile(fixture.layout, validLayout);
  await page.getByRole('button', { name: '刷新图和布局' }).click();
  assert.deepEqual(await saved(), updated);

  await page.getByRole('combobox', { name: '界面语言' }).selectOption('en');
  await status().filter({ hasText: 'Layout saved' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Refresh graph and layout' }).isEnabled(), true);
  await page.setViewportSize({ width: 680, height: 850 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(run, 'narrow-english.png'), fullPage: true });
  assert.deepEqual(problems, []);
  console.log(JSON.stringify({ run, name, checks: Object.keys(report.checks), pids: report.serverPids }));
} catch (error) {
  report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(run, 'failure.png'), fullPage: true, timeout: 3000 }).catch(() => {});
  throw error;
} finally {
  if (locker) locker.stdin.end('\n');
  await stop();
  await writeFile(path.join(run, 'evidence.json'), JSON.stringify(report, null, 2));
}
