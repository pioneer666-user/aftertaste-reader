import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';

const input = process.env.AFTERTASTE_READER_INPUT;
assert.ok(input, 'Set AFTERTASTE_READER_INPUT to an isolated copy of the order reading project.');
const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D041');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'details-'));
const project = path.join(run, 'project');
await cp(path.resolve(input), project, { recursive: true, force: false, errorOnExist: true });
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
const report = { run, input, build, engine, geometry: {}, checks: [] };
const mirror = 'docs/aftertaste/current/';
const rules = mirror + 'src/rules.mjs.md';
const service = mirror + 'src/service.mjs.md';
const audit = mirror + 'support/audit.mjs.md';
const orders = '数量无效时，订单去哪了？';
const title = '数量规则承担转换与边界检查';
const data = name => path.join(project, 'docs/aftertaste', name);
const load = async file => JSON.parse(await readFile(data(file), 'utf8'));
const save = (file, value) => writeFile(data(file), JSON.stringify(value), 'utf8');
const bookmarks = await load('bookmarks.json');
const marks = await load('understanding-marks.json');
const ownBookmark = bookmarks.bookmarks.find(item => item.documentPath === rules && item.note.startsWith('这个边界例子讲得巧'));
const ownMark = marks.marks.find(item => item.documentPath === rules);
const noteFile = await readFile(data('notes.json'));
const reader = await startReader(project, 0);
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const pane = (page, name) => page.locator('#' + name);
const row = (scope, text) => scope.locator('.bookmark-entry').filter({ hasText: text });
const arrow = entry => entry.locator('..').locator('.record-visit');
const filter = scope => scope.getByRole('group', { name: '筛选标注' });
const detail = scope => scope.locator('.record-detail');
const active = scope => scope.locator('.bookmark-entry[aria-current=true]');
const full = scope => scope.locator('.record-full-location');
const scrolls = scope => scope.evaluate(node => ['.record-navigation', '.record-detail'].map(selector => node.querySelector(selector).scrollTop));
const back = page => page.locator('[data-history=back]').click();
const open = (page, name) => page.locator('[data-page=' + name + ']').click();
const shot = (page, name) => page.screenshot({ path: path.join(run, name + '.png') });
const documentPath = request => new URL(request.url()).searchParams.get('path');
const writes = [];
function observe(page) {
  page.setDefaultTimeout(9000);
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url());
  });
}

async function checkGeometry(page) {
  for (const viewport of [{ width: 1705, height: 919 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const measured = {};
    for (const name of ['bookmarks', 'marks', 'notes']) {
      await open(page, name);
      const scope = pane(page, name);
      const nav = scope.locator('.record-navigation');
      const prose = scope.locator(name === 'notes' ? '.note-preview .markdown > :first-child' : '.record-prose');
      if (name === 'marks') {
        await button(filter(scope), '全部').click();
        await scope.getByText('4 条', { exact: true }).waitFor();
      }
      if (name !== 'notes') {
        await scope.getByRole('heading', { name: title, exact: true }).waitFor();
        assert.equal(await prose.textContent(), name === 'bookmarks' ? ownBookmark.note : ownMark.annotation);
        assert.match(await scope.locator('.record-excerpt').innerText(), /^先转换，再检查是否为整数及是否越界。/u);
        await scope.getByText('src/rules.mjs · 第 1–7 行', { exact: true }).waitFor();
        await nav.getByText('rules.mjs · 第 1–7 行', { exact: true }).waitFor();
      } else await prose.getByText(orders, { exact: true }).waitFor();
      const list = await nav.boundingBox();
      const body = await prose.boundingBox();
      const gap = body.x - list.x - list.width;
      assert.ok(gap >= 32 && gap <= 56, `${name} starts ${gap} CSS px from sidebar`);
      assert.ok(body.width < 800);
      measured[name] = { listRight: list.x + list.width, start: body.x, gap, width: body.width };
      await shot(page, `${name}-${viewport.width}`);
    }
    const gaps = Object.values(measured).map(item => item.gap);
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1);
    report.geometry[`${viewport.width}x${viewport.height}`] = measured;
  }
}

async function checkOriginalRecords(page) {
  const notes = pane(page, 'notes');
  const noteLinks = notes.locator('.note-preview .markdown a');
  await noteLinks.first().press('Enter');
  await page.locator('#x4y6az2y:focus').waitFor();
  await back(page);
  await noteLinks.first().locator(':scope:focus').waitFor();
  await page.keyboard.press('Tab');
  await noteLinks.nth(1).locator(':scope:focus').waitFor();
  await page.locator('.reader-navigation-toggle').click();
  assert.equal(await notes.locator('.record-navigation').isVisible(), false);
  await notes.getByText(orders, { exact: true }).last().waitFor();
  await page.locator('.reader-navigation-toggle').click();
  await activeNote(notes).waitFor();

  const saved = pane(page, 'bookmarks');
  await open(page, 'bookmarks');
  assert.equal(await full(saved).getAttribute('open'), null);
  const original = row(saved, ownBookmark.note);
  const glyph = arrow(original).locator('svg');
  const explanation = saved.getByRole('region', { name: '当前讲解' });
  await explanation.getByRole('heading', { name: title, exact: true }).waitFor();
  for (const icon of [glyph, saved.locator('.record-label svg'), explanation.locator('.record-icon-label svg')]) {
    assert.equal(await icon.getAttribute('aria-hidden'), 'true');
  }
  const target = await arrow(original).boundingBox();
  const glyphBox = await glyph.boundingBox();
  assert.equal(glyphBox.width, 12);
  assert.ok(Math.abs(target.x + target.width / 2 - glyphBox.x - glyphBox.width / 2) <= 1);
  const metadata = original.locator('.record-list-location');
  await metadata.getByText('rules.mjs · 第 1–7 行', { exact: true }).waitFor();
  const [location, listText] = await Promise.all([metadata.boundingBox(), original.locator('.bookmark-note').boundingBox()]);
  assert.ok(Math.abs(location.x - listText.x) <= 1 && location.y > listText.y + listText.height);
  assert.equal(await metadata.evaluate(element => getComputedStyle(element).fontSize), '12px');
  const textArrow = button(explanation, '回原文').locator('svg path');
  assert.equal(await textArrow.getAttribute('d'), await glyph.locator('path').getAttribute('d'));
  report.amendment = { glyph: glyphBox, target, location, listText };
  await original.focus();
  await page.keyboard.press('Tab');
  await arrow(original).locator(':scope:focus-visible').waitFor();
  const tooltip = await arrow(original).evaluate(el => getComputedStyle(el, '::after').content);
  assert.match(tooltip, /回原文/u);
  await shot(page, 'bookmark-keyboard');
  await page.keyboard.press('Enter');
  await page.locator(`#bookmark-${ownBookmark.id}:focus`).waitFor();
  await back(page);
  await active(saved).filter({ hasText: ownBookmark.note }).waitFor();
  const emptyTitle = '服务把规则与辅助动作接到一起';
  await row(saved, emptyTitle).click();
  await detail(saved).getByText(emptyTitle, { exact: true }).waitFor();
  assert.equal(await detail(saved).getByText(emptyTitle, { exact: true }).count(), 1);
  assert.equal(await detail(saved).getByText('无备注', { exact: true }).count(), 1);
  await full(saved).locator('summary').click();
  await full(saved).getByText(service, { exact: true }).waitFor();
  assert.equal(await full(saved).locator('code').nth(0).evaluate(el => getComputedStyle(el).userSelect), 'text');

  const marked = pane(page, 'marks');
  await open(page, 'marks');
  await button(filter(marked), '全部').click();
  await marked.getByText('4 条', { exact: true }).waitFor();
  await row(marked, emptyTitle).click();
  await detail(marked).getByText(emptyTitle, { exact: true }).waitFor();
  assert.equal(await detail(marked).getByText('无批注', { exact: true }).count(), 1);
  await row(marked, '下次和上传入口').click();
  await marked.getByText('support/audit.mjs · 讲解块 overview', { exact: true }).waitFor();
  await marked.locator('.record-label').getByText('○ 未标记', { exact: true }).waitFor();
  await button(detail(marked), '回原文').click();
  await page.locator('#mark-overview:focus').waitFor();
  await page.locator('#overview .annotation-text').getByText('下次和上传入口的取文件名对照读。', { exact: true }).waitFor();
  await back(page);
  await active(marked).filter({ hasText: '下次和上传入口' }).waitFor();
  await button(filter(marked), '不理解').click();
  await arrow(row(marked, ownMark.annotation)).click();
  await page.locator('#mark-x4y6az2y:focus').waitFor();
  assert.equal(await page.locator('#x4y6az2y .mark-controls [aria-pressed=true]').getAttribute('data-status'), 'not-understood');
  assert.equal(await page.locator('#x4y6az2y .annotation-text').innerText(), ownMark.annotation);
  await back(page);
  assert.equal(await button(filter(marked), '不理解').getAttribute('aria-pressed'), 'true');
  await active(marked).filter({ hasText: ownMark.annotation }).waitFor();
  report.checks.push('原话、共用摘录与真实行号、两种回访焦点、空原话、无行号批注、笔记引用与 Tab');
}

async function checkPrototype(page) {
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 960, height: 500 });
  await open(page, 'bookmarks');
  const saved = pane(page, 'bookmarks');
  await saved.getByRole('heading', { name: title, exact: true }).waitFor();
  const nav = await saved.locator('.record-navigation').boundingBox();
  const body = await saved.locator('.record-prose').boundingBox();
  assert.equal(nav.width, 270);
  assert.equal(body.x - nav.x - nav.width, 40);
  await saved.screenshot({ path: path.join(run, 'bookmarks-prototype-scale.png') });
  await page.setViewportSize(viewport);
  await open(page, 'notes');
}

function activeNote(notes) {
  return notes.locator('.note-list button[aria-current=true]').filter({ hasText: orders });
}

async function checkTouch(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    observe(page);
    await page.goto(reader.url);
    for (const [name, text] of [['bookmarks', ownBookmark.note], ['marks', ownMark.annotation], ['notes', orders]]) {
      await page.locator('.app-page-menu-toggle').tap();
      await page.locator('[data-page=' + name + ']').tap();
      const scope = pane(page, name);
      const toggle = page.locator('.reader-navigation-toggle');
      const entry = name === 'notes' ? activeNote(scope) : row(scope, text);
      await toggle.tap();
      if (name !== 'notes') {
        const target = await arrow(entry).boundingBox();
        const selection = await entry.boundingBox();
        assert.ok(target.width >= 44 && target.height >= 44 && selection.x + selection.width <= target.x);
        report[name + 'Target'] = target;
        await shot(page, name + '-390-list');
      }
      await entry.tap();
      assert.equal(await scope.locator('.record-navigation').isVisible(), false);
      assert.equal((await detail(scope).boundingBox()).width, 390);
      if (name === 'notes') {
        await button(scope, '编辑').tap();
        await button(scope, '预览').tap();
        await scope.locator('.note-preview .markdown').getByText(orders, { exact: true }).waitFor();
      } else await scope.getByRole('heading', { name: title, exact: true }).waitFor();
      await shot(page, name + '-390-detail');
      await toggle.tap();
      if (name !== 'notes') {
        await arrow(entry).tap();
        await page.locator(name === 'bookmarks' ? `#bookmark-${ownBookmark.id}:focus` : '#mark-x4y6az2y:focus').waitFor();
        await back(page);
        await entry.and(active(scope)).waitFor();
      }
    }
  } finally { await context.close(); }
}

async function checkChangedDocuments(page) {
  const saved = pane(page, 'bookmarks');
  const original = await readFile(path.join(project, rules), 'utf8');
  const sameName = mirror + 'support/rules.mjs.md';
  const second = { ...ownBookmark, id: '4199a8ec-5be4-4dfd-8021-87dda30b2abc',
    note: '同一个块的第二条理由。\n' + '这行保留自己的写法。\n'.repeat(48) };
  const near = { ...ownBookmark, id: 'bbccb016-175e-44d2-9ab1-5549c81bdeac', documentPath: sameName, note: '同名文件的独立理由。' };
  const fillers = Array.from({ length: 24 }, (_, index) => ({ ...ownBookmark, note: `回读第 ${index} 条。`,
    id: `d041aa00-0000-4000-8000-${String(index).padStart(12, '0')}` }));
  await save('bookmarks.json', { ...bookmarks, bookmarks: [ownBookmark, near, ...bookmarks.bookmarks.slice(1), ...fillers, second] });
  await writeFile(path.join(project, sameName), original.replace(title, '同名文件的独立讲解').replace('先转换，再检查是否为整数及是否越界。', '同名文件的摘录保留自己内容。'));
  const initial = await readFile(data('bookmarks.json'));
  const rulesRequest = request => documentPath(request) === rules;
  const release = Promise.withResolvers();
  const counts = new Map();
  page.on('request', request => {
    const path = documentPath(request);
    if (path) counts.set(path, (counts.get(path) ?? 0) + 1);
  });
  await page.route('**/api/document?*', async route => {
    if (!rulesRequest(route.request())) return route.continue();
    const response = await route.fetch();
    await release.promise;
    await route.fulfill({ response });
  });
  const started = page.waitForRequest(rulesRequest);
  await page.goto(reader.url);
  await open(page, 'bookmarks');
  try {
    await started;
    await row(saved, near.note).click();
    await saved.getByRole('heading', { name: '同名文件的独立讲解', exact: true }).waitFor();
    await saved.getByText('support/rules.mjs · 第 1–7 行', { exact: true }).last().waitFor();
    assert.match(await saved.locator('.record-excerpt').innerText(), /同名文件的摘录保留自己内容/u);
    assert.ok(await saved.locator('.record-navigation').getByText(/src\/rules\.mjs ·/u).count() > 0);
    const late = page.waitForResponse(response => rulesRequest(response.request()));
    release.resolve();
    await late;
    const originalEntry = row(saved, ownBookmark.note);
    await originalEntry.getByText('src/rules.mjs · 第 1–7 行', { exact: true }).waitFor();
    assert.equal(counts.get(rules), 1, 'visible rows sharing a document use one outstanding request');
    assert.equal(await saved.locator('.record-prose').textContent(), near.note);
    await saved.getByRole('heading', { name: '同名文件的独立讲解', exact: true }).waitFor();
  } finally { release.resolve(); }
  await page.unroute('**/api/document?*');

  await row(saved, second.note.split('\n')[0]).click();
  assert.equal(await saved.locator('.record-prose').textContent(), second.note);
  const visit = button(detail(saved), '回原文');
  await visit.scrollIntoViewIfNeeded();
  const before = await scrolls(saved);
  assert.ok(before.every(top => top > 0));
  await visit.click();
  await page.locator(`#bookmark-${second.id}:focus`).waitFor();
  await back(page);
  await active(saved).filter({ hasText: '同一个块的第二条理由。' }).waitFor();
  assert.deepEqual(await scrolls(saved), before);
  report.bookmarkScroll = before;

  const changed = original.replace(title, '原块讲解已经改写').replace('先转换，再检查是否为整数及是否越界。', '当前讲解的摘录已经改写。');
  await writeFile(path.join(project, rules), changed.replace('id=x4y6az2y', 'id=changed1'));
  const refresh = button(saved, '刷新书签');
  await refresh.click();
  const problem = saved.locator('.record-unavailable');
  await problem.getByText('当前讲解中没有目标块。', { exact: true }).waitFor();
  assert.equal(await saved.locator('.record-prose').textContent(), second.note);
  await full(saved).locator('summary').click();
  await full(saved).getByText(rules, { exact: true }).waitFor();
  await full(saved).getByText('x4y6az2y', { exact: true }).waitFor();
  await shot(page, 'bookmark-unavailable');
  await writeFile(path.join(project, rules), changed);
  await button(problem, '重试读取').click();
  await saved.getByRole('heading', { name: '原块讲解已经改写', exact: true }).waitFor();
  assert.match(await saved.locator('.record-excerpt').innerText(), /当前讲解的摘录已经改写/u);
  await problem.waitFor({ state: 'hidden' });
  assert.deepEqual(await readFile(data('bookmarks.json')), initial);
  report.checks.push('同名同 ID 异文件、缺源码显示讲解、晚到响应不串位、当前改写、缺块重试、书签双区滚动归位');
}

async function checkMarkScrollAndEmpty(page) {
  const marked = pane(page, 'marks');
  const longMark = { ...ownMark, annotation: ownMark.annotation + ('\n这是较长的回读疑问。'.repeat(64)) };
  const fillers = Array.from({ length: 24 }, (_, i) => ({ ...ownMark, documentPath: audit, blockId: `d041${String(i).padStart(4, '0')}`,
    annotation: `批注第 ${i} 条。` }));
  await writeFile(path.join(project, audit), fillers.map(item => `\n<!-- aftertaste:block id=${item.blockId} -->\n${item.annotation}\n<!-- aftertaste:end -->\n`).join(''), { flag: 'a' });
  await save('understanding-marks.json', { ...marks, marks: [...fillers, ...marks.marks.slice(1), longMark] });
  const initial = await readFile(data('understanding-marks.json'));
  await open(page, 'marks');
  await button(filter(marked), '不理解').click();
  const entry = row(marked, ownMark.annotation);
  await entry.click();
  const visit = button(detail(marked), '回原文');
  await visit.scrollIntoViewIfNeeded();
  const before = await scrolls(marked);
  assert.ok(before.every(top => top > 0));
  await visit.click();
  await page.locator('#mark-x4y6az2y:focus').waitFor();
  await back(page);
  await active(marked).filter({ hasText: ownMark.annotation }).waitFor();
  assert.deepEqual(await scrolls(marked), before);
  assert.equal(await button(filter(marked), '不理解').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await readFile(data('understanding-marks.json')), initial);
  report.markScroll = before;
  await save('understanding-marks.json', { ...marks, marks: marks.marks.filter(item => item.status !== 'not-understood') });
  await button(marked, '刷新标注').click();
  await detail(marked).getByText('当前没有标为不理解的块。', { exact: true }).waitFor();
  await marked.getByText('0 条', { exact: true }).waitFor();
  await button(detail(marked), '清除筛选').click();
  await active(marked).waitFor();
  await save('understanding-marks.json', { ...marks, marks: [] });
  await button(marked, '刷新标注').click();
  await detail(marked).getByText(/还没有标注/u).waitFor();
  await save('bookmarks.json', { ...bookmarks, bookmarks: [] });
  await open(page, 'bookmarks');
  const saved = pane(page, 'bookmarks');
  await detail(saved).getByText(/还没有书签/u).waitFor();
  await page.route('**/api/bookmarks', route => route.abort(), { times: 1 });
  await button(saved, '刷新书签').click();
  await saved.getByRole('alert').waitFor();
  await button(saved, '刷新书签').click();
  await saved.getByRole('alert').waitFor({ state: 'hidden' });
  await detail(saved).getByText(/还没有书签/u).waitFor();
  report.checks.push('标注双区滚动、筛选与归位、空列表与筛选无匹配、列表读失败后刷新');
}

async function checkCorners(page) {
  await page.goto(reader.url);
  await open(page, 'bookmarks');
  const saved = pane(page, 'bookmarks');
  const entry = row(saved, ownBookmark.note);
  const selected = entry.locator('..');
  const panel = saved.getByRole('region', { name: '当前讲解' });
  await panel.getByRole('heading', { name: title, exact: true }).waitFor();
  const shape = async (el, radius) => {
    if (engine === 'firefox') await el.and(page.locator('[data-reader-corner]')).waitFor();
    const style = await el.evaluate(element => {
      const style = getComputedStyle(element);
      const image = element.style.getPropertyValue('--reader-corner-image');
      const id = image.match(/#([\w-]+)/u)?.[1];
      return { radius: style.getPropertyValue('--corner-size').trim(), corner: style.getPropertyValue('corner-shape'),
        paths: id ? [...document.getElementById(id).children].map(path => path.getAttribute('d')) : [] };
    });
    assert.equal(style.radius, radius);
    if (engine === 'firefox') assert.ok(style.paths.some(path => path.includes(' C')));
    else assert.match(style.corner, /^(?:squircle|superellipse\(2\))$/u);
    return style;
  };
  report.selectedCorner = await shape(selected, '14px');
  report.panelCorner = await shape(panel, '21px');
  await entry.focus();
  await page.keyboard.press('Tab');
  await arrow(entry).locator(':scope:focus-visible').waitFor();
  report.arrowCorner = await shape(arrow(entry), '9px');
  await shot(page, 'corners-bookmark');

  await page.emulateMedia({ forcedColors: 'active' });
  const outline = await arrow(entry).evaluate(element => {
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
  });
  assert.notEqual(outline.style, 'none');
  assert.ok(parseFloat(outline.width) >= 2);
  await shot(page, 'forced-colors');
  report.forcedColors = outline;
  await page.emulateMedia({ forcedColors: 'none' });

  const original = await readFile(path.join(project, rules), 'utf8');
  await writeFile(path.join(project, rules), original.replace('id=x4y6az2y', 'id=changed1'));
  try {
    for (const name of ['bookmarks', 'marks']) {
      await open(page, name);
      const scope = pane(page, name);
      await button(scope, name === 'bookmarks' ? '刷新书签' : '刷新标注').click();
      const notice = scope.locator('.record-unavailable');
      await notice.getByText('当前讲解中没有目标块。', { exact: true }).waitFor();
      report[name + 'UnavailableCorner'] = await shape(notice, '21px');
      await shot(page, 'corners-' + name + '-unavailable');
    }
  } finally { await writeFile(path.join(project, rules), original); }
  report.checks.push('选中行 14 px、摘录及失效提示 21 px、行尾控件 9 px，强制色下保留焦点');
}

let browser;
try {
  browser = engine === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: 'msedge' });
  report.version = browser.version();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  observe(page);
  await page.goto(reader.url);
  if (engine !== 'firefox') {
    await checkGeometry(page);
    await checkPrototype(page);
    await checkOriginalRecords(page);
    await checkTouch(browser);
  }
  await checkCorners(page);
  if (engine !== 'firefox') {
    await checkChangedDocuments(page);
    await checkMarkScrollAndEmpty(page);
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(await readFile(data('notes.json')), noteFile);
  report.writeRequests = writes;
  console.log(JSON.stringify({ run, engine, checks: report.checks, geometry: report.geometry }));
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await browser?.close();
  await reader.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
}
