import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
import { chromium, firefox } from 'playwright';
import { createReaderProject } from '../fixtures/reader-project.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const outputRoot = path.join(repositoryRoot, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D011');
await mkdir(outputRoot, { recursive: true });
const run = await mkdtemp(path.join(outputRoot, 'browser-'));
const fixture = await createReaderProject(path.join(run, 'project'));
const mirror = path.join(fixture.projectRoot, 'docs/aftertaste/current');
const rules = path.join(mirror, 'src/rules.mjs.md');
const service = path.join(mirror, 'src/service.mjs.md');
const originalRules = await readFile(rules, 'utf8');
const originalService = await readFile(service, 'utf8');
const git = (...args) => execFileSync('git', ['-C', fixture.projectRoot, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', windowsHide: true });
await writeFile(path.join(fixture.projectRoot, 'src/empty.ts'), '');
await writeFile(path.join(fixture.projectRoot, 'src/long.ts'), Array.from({ length: 61 }, (_, i) => `// ${i + 1} ${'long line '.repeat(i === 30 ? 150 : 0)}`).join('\n') + '\n');
git('add', 'src/empty.ts', 'src/long.ts');
git('-c', 'user.name=Fixture', '-c', 'user.email=f@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'browser synthetic edges');
const extraCommit = git('rev-parse', 'HEAD').trim();
const header = `<!-- aftertaste:document commit=${extraCommit} -->\n\n`;
await writeFile(path.join(mirror, 'src/empty.ts.md'), `${header}<!-- aftertaste:block id=empty000 -->\n\n<!-- aftertaste:end -->\n`);
await writeFile(path.join(mirror, 'src/long.ts.md'), `${header}<!-- aftertaste:block id=long0000 lines=1-61 -->\n${'长'.repeat(1201)}\n<!-- aftertaste:end -->\n\n<!-- aftertaste:block id=note0000 -->\n## Pure explanation\n\nA separate explanation without source.\n<!-- aftertaste:end -->\n`);
await writeFile(path.join(mirror, 'src/unsafe.ts.md'), header + '<!-- aftertaste:block id=unsafe00 -->\n<script>window.UNSAFE=true</script>\n\n![secret](https://external.invalid/pixel)\n\n[x](javascript:alert(1))\n\n```html\n<img onerror="alert(1)">\n```\n<!-- aftertaste:end -->\n');

const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const cli = path.join(repositoryRoot, 'dist/cli/main.js');
const child = spawn(process.execPath, [cli, 'serve', '--project', fixture.projectRoot, '--port', String(port)], {
  cwd: run, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let errors = '';
const ready = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('CLI did not become ready')), 15000);
  child.stdout.on('data', chunk => {
    output += chunk;
    const line = output.split('\n').find(value => value.includes('"status":"ready"'));
    if (line) { clearTimeout(timer); resolve(JSON.parse(line)); }
  });
  child.stderr.on('data', chunk => { errors += chunk; });
  child.on('exit', code => { clearTimeout(timer); reject(new Error(`CLI exited ${code} ${errors}`)); });
});
assert.equal(ready.projectRoot, fixture.projectRoot);
const report = { run, cliCwd: run, project: fixture.projectRoot, commit: fixture.commit, browsers: [] };
const selection = process.env.AFTERTASTE_BROWSER ?? 'all';
const engines = selection === 'all' ? ['edge', 'chrome', 'firefox'] : [selection];

try {
  for (const name of engines) {
    const browser = name === 'firefox' ? await firefox.launch({ headless: true }) : await chromium.launch({ channel: name === 'edge' ? 'msedge' : 'chrome', headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      const external = [];
      const pageErrors = [];
      page.on('request', request => { if (!request.url().startsWith(ready.url)) external.push(request.url()); });
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(ready.url);
      const file = name => page.locator(`#reader-navigation button[title="src/${name}"]`);
      const heading = name => page.locator('#reading').getByRole('heading', { name, level: 1, exact: true });
      const comparison = (target = page) => target.locator('#reading .document-blocks');
      const projectInfo = page.locator('.project-info:popover-open');
      await file('rules.mjs').click();
      await comparison().waitFor();
      assert.equal(await page.locator('.source-line').count(), 7);
      const lineNumberContrast = await page.locator('.line-number').first().evaluate(element => {
        const luminance = color => {
          const channels = color.match(/\d+/g).slice(0, 3).map(Number).map(value => {
            const normalized = value / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const foreground = luminance(getComputedStyle(element).color);
        const background = luminance(getComputedStyle(element.closest('.source-pane')).backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
      assert.ok(lineNumberContrast >= 4.5, `${name} line number contrast ${lineNumberContrast}`);
      assert.match(await page.locator('.source-scroll').innerText(), /function parseQuantity/);
      assert.doesNotMatch(await page.locator('.source-scroll').innerText(), /WORKTREE_ONLY/);
      await page.locator('.project-info-toggle').click();
      await projectInfo.locator('.check-status').waitFor();
      assert.equal(await projectInfo.locator('.commit').innerText(), fixture.commit);
      await page.keyboard.press('Escape');
      await projectInfo.waitFor({ state: 'hidden' });
      await file('service.mjs').click();
      await comparison().waitFor();
      assert.equal(await page.locator('.source-line').count(), 10);
      const pane = page.locator('.reading-pane');
      await pane.evaluate(element => { element.scrollTop = 300; });
      const beforeScroll = await pane.evaluate(element => element.scrollTop);
      await page.locator('.language-control select').selectOption('en');
      await page.getByRole('button', { name: 'Refresh documents' }).waitFor();
      assert.equal(await pane.evaluate(element => element.scrollTop), beforeScroll);
      await heading('src/service.mjs').waitFor();
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['aftertaste.language']);
      await page.reload();
      await page.getByRole('button', { name: 'Refresh documents' }).waitFor();
      await comparison().waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.deepEqual(external, []);
      assert.deepEqual(pageErrors, []);

      if (name === 'edge') {
        await page.route('**/api/document?path=*rules.mjs.md', async route => {
          const response = await route.fetch();
          await new Promise(resolve => setTimeout(resolve, 300));
          await route.fulfill({ response }).catch(() => {});
        });
        await file('rules.mjs').click();
        await file('service.mjs').click();
        await heading('src/service.mjs').waitFor();
        await page.waitForTimeout(400);
        assert.ok(await heading('src/service.mjs').isVisible());
        await page.unroute('**/api/document?path=*rules.mjs.md');

        await writeFile(rules, originalRules.replace('## ', '## Updated from disk '));
        await file('rules.mjs').click();
        await page.getByText('Updated from disk', { exact: false }).first().waitFor();
        await writeFile(rules, originalRules.replace('lines=1-7', 'lines=2-7'));
        await page.getByRole('button', { name: 'Refresh documents' }).click();
        await page.getByText('Reading the original as standard Markdown', { exact: true }).waitFor();
        const repair = await page.getByRole('textbox', { name: 'Selectable repair information' }).inputValue();
        assert.match(repair, /SOURCE_GAP/);
        assert.match(repair, new RegExp(fixture.commit));
        assert.doesNotMatch(repair, /function parseQuantity|quantity must/);
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.getByRole('button', { name: 'Copy repair information', exact: true }).click();
        await page.getByText('Copied', { exact: true }).waitFor();
        assert.deepEqual(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())), JSON.parse(repair));
        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: async () => { throw new Error('clipboard denied'); },
        } }));
        await page.getByRole('button', { name: 'Copy repair information', exact: true }).click();
        await page.getByText('Automatic copy failed.', { exact: false }).waitFor();
        assert.equal(await page.getByRole('textbox', { name: 'Selectable repair information' }).inputValue(), repair);
        await pane.evaluate(element => { element.scrollTop = 0; });
        await page.screenshot({ path: path.join(run, 'edge-fallback.png'), fullPage: true });
        await writeFile(rules, originalRules);

        await file('long.ts').click();
        await comparison().waitFor();
        assert.equal(await page.locator('.source-line').count(), 61);
        assert.equal(await page.locator('.source-pane').count(), 1);
        assert.equal(await page.locator('.explanation-pane').count(), 2);
        assert.match(await page.locator('.problem-list').innerText(), /SOURCE_TOO_LARGE/);
        assert.match(await page.locator('.problem-list').innerText(), /EXPLANATION_TOO_LARGE/);
        assert.ok(await page.locator('.source-scroll').evaluate(element => element.scrollWidth > element.clientWidth));
        await file('empty.ts').click();
        await page.getByText('This explanation is unfinished').first().waitFor();
        assert.equal(await page.locator('.source-pane').count(), 0);
        await file('unsafe.ts').click();
        await page.locator('.fallback-markdown').waitFor();
        assert.equal(await page.evaluate(() => window.UNSAFE), undefined);
        assert.equal(await page.locator('.markdown img, .markdown script').count(), 0);
        assert.deepEqual(external, []);

        await rename(path.join(fixture.projectRoot, '.git'), path.join(fixture.projectRoot, 'git-hidden'));
        try {
          await file('rules.mjs').click();
          await page.getByText('Fixed source unavailable', { exact: true }).waitFor();
          assert.ok(await page.locator('.fallback-markdown').innerText());
          await page.screenshot({ path: path.join(run, 'edge-git-unavailable.png'), fullPage: true });
        } finally { await rename(path.join(fixture.projectRoot, 'git-hidden'), path.join(fixture.projectRoot, '.git')); }

        await writeFile(rules, Buffer.from([0xff, 0xfe]));
        await page.getByRole('button', { name: 'Refresh documents' }).click();
        await page.getByRole('heading', { name: 'Could not read this explanation' }).waitFor();
        assert.equal(await page.locator('.fallback-markdown').count(), 0);
        assert.equal(JSON.parse(await page.getByRole('textbox', { name: 'Selectable repair information' }).inputValue()).source_path, 'src/rules.mjs');
        await page.screenshot({ path: path.join(run, 'edge-read-error.png'), fullPage: true });
        await writeFile(rules, originalRules);
        await page.getByRole('button', { name: 'Refresh documents' }).click();
        await comparison().waitFor();
        await file('service.mjs').click();
        await comparison().waitFor();
        await pane.evaluate(element => { element.scrollTop = 0; });
        await page.screenshot({ path: path.join(run, 'edge-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: path.join(run, 'edge-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1280, height: 900 });
        await file('rules.mjs').waitFor();
        await file('rules.mjs').focus();
        await page.keyboard.press('Enter');
        await heading('src/rules.mjs').waitFor();
        assert.notEqual(await page.locator(':focus').evaluate(element => getComputedStyle(element).outlineStyle), 'none');
        const denied = await browser.newContext();
        await denied.addInitScript(() => {
          Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage unavailable'); } });
        });
        const deniedPage = await denied.newPage();
        await deniedPage.goto(ready.url);
        await comparison(deniedPage).waitFor();
        await deniedPage.locator('.language-control select').selectOption('en');
        await deniedPage.getByText('Language changed for this page.', { exact: false }).waitFor();
        await denied.close();
        const invalid = await browser.newContext();
        await invalid.addInitScript(() => localStorage.setItem('aftertaste.language', 'invalid'));
        const invalidPage = await invalid.newPage();
        await invalidPage.goto(ready.url);
        await invalidPage.getByRole('button', { name: '刷新资料' }).waitFor();
        await invalid.close();
        await rename(mirror, `${mirror}-hidden`);
        try {
          await page.getByRole('button', { name: 'Refresh documents' }).click();
          await page.getByRole('heading', { name: 'No file explanations yet' }).waitFor();
          await writeFile(mirror, 'not a directory');
          try {
            await page.getByRole('button', { name: 'Refresh documents' }).click();
            await page.getByRole('heading', { name: 'Could not read the document list' }).waitFor();
          } finally { await unlink(mirror); }
        } finally { await rename(`${mirror}-hidden`, mirror); }
        await page.getByRole('button', { name: 'Refresh documents' }).click();
        await comparison().waitFor();
      }
      report.browsers.push({ name, version: browser.version(), passed: true, lineNumberContrast, pageErrors, externalRequests: external });
      await context.close();
      await writeFile(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report.browsers.at(-1)));
    } finally { await browser.close(); }
  }
  assert.equal(await readFile(rules, 'utf8'), originalRules);
  assert.equal(await readFile(service, 'utf8'), originalService);
  console.log(JSON.stringify({ ok: true, run, browsers: report.browsers }));
} finally {
  child.kill();
  await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
}
