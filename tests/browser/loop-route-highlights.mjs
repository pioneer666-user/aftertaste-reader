import { startTestReader, openReader, fetchReaderRoute } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox } from 'playwright';
import { repository } from '../fixtures/dependency-canvas.mjs';

const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D042/self');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'route-' + engine + '-'));
const project = path.join(run, 'project');
await cp(process.env.AFTERTASTE_TRIAL_PROJECT ?? path.join(repository, '.local/2026-11-19-page-preview/project'), project, { recursive: true });
const model = path.join(project, 'docs/aftertaste/loops/order-quantity/current/loop.json');
const original = JSON.parse(await readFile(model, 'utf8'));
const report = { run, writes: [], errors: [], boxes: [] };
const reader = await startTestReader(project, 0);
let browser;
try {
  browser = await (engine === 'firefox' ? firefox.launch() : chromium.launch({ channel: engine === 'edge' ? 'msedge' : engine }));
  report.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(7000);
  page.on('request', req => { if (req.method() === 'PUT') report.writes.push(req.url()); });
  page.on('pageerror', e => report.errors.push(e.message));
  const dep = page.locator('#canvas-reading');
  const actions = dep.locator('.route-actions');
  const button = (scope, name) => scope.getByRole('button', { name, exact: true });
  const drawer = page.locator('#loop-navigation');
  const toggle = page.locator('.reader-navigation-toggle');
  const order = 'order-quantity', tools = 'path-tools';
  const choose = async id => {
    await toggle.press('Enter');
    await drawer.locator('[data-loop="' + id + '"]').press('Enter');
    await drawer.waitFor({ state: 'hidden' });
  };
  async function members(expected) {
    const selector = '#canvas-reading [data-route-member]';
    const sorted = expected.toSorted();
    await page.waitForFunction(({ selector, sorted }) => {
      const paths = [...document.querySelectorAll(selector)].map(el => el.dataset.file).sort();
      return JSON.stringify(paths) === JSON.stringify(sorted);
    }, { selector, sorted });
  }
  const orderFiles = ['src/rules.mjs', 'src/service.mjs'];
  const toolFiles = ['src/api.mjs', 'support/audit.mjs'];
  const view = () => dep.locator('.vue-flow__transformationpane').evaluate(el => getComputedStyle(el).transform);
  const edges = () => dep.locator('.vue-flow__edge').evaluateAll(els => els.map(el => el.dataset.id).sort());
  const shot = name => page.screenshot({ path: path.join(run, name + '.png') });
  const clear = () => button(actions, '清除高亮').click();
  await openReader(page, reader.url + '#canvas-reading');
  assert.ok(await button(page, '后退').isDisabled());
  await dep.locator('[data-file]').first().waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  const before = await view();
  const originalEdges = await edges();
  const line = button(dep, 'src/service.mjs → src/api.mjs');
  const point = await line.locator('.vue-flow__edge-path').evaluate(el => {
    const p = el.getPointAtLength(el.getTotalLength() / 2).matrixTransform(el.getScreenCTM());
    if (!el.parentElement.contains(document.elementFromPoint(p.x, p.y))) throw Error('Dependency line is covered');
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(point.x, point.y);
  await dep.locator('.edge-reason').filter({ hasText: '调用 createOrder 处理订单。' }).waitFor();
  await choose(tools);
  await members(toolFiles);
  await choose(order);
  await members(orderFiles);
  await dep.locator('[data-file="src/service.mjs"]').click();
  await members(orderFiles);
  assert.deepEqual(await edges(), originalEdges);
  await dep.locator('.graph-area').click({ position: { x: 65, y: 90 } });
  await members(orderFiles);
  await dep.locator('[data-file="src/service.mjs"]').click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const box = await actions.boundingBox(), canvas = await dep.boundingBox();
    assert.ok(Math.abs(box.x + box.width / 2 - canvas.x - canvas.width / 2) <= 1);
    assert.ok(box.y >= canvas.y && box.y - canvas.y <= 18);
    for (const name of ['阅读此闭环', '清除高亮']) assert.ok(await button(actions, name).evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }));
    report.boxes.push({ width, box, canvas });
    await shot('order-' + width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await button(actions, '阅读此闭环').click();
  const loop = page.locator('#loop-canvas-order-quantity-reading');
  await loop.locator('[data-step="check"]').click();
  await button(loop, '展开讲解').click();
  assert.equal(await loop.locator('.loop-reader-toggle').getAttribute('aria-expanded'), 'true');
  await loop.locator('[data-reading-step="check"] > .loop-step-heading').waitFor();
  await shot('order-lesson');
  for (const target of ['resume', 'stop']) {
    await loop.locator('[data-choice="' + target + '"]').click();
    await loop.locator('[data-reading-step="' + target + '"] > .loop-step-heading').waitFor();
    await loop.locator('[data-incoming="check"]').click();
  }
  await button(page, '后退').click();
  await members(orderFiles);
  assert.equal(await dep.locator('[data-file="src/service.mjs"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await view(), before);
  // Remove only the inspected line while reading the loop; the graph and route are still usable.
  await line.press('Enter');
  await dep.locator('.edge-reason').waitFor();
  await button(actions, '阅读此闭环').click();
  await loop.waitFor();
  const graphFile = path.join(project, 'docs/aftertaste/dependency-graph.json');
  const graphRaw = await readFile(graphFile, 'utf8');
  const graph = JSON.parse(graphRaw);
  graph.edges = graph.edges.filter(edge => edge.dependent !== 'src/api.mjs');
  await writeFile(graphFile, JSON.stringify(graph));
  await button(page, '后退').click();
  await line.waitFor({ state: 'detached' });
  await page.locator('.position-notice').filter({ hasText: '无法回到原位置' }).waitFor();
  assert.equal(await dep.locator('.edge-reason').count(), 0);
  await members(orderFiles);
  await writeFile(graphFile, graphRaw);
  await clear();
  await members([]);

  for (const [patch, diagnostic] of [
    [{ source_commit: 'a'.repeat(40) }, '源码版本不同'],
    [{ project_prefix: 'sibling-project' }, 'sibling-project'],
    [{ nodes: original.nodes.map((node, i) => i === 0 ? { ...node, path: 'other/service.mjs' } : node) }, 'other/service.mjs'],
  ]) {
    await writeFile(model, JSON.stringify({ ...original, ...patch }));
    await choose(order);
    await actions.getByRole('status').filter({ hasText: diagnostic }).waitFor();
    await members([]);
    await button(actions, '阅读此闭环').waitFor();
    if (patch.source_commit) {
      await button(actions, '阅读此闭环').click();
      await loop.locator('[data-reading-step="check"] > .loop-step-heading').waitFor();
      await loop.locator('.loop-source-trigger').click();
      await page.locator('.loop-source-panel code').filter({ hasText: patch.source_commit }).waitFor();
      await button(page, '后退').click();
      await actions.getByRole('status').filter({ hasText: diagnostic }).waitFor();
    }
  }
  await writeFile(model, JSON.stringify(original));
  for (const replace of [false, true]) {
    const received = Promise.withResolvers(), release = Promise.withResolvers(), done = Promise.withResolvers();
    await page.route('**/api/loops/order-quantity/route', async route => {
      const response = await fetchReaderRoute(route);
      received.resolve();
      await release.promise;
      try { await route.fulfill({ response }); } finally { done.resolve(); }
    }, { times: 1 });
    await choose(order);
    await received.promise;
    if (replace) await choose(tools);
    else await clear();
    release.resolve();
    await done.promise;
    await members(replace ? toolFiles : []);
  }
  await page.route('**/api/loops/order-quantity/route', route => route.abort(), { times: 1 });
  await choose(order);
  await actions.getByRole('alert').waitFor();
  await members([]);
  assert.equal(await button(actions, '阅读此闭环').count(), 0);
  await clear();
  assert.deepEqual(report.writes, []);
  assert.deepEqual(report.errors, []);
  // Keep the second copy of service.mjs visible alongside the real participant.
  await page.route('**/api/dependency-canvas', async route => {
    const response = await fetchReaderRoute(route);
    const body = await response.json();
    body.graph.nodes.push({ path: 'other/service.mjs', analysis: 'reviewed' });
    body.layout.positions['other/service.mjs'] = { x: -160, y: 460 };
    await route.fulfill({ response, json: body });
  }, { times: 1 });
  await button(dep, '刷新图和布局').click();
  await dep.locator('[data-file="other/service.mjs"]').waitFor();
  const title = '路径工具怎样处理来自不同目录的同名文件'.repeat(5);
  await writeFile(model, JSON.stringify({ ...original, title }));
  await choose(order);
  await members(orderFiles);
  await page.setViewportSize({ width: 390, height: 844 });
  await actions.getByText(title, { exact: true }).waitFor();
  await page.getByLabel('界面语言').selectOption('en');
  await button(actions, 'Read this loop').waitFor();
  await button(actions, 'Clear highlights').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(report.writes, []);
  report.orderFiles = orderFiles;
  report.toolFiles = toolFiles;
  report.transform = before;
  report.edges = originalEdges;
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  await reader.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
}
