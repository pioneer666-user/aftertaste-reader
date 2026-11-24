import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { api, audit, rules, service, readJSON, writeJSON } from '../fixtures/dependency-legends.mjs';
import { createRoutingProject, routeId } from '../fixtures/canvas-routing.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D048/self');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'routing-'));
const project = path.join(run, 'project');
if (process.env.AFTERTASTE_ROUTING_INPUT) await cp(process.env.AFTERTASTE_ROUTING_INPUT, project, { recursive: true });
else await createRoutingProject(project);
const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
const beforeOnly = process.argv.includes('--before');
const report = { build, channel, beforeOnly, checks: [], errors: [] };
let reader, browser;
try {
  reader = await startReader(project, 0);
  browser = await (channel === 'firefox' ? firefox.launch() : chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel }));
  report.version = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(6500);
  page.on('pageerror', err => report.errors.push(err.message));
  const fileDisk = path.join(project, 'docs/aftertaste/dependency-layout.json');
  const loopDisk = path.join(project, 'docs/aftertaste/loops', routeId, 'layout.json');
  for (const loop of [false, true]) {
    const name = loop ? 'loop' : 'dependency';
    const disk = loop ? loopDisk : fileDisk, other = loop ? fileDisk : loopDisk;
    const untouched = await readFile(other);
    const initial = (await readJSON(disk)).layout;
    const hash = loop ? '#aftertaste-loop/' + routeId + '/choose' : '#canvas-reading';
    // A fresh navigation exercises the reader's startup deep link for each graph.
    await page.goto('about:blank');
    await page.goto(reader.url + '/' + hash);
    const scope = page.locator(loop ? '.loop-canvas:visible' : '.dependency-canvas:visible');
    const node = key => scope.locator(key.startsWith('legend:') ? '[data-legend="' + key.slice(7) + '"]'
      : '[' + (loop ? 'data-step' : 'data-file') + '="' + key + '"]');
    const frame = i => scope.locator('.group-frame').filter({ hasText: initial.groups[i].name });
    const wrap = target => target.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," vue-flow__node ")][1]');
    const screenshot = suffix => page.screenshot({ path: path.join(run, name + '-' + suffix + '.png') });
    const focus = loop ? 'choose' : service;
    await node(focus).waitFor();
    if (loop) await scope.locator('.loop-reader-toggle[aria-expanded="true"]').click();
    await node(focus).hover();
    await page.waitForTimeout(240);
    await screenshot('relations');
    const inspect = () => scope.locator('.vue-flow__edge').evaluateAll(edges => edges.map(edge => {
      const line = edge.querySelector('.vue-flow__edge-path');
      const length = line.getTotalLength(), matrix = line.getScreenCTM();
      const cards = [...edge.closest('.vue-flow').querySelectorAll('.vue-flow__node:not(.vue-flow__node-canvasGroup)')]
        .map(el => ({ id: el.dataset.id, r: el.getBoundingClientRect() }));
      const inside = new Set();
      for (let l = 1; l < length; l += 2) {
        const p = line.getPointAtLength(l).matrixTransform(matrix);
        for (const { id, r } of cards) if (p.x > r.left + 2 && p.x < r.right - 2 && p.y > r.top + 2 && p.y < r.bottom - 2) inside.add(id);
      }
      const at = l => {
        const p = line.getPointAtLength(l).matrixTransform(matrix);
        const card = cards.find(({ r }) => (p.x >= r.left - 2 && p.x <= r.right + 2 && p.y >= r.top - 2 && p.y <= r.bottom + 2));
        return { card: card?.id, x: p.x, y: p.y };
      };
      return { reason: edge.querySelector('title').textContent, from: at(0), to: at(length), inside: [...inside], length,
        d: line.getAttribute('d'), arrow: getComputedStyle(line).markerEnd, dash: getComputedStyle(line).strokeDasharray,
        lit: !!line.closest('.edge-lit') };
    }));
    const edges = await inspect();
    await writeJSON(path.join(run, name + '-paths.json'), edges);
    if (beforeOnly) continue;
    const id = key => key.startsWith('legend:') ? key : 'file:' + encodeURIComponent(key);
    function trace(from, to, dashed = false) {
      const found = edges.find(edge => edge.from.card === id(from) && edge.to.card === id(to));
      assert.ok(found, from + ' → ' + to);
      assert.notEqual(found.arrow, 'none');
      assert.equal(found.dash !== 'none', dashed);
      return found;
    }
    assert.ok(edges.every(edge => edge.inside.length === 0), JSON.stringify(edges.filter(edge => edge.inside.length)));
    if (!loop) {
      const incoming = [rules, api, audit].map(key => trace(key, service));
      assert.equal(new Set(incoming.map(e => [e.to.x, e.to.y].join())).size, 3);
      assert.ok(incoming.every(edge => edge.lit));
      const library = trace('legend:node-path', audit, true);
      assert.ok(library.length < 180, 'nearby library has a short approach');
      trace(service, api);
      trace(audit, audit);
      await scope.getByRole('button', { name: rules + ' → ' + service, exact: true }).focus();
      await page.keyboard.press('Enter');
      await scope.locator('.edge-reason').getByText(incoming[0].reason, { exact: true }).waitFor();
    } else {
      for (const branch of ['basename', 'join']) {
        assert.ok(trace('choose', branch).lit);
        trace(branch, 'compare');
        trace('legend:node-path', branch, true);
      }
    }
    report.checks.push(name + ': trace, direction, markers, distinct landings and clearance');
    const moved = node(loop ? 'compare' : service);
    const refCard = node(loop ? 'basename' : api);
    const frame0 = frame(0), frame1 = frame(1);
    const tick = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1, label + ': ' + a + ' vs ' + b);
    // Move an obstacle independently of the edge's endpoints; cancel a later
    // snapped preview while the mouse is still held.
    const obstacle = node(loop ? 'legend:node-path' : api);
    const neighbor = node(loop ? 'join' : rules);
    const originalBox = await wrap(obstacle).boundingBox(), neighborBox = await wrap(neighbor).boundingBox();
    const handle = await obstacle.boundingBox(), pickup = { x: handle.x + 45, y: handle.y + handle.height / 2 };
    await page.mouse.move(pickup.x, pickup.y);
    await page.mouse.down();
    await page.mouse.move(pickup.x + 3, pickup.y);
    await page.mouse.move(pickup.x + 12, pickup.y + 90, { steps: 9 });
    await tick();
    if (!loop) {
      const previous = edges.find(e => e.from.card === id(rules) && e.to.card === id(service));
      const now = (await inspect()).find(e => e.reason === previous.reason);
      assert.notEqual(now.d, previous.d);
      assert.deepEqual(now.inside, []);
    }
    await page.mouse.move(pickup.x + 13, pickup.y + neighborBox.y - originalBox.y + 2, { steps: 9 });
    await scope.locator('.canvas-alignment line').first().waitFor({ state: 'attached' });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await tick();
    assert.equal(await scope.locator('.canvas-alignment').count(), 0);
    await page.mouse.up();
    await tick();
    near((await wrap(obstacle).boundingBox()).y, originalBox.y, 'interrupted position');
    assert.deepEqual((await readJSON(disk)).layout, initial);
    report.checks.push(name + ': live drag, interrupt, draft cleared');
    await frame1.locator('.group-more').click();
    await scope.locator('.loop-group-menu').waitFor();
    await page.keyboard.press('Escape');
    await scope.locator('.loop-group-menu').waitFor({ state: 'hidden' });
    async function align(mover, target, fraction, label, detach = false) {
      const original = (await readJSON(disk)).layout;
      const box = await wrap(mover).boundingBox(), otherBox = await wrap(target).boundingBox();
      const handle = await mover.boundingBox(), x = handle.x + Math.min(handle.width / 2, 48), y = handle.y + handle.height / 2;
      const delta = otherBox.y + fraction * otherBox.height - box.y - fraction * box.height;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 3, y);
      await page.mouse.move(x + 16, y + delta + 2, { steps: 12 });
      await tick();
      const guides = scope.locator('.canvas-alignment line');
      await screenshot(label);
      await writeJSON(path.join(run, name + '-' + label + '.json'), { box, otherBox, actual: await wrap(mover).boundingBox(),
        guides: await guides.evaluateAll(lines => lines.map(l => l.getBoundingClientRect().toJSON())) });
      assert.ok(await guides.count(), label + ': missing guide');
      const actual = await wrap(mover).boundingBox();
      const aligned = actual.y + fraction * actual.height;
      near(aligned, otherBox.y + fraction * otherBox.height, label);
      const lines = await guides.evaluateAll(lines => lines.map(line => line.getBoundingClientRect().y));
      assert.ok(lines.some(y => Math.abs(aligned - y) < 1), label + ': line meets visible geometry');
      if (detach) {
        await page.mouse.move(x + 29, y + delta + 18, { steps: 4 });
        await tick();
        const released = await wrap(mover).boundingBox();
        assert.ok(Math.abs(released.y - actual.y) > 8, 'can pull away');
      }
      const ack = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(loop ? '/layout' : '/dependency-layout'));
      await page.mouse.up();
      assert.equal((await ack).status(), 200);
      assert.equal(await guides.count(), 0);
      const saved = (await readJSON(disk)).layout;
      assert.deepEqual(saved.groups, original.groups);
      const isGroup = await mover.evaluate(el => el.matches('.group-handle'));
      const members = isGroup ? initial.groups[1].members : [loop ? 'compare' : service];
      const deltaOf = key => ({ x: saved.positions[key].x - original.positions[key].x, y: saved.positions[key].y - original.positions[key].y });
      for (const key of Object.keys(original.positions)) {
        const difference = deltaOf(key), expected = members.includes(key) ? deltaOf(members[0]) : { x: 0, y: 0 };
        near(difference.x, expected.x, key);
        near(difference.y, expected.y, key);
      }
      report.checks.push(name + ': ' + label);
    }
    await align(moved, refCard, 0, 'card-card', true);
    await align(moved, frame0, 0, 'card-group');
    const groupHandle = frame1.locator('.group-handle');
    await align(groupHandle, node('legend:node-path'), .5, 'group-card');
    await scope.locator('.canvas-zoom button').last().click();
    await tick();
    await align(groupHandle, frame0, 0, 'group-group');
    const final = (await readJSON(disk)).layout;
    assert.notEqual(final.viewport.zoom, initial.viewport.zoom);
    assert.deepEqual(await readFile(other), untouched);
    await page.reload();
    await frame1.waitFor();
    const expected = final.positions[initial.groups[1].members[0]];
    const el = wrap(node(initial.groups[1].members[0]));
    const actual = await el.evaluate(el => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); return { x: m.e, y: m.f }; });
    near(actual.x, expected.x, 'reopen x'); near(actual.y, expected.y, 'reopen y');
    assert.equal(await scope.locator('.canvas-alignment').count(), 0);
    report.checks.push(name + ': zoom, reopen, independent layouts');
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; throw error; }
finally {
  await browser?.close();
  await reader?.server.close();
  await writeJSON(path.join(run, 'report.json'), report);
  console.log(run);
}
