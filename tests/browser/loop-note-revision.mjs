import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build, repository } from '../fixtures/dependency-canvas.mjs';
import { createLoopReaderProject } from '../fixtures/loop-reader.mjs';
import { chooseLoop } from './loop-controls.mjs';

const root = path.join(repository, '.local', process.env.AFTERTASTE_TEST_TASK ?? 'D043/self');
await mkdir(root, { recursive: true });
const run = await mkdtemp(path.join(root, 'selection-'));
const project = path.join(run, 'project');
if (process.env.AFTERTASTE_TRIAL_PROJECT) await cp(process.env.AFTERTASTE_TRIAL_PROJECT, project, { recursive: true });
else await createLoopReaderProject(project);
const { startReader } = await import(pathToFileURL(path.join(build, 'server/reader.js')));
const server = await startReader(project, 0);
const loopPath = path.join(project, 'docs/aftertaste/loops/order-quantity/current/loop.json');
const artifact = JSON.parse(await readFile(loopPath, 'utf8'));
const notes = async () => JSON.parse(await readFile(path.join(project, 'docs/aftertaste/notes.json'), 'utf8')).notes;
const text = '建立对象这一步还没有改变集合';
const browser = await chromium.launch({ channel: process.env.AFTERTASTE_BROWSER ?? 'msedge', headless: process.env.AFTERTASTE_HEADED !== '1' });
const report = { project, build, locations: {}, errors: [], writes: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('request', r => { if (r.method() === 'PUT') report.writes.push(new URL(r.url()).pathname); });
  const panel = page.locator('#quick-note'), loop = page.locator('#loop-canvas-order-quantity-reading');
  const toolbar = page.locator('.selection-copy-panel:visible');
  const step = id => loop.locator('[data-reading-step="' + id + '"]');
  const pick = id => loop.locator('[data-step="' + id + '"]').click();
  const button = (scope, name) => scope.getByRole('button', { name, exact: true });
  const saved = () => panel.locator('.quick-note-heading [role=status]').filter({hasText:/^已保存$/u}).waitFor();
  async function select(scope, needle, drag = false) {
    await scope.scrollIntoViewIfNeeded();
    const range = await scope.evaluate((el, { needle, drag }) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, index = node.textContent.indexOf(needle);
        if (index < 0) continue;
        if (!drag) { getSelection().setBaseAndExtent(node, index + needle.length, node, index); return; }
        const rect = offset => {
          const r = document.createRange();
          r.setStart(node, offset); r.collapse(true);
          const b = r.getBoundingClientRect(); return { x: b.x, y: b.y + b.height / 2 };
        };
        return [rect(index + needle.length), rect(index)];
      }
      throw Error('excerpt missing: ' + needle);
    }, { needle, drag });
    if (range) {
      await page.mouse.move(range[0].x, range[0].y); await page.mouse.down();
      await page.mouse.move(range[1].x, range[1].y, { steps: 10 }); await page.mouse.up();
    }
    await toolbar.waitFor().catch(async error => {
      await page.screenshot({path:path.join(run,'selection-failure.png')});
      console.error({needle,range,selected:await page.evaluate(()=>getSelection().toString())});
      throw error;
    });
    assert.equal(await page.evaluate(() => getSelection().toString()), needle);
  }
  async function pasteLocation(name, control) {
    await control.click();
    await control.locator('..').getByRole('status').filter({hasText:'已复制'}).waitFor();
    const paste = page.locator('#qa-paste');
    await page.evaluate(() => { const el = document.createElement('textarea'); el.id = 'qa-paste'; el.style.position='fixed'; el.style.inset='0 auto auto 0'; document.body.append(el); el.focus({ preventScroll:true }); });
    await page.keyboard.press('Control+v');
    const copied = await paste.inputValue();
    await paste.evaluate(el => el.remove());
    const match = /```json\n([\s\S]+)\n```/u.exec(copied);
    assert.ok(match, copied);
    report.locations[name] = JSON.parse(match[1]);
    return report.locations[name];
  }
  await page.goto(server.url);
  await page.locator('[data-page=loops]').click();
  await chooseLoop(page, 'order-quantity');
  await pick('resume');
  await loop.locator('.loop-reader-toggle').click();
  const lesson = step('resume').locator('.loop-step-explanation');
  await lesson.waitFor();
  await loop.locator('.canvas-inspector').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  // Source, the original block and edge buttons have their own meaning.
  await step('resume').locator('.loop-original summary').click();
  const original = step('resume').locator('.loop-original .markdown');
  await select(lesson,text);
  await original.evaluate(el => getSelection().selectAllChildren(el));
  await page.waitForFunction(() => !document.querySelector('.selection-copy-panel'));
  await select(lesson,text);
  await lesson.evaluate(el => {
    const end = el.closest('.loop-step').querySelector('.loop-original .markdown');
    getSelection().setBaseAndExtent(el, 0, end, end.childNodes.length);
  });
  await page.waitForFunction(() => !document.querySelector('.selection-copy-panel'));
  await step('resume').locator('.loop-original summary').click();
  await step('resume').locator('.loop-source-trigger').click();
  const source = page.locator('.loop-source-panel:visible .source-line').first();
  await source.evaluate(el => getSelection().selectAllChildren(el));
  assert.ok((await page.evaluate(() => getSelection().toString())).trim());
  assert.equal(await toolbar.count(),0);
  await page.locator('.loop-source-panel:visible .loop-source-header button').click();
  const before = await lesson.boundingBox();
  await select(lesson, text, true);
  assert.deepEqual(await lesson.boundingBox(), before);
  await page.keyboard.press('Control+c');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text);
  await page.screenshot({path: path.join(run, 'desktop.png')});
  assert.deepEqual(await pasteLocation('resume', button(toolbar, '复制步骤定位')), {
    format: 'aftertaste-loop-step/v1', loop_id: 'order-quantity', step_id: 'resume', source_commit: artifact.source_commit, field: 'explanation', selection: text });
  assert.deepEqual(report.writes, []);
  await select(lesson, text);
  await button(toolbar, '加入笔记').click();
  const title = panel.getByRole('textbox', {name:'笔记标题（可选）'});
  await title.fill('订单步骤核对'); await saved();
  await button(panel, '预览').click();
  await pick('start');
  const startText = '此时集合仍保持原状';
  const opening = step('start').locator('.loop-step-explanation');
  await select(opening, startText, true);
  const firstStep = await pasteLocation('start',button(toolbar,'复制步骤定位'));
  assert.equal(firstStep.step_id,'start');
  assert.equal(firstStep.source_commit,artifact.source_commit);
  assert.equal(firstStep.selection,startText);
  await select(opening,startText);
  await button(toolbar, '加入笔记').click(); await saved();
  assert.equal(await title.inputValue(), '订单步骤核对');
  await page.locator('[data-page=reader]').click();
  await page.locator('#reader-navigation button[title="src/service.mjs"]').click();
  const fileText = '成功后按集合当前长度加一产生编号，再建立订单对象。';
  const fileBlock = page.locator('#m3vuiqzi .explanation-text');
  await select(fileBlock, fileText);
  const location = await pasteLocation('file',button(toolbar,'复制块定位'));
  assert.equal(location.block_id,'m3vuiqzi'); assert.equal(location.selection,fileText);
  await select(fileBlock, fileText); await button(toolbar,'加入笔记').click(); await saved();
  const note = (await notes()).find(n => n.title === '订单步骤核对');
  assert.match(note.body, /#aftertaste-loop\/order-quantity\/resume/u);
  assert.match(note.body, /#aftertaste-loop\/order-quantity\/start/u);
  assert.match(note.body, /#aftertaste-block\//u);
  await page.reload();
  await page.locator('.new-note').click();
  await panel.getByRole('searchbox').fill('订单步骤核对'); await panel.locator('.quick-list button').click();
  await button(panel,'预览').click(); await panel.getByRole('link',{name:text}).click();
  await lesson.waitFor(); assert.equal(await loop.locator('.loop-reader-toggle').getAttribute('aria-expanded'),'true');
  await page.locator('[data-history=back]').click();
  await page.locator('[data-page=notes]').click();
  const bench = page.locator('#notes');
  await bench.locator('.note-list button').filter({hasText:'订单步骤核对'}).click();
  await bench.getByRole('link',{name:startText}).click(); await step('start').waitFor();
  await page.locator('[data-history=back]').click();
  await bench.getByRole('link',{name:text}).click(); await lesson.waitFor();
  const whole = await pasteLocation('whole',button(step('resume'),'复制步骤定位'));
  assert.equal(whole.step_id,'resume'); assert.ok(!('selection' in whole));
  await select(lesson,text);
  await pick('check'); await toolbar.waitFor({state:'detached'});
  await pick('start');
  const hint = step('start').locator('.loop-step-hint');
  await select(hint,'留意调用是正常返回还是抛出异常');
  await page.keyboard.press('Tab');
  assert.equal(await button(toolbar,'复制步骤定位').evaluate(el => el === document.activeElement), true);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText:async()=>{throw Error('denied');}} }));
  await page.keyboard.press('Enter');
  const fallback = toolbar.locator('textarea'); await fallback.waitFor();
  assert.match(await fallback.inputValue(), /"field": "hint"/u);
  const manualText = await fallback.inputValue();
  await fallback.press('Control+a'); await fallback.press('Control+c');
  const manualPaste = await page.evaluateHandle(() => {
    const el=document.createElement('textarea');
    el.style.position='fixed'; el.style.top='0'; document.body.append(el); el.focus(); return el;
  });
  await page.keyboard.press('Control+v');
  assert.equal(await manualPaste.evaluate(el => el.value), manualText);
  await manualPaste.evaluate(el => el.remove()); await manualPaste.dispose();
  await loop.locator('.loop-reader-toggle').focus();
  await loop.locator('.loop-reader-toggle').click(); await toolbar.waitFor({state:'detached'});
  await page.locator('[data-history=back]').click();
  await writeFile(loopPath, JSON.stringify({...artifact,id:'wrong'}));
  await bench.getByRole('link',{name:text}).click();
  await bench.locator('.note-visit-problem').waitFor();
  assert.equal((await notes()).find(n=>n.id===note.id).body,note.body);
  await writeFile(loopPath,JSON.stringify(artifact,null,2)+'\n');
  await context.close();

  const mobile = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const small = await mobile.newPage();
  await small.goto(server.url + '#aftertaste-loop/order-quantity/resume');
  const graph = small.locator('#loop-canvas-order-quantity-reading');
  await graph.locator('[data-reading-step=resume]').waitFor();
  await graph.locator('.loop-step-explanation').evaluate(el => getSelection().selectAllChildren(el));
  const actions = small.locator('.selection-copy-panel:visible');
  await actions.waitFor().catch(async error => {
    await small.screenshot({path:path.join(run,'narrow-failure.png')});
    console.error(await small.evaluate(() => {
      const range = getSelection().getRangeAt(0);
      return { text: range.toString(), focus: getSelection().focusNode?.nodeName, rect: range.getBoundingClientRect().toJSON() };
    }));
    throw error;
  });
  const bounds = await actions.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x+bounds.width <= 390 && bounds.y >= 0 && bounds.y+bounds.height <= 844);
  assert.ok((await button(actions,'加入笔记').boundingBox()).height>=44);
  await small.screenshot({path:path.join(run,'narrow.png')});
  await button(actions,'加入笔记').tap(); await small.locator('#quick-note .note-reference').waitFor();
  await mobile.close();
  assert.deepEqual(report.errors,[]);
  report.passed = true;
  console.log(run);
} finally {
  await writeFile(path.join(run,'report.json'),JSON.stringify(report,null,2));
  await browser.close(); await server.server.close();
}
