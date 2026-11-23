// Run against a disposable project for edits. Baseline/author passes are read-only.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { chooseLoop } from '../../tests/browser/loop-controls.mjs';

const [url, mode, output, project] = process.argv.slice(2);
assert.equal(new URL(url).hostname, '127.0.0.1');
const editing = ['legacy', 'layout'].includes(mode);
const id = 'question-bookmark-request';
const loopAPI = '/api/loops/' + id;
const data = path.join(project ?? '.', 'docs/aftertaste');
const file = 'internal/controller/collection_controller.go';
const loopLink = url + '/#aftertaste-loop/' + id + '/request';
const get = async route => (await fetch(url + route)).json();
if (editing) {
  assert.equal(path.basename(project), 'legacy-check');
  assert.equal(path.resolve((await get('/api/documents')).projectRoot), path.resolve(project));
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
context.setDefaultTimeout(12000);
const errors = [];
const report = { mode, browser: browser.version() };
const persist = () => writeFile(path.join(output, mode + '-checks.json'), JSON.stringify(report, null, 2));
const snap = name => path.join(output, mode + '-' + name + '.png');
let page;
async function open(address) {
  if (page) await page.close();
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(address);
}
async function tree() {
  await open(url);
  const nav = page.locator('#reader-file-navigation');
  await nav.locator('.directory-button').first().waitFor();
  while (await nav.locator('[aria-expanded=false]').count()) await nav.locator('[aria-expanded=false]').first().click();
  const target = nav.locator('[title="' + file + '"]');
  await target.focus();
  await page.keyboard.press('Enter');
  await nav.locator('[aria-current=page][title="' + file + '"]').waitFor();
  await nav.locator('.navigation-scroll').evaluate(el => el.scrollTo(0, 0));
  report.tree = await nav.evaluate(el => {
    const box = el.querySelector('.navigation-scroll').getBoundingClientRect();
    const buttons = [...el.querySelectorAll('.file-list button')];
    const visible = buttons.filter(b => b.getBoundingClientRect().top >= box.top && b.getBoundingClientRect().bottom <= box.bottom);
    return { files: el.querySelectorAll('.file-button').length, rows: buttons.length, visible: visible.length,
      sidebar: el.closest('.sidebar').offsetWidth, treeWidth: el.offsetWidth, main: document.querySelector('#reading').clientWidth, rowHeight: buttons[0].offsetHeight,
      longNames: buttons.filter(b => b.lastElementChild?.scrollWidth > b.lastElementChild?.clientWidth).map(b => b.title) };
  });
  assert.equal(report.tree.files, 14);
  if (mode !== 'baseline') {
    assert.ok(report.tree.treeWidth <= report.tree.sidebar);
    assert.ok(report.tree.longNames.length && report.tree.longNames.every(name => name.includes('/')));
  }
  await nav.screenshot({ path: snap('tree') });
  const folder = nav.locator('[title="internal/controller"]');
  await folder.click();
  assert.equal(await target.count(), 0);
  await folder.focus();
  await page.keyboard.press('Enter');
  await target.waitFor();
  const divider = page.locator('.sidebar-divider');
  await divider.focus();
  await page.keyboard.press('ArrowDown');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.app-page-menu-toggle').waitFor();
  const toggle = page.locator('.reader-navigation-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const next = nav.locator('.file-button').filter({ hasText: 'collection_group_repo.go' });
  await next.waitFor();
  report.touchHeight = (await next.boundingBox()).height;
  await next.click();
  await page.locator('#reading h1').filter({ hasText: 'collection_group_repo.go' }).waitFor();
  assert.ok(report.touchHeight >= 44);
  await page.setViewportSize({ width: 1440, height: 900 });
}
async function saved(scope, action) {
  const response = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith('layout'));
  await action();
  assert.equal((await response).status(), 200);
  await scope.locator('[data-state=canvasSaved]').waitFor({ state: 'attached' });
}
async function graph(kind) {
  const loop = kind === 'loop';
  const route = loop ? loopAPI : '/api/dependency-canvas';
  const address = loop ? loopLink : url + '/#canvas-reading';
  const before = await get(route);
  const ids = loop ? before.result.loop.reading_order : before.graph.nodes.map(n => n.path).sort((a,b) =>
    before.layout.positions[a].y - before.layout.positions[b].y || before.layout.positions[a].x - before.layout.positions[b].x);
  const main = loop ? '[data-step=request]' : '[data-file="' + ids[0] + '"]';
  const active = () => page.locator(loop ? '#loop-canvas-' + id + '-reading' : '#canvas-reading');
  await open(address);
  const canvas = active();
  await canvas.locator(main).waitFor();
  if (loop) await canvas.locator('.loop-reader-toggle[aria-expanded=true]').click();
  const start = await canvas.locator(main).boundingBox();
  assert.ok(start && start.x >= 0 && start.x + start.width < 1440 && start.y < 900);
  if (loop) {
    const steps = before.result.loop;
    const p = before.layout.positions;
    for (const e of steps.edges) assert.ok(p[e.from].x < p[e.to].x);
    const fork = steps.edges.filter(e => e.from === 'choose-branch').map(e => p[e.to]);
    assert.equal(fork.length, 2);
    assert.notEqual(fork[0].y, fork[1].y);
    assert.equal(steps.edges.filter(e => e.to === 'send-http').length, 2);
    const next = steps.edges.find(e => e.from === steps.entry).to;
    assert.ok((await canvas.locator('[data-step="' + next + '"]').boundingBox()).x < 1200);
    const uses = steps.nodes.flatMap(n => n.library_uses ?? []);
    await canvas.locator('.library-use-edge').first().waitFor({ state: 'attached' });
    assert.equal(await canvas.locator('.library-use-edge').count(), uses.length);
  }
  await page.mouse.move(4, 60);
  const paths = canvas.locator('.edge-ink .vue-flow__edge-path');
  const opacity = () => paths.evaluateAll(lines => lines.map(line => Number(getComputedStyle(line).opacity)));
  await page.waitForTimeout(130);
  const initialInk = await opacity();
  assert.ok(initialInk.length && initialInk.every(alpha => alpha > 0 && alpha <= .13));
  await canvas.screenshot({ path: snap(kind) });
  const key = ids[0];
  const incident = before.relations.edges.filter(e => e.from === key || e.to === key).length +
    before.relations.libraries.filter(lib => lib.targets.includes(key)).length;
  const hoverCard = canvas.locator(main);
  await hoverCard.hover();
  await page.waitForTimeout(140);
  const lit = await opacity();
  assert.equal(lit.filter(alpha => alpha === 1).length, incident);
  const flowId = id => id.startsWith('legend:') ? id : 'file:' + encodeURIComponent(id);
  const edges = [...before.relations.edges, ...before.relations.libraries.flatMap(lib =>
    lib.targets.map(to => ({ from: lib.id, to })))];
  const expected = edges.filter(e => e.from === key || e.to === key).map(e => flowId(e.from) + '→' + flowId(e.to)).sort();
  const actual = await canvas.locator('.edge-lit').evaluateAll(lines => lines.map(line =>
    line.closest('.vue-flow__edge').getAttribute('data-id')).sort());
  assert.deepEqual(actual, expected);
  assert.ok(incident > 0 && lit.some(alpha => alpha <= .13));
  await canvas.screenshot({ path: snap(kind + '-hover') });
  await page.mouse.move(4, 60);
  await page.waitForTimeout(140);
  assert.deepEqual(await opacity(), initialInk);
  await page.keyboard.press('Tab');
  await hoverCard.focus();
  await page.waitForTimeout(140);
  assert.equal((await opacity()).filter(alpha => alpha === 1).length, incident);
  assert.equal((await get(route)).revision, before.revision);
  report[kind + 'Ink'] = { total: lit.length, incident, restingOpacity: initialInk[0], hoverOpacity: 1 };
  await persist();
  if (!editing) {
    report[kind] = { nodes: ids.length, edges: before.relations.edges.length, libraries: before.relations.libraries, start };
    return;
  }
  assert.equal(before.revision, null);
  const node = canvas.locator(main);
  await saved(canvas, async () => {
    const b = await node.boundingBox();
    await page.mouse.move(b.x + 50, b.y + 24);
    await page.mouse.down();
    await page.mouse.move(b.x + 90, b.y + 74, { steps: 10 });
    await page.mouse.up();
  });
  await canvas.getByRole('button', { name: '编辑分组', exact: true }).click();
  await canvas.getByLabel('组名').fill('本次试读');
  for (const key of ids.slice(0, 2)) {
    const checkbox = canvas.locator('input[type=checkbox][value="' + key + '"]');
    await checkbox.check();
    assert.ok(await checkbox.isChecked());
  }
  await saved(canvas, () => canvas.getByRole('button', { name: '应用分组' }).click());
  if (await canvas.getByRole('button', { name: '关闭分组' }).isVisible()) await canvas.getByRole('button', { name: '关闭分组' }).click();
  await saved(canvas, () => canvas.getByRole('button', { name: '缩小画布' }).click());
  const manual = (await get(route)).layout;
  assert.deepEqual([...manual.groups[0].members].sort(), ids.slice(0, 2).sort());
  assert.notDeepEqual(manual.positions[ids[0]], before.layout.positions[ids[0]]);
  assert.notDeepEqual(manual.viewport, before.layout.viewport);
  await open(address);
  await active().locator(main).waitFor();
  const transform = await active().locator(main).evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el.closest('.vue-flow__node')).transform).toJSON());
  assert.ok(Math.abs(transform.e - manual.positions[ids[0]].x) < .01);
  const graphPath = path.join(data, loop ? 'loops/' + id + '/current/loop.json' : 'dependency-graph.json');
  const content = JSON.parse(await readFile(graphPath, 'utf8'));
  const extra = loop ? 'd046-extra' : 'internal/d046-extra.go';
  if (loop) {
    const { library_uses, ...sameFile } = content.nodes[0];
    assert.ok(library_uses?.length);
    content.nodes.push({ ...sameFile, id: extra, title: '同文件普通判断' });
    content.edges.push({ from: ids[0], to: extra, reason: '增点校验' });
    content.reading_order.push(extra);
  } else {
    content.nodes.push({ path: extra, analysis: 'unreviewed' });
    content.edges.push({ dependency: ids[0], dependent: extra, reason: '增点校验' });
  }
  await writeFile(graphPath, JSON.stringify(content));
  const added = (await get(route)).layout;
  const { [extra]: newPoint, ...previous } = added.positions;
  assert.deepEqual(previous, manual.positions);
  assert.deepEqual(added.groups, manual.groups);
  assert.deepEqual(added.viewport, manual.viewport);
  for (const point of Object.values(previous)) assert.ok(Math.abs(newPoint.x-point.x) >= 212 || Math.abs(newPoint.y-point.y) >= 56);
  await saved(active(), () => active().getByRole('button', { name: '刷新图和布局' }).click());
  await saved(active(), () => active().getByRole('button', { name: '重新布局' }).click());
  if (loop) {
    const arrows = await active().locator('.library-use-edge').evaluateAll(edges => edges.map(e => e.getAttribute('data-id')));
    assert.ok(arrows.length && arrows.every(edge => !edge.endsWith('→file:' + extra)));
  }
  const reset = (await get(route)).layout;
  assert.deepEqual(reset.viewport, before.layout.viewport);
  assert.deepEqual(reset.groups, manual.groups);
  await open(address);
  await active().locator(main).waitFor();
  assert.deepEqual((await get(route)).layout, reset);
  if (loop) {
    await active().locator('.loop-reader-toggle[aria-expanded=true]').click();
    const fork = active().locator('[data-step="choose-branch"]');
    // Follow the route using the canvas hand tool, staying inside the viewport for each gesture.
    for (let i = 0; i < ids.length; i++) {
      const box = await fork.boundingBox();
      if (box.x < 280) break;
      const distance = Math.min(500, box.x - 150);
      await page.waitForFunction(() => document.elementFromPoint(720, 550)?.closest('.vue-flow__pane'));
      await saved(active(), async () => {
        await page.mouse.move(720, 550);
        await page.mouse.down();
        await page.mouse.move(716, 550);
        await page.mouse.move(716 - distance, 550, { steps: 12 });
        await page.mouse.up();
      });
    }
    const branchBox = await fork.boundingBox();
    assert.ok(branchBox.x >= 0 && branchBox.x < 280);
    await fork.hover();
    await page.waitForTimeout(140);
    await active().screenshot({ path: snap('branch') });
    await fork.click();
    await active().locator('.loop-reader-toggle').click();
    const branch = active().locator('[data-reading-step=choose-branch]');
    for (const edge of before.result.loop.edges.filter(e => e.from === 'choose-branch')) {
      await branch.locator('[data-choice="' + edge.to + '"]').click();
      const target = active().locator('[data-reading-step="' + edge.to + '"]');
      assert.ok((await target.locator('.loop-step-explanation').innerText()).length);
      await target.locator('[data-incoming=choose-branch]').click();
    }
    await saved(active(), () => active().getByRole('button', { name: '重新布局' }).click());
    const legend = active().locator('[data-legend]').first();
    await legend.focus();
    await legend.press('Enter');
    const details = active().locator('section[aria-label="所选库图例"]');
    await details.getByRole('button').first().click();
    await active().locator('[data-reading-step]').waitFor();
  }
  report[kind] = { first: before.layout, manual, added, reset, count: ids.length };
}
try {
  if (mode === 'tree' || mode === 'baseline' || mode === 'author') await tree();
  if (mode === 'author') {
    const link = url + '/#aftertaste-block/' + encodeURIComponent('docs/aftertaste/current/' + file + '.md') + '/vmi6gwjc';
    await open(link);
    await page.locator('#reading h1').filter({ hasText: 'collection_controller.go' }).waitFor();
    await page.locator('.file-button[aria-current=page][title="' + file + '"]').waitFor();
    report.article = link;
  }
  if (mode === 'touch') {
    const touch = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
    for (const kind of ['dependency', 'loop']) {
      const tab = await touch.newPage();
      if (kind === 'loop') {
        await tab.goto(loopLink);
        await tab.locator('.loop-reader-toggle').tap();
      } else await tab.goto(url + '/#canvas-reading');
      const canvas = tab.locator(kind === 'loop' ? '.loop-canvas:visible' : '#canvas-reading');
      const card = canvas.locator(kind === 'loop' ? '[data-step=request]' : '[data-file="internal/entity/collection_entity.go"]');
      await card.tap();
      await canvas.locator('.edge-lit').first().waitFor({ state: 'attached' });
      await tab.waitForTimeout(150);
      const values = await canvas.locator('.edge-ink .vue-flow__edge-path').evaluateAll(paths =>
        paths.map(line => Number(getComputedStyle(line).opacity)));
      assert.ok(values.some(v => v === 1) && values.some(v => v > 0 && v <= .13));
      report[kind] = { lit: values.filter(v => v === 1).length, total: values.length };
      await tab.close();
    }
    await touch.close();
  }
  if (mode === 'legacy') {
    const before = await get(loopAPI);
    const hidden = Object.keys(before.layout.positions).filter(key => key.startsWith('legend:'));
    assert.equal(hidden.length, 2);
    const mixed = { id: crypto.randomUUID(), name: '旧混合组', members: ['request', hidden[0]] };
    const only = { id: crypto.randomUUID(), name: '旧库组', members: [hidden[1]] };
    const res = await fetch(url + loopAPI + '/layout', { method: 'PUT',
      headers: { 'content-type': 'application/json', 'X-Aftertaste-Layout': '1', Origin: url },
      body: JSON.stringify({ graphVersion: before.graphVersion, expectedRevision: before.revision, revision: crypto.randomUUID(),
        layout: { ...before.layout, positions: Object.entries(before.layout.positions), groups: [mixed,only] } }) });
    assert.equal(res.status, 200);
    await open(loopLink);
    const scope = page.locator('.loop-canvas:visible');
    await scope.locator('[data-step=request]').waitFor();
    assert.equal(await scope.locator('[data-legend]').count(), 0);
    await scope.locator('.loop-overview-link').click();
    for (const legend of before.result.loop.legends) {
      const details = scope.locator('.loop-overview details').filter({ has: page.locator('summary', { hasText: legend.name }) });
      await details.locator('summary').click();
      assert.ok((await details.innerText()).includes(legend.uses[0].reason));
    }
    await saved(scope, () => scope.getByRole('button', { name: '重新布局' }).click());
    const after = await get(loopAPI);
    assert.deepEqual(after.layout.groups, [mixed,only]);
    for (const key of hidden) assert.deepEqual(after.layout.positions[key], before.layout.positions[key]);
    report.legacy = { hidden, groups: after.layout.groups, restored: after.layout.positions };
    // Same disposable route with no libraries, fresh personal layout.
    const filePath = path.join(data, 'loops', id, 'current/loop.json');
    const empty = { ...before.result.loop, id: 'd046-no-libraries', legends: [] };
    const emptyDir = path.join(path.dirname(filePath), '../../d046-no-libraries/current');
    await mkdir(emptyDir, { recursive: true });
    await writeFile(path.join(emptyDir, 'loop.json'), JSON.stringify(empty));
    await open(url + '/#aftertaste-loop/d046-no-libraries/request');
    await page.locator('[data-reading-step=request]').waitFor();
    assert.equal(await page.locator('.loop-canvas:visible [data-legend]').count(), 0);
  }
  if (mode === 'layout' || mode === 'author') {
    if (!page) await open(url);
    await graph('dependency');
    await graph('loop');
    await open(url + '/#canvas-reading');
    const dep = page.locator('#canvas-reading');
    await dep.locator('[data-file]').first().waitFor();
    const listing = await get('/api/dependency-canvas');
    await chooseLoop(page, id);
    await dep.locator('[data-route-member]').first().waitFor();
    assert.deepEqual((await get('/api/dependency-canvas')).layout, listing.layout);
    await dep.locator('.route-read').click();
    await page.locator('.loop-canvas:visible [data-step=request]').waitFor();
    report.highlight = '选择闭环后坐标一致，阅读入口打开正确步骤图';
  }
  await persist();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
