import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox } from 'playwright';
import { startReader } from '../../dist/server/reader.js';
import { createLoopReaderProject, explanationFile, git } from '../fixtures/loop-reader.mjs';

const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
assert.ok(['edge', 'chrome', 'firefox'].includes(engine));
const root = fileURLToPath(new URL(`../../.local/${process.env.AFTERTASTE_TEST_TASK ?? 'D022'}/`, import.meta.url));
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'browser-'));
const fixture = await createLoopReaderProject(path.join(run, 'project'));
const assets = new URL('../fixtures/page-preview/', import.meta.url);
const recordFiles = ['bookmarks.json', 'understanding-marks.json', 'notes.json'];
for (const name of recordFiles) await copyFile(new URL(name, assets), path.join(fixture.data, name));
const before = await Promise.all(recordFiles.map(name => readFile(path.join(fixture.data, name), 'utf8')));

const duplicate = 'support/service.mjs';
const sampleDirectory = 'src/zz-samples';
const samples = Array.from({ length: 24 }, (_, index) => `${sampleDirectory}/sample-${String(index).padStart(2, '0')}.mjs`);
await mkdir(path.join(fixture.projectRoot, sampleDirectory), { recursive: true });
await mkdir(path.dirname(explanationFile(fixture, samples[0])), { recursive: true });
for (const source of samples) await writeFile(path.join(fixture.projectRoot, source), '// sample\n');
await writeFile(path.join(fixture.projectRoot, duplicate), '// 1\n// 2\n// 3\n// 4\n');
git(fixture, '-c', 'core.autocrlf=false', 'add', duplicate, sampleDirectory);
git(fixture, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false',
  'commit', '-m', 'reader navigation edge cases');
const commit = git(fixture, 'rev-parse', 'HEAD').trim();
for (const source of samples) {
  await writeFile(explanationFile(fixture, source), `<!-- aftertaste:document commit=${commit} -->\n\n` +
    '<!-- aftertaste:block id=sampl001 lines=1-1 -->\n## 样例\n<!-- aftertaste:end -->\n');
}
await writeFile(explanationFile(fixture, duplicate), `<!-- aftertaste:document commit=${commit} -->

<!-- aftertaste:block id=headone1 lines=1-1 -->
## 共同 **标题** 与 \`片段\`

这是第一块。
<!-- aftertaste:end -->

<!-- aftertaste:block id=headtwo2 lines=2-2 -->
共同 **标题** 与 \`片段\`
--------------------

这是第二块。
<!-- aftertaste:end -->

<!-- aftertaste:block id=codeonly lines=3-4 -->
~~~sh
# 这是代码中的注释
~~~
<!-- aftertaste:end -->

<!-- aftertaste:block id=empty000 -->

<!-- aftertaste:end -->

<!-- aftertaste:block id=intro000 -->
~~~sh
# 不能当作标题
~~~

用来导航的短摘。第二句应当省略。
<!-- aftertaste:end -->
`);

const browser = engine === 'firefox' ? await firefox.launch({ headless: true }) :
  await chromium.launch({ channel: engine === 'edge' ? 'msedge' : 'chrome', headless: true });
const report = { run, engine, browser: browser.version(), node: process.version, checks: [], errors: [] };
let reader, page;

async function tabTo(target, key = 'Tab') {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  assert.fail('Keyboard traversal did not reach the requested navigation control');
}

try {
  reader = await startReader(fixture.projectRoot, 0);
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => report.errors.push(error.message));
  const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
  const nav = page.locator('#reader-navigation');
  const file = source => nav.locator(`button[title="${source}"]`);
  const heading = name => page.getByRole('heading', { name, level: 1, exact: true });
  const toc = name => nav.getByRole('navigation', { name, exact: true });
  const tree = toc('文件讲解');
  const contents = toc('本篇目录');
  const active = contents.locator('[aria-current="location"]');
  const reading = page.locator('#reading');
  const divider = nav.getByRole('separator');
  const edge = page.getByTestId('reader-navigation-edge');
  const topMenu = page.locator('header.app-header');
  const navigationToggle = topMenu.locator('button[aria-controls="reader-navigation"]');
  async function openFile(source) {
    await file(source).click();
    await heading(source).waitFor();
  }
  async function jump(locator, id) {
    await locator.click();
    await page.locator(`#${id}:focus`).waitFor();
  }
  async function readingPosition() {
    return reading.evaluate(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height, scrollTop: element.scrollTop };
    });
  }
  async function dragDivider(toY) {
    const bounds = await divider.boundingBox();
    assert.ok(bounds, 'The divider must be visible before dragging');
    const x = bounds.x + bounds.width / 2;
    await page.mouse.move(x, bounds.y + bounds.height / 2);
    await page.mouse.down();
    try { await page.mouse.move(x, toY, { steps: 10 }); }
    finally { await page.mouse.up(); }
  }
  async function division() {
    const value = await divider.getAttribute('aria-valuenow');
    assert.ok(value !== null && Number.isFinite(Number(value)), 'The divider must expose its current value');
    return Number(value);
  }

  await page.goto(reader.url);
  const topActions = ['文件讲解', '文件依赖图', '闭环阅读', '书签', '标注', '笔记'];
  assert.deepEqual(await topMenu.locator('[data-page]:visible').allTextContents().then(labels => labels.map(label => label.trim())), topActions);
  assert.equal(await button('文件讲解', topMenu).getAttribute('aria-current'), 'page');
  assert.equal((await topMenu.boundingBox()).height, 48);
  assert.equal(await topMenu.getByText('回味', { exact: true }).isVisible(), false);
  assert.equal(await navigationToggle.count(), 1);
  const toggleBounds = await navigationToggle.boundingBox();
  const forwardBounds = await topMenu.locator('[data-history="forward"]').boundingBox();
  assert.ok(toggleBounds && forwardBounds && toggleBounds.x >= forwardBounds.x + forwardBounds.width &&
    toggleBounds.width <= 40 && toggleBounds.height <= 40);
  assert.equal(await navigationToggle.innerText(), '');
  for (const [label, panel] of [['文件依赖图', '#canvas-reading'], ['闭环阅读', '#loop-navigation'], ['笔记', '#notes']]) {
    await button(label, topMenu).click();
    await page.locator(panel).waitFor();
    await button('文件讲解', topMenu).click();
    await nav.waitFor();
  }
  report.checks.push('48px desktop heading, one compact sidebar icon without branding, top navigation order and view switching');
  await openFile('src/service.mjs');
  await contents.getByRole('button').nth(2).waitFor();
  assert.deepEqual(await contents.getByRole('button').allTextContents().then(values => values.map(value => value.trim())), [
    '服务把规则与辅助动作接到一起',
    '先校验数量，再建立待加入集合的对象',
    '更新集合、调用辅助函数、返回同一对象',
  ]);
  await jump(contents.getByRole('button').nth(1), 'm3vuiqzi');
  await jump(contents.getByRole('button').nth(2), 'cj9208pf');
  assert.match(await active.innerText(), /更新集合/u);
  await page.locator('#m3vuiqzi').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await active.filter({ hasText: '先校验数量' }).waitFor();
  assert.equal(await page.locator(':focus').getAttribute('id'), 'cj9208pf');
  await button('support', nav).click();
  await file('support/audit.mjs').waitFor();

  await divider.waitFor();
  assert.equal(await divider.getAttribute('aria-orientation'), 'horizontal');
  const initialDivider = await divider.boundingBox();
  const initialTree = await tree.boundingBox();
  const initialOutline = await contents.boundingBox();
  const handleY = initialDivider.y + initialDivider.height / 2;
  assert.ok(initialTree.y + initialTree.height <= handleY && handleY <= initialOutline.y);
  const originalDivision = await division();
  await dragDivider(handleY + 86);
  const pointerDivision = await division();
  assert.ok(pointerDivision > originalDivision);
  assert.ok((await tree.boundingBox()).height > initialTree.height);
  assert.ok((await contents.boundingBox()).height < initialOutline.height);
  await divider.press('ArrowUp');
  assert.ok(await division() < pointerDivision);
  await divider.press('ArrowDown');
  assert.equal(await division(), pointerDivision);
  const savedDivider = await divider.boundingBox();
  await dragDivider(899);
  assert.equal(await division(), Number(await divider.getAttribute('aria-valuemax')));
  assert.ok((await tree.boundingBox()).height >= 44 && (await contents.boundingBox()).height >= 44);
  await dragDivider(savedDivider.y + savedDivider.height / 2);
  const savedDivision = await division();
  report.checks.push('desktop divider separates two usable panes, supports pointer and keyboard resize, clamps at short pane limits');

  await button('收起阅读导航', topMenu).press('Enter');
  await nav.waitFor({ state: 'hidden' });
  await navigationToggle.locator(':scope:focus').waitFor();
  assert.equal(await navigationToggle.getAttribute('aria-expanded'), 'false');
  const collapsedReading = await readingPosition();
  await edge.hover();
  await nav.waitFor();
  assert.deepEqual(await readingPosition(), collapsedReading);
  assert.equal(await navigationToggle.evaluate(element => element === document.activeElement), true);
  await button('support', nav).hover();
  await assert.rejects(nav.waitFor({ state: 'hidden', timeout: 550 }), { name: 'TimeoutError' });
  await page.mouse.move(collapsedReading.x + collapsedReading.width * 0.75, collapsedReading.y + collapsedReading.height / 2);
  await nav.waitFor({ state: 'hidden' });
  assert.deepEqual(await readingPosition(), collapsedReading);
  await edge.hover();
  await button('固定阅读导航', topMenu).click();
  await button('收起阅读导航', topMenu).waitFor();
  assert.ok((await readingPosition()).width < collapsedReading.width);
  assert.equal(await division(), savedDivision);
  await button('收起阅读导航', topMenu).press('Enter');
  await nav.waitFor({ state: 'hidden' });
  await button('展开阅读导航', topMenu).press('Enter');
  await nav.locator(':scope:focus').waitFor();
  assert.equal(await navigationToggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await division(), savedDivision);
  await file('support/audit.mjs').waitFor();
  assert.equal(await file('src/service.mjs').getAttribute('aria-current'), 'page');
  await active.filter({ hasText: '先校验数量' }).waitFor();
  const samplesFolder = button('zz-samples', nav);
  await samplesFolder.click();
  const treeScroll = tree.locator('.navigation-scroll');
  assert.ok(await treeScroll.evaluate(element => element.scrollHeight > element.clientHeight));
  await file(samples.at(-1)).scrollIntoViewIfNeeded();
  assert.ok(await treeScroll.evaluate(element => element.scrollTop > 0));
  assert.ok(await contents.getByRole('heading').evaluate(element => element.getBoundingClientRect().bottom < innerHeight));
  await samplesFolder.click();
  report.checks.push('service order and jumps, manual scroll without moving focus, collapse retains position and two open folders');
  report.checks.push('left-edge hover opens without moving content or focus, remains open inside, closes outside and can be pinned');
  report.checks.push('nested file list scrolls independently of the visible block outline');

  await openFile('support/audit.mjs');
  await jump(contents.getByRole('button', { name: /^辅助文件拼接日志路径/u }), 'audit123');
  await jump(contents.getByRole('button', { name: /^从已有名字构建路径/u }), 'overview');
  await page.getByRole('combobox', { name: '界面语言' }).selectOption('en');
  await toc('On this page').getByRole('button', { name: /^从已有名字构建路径/u }).waitFor();
  for (const width of [851, 900]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal((await topMenu.boundingBox()).height, 48);
    assert.ok(await topMenu.getByRole('combobox', { name: 'Interface language' }).isVisible());
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('zh-CN');
  report.checks.push('English toolbar remains one 48px row at 851px and 900px');

  assert.equal(await file('src/service.mjs').innerText(), 'service.mjs');
  assert.equal(await file(duplicate).innerText(), 'service.mjs');
  await openFile(duplicate);
  const repeated = contents.getByRole('button', { name: '共同 标题 与 片段', exact: true });
  await jump(repeated.nth(0), 'headone1');
  await jump(repeated.nth(1), 'headtwo2');
  await jump(button('源码行 3–4', contents), 'codeonly');
  await jump(button('块 4', contents), 'empty000');
  await jump(contents.getByRole('button', { name: /^用来导航的短摘[。]?$/u }), 'intro000');
  const valid = await readFile(explanationFile(fixture, duplicate), 'utf8');
  await writeFile(explanationFile(fixture, duplicate), valid.replace('lines=3-4', 'lines=4-4'));
  await button('刷新资料').click();
  await page.locator('.fallback-markdown').waitFor();
  assert.equal(await contents.isVisible() && await contents.getByRole('button').count() > 0, false);
  assert.equal(await divider.isVisible(), false);
  await writeFile(explanationFile(fixture, duplicate), valid);
  report.checks.push('audit excerpts and language, same named files and headings, code/empty fallback, Markdown degradation');

  const auditRequest = '**/api/document?path=*audit.mjs.md';
  const release = Promise.withResolvers();
  const delay = async route => {
    const response = await route.fetch();
    await release.promise;
    await route.fulfill({ response }).catch(() => {});
  };
  await page.route(auditRequest, delay);
  try {
    const intercepted = page.waitForRequest(auditRequest);
    await file('support/audit.mjs').click();
    await intercepted;
    assert.equal(await contents.isVisible() && await contents.getByRole('button').count() > 0, false);
    await openFile('src/service.mjs');
  } finally {
    release.resolve();
    await page.unrouteAll({ behavior: 'wait' });
  }
  await button('更新集合、调用辅助函数、返回同一对象', contents).waitFor();
  assert.equal(await heading('support/audit.mjs').isVisible(), false);

  await openFile('src/rules.mjs');
  const rules = page.locator('#x4y6az2y');
  const ordinary = rules.locator('.explanation-text');
  const bookmarkToggle = rules.locator('button.block-bookmarks-toggle');
  assert.ok(await ordinary.evaluate(element => {
    const toggle = element.closest('.document-block').querySelector('button.block-bookmarks-toggle');
    return !!(element.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING);
  }));
  assert.equal(await bookmarkToggle.getAttribute('aria-expanded'), 'false');
  await button('书签', topMenu).click();
  await page.locator('#bookmarks button.bookmark-entry').filter({ hasText: '这个边界例子讲得巧' }).locator('..').locator('.record-visit').press('Enter');
  const bookmark = page.locator('#bookmark-892cf00e-fab8-4d6d-a307-74e0c4bbb89c:focus');
  await bookmark.getByText(/这个边界例子讲得巧/u).waitFor();
  await button('标注', topMenu).click();
  await page.getByRole('combobox', { name: '筛选标注' }).selectOption('not-understood');
  await page.locator('#marks button.bookmark-entry').filter({ hasText: '为什么要先校验数量' }).locator('..').locator('.record-visit').press('Enter');
  await page.locator('#mark-x4y6az2y:focus').getByText(/为什么要先校验数量/u).waitFor();
  report.checks.push('delayed document cannot replace current content, prose before folded records, exact bookmark and annotation focus');

  await page.setViewportSize({ width: 1440, height: 320 });
  await page.waitForFunction(() => Number(document.querySelector('.sidebar-divider')?.getAttribute('aria-valuemin')) > 20);
  async function checkFirstRow(section) {
    const scroller = section.locator('.navigation-scroll');
    await scroller.evaluate(element => { element.scrollTop = 0; });
    const frame = await scroller.boundingBox();
    const row = await section.getByRole('button').first().boundingBox();
    assert.ok(row && frame && row.y >= frame.y &&
      row.y + row.height <= Math.min(frame.y + frame.height, page.viewportSize().height) + 1);
  }
  await divider.press('End');
  assert.equal(await division(), Number(await divider.getAttribute('aria-valuemax')));
  await checkFirstRow(contents);
  await dragDivider(0);
  assert.equal(await division(), Number(await divider.getAttribute('aria-valuemin')));
  await divider.press('Home');
  await checkFirstRow(tree);
  report.checks.push('1440×320 divider limits leave a complete row available in the smaller pane');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await nav.waitFor({ state: 'hidden' });
  await button('展开阅读导航').press('Enter');
  await nav.waitFor();
  await tabTo(file('src/service.mjs'));
  await page.keyboard.press('Enter');
  await heading('src/service.mjs').waitFor();
  await page.locator('#reading:focus').waitFor();
  await nav.waitFor({ state: 'hidden' });
  await button('展开阅读导航').press('Enter');
  const sectionLink = button('先校验数量，再建立待加入集合的对象', contents);
  await tabTo(sectionLink);
  await page.keyboard.press('Enter');
  await page.locator('#m3vuiqzi:focus').waitFor();
  await nav.waitFor({ state: 'hidden' });
  const narrowPosition = await reading.evaluate(element => element.scrollTop);
  await button('展开阅读导航').press('Enter');
  await nav.waitFor();
  await page.keyboard.press('Escape');
  await nav.waitFor({ state: 'hidden' });
  await button('展开阅读导航').locator(':scope:focus').waitFor();
  assert.equal(await reading.evaluate(element => element.scrollTop), narrowPosition);
  await page.keyboard.press('Enter');
  await nav.waitFor();
  await tabTo(page.locator('.skip-link'), 'Shift+Tab');
  await page.keyboard.press('Enter');
  await nav.waitFor({ state: 'hidden' });
  await reading.locator(':scope:focus').waitFor();
  assert.equal(await reading.evaluate(element => element.scrollTop), narrowPosition);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(await Promise.all(recordFiles.map(name => readFile(path.join(fixture.data, name), 'utf8'))), before);
  assert.deepEqual(report.errors, []);
  report.checks.push('390px keyboard file selection, jump, Escape and skip link return focus, record files unchanged');
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  if (page) await page.screenshot({ path: path.join(run, 'failed.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await reader?.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
