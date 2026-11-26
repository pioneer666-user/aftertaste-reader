import { startTestReader, openReader } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox } from 'playwright';
import { repository } from '../fixtures/dependency-canvas.mjs';
import { createReadingLayoutProject } from '../fixtures/canvas-reading-layout.mjs';
import { addAnnotationLoops } from '../fixtures/loop-annotations.mjs';
import { chooseLoop } from './loop-controls.mjs';

const root = path.join(repository, '.local/D051');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'browser-'));
const project = path.join(run, 'project');
if (process.env.AFTERTASTE_ANNOTATION_INPUT) await cp(process.env.AFTERTASTE_ANNOTATION_INPUT, project, { recursive: true });
else await addAnnotationLoops(await createReadingLayoutProject(project));
const reader = await startTestReader(project, 0);
let browser;
try {
  const engine = process.env.AFTERTASTE_BROWSER ?? 'msedge';
  browser = engine === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: engine });
  console.log(engine, browser.version(), run);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let puts = 0;
  page.on('request', req => { if (req.method() === 'PUT') puts++; });
  page.setDefaultTimeout(6500);
  const goto = async hash => { await page.goto('about:blank'); await openReader(page, reader.url + '/#' + hash); };
  await goto('aftertaste-loop/quantity-branches/check');
  const graph = page.locator('.loop-canvas:visible');
  const card = id => graph.locator('[data-step="' + id + '"]');
  const note = id => card(id).locator('..').locator('.loop-annotation');
  const summary = id => note(id).locator('.annotation-summary');
  const open = async (id, value) => assert.equal(await summary(id).getAttribute('aria-expanded'), String(value));
  const panel = graph.locator('.loop-reader-toggle');
  const stow = async () => { if (await panel.getAttribute('aria-expanded') === 'true') await panel.click(); };
  const state = () => graph.locator('.vue-flow__node,.vue-flow__transformationpane').evaluateAll(els => els.map(el => el.style.transform));
  const shot = name => page.screenshot({ path: path.join(run, name + '.png') });
  await card('check').waitFor();
  for (const width of [800, 950]) {
    await page.setViewportSize({ width, height: 900 });
    await goto('aftertaste-loop/quantity-branches/check');
    await graph.locator('.loop-reader-toggle[aria-expanded="true"]').waitFor();
    await open('check', false);
    const initial = await state(), initialPuts = puts;
    await card('check').click({ position: { x: 12, y: 25 } });
    await open('check', true);
    assert.equal(await panel.getAttribute('aria-expanded'), 'true');
    for (const part of ['.annotation-preview', '.annotation-link']) {
      assert.ok(await note('check').locator(part).evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.right - 2, r.top + r.height / 2));
      }), part + ' must remain reachable beside the open reading panel at ' + width);
    }
    assert.deepEqual(await state(), initial); assert.equal(puts, initialPuts);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await goto('aftertaste-loop/quantity-branches/check');
  await card('check').waitFor();
  await stow();
  await open('check', true);
  assert.equal(await note('check').locator('strong').innerText(), '0');
  assert.equal(await note('start').count(), 0);
  const before = await state(), count = puts;
  await shot('sparse-open');
  await summary('check').click(); await open('check', false); await shot('sparse-closed');
  await card('check').click(); await open('check', true);
  await summary('check').press('Enter'); await open('check', false);
  await card('start').click();
  await summary('check').press('Space'); await open('check', true);
  assert.equal(await card('start').getAttribute('aria-pressed'), 'true');
  const code = note('check').locator('.markdown code');
  await code.dblclick();
  assert.ok((await page.evaluate(() => getSelection().toString())).trim());
  assert.equal(await card('start').getAttribute('aria-pressed'), 'true');
  await summary('check').click();
  await card('check').press('Enter'); await open('check', true);
  assert.equal(await panel.getAttribute('aria-expanded'), 'false');
  assert.equal(await graph.locator('.loop-relations [data-relation]').count(), 3);
  await note('check').getByRole('button', { name: /src.rules.mjs.*1–7/ }).click();
  const source = page.locator('.loop-source-panel:visible');
  await source.waitFor();
  assert.match(await source.innerText(), /Number\.isInteger/);
  const artifact = JSON.parse(await readFile(path.join(project, 'docs/aftertaste/loops/quantity-branches/current/loop.json')));
  assert.ok((await source.innerText()).includes(artifact.source_commit));
  assert.doesNotMatch(await source.innerText(), /WORKTREE_ONLY/);
  await source.getByRole('button').click();
  await stow();
  assert.deepEqual(await state(), before); assert.equal(puts, count);
  await chooseLoop(page, 'order-quantity');
  await card('check').waitFor(); assert.equal(await graph.locator('.loop-annotation').count(), 0);

  const denseFile = path.join(project, 'docs/aftertaste/loops/annotated-inputs/layout.json');
  const fileBytes = await readFile(denseFile);
  const dependencyFile = path.join(project, 'docs/aftertaste/dependency-layout.json');
  const dependencyBytes = await readFile(dependencyFile);
  await goto('aftertaste-loop/annotated-inputs/paths');
  await card('paths').waitFor(); await stow();
  await open('paths', false);
  const manual = await state(), densePuts = puts;
  await summary('paths').click(); await open('paths', true);
  await shot('dense-open'); await summary('paths').click(); await shot('dense-closed');
  await card('numbers').click(); await open('numbers', true);
  await note('numbers').getByRole('button', { name: /阅读全文/ }).click();
  assert.ok((await graph.locator('.loop-step-reading').innerText()).includes('只有两项都通过'));
  await stow(); await summary('numbers').click();
  await card('compare').click();
  assert.equal(await note('compare').locator('.annotation-link').count(), 0);
  await page.getByLabel('界面语言').selectOption('en');
  assert.match(await summary('paths').innerText(), /Step note/);
  await page.getByLabel('Interface language').selectOption('zh-CN');
  await page.setViewportSize({ width: 390, height: 844 });
  await card('paths').tap(); await open('paths', true); await shot('narrow-touch');
  assert.ok(await note('paths').locator('.annotation-link').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
  }), 'source link is reachable above the narrow relation bar');
  await summary('paths').tap(); await open('paths', false);
  assert.deepEqual(await state(), manual); assert.equal(puts, densePuts);
  assert.deepEqual(await readFile(denseFile), fileBytes);
  await page.setViewportSize({ width: 1440, height: 900 });
  await goto('aftertaste-loop/annotated-inputs/paths');
  await card('paths').waitFor(); await stow();
  await card('paths').click();
  const saved = async action => {
    const response = page.waitForResponse(r => r.request().method() === 'PUT');
    await action(); assert.equal((await response).status(), 200);
  };
  const drag = async locator => {
    const box = await locator.boundingBox(), x = box.x + 34, y = box.y + box.height / 2;
    assert.ok(await locator.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), { x, y }), 'drag starts on the intended handle');
    await saved(async () => {
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 40, y + 23, { steps: 8 }); await page.mouse.up();
    });
  };
  const attached = async () => {
    const a = await card('paths').boundingBox(), b = await note('paths').boundingBox();
    assert.ok(Math.abs(a.x - b.x) < 1 && Math.abs(a.y + a.height - b.y) < 1);
  };
  await drag(card('paths')); await attached();
  await drag(graph.locator('.group-handle').first()); await attached();
  await saved(() => graph.locator('.canvas-zoom button').last().click()); await attached();
  await graph.getByRole('button', { name: '重新布局', exact: true }).click();
  await saved(() => graph.getByRole('dialog').getByRole('button', { name: '重新布局' }).click());
  const rearranged = JSON.parse(await readFile(denseFile)).layout;
  assert.deepEqual(rearranged.groups, JSON.parse(fileBytes).layout.groups);
  assert.ok(Math.abs(rearranged.positions.numbers.y - rearranged.positions.paths.y) > 250);
  await open('paths', false); // several selected branches leave through its lower ports
  await shot('rearranged');

  await goto('canvas-reading');
  const dep = page.locator('.dependency-canvas:visible');
  const file = dep.locator('[data-file="src/rules.mjs"]');
  await file.click();
  assert.equal(await file.getAttribute('aria-pressed'), 'true');
  assert.equal(await dep.locator('.loop-annotation').count(), 0);
  const edge = dep.locator('.edge-ink path[id="file:src%2Frules.mjs→file:src%2Fservice.mjs"]');
  const spot = await edge.evaluate(p => {
    for (let l = 10; l < p.getTotalLength() - 10; l += 2) {
      const q = p.getPointAtLength(l).matrixTransform(p.getScreenCTM());
      if (document.elementFromPoint(q.x, q.y)?.closest('.edge-ink') === p.parentElement) return { x: q.x, y: q.y };
    }
  });
  assert.ok(spot); await page.mouse.click(spot.x, spot.y);
  await dep.locator('.edge-reason').getByText('在创建订单前使用数量转换与范围校验约定', { exact: true }).waitFor();
  assert.deepEqual(await readFile(dependencyFile), dependencyBytes);
  assert.deepEqual(errors, []);
  console.log('Sparse, dense, touch, fixed source, layout writes and dependency checks passed.');
} finally { await browser?.close(); await reader.server.close(); }
