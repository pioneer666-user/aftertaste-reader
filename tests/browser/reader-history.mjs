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
const baseline = process.env.AFTERTASTE_D028_STAGE === 'baseline';
assert.ok(['edge', 'chrome', 'firefox'].includes(engine));
const root = path.join(repository, '.local/D028');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, (baseline ? 'baseline' : 'history') + '-' + engine + '-'));
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

async function checkCanvas() {
  const initial = await geometry();
  await toggle().click();
  await tools().waitFor({ state: 'hidden' });
  assert.equal(await toggle().getAttribute('aria-expanded'), 'false');
  await toggle().click();
  await tools().waitFor();
  assert.equal(await toggle().getAttribute('aria-expanded'), 'true');
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
  assert.match(await summary().evaluate(element => getComputedStyle(element.closest('.canvas-panel')).backdropFilter), /blur/u);
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
  await button(summary(), '阅读讲解').click();
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
  await savedBookmark.click();
  await upToDate(rules);
  await back();
  await savedBookmark.and(bookmarks().locator('[aria-current="true"]')).waitFor();
  assert.equal(await arrow('forward').isEnabled(), true);

  await open('marks');
  await marks().locator('select').selectOption('not-understood');
  const mark = marks().locator('.bookmark-entry').filter({ hasText: 'x4y6az2y' });
  await mark.click();
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
  const original = await body.inputValue();
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
  const draft = original + '\n\n' + Array.from({ length: 32 }, (_, index) =>
    `阅读第 ${index + 1} 处提示。跟踪数量规则和订单集合。`).join('\n\n');
  try {
    await body.fill(draft);
    const reached = await Promise.race([saveReady.promise, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('note save did not reach server')), 7000);
      timer.unref();
    })]);
    assert.equal(reached, 200);
    await notes().getByText('正在保存…', { exact: true }).waitFor();
    await follow.evaluate(link => link.scrollIntoView({ block: 'center' }));
    await tick();
    const scroll = await page.evaluate(() => window.scrollY);
    assert.ok(scroll > 0, 'notes return starts from a scrolled window');
    await follow.evaluate(link => link.addEventListener('click', () => {
      document.body.dataset.noteDeparture = String(window.scrollY);
    }, { once: true }));
    await follow.click();
    const departure = await page.locator('body').getAttribute('data-note-departure');
    await upToDate(service);
    await back();
    await note.and(notes().locator('[aria-current="true"]')).waitFor();
    assert.ok(Number(departure) > 0, 'click left the note at a nonzero scroll position');
    await page.waitForFunction(top => window.scrollY === top, Number(departure));
    assert.equal(await body.inputValue(), draft);
    assert.equal(await notes().locator('#note-tag-filter').inputValue(), '订单');
    assert.equal(await page.evaluate(() => window.scrollY), Number(departure));
    await notes().getByText('正在保存…', { exact: true }).waitFor();
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
  const picker = page.getByLabel('已保存闭环', { exact: true });
  await picker.selectOption(orderId);
  const loop = page.locator('#loop-canvas-' + orderId + '-reading');
  const panel = loop.locator('.canvas-inspector');
  const start = panel.locator('[data-reading-step="start"]');
  const check = panel.locator('[data-reading-step="check"]');
  await start.waitFor();
  const graphBox = await loop.locator('.graph-area').boundingBox();
  assert.ok((await panel.boundingBox()).x >= graphBox.x + graphBox.width - 1);
  await start.getByText('本步讲解', { exact: true }).click();
  await start.locator('summary').filter({ hasText: '固定源码' }).click();
  await start.locator('pre').waitFor();
  const heading = orderInput.nodes.find(node => node.id === 'check').title;
  await button(start, heading).click();
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
  assert.equal(await picker.inputValue(), orderId);
  assert.equal(await transform(loop), loopView);
  await page.setViewportSize({ width: 390, height: 760 });
  await check.locator('summary').filter({ hasText: '固定源码' }).click();
  await check.locator('pre').waitFor();
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
    const positions = await Promise.all([arrow('back'), arrow('forward'), toggle(), nav].map(start));
    if (!compact) positions.push(...await top().locator('[data-page]').evaluateAll(nodes =>
      nodes.map(element => Math.round(element.getBoundingClientRect().x * 100) / 100)));
    if (fixed) assert.deepEqual(positions, fixed, `${width}px ${language} ${key}`);
    else fixed = positions;
    assert.ok(positions[0] < positions[1] && positions[1] < positions[2] && positions[2] < positions[3]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (['bookmarks', 'marks', 'loops'].includes(key)) {
      assert.ok(await toggle().isDisabled());
      assert.ok((await toggle().getAttribute('title'))?.trim(), 'disabled switch gives its reason');
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
  await button(summary(), '查看关系').click();
  await details().getByText('调用 createOrder 处理订单。', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await shot('narrow-file-details');
  await button(summary(), '关闭详情').click();
  await button(dock(), '小地图').click();
  await graph().locator('.dependency-minimap').waitFor();
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
  report.checks.push('narrow details, map, zoom, group, visible failed save, retry and empty history on reload');
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
  if (!baseline) {
    await checkCanvas();
    await checkHistory();
    await checkRecords();
    await checkDelayedHistory();
    await open('canvas');
    await checkLoops();
    await checkHeader(1600, 'zh-CN');
    await checkHeader(851, 'en');
    await checkHeader(850, 'en');
    await checkHeader(390, 'zh-CN');
    await checkNarrow();
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.failure = error.stack;
  if (page) await shot('failure').catch(() => {});
  console.error(run);
  throw error;
} finally {
  await browser?.close();
  await reader?.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
}
