import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { chooseLoop } from '../../tests/browser/loop-controls.mjs';

const [url, project, mode, id, step] = process.argv.slice(2);
assert.ok(url && project && id && ((mode === 'file' && !step) || (['loop', 'reopen'].includes(mode) && step)),
  '参数为 url project file sourcePath，或 url project loop|reopen loopId stepId');
const base = new URL(url);
assert.equal(base.hostname, '127.0.0.1');
const commit = '3f1ed50f6776452c11b6ffdbdc767cd1887d629b';
const fixedLines = sourcePath => execFileSync('git', ['-C', project, 'show', commit + ':' + sourcePath], {
  encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
}).replace(/(?:\r\n|\r|\n)$/u, '').split(/\r\n|\r|\n/u);
const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
    serviceWorkers: 'block',
  });
  const received = new Set();
  const blocked = [];
  let errors = 0;
  await context.route('**/*', route => {
    const target = new URL(route.request().url());
    if (target.origin === base.origin) return route.continue();
    blocked.push(target.origin);
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', () => { errors++; });
  page.on('response', response => {
    const resource = new URL(response.url());
    if (resource.origin === base.origin && response.ok() && resource.pathname.startsWith('/assets/')) {
      received.add(resource.pathname);
    }
  });
  const report = { browser: browser.version(), url: base.href, sourceCommit: commit, mode, id };
  const get = async resource => {
    const response = await context.request.get(new URL(resource, base).href);
    assert.ok(response.ok(), '读取项目资料接口失败');
    const payload = await response.json();
    assert.equal(payload.ok, true);
    return payload.result;
  };

  if (mode === 'file') {
    const documentPath = `docs/aftertaste/current/${id}.md`;
    const result = await get('/api/document?' + new URLSearchParams({ path: documentPath }));
    assert.equal(result.commit, commit);
    assert.equal(result.mechanicallyValid, true);
    assert.equal(result.contentStatus, 'provided');
    const lines = fixedLines(id);
    assert.ok(JSON.stringify(result.sourceLines) === JSON.stringify(lines), '页面取源和固定提交不一致');
    await page.goto(base.href);
    await page.locator('#reading').getByRole('heading', { name: id, level: 1, exact: true }).waitFor();
    await page.locator('#reading .document-blocks .markdown p').first().waitFor();
    await page.locator('#reading .source-line').first().waitFor();
    assert.equal(await page.locator('#reading .source-line').count(), lines.length);
    report.document = documentPath;
    report.lines = lines.length;
    report.blocks = result.blocks.length;
  } else {
    const result = await get('/api/loops/' + encodeURIComponent(id));
    const loop = result.loop;
    assert.equal(loop.source_commit, commit);
    assert.equal(result.mechanicallyValid, true);
    const node = loop.nodes.find(item => item.id === step);
    assert.ok(node?.lines, '步骤须有源码定位');
    const link = `#aftertaste-loop/${id}/${step}`;
    const selected = key => page.locator(`[data-reading-step="${key}"]`);
    if (mode === 'loop') {
      await page.goto(base.href);
      await page.locator('[data-page=loops]').click();
      await chooseLoop(page, id);
      await page.locator(`[data-step="${step}"]`).click();
      const toggle = page.locator('.loop-reader-toggle');
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    } else {
      await page.goto(new URL(link, base).href);
    }
    await selected(step).locator('.loop-step-explanation').waitFor();
    await selected(step).locator('.loop-source-trigger').click();
    const source = page.locator('.loop-source-panel:visible');
    await source.locator('.source-line').first().waitFor();
    assert.ok((await source.innerText()).includes(commit), '源码面板未显示固定提交');
    const lines = fixedLines(node.path).slice(node.lines.start - 1, node.lines.end);
    const visibleLines = await source.locator('.source-line > span:last-child').allTextContents();
    assert.ok(JSON.stringify(visibleLines) === JSON.stringify(lines), '步骤源码与 Git 行范围不一致');
    await source.getByRole('button', { name: '关闭源码' }).click();
    await selected(step).getByRole('button', { name: '复制步骤定位' }).click();
    await selected(step).getByText('已复制', { exact: true }).waitFor();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    const location = JSON.parse(clipboard.split('```')[1].slice(4));
    assert.deepEqual(location, { format: 'aftertaste-loop-step/v1', loop_id: id, step_id: step, source_commit: commit });
    report.location = location;
    report.path = node.path;
    report.lines = node.lines;
    if (mode === 'loop') {
      const exits = loop.edges.filter(edge => edge.from === step);
      assert.ok(exits.length >= 2, '预期检查的是一个真实分支步骤');
      for (const [index, exit] of exits.entries()) {
        const choice = selected(step).locator(`[data-choice="${exit.to}"]`);
        await choice.locator('.loop-choice-reason').waitFor();
        assert.ok((await choice.locator('.loop-choice-reason').innerText()).trim());
        await choice.click();
        await selected(exit.to).locator('.loop-step-explanation').waitFor();
        if (index < exits.length - 1) {
          await selected(exit.to).locator(`[data-incoming="${step}"]`).click();
          await selected(step).locator('.loop-step-explanation').waitFor();
        }
      }
      report.exits = exits.map(edge => edge.to);
    }
  }
  const font = await page.evaluate(async () => (await document.fonts.load('400 16px Inter', 'Aftertaste')).length);
  assert.ok(font > 0 && [...received].some(asset => asset.endsWith('.woff2')), '本地字体未加载');
  assert.ok([...received].some(asset => asset.endsWith('.css')), '未加载本地样式');
  assert.ok([...received].some(asset => asset.endsWith('.js')), '未加载本地脚本');
  assert.deepEqual(blocked, []);
  assert.equal(errors, 0);
  console.log(JSON.stringify({ ...report, assets: [...received].sort(), externalRequests: blocked.length, pageErrors: errors }));
} finally {
  await browser.close();
}
