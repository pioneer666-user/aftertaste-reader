import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir, symlink, rm, link, open } from 'node:fs/promises';
import path from 'node:path';
import { FixedSourceService } from '../../dist/application/fixed-source.js';
import { GitSourceRepository } from '../../dist/adapters/git-source.js';
import { DocumentService } from '../../dist/application/document-blocks.js';
import { DocumentFileStore } from '../../dist/adapters/document-store.js';
import { createDocumentFixture, cli, documentPath, sourceText, plan } from '../fixtures/document-blocks.mjs';
import { git } from '../fixtures/fixed-source.mjs';

const service = store => new DocumentService(new FixedSourceService(new GitSourceRepository()), store ?? new DocumentFileStore());

test('CLI 从异 cwd 创建镜像、填写、固定 A 校验且只读，旧入口仍可用', async () => {
  const f = await createDocumentFixture();
  for (const sourcePath of ['a.ts', 'nested/a.ts', 'a.py']) {
    const created = cli(f, 'create-document', { commit: f.commit, path: sourcePath, blocks: JSON.stringify(plan) }, f.runRoot);
    assert.equal(created.status, 0, created.stderr);
    assert.equal(created.json.generated, true);
    assert.equal(created.json.result.contentStatus, 'unfilled');
    assert.equal(created.json.result.documentPath, `docs/aftertaste/current/${sourcePath}.md`);
    assert.equal(JSON.stringify(created.json).includes(sourceText), false);
  }
  const target = path.join(f.projectRoot, documentPath);
  const initial = await readFile(target, 'utf8');
  const duplicate = cli(f, 'create-document', { commit: f.commit, path: 'a.ts', blocks: JSON.stringify(plan) });
  assert.equal(duplicate.status, 1);
  assert.equal(duplicate.json.error.code, 'DOCUMENT_EXISTS');
  assert.equal(await readFile(target, 'utf8'), initial);
  const filled = initial.replaceAll('\n\n<!-- aftertaste:end -->', '\n合成讲解。\n<!-- aftertaste:end -->');
  await writeFile(target, filled);
  const before = await readFile(target);
  await writeFile(path.join(f.projectRoot, 'a.ts'), 'B\n');
  git(f.repositoryRoot, ['add', 'packages/小 项目/a.ts']);
  git(f.repositoryRoot, ['commit', '-m', 'synthetic B']);
  await writeFile(path.join(f.projectRoot, 'a.ts'), 'dirty');
  const checked = cli(f, 'validate-document', { document: documentPath }, f.runRoot);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  assert.equal(checked.json.result.commit, f.commit);
  assert.equal(checked.json.result.sourceLineCount, 3);
  assert.equal(checked.json.result.contentStatus, 'provided');
  assert.deepEqual(await readFile(target), before);
  const rawRead = cli(f, 'read', { commit: f.commit, path: 'a.ts' });
  assert.equal(rawRead.status, 0);
  assert.equal(rawRead.json.file.content, sourceText);
});

test('Windows 已有混合大小写普通目录支持创建和校验，大小写别名中的 junction 仍被拒绝',
  { skip: process.platform !== 'win32' }, async () => {
    const f = await createDocumentFixture();
    const actualCurrent = path.join(f.projectRoot, 'Docs/AfterTaste/Current');
    await mkdir(path.join(actualCurrent, 'NESTED'), { recursive: true });
    const existing = `<!-- aftertaste:document commit=${f.commit} -->\n\n` +
      '<!-- aftertaste:block id=abcdefgh lines=1-3 -->\n合成讲解。\n<!-- aftertaste:end -->\n';
    const existingTarget = path.join(actualCurrent, 'a.ts.md');
    await writeFile(existingTarget, existing);
    const validated = cli(f, 'validate-document', { document: documentPath }, f.runRoot);
    const created = cli(f, 'create-document', { commit: f.commit, path: 'nested/a.ts', blocks: JSON.stringify(plan) }, f.runRoot);
    assert.deepEqual([validated.status, created.status], [0, 0], JSON.stringify({ validated, created }));
    assert.equal(created.json.result.mechanicallyValid, true);
    assert.equal(created.json.result.documentPath, 'docs/aftertaste/current/nested/a.ts.md');
    assert.equal(await readFile(existingTarget, 'utf8'), existing);
    const nestedDocument = 'docs/aftertaste/current/nested/a.ts.md';
    assert.equal(cli(f, 'validate-document', { document: nestedDocument }).status, 0);
    const duplicate = cli(f, 'create-document', { commit: f.commit, path: 'nested/a.ts', blocks: JSON.stringify(plan) });
    assert.equal(duplicate.json.error.code, 'DOCUMENT_EXISTS');
    const store = new DocumentFileStore();
    const rootAlias = f.projectRoot.replace(`${path.sep}packages${path.sep}`, `${path.sep}PACKAGES${path.sep}`);
    assert.equal(await store.read(rootAlias, documentPath), existing);
    const outside = path.join(f.runRoot, 'outside-case');
    await mkdir(outside);
    await symlink(outside, path.join(actualCurrent, 'Linked'), 'junction');
    const linkedDocument = 'docs/aftertaste/current/linked/a.ts.md';
    await assert.rejects(store.create(f.projectRoot, linkedDocument, existing), { code: 'DOCUMENT_PATH_UNSAFE' });
    await assert.rejects(store.read(f.projectRoot, linkedDocument), { code: 'DOCUMENT_PATH_UNSAFE' });
    assert.deepEqual(await readdir(outside), []);
  });

test('共用用例保护并发新建，空文件没有虚构源码行', async () => {
  const f = await createDocumentFixture();
  const outcomes = await Promise.allSettled([service().create(f, 'a.ts', plan), service().create(f, 'a.ts', plan)]);
  assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(value => value.status === 'rejected').reason.code, 'DOCUMENT_EXISTS');
  assert.equal((await service().validate(f, documentPath)).mechanicallyValid, true);
  const empty = await service().create(f, 'empty.ts', []);
  assert.equal(empty.sourceLineCount, 0);
  assert.equal(empty.blocks.length, 0);
  assert.deepEqual((await readdir(path.dirname(path.join(f.projectRoot, documentPath)))).sort(), ['a.ts.md', 'empty.ts.md']);
});

test('无效清单和 CLI 参数失败不新建资料，不泄漏源码', async () => {
  const f = await createDocumentFixture();
  for (const options of [
    { commit: f.commit, path: '../outside.ts', blocks: '[]' },
    { commit: f.commit, path: 'a.ts', blocks: 'bad' },
    { commit: f.commit, path: 'a.ts', blocks: '[{"lines":{"start":2,"end":3}}]' },
    { commit: f.commit, path: 'a.ts', blocks: '[{"lines":null}]' },
    { commit: f.commit, path: 'a.ts', blocks: JSON.stringify(plan), extra: 'x' },
  ]) {
    const result = cli(f, 'create-document', options);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.includes('syntheticD008'), false);
  }
  assert.deepEqual((await readdir(f.projectRoot)).sort(), ['a.py', 'a.ts', 'empty.ts', 'nested']);
});

test('校验结构错误和取源失败返回结果及真实未完成，文档与 ID 不变', async () => {
  const f = await createDocumentFixture();
  await service().create(f, 'a.ts', plan);
  const target = path.join(f.projectRoot, documentPath);
  const raw = await readFile(target, 'utf8');
  await writeFile(target, raw.replace('lines=2-3', 'lines=3-3'));
  const invalid = cli(f, 'validate-document', { document: documentPath });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stderr, '');
  assert.equal(invalid.json.result.renderMode, 'markdown');
  assert.ok(invalid.json.result.diagnostics.some(item => item.code === 'SOURCE_GAP'));
  const missingCommit = '0'.repeat(40);
  await writeFile(target, raw.replace(f.commit, missingCommit));
  const before = await readFile(target);
  const unavailable = cli(f, 'validate-document', { document: documentPath });
  assert.equal(unavailable.status, 1);
  assert.equal(unavailable.json.result.sourceCheck, 'unavailable');
  assert.equal(unavailable.json.result.sourceError.code, 'OBJECT_UNAVAILABLE');
  assert.equal(unavailable.json.result.mechanicallyValid, false);
  assert.deepEqual(await readFile(target), before);
  assert.equal(unavailable.stdout.includes('syntheticD008'), false);
});

test('现存 junction 守住项目、资料根及镜像子目录，Windows 非规范名称被拒绝', async () => {
  const f = await createDocumentFixture();
  const outside = path.join(f.runRoot, 'outside');
  await mkdir(outside);
  const docs = path.join(f.projectRoot, 'docs');
  await symlink(outside, docs, 'junction');
  await assert.rejects(service().create(f, 'a.ts', plan), { code: 'DOCUMENT_PATH_UNSAFE' });
  await rm(docs);
  await mkdir(docs);
  const dataRoot = path.join(docs, 'aftertaste');
  await symlink(outside, dataRoot, 'junction');
  await assert.rejects(service().create(f, 'a.ts', plan), { code: 'DOCUMENT_PATH_UNSAFE' });
  await rm(dataRoot);
  await mkdir(path.join(dataRoot, 'current'), { recursive: true });
  const nested = path.join(docs, 'aftertaste/current/nested');
  await symlink(outside, nested, 'junction');
  await assert.rejects(service().create(f, 'nested/a.ts', plan), { code: 'DOCUMENT_PATH_UNSAFE' });
  await assert.rejects(service().validate(f, 'docs/aftertaste/current/nested/a.ts.md'), { code: 'DOCUMENT_PATH_UNSAFE' });
  const projectAlias = path.join(f.runRoot, 'project-alias');
  await symlink(f.projectRoot, projectAlias, 'junction');
  await assert.rejects(service().create({ ...f, projectRoot: projectAlias }, 'a.ts', plan));
  for (const document of ['../a.ts.md', 'docs/aftertaste/current/../a.ts.md', 'docs/aftertaste/current/.git/a.md',
    'docs/aftertaste/current/a.ts', 'docs/aftertaste/current/a.ts.md/extra',
    ...(process.platform === 'win32' ? ['docs/aftertaste/current/CON.md', 'docs/aftertaste/current/dot./a.md',
      'docs/aftertaste/current/space /a.md', 'docs/aftertaste/current/file?.md'] : [])]) {
    await assert.rejects(service().validate(f, document), { code: 'INVALID_PATH' });
  }
  const target = path.join(f.projectRoot, documentPath);
  const outsideFile = path.join(outside, 'external.md');
  await writeFile(outsideFile, 'external content');
  await link(outsideFile, target);
  await assert.rejects(service().validate(f, documentPath), { code: 'DOCUMENT_PATH_UNSAFE' });
  await assert.rejects(service().create(f, 'a.ts', plan), { code: 'DOCUMENT_EXISTS' });
  assert.equal(await readFile(outsideFile, 'utf8'), 'external content');
  await rm(target);
  await rm(outsideFile);
  assert.deepEqual(await readdir(outside), []);
});

test('文档不存在、错误 UTF-8 和无效映射均返回明确错误', async () => {
  const f = await createDocumentFixture();
  await assert.rejects(service().validate(f, documentPath), { code: 'DOCUMENT_READ_FAILED' });
  await service().create(f, 'a.ts', plan);
  await writeFile(path.join(f.projectRoot, documentPath), Buffer.from([0xc0, 0xaf]));
  const invalid = cli(f, 'validate-document', { document: documentPath });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.json.error.code, 'DOCUMENT_READ_FAILED');
  await assert.rejects(service().validate({ ...f, projectPrefix: 'other' }, documentPath), { code: 'INVALID_ARGUMENT' });
  const rootMapping = { projectRoot: f.repositoryRoot, repositoryRoot: f.repositoryRoot, projectPrefix: '', commit: f.commit };
  const rootSource = 'packages/小 项目/a.ts';
  const created = cli(rootMapping, 'create-document', { commit: f.commit, path: rootSource, blocks: JSON.stringify(plan) });
  assert.equal(created.status, 0, created.stderr);
  assert.equal(cli(rootMapping, 'validate-document', { document: `docs/aftertaste/current/${rootSource}.md` }).status, 0);
});

test('写中途或发布失败清理临时文件，已有文件完整', async () => {
  const f = await createDocumentFixture();
  const staging = path.join(f.repositoryRoot, '.git', 'aftertaste-staging');
  const failedWrite = new DocumentFileStore({
    async open(target, flags) {
      assert.equal(path.dirname(target), staging);
      const handle = await open(target, flags);
      const write = handle.writeFile.bind(handle);
      handle.writeFile = async text => {
        await write(text.slice(0, 10));
        throw Object.assign(new Error('synthetic write failure'), { code: 'ENOSPC' });
      };
      return handle;
    }, link,
  });
  await assert.rejects(service(failedWrite).create(f, 'a.ts', plan), { code: 'DOCUMENT_WRITE_FAILED' });
  const parent = path.dirname(path.join(f.projectRoot, documentPath));
  assert.deepEqual(await readdir(parent), []);
  assert.deepEqual(await readdir(staging), []);
  const failedPublish = new DocumentFileStore({ open, async link() { throw Object.assign(new Error(), { code: 'EPERM' }); } });
  await assert.rejects(service(failedPublish).create(f, 'a.ts', plan), { code: 'DOCUMENT_WRITE_FAILED' });
  assert.deepEqual(await readdir(parent), []);
  await service().create(f, 'a.ts', plan);
  const before = await readFile(path.join(f.projectRoot, documentPath));
  await assert.rejects(service(failedPublish).create(f, 'a.ts', plan), { code: 'DOCUMENT_EXISTS' });
  assert.deepEqual(await readFile(path.join(f.projectRoot, documentPath)), before);
});

test('临时名排他创建冲突保留已存在的文件', async () => {
  const f = await createDocumentFixture();
  let conflictingPath;
  const store = new DocumentFileStore({
    async open(target) {
      conflictingPath = target;
      await writeFile(target, 'pre-existing temporary content', { flag: 'wx' });
      throw Object.assign(new Error('synthetic collision'), { code: 'EEXIST' });
    }, link,
  });
  await assert.rejects(service(store).create(f, 'a.ts', plan), { code: 'DOCUMENT_WRITE_FAILED' });
  assert.equal(await readFile(conflictingPath, 'utf8'), 'pre-existing temporary content');
});

test('共用创建拒绝继承端点的范围，合法 getter 只读取一次且不写非法骨架', async () => {
  const f = await createDocumentFixture();
  class Range {
    from = 1;
    to = 3;
    get start() { return this.from; }
    get end() { return this.to; }
  }
  await assert.rejects(service().create(f, 'a.ts', [{ lines: new Range() }]), { code: 'BLOCK_PLAN_INVALID' });
  assert.deepEqual((await readdir(f.projectRoot)).sort(), ['a.py', 'a.ts', 'empty.ts', 'nested']);
  let startReads = 0;
  let endReads = 0;
  const range = { get start() { startReads++; return startReads === 1 ? 1 : 99; },
    get end() { endReads++; return endReads === 1 ? 3 : 99; } };
  const result = await service().create(f, 'a.ts', [{ lines: range }]);
  assert.equal(result.mechanicallyValid, true);
  assert.deepEqual(result.blocks[0].lines, { start: 1, end: 3 });
  assert.equal(startReads, 1);
  assert.equal(endReads, 1);
  assert.equal((await service().validate(f, documentPath)).mechanicallyValid, true);
});
