import { chooseLoop } from './loop-controls.mjs';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { readJSON, writeJSON } from '../fixtures/dependency-legends.mjs';
import { orderId } from '../fixtures/loop-authoring.mjs';
import { createLoopReaderProject, loopLayout } from '../fixtures/loop-reader.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
const root = path.join(repository, '.local/' + (process.env.AFTERTASTE_TEST_TASK ?? 'D031'));
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'canvas-' + channel + '-'));
const project = await createLoopReaderProject(path.join(run, 'project'));
const disk = loopLayout(project, orderId);
const dependencyBefore = await readFile(project.layout);
const protectedNames = ['bookmarks.json', 'understanding-marks.json', 'notes.json'];
for (const name of protectedNames) await copyFile(new URL('../fixtures/page-preview/' + name, import.meta.url), path.join(project.data, name));
const protectedBefore = await Promise.all(protectedNames.map(name => readFile(path.join(project.data, name))));
let seed;
const report = { run, browser: channel, os: release(), node: process.version, commit: project.commit, checks: [], errors: [] };
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const near = (actual, expected, tolerance = 1) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `expected ${actual} within ${tolerance} of ${expected}`);
let reader;
let browser;

try {
  reader = await startReader(project.projectRoot, 0);
  const initial = await (await fetch(new URL('/api/loops/' + orderId, reader.url))).json();
  assert.equal(initial.revision, null);
  seed = { layout: initial.layout };
  browser = await (channel === 'firefox' ? firefox.launch() : chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel }));
  report.version = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(reader.url);
  await button(page, '闭环阅读').click();
  await chooseLoop(page, orderId);
  const loop = page.locator('#loop-canvas-' + orderId + '-reading');
  const area = loop.locator('.graph-area');
  const hand = button(loop, '抓手工具');
  const select = button(loop, '选择工具');
  const node = id => loop.locator(`[data-step="${id}"]`);
  await hand.waitFor();
  await node('check').waitFor();
  await page.waitForFunction(() => document.querySelector('.loop-canvas [data-testid="layout-status"]')?.getAttribute('data-state') === 'canvasDefault');
  await assert.rejects(readFile(disk), { code: 'ENOENT' });

  const view = () => area.locator('.vue-flow__transformationpane').evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
  const assertTool = async name => {
    assert.equal(await area.getAttribute('data-tool'), name);
    assert.equal(await (name === 'hand' ? hand : select).getAttribute('aria-pressed'), 'true');
    assert.equal(await (name === 'hand' ? select : hand).getAttribute('aria-pressed'), 'false');
  };
  async function save(action) {
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/loops/' + orderId + '/layout') && response.request().method() === 'PUT'),
      action(),
    ]);
    assert.equal(response.status(), 200, await response.text());
    const ack = await response.json();
    await page.waitForFunction(() => document.querySelector('.loop-canvas [data-testid="layout-status"]')?.getAttribute('data-state') === 'canvasSaved');
    assert.equal((await readJSON(disk)).revision, ack.revision);
    return readJSON(disk);
  }
  async function drag(from, to, midway) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    try {
      // Cross the node pickup threshold at a known point before interpolating the drag.
      await page.mouse.move(from.x + 2, from.y);
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
      await midway?.();
      await page.mouse.move(to.x, to.y, { steps: 6 });
    } finally { await page.mouse.up(); }
  }
  const blank = async () => {
    const bounds = await area.boundingBox();
    for (const y of [bounds.height - 12, bounds.height - 100, 16]) {
      for (const x of [bounds.width - 16, bounds.width / 2, 16]) {
        const point = { x: bounds.x + x, y: bounds.y + y };
        const free = await page.evaluate(({ x, y }) => {
          const target = document.elementFromPoint(x, y);
          return !!target?.closest('.vue-flow__pane') && !target.closest('.file-node, .group-handle, .canvas-dock, .canvas-node-hint');
        }, point);
        if (free) return point;
      }
    }
    throw new Error('No blank graph point available');
  };

  const initialView = await view();
  await assertTool('hand');
  const panFrom = await blank();
  const panTo = { x: panFrom.x + 36, y: panFrom.y + 24 };
  const panned = await save(() => drag(panFrom, panTo));
  near(panned.layout.viewport.x - seed.layout.viewport.x, 36);
  near(panned.layout.viewport.y - seed.layout.viewport.y, 24);
  assert.deepEqual(panned.layout.positions, seed.layout.positions);
  report.checks.push('hand pans and saves only the loop viewport');

  await area.focus();
  await page.keyboard.down('Control');
  await assertTool('select');
  const startBox = await node('start').boundingBox();
  const checkBox = await node('check').boundingBox();
  const from = { x: Math.floor(Math.min(startBox.x, checkBox.x) - 8), y: Math.floor(Math.min(startBox.y, checkBox.y) - 8) };
  const to = { x: Math.ceil(Math.max(startBox.x + startBox.width, checkBox.x + checkBox.width) + 8),
    y: Math.ceil(Math.max(startBox.y + startBox.height, checkBox.y + checkBox.height) + 8) };
  assert.ok(await page.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('.file-node, .group-handle'), from));
  await drag(from, to, async () => {
    await loop.locator('.canvas-selection-rect').waitFor();
    await assertTool('select');
  });
  await page.keyboard.up('Control');
  await assertTool('hand');
  assert.deepEqual((await loop.locator('[data-box-selected="true"]').evaluateAll(elements => elements.map(element => element.dataset.step))).sort(),
    ['check', 'start']);
  await page.keyboard.press('Control+g');
  const input = loop.locator('#canvas-selection-name');
  await input.waitFor();
  await loop.getByText('已选 2 项', { exact: true }).waitFor();
  await input.fill('入口与校验');
  const grouped = await save(() => input.press('Enter'));
  assert.deepEqual(grouped.layout.groups.map(group => [group.name, [...group.members].sort()]), [['入口与校验', ['check', 'start']]]);
  assert.deepEqual(grouped.layout.viewport, panned.layout.viewport);
  await loop.locator('.group-frame').filter({ hasText: '入口与校验' }).waitFor();
  report.checks.push('Ctrl temporarily selects, box selection marks loop steps, Ctrl+G names and saves their group');

  await select.click();
  await assertTool('select');
  await page.keyboard.down('Control');
  await assertTool('hand');
  const reverseFrom = await blank();
  const reverseTo = { x: reverseFrom.x - 18, y: reverseFrom.y - 12 };
  const reversed = await save(() => drag(reverseFrom, reverseTo, async () => {
    await page.keyboard.up('Control');
    await assertTool('hand');
  }));
  near(reversed.layout.viewport.x - panned.layout.viewport.x, -18);
  near(reversed.layout.viewport.y - panned.layout.viewport.y, -12);
  await assertTool('select');
  await hand.click();
  report.checks.push('selection tool temporarily reverses to hand and releasing Ctrl keeps the fixed tool');

  const draggedNode = node('resume');
  await draggedNode.hover();
  await page.waitForTimeout(180);
  const translate = () => draggedNode.evaluate(element => {
    const value = getComputedStyle(element).translate;
    return value === 'none' ? 0 : Number.parseFloat(value.split(/\s+/)[1] ?? '0') || 0;
  });
  near(await translate(), -2, .1);
  const dragBox = await draggedNode.boundingBox();
  const dragFrom = { x: dragBox.x + dragBox.width / 2, y: dragBox.y + dragBox.height / 2 };
  const dragTo = { x: dragFrom.x + 24, y: dragFrom.y + 36 };
  const moved = await save(() => drag(dragFrom, dragTo, async () => {
    await draggedNode.evaluate(element => element.closest('.vue-flow__node')?.classList.contains('dragging')).then(value => assert.equal(value, true));
    assert.equal(await translate(), 0, 'dragging cancels visual lift');
  }));
  // Vue Flow's default node drag threshold accounts for the two-pixel pickup delta.
  near(moved.layout.positions.resume.x - seed.layout.positions.resume.x, 24, 2);
  near(moved.layout.positions.resume.y - seed.layout.positions.resume.y, 36, 2);
  await page.mouse.move(12, 90);
  await page.waitForTimeout(180);
  assert.equal(await translate(), 0);
  await draggedNode.hover();
  await page.waitForTimeout(180);
  near(await translate(), -2, .1);
  assert.deepEqual(moved.layout.groups, grouped.layout.groups);
  report.checks.push('node rises on hover, follows a real drag without lift, then returns to hover feedback');

  assert.deepEqual(await readFile(project.layout), dependencyBefore);
  assert.deepEqual(await Promise.all(protectedNames.map(name => readFile(path.join(project.data, name)))), protectedBefore);
  assert.deepEqual(report.errors, []);
  await writeJSON(path.join(run, 'final-loop-layout.json'), moved);
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await browser?.close();
  await reader?.server.close();
  await writeJSON(path.join(run, 'report.json'), report);
  console.log(JSON.stringify({ run, channel, version: report.version, checks: report.checks.length, ok: !report.failure }));
}
