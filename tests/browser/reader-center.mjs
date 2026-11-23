import assert from 'node:assert/strict';
import { copyFile, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, firefox } from 'playwright';

const engine = process.env.AFTERTASTE_BROWSER ?? 'edge';
assert.ok(['edge', 'chrome', 'firefox'].includes(engine));
if (process.env.AFTERTASTE_D023_BUILD) {
  assert.ok(path.isAbsolute(process.env.AFTERTASTE_D023_BUILD), 'AFTERTASTE_D023_BUILD requires an absolute path');
  process.env.AFTERTASTE_BUILD = process.env.AFTERTASTE_D023_BUILD;
}
const { build } = await import('../fixtures/dependency-canvas.mjs');
const { createLoopReaderProject, explanationFile, git } = await import('../fixtures/loop-reader.mjs');
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')).href);
const output = path.join(fileURLToPath(new URL('../../.local/', import.meta.url)), process.env.AFTERTASTE_TEST_TASK ?? 'D023');
await mkdir(output, { recursive: true });
const run = await mkdtemp(path.join(output, engine + '-'));
const projectRoot = path.join(run, 'project');
const input = process.env.AFTERTASTE_READER_INPUT;
let fixture;
if (input) {
  await cp(path.resolve(input), projectRoot, { recursive: true, force: false, errorOnExist: true });
  const commit = git({ projectRoot }, 'rev-parse', 'HEAD').trim();
  fixture = { projectRoot, data: path.join(projectRoot, 'docs/aftertaste'), commit };
} else {
  fixture = await createLoopReaderProject(projectRoot);
}
const recordFiles = ['bookmarks.json', 'understanding-marks.json', 'notes.json'];
for (const name of recordFiles) {
  await copyFile(new URL('../fixtures/page-preview/' + name, import.meta.url), path.join(fixture.data, name));
}
const readRecords = () => Promise.all(recordFiles.map(name => readFile(path.join(fixture.data, name), 'utf8')));
const originalRecords = await readRecords();

const serviceFile = 'src/service.mjs';
const auditFile = 'support/audit.mjs';
const longFile = 'src/viewport/snapshot-limits-for-a-long-source-path-and-reading-area.mjs';
const horizontalTail = 'REACHABLE_HORIZONTAL_END';
const verticalTail = 'REACHABLE_LAST_LINE';
const quotedText = '样例说 "引号"\n换行继续';
const source = [
  '  // ' + 'long token '.repeat(120) + horizontalTail, '', '\t// indentation',
  ...Array.from({ length: 57 }, (_, index) => '// ' + (index + 4)), '// ' + verticalTail,
];
await mkdir(path.dirname(path.join(fixture.projectRoot, longFile)), { recursive: true });
await writeFile(path.join(fixture.projectRoot, longFile), source.join('\n') + '\n');
git(fixture, '-c', 'core.autocrlf=false', 'add', '--', longFile);
git(fixture, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false',
  'commit', '-m', 'Add long source for reader center checks');
const head = git(fixture, 'rev-parse', 'HEAD').trim();
assert.notEqual(head, fixture.commit);
const auditDocument = explanationFile(fixture, auditFile);
await writeFile(auditDocument, (await readFile(auditDocument, 'utf8')).replace(fixture.commit, head));
const longDocument = explanationFile(fixture, longFile);
await mkdir(path.dirname(longDocument), { recursive: true });
const longMarkdown = [
  '<!-- aftertaste:document commit=' + head + ' -->', '', '<!-- aftertaste:block id=long0000 lines=1-61 -->',
  '## 窗口边界', '', '~~~text', quotedText, '~~~', '<!-- aftertaste:end -->', '',
].join('\n');
await writeFile(longDocument, longMarkdown);

const report = {
  run, build, engine, node: process.version, os: release(), project: fixture.projectRoot, input, head,
  serviceDocumentCommit: fixture.commit, checks: [], screenshots: {}, pasted: [], errors: [],
};
let browser, reader, page;

function parseLocation(text) {
  const code = /^Aftertaste 文档块定位\r?\n(?:\r?\n)?```json\r?\n([\s\S]+)\r?\n```\s*$/u.exec(text);
  assert.ok(code, 'Expected the U73 heading and JSON fence');
  return JSON.parse(code[1]);
}

function expectedLocation(file, block, commit, selection) {
  return {
    format: 'aftertaste-block/v1',
    document: 'docs/aftertaste/current/' + file + '.md',
    block_id: block,
    source_commit: commit,
    ...(selection === undefined ? {} : { selection }),
  };
}

async function paste() {
  const sink = await page.evaluateHandle(() => {
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.inset = '0 auto auto 0';
    document.body.append(textarea);
    textarea.focus({ preventScroll: true });
    return textarea;
  });
  try {
    await page.keyboard.press('Control+V');
    return await sink.evaluate(element => element.value);
  } finally {
    await sink.evaluate(element => element.remove());
    await sink.dispose();
  }
}

async function checkPaste(expected) {
  const text = await paste();
  const actual = parseLocation(text);
  assert.deepEqual(actual, expected);
  report.pasted.push(actual);
  return text;
}

async function pointerSelect(locator, text, backwards = false) {
  await locator.scrollIntoViewIfNeeded();
  const points = await locator.evaluate((element, text) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const start = node.textContent.indexOf(text);
      if (start < 0) continue;
      return [start, start + text.length].map(offset => {
        const range = new Range();
        range.setStart(node, offset);
        const rect = range.getBoundingClientRect();
        return { x: rect.left, y: (rect.top + rect.bottom) / 2 };
      });
    }
    throw new Error('Selected text was not found in a single text node: ' + text);
  }, text);
  const [start, end] = backwards ? points.reverse() : points;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  try { await page.mouse.move(end.x, end.y, { steps: 14 }); }
  finally { await page.mouse.up(); }
  assert.equal(await page.evaluate(() => getSelection().toString()), text);
  return end;
}

async function selectRange(start, end, text) {
  const right = await end.elementHandle();
  try {
    return await start.evaluate((left, { right, text }) => {
      const selection = getSelection();
      if (text !== undefined) {
        const node = left.firstChild;
        const offset = node.textContent.indexOf(text);
        if (offset < 0) throw new Error('Missing text in ' + left.outerHTML);
        selection.setBaseAndExtent(node, offset, node, offset + text.length);
      } else {
        selection.setBaseAndExtent(left, 0, right, right.childNodes.length);
      }
      return selection.toString();
    }, { right, text });
  } finally { await right.dispose(); }
}

try {
  reader = await startReader(fixture.projectRoot, 0);
  report.url = reader.url;
  browser = engine === 'firefox' ? await firefox.launch({ headless: true }) :
    await chromium.launch({ channel: engine === 'edge' ? 'msedge' : 'chrome', headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  if (engine !== 'firefox') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(reader.url);

  const reading = page.locator('#reading');
  const nav = page.locator('#reader-navigation');
  const navigationToggle = page.locator('button[aria-controls="reader-navigation"]');
  const edge = page.getByTestId('reader-navigation-edge');
  const projectName = nav.locator('.project-info-toggle');
  const panel = nav.locator('.project-info:popover-open');
  const documentPath = reading.locator('.document-header > h1 + p.document-path');
  const block = id => reading.locator('#' + id);
  const first = block('zhidif44'), second = block('m3vuiqzi'), third = block('cj9208pf'), pure = block('overview');
  const sourcePane = item => item.locator('.source-pane');
  const prose = item => item.locator('.explanation-text');
  const directCopy = item => item.locator('.block-copy-button');
  const floatingCopy = page.locator('.selection-copy-action');
  const selectedPhrase = '服务随后忽略这个返回值';
  const paragraph = prose(first).getByText(selectedPhrase, { exact: false });
  const status = (trigger, label) => trigger.locator('xpath=..').locator('.location-copy-status')
    .filter({ hasText: new RegExp('^' + label + '$', 'u') });
  const scroll = () => reading.evaluate(element => element.scrollTop);
  const box = locator => locator.boundingBox();
  const jump = top => reading.evaluate((element, value) => { element.scrollTop = value; }, top);
  const lines = item => sourcePane(item).locator('.line-number').allTextContents();
  const dismissSelection = () => page.evaluate(() => getSelection().removeAllRanges());

  async function openFile(file) {
    await nav.locator('button[title="' + file + '"]').click();
    await reading.getByRole('heading', { name: file, level: 1, exact: true }).waitFor();
    await documentPath.waitFor();
    assert.equal((await documentPath.textContent()).trim(), 'docs/aftertaste/current/' + file + '.md');
  }

  async function screenshot(name) {
    report.screenshots[name] = { viewport: page.viewportSize(), scrollTop: await scroll() };
    await page.screenshot({ path: path.join(run, name + '.png') });
  }

  async function absoluteTop(locator) {
    return (await box(locator)).y - (await box(reading)).y + await scroll();
  }

  async function clickAndPaste(trigger, expected, label = '已复制') {
    await trigger.click();
    await status(trigger, label).waitFor();
    return checkPaste(expected);
  }

  async function checkPanel(commit) {
    await panel.getByText(fixture.projectRoot, { exact: true }).waitFor();
    await panel.getByText(commit, { exact: true }).waitFor();
    await panel.locator('.check-status').waitFor();
    assert.equal(await panel.getByText(/docs\/aftertaste\/current\//u).count(), 0);
  }

  await openFile(serviceFile);
  const heading = reading.getByRole('heading', { name: serviceFile, level: 1, exact: true });
  assert.equal(await documentPath.evaluate(element => getComputedStyle(element).fontSize), '11px');
  const pathBox = await box(documentPath);
  const headingBox = await box(heading);
  assert.ok(pathBox.y >= headingBox.y + headingBox.height);
  const firstHeading = prose(first).getByRole('heading', { name: '服务把规则与辅助动作接到一起', exact: true });
  assert.equal(await prose(first).locator(':scope > :first-child').evaluate(el => el.textContent), '服务把规则与辅助动作接到一起');
  assert.ok((await box(firstHeading)).y > (await box(heading)).y);
  assert.ok((await box(sourcePane(first))).x < (await box(prose(first))).x);
  assert.deepEqual(await lines(first), ['1', '2', '3']);
  assert.deepEqual(await first.locator('.source-line').evaluateAll(rows => rows.map(row => row.lastElementChild.textContent)), [
    "import { parseQuantity } from './rules.mjs';",
    "import { record } from '../support/audit.mjs';", '',
  ]);
  assert.ok((await box(sourcePane(first))).height < (await box(first)).height);
  await screenshot('candidate-service-start');

  await jump(240);
  const readingTop = (await box(reading)).y;
  const stickyTop = (await box(sourcePane(first))).y;
  assert.ok(Math.abs(stickyTop - readingTop - 16) <= 1, JSON.stringify({ stickyTop, readingTop }));
  await screenshot('candidate-service-middle');
  await jump(285);
  const laterStickyTop = (await box(sourcePane(first))).y;
  assert.ok(Math.abs(laterStickyTop - stickyTop) <= 1);
  const nextTop = await absoluteTop(second);
  await jump(nextTop - Math.round((await box(sourcePane(first))).height / 2));
  const leaving = await box(sourcePane(first));
  const arriving = await box(sourcePane(second));
  assert.ok(leaving.y < stickyTop && leaving.y + leaving.height <= arriving.y + 1);
  await screenshot('candidate-service-handoff');
  await jump(nextTop + 20);
  assert.ok((await box(sourcePane(first))).y + (await box(sourcePane(first))).height <= readingTop + 1);
  report.sticky = { readingTop, stickyTop, laterStickyTop, firstAtHandoff: leaving, secondAtHandoff: arriving };
  await jump(690);
  await screenshot('candidate-service-next');
  await third.scrollIntoViewIfNeeded();
  assert.deepEqual(await lines(third), ['7', '8', '9', '10']);
  assert.match(await prose(third).innerText(), /更新集合、调用辅助函数、返回同一对象/u);
  report.checks.push('service heading, original first Markdown heading, two imports and a blank line, sticky source and block handoff, lines 7–10');

  await jump(240);
  await navigationToggle.click();
  await nav.waitFor({ state: 'hidden' });
  const collapsedScroll = await scroll();
  await edge.hover();
  await nav.waitFor();
  await projectName.click();
  await checkPanel(fixture.commit);
  const projectPath = panel.getByText(fixture.projectRoot, { exact: true });
  await pointerSelect(projectPath, fixture.projectRoot);
  await page.waitForFunction(() => document.querySelector('.project-info:popover-open')?.matches(':hover'));
  await screenshot('candidate-project-popover');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  await projectName.locator(':scope:focus').waitFor();
  await nav.waitFor();
  assert.equal(await scroll(), collapsedScroll);
  await projectName.press('Enter');
  await panel.waitFor();
  await reading.click({ position: { x: 710, y: 260 } });
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await scroll(), collapsedScroll);
  await edge.hover();
  await nav.waitFor();
  await navigationToggle.click();
  await nav.getByRole('button', { name: 'support', exact: true }).click();
  await openFile(auditFile);
  await projectName.press('Enter');
  await checkPanel(head);
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await prose(pure).getByText('从已有名字构建路径。', { exact: true }).count(), 1);
  assert.equal(await sourcePane(pure).count(), 0);
  const pureBox = await box(prose(pure));
  const pureBlock = await box(pure);
  assert.ok(Math.abs(pureBox.x + pureBox.width / 2 - pureBlock.x - pureBlock.width / 2) <= 1);
  await screenshot('candidate-audit');
  await clickAndPaste(directCopy(pure), expectedLocation(auditFile, 'overview', head));
  report.checks.push('peek keeps reading position, drag selects the full project path, Escape restores focus, keyboard/outside close, popover commit follows the document, the 11px document path follows the file heading without duplication, untitled explanation has no source pane');

  await openFile(serviceFile);
  const expected = expectedLocation(serviceFile, 'zhidif44', fixture.commit, selectedPhrase);
  await paragraph.scrollIntoViewIfNeeded();
  const nextBlock = first.locator('+ .document-block');
  const positions = async () => [(await box(paragraph)).y, (await box(nextBlock)).y];
  const beforeSelection = await positions();
  await paragraph.click();
  assert.equal(await first.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  await pointerSelect(paragraph, selectedPhrase);
  await floatingCopy.waitFor();
  assert.deepEqual(await positions(), beforeSelection);
  assert.equal(await first.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  const addNote = first.getByRole('button', { name: '加入笔记', exact: true });
  const strip = first.locator('.selection-copy-panel');
  report.selectionBounds = await box(strip);
  assert.equal(report.selectionBounds.height, 32);
  for (const action of [floatingCopy, addNote]) {
    const { width, height } = await box(action);
    assert.deepEqual([width, height], [28, 28]);
    await action.hover();
    await action.locator('.selection-label').waitFor();
    assert.deepEqual(await positions(), beforeSelection);
  }
  await screenshot('candidate-service-selection');
  await page.keyboard.press('Tab');
  await floatingCopy.locator(':scope:focus .selection-label').waitFor();
  await page.keyboard.press('Tab');
  await addNote.locator(':scope:focus .selection-label').waitFor();
  if (engine === 'edge') {
    await page.emulateMedia({ forcedColors: 'active' });
    await addNote.locator(':scope:focus .selection-label').waitFor();
    await screenshot('selection-forced-colors');
    const colors = await strip.evaluate(el => [
      getComputedStyle(el).backgroundColor, getComputedStyle(el.querySelector('svg')).color,
      getComputedStyle(el).backdropFilter,
    ]);
    assert.notEqual(colors[0], colors[1]);
    assert.equal(colors[2], 'none');
    await page.emulateMedia({ forcedColors: 'none' });
  }
  assert.equal(await page.evaluate(() => getSelection().toString()), selectedPhrase);
  await page.keyboard.press('Escape');
  await addNote.waitFor({ state: 'hidden' });
  assert.deepEqual(await positions(), beforeSelection);
  report.selectionPositions = { beforeSelection, afterDismiss: await positions() };
  await dismissSelection();
  await pointerSelect(paragraph, selectedPhrase);
  await clickAndPaste(floatingCopy, expected);
  await clickAndPaste(directCopy(second), expectedLocation(serviceFile, 'm3vuiqzi', fixture.commit));
  await pointerSelect(paragraph, selectedPhrase, true);
  await floatingCopy.waitFor();
  const focus = () => page.evaluate(() => document.activeElement?.outerHTML.split('>')[0] + '>');
  report.keyboard = { beforeTab: await focus() };
  await page.keyboard.press('Tab');
  report.keyboard.afterTab = await focus();
  await floatingCopy.locator(':scope:focus').waitFor();
  await page.keyboard.press('Enter');
  await status(floatingCopy, '已复制').waitFor();
  const originalLocation = await checkPaste(expected);
  await pointerSelect(paragraph, selectedPhrase);
  await page.keyboard.press('Control+C');
  assert.equal(await paste(), selectedPhrase);
  await pointerSelect(paragraph, selectedPhrase);
  assert.ok((await selectRange(paragraph, prose(second).locator('p').first())).length > 0);
  await floatingCopy.waitFor({ state: 'hidden' });
  await dismissSelection();
  await pointerSelect(paragraph, selectedPhrase);
  const firstSourceRow = first.locator('.source-line').first();
  assert.ok((await selectRange(firstSourceRow, paragraph)).length > 0);
  await floatingCopy.waitFor({ state: 'hidden' });
  assert.ok((await selectRange(firstSourceRow, firstSourceRow)).length > 0);
  await floatingCopy.waitFor({ state: 'hidden' });
  await pointerSelect(paragraph, selectedPhrase);
  await dismissSelection();
  await floatingCopy.waitFor({ state: 'hidden' });
  report.checks.push('native paste resolves U73 selection and direct targets, HEAD drift, reverse pointer selection with keyboard activation, native Ctrl+C stays plain, invalid or cleared selections remove the action');

  await page.locator('.language-control select').selectOption('en');
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new DOMException('Clipboard permission denied', 'NotAllowedError'); };
  });
  report.denial = 'injected Clipboard.writeText NotAllowedError, native manual copy and paste';
  await pointerSelect(paragraph, selectedPhrase);
  await floatingCopy.waitFor();
  assert.match((await floatingCopy.getAttribute('aria-label')) ?? await floatingCopy.innerText(), /Copy block location/u);
  await floatingCopy.click();
  const manual = page.locator('.location-copy-text');
  await manual.waitFor();
  await page.getByText('Automatic copy failed. Select the text below and copy it manually.', { exact: true }).waitFor();
  assert.equal(await manual.inputValue(), originalLocation);
  await screenshot('candidate-copy-denied');
  await manual.press('Control+A');
  await manual.press('Control+C');
  await manual.press('Escape');
  await checkPaste(expected);

  const wholeBlock = expectedLocation(serviceFile, 'zhidif44', fixture.commit);
  const directManual = directCopy(first).locator('xpath=..').locator('.location-copy-text');
  await directCopy(first).click();
  await directManual.locator(':scope:focus').waitFor();
  assert.deepEqual(parseLocation(await directManual.inputValue()), wholeBlock);
  const desktopManualBounds = await box(directManual);
  await page.setViewportSize({ width: 390, height: 844 });
  const directField = await directManual.elementHandle();
  try {
    await page.waitForFunction(field => {
      const { x, y, width, height } = field.getBoundingClientRect();
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      return centerX > 0 && centerX < innerWidth && centerY > 0 && centerY < innerHeight;
    }, directField);
  } finally { await directField.dispose(); }
  report.directFallbackResize = { desktop: desktopManualBounds, narrow: await box(directManual) };
  assert.ok(await directManual.evaluate(field => field === document.activeElement));
  assert.deepEqual(parseLocation(await directManual.inputValue()), wholeBlock);
  await screenshot('candidate-direct-copy-denied-narrow');
  await directManual.press('Control+A');
  await directManual.press('Control+C');
  await directManual.press('Escape');
  await checkPaste(wholeBlock);
  await page.setViewportSize({ width: 1440, height: 900 });
  await nav.waitFor();
  await page.evaluate(() => { delete navigator.clipboard.writeText; });
  await page.locator('.language-control select').selectOption('zh-CN');
  await openFile(serviceFile);
  // Use a width where this passage wraps with the current reader columns.
  await page.setViewportSize({ width: 1360, height: 900 });
  const noteSelection = '文本，服务随后忽略这';
  const noteRelease = await pointerSelect(paragraph, noteSelection);
  await floatingCopy.waitFor();
  assert.ok(await page.evaluate(() => getSelection().getRangeAt(0).getClientRects().length > 1));
  const note = first.getByRole('button', { name: '加入笔记', exact: true });
  const noteCenter = await note.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    return { x: centerX, y: centerY, hit: element.contains(document.elementFromPoint(centerX, centerY)) };
  });
  report.noteTarget = { selection: noteSelection, release: noteRelease, center: noteCenter };
  assert.ok(noteCenter.hit, 'The visible center of Add to note must receive the mouse click');
  await page.mouse.click(noteCenter.x, noteCenter.y);
  await page.locator('#quick-note .note-reference').getByText(noteSelection, { exact: true }).waitFor();
  await page.locator('#quick-note').getByRole('status').filter({hasText: '已保存'}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '文件讲解', exact: true }).click();
  report.checks.push('English control and rejection feedback, native selection and resized whole-block fallbacks round trip, actual mouse hit adds the entire wrapped passage to notes');

  report.responsive = [];
  for (const width of [1051, 1050, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await first.waitFor();
    const { sourceBox, proseBox } = await first.evaluate(block => ({
      sourceBox: block.querySelector('.source-pane').getBoundingClientRect().toJSON(),
      proseBox: block.querySelector('.explanation-text').getBoundingClientRect().toJSON(),
    }));
    report.responsive.push({ width, sourceBox, proseBox });
    if (width > 1050) assert.ok(sourceBox.x + sourceBox.width <= proseBox.x + 1);
    else assert.ok(sourceBox.y + sourceBox.height <= proseBox.y + 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width < 400) await screenshot('candidate-narrow');
  }
  const edgePhrase = await paragraph.evaluate(element => {
    const node = element.firstChild;
    const range = new Range();
    for (let end = 6; end <= node.textContent.length; end++) {
      range.setStart(node, end - 5);
      range.setEnd(node, end);
      const rect = range.getBoundingClientRect();
      if (range.getClientRects().length === 1 && rect.right >= innerWidth - 54) return node.textContent.slice(end - 5, end);
    }
    throw new Error('No text ends near the right viewport edge');
  });
  const end = await pointerSelect(paragraph, edgePhrase);
  await floatingCopy.waitFor();
  const action = await box(floatingCopy);
  assert.ok(action.x >= 0 && action.x + action.width <= end.x + 1 && action.y >= 0 && action.y + action.height <= 844);
  const addBounds = await box(addNote);
  assert.ok(addBounds.width === 28 && addBounds.height === 28 && addBounds.x + addBounds.width <= 390);
  await screenshot('candidate-narrow-edge');
  await navigationToggle.click();
  await openFile(auditFile);
  await floatingCopy.waitFor({ state: 'hidden' });
  report.checks.push('two-column and stacked breakpoint, narrow reading and edge-side action placement, file switch clears the old target');

  await page.setViewportSize({ width: 1440, height: 320 });
  await nav.waitFor();
  await nav.getByRole('button', { name: 'viewport', exact: true }).click();
  await openFile(longFile);
  const longBlock = block('long0000');
  const sourceScroll = longBlock.locator('.source-scroll');
  assert.equal(await longBlock.locator('.source-line').count(), 61);
  assert.deepEqual(await longBlock.locator('.source-line').evaluateAll(rows => rows.slice(0, 3).map(row => row.lastElementChild.textContent)), source.slice(0, 3));
  const number = sourceScroll.locator('.line-number').first();
  const initialX = (await box(number)).x;
  assert.ok(await sourceScroll.evaluate(element => element.scrollWidth > element.clientWidth));
  await sourceScroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  assert.ok(Math.abs((await box(number)).x - initialX) <= 1);
  const lastGlyph = await sourceScroll.locator('.source-line').first().evaluate(row => {
    const walker = document.createTreeWalker(row.lastElementChild, NodeFilter.SHOW_TEXT);
    let node, last;
    while ((node = walker.nextNode())) if (node.length) last = node;
    const range = new Range();
    range.setStart(last, last.length - 1);
    range.setEnd(last, last.length);
    return range.getBoundingClientRect().right;
  });
  const sourceBox = await box(sourceScroll);
  assert.ok(lastGlyph > sourceBox.x && lastGlyph <= sourceBox.x + sourceBox.width + 1);
  await screenshot('candidate-long-line');
  await sourceScroll.evaluate(element => { element.scrollLeft = 0; });
  const lastRow = longBlock.locator('.source-line').last();
  await jump(await absoluteTop(lastRow) - 80);
  const lastRowPosition = await box(lastRow);
  assert.match(await lastRow.innerText(), new RegExp(verticalTail, 'u'));
  assert.ok(lastRowPosition.y > (await box(reading)).y && lastRowPosition.y + lastRowPosition.height < 320);
  await screenshot('candidate-long-last-line');
  await page.setViewportSize({ width: 390, height: 844 });
  await navigationToggle.click();
  await nav.getByRole('button', { name: '窗口边界', exact: true }).click();
  await longBlock.locator(':scope[data-landing]:focus').waitFor();
  const intro = await box(prose(longBlock).getByRole('heading', { name: '窗口边界' }));
  report.narrowLanding = { heading: intro, reading: await box(reading) };
  assert.ok(intro.y >= report.narrowLanding.reading.y && intro.y + intro.height <= 844);
  await screenshot('candidate-narrow-jump');
  await page.setViewportSize({ width: 1440, height: 900 });
  const middleLine = longBlock.locator('.source-line').nth(30);
  report.longSourceRecords = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await middleLine.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await middleLine.hover({ position: { x: 50, y: 4 } });
    const top = await reading.evaluate(el => el.scrollTop);
    const pane = await box(reading);
    const entryPositions = [];
    for (const kind of ['bookmarks', 'mark']) {
      const entry = longBlock.locator(`[data-kind=${kind}]`);
      const bounds = await box(entry);
      assert.ok(bounds.y >= pane.y && bounds.y + bounds.height <= pane.y + pane.height, 'record entry beside source line 31');
      entryPositions.push(bounds.y);
      await entry.click();
      await longBlock.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await reading.evaluate(el => el.scrollTop), top);
    }
    report.longSourceRecords.push({ width, scroll: top, line31: (await box(middleLine)).y, entries: entryPositions });
    await screenshot('source-middle-' + width);
  }
  const example = prose(longBlock).locator('pre code');
  await example.scrollIntoViewIfNeeded();
  const nativeSelection = await selectRange(example, example, quotedText);
  assert.equal(nativeSelection.replace(/\r\n/gu, '\n'), quotedText);
  await clickAndPaste(floatingCopy, expectedLocation(longFile, 'long0000', head, nativeSelection));
  await writeFile(longDocument, longMarkdown.replace('lines=1-61', 'lines=2-61'));
  await page.getByRole('button', { name: '刷新资料', exact: true }).click();
  const fallback = reading.locator('.fallback-markdown');
  await fallback.waitFor();
  assert.match(await reading.locator('.document-header').innerText(), /Markdown/u);
  assert.equal(await directCopy(longBlock).count(), 0);
  await reading.locator('.repair-text').waitFor();
  assert.match(await reading.locator('.repair-text').inputValue(), /SOURCE_GAP/u);
  await page.setViewportSize({ width: 390, height: 844 });
  await jump(0);
  assert.equal((await documentPath.textContent()).trim(), 'docs/aftertaste/current/' + longFile + '.md');
  assert.ok(await documentPath.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = [...range.getClientRects()];
    return lines.length > 1 && lines.every(line => line.left >= 0 && line.right <= innerWidth + 1) &&
      element.scrollWidth <= element.clientWidth + 1;
  }), 'The full long document path must wrap within the narrow viewport');
  await screenshot('candidate-narrow-document-path');
  const [bookmarksAfter, marksAfter, notesAfter] = await readRecords();
  assert.deepEqual([bookmarksAfter, marksAfter], originalRecords.slice(0, 2));
  const storedNotes = JSON.parse(notesAfter).notes;
  assert.deepEqual(storedNotes.slice(0, -1), JSON.parse(originalRecords[2]).notes);
  assert.ok(storedNotes.at(-1).body.includes(noteSelection));
  assert.deepEqual(report.errors, []);
  report.checks.push('indentation and blank source row, stationary gutter and visible long-line end, last source row reachable in short window, quotes/newline survive native paste, fallback diagnosis visible, long document path wraps without horizontal clipping, existing records preserved');
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  if (page) await page.screenshot({ path: path.join(run, 'failed.png') }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await reader?.server.close();
  await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
