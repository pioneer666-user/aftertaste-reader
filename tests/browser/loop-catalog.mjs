import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { chooseLoop, openCatalog } from './loop-controls.mjs';

const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const root = path.join(repository, '.local/D032');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'catalog-'));
const project = path.join(run, 'project');
await cp(process.env.AFTERTASTE_TRIAL_PROJECT ?? path.join(repository, '.local/2026-11-19-page-preview/project'),
  project, { recursive: true, force: false, errorOnExist: true });
const browser = await chromium.launch({ channel: 'msedge' });
const report = { run, build, browser: browser.version(), frames: [], writes: [], errors: [] };
let reader;
try {
  reader = await startReader(project, 0);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(8000);
  const requests = [];
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', req => {
    requests.push(new URL(req.url()).pathname);
    if (req.method() !== 'GET') report.writes.push(req.method() + ' ' + new URL(req.url()).pathname);
  });
  const button = name => page.getByRole('button', { name, exact: true });
  const toggle = page.locator('.reader-navigation-toggle');
  const drawer = page.locator('#loop-navigation');
  const shot = name => page.screenshot({ path: path.join(run, name + '.png') });
  const bounds = selector => page.locator(selector).boundingBox();
  const waitClosed = () => drawer.waitFor({ state: 'hidden' });
  await page.goto(reader.url);
  const releaseList = Promise.withResolvers();
  await page.route('**/api/loops', async route => { await releaseList.promise; await route.continue(); }, { times: 1 });
  await button('闭环阅读').click();
  await drawer.getByRole('status').waitFor();
  releaseList.resolve();
  await drawer.locator('[data-loop="order-quantity"]').waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await drawer.locator('.loop-catalog-copy small').allTextContents(), ['5 步 · 2 个文件', '2 步 · 2 个文件']);
  assert.deepEqual(await drawer.locator('.loop-thumbnail').evaluateAll(images => images.map(svg =>
    [svg.querySelectorAll('circle').length, svg.querySelectorAll('path[marker-end]').length])), [[5,4],[2,1]]);
  await page.getByText('从左侧选择一个闭环，开始阅读。', { exact: true }).waitFor();
  assert.ok(!requests.some(url => url === '/api/dependency-canvas' || url.startsWith('/api/loops/')));
  const box = await bounds('#loop-workspace');
  const header = await bounds('.app-header');
  assert.deepEqual(box, { x: 0, y: header.height, width: 1440, height: 900 - header.height });
  report.empty = box;
  await shot('first');
  await page.keyboard.press('Escape');
  await waitClosed();
  await page.getByText('打开顶栏的闭环目录，选择一个闭环开始阅读。').waitFor();
  await page.locator('.skip-link').press('Enter');
  assert.ok(await drawer.evaluate(el => el === document.activeElement));
  await chooseLoop(page, 'order-quantity');
  const loop = page.locator('#loop-canvas-order-quantity-reading');
  await loop.locator('.loop-overview').waitFor();
  await waitClosed();
  await openCatalog(page);
  await page.locator('.skip-link').press('Enter');
  await waitClosed();
  assert.ok(await loop.evaluate(el => el === document.activeElement));
  report.selected = await loop.locator('.canvas-workspace').boundingBox();
  assert.deepEqual(report.selected, box);
  await shot('overview');
  await button('文件依赖图').click();
  await page.locator('#canvas-reading .vue-flow__node').first().waitFor();
  report.dependency = await bounds('#canvas-reading .canvas-workspace');
  assert.deepEqual(report.dependency, box);
  await button('闭环阅读').click();

  const area = loop.locator('.graph-area');
  const priorWrites = report.writes.length;
  await page.keyboard.down('Control');
  assert.equal(await area.getAttribute('data-tool'), 'select');
  await openCatalog(page);
  const lastEntry = drawer.locator('[data-loop]').last();
  await lastEntry.focus();
  await page.keyboard.up('Control');
  await page.keyboard.press('Escape');
  await waitClosed();
  assert.equal(await area.getAttribute('data-tool'), 'hand');
  await openCatalog(page);
  await lastEntry.press('Tab');
  assert.ok(await toggle.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return el === document.activeElement && el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  }));
  await page.keyboard.press('Enter');
  await waitClosed();
  assert.equal(report.writes.length, priorWrites);

  const pan = await area.boundingBox();
  await page.mouse.move(pan.x + pan.width * .55, pan.y + pan.height * .65);
  await page.mouse.down();
  await page.mouse.move(pan.x + pan.width * .55 + 32, pan.y + pan.height * .65 + 16, { steps: 5 });
  await page.mouse.up();
  await Promise.all([page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('order-quantity/layout')), button('放大画布').click()]);
  await loop.locator('[data-step="check"]').click();
  await loop.locator('.loop-original summary').click();
  await loop.locator('.loop-source-trigger').click();
  await page.locator('.loop-source-floating').waitFor();
  const inspector = loop.locator('.canvas-inspector');
  await inspector.evaluate(el => { el.scrollTop = 88; });
  assert.ok(await inspector.evaluate(el => el.scrollTop) > 0, 'scroll a real lesson');
  await loop.locator('[data-testid="layout-status"][data-state="canvasSaved"]').waitFor({ state: 'attached' });
  const writeCount = report.writes.length;
  await page.evaluate(() => {
    const bounds = el => { const { x,y,width,height } = el.getBoundingClientRect(); return [x,y,width,height]; };
    const drawer = document.querySelector('#loop-navigation');
    const loop = document.querySelector('#loop-canvas-order-quantity-reading');
    window.catalogFrames = [];
    window.catalogSample = () => {
      const source = document.querySelector('.loop-source-floating');
      return { drawerX: drawer.getBoundingClientRect().x,
        node: bounds(loop.querySelector('[data-step="check"]').closest('.vue-flow__node')),
        map: bounds(loop.querySelector('.dependency-minimap')),
        view: getComputedStyle(loop.querySelector('.vue-flow__transformationpane')).transform,
        scroll: loop.querySelector('.canvas-inspector').scrollTop, step: loop.querySelector('[data-reading-step]').dataset.readingStep,
        source: source && [source.innerText, source.querySelector('.source-pane').scrollLeft, source.querySelector('.source-pane').scrollTop] };
    };
    const sample = () => { window.catalogFrames.push(window.catalogSample()); window.catalogFrame = requestAnimationFrame(sample); };
    sample();
  });
  await toggle.click();
  await drawer.locator('[aria-current=true]').hover();
  await drawer.getByRole('button', { name: '刷新闭环列表' }).click();
  await page.keyboard.press('Escape');
  await waitClosed();
  assert.ok(await toggle.evaluate(el => el === document.activeElement));
  await toggle.click();
  await drawer.locator('[aria-current=true]').hover();
  await shot('reading-catalog');
  await toggle.click();
  await waitClosed();
  const frames = await page.evaluate(() => { cancelAnimationFrame(window.catalogFrame); return window.catalogFrames; });
  assert.ok(frames.some(f => f.drawerX > -365 && f.drawerX < -2));
  assert.ok(frames.some(f => f.drawerX === 0));
  assert.equal(frames[0].drawerX, frames.at(-1).drawerX);
  assert.equal(frames[0].step, 'check');
  assert.ok(frames[0].source);
  const stable = ({ drawerX, ...geometry }) => geometry;
  for (const frame of frames) assert.deepEqual(stable(frame), stable(frames[0]));
  report.frames = frames.map(({ source, ...f }) => ({ ...f, pinned: !!source, sourceScroll: source.slice(1) }));
  assert.equal(report.writes.length, writeCount);
  await page.setViewportSize({ width: 1000, height: 900 });
  await openCatalog(page);
  await drawer.locator('[aria-current=true]').hover();
  assert.ok(await page.evaluate(() => {
    const panel = document.querySelector('.loop-source-floating').getBoundingClientRect();
    const catalog = document.querySelector('#loop-navigation');
    const x = Math.min(catalog.getBoundingClientRect().right, panel.right) - 2;
    return x > panel.left && catalog.contains(document.elementFromPoint(x, panel.top + 12));
  }), 'overlapping pinned source stays behind the catalog');
  await toggle.click();
  await waitClosed();
  await page.setViewportSize({ width: 1440, height: 900 });
  await chooseLoop(page, 'path-tools');
  await page.locator('#loop-canvas-path-tools-reading .loop-overview').waitFor();
  await chooseLoop(page, 'order-quantity');
  assert.equal(await inspector.evaluate(el => el.scrollTop), frames[0].scroll);
  await button('文件讲解').click();
  await button('后退').click();
  await loop.locator('[data-reading-step="check"]').waitFor();
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.app-page-menu-toggle').click();
  await page.locator('[data-page="loops"]').click();
  await drawer.locator('[data-loop="order-quantity"]').waitFor();
  await shot('narrow-catalog');
  assert.equal(await drawer.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await drawer.locator('[data-loop="order-quantity"]').press('Enter');
  await loop.locator('.loop-entry').click();
  await loop.locator('[data-reading-step="start"]').waitFor();
  await shot('narrow-step');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const loops = path.join(project, 'docs/aftertaste/loops');
  await rename(loops, loops + '.parked');
  await openCatalog(page);
  await button('刷新闭环列表').click();
  await drawer.getByText('当前项目还没有已保存的闭环').waitFor();
  await rename(loops + '.parked', loops);
  await page.route('**/api/loops', route => route.fulfill({ status: 500, json: {
    ok:false, error:{ code:'LOOP_LIST_FAILED', context:{}, message:'', nextStep:'' },
  } }), { times: 1 });
  await button('刷新闭环列表').click();
  await drawer.getByRole('alert').filter({hasText:'LOOP_LIST_FAILED'}).waitFor();
  await button('刷新闭环列表').click();
  await drawer.locator('[data-loop="path-tools"]').waitFor();
  await page.getByLabel('界面语言').selectOption('en');
  await drawer.getByRole('heading', {name:/Loop catalog/}).waitFor();

  // A long catalog can scroll independently and remembers the reader's place.
  await page.route('**/api/loops', async route => {
    const response = await route.fetch();
    const list = await response.json();
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...list.loops[0], id: 'extra-' + i }));
    await route.fulfill({ json: { ...list, loops: [...list.loops, ...rows] } });
  }, { times: 1 });
  await drawer.getByRole('button', { name: 'Refresh loop list' }).click();
  await drawer.locator('[data-loop="extra-19"]').waitFor({ state: 'attached' });
  const list = drawer.locator('.loop-catalog-list');
  await list.hover();
  await page.mouse.wheel(0, 420);
  await page.waitForFunction(() => document.querySelector('.loop-catalog-list').scrollTop > 0);
  await drawer.locator('[data-loop="extra-5"]').focus();
  const offset = await list.evaluate(el => el.scrollTop);
  await page.keyboard.press('Escape');
  await waitClosed();
  await toggle.press('Enter');
  assert.equal(await list.evaluate(el => el.scrollTop), offset);
  assert.equal(await page.evaluate(() => scrollY), 0);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  await browser.close();
  await reader?.server.close();
  await writeFile(path.join(run,'report.json'), JSON.stringify(report,null,2));
  console.log(run);
}
