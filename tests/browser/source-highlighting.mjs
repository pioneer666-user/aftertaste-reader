import { registerEntry, openReader, readerFetch } from '../fixtures/reader-session.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { blockLink, createSyntaxProject, documentPath, examples } from '../fixtures/source-highlighting.mjs';
import { textContrast } from './theme-contrast.mjs';

if (process.argv[2] === '--prepare') {
  assert.ok(process.argv[3]);
  console.log(await createSyntaxProject(path.resolve(process.argv[3])));
  process.exit(0);
}

const origin = new URL(process.argv[2]).origin;
assert.equal(new URL(origin).hostname, '127.0.0.1');
const entry = readFileSync(0, 'utf8').trim();
assert.ok(new URL(entry).origin === origin, '启动入口应属于指定阅读实例');
await registerEntry(entry);
const output = path.resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const report = { edge: browser.version(), node: process.version, origin, files: {}, themes: {}, outside: [], writes: [], errors: [] };

async function usePage(run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    await context.route('**/*', route => {
      const { origin: requestOrigin, pathname } = new URL(route.request().url());
      if (requestOrigin !== origin) {
        report.outside.push(requestOrigin);
        return route.abort();
      }
      if (!['GET', 'HEAD'].includes(route.request().method())) {
        report.writes.push(pathname);
        return route.abort();
      }
      return route.fallback();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(9000);
    page.on('pageerror', error => report.errors.push(error.message));
    await run(page);
  } finally {
    await context.close();
  }
}

const sourceRows = page => page.locator('.document-block .source-line');
async function openFile(page, file, block) {
  await openReader(page, blockLink(origin, file, block));
  await sourceRows(page).first().waitFor();
}

async function readLines(page, expected) {
  const actual = await sourceRows(page).evaluateAll(rows => rows.map(row => ({
    line: row.lastElementChild.textContent, number: Number(row.firstElementChild.textContent),
  })));
  assert.deepEqual(actual, expected.map((line, index) => ({ line, number: index + 1 })));
  assert.equal(await sourceRows(page).locator('b, button, main').count(), 0);
  assert.equal(await page.locator('.explanation-text [class^="source-"]').count(), 0);
}

async function checkSamples(page, samples) {
  for (const [number, text, kind] of samples) {
    const roles = await sourceRows(page).nth(number - 1).locator('> span:nth-child(2)').evaluate((line, text) => {
      const start = line.textContent.indexOf(text);
      if (start < 0) return [];
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      const result = new Set();
      let offset = 0;
      for (let node; (node = walker.nextNode());) {
        const end = offset + node.textContent.length;
        if (end > start && offset < start + text.length) result.add(node.parentElement.className || 'source-plain');
        offset = end;
      }
      return [...result];
    }, text);
    assert.deepEqual(roles, ['source-' + kind], `line ${number}, ${text}`);
  }
}

async function checkThemes(page, file, selectors) {
  const original = await sourceRows(page).first().elementHandle();
  const themeTrigger = page.locator('[popovertarget=reader-theme-menu]');
  const series = report.themes[file] = {};
  for (const theme of ['green', 'warm', 'blue', 'white', 'black']) {
    await themeTrigger.click();
    await page.locator(`[data-theme-choice=${theme}]`).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
    assert.ok(await original.evaluate(row => row.isConnected), 'theme replaced the source row');
    const png = await page.screenshot({ path: path.join(output, `${file}-${theme}.png`), animations: 'disabled' });
    const pairs = await textContrast(page, png, selectors);
    assert.equal(pairs.length, selectors.length, JSON.stringify({ file, theme, pairs }));
    for (const pair of pairs) assert.ok(pair.ratio >= pair.minimum, JSON.stringify({ file, theme, pair }));
    series[theme] = pairs;
  }
}

async function checkNarrow(page, name, lineNumber, expected) {
  await page.setViewportSize({ width: 390, height: 844 });
  const scroller = page.locator('.source-scroll');
  const row = sourceRows(page).nth(lineNumber - 1);
  await scroller.focus();
  const gutter = row.locator('.line-number');
  const left = (await gutter.boundingBox()).x;
  await scroller.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  assert.ok(await scroller.evaluate(el => el.scrollLeft > 0));
  assert.equal((await gutter.boundingBox()).x, left);
  const tail = await row.locator('> span:nth-child(2)').evaluate((text, expected) => {
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    let node;
    let lastHit;
    while ((node = walker.nextNode())) if (node.textContent.includes(expected)) lastHit = node;
    const start = lastHit.textContent.lastIndexOf(expected);
    const range = document.createRange();
    range.setStart(lastHit, start);
    range.setEnd(lastHit, start + expected.length);
    const bounds = range.getBoundingClientRect();
    const scroller = text.closest('.source-scroll').getBoundingClientRect();
    return { x: bounds.x, right: bounds.right, y: (bounds.top + bounds.bottom) / 2, scroller: scroller.toJSON() };
  }, expected);
  assert.ok(tail.x > tail.scroller.left && tail.right <= tail.scroller.right);
  await page.mouse.move(tail.x + 1, tail.y);
  await page.mouse.down();
  await page.mouse.move(tail.right + 1, tail.y, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => getSelection().toString()), expected);
  await page.screenshot({ path: path.join(output, `narrow-${name}.png`) });
  report.narrow ??= {};
  report.narrow[name] = { width: 390, endVisible: true, selected: expected, gutterX: left };
}

try {
  for (const [file, { lines, samples }] of Object.entries(examples)) {
    await usePage(async page => {
      const chunks = [];
      page.on('response', res => {
        const pathname = new URL(res.url()).pathname;
        if (res.ok() && pathname.startsWith('/assets/') && pathname.endsWith('.js')) chunks.push(pathname);
      });
      await openFile(page, file);
      const firstStyled = page.locator('.source-line [class^="source-"]').first();
      if (samples.length) await firstStyled.waitFor();
      else assert.equal(await firstStyled.count(), 0);
      await readLines(page, lines);
      await checkSamples(page, samples);
      if (file === 'config.py') {
        const response = await readerFetch(origin + '/api/document?path=' + encodeURIComponent(documentPath(file)));
        const { result } = await response.json();
        assert.deepEqual(result.sourceLines, lines);
        assert.deepEqual(result.blocks.map(block => block.lines), [{ start: 1, end: 3 }, { start: 4, end: 9 }]);
        report.fixedCommit = result.commit;
        await checkThemes(page, file, ['#syntax01 .source-keyword', '#syntax01 .source-string',
          '#syntax02 .source-comment', '#syntax01 .source-line:nth-child(3) > span:nth-child(2)']);
      }
      if (file === 'Demo.vue') {
        await checkThemes(page, file, ['#syntax01 .source-tag', '#syntax01 .source-property']);
        await checkNarrow(page, 'vue', 2, 'button');
      }
      if (file === 'unknown.aftertaste-example') await checkNarrow(page, 'plain', 3, 'REACHABLE_END');
      report.files[file] = { lines: lines.length, samples: samples.length, chunks };
    });
  }

  await usePage(async page => {
    const chunks = report.files['demo.rs'].chunks;
    const rust = chunks.find(chunk => /\/rust-[\w-]+\.js$/u.test(chunk));
    assert.ok(rust, 'Rust grammar request was absent from cold load');
    let intercepted = false;
    await page.route(origin + rust, route => { intercepted = true; return route.abort(); });
    const failed = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === rust });
    await openFile(page, 'demo.rs');
    await failed;
    assert.ok(intercepted);
    await readLines(page, examples['demo.rs'].lines);
    assert.equal(await page.locator('.source-line [class^="source-"]').count(), 0);
    await page.locator('.file-button[title="demo.ts"]').click();
    await page.getByRole('heading', { level: 1, name: 'demo.ts' }).waitFor();
    await page.locator('.source-keyword').first().waitFor();
    await checkSamples(page, examples['demo.ts'].samples);
    report.fallback = { blocked: rust, intact: true, nextFileHighlighted: true };
  });

  await usePage(async page => {
    const python = report.files['config.py'].chunks.find(chunk => /\/python-[\w-]+\.js$/u.test(chunk));
    assert.ok(python, 'Python grammar request was absent from cold load');
    const { promise: held, resolve: release } = Promise.withResolvers();
    await page.route(origin + python, async route => {
      await held;
      return route.fallback();
    });
    const finished = page.waitForEvent('requestfinished', { predicate: req => new URL(req.url()).pathname === python });
    try {
      await openFile(page, 'config.py');
      const text = sourceRows(page).first().locator('> span:nth-child(2)');
      const expected = examples['config.py'].lines[0];
      assert.equal(await text.locator('[class^="source-"]').count(), 0);
      await text.evaluate(line => {
        const range = document.createRange();
        range.selectNodeContents(line);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      });
      assert.equal(await page.evaluate(() => getSelection().toString()), expected);
      release();
      await finished;
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => getSelection().toString()), expected);
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
      await page.keyboard.press('Control+C');
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
      await page.evaluate(() => getSelection().removeAllRanges());
      await text.locator('.source-keyword').first().waitFor();
      await readLines(page, examples['config.py'].lines);
      report.coldSelection = { retained: true, copied: true, highlightedAfterClear: true };
    } finally {
      release();
    }
  });

  assert.deepEqual(report.outside, []);
  assert.deepEqual(report.writes, []);
  assert.deepEqual(report.errors, []);
  report.passed = true;
} finally {
  await writeFile(path.join(output, 'browser.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
