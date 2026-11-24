import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { api, legendId, rules, service, readJSON, writeJSON } from '../fixtures/dependency-legends.mjs';
import { createReadingLayoutProject, denseId } from '../fixtures/canvas-reading-layout.mjs';

const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D049/self');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'reading-'));
const project = path.join(run, 'project');
if (process.env.AFTERTASTE_ROUTING_INPUT) await cp(process.env.AFTERTASTE_ROUTING_INPUT, project, { recursive: true });
else await createReadingLayoutProject(project);
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
const report = { channel, checks: [], errors: [] };
let reader, browser;
try {
  reader = await startReader(project, 0);
  browser = channel === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel });
  report.version = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(6000);
  page.on('pageerror', err => report.errors.push(err.message));
  let puts = 0;
  page.on('request', req => { if (req.method() === 'PUT') puts++; });
  const data = path.join(project, 'docs/aftertaste');
  const disks = [path.join(data, 'dependency-layout.json'), path.join(data, 'loops', denseId, 'layout.json')];
  for (const loop of [false, true]) {
    const name = loop ? 'loop' : 'dependency';
    const file = disks[Number(loop)], other = disks[Number(!loop)];
    const initial = await readFile(file), untouched = await readFile(other);
    await page.goto('about:blank');
    await page.goto(reader.url + (loop ? '/#aftertaste-loop/' + denseId + '/choose' : '/#canvas-reading'));
    const graph = page.locator(loop ? '.loop-canvas:visible' : '.dependency-canvas:visible');
    const card = key => graph.locator(key.startsWith('legend:') ? '[data-legend="' + key.slice(7) + '"]'
      : '[' + (loop ? 'data-step' : 'data-file') + '="' + key + '"]');
    const [a, b, c] = loop ? ['choose', 'case-01', 'compare'] : [rules, api, service];
    await card(a).waitFor();
    if (loop) await graph.locator('.loop-reader-toggle[aria-expanded="true"]').click();
    const area = await graph.locator('.graph-area').boundingBox();
    const blank = { x: area.x + area.width - 75, y: area.y + 40 };
    const leave = () => page.mouse.move(blank.x, blank.y);
    const clear = () => page.mouse.click(blank.x, blank.y);
    const draw = suffix => page.screenshot({ path: path.join(run, name + '-' + suffix + '.png') });
    const paths = () => graph.locator('.edge-ink .vue-flow__edge-path').evaluateAll(lines =>
      Object.fromEntries(lines.map(line => [line.id, line.getAttribute('d')])));
    const id = key => 'file:' + encodeURIComponent(key);
    const key = id(a) + '→' + id(c);
    const line = graph.locator('.edge-ink path[id="' + key + '"]');
    const overlay = graph.locator('.foreground-edges path');
    await line.waitFor({ state: 'attached' });
    await clear();
    const originalPaths = await paths(), baseline = puts;
    const middle = await card(b).boundingBox();
    const sample = await line.evaluate((p, r) => {
      for (let l = 1; l < p.getTotalLength(); l++) {
        const pt = p.getPointAtLength(l).matrixTransform(p.getScreenCTM());
        if (pt.x > r.x + r.width * .70 && pt.x < r.x + r.width * .85 &&
            pt.y > r.y + 5 && pt.y < r.y + r.height - 5) return { x: pt.x, y: pt.y };
      }
    }, middle);
    assert.ok(sample, name + ': line crosses the middle card');
    const clip = { x: Math.floor(sample.x) - 5, y: Math.floor(sample.y) - 4, width: 12, height: 9 };
    const pixels = async () => page.evaluate(async png => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' }));
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return [...ctx.getImageData(0, 0, bitmap.width, bitmap.height).data];
    }, (await page.screenshot({ clip })).toString('base64'));
    const behind = await pixels();
    await draw('behind');
    await card(a).hover();
    assert.deepEqual(await pixels(), behind, 'hovered ink stays behind B');
    assert.equal(await overlay.count(), 0);
    await card(a).click();
    await leave();
    const fixed = await pixels();
    const changed = fixed.filter((channel, i) => i % 4 !== 3 && Math.abs(channel - behind[i]) > 15).length;
    assert.ok(changed >= 12, name + ': visible foreground pixels ' + changed);
    await draw('front');
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-pressed'), sample), 'false');
    assert.deepEqual(await paths(), originalPaths);
    await page.mouse.click(sample.x, sample.y);
    assert.equal(await card(b).getAttribute('aria-pressed'), 'true');
    const activePaths = await overlay.evaluateAll(lines => lines.map(p => p.getAttribute('d')));
    assert.ok(activePaths.length && !activePaths.includes(originalPaths[key]), 'B has its own relations');
    await clear();
    await card(c).focus();
    await card(c).press('Enter');
    assert.ok(await overlay.evaluateAll((lines, d) => lines.some(p => p.getAttribute('d') === d), originalPaths[key]));
    if (!loop) {
      const spot = await line.evaluate(p => {
        for (let l = 10; l < p.getTotalLength() - 10; l += 2) {
          const q = p.getPointAtLength(l).matrixTransform(p.getScreenCTM());
          if (document.elementFromPoint(q.x, q.y)?.closest('.edge-ink') === p.parentElement) return { x: q.x, y: q.y };
        }
      });
      assert.ok(spot, 'an uncovered stroke still owns its pointer target');
      await page.mouse.click(spot.x, spot.y);
      await graph.locator('.edge-reason').getByText('在创建订单前使用数量转换与范围校验约定', { exact: true }).waitFor();
    }
    await clear();
    assert.equal(await overlay.count(), 0);
    assert.deepEqual(await paths(), originalPaths);
    assert.equal(puts, baseline);
    assert.deepEqual(await readFile(file), initial);
    const saved = async action => {
      const ack = page.waitForResponse(r => r.request().method() === 'PUT');
      await action();
      assert.equal((await ack).status(), 200);
    };
    const drag = async (el, dx, dy, point) => {
      const box = await el.boundingBox();
      const x = point?.x ?? box.x + 35, y = point?.y ?? box.y + box.height / 2;
      await saved(async () => {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
      });
    };
    await card(a).click();
    await drag(card(b), 14, 25, sample);
    await drag(card(legendId), 25, -14);
    await drag(graph.locator('.group-handle').first(), 38, 26);
    await saved(() => graph.locator('.canvas-zoom button').last().click());
    await card(b).click();
    await leave();
    const manual = await readFile(file);
    const view = () => graph.locator('.vue-flow__transformationpane').evaluate(el => el.style.transform);
    const beforeView = await view();
    const toolbar = graph.locator('.canvas-rail').getByRole('button', { name: '重新布局', exact: true });
    const dialog = graph.getByRole('dialog', { name: '重新布局这张图？' });
    const count = puts;
    for (const escape of [false, true]) {
      await toolbar.focus(); await toolbar.press('Enter');
      assert.ok(await dialog.getByRole('button', { name: '取消' }).evaluate(b => b === document.activeElement));
      assert.ok((await dialog.innerText()).includes(loop ? '路径与数量' : '文件依赖图'));
      if (escape) await page.keyboard.press('Escape');
      else await dialog.getByRole('button', { name: '取消' }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await card(b).getAttribute('aria-pressed'), 'true');
      assert.equal(await view(), beforeView);
      assert.deepEqual(await readFile(file), manual);
      assert.equal(puts, count);
    }
    await page.getByLabel('界面语言').selectOption('en');
    await graph.locator('.canvas-rail').getByRole('button', { name: 'Rearrange', exact: true }).click();
    const english = graph.getByRole('dialog', { name: 'Rearrange this graph?' });
    assert.ok(await english.getByRole('button', { name: 'Cancel' }).evaluate(b => b === document.activeElement));
    await english.getByRole('button', { name: 'Cancel' }).click();
    await page.getByLabel('Interface language').selectOption('zh-CN');
    assert.equal(puts, count);
    await toolbar.click();
    await saved(() => dialog.getByRole('button', { name: '重新布局' }).click());
    assert.equal(puts, count + 1);
    const result = (await readJSON(file)).layout;
    assert.deepEqual(result.groups, JSON.parse(manual).layout.groups);
    assert.notDeepEqual(result.positions, JSON.parse(manual).layout.positions);
    assert.deepEqual(result.viewport, { x: 0, y: 0, zoom: loop ? .78 : 1 });
    await page.reload(); await card(a).waitFor();
    if (loop) await graph.locator('.loop-reader-toggle[aria-expanded="true"]').click();
    await clear();
    await draw('rearranged');
    const entry = await card(a).boundingBox(), library = await card(legendId).boundingBox();
    for (const box of [entry, library]) assert.ok(box.x >= area.x && box.x < area.x + area.width && box.y >= area.y && box.y < area.y + area.height);
    const p = result.positions;
    assert.ok(p[legendId].x + 212 < p[a].x);
    if (loop) {
      const xs = [...new Set(Object.entries(p).filter(([id]) => id.startsWith('case-')).map(([,pt]) => pt.x))].sort((a,b) => a-b);
      assert.equal(xs.length, 3);
      const mid = p.compare.y + 28;
      for (const x of [...new Set(Object.values(p).map(pt => pt.x))]) {
        const ys = Object.values(p).filter(pt => pt.x === x).map(pt => pt.y);
        assert.equal((Math.min(...ys) + Math.max(...ys) + 56) / 2, mid);
      }
      const within = xs[1] - xs[0] - 212, between = p.compare.x - xs.at(-1) - 212;
      assert.ok(between > within && within > 0);
      report.bands = { libraryX: p[legendId].x, entryX: p.choose.x, categoryX: p.paths.x, caseColumns: xs, joinX: p.compare.x, mid, within, between };
      await saved(() => graph.getByRole('button', { name: '缩小画布', exact: true }).click());
      await draw('all-layers');
    }
    await rename(file, file + '.saved');
    const fresh = await (await fetch(reader.url + (loop ? '/api/loops/' + denseId : '/api/dependency-canvas'))).json();
    assert.deepEqual(fresh.layout.positions, result.positions);
    await rename(file + '.saved', file);
    const savedBeforeFailure = await readFile(file);
    const saveURL = reader.url + (loop ? '/api/loops/' + denseId + '/layout' : '/api/dependency-layout');
    await page.route(saveURL, route => route.abort('failed'), { times: 1 });
    await toolbar.click(); await dialog.getByRole('button', { name: '重新布局' }).click();
    const retry = graph.getByRole('button', { name: '重试保存' });
    await retry.waitFor();
    assert.deepEqual(await readFile(file), savedBeforeFailure);
    await saved(() => retry.click());
    assert.deepEqual((await readJSON(file)).layout, result);
    assert.deepEqual(await readFile(other), untouched);
    report.checks.push({ name, changedChannels: changed, sample, cancelWrites: 0, confirmWrites: 1, relations: Object.keys(originalPaths).length });
  }
  await page.close();
  const touch = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  for (const hash of ['#canvas-reading', '#aftertaste-loop/' + denseId + '/choose']) {
    await touch.goto('about:blank');
    await touch.goto(reader.url + '/' + hash);
    const graph = touch.locator(hash === '#canvas-reading' ? '.dependency-canvas:visible' : '.loop-canvas:visible');
    const legend = graph.locator('[data-legend="node-path"]');
    await legend.tap();
    assert.equal(await legend.getAttribute('aria-pressed'), 'true');
    const ink = graph.locator('.foreground-edges path');
    assert.ok(await ink.count() > 0);
    assert.equal(await ink.count(), await graph.locator('.foreground-edges .library-use').count());
  }
  await touch.close();
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; throw error; }
finally {
  await browser?.close(); await reader?.server.close();
  await writeJSON(path.join(run, 'report.json'), report);
  console.log(run);
}
