import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { textContrast } from './theme-contrast.mjs';
import { build, repository } from '../fixtures/dependency-canvas.mjs';

const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
const input = process.env.AFTERTASTE_READER_INPUT;
assert.ok(input, 'Set AFTERTASTE_READER_INPUT to the D043 order with the mixed-reference note.');
const base = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D044/self');
await mkdir(base, { recursive: true });
const run = await mkdtemp(path.join(base, 'themes-' + engine + '-'));
const project = path.join(run, 'project');
await cp(input, project, { recursive: true, errorOnExist: true, force: false });
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const server = await startReader(project, 0);
const browser = await (engine === 'firefox' ? firefox.launch() : chromium.launch({ channel: engine === 'edge' ? 'msedge' : engine }));
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(7000);
const themes = ['warm', 'blue', 'white', 'black', 'green'];
const writes = [], errors = [];
const report = { engine, version: browser.version(), build, input, run, scenes: {}, writes, errors };
page.on('pageerror', e => errors.push(e.message));
page.on('request', req => { if (!['GET', 'HEAD'].includes(req.method())) writes.push(new URL(req.url()).pathname); });
const trigger = page.locator('[popovertarget=reader-theme-menu]');
const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const shot = name => page.screenshot({ path: path.join(run, name + '.png') });
async function choose(value) {
  const count = writes.length;
  await trigger.click();
  await page.locator('[data-theme-choice="' + value + '"]').click();
  await frames();
  assert.equal(await page.locator('html').getAttribute('data-theme'), value);
  assert.equal(writes.length, count, 'theme choice wrote project data');
}
const samples = {
  reader: ['#x4y6az2y .line-number', '.margin-panel .annotation-text', '#x4y6az2y .mark-controls [data-status=not-understood]', '#x4y6az2y .mark-controls [data-status=understood]', '.document-header h1'],
  canvas: ['.route-read', '.route-actions strong', '.canvas-summary h2', '.canvas-summary p', '.package-card .card-directory', '[data-route-member] .card-directory'],
  loops: ['.loop-step-heading', '.loop-source-panel code', '.loop-step-hint', '.loop-step-explanation p'],
  bookmarks: ['#bookmarks .record-prose', '#bookmarks .record-excerpt', '#bookmarks .record-list-location'],
  marks: ['#marks .record-prose', '#marks .record-excerpt', '#marks .record-list-location'],
  notes: ['#notes .note-reference small', '#notes .note-reference span', '#notes .note-preview a', '#notes .note-tag'],
};
async function matrix(name, subject, observe) {
  await subject.waitFor();
  const element = await subject.elementHandle();
  const states = report.scenes[name] = {};
  for (const value of themes) {
    await choose(value);
    assert.ok(await element.evaluate(e => e.isConnected), name + ' replaced reading surface');
    assert.ok(await subject.isVisible(), name + ' hid reading surface');
    const data = await observe();
    const geometry = await subject.boundingBox();
    if (states.warm) assert.deepEqual(geometry, states.warm.geometry, name + ' moved');
    states[value] = { geometry, data };
    const image = await shot(name + '-' + value);
    const pairs = await textContrast(page, image, samples[name]);
    if (name === 'reader') {
      const currentTab = '.app-page-menu button[aria-current=page]';
      await page.locator(currentTab).hover();
      const hovered = await textContrast(page, await shot('current-hover-' + value), [currentTab]);
      const source = '#x4y6az2y .source-line:first-child > span:nth-child(2)';
      const line = page.locator(source).first();
      await line.evaluate(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      });
      assert.ok((await page.evaluate(() => getSelection().toString())).trim());
      const selected = await textContrast(page, await shot('source-selection-' + value), [source], { selection: true });
      assert.equal(hovered.length, 1);
      assert.equal(selected.length, 2);
      pairs.push(...hovered, ...selected);
      await page.evaluate(() => getSelection().removeAllRanges());
    }
    assert.ok(pairs.length, 'No visible sample in ' + name);
    states[value].contrast = pairs;
    for (const pair of pairs) assert.ok(pair.ratio >= pair.minimum, JSON.stringify(pair));
  }
}
const go = name => page.locator('[data-page="' + name + '"]').click();
const ink = (locator, property) => locator.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), property);
const quick = page.locator('#quick-note');
async function quickEmpty() {
  await page.locator('.new-note').click();
  await quick.getByRole('searchbox').fill('不存在的订单条目 D044');
  await quick.getByText('没有匹配的笔记。').waitFor();
  await shot('empty-note-search');
  await quick.getByRole('button', { name: '关闭随手记' }).click();
}
try {
  await page.goto(server.url);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'green');
  const block = page.locator('#x4y6az2y');
  await page.locator('.file-list button').filter({ hasText: 'rules.mjs' }).click();
  await block.waitFor();
  await shot('baseline-reader');
  await block.locator('[data-kind=bookmarks]').click();
  await block.locator('.bookmark-note:visible').filter({hasText:'这个边界例子讲得巧'}).waitFor();
  await block.locator('[data-kind=mark]').click();
  const panel = block.locator('.margin-panel');
  await panel.locator('.annotation-text').waitFor();
  await matrix('reader', panel, async () => ({
    annotation: await panel.locator('.annotation-text').innerText(),
    mark: await ink(panel.locator('[data-status=not-understood] .state-symbol'), 'color'),
    paper: await ink(block.locator('.line-number').first(), 'background-color'),
    scroll: await page.locator('#reading').evaluate(e => e.scrollTop),
  }));
  await panel.locator('header button:visible').last().click();
  const paragraph = block.locator('[data-quote-field] p').first();
  await paragraph.evaluate(e => {
    const range = document.createRange();
    range.selectNodeContents(e);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  const toolbar = page.locator('.selection-copy-panel:visible');
  await toolbar.waitFor();
  await choose('black');
  await toolbar.waitFor();
  await toolbar.locator('.selection-copy-action').hover();
  await shot('selection-black');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: async () => { throw Error('denied'); } },
  }));
  await toolbar.locator('.selection-copy-action').click();
  const manual = toolbar.locator('textarea');
  await manual.waitFor();
  assert.match(await manual.inputValue(), /x4y6az2y/u);
  await shot('clipboard-error');
  await choose('green');
  await page.setViewportSize({ width: 1000, height: 520 });
  const pane = page.locator('#reading');
  const offset = await pane.evaluate(e => { e.scrollTop = 140; return e.scrollTop; });
  assert.ok(offset > 0);
  for (const value of ['black', 'green']) {
    await choose(value);
    assert.equal(await pane.evaluate(e => e.scrollTop), offset);
  }
  report.readingOffset = offset;
  await page.setViewportSize({ width: 1440, height: 900 });
  await go('canvas');
  const graph = page.locator('#canvas-reading');
  await page.locator('.reader-navigation-toggle').press('Enter');
  await page.locator('#loop-navigation [data-loop=order-quantity]').press('Enter');
  const file = graph.locator('[data-file="src/service.mjs"]');
  await file.click();
  await frames();
  await shot('baseline-canvas');
  const dots = graph.locator('.dependency-dots');
  const canvas = await dots.elementHandle();
  await matrix('canvas', file, async () => {
    assert.ok(await canvas.evaluate(e => e.isConnected));
    assert.equal(await file.getAttribute('aria-pressed'), 'true');
    assert.notEqual(await file.getAttribute('data-route-member'), null);
    const dotsPixel = await dots.evaluate(e => {
      const d = e.getContext('2d').getImageData(0, 0, 128, 128).data;
      let at = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > d[at + 3]) at = i;
      return Array.from(d.slice(at, at + 4));
    });
    const marker = await graph.locator('.direct-relation .vue-flow__edge-path').first().evaluate(el => {
      const ref = el.getAttribute('marker-end').match(/#([^']+)'\)/u)[1];
      const arrow = document.getElementById(ref).querySelector('polyline,path');
      return { line: getComputedStyle(el).stroke, arrow: getComputedStyle(arrow).fill };
    });
    assert.equal(marker.line, marker.arrow);
    return { dotsPixel, marker, file: await ink(file.locator('.card-surface'), 'fill'),
      library: await ink(graph.locator('.package-card .card-surface').first(), 'fill'),
      minimap: await ink(graph.locator('.minimap-view'), 'stroke'),
      view: await ink(graph.locator('.vue-flow__transformationpane'), 'transform') };
  });
  const paints = Object.values(report.scenes.canvas).map(s => s.data);
  for (const key of ['dotsPixel','file','library','minimap']) assert.equal(new Set(paints.map(s => String(s[key]))).size, 5, key);
  assert.equal(new Set(paints.map(s => s.view)).size, 1);

  await page.locator('.new-note').click();
  await quick.locator('.quick-list button').filter({ hasText:'订单步骤核对' }).click();
  const editor = quick.locator('.cm-content');
  await quick.locator('.note-reference').first().waitFor();
  await shot('baseline-note');
  const session = await editor.elementHandle();
  await editor.press('Control+End');
  await editor.press('Shift+ArrowLeft');
  for (const value of ['white','black']) {
    await choose(value);
    assert.ok(await session.evaluate(e => e.isConnected));
    await editor.focus();
    report['editor-' + value] = { cursor: await ink(quick.locator('.cm-cursor').first(),'border-left-color'),
      selection: await ink(quick.locator('.cm-selectionBackground').first(),'background-color') };
    await shot('quick-' + value);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const selectedRange = quick.locator('.cm-selectionBackground').first();
  assert.equal(await ink(selectedRange, 'outline-style'), 'solid');
  await shot('editor-forced-selection');
  await page.emulateMedia({ forcedColors: 'none' });
  await quick.getByRole('button',{name:'预览',exact:true}).click();
  await quick.locator('a[href$="/resume"]').first().click();
  const step = page.locator('[data-reading-step=resume]:visible');
  await step.waitFor();
  await step.locator('.loop-source-trigger').click();
  const source = page.locator('.loop-source-panel:visible');
  await matrix('loops', source, async () => ({ heading: await step.locator('.loop-step-heading').innerText(),
    text: await ink(step.locator('.loop-step-explanation'), 'color'), source: await source.innerText() }));
  await page.locator('[data-history=back]').click();
  await file.waitFor();
  assert.equal(await file.getAttribute('aria-pressed'), 'true');
  for (const name of ['bookmarks','marks']) {
    await go(name);
    const record = page.locator('#' + name + ' .record-article');
    await record.locator('.record-excerpt').waitFor();
    await matrix(name, record, async () => ({ text: await record.locator('.record-prose').innerText(),
      excerpt: await ink(record.locator('.record-context'), 'background-color') }));
  }
  await go('notes');
  const notes = page.locator('#notes');
  await notes.locator('.note-list button').filter({hasText:'订单步骤核对'}).click();
  await notes.locator('.note-actions button').filter({hasText:'编辑'}).first().click();
  const body = notes.locator('.cm-content');
  await matrix('notes', body, async () => ({ text: await body.innerText(),
    reference: await ink(notes.locator('.note-reference').first(),'background-color'),
    preview: await notes.locator('.note-preview a[href$="/resume"]').first().innerText() }));
  assert.deepEqual(writes, []);
  await notes.locator('.note-preview a[href$="/resume"]').first().click();
  await step.waitFor();
  await page.locator('[data-history=back]').click();
  await body.waitFor();

  // Block a real edit on this disposable order, then retry the same draft.
  await page.route('**/api/notes', route => route.request().method() === 'PUT'
    ? route.abort() : route.continue());
  await body.press('Control+End');
  await page.keyboard.insertText('草稿仍在');
  const retry = notes.getByRole('button',{name:'重试保存'});
  await retry.waitFor();
  await choose('black');
  assert.match(await body.innerText(), /草稿仍在/u);
  await notes.getByRole('alert').filter({hasText:'笔记未保存'}).waitFor();
  await shot('draft-failure');
  await page.unroute('**/api/notes');
  await retry.click();
  await notes.getByRole('status').filter({hasText:'已保存'}).waitFor();
  await quickEmpty();
  await page.reload();
  await trigger.waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'black');
  const reopened = await context.newPage();
  await reopened.goto(server.url);
  await reopened.locator('.theme-picker').waitFor();
  assert.equal(await reopened.locator('html').getAttribute('data-theme'), 'black');
  await reopened.close();
  await page.getByLabel('界面语言').selectOption('en');
  for (const width of [851,850,390]) {
    await page.setViewportSize({ width, height: 844 });
    await trigger.press('Enter');
    await page.locator('[data-theme-choice=black]:focus').waitFor();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.locator('[data-theme-choice=blue]:focus').waitFor();
    await shot('keyboard-' + width);
    await page.keyboard.press(width === 390 ? 'Enter' : 'Escape');
    assert.ok(await trigger.evaluate(e => e === document.activeElement && e.matches(':focus-visible')));
    const bounds = await page.evaluate(() => {
      const left = document.querySelector('.app-page-navigation').getBoundingClientRect();
      const right = document.querySelector('.toolbar').getBoundingClientRect();
      const last = [...document.querySelectorAll('[data-page]')].filter(e => e.offsetWidth).at(-1);
      return { navEnd: last?.getBoundingClientRect().right ?? left.right, toolbarStart: right.left,
        toolbarEnd: right.right, secondRow: right.top >= left.bottom, width: innerWidth };
    });
    assert.ok((bounds.secondRow || bounds.navEnd <= bounds.toolbarStart + 1) && bounds.toolbarEnd <= width, JSON.stringify(bounds));
  }
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'blue');
  await page.emulateMedia({ forcedColors: 'active' });
  await trigger.press('Enter');
  await page.locator('[data-theme-choice=blue]:focus').waitFor();
  const forcedOption = page.locator('[data-theme-choice=blue]');
  assert.equal(await forcedOption.getAttribute('aria-pressed'), 'true');
  const indicator = await forcedOption.evaluate(el => {
    const s = getComputedStyle(el);
    return { outline: s.outlineColor, surface: s.backgroundColor, width: s.outlineWidth, image: s.borderImageSource };
  });
  assert.notEqual(indicator.outline, indicator.surface);
  assert.ok(parseFloat(indicator.width) >= 2);
  assert.equal(indicator.image, 'none');
  report.forcedFocus = indicator;
  await shot('forced');
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.setItem('aftertaste.theme','legacy'));
  await page.reload();
  await page.locator('.theme-picker').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'green');
  await page.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){ throw new DOMException('Denied','SecurityError'); }}));
  await page.reload();
  await choose('black');
  await page.locator('[role=status]').filter({ hasText:'浏览器无法保存选择' }).waitFor();
  assert.deepEqual(errors, []);
  report.passed = true;
} finally {
  await writeFile(path.join(run,'report.json'),JSON.stringify(report,null,2));
  console.log(run);
  await browser.close();
  await server.server.close();
}
