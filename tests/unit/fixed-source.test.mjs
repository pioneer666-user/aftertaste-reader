import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedSourceService, SourceError } from '../../dist/application/fixed-source.js';

const mapping = { projectRoot: 'C:/project', repositoryRoot: 'C:/project', projectPrefix: '' };
const commit = 'a'.repeat(40);

test('pin 解析一次 HEAD，read 只复用完整引用', async () => {
  const calls = [];
  const service = new FixedSourceService({
    async locate(root) { calls.push(['locate', root]); return mapping; },
    async resolveCommit(project, revision) { calls.push(['resolve', revision]); return commit; },
    async readFile(source, filePath) { calls.push(['read', source.commit, filePath]); return { ...source, path: filePath, content: '' }; },
  });
  const fixed = await service.pin(mapping.projectRoot);
  await service.read(fixed, 'a.ts');
  await service.read(fixed, 'b.ts');
  assert.equal(calls.filter(([type]) => type === 'resolve').length, 1);
  assert.deepEqual(calls.find(([type]) => type === 'resolve'), ['resolve', 'HEAD']);
  assert.deepEqual(calls.filter(([type]) => type === 'read'), [['read', commit, 'a.ts'], ['read', commit, 'b.ts']]);
});

test('不合法输入在调用 adapter 前拒绝', async () => {
  let called = false;
  const service = new FixedSourceService({
    async locate() { called = true; return mapping; },
    async resolveCommit() { called = true; return commit; },
    async readFile() { called = true; throw Error(); },
  });
  for (const value of [null, {}, '', 'relative', 42, ...(process.platform === 'win32' ? ['\\project', '/project'] : [])]) {
    await assert.rejects(service.pin(value), { code: 'INVALID_ARGUMENT' });
  }
  for (const revision of ['', '-h', '--output=evil', null, 42, 'HEAD\0', '\uD800']) {
    await assert.rejects(service.pin(mapping.projectRoot, revision), { code: 'INVALID_ARGUMENT' });
  }
  const fixed = { ...mapping, commit };
  for (const value of ['', '.', '..', '../x', 'x/../a', 'x//a', '/etc/x', 'C:/x', 'x\\a', '.git/config', 'x/.GIT/a', 'x\0a', ':glob:*', '\uD800']) {
    await assert.rejects(service.read(fixed, value), { code: 'INVALID_PATH' });
  }
  for (const value of [null, {}, { ...fixed, commit: 'HEAD' }, { ...fixed, projectPrefix: '../x' }, { ...fixed, repositoryRoot: null }]) {
    await assert.rejects(service.read(value, 'a.ts'), { code: 'INVALID_ARGUMENT' });
  }
  assert.equal(called, false);
  assert.ok(new SourceError('INVALID_PATH', '路径错误', '检查路径') instanceof Error);
});

test('伪造映射被拒绝，完整 SHA256 依据可复用', async () => {
  const service = new FixedSourceService({
    async locate() { return mapping; },
    async resolveCommit() { return commit; },
    async readFile(source) { return source; },
  });
  await assert.rejects(service.read({ ...mapping, projectPrefix: 'other', commit }, 'a.ts'), { code: 'INVALID_ARGUMENT' });
  assert.equal((await service.read({ ...mapping, commit: 'b'.repeat(64) }, 'a.ts')).commit.length, 64);
});
