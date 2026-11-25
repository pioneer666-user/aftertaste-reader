import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { createEdgeProject, quantityId } from '../fixtures/edge-labels.mjs';
import { readJSON, writeJSON } from '../fixtures/dependency-legends.mjs';

const base = path.join(repository, '.local/D052');
await mkdir(base, { recursive: true });
const run = await mkdtemp(path.join(base, 'browser-'));
const project = path.join(run, 'project');
if (process.env.AFTERTASTE_EDGE_PROJECT) await cp(process.env.AFTERTASTE_EDGE_PROJECT, project, { recursive: true });
else await createEdgeProject(project);
const data = path.join(project, 'docs/aftertaste');
const denseFile = path.join(data, 'loops/input-comparison/current/loop.json');
const dense = await readJSON(denseFile);
for (const edge of dense.edges.filter(e => e.from === 'paths')) edge.label = dense.nodes.find(n => n.id === edge.to).title;
await writeJSON(denseFile, dense);
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const reader = await startReader(project, 0);
let browser;
try {
  const engine = process.env.AFTERTASTE_BROWSER ?? 'msedge';
  browser = engine === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: engine });
  console.log(engine, browser.version(), reader.url, run);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', hasTouch: true });
  page.setDefaultTimeout(7000);
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (req.method() === 'PUT') writes.push(req.url()); });
  const go = async hash => { await page.goto('about:blank'); await page.goto(reader.url + '/#' + hash); };
  const graph = page.locator('.dependency-canvas:visible, .loop-canvas:visible').last();
  const labels = graph.locator('.edge-label text');
  const edge = (from, to) => graph.locator('[data-edge="' + from + '→' + to + '"]');
  const file = key => 'file:' + encodeURIComponent(key);
  const relation = (a, b) => edge(file(a), file(b));
  const shot = tag => page.screenshot({ path: path.join(run, tag + '.png') });
  const spot = async target => {
    const point = await target.locator('.vue-flow__edge-path').evaluate(p => {
      const size = p.getTotalLength();
      for (let i = 0; i < 90; i++) {
        const distance = size * (.5 + (i % 2 ? -1 : 1) * i / 200);
        const pt = p.getPointAtLength(distance).matrixTransform(p.getScreenCTM());
        if (document.elementFromPoint(pt.x, pt.y)?.closest('.edge-ink') === p.parentElement) return { x: pt.x, y: pt.y };
      }
    });
    assert.ok(point, 'a visible curve segment must own its hit area: ' + await target.getAttribute('aria-label'));
    return point;
  };
  const clickEdge = async (target, touch = false) => {
    const { x, y } = await spot(target);
    if (touch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await graph.locator('.edge-details').waitFor();
    assert.equal(await target.getAttribute('aria-pressed'), 'true');
  };
  const close = () => graph.locator('.edge-details .canvas-clear-detail').click();
  const state = () => graph.locator('.vue-flow__node,.vue-flow__transformationpane').evaluateAll(els => els.map(el => el.style.transform));
  const theme = async id => {
    await page.locator('[popovertarget=reader-theme-menu]').click();
    await page.locator('[data-theme-choice="' + id + '"]').click();
  };
  const loopLayout = path.join(data, 'loops', quantityId, 'layout.json');
  const loopBytes = await readFile(loopLayout);
  await go('aftertaste-loop/' + quantityId + '/check');
  const check = graph.locator('[data-step=check]');
  await check.waitFor();
  const toggle = graph.locator('.loop-reader-toggle');
  const pin = graph.locator('.loop-source-trigger');
  const initialState = await state();
  await pin.click();
  const source = page.locator('.loop-source-panel:visible');
  await source.waitFor();
  assert.match(await source.innerText(), /Number\.isInteger/u);
  const green = relation('check', 'build'), red = relation('check', 'reject');
  await clickEdge(green);
  assert.equal(await graph.locator('.detail-edge-label').innerText(), '返回 4');
  await close();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await check.getAttribute('aria-pressed'), 'true');
  assert.equal(await pin.getAttribute('aria-pressed'), 'true');
  assert.ok(await source.isVisible());
  await toggle.click();
  await check.hover();
  assert.deepEqual((await labels.allTextContents()).sort(), ['返回 4','非整数，抛错'].sort());
  const pills = await graph.locator('.edge-label rect').evaluateAll(items => items.map(item => item.getBoundingClientRect().toJSON()));
  const cards = await graph.locator('.file-node').evaluateAll(items => items.map(item => item.getBoundingClientRect().toJSON()));
  const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  assert.ok(!overlap(...pills) && pills.every(pill => cards.every(card => !overlap(pill, card))));
  await shot('quantity-branches');
  await clickEdge(red, true);
  assert.match(await graph.locator('.edge-details').innerText(), /非整数，抛错[\s\S]*4\.5/u);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await graph.locator('.foreground-edges circle').count(), 1);
  const selectedPaint = await graph.locator('.selected-curve').evaluate(el => {
    const marker = el.getAttribute('marker-end').split("#")[1].split("'")[0];
    return [getComputedStyle(el).stroke, getComputedStyle(document.getElementById(marker).querySelector('polyline,path')).fill];
  });
  assert.equal(selectedPaint[0], selectedPaint[1]);
  await shot('selected-curve');
  await clickEdge(relation('build','append'));
  assert.equal(await labels.count(), 0);
  assert.match(await graph.locator('.edge-reason').innerText(), /加入集合/u);
  await clickEdge(edge('legend:number',file('check')));
  assert.equal(await graph.locator('.detail-edge-label').count(), 0);
  assert.equal(await graph.locator('.selected-curve.library-use').count(), 1);
  await graph.locator('.vue-flow__pane').click({ position: { x: 810, y: 500 } });
  assert.equal(await graph.locator('.edge-details').count(), 0);
  assert.equal(await check.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await state(), initialState);
  assert.deepEqual(await readFile(loopLayout), loopBytes);
  assert.equal(writes.length, 0);

  await go('canvas-reading');
  const depFile = path.join(data, 'dependency-layout.json'), depBytes = await readFile(depFile);
  const rules = graph.locator('[data-file="src/rules.mjs"]');
  await rules.waitFor();
  const key = relation('src/rules.mjs', 'src/service.mjs');
  assert.equal(await labels.count(), 0);
  await key.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  assert.ok(await key.evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle === 'none'));
  await graph.locator('.foreground-edges .edge-focus-ring').waitFor({ state: 'attached' });
  await page.keyboard.press('Enter');
  assert.match(await graph.locator('.edge-details').innerText(), /src\/rules.mjs → src\/service.mjs[\s\S]*提供订单数量[\s\S]*数量字段/u);
  await shot('keyboard-focus');
  const colors = new Set();
  for (const id of ['warm','blue','white','black','green']) {
    await theme(id);
    const rgb = await graph.locator('.selected-curve').evaluate(el => getComputedStyle(el).stroke);
    colors.add(rgb);
    if (id === 'black') await shot('dependency-dark');
  }
  assert.equal(colors.size, 5);
  await clickEdge(edge('legend:number',file('src/rules.mjs')));
  assert.equal(await graph.locator('.detail-edge-label').innerText(), '转换数量文本');
  await clickEdge(relation('support/audit.mjs','src/service.mjs'));
  assert.equal(await graph.locator('.detail-edge-label').count(), 0);
  assert.match(await graph.locator('.edge-reason').innerText(), /新编号/u);
  await close();
  assert.deepEqual(await readFile(depFile), depBytes);
  assert.equal(writes.length, 0);
  await theme('black');
  await go('aftertaste-loop/' + quantityId + '/check');
  await toggle.click();
  await check.hover(); await shot('branches-dark');
  await theme('green');
  await go('aftertaste-loop/input-comparison/paths');
  await page.setViewportSize({ width: 540, height: 750 });
  await toggle.click();
  const crowded = graph.locator('[data-step=paths]');
  await crowded.waitFor();
  await crowded.hover();
  const all = dense.edges.filter(e => e.from === 'paths');
  assert.ok(await labels.count() < all.length, 'crowded or off-screen labels are omitted');
  await shot('dense-narrow');
  const saved = async action => {
    const ack = page.waitForResponse(r => r.request().method() === 'PUT');
    await action(); assert.equal((await ack).status(), 200);
  };
  await saved(() => graph.getByRole('button', { name: '缩小画布', exact: true }).click());
  await relation(all[0].from,all[0].to).press('Space');
  assert.equal(await graph.locator('.detail-edge-label').innerText(), all[0].label);
  await page.setViewportSize({ width: 1440, height: 900 });
  await go('canvas-reading');
  const drag = async locator => {
    const rect = await locator.boundingBox();
    const x = rect.x + 22, y = rect.y + rect.height / 2;
    await saved(async () => {
      await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x + 45,y - 24,{ steps: 8 }); await page.mouse.up();
    });
  };
  await rules.waitFor();
  for (const handle of [rules, graph.locator('.group-handle').filter({ hasText: '规则与工具' })]) {
    const line = key.locator('.vue-flow__edge-path');
    const before = await line.getAttribute('d');
    await drag(handle);
    assert.notEqual(await line.getAttribute('d'), before);
    await clickEdge(key);
    assert.equal(await graph.locator('.detail-edge-label').innerText(), '提供订单数量');
    const label = labels.filter({ hasText: '提供订单数量' });
    await label.waitFor();
    await close();
  }
  assert.deepEqual(errors, []);
  console.log('Both charts, all themes, mouse/keyboard/touch, branch source, dense fallback, drag and read-only checks passed.');
} finally { await browser?.close(); await reader.server.close(); }
