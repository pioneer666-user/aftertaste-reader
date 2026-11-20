import assert from 'node:assert/strict';
import { copyFile, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { createLoopReaderProject } from '../fixtures/loop-reader.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
assert.ok(['edge', 'chrome', 'firefox'].includes(engine));
const input = process.env.AFTERTASTE_READER_INPUT;
const root = path.join(repository, '.local/D030');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, engine + '-'));
const project = path.join(run, 'project');
const data = path.join(project, 'docs/aftertaste');
const records = ['bookmarks.json', 'understanding-marks.json', 'notes.json'];
if (input) {
  await cp(path.resolve(input), project, { recursive: true, force: false, errorOnExist: true });
} else {
  await createLoopReaderProject(project);
  for (const name of records) {
    await copyFile(new URL('../fixtures/page-preview/' + name, import.meta.url), path.join(data, name));
  }
}
const readRecords = () => Promise.all(records.map(name => readFile(path.join(data, name), 'utf8')));
const before = await readRecords();
const service = 'src/service.mjs', rules = 'src/rules.mjs', api = 'src/api.mjs';
const secondBlock = 'm3vuiqzi';
const report = { run, input: input ?? 'recreated order preview', engine, build, os: release(), node: process.version,
  frames: {}, checks: [], errors: [], writes: [] };
let reader, browser, page;
const nav = () => page.locator('#reader-navigation');
const tree = () => nav().locator('#reader-file-navigation');
const file = source => tree().locator(`button[title="${source}"]`);
const current = () => tree().locator('[aria-current="page"]');
const outline = () => nav().locator('.reader-outline');
const main = () => page.locator('#reading');
const heading = source => main().getByRole('heading', { level: 1, name: source, exact: true });
const placeholder = () => page.locator('.file-switch-placeholder');
const top = () => page.locator('.app-header');
const history = direction => top().locator(`[data-history="${direction}"]`);
const toggle = () => top().locator('[aria-controls="reader-navigation"]');
const shot = name => page.screenshot({ path: path.join(run, name + '.png') });

async function newPage(viewport = { width: 1440, height: 900 }, reducedMotion = 'no-preference') {
  if (page) await page.close();
  page = await browser.newPage({ viewport, reducedMotion });
  page.setDefaultTimeout(6000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => {
    if (request.method() !== 'GET' && request.url().startsWith(reader.url)) {
      report.writes.push([request.method(), new URL(request.url()).pathname]);
    }
  });
  await page.goto(reader.url);
  await page.evaluate(() => document.fonts.ready);
}

async function open(source) {
  await file(source).click();
  await heading(source).waitFor();
}

async function readPoint() {
  return main().evaluate((pane, id) => {
    const block = document.getElementById(id);
    return { top: pane.scrollTop, offset: pane.getBoundingClientRect().top - block.getBoundingClientRect().top };
  }, secondBlock);
}

async function positionService() {
  await page.locator('#' + secondBlock).evaluate(block => {
    block.scrollIntoView({ block: 'start' });
    block.closest('#reading').scrollTop += 64;
  });
  const position = await readPoint();
  assert.ok(Math.abs(position.offset - 64) <= 1, JSON.stringify(position));
  return position;
}

async function samePosition(before) {
  const after = await readPoint();
  for (const key of ['top', 'offset']) assert.ok(Math.abs(after[key] - before[key]) <= 1, JSON.stringify({ before, after }));
}

async function framesFor(source) {
  await file(source).evaluate((button, source) => {
    window.fileSwitchFrames = [];
    button.addEventListener('click', () => {
      const start = performance.now();
      let committed = 0;
      function sample() {
        const documentHeading = document.querySelector('#reading .document-header h1');
        const main = document.getElementById('reading');
        const skeleton = document.querySelector('.file-switch-placeholder h1')?.textContent ?? null;
        const text = documentHeading && getComputedStyle(documentHeading).visibility === 'visible'
          ? documentHeading.textContent.trim() : null;
        const current = [...document.querySelectorAll('#reader-file-navigation [aria-current="page"]')].map(row => row.title);
        const pending = document.querySelector('#reader-file-navigation .file-opening')?.title ?? null;
        window.fileSwitchFrames.push({ ms: Math.round((performance.now() - start) * 10) / 10,
          text, skeleton, current, pending, busy: main.getAttribute('aria-busy') });
        if (text === source) committed++;
        if (committed < 2 && performance.now() - start < 3000) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    }, { capture: true, once: true });
  }, source);
}

async function collectedFrames(name, target) {
  if (target) await page.waitForFunction(target => window.fileSwitchFrames.filter(frame => frame.text === target).length >= 2, target);
  return report.frames[name] = await page.evaluate(() => window.fileSwitchFrames);
}

async function switchWithFrames(source, keyboard, label, fast = false) {
  await framesFor(source);
  if (keyboard) await file(source).press('Enter');
  else await file(source).click();
  await heading(source).waitFor();
  const frames = await collectedFrames(label, source);
  assert.ok(frames.every(frame => !!frame.skeleton !== !!frame.text && frame.current.length === 1 &&
    (frame.text ? frame.current[0] === frame.text : frame.skeleton === source && frame.pending === source)),
  JSON.stringify(frames));
  assert.equal(await main().evaluate(pane => pane.scrollTop), 0);
  const timing = await page.evaluate(source => performance.getEntriesByType('resource').filter(entry =>
    new URL(entry.name).searchParams.get('path')?.endsWith('/' + source + '.md')).at(-1)?.duration, source);
  const firstTargetFrameMs = frames.find(frame => frame.text === source).ms;
  const firstSkeletonMs = frames.find(frame => frame.skeleton)?.ms;
  (report.timing ??= []).push({ label, source, requestMs: timing, firstTargetFrameMs, firstSkeletonMs });
  if (fast) {
    assert.equal(firstSkeletonMs, undefined, JSON.stringify(frames));
    assert.ok(firstTargetFrameMs < 120, JSON.stringify(frames));
  } else if (timing > 200) {
    assert.ok(firstSkeletonMs >= 110 && firstSkeletonMs < firstTargetFrameMs, JSON.stringify(frames));
  }
}

async function fastSwitch(source, keyboard, label) {
  const url = new URL('/api/document', reader.url);
  url.searchParams.set('path', 'docs/aftertaste/current/' + source + '.md');
  const response = await page.request.get(url.toString());
  assert.equal(response.status(), 200);
  const matcher = candidate => candidate.pathname === url.pathname && candidate.searchParams.get('path') === url.searchParams.get('path');
  const serve = route => route.fulfill({ response });
  await page.route(matcher, serve);
  try { await switchWithFrames(source, keyboard, label, true); }
  finally { await page.unroute(matcher, serve); }
}

async function holdRules(operate, fail = false) {
  const matcher = '**/api/document?path=*rules.mjs.md';
  const fetched = Promise.withResolvers();
  const gate = Promise.withResolvers();
  const handler = async route => {
    try {
      const response = await route.fetch();
      fetched.resolve(response.status());
      await gate.promise;
      await (fail ? route.abort('failed') : route.fulfill({ response })).catch(() => {});
    } catch (error) {
      fetched.reject(error);
    }
  };
  await page.route(matcher, handler);
  try {
    await operate({
      fetched: fetched.promise,
      async release() {
        gate.resolve();
        await page.unrouteAll({ behavior: 'wait' });
      },
    });
  } finally {
    gate.resolve();
    await page.unrouteAll({ behavior: 'wait' });
  }
}

async function waiting(source = rules) {
  await placeholder().getByText(source, { exact: true }).waitFor();
  assert.equal(await main().getAttribute('aria-busy'), 'true');
  assert.equal(await current().getAttribute('title'), service);
  assert.equal(await file(source).evaluate(row => row.classList.contains('file-opening')), true);
  assert.equal(await outline().isVisible(), false);
  assert.equal(await main().locator('.reading-content').evaluate(content => content.inert), true);
  assert.equal(await heading(service).isVisible(), false);
}

async function settled(source) {
  await heading(source).waitFor();
  assert.equal(await main().getAttribute('aria-busy'), 'false');
  assert.equal(await placeholder().count(), 0);
  assert.deepEqual(await current().evaluateAll(rows => rows.map(row => row.title)), [source]);
}

async function frameGeometry() {
  return page.evaluate(() => ['.app-header', '#reader-file-navigation', '#reading'].map(selector => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return [rect.x, rect.y, rect.width, rect.height];
  }));
}

try {
  reader = await startReader(project, 0);
  browser = engine === 'firefox' ? await firefox.launch({ headless: true }) :
    await chromium.launch({ channel: engine === 'edge' ? 'msedge' : 'chrome', headless: true });
  report.browser = browser.version();
  await newPage();
  await open(service);
  await positionService();
  await switchWithFrames(rules, false, 'desktop-natural-mouse');
  await switchWithFrames(api, true, 'desktop-natural-keyboard');
  await open(service);
  await positionService();
  await fastSwitch(rules, false, 'desktop-fast-mouse');
  await fastSwitch(api, true, 'desktop-fast-keyboard');
  await open(service);
  const position = await positionService();
  const layout = await frameGeometry();
  await shot('desktop-before');
  await holdRules(async held => {
    await framesFor(rules);
    await file(rules).click();
    await waiting();
    assert.equal(await held.fetched, 200);
    const frames = await collectedFrames('desktop-held');
    assert.deepEqual(frames[0].current, [service]);
    assert.equal(frames[0].text, service);
    assert.equal(frames[0].pending, rules);
    assert.equal(frames[0].busy, 'true');
    assert.equal(frames[0].skeleton, null);
    const firstSkeleton = frames.find(frame => frame.skeleton);
    assert.ok(firstSkeleton.ms >= 110, JSON.stringify(frames));
    assert.deepEqual(await frameGeometry(), layout);
    await samePosition(position);
    assert.equal(await page.locator('.file-switch-announcement').textContent(), '正在打开 ' + rules);
    assert.equal(await page.locator('#reader-project-info .commit').count(), 0);
    assert.equal(await main().getByRole('button', { name: '加书签', exact: true }).count(), 0);
    await shot('desktop-waiting');
    await toggle().click();
    await nav().waitFor({ state: 'hidden' });
    assert.ok(await placeholder().isVisible());
    await shot('desktop-collapsed');
    await toggle().click();
    await held.release();
    await settled(rules);
    assert.equal(await outline().getByRole('button').count(), 1);
    assert.ok((await main().locator('.document-path').innerText()).endsWith('/' + rules + '.md'));
    assert.equal(await main().evaluate(pane => pane.scrollTop), 0);
    await shot('desktop-after');
  });
  report.checks.push('Natural mouse and Enter frame sequences, held response, stable layout, inert records and outline, desktop close and reopen');

  await open(service);
  const returnPoint = await positionService();
  await holdRules(async held => {
    await file(rules).click();
    await waiting();
    await file(api).press('Enter');
    await settled(api);
    await held.release();
    await settled(api);
    assert.equal(await file(api).evaluate(row => row === document.activeElement), true);
  });
  await history('back').click();
  await settled(service);
  await samePosition(returnPoint);
  await holdRules(async held => {
    await file(rules).click();
    await waiting();
    await top().locator('[data-page="bookmarks"]').click();
    await page.locator('#bookmarks:focus').waitFor();
    await held.release();
    assert.equal(await placeholder().count(), 0);
    assert.equal(await main().getAttribute('aria-busy'), 'false');
    assert.equal(await page.locator('#bookmarks:focus').count(), 1);
  });
  await history('back').click();
  await settled(service);
  await samePosition(returnPoint);
  report.checks.push('Final clicked file wins, one Back restores service offset, Bookmarks keeps page and focus after late reply');

  const block = page.locator('#' + secondBlock);
  await block.locator('.block-bookmarks-toggle').click();
  await block.getByRole('button', { name: '加书签', exact: true }).click();
  const draft = block.locator('.bookmark-records textarea');
  await draft.fill('留在服务篇原块的未保存书签');
  await block.locator('.mark-controls .record-toggle').click();
  await block.locator('.annotation-details button').first().click();
  const annotation = block.locator('.annotation-details textarea');
  await annotation.fill('留在服务篇原块的未保存批注');
  const failedFrom = await positionService();
  const forwardBefore = await history('forward').isEnabled();
  await holdRules(async held => {
    await file(rules).click();
    await waiting();
    assert.equal(await held.fetched, 200);
    await held.release();
    const notice = page.locator('.position-notice');
    await notice.getByText(/未能打开 src\/rules\.mjs.*无法连接本地阅读服务/u).waitFor();
    await settled(service);
    await samePosition(failedFrom);
    assert.equal(await outline().getByRole('button').count(), 3);
    assert.equal(await draft.inputValue(), '留在服务篇原块的未保存书签');
    assert.equal(await annotation.inputValue(), '留在服务篇原块的未保存批注');
    assert.equal(await history('forward').isEnabled(), forwardBefore);
    await shot('desktop-failure');
  }, true);
  await open(rules);
  assert.equal(await page.locator('.position-notice').count(), 0);
  await history('back').click();
  await settled(service);
  await samePosition(failedFrom);
  assert.equal(await draft.inputValue(), '留在服务篇原块的未保存书签');
  assert.equal(await annotation.inputValue(), '留在服务篇原块的未保存批注');
  report.checks.push('Failure names full path and localized reason, keeps draft, history and offset, retry succeeds');

  await newPage({ width: 390, height: 844 }, 'reduce');
  await toggle().press('Enter');
  await file(service).press('Enter');
  await heading(service).waitFor();
  await top().getByRole('combobox').selectOption('en');
  await positionService();
  await toggle().press('Enter');
  await holdRules(async held => {
    await file(rules).press('Enter');
    await waiting();
    await nav().waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.file-switch-announcement').textContent(), 'Opening ' + rules);
    assert.equal(await main().evaluate(pane => pane === document.activeElement), true);
    const layout = await placeholder().evaluate(root => {
      const heading = root.querySelector('h1').getBoundingClientRect();
      const source = root.querySelector('.source-pane').getBoundingClientRect();
      const prose = root.querySelector('.explanation-pane').getBoundingClientRect();
      return { headingTop: heading.top, sourceLeft: source.left, sourceBottom: source.bottom,
        proseLeft: prose.left, proseTop: prose.top, animations: root.getAnimations({ subtree: true }).length };
    });
    assert.ok(layout.headingTop > 0 && layout.headingTop < 844 &&
      layout.sourceLeft === layout.proseLeft && layout.sourceBottom < layout.proseTop);
    assert.equal(layout.animations, 0);
    await shot('narrow-waiting');
    await held.release();
    await settled(rules);
    assert.equal(await main().evaluate(pane => pane === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await main().evaluate(pane => pane.contains(document.activeElement)), true);
    await shot('narrow-after');
  });
  await toggle().press('Enter');
  await fastSwitch(api, true, 'narrow-fast-reduced-motion');
  await toggle().press('Enter');
  await switchWithFrames(rules, true, 'narrow-natural-reduced-motion');
  report.checks.push('390px keyboard selection, focus and Tab after sidebar closes, stacked static skeleton, fast and natural reduced-motion switches');
  assert.deepEqual(await readRecords(), before);
  assert.deepEqual(report.writes, []);
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  if (page) await shot('failed').catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await reader?.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, frames: undefined }));
}
