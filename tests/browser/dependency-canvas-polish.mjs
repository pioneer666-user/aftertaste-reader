import { startTestReader, openReader, fetchReaderRoute } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { chromium, firefox } from 'playwright';
import { build } from '../fixtures/dependency-canvas.mjs';
import { audit, readJSON, rules, service, writeJSON } from '../fixtures/dependency-legends.mjs';
import { preparePolishProject } from '../fixtures/dependency-canvas-polish.mjs';
import { dependencySaved, openDependencyGroups } from './dependency-controls.mjs';

const { channel, run, project, source, disk } = await preparePolishProject('polish');
const routePattern = '**/api/dependency-layout';
const report = { run, build, input: source,
  channel, os: release(), node: process.version, checks: [], saves: [], errors: [] };
let reader, browser, page;
const scope = () => page.locator('#canvas-reading');
const file = id => scope().locator(`[data-file="${id}"]`);
const button = (area, name) => area.getByRole('button', { name, exact: true });
const ack = () => page.waitForResponse(response => response.url().endsWith('/api/dependency-layout') && response.request().method() === 'PUT');
const frame = name => scope().locator('.group-frame').filter({ has: button(page, '分组操作 · ' + name) });
const tick = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function shot(name) {
  if (channel === 'edge') await page.screenshot({ path: path.join(run, name + '.png') });
}

async function checkAck(response, name, member) {
  assert.equal(response.status(), 200, await response.text());
  const { revision } = await response.json();
  const saved = await readJSON(disk);
  assert.equal(saved.revision, revision);
  if (member) assert.deepEqual(saved.layout.groups.find(group => group.name === name)?.members, [member]);
  report.saves.push({ name, revision, groups: saved.layout.groups, viewport: saved.layout.viewport });
  return saved;
}

// Crop the real point bitmap. The rest column and the displaced dots can be compared
// without counting DOM notifications or depending on animation implementation hooks.
async function sampleHover(point) {
  return scope().locator('.dependency-dots').evaluate((canvas, { x, y }) => {
    const area = canvas.getBoundingClientRect(), scale = canvas.width / area.width;
    const sample = document.createElement('canvas');
    sample.width = sample.height = Math.round(80 * scale);
    const pixels = sample.getContext('2d', { willReadFrequently: true });
    pixels.drawImage(canvas, Math.round((x - area.x - 40) * scale), Math.round((y - area.y - 40) * scale),
      sample.width, sample.height, 0, 0, sample.width, sample.height);
    const data = pixels.getImageData(0, 0, sample.width, sample.height).data;
    return Array.from(data.filter((_, i) => i % 4 === 3));
  }, point);
}

async function readGraph() {
  await dependencySaved(scope());
  assert.equal(await scope().locator('.canvas-zoom output').innerText(), '79%');
  await page.evaluate(() => document.fonts.ready);
  await tick();
  const selectedFile = file(service);
  const card = await selectedFile.boundingBox();
  const point = { x: card.x + card.width / 2, y: card.y - 82 };
  const baseline = await sampleHover(point);
  assert.ok(baseline.some(value => value > 0), 'blank canvas contains fine dots');
  await shot('01-rest');
  await page.mouse.move(point.x - 95, point.y);
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.waitForTimeout(300);
  await tick();
  const hover = await sampleHover(point);
  const affected = hover.filter((value, i) => value !== baseline[i]).length;
  assert.ok(affected > 0, 'cursor changes actual pixels in the surrounding grid');
  await page.waitForTimeout(250);
  assert.deepEqual(await sampleHover(point), hover, 'a stopped pointer leaves the field still');
  await shot('02-hover');
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2, { steps: 16 });
  await page.waitForTimeout(450);
  assert.deepEqual(await sampleHover(point), baseline, 'entering the node lets dots settle to their original positions');
  await shot('03-node');
  await selectedFile.click();
  const shape = await selectedFile.locator('.card-surface').getAttribute('d');
  assert.match(shape, /[Cc]/u);
  for (const layer of ['.card-focus', '.card-pick']) assert.equal(await selectedFile.locator(layer).getAttribute('d'), shape);
  assert.equal(await selectedFile.locator('.card-name').innerText(), 'service.mjs');
  assert.match(await selectedFile.getAttribute('aria-label'), /src\/service\.mjs/u);
  assert.match(await file(audit).innerText(), /依赖待核对/u);
  assert.ok(await scope().locator('[data-legend="node-path"]').getByText('标准库').isVisible());
  const graph = await readJSON(path.join(project, 'docs/aftertaste/dependency-graph.json'));
  const connected = await scope().locator('.direct-relation .vue-flow__edge-path').evaluateAll(paths => paths.map(path => {
    const endpoint = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM());
    return { reason: path.closest('.vue-flow__edge').querySelector('title').textContent, d: path.getAttribute('d'),
      marker: getComputedStyle(path).markerEnd, x: endpoint.x, y: endpoint.y };
  }));
  assert.equal(connected.length, 3);
  for (const edge of graph.edges) {
    const drawn = connected.find(line => line.reason === edge.reason);
    assert.ok(drawn, edge.reason);
    assert.notEqual(drawn.marker, 'none');
    const target = await file(edge.dependent).boundingBox();
    const dx = drawn.x - target.x, dy = drawn.y - target.y;
    assert.ok((Math.min(Math.abs(dx), Math.abs(dx - target.width)) < 5 && dy >= 0 && dy <= target.height) ||
      (Math.min(Math.abs(dy), Math.abs(dy - target.height)) < 5 && dx >= 0 && dx <= target.width),
      'arrow meets the visible boundary of ' + edge.dependent);
  }
  assert.equal(await scope().locator('.library-use-edge.direct-relation').count(), 0);
  const dashed = await scope().locator('.library-use-edge .vue-flow__edge-path').evaluateAll(paths =>
    paths.map(line => getComputedStyle(line).strokeDasharray));
  assert.ok(dashed.length && dashed.every(line => line !== 'none'));
  await shot('04-selected');
  const transform = () => scope().locator('.vue-flow__transformationpane').evaluate(node => getComputedStyle(node).transform);
  const view = await transform();
  await button(scope(), '阅读讲解').click();
  await page.getByRole('heading', { level: 1, name: service }).waitFor();
  await button(page, '后退').click();
  assert.equal(await transform(), view);
  assert.equal(await selectedFile.getAttribute('aria-pressed'), 'true');
  await button(scope(), '清除选择').click();
  report.checks.push({ read: '79%, actual hover/rest/entry pixels, 3 incident paths, arrow endpoints, library dashes, read and return', affected });
}

// The strip stays outside the group's tinted area, even if a visible error moves
// the graph on screen. Two bands let us see the same wave reach the outer dots later.
async function startTrace(name) {
  await page.evaluate(({ name, capture }) => {
    const trace = { samples: [], images: [], active: true, phase: 'waiting' };
    window.d027Trace = trace;
    const strip = document.createElement('canvas');
    const pixels = strip.getContext('2d', { willReadFrequently: true });
    let lastImage = -Infinity;
    function observe(time) {
      if (!trace.active) return;
      const canvas = document.querySelector('#canvas-reading .dependency-dots');
      const group = [...document.querySelectorAll('#canvas-reading .group-frame')]
        .find(node => node.querySelector('.group-handle')?.textContent.trim() === name);
      const pane = canvas?.getBoundingClientRect(), box = group?.getBoundingClientRect();
      if (box?.width && pane?.width && canvas.width && canvas.height) {
        const factor = canvas.width / pane.width;
        const x = Math.round((box.x + box.width / 2 - 54 - pane.x) * factor);
        const y = Math.round((box.y - pane.y - 45) * factor);
        const w = Math.round(108 * factor), h = Math.round(44 * factor);
        if (strip.width !== w) strip.width = w;
        if (strip.height !== h) strip.height = h;
        pixels.clearRect(0, 0, w, h);
        pixels.drawImage(canvas, x, y, w, h, 0, 0, w, h);
        const data = pixels.getImageData(0, 0, w, h).data;
        let near = 0, far = 0;
        // Count visible green ripple ink separately from the grey-green and warm grid.
        // Near-transparent antialias pixels lose chroma precision on readback.
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 32) continue;
          const ink = data[i + 3] * Math.max(0, data[i + 1] - data[i] - 32);
          if (i < data.length / 2) far += ink;
          else near += ink;
        }
        trace.samples.push({ time, phase: trace.phase, near, far });
        if (capture && trace.phase === 'confirming' && time - lastImage > 65 && trace.images.length < 12) {
          trace.images.push({ time, png: strip.toDataURL() });
          lastImage = time;
        }
      }
      requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  }, { name, capture: channel === 'edge' });
}

async function setPhase(phase) {
  await page.evaluate(value => { window.d027Trace.phase = value; }, phase);
}

async function finishTrace(name, expectWave) {
  await page.waitForTimeout(850);
  const { samples, images } = await page.evaluate(() => {
    window.d027Trace.active = false;
    return window.d027Trace;
  });
  for (const [index, { png }] of images.entries()) {
    await writeFile(path.join(run, name + '-frame-' + index + '.png'), Buffer.from(png.split(',')[1], 'base64'));
  }
  await writeJSON(path.join(run, name + '-frames.json'), { samples, capturedAt: images.map(image => image.time) });
  const pending = samples.filter(sample => sample.phase === 'waiting');
  assert.ok(pending.length >= 3, 'observed new group before acknowledging its revision: ' + name);
  const baseline = pending.at(-1);
  const lit = point => point.near > baseline.near || point.far > baseline.far;
  assert.equal(pending.filter(lit).length, 0, name + ': no wave during wait/failure');
  const confirmed = samples.filter(sample => sample.phase === 'confirming');
  assert.ok(confirmed.length >= 3, name + ': observed canvas after confirmation');
  const active = confirmed.filter(lit);
  assert.equal(active.length > 0, expectWave, name + ': expected success pulse');
  if (expectWave) {
    const peak = band => active.reduce((max, point) => point[band] > max[band] ? point : max);
    assert.ok(peak('near').time < peak('far').time, name + ': light reaches outer dots after nearer dots');
    assert.equal(confirmed.filter((point, i) => lit(point) && (i === 0 || !lit(confirmed[i - 1]))).length, 1,
      name + ': one outward wave');
    assert.equal(confirmed.at(-1).near, baseline.near, name + ': inner band has settled');
    assert.equal(confirmed.at(-1).far, baseline.far, name + ': outer band has settled');
  }
  report.checks.push({ name, changedFrames: active.length, observedFrames: samples.length });
}

async function nameNewGroup(name, member, entry) {
  if (entry === 'menu') {
    await openDependencyGroups(page);
    await scope().locator('#canvas-group-picker').selectOption('');
    await scope().getByRole('checkbox', { name: member, exact: true }).check();
    await scope().locator('#canvas-group-name').fill(name);
    return () => button(scope(), '应用分组').press('Enter');
  }
  const close = button(scope(), '关闭分组');
  if (await close.isVisible()) await close.click();
  const card = await file(member).boundingBox();
  await page.keyboard.down('Control');
  await page.mouse.move(card.x - 4, card.y - 4);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width + 4, card.y + card.height + 4, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  if (entry === 'hotkey') await page.keyboard.press('Control+g');
  else await button(scope(), '分组').click();
  const input = scope().locator('#canvas-selection-name');
  await input.fill(name);
  return () => input.press('Enter');
}

// Delay only delivery to the page. The service has actually received and
// completed the original PUT before the test releases its response.
async function holdResponse(action) {
  const reached = Promise.withResolvers(), released = Promise.withResolvers();
  await page.route(routePattern, async route => {
    try {
      const result = await fetchReaderRoute(route);
      reached.resolve({ status: result.status(), body: await result.json() });
      await released.promise;
      await route.fulfill({ response: result });
    } catch (error) { reached.reject(error); throw error; }
  }, { times: 1 });
  const delivered = ack();
  await action();
  const result = await Promise.race([reached.promise, page.waitForTimeout(6500).then(() => {
    throw Error('group creation did not reach the layout service');
  })]);
  return { result, release: () => released.resolve(), delivered };
}

async function lockFile() {
  if (process.platform !== 'win32') {
    await page.route(routePattern, route => route.abort('failed'), { times: 1 });
    return async () => {};
  }
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'try { $f=[IO.File]::OpenRead($env:D027_LAYOUT); [Console]::WriteLine("locked"); [void][Console]::ReadLine() } finally { if ($f) { $f.Dispose() } }'],
  { windowsHide: true, env: { ...process.env, D027_LAYOUT: disk } });
  try {
    const [line] = await once(child.stdout, 'data', { signal: AbortSignal.timeout(8000) });
    assert.match(line.toString(), /locked/u);
  } catch (error) { child.kill(); throw error; }
  return async () => {
    const stopped = once(child, 'exit');
    child.stdin.end('\n');
    await stopped;
  };
}

async function createAndObserve(name, member, entry, { fail = false, leave = false, reduced = false } = {}) {
  const commit = await nameNewGroup(name, member, entry);
  await page.mouse.move(1, 1);
  await startTrace(name);
  let submit = commit;
  if (fail) {
    const before = await readFile(disk);
    const unlock = await lockFile();
    try {
      await commit();
      await scope().getByRole('alert').getByText(process.platform === 'win32' ? /LAYOUT_WRITE_FAILED/u : /NETWORK_ERROR/u).waitFor();
      assert.ok(await scope().locator('[data-state="canvasSaveFailed"]').isVisible());
      assert.deepEqual(await readFile(disk), before);
      await page.waitForTimeout(550);
      await shot(name + '-failed');
      report.saves.push({ name, failed: process.platform === 'win32' ? 'LAYOUT_WRITE_FAILED' : 'NETWORK_ERROR' });
    } finally { await unlock(); }
    submit = () => button(scope(), '重试保存').press('Enter');
  }
  const held = await holdResponse(submit);
  try {
    assert.equal(held.result.status, 200);
    await scope().locator('[data-state="canvasSaving"]').waitFor();
    assert.equal((await readJSON(disk)).revision, held.result.body.revision);
    await frame(name).waitFor();
    await page.waitForTimeout(580);
    await shot(name + '-pending');
    if (leave) await page.locator('[data-page="notes"]:visible').click();
    await setPhase('confirming');
  } finally { held.release(); }
  await checkAck(await held.delivered, name, member);
  if (leave) await page.locator('[data-page="canvas"]:visible').click();
  await dependencySaved(scope());
  if (reduced) await scope().getByText('已保存分组「' + name + '」', { exact: true }).waitFor();
  await finishTrace(name, !leave && !reduced);
}

async function checkOrdinarySave(name, action, evidenceName) {
  const held = await holdResponse(action);
  try {
    await scope().locator('[data-state="canvasSaving"]').waitFor();
    await startTrace(name);
    await page.waitForTimeout(320);
    await setPhase('confirming');
  } finally { held.release(); }
  await checkAck(await held.delivered, evidenceName);
  await dependencySaved(scope());
  await finishTrace(evidenceName, false);
}

async function checkRenameAndPan() {
  await frame('管理新组').locator('.group-more').click();
  await button(scope(), '改名').click();
  await scope().locator('#canvas-group-name').fill('原组改名');
  await checkOrdinarySave('原组改名', () => button(scope(), '应用分组').press('Enter'), 'rename');
  const area = await scope().locator('.graph-area').boundingBox();
  const x = area.x + area.width * 0.57, y = area.y + area.height - 70;
  await checkOrdinarySave('原组改名', async () => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 18, y + 12, { steps: 5 });
    await page.mouse.up();
    await page.mouse.move(1, 1);
  }, 'pan');
}

async function editBeforeCreationAck(newName) {
  const original = '等待创建确认';
  const held = await holdResponse(await nameNewGroup(original, rules, 'menu'));
  const created = (await readJSON(disk)).layout.groups.find(group => group.name === original);
  const nextResponse = page.waitForResponse(response => response.url().endsWith('/api/dependency-layout') &&
    response.request().method() === 'PUT' && response.request().postDataJSON().expectedRevision === held.result.body.revision);
  try {
    assert.ok(created);
    if (newName) await scope().locator('#canvas-group-name').fill(newName);
    else await scope().getByRole('checkbox', { name: rules, exact: true }).uncheck();
    await button(scope(), '应用分组').press('Enter');
  } finally { held.release(); }
  assert.equal((await held.delivered).status(), 200);
  const final = await checkAck(await nextResponse, newName || '创建期间解散');
  await dependencySaved(scope());
  assert.equal(final.layout.groups.find(group => group.id === created.id)?.name, newName);
  const announcement = scope().locator('.canvas-group-saved');
  if (newName) {
    assert.equal(await announcement.innerText(), '已保存分组「' + newName + '」');
    assert.ok(await announcement.isVisible());
  } else assert.equal(await announcement.count(), 0);
}

try {
  reader = await startTestReader(project, 0);
  browser = await (channel === 'firefox' ? firefox.launch() : chromium.launch({ channel: channel === 'edge' ? 'msedge' : channel }));
  report.browser = browser.version();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(6500);
  page.on('pageerror', error => report.errors.push(error.message));
  await openReader(page, reader.url);
  await page.locator('[data-page="canvas"]:visible').click();
  await readGraph();
  await createAndObserve('浮钮新组', rules, 'button');
  await createAndObserve('快捷键重试', audit, 'hotkey', { fail: true });
  await createAndObserve('管理新组', service, 'menu');
  await createAndObserve('切页新组', rules, 'hotkey', { leave: true });
  await checkRenameAndPan();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await createAndObserve('静态重试', service, 'menu', { fail: true, reduced: true });
  await editBeforeCreationAck('确认后显示的组名');
  await editBeforeCreationAck(undefined);
  const finalLayout = await readJSON(disk);
  await page.reload();
  await page.locator('[data-page="canvas"]:visible').click();
  await dependencySaved(scope());
  for (const group of finalLayout.layout.groups) await frame(group.name).waitFor();
  assert.deepEqual(await readJSON(disk), finalLayout);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  if (page && !page.isClosed()) await shot('failure').catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await reader?.server.close();
  await writeJSON(path.join(run, 'report.json'), report);
  console.log(run);
}
