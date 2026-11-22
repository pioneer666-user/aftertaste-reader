import { chooseLoop } from './loop-controls.mjs';
import assert from 'node:assert/strict';
import { appendFile, copyFile, cp, mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { api, audit, legendId, readJSON, rules, service, standardLegend, writeJSON } from '../fixtures/dependency-legends.mjs';
import { orderId, orderInput } from '../fixtures/loop-authoring.mjs';
import { createLoopReaderProject } from '../fixtures/loop-reader.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
const stage = process.env.AFTERTASTE_D028_STAGE;
const baseline = stage === 'baseline';
const surfaceBefore = stage === 'surface-before';
assert.ok(['edge', 'chrome', 'firefox'].includes(engine));
const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D028');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, (baseline ? 'baseline' : surfaceBefore ? 'surface-before' : 'history') + '-' + engine + '-'));
const project = path.join(run, 'project');
const data = path.join(project, 'docs/aftertaste');
const layoutPath = path.join(data, 'dependency-layout.json');
const input = process.env.AFTERTASTE_D028_INPUT;
if (input) {
  await cp(path.resolve(input), project, { recursive: true, force: false, errorOnExist: true });
} else {
  await createLoopReaderProject(project);
  for (const name of ['bookmarks.json', 'understanding-marks.json', 'notes.json']) {
    await copyFile(new URL('../fixtures/page-preview/' + name, import.meta.url), path.join(data, name));
  }
  const seed = await readJSON(layoutPath);
  seed.layout.positions = { [api]: { x: 192, y: 208 }, [rules]: { x: -471, y: 309 },
    [service]: { x: -157, y: 309 }, [audit]: { x: -475, y: 458 }, [legendId]: { x: -818, y: 208 } };
  seed.layout.viewport = { x: 919.31, y: 127.95, zoom: 0.7917047464637365 };
  await writeJSON(layoutPath, seed);
}

const report = { run, input: input ?? 'reconstructed order preview at 79%', build, engine, os: release(),
  node: process.version, checks: [], errors: [] };
let reader, browser, page;
const top = () => page.locator('.app-header');
const toggle = () => top().locator('.reader-navigation-toggle');
const arrow = direction => top().locator(`[data-history="${direction}"]`);
const back = () => arrow('back').click();
const forward = () => arrow('forward').click();
const graph = () => page.locator('#canvas-reading');
const file = name => graph().locator(`[data-file="${name}"]`);
const tools = () => graph().locator('#dependency-tools');
const summary = () => graph().locator('.canvas-summary');
const details = () => graph().locator('.canvas-details');
const dock = () => graph().locator('.canvas-dock');
const view = () => page.locator('#reading');
const marks = () => page.locator('#marks');
const bookmarks = () => page.locator('#bookmarks');
const notes = () => page.locator('#notes');
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const transform = scope => scope.locator('.vue-flow__transformationpane').evaluate(node => getComputedStyle(node).transform);
const tick = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const shot = label => page.screenshot({ path: path.join(run, label + '.png') });
const upToDate = name => view().getByRole('heading', { name, level: 1, exact: true }).waitFor();
const saved = () => graph().locator('[data-testid="layout-status"][data-state="canvasSaved"]').waitFor({ state: 'attached' });
const layoutResponse = () => page.waitForResponse(response =>
  response.url().endsWith('/api/dependency-layout') && response.request().method() === 'PUT');

async function saveLayout(action) {
  const [response] = await Promise.all([layoutResponse(), action()]);
  assert.equal(response.status(), 200);
  await saved();
}

async function open(pageKey) {
  const menu = top().locator('.app-page-menu-toggle');
  if (await menu.isVisible() && !await top().locator('#app-page-menu').isVisible()) await menu.click();
  await top().locator(`[data-page="${pageKey}"]`).click();
  await top().locator(`[data-page="${pageKey}"][aria-current="page"]`).waitFor({ state: 'attached' });
}

async function geometry() {
  const [pane, map] = await Promise.all([graph().locator('.graph-area').boundingBox(), dock().boundingBox()]);
  assert.ok(pane && map, 'graph and dock are visible');
  return { pane, map, transform: await transform(graph()) };
}

async function checkCanvasFrame() {
  const frame = await graph().evaluate(root => {
    const bounds = selector => root.querySelector(selector).getBoundingClientRect();
    const headerBottom = document.querySelector('.app-header').getBoundingClientRect().bottom;
    const pane = bounds('.graph-area');
    const dock = bounds('.canvas-dock');
    const rail = bounds('.canvas-rail');
    const corners = [[1, headerBottom + 1], [innerWidth - 2, headerBottom + 1],
      [1, innerHeight - 2], [innerWidth - 2, innerHeight - 2]];
    return {
      width: innerWidth, height: innerHeight, headerBottom,
      edges: [pane, bounds('.dependency-dots'), bounds('.vue-flow__pane')].map(rect => [rect.left, rect.top, rect.right, rect.bottom]),
      cornerHits: corners.map(([x, y]) => !!document.elementFromPoint(x, y)?.closest('#canvas-reading .vue-flow')),
      mapOpen: !!root.querySelector('.dependency-minimap'),
      railCenter: rail.y + rail.height / 2, railBottom: rail.bottom, dockTop: dock.top,
    };
  });
  const expected = [0, frame.headerBottom, frame.width, frame.height];
  for (const actual of frame.edges) {
    assert.ok(actual.every((value, index) => Math.abs(value - expected[index]) <= 1), JSON.stringify(frame));
  }
  assert.ok(frame.cornerHits.every(Boolean), JSON.stringify(frame));
  assert.ok(Math.abs(frame.railCenter - (frame.headerBottom + frame.dockTop) / 2) <= 1 &&
    frame.railBottom < frame.dockTop, JSON.stringify(frame));
  (report.canvasFrames ??= []).push(frame);
}

async function desktopProbe() {
  const heading = top().locator('[data-page="reader"]');
  await page.evaluate(() => document.fonts.ready);
  const readerTab = (await heading.boundingBox()).x;
  await open('canvas');
  await graph().locator('.dependency-minimap').waitFor();
  await file(api).waitFor();
  await tick();
  const idle = await geometry();
  const canvasTab = (await heading.boundingBox()).x;
  await shot('desktop-idle');
  await file(api).click();
  await tick();
  const selected = await geometry();
  await shot('desktop-api');
  report.geometry = { readerTab, canvasTab, idle, selected,
    tabShift: canvasTab - readerTab,
    dockBottomShift: selected.map.y + selected.map.height - idle.map.y - idle.map.height };
  if (baseline) return;
  assert.equal(report.geometry.tabShift, 0);
  assert.deepEqual(selected, idle, 'selection preserves graph bounds, dock and viewport');
  const baselineReport = process.env.AFTERTASTE_D028_BASELINE_REPORT;
  if (baselineReport) {
    const previous = await readJSON(baselineReport);
    assert.notEqual(previous.geometry.tabShift, 0, 'recorded previous top bar shift');
    assert.notEqual(previous.geometry.dockBottomShift, 0, 'recorded previous minimap shift');
    report.baseline = previous.geometry;
  }
}

async function checkRailMotion() {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(8, 70);
  const restX = (await tools().boundingBox()).x;
  await tools().evaluate(rail => {
    rail.d028Transitions = [];
    for (const eventName of ['transitionrun', 'transitionend', 'transitioncancel']) {
      rail.addEventListener(eventName, event => {
        const part = event.target === rail ? 'rail' : event.target.matches('.canvas-tool-label') ? 'label' : '';
        if (part && event.propertyName === 'opacity') {
          const phase = rail.classList.contains('canvas-rail-leave-active') ? 'leave' :
            rail.classList.contains('canvas-rail-enter-active') ? 'enter' : '';
          const sample = kind => rail.d028Transitions.push({
            part, phase, event: kind, opacity: Number(getComputedStyle(event.target).opacity),
            x: event.target.getBoundingClientRect().x,
          });
          sample(event.type);
          // Vue may finish a transition by timeout and clear the element before transitionend.
          if (part === 'rail' && event.type === 'transitionrun') {
            const observe = () => {
              if (!rail.classList.contains(`canvas-rail-${phase}-active`)) return;
              sample('frame');
              requestAnimationFrame(observe);
            };
            requestAnimationFrame(observe);
          }
        }
      }, { capture: true });
    }
  });
  await toggle().click();
  await tools().waitFor({ state: 'hidden' });
  assert.equal(await toggle().getAttribute('aria-expanded'), 'false');
  await toggle().click();
  await page.waitForFunction(() => {
    const rail = document.querySelector('#dependency-tools');
    return getComputedStyle(rail).opacity === '1' && !rail.classList.contains('canvas-rail-enter-active');
  });
  assert.equal(await toggle().getAttribute('aria-expanded'), 'true');
  const labels = tools().locator('.canvas-tool-label');
  const values = () => labels.evaluateAll(items => items.map(item => ({
    opacity: Number(getComputedStyle(item).opacity), visibility: getComputedStyle(item).visibility,
  })));
  const allHidden = () => page.waitForFunction(() => [...document.querySelectorAll('#dependency-tools .canvas-tool-label')]
    .every(label => getComputedStyle(label).opacity === '0'));
  await allHidden();
  await shot('desktop-rail-icons');
  await tools().hover();
  await page.waitForFunction(() => [...document.querySelectorAll('#dependency-tools .canvas-tool-label')]
    .every(label => getComputedStyle(label).opacity === '1'));
  assert.deepEqual(await values(), Array(4).fill({ opacity: 1, visibility: 'visible' }));
  await shot('desktop-rail-labels');

  // Move from the hovered icon through the gap and then into its own label.
  const action = button(tools(), '编辑分组');
  const label = action.locator('.canvas-tool-label');
  await action.hover();
  const target = await label.boundingBox();
  assert.ok(target);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await tick();
  assert.equal(await label.evaluate(element => element.matches(':hover') && getComputedStyle(element).opacity === '1'), true);
  await page.keyboard.press('Escape');
  await allHidden();
  assert.equal((await values()).every(state => state.opacity === 0), true, 'Escape dismisses labels with pointer still over rail');

  await page.mouse.move(8, 70);
  await page.keyboard.press('Tab');
  await action.focus();
  await page.waitForFunction(() => getComputedStyle(
    document.querySelector('#dependency-tools button:focus-visible .canvas-tool-label')).opacity === '1');
  await page.keyboard.press('Escape');
  await allHidden();
  assert.equal(await action.evaluate(element => document.activeElement === element), true, 'Escape retains keyboard focus');
  const samples = await tools().evaluate(rail => rail.d028Transitions);
  const normalRail = samples.filter(sample => sample.part === 'rail' && sample.event === 'frame');
  for (const phase of ['leave', 'enter']) {
    assert.ok(normalRail.some(sample => sample.phase === phase && sample.opacity > 0 && sample.opacity < 1 &&
      sample.x < restX - .5), 'rail slides as it fades on ' + phase);
  }
  const normalLabel = samples.filter(sample => sample.part === 'label' && sample.event === 'transitionend');
  assert.ok(normalLabel.some(sample => sample.opacity === 0));
  assert.ok(normalLabel.some(sample => sample.opacity === 1));

  await toggle().evaluate(async control => {
    for (let count = 0; count < 6; count++) {
      control.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  });
  await page.waitForFunction(() => {
    const rail = document.querySelector('#dependency-tools');
    return !rail.inert && getComputedStyle(rail).opacity === '1' && !rail.className.includes('-active');
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle().click();
  await tools().waitFor({ state: 'hidden' });
  await toggle().click();
  await tools().waitFor();
  await tools().hover();
  assert.deepEqual(await values(), Array(4).fill({ opacity: 1, visibility: 'visible' }));
  const reduced = await tools().evaluate(rail => [rail, ...rail.querySelectorAll('.canvas-tool-label')]
    .map(element => getComputedStyle(element).transitionDuration));
  assert.ok(reduced.every(value => value.split(',').every(duration => parseFloat(duration) === 0)));
  await page.mouse.move(8, 70);
  assert.deepEqual(await values(), Array(4).fill({ opacity: 0, visibility: 'hidden' }));
  report.motion = { rail: normalRail, labelEvents: normalLabel.length, reduced };
  report.checks.push('rail changes actual opacity and horizontal position; hover and keyboard labels animate, are hoverable and Escape dismissible; no reduced-motion transitions');
}

async function checkGlassStyle() {
  const metrics = await summary().evaluate(element => {
    const panel = getComputedStyle(element.closest('.canvas-panel'));
    const actions = [...element.querySelectorAll('.canvas-summary-actions button')].map(button => {
      const bounds = button.getBoundingClientRect();
      return { border: getComputedStyle(button).borderTopWidth, x: bounds.x, right: bounds.right, width: bounds.width, height: bounds.height };
    });
    const glyph = element.querySelector('.canvas-clear-detail svg').getBoundingClientRect();
    return { color: panel.backgroundColor, image: panel.backgroundImage, backdrop: panel.backdropFilter,
      shadow: panel.boxShadow, opacity: panel.opacity, radius: parseFloat(panel.borderTopLeftRadius),
      height: element.closest('.canvas-panel').getBoundingClientRect().height,
      corner: panel.getPropertyValue('corner-shape'),
      railCorner: getComputedStyle(document.getElementById('dependency-tools')).getPropertyValue('corner-shape'),
      actions, glyph: { width: glyph.width, height: glyph.height } };
  });
  assert.match(metrics.image, /linear-gradient/u);
  const alphas = [...metrics.image.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/gu)].map(match => Number(match[1]));
  assert.ok(alphas.length >= 1 && alphas.every(alpha => alpha <= .6), metrics.image);
  const tint = Number(metrics.color.match(/rgba\([^)]*,\s*([\d.]+)\)/u)?.[1]);
  assert.ok(tint >= 0 && tint <= .5, metrics.color);
  const blur = Number(metrics.backdrop.match(/blur\(([\d.]+)px\)/u)?.[1]);
  const saturation = Number(metrics.backdrop.match(/saturate\(([\d.]+)\)/u)?.[1]);
  assert.ok(blur > 0 && blur <= 7, metrics.backdrop);
  assert.ok(saturation > 1, metrics.backdrop);
  assert.equal(metrics.opacity, '1');
  assert.ok(metrics.radius >= metrics.height / 2, 'compact horizontal summary has round ends');
  assert.equal(metrics.corner, metrics.railCorner, 'compact summary uses the same corner curve as the rail');
  assert.match(metrics.shadow, /inset/u);
  assert.equal(metrics.actions.length, 3);
  for (const [index, action] of metrics.actions.entries()) {
    assert.equal(action.border, '0px');
    assert.ok(action.width >= 32 && action.height >= 32);
    if (index) assert.ok(action.x > metrics.actions[index - 1].right);
  }
  assert.ok(metrics.glyph.width >= 10 && metrics.glyph.width <= 14 && metrics.glyph.width === metrics.glyph.height);
  report.glass = { ...metrics, tint, alphas };
  await page.emulateMedia({ forcedColors: 'active' });
  try {
    const fallback = await summary().evaluate(element => {
      const style = getComputedStyle(element.closest('.canvas-panel'));
      return { image: style.backgroundImage, backdrop: style.backdropFilter };
    });
    assert.deepEqual(fallback, { image: 'none', backdrop: 'none' });
  } finally { await page.emulateMedia({ forcedColors: 'none' }); }
  report.checks.push('compact glass has translucent gradient, backdrop blur/saturation, edge highlight and shadow with an opaque forced-colors fallback; three separate borderless actions keep a full hit target');
}

async function captureGlass(restore) {
  const panel = await summary().boundingBox();
  const card = await file(service).boundingBox();
  const pane = await graph().locator('.graph-area').boundingBox();
  assert.ok(panel && card && pane);
  const shift = {
    x: Math.round(panel.x + panel.width / 3 - card.x - card.width / 2),
    y: Math.round(panel.y + panel.height / 2 - card.y - card.height / 2),
  };
  const start = { x: Math.round(pane.x + pane.width * .51), y: Math.round(pane.y + 18) };
  const end = { x: start.x + shift.x, y: start.y + shift.y };
  assert.ok(end.x > pane.x && end.x < pane.x + pane.width && end.y > pane.y && end.y < panel.y);
  async function pan(from, to) {
    await saveLayout(async () => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      try { await page.mouse.move(to.x, to.y, { steps: 18 }); }
      finally { await page.mouse.up(); }
    });
  }
  await pan(start, end);
  try {
    const behind = await file(service).boundingBox();
    assert.ok(behind.x < panel.x + panel.width && behind.x + behind.width > panel.x);
    assert.ok(behind.y < panel.y + panel.height && behind.y + behind.height > panel.y);
    await page.mouse.move(pane.x + pane.width - 8, pane.y + 8);
    await tick();
    await shot('desktop-glass-over-node');
    const textSamples = await summary().evaluate(element => {
      const texts = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const samples = [];
      while (texts.nextNode()) {
        const node = texts.currentNode;
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const color = getComputedStyle(node.parentElement).color;
        for (const bounds of range.getClientRects()) {
          if (bounds.width > 0) samples.push({ text: node.textContent.trim(), color, x: bounds.x, y: bounds.y,
            width: bounds.width, height: bounds.height });
        }
      }
      return samples;
    });
    const colors = await summary().evaluate(element => Array.from(element.querySelectorAll('*'), child => {
      const color = child.style.getPropertyValue('color');
      const priority = child.style.getPropertyPriority('color');
      child.style.setProperty('color', 'transparent', 'important');
      return { color, priority };
    }));
    try { await shot('desktop-glass-contrast-backing'); }
    finally {
      await summary().evaluate((element, values) => element.querySelectorAll('*').forEach((child, index) => {
        const { color, priority } = values[index];
        if (color) child.style.setProperty('color', color, priority);
        else child.style.removeProperty('color');
      }), colors);
    }
    report.glassOverlap = { panel, node: behind, textSamples };
  } finally {
    if (restore) {
      const from = { x: end.x + 48, y: end.y };
      const to = { x: start.x + 48, y: start.y };
      await pan(from, to);
    }
  }
}

async function checkCanvas() {
  const initial = await geometry();
  await checkRailMotion();
  await checkCanvasFrame();
  const railPaint = await tools().evaluate(element => getComputedStyle(element).backgroundColor);
  assert.ok(railPaint.match(/\d+/gu).slice(0, 3).every(channel => Number(channel) > 190), 'floating rail uses a light surface');
  report.label = await tools().locator('.canvas-tool-label').first().evaluate(element => {
    const style = getComputedStyle(element);
    return { color: style.color, weight: style.fontWeight };
  });
  assert.deepEqual(report.label, { color: 'rgb(82, 100, 91)', weight: '400' });
  await tools().hover();
  await shot('desktop-light-rail');
  await page.mouse.move(8, 70);
  await button(tools(), '重新布局').waitFor();
  await button(tools(), '刷新图和布局').waitFor();
  await tools().locator('summary').click();
  await page.keyboard.press('Escape');
  await button(tools(), '编辑分组').click();
  await graph().locator('#canvas-group-picker').waitFor();
  await button(graph(), '关闭分组').click();
  assert.deepEqual(await geometry(), initial, 'floating rail and group controls preserve the canvas');

  await file(api).click();
  const bounds = await summary().boundingBox();
  assert.ok(bounds.width < initial.pane.width * .75, 'compact summary leaves canvas on both sides');
  assert.ok(Math.abs((bounds.x + bounds.width / 2) - (initial.pane.x + initial.pane.width / 2)) < 2);
  assert.ok(initial.map.x + initial.map.width < bounds.x, 'summary clears minimap');
  assert.ok(bounds.height <= 58, 'desktop summary fits in one compact horizontal row');
  await checkGlassStyle();
  assert.match(await summary().innerText(), /依赖.*service\.mjs/su);
  assert.match(await summary().innerText(), /使用.*node:path/su);
  await button(summary(), '查看关系').click();
  await details().getByText('调用 createOrder 处理订单。', { exact: true }).waitFor();
  await summary().getByRole('heading', { name: api, exact: true }).waitFor();
  await details().getByText(standardLegend.uses[0].reason, { exact: true }).waitFor();
  assert.deepEqual(await geometry(), initial);
  await shot('desktop-api-details');
  await button(summary(), '关闭详情').click();
  await summary().waitFor();
  await graph().locator('[data-legend="node-path"]').click();
  await button(summary(), '查看关系').click();
  await details().getByText(standardLegend.description, { exact: true }).waitFor();
  for (const use of standardLegend.uses) await details().getByText(use.reason, { exact: true }).waitFor();
  await shot('desktop-library-details');
  await button(summary(), '关闭详情').click();
  assert.deepEqual(await geometry(), initial);
  assert.equal(await graph().locator('.canvas-inspector').count(), 0);
  await file(api).click();
  await button(summary(), '阅读讲解').waitFor();
  report.checks.push('desktop fixed tab, canvas, dock and transform; rail, group entry, file/library compact and complete details');
}

async function addScrollableApi() {
  // The fixed preview's API document is one short block. Add a reading block to the disposable copy.
  const topics = [
    '先区分路径处理和请求处理。上传分支用 basename 取得末段。订单分支把输入交给 createOrder，后者负责数量规则和集合更新。',
    '让请求使用来自浏览器的文件名 report.txt，核对调用者收到的名称。路径前段的目录有助于定位输入，末段才是此函数的返回值。',
    '从两种输入形状读 zod 的作用。字符串可进入 basename。数字输入在解析阶段被拒绝，路径处理函数不会接到这个数字。',
    '把路径取名和审计辅助函数的路径拼接放在一起对照。前者拆出最后一段，后者从目录和 audit.log 组成一个路径。',
    '回到订单分支。把响应结果与服务的返回值并排看，跟踪订单标识。接口层将业务结果交给调用者，业务层安排写入集合的顺序。',
    '用非法数量走一遍失败分支。先看数量检查抛错的地方，再顺着调用链找到接口如何表达失败，最后核原集合是否变化。',
    '分别记下三个入口概念。输入结构、业务步骤和响应转换各自回答不同的问题。先找错发生在哪层，再决定往哪份讲解继续读。',
    '再读同一段时，把可以对照源码验证的结论和推测分开。函数调用与条件能直接定位，未来业务需求需要回到真实调用场景确认。',
  ];
  const body = topics.map((value, index) => `### 阅读对照 ${index + 1}\n\n${value}\n`).join('\n');
  await appendFile(path.join(data, 'current', api + '.md'),
    '\n<!-- aftertaste:block id=apiwalk1 -->\n## 接口入口的两条路径\n\n' + body + '\n<!-- aftertaste:end -->\n');
}

async function readingPosition() {
  return view().evaluate(pane => {
    const block = pane.querySelector('#apiwalk1');
    return { scroll: pane.scrollTop, offset: Math.round(pane.getBoundingClientRect().top - block.getBoundingClientRect().top) };
  });
}

async function checkHistory() {
  await addScrollableApi();
  const viewport = await transform(graph());
  const layout = await readFile(layoutPath, 'utf8');
  const releaseRead = Promise.withResolvers();
  await page.route('**/api/document?path=*api.mjs.md', async route => {
    await releaseRead.promise;
    await route.continue();
  }, { times: 1 });
  const read = button(summary(), '阅读讲解');
  try {
    await read.click();
    await read.and(summary().locator('[aria-busy="true"]:disabled')).waitFor();
    await graph().getByRole('status').filter({ hasText: '正在读取' }).waitFor();
  } finally { releaseRead.resolve(); }
  await upToDate(api);
  await view().locator('#apiwalk1').waitFor();
  await view().locator('#apiwalk1').evaluate(block => {
    const pane = block.closest('#reading');
    pane.scrollTop += block.getBoundingClientRect().top - pane.getBoundingClientRect().top + 92;
  });
  await tick();
  const position = await readingPosition();
  assert.ok(position.scroll > 100 && position.offset > 30,
    'cross-page history must restore an offset inside the block: ' + JSON.stringify(position));
  await shot('desktop-reading-position');
  await view().locator('#apiwalk1 p').nth(1).evaluate(el => {
    getSelection().setBaseAndExtent(el.firstChild, 0, el.firstChild, 6);
  });
  await page.locator('.selection-copy-action').waitFor();
  await top().getByRole('button', { name: '新建笔记' }).click();
  const body = page.locator('#note-body:focus');
  await body.waitFor();
  assert.equal(await body.inputValue(), '');
  await body.fill('从接口讲解中段记下的独立想法');
  await notes().getByRole('status').filter({ hasText: /^已保存$/u }).waitFor();
  assert.ok((await readJSON(path.join(data, 'notes.json'))).notes.some(note => note.body === '从接口讲解中段记下的独立想法'));
  await back();
  await upToDate(api);
  await tick();
  assert.deepEqual(await readingPosition(), position);
  await open('bookmarks');
  await bookmarks().locator('.bookmark-entry').first().waitFor();
  await back();
  await upToDate(api);
  await tick();
  assert.deepEqual(await readingPosition(), position);
  await back();
  const pickedApi = file(api).and(graph().locator('[aria-pressed="true"]'));
  await pickedApi.waitFor();
  assert.equal(await transform(graph()), viewport);
  assert.equal(await readFile(layoutPath, 'utf8'), layout, 'returning to the graph does not save layout');
  await forward();
  await upToDate(api);
  await tick();
  assert.deepEqual(await readingPosition(), position);
  await forward();
  await bookmarks().waitFor();
  await open('canvas');
  await file(service).click();
  await saveLayout(() => button(dock(), '放大画布').click());
  const edited = await readFile(layoutPath, 'utf8');
  assert.notEqual(edited, layout);
  assert.notEqual(await transform(graph()), viewport);
  await back();
  await bookmarks().waitFor();
  await back();
  await upToDate(api);
  await back();
  await pickedApi.waitFor();
  assert.equal(await transform(graph()), viewport);
  assert.equal(await readFile(layoutPath, 'utf8'), edited, 'historical viewport leaves newer persisted edits intact');
  await forward();
  await upToDate(api);
  await open('marks');
  assert.equal(await arrow('forward').isDisabled(), true);
  await open('marks');
  await back();
  await upToDate(api);
  report.readingPosition = position;
  report.checks.push('graph > api block offset > bookmarks > back and forward; original selection and viewport restored after a newer graph visit without overwriting disk; marks branch closes forward history');
}

async function checkRecords() {
  await open('bookmarks');
  const savedBookmark = bookmarks().locator('.bookmark-entry').filter({ hasText: 'x4y6az2y' });
  await savedBookmark.locator('..').locator('.record-visit').click();
  await upToDate(rules);
  await back();
  await savedBookmark.and(bookmarks().locator('[aria-current="true"]')).waitFor();
  assert.equal(await arrow('forward').isEnabled(), true);

  await open('marks');
  await marks().locator('select').selectOption('not-understood');
  const mark = marks().locator('.bookmark-entry').filter({ hasText: 'x4y6az2y' });
  await mark.locator('..').locator('.record-visit').click();
  await upToDate(rules);
  await back();
  await mark.and(marks().locator('[aria-current="true"]')).waitFor();
  assert.equal(await marks().locator('select').inputValue(), 'not-understood');

  await open('notes');
  await notes().locator('#note-tag-filter').selectOption({ label: '订单' });
  const note = notes().getByRole('button', { name: /数量无效时，订单去哪了/u });
  await note.click();
  const body = notes().locator('#note-body');
  const follow = notes().getByRole('link', { name: '先校验数量，再建立待加入集合的对象', exact: true });
  assert.equal(await body.count(), 0);
  const original = (await readJSON(path.join(data, 'notes.json'))).notes.find(note => note.tags.includes('订单')).body;
  const serviceDocument = path.join(data, 'current', service + '.md');
  const serviceContent = await readFile(serviceDocument, 'utf8');
  try {
    await writeFile(serviceDocument, serviceContent.replace('id=m3vuiqzi ', 'id=missing1 '));
    await follow.click();
    await notes().locator('.note-visit-problem').waitFor();
    assert.match(await notes().locator('.note-visit-problem').innerText(), /m3vuiqzi/u);
    assert.equal(await arrow('forward').isDisabled(), true);
    await back();
    await marks().waitFor();
    await forward();
    await follow.waitFor();
  } finally {
    await writeFile(serviceDocument, serviceContent);
  }

  const saveReady = Promise.withResolvers(), releaseSave = Promise.withResolvers();
  const holdSave = async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    try {
      const response = await route.fetch();
      saveReady.resolve(response.status());
      await releaseSave.promise;
      return route.fulfill({ response });
    } catch (error) {
      saveReady.reject(error);
      throw error;
    }
  };
  await page.route('**/api/notes', holdSave);
  const padding = Array.from({ length: 32 }, (_, index) =>
    `阅读第 ${index + 1} 处提示。跟踪数量规则和订单集合。`).join('\n\n');
  const draft = original.replace('\n\n', '\n\n' + padding + '\n\n') + '\n\n' + padding;
  try {
    await button(notes(), '编辑').click();
    await body.fill(draft);
    const reached = await Promise.race([saveReady.promise, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('note save did not reach server')), 7000);
      timer.unref();
    })]);
    assert.equal(reached, 200);
    await notes().locator('.note-detail').getByText('正在保存…', { exact: true }).waitFor();
    await follow.evaluate(link => link.scrollIntoView({ block: 'center' }));
    await tick();
    const scroll = await page.evaluate(() => document.querySelector('#notes .record-detail').scrollTop);
    assert.ok(scroll > 0, 'notes return starts from a scrolled window');
    await follow.evaluate(link => link.addEventListener('click', () => {
      document.body.dataset.noteDeparture = String(link.getBoundingClientRect().top);
    }, { once: true }));
    await follow.click();
    const departure = await page.locator('body').getAttribute('data-note-departure');
    await upToDate(service);
    await back();
    await note.and(notes().locator('[aria-current="true"]')).waitFor();
    await follow.locator(':scope:focus').waitFor();
    assert.ok(Math.abs((await follow.boundingBox()).y - Number(departure)) < 2, 'same sentence stays at the reading position after the old error clears');
    assert.equal(await body.inputValue(), draft);
    assert.equal(await notes().locator('#note-tag-filter').inputValue(), '订单');
    assert.ok(await notes().locator('.record-detail').evaluate(pane => pane.scrollTop > 0));
    await notes().locator('.note-detail').getByText('正在保存…', { exact: true }).waitFor();
  } finally { releaseSave.resolve(); }
  await notes().getByText('已保存', { exact: true }).waitFor();
  await page.unroute('**/api/notes', holdSave);
  assert.ok((await readJSON(path.join(data, 'notes.json'))).notes.some(entry => entry.body === draft));
  report.checks.push('bookmark and filtered mark row return; unavailable link took no step; pending note draft, filter and scroll returned then saved');
}

async function checkDelayedHistory() {
  await open('canvas');
  await file(api).click();
  await button(summary(), '阅读讲解').click();
  await upToDate(api);
  await open('bookmarks');
  const reached = Promise.withResolvers(), releaseResponse = Promise.withResolvers(), finished = Promise.withResolvers();
  await page.route('**/api/document?path=*api.mjs.md', async route => {
    try {
      const result = await route.fetch();
      reached.resolve(result.status());
      await releaseResponse.promise;
      await route.fulfill({ response: result });
    } catch (error) {
      if (!route.request().failure()) reached.reject(error);
    } finally { finished.resolve(); }
  }, { times: 1 });
  try {
    await back();
    const status = await Promise.race([reached.promise, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('history return did not request current API explanation')), 7000);
      timer.unref();
    })]);
    assert.equal(status, 200);
    await forward();
    await bookmarks().locator(':scope:focus').waitFor();
    const focus = () => page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120));
    const active = await focus();
    releaseResponse.resolve();
    await finished.promise;
    await tick();
    assert.equal(await bookmarks().isVisible(), true);
    assert.equal(await focus(), active);
    assert.equal(await arrow('forward').isDisabled(), true);
  } finally { releaseResponse.resolve(); }
  const apiDocument = path.join(data, 'current', api + '.md');
  try {
    await rename(apiDocument, apiDocument + '.saved');
    await back();
    await upToDate(rules);
    await page.locator('.position-notice').getByText(/api\.mjs\.md/u).waitFor();
    await forward();
    await bookmarks().waitFor();
  } finally { await rename(apiDocument + '.saved', apiDocument); }
  report.checks.push('delayed response left the page, focus and cursor intact; missing historical document opened a current file with a reason');
}

async function checkLoops() {
  const dependencyView = await transform(graph());
  await open('loops');
  await chooseLoop(page, orderId);
  const loop = page.locator('#loop-canvas-' + orderId + '-reading');
  const panel = loop.locator('.canvas-inspector');
  const start = panel.locator('[data-reading-step="start"]');
  const check = panel.locator('[data-reading-step="check"]');
  await loop.locator('.loop-reader-toggle').click();
  await loop.locator('.loop-entry').click();
  await start.waitFor();
  const graphBox = await loop.locator('.graph-area').boundingBox();
  const panelBox = await panel.boundingBox();
  assert.ok(panelBox.x > graphBox.x && panelBox.x < graphBox.x + graphBox.width);
  assert.ok(Math.abs(panelBox.x + panelBox.width - graphBox.x - graphBox.width) <= 1);
  await start.locator('.loop-source-trigger').click();
  await page.locator('#loop-source-' + orderId).locator('pre').waitFor();
  await start.locator('[data-choice="check"]').click();
  await check.waitFor();
  for (const edge of orderInput.edges.filter(edge => edge.from === 'check')) {
    await check.getByText(edge.reason, { exact: true }).waitFor();
  }
  const loopView = await transform(loop);
  await shot('desktop-loop-branch');
  await open('canvas');
  assert.equal(await transform(graph()), dependencyView);
  await back();
  await check.waitFor();
  assert.equal(await page.locator('#loop-navigation [aria-current=true]').getAttribute('data-loop'), orderId);
  assert.equal(await transform(loop), loopView);
  await page.locator('#loop-source-' + orderId).waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 390, height: 760 });
  await check.locator('.loop-source-trigger').click();
  await page.locator('#loop-source-' + orderId + '.loop-source-inline').locator('pre').waitFor();
  await page.setViewportSize({ width: 1600, height: 900 });
  report.checks.push('loop right reading pane, actual source and branch reasons, loop and graph independent across history, narrow loop source');
}

async function checkHeader(width, language) {
  await page.setViewportSize({ width, height: 900 });
  await top().locator('.language-control select').selectOption(language);
  await page.evaluate(() => document.fonts.ready);
  const compact = width <= 850;
  const nav = top().locator(compact ? '.app-page-menu-toggle' : '[data-page="reader"]');
  await nav.waitFor();
  const keys = ['reader', 'canvas', 'loops', 'bookmarks', 'marks', 'notes'];
  const labels = language === 'en' ? ['File explanations', 'File dependencies', 'Reading loops', 'Bookmarks', 'Marks', 'Notes']
    : ['文件讲解', '文件依赖图', '闭环阅读', '书签', '标注', '笔记'];
  const start = target => target.evaluate(element => Math.round(element.getBoundingClientRect().x * 100) / 100);
  let fixed;
  for (const key of keys) {
    await open(key);
    await tick();
    const newNote = top().getByRole('button', { name: language === 'en' ? 'New note' : '新建笔记', exact: true });
    assert.ok(await newNote.isVisible());
    assert.equal(await newNote.locator('span').isVisible(), width > 950);
    assert.ok(await newNote.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return el.nextElementSibling.matches('.language-control') &&
        el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }));
    const positions = await Promise.all([arrow('back'), arrow('forward'), toggle(), nav].map(start));
    if (!compact) positions.push(...await top().locator('[data-page]').evaluateAll(nodes =>
      nodes.map(element => Math.round(element.getBoundingClientRect().x * 100) / 100)));
    if (!compact) {
      const lastTab = await top().locator('[data-page="notes"]').boundingBox();
      const firstTool = await top().locator('.toolbar').boundingBox();
      assert.ok(lastTab.x + lastTab.width <= firstTool.x, 'Tabs and tools must remain independently reachable');
    }
    if (fixed) assert.deepEqual(positions, fixed, `${width}px ${language} ${key}`);
    else fixed = positions;
    assert.ok(positions[0] < positions[1] && positions[1] < positions[2] && positions[2] < positions[3]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (['bookmarks', 'marks', 'notes'].includes(key)) {
      const pane = page.locator('#' + await toggle().getAttribute('aria-controls'));
      const wasOpen = await pane.isVisible();
      await toggle().press('Enter');
      assert.equal(await pane.isVisible(), !wasOpen);
      await toggle().press('Enter');
      assert.equal(await pane.isVisible(), wasOpen);
    } else if (key === 'loops') {
      assert.equal(await toggle().isEnabled(), true);
      assert.equal(await toggle().getAttribute('aria-controls'), 'loop-navigation');
    }
    if (compact) {
      await nav.focus();
      await page.keyboard.press('Enter');
      await top().locator('#app-page-menu:popover-open').waitFor();
      assert.equal(await top().locator(`[data-page="${key}"]`).getAttribute('aria-current'), 'page');
    }
    const menuText = await top().locator('[data-page]').allTextContents();
    assert.deepEqual(menuText.map(label => label.trim()), labels);
    if (compact) await page.keyboard.press('Escape');
  }
  report.checks.push(`fixed controls and labels on all six pages at ${width}px in ${language}`);
}

async function checkNarrow() {
  await page.setViewportSize({ width: 390, height: 760 });
  await page.reload();
  await upToDate(api);
  await open('canvas');
  await file(api).waitFor();
  await file(api).focus();
  await page.keyboard.press('Enter');
  await page.setViewportSize({ width: 390, height: 430 });
  await checkCanvasFrame();
  const help = tools().locator('summary');
  await help.hover();
  const labels = await tools().locator('.canvas-tool-label').evaluateAll(items => items.filter(item =>
    getComputedStyle(item).visibility === 'visible' && getComputedStyle(item).opacity === '1').map(item => {
    const bounds = item.getBoundingClientRect();
    return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom };
  }));
  assert.equal(labels.length, 1, 'short narrow view shows one label only');
  const readAction = button(summary(), '阅读讲解');
  const cta = await readAction.boundingBox();
  assert.ok(cta);
  assert.ok(labels[0].right <= cta.x || labels[0].left >= cta.x + cta.width ||
    labels[0].bottom <= cta.y || labels[0].top >= cta.y + cta.height, 'narrow label leaves the reading action accessible');
  assert.equal(await readAction.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
  }), true, 'reading button remains hit-testable');
  const activeLabel = help.locator('.canvas-tool-label');
  const helpBox = await help.boundingBox();
  const labelBox = await activeLabel.boundingBox();
  await page.mouse.move(labelBox.x - 2, helpBox.y + helpBox.height / 2, { steps: 8 });
  await page.mouse.move(labelBox.x - 2, labelBox.y + labelBox.height / 2, { steps: 8 });
  await page.mouse.move(labelBox.x + 8, labelBox.y + labelBox.height / 2, { steps: 6 });
  assert.equal(await activeLabel.evaluate(element => element.matches(':hover') &&
    getComputedStyle(element).visibility === 'visible'), true, 'short-window label stays visible on pointer transfer');
  await shot('short-narrow-rail-label');
  await top().locator('.app-page-menu-toggle').press('Enter');
  const pageMenu = top().locator('#app-page-menu:popover-open');
  await pageMenu.waitFor();
  await page.keyboard.press('Escape');
  await pageMenu.waitFor({ state: 'hidden' });
  await page.mouse.move(8, 70);
  await button(dock(), '小地图').click();
  await graph().locator('.dependency-minimap').waitFor();
  await checkCanvasFrame();
  await page.setViewportSize({ width: 390, height: 760 });
  await button(summary(), '查看关系').click();
  await details().getByText('调用 createOrder 处理订单。', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await shot('narrow-file-details');
  await button(summary(), '关闭详情').click();
  await checkCanvasFrame();
  await saveLayout(() => button(dock(), '放大画布').click());
  await button(tools(), '编辑分组').click();
  await graph().locator('#canvas-group-picker').waitFor();
  await button(graph(), '关闭分组').click();
  const before = await readFile(layoutPath, 'utf8');
  await page.route('**/api/dependency-layout', route => route.abort('failed'), { times: 1 });
  await button(dock(), '缩小画布').click();
  await graph().getByRole('alert').getByText(/NETWORK_ERROR/u).waitFor();
  assert.equal(await readFile(layoutPath, 'utf8'), before);
  await shot('narrow-layout-error');
  await saveLayout(() => button(graph(), '重试保存').click());
  assert.notEqual(await readFile(layoutPath, 'utf8'), before);
  await page.reload();
  await upToDate(api);
  assert.equal(await arrow('back').isDisabled(), true);
  assert.equal(await arrow('forward').isDisabled(), true);
  report.checks.push('short narrow window shows one tool label that clears the reading action; narrow details, map, zoom, group, visible failed save, retry and empty history on reload');
}

async function checkTouch() {
  const desktop = page;
  const touch = await browser.newPage({ viewport: { width: 390, height: 760 }, hasTouch: true, reducedMotion: 'reduce' });
  page = touch;
  try {
    page.setDefaultTimeout(7000);
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(reader.url);
    if (!await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
      assert.equal(engine, 'firefox', 'touch emulation must activate coarse pointer');
      report.checks.push('Firefox touch emulation kept the desktop pointer media feature');
      return;
    }
    await open('canvas');
    await file(api).waitFor();
    await checkCanvasFrame();
    await file(api).focus();
    await page.keyboard.press('Enter');
    await summary().waitFor();
    const controls = await graph().locator('#dependency-tools :is(button, summary), .canvas-dock button, .canvas-summary-actions button')
      .evaluateAll(elements => elements.map(el => {
        const { width, height } = el.getBoundingClientRect();
        return { label: el.getAttribute('aria-label') ?? el.textContent, width, height };
      }));
    assert.equal(controls.length, 12);
    for (const item of controls) assert.ok(item.width >= 44 && item.height >= 44, JSON.stringify(item));
    await button(summary(), '查看关系').tap();
    await details().getByText('调用 createOrder 处理订单。', { exact: true }).waitFor();
    await button(summary(), '关闭详情').tap();
    await summary().locator('.canvas-clear-detail').tap();
    await summary().waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 390, height: 430 });
    await button(dock(), '小地图').tap();
    await graph().locator('.dependency-minimap').waitFor();
    await checkCanvasFrame();
    report.checks.push('coarse-pointer emulation gives rail, dock and summary controls 44 CSS px hit targets; touch opens details and clears selection');
  } catch (error) {
    await shot('coarse-pointer-failure').catch(() => {});
    throw error;
  } finally {
    await touch.close();
    page = desktop;
  }
}

try {
  reader = await startReader(project, 0);
  browser = await (engine === 'firefox' ? firefox.launch() : chromium.launch({ channel: engine === 'edge' ? 'msedge' : engine }));
  report.browser = browser.version();
  page = await browser.newPage({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(reader.url);
  await upToDate(api);
  if (!baseline) {
    assert.equal(await arrow('back').isDisabled(), true);
    assert.equal(await arrow('forward').isDisabled(), true);
  }
  await desktopProbe();
  if (surfaceBefore) {
    await captureGlass(false);
  } else if (!baseline) {
    await checkCanvas();
    await captureGlass(true);
    await checkHistory();
    await checkRecords();
    await checkDelayedHistory();
    await open('canvas');
    await checkLoops();
    await checkHeader(1600, 'zh-CN');
    for (const width of [1151, 1150, 951, 950, 851]) await checkHeader(width, 'en');
    await checkHeader(850, 'en');
    await checkHeader(390, 'zh-CN');
    await checkNarrow();
    await checkTouch();
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error.stack;
  if (page) {
    report.motionFailure = await tools().evaluate(rail => ({
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, classes: rail.className,
      display: getComputedStyle(rail).display, transitions: rail.d028Transitions,
    }), undefined, { timeout: 500 }).catch(() => undefined);
    await shot('failure').catch(() => {});
  }
  console.error(run);
  throw error;
} finally {
  await browser?.close();
  await reader?.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
}
