import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchFixture } from '../fixtures/reader-launch.mjs';
import { createLoopReaderProject } from '../fixtures/loop-reader.mjs';

const fixture = await launchFixture('browsers');
const project = (await createLoopReaderProject(path.join(fixture.run, '隔离订单'))).projectRoot;
const block = '#aftertaste-block/docs%2Faftertaste%2Fcurrent%2Fsrc%2Frules.mjs.md/x4y6az2y';
const step = '#aftertaste-loop/order-quantity/check';

async function enter(page, entry) {
  try {
    await page.goto(entry);
    await page.locator('.reader-entry-button').waitFor();
  } catch {
    throw new Error('浏览器未能进入私密阅读入口');
  }
  assert.ok(!page.url().includes('token='));
}

const report = { edge: '', chrome: '', locations: [] };
const copies = [];
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge' });
  report.edge = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  for (const [target, visible] of [[block, '#x4y6az2y'], [step, '[data-reading-step="check"]']]) {
    const ready = await fixture.link(project, ['--target', target]);
    const page = await context.newPage();
    await enter(page, ready.url);
    assert.equal(page.url(), ready.location);
    await page.locator(visible).waitFor();
    const trigger = page.getByRole('button', { name: '阅读链接' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: '阅读链接' });
    const input = dialog.getByRole('textbox', { name: '阅读链接' });
    await input.waitFor();
    assert.ok(await input.inputValue() === ready.url);
    await dialog.getByRole('button', { name: '复制链接' }).click();
    await dialog.getByRole('status').getByText('已复制', { exact: true }).waitFor();
    if (target === step) await page.screenshot({ path: path.join(fixture.run, 'edge-dialog.png'), mask: [input] });
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(copied === ready.url);
    copies.push({ copied, location: ready.location, visible });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(node => document.activeElement === node), true);
    assert.equal(await input.count(), 0);
    await page.close();
  }
  await browser.close();

  browser = await chromium.launch({ channel: 'chrome' });
  report.chrome = browser.version();
  for (const { copied, location, visible } of copies) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    assert.equal((await page.goto(location)).status(), 403);
    assert.equal(await page.locator('body').innerText(), '请打开本次阅读的私密入口。');
    await enter(page, copied);
    await page.locator(visible).waitFor();
    assert.equal(page.url(), location);
    const trigger = page.getByRole('button', { name: '阅读链接' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '阅读链接' });
    const input = dialog.getByRole('textbox', { name: '阅读链接' });
    await input.waitFor();
    assert.ok(await input.inputValue() === copied);
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => { throw new Error('clipboard unavailable'); };
    });
    await dialog.getByRole('button', { name: '复制链接' }).click();
    await dialog.getByRole('status').getByText('请手动复制已选中的链接。', { exact: true }).waitFor();
    assert.equal(await input.evaluate(node => node.selectionStart === 0 && node.selectionEnd === node.value.length), true);
    if (visible.includes('reading-step')) await page.screenshot({ path: path.join(fixture.run, 'chrome-narrow-dialog.png'), mask: [input] });
    report.locations.push(new URL(location).hash);
    await context.close();
  }
  await writeFile(path.join(fixture.run, 'report.json'), JSON.stringify(report, null, 2));
  console.log(fixture.run, report);
} finally {
  await browser?.close();
  await fixture.stop(project);
}
