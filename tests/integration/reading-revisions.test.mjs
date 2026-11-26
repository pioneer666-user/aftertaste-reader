import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { DocumentService } from '../../dist/application/document-blocks.js';
import { FixedSourceService } from '../../dist/application/fixed-source.js';
import { reviseDocument } from '../../dist/application/revisions.js';
import { DocumentFileStore } from '../../dist/adapters/document-store.js';
import { GitSourceRepository } from '../../dist/adapters/git-source.js';
import { replaceCurrent } from '../../dist/adapters/replace-current.js';
import { temporaryFilePath } from '../../dist/core/project-write-paths.js';
import { cli, repository } from '../fixtures/dependency-canvas.mjs';
import { artifact, createLoopReaderProject } from '../fixtures/loop-reader.mjs';

test('同提交修订校验原件、目标与候选，只发布所指正文', async () => {
  const root = path.join(repository,'.local',process.env.AFTERTASTE_TEST_TASK ?? 'D043/self');
  await mkdir(root,{recursive:true});
  const run = await mkdtemp(path.join(root,'revisions-'));
  const project = await createLoopReaderProject(path.join(run,'project'));
  const document = 'docs/aftertaste/current/src/service.mjs.md';
  const file = path.join(project.projectRoot, document), loopFile = artifact(project,'order-quantity');
  const original = await readFile(file,'utf8'), originalLoop = await readFile(loopFile,'utf8');
  const sha = raw => createHash('sha256').update(raw).digest('hex');
  function invoke(command, target, expected, input, commit = project.commit) {
    const call = spawnSync(process.execPath,[cli,command,'--project',project.projectRoot,'--commit',commit,
      '--expected',sha(expected),...target],{encoding:'utf8',input});
    return JSON.parse(call.status === 0 ? call.stdout : call.stderr);
  }
  const target = ['--id','order-quantity','--step','resume','--field','explanation'];
  const doc = ['--document',document,'--block','m3vuiqzi'];
  const staged = path.join(project.projectRoot, temporaryFilePath(document));
  assert.equal(invoke('revise-step',target,originalLoop,'示例','0'.repeat(40)).error.code,'REVISION_VERSION');
  assert.equal(invoke('revise-step',[...target.slice(0,3),'absent','--field','explanation'],originalLoop,'示例').error.code,'REVISION_TARGET');
  assert.equal(await readFile(loopFile,'utf8'),originalLoop);
  const changed = '建立对象后还要追加，集合才会多一个条目。';
  assert.equal(invoke('revise-step',target,originalLoop,changed).ok,true);
  const expectedLoop = JSON.parse(originalLoop);
  expectedLoop.nodes.find(node=>node.id==='resume').explanation=changed;
  assert.deepEqual(JSON.parse(await readFile(loopFile,'utf8')),expectedLoop);
  assert.equal(invoke('revise-step',target,originalLoop,'过时修订').error.code,'REVISION_CONFLICT');
  assert.equal(await readFile(file,'utf8'),original);
  assert.equal(invoke('revise-document',doc,original,'<!-- aftertaste:end -->').error.code,'REVISION_INVALID');
  assert.equal(await readFile(file,'utf8'),original);
  await writeFile(file+'.revision.lock','');
  try {
    assert.equal(invoke('revise-document',doc,original,'有效讲解').error.code,'REVISION_BUSY');
    assert.equal(await readFile(file,'utf8'),original);
  } finally { await unlink(file+'.revision.lock'); }
  await writeFile(staged, '遗留的本次临时位置');
  try {
    assert.equal(invoke('revise-document',doc,original,'有效讲解').error.code,'REVISION_BUSY');
    assert.equal(await readFile(file,'utf8'),original);
    assert.equal(await readFile(staged, 'utf8'), '遗留的本次临时位置');
  } finally { await unlink(staged); }
  assert.equal(invoke('revise-document',doc,original,changed).ok,true);
  const first = await readFile(file,'utf8');
  assert.match(first,/id=m3vuiqzi lines=4-6/u);
  assert.ok(first.includes(changed));
  const split = ['--document',document,'--blocks','m3vuiqzi'];
  const chunks = '<!-- aftertaste:block id=newpart1 lines=4-5 -->\n读输入。\n<!-- aftertaste:end -->\n\n' +
    '<!-- aftertaste:block id=newpart2 lines=6-6 -->\n建立对象。\n<!-- aftertaste:end -->';
  assert.equal(invoke('revise-document',split,first,chunks.replace('newpart1','m3vuiqzi')).error.code,'REVISION_INVALID');
  assert.equal(await readFile(file,'utf8'),first);
  assert.deepEqual(invoke('revise-document',split,first,chunks).result.blocks,['newpart1','newpart2']);
  assert.deepEqual(JSON.parse(await readFile(loopFile,'utf8')),expectedLoop);

  // Another editor saves after candidate validation, before publication.
  const latest = await readFile(file,'utf8');
  const other = latest.replace('读输入。','另一位读者刚保存的讲解。');
  const documents = new DocumentService(new FixedSourceService(new GitSourceRepository()),new DocumentFileStore());
  await assert.rejects(reviseDocument(documents, async (...args) => {
    await writeFile(file,other);
    return replaceCurrent(...args);
  },project.projectRoot,document,project.commit,sha(latest),['newpart1'],false,'覆盖！'), {code:'REVISION_CONFLICT'});
  assert.equal(await readFile(file,'utf8'),other);
  await assert.rejects(stat(staged), { code: 'ENOENT' });
});
