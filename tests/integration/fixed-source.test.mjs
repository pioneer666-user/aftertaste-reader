import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FixedSourceService } from '../../dist/application/fixed-source.js';
import { GitSourceRepository } from '../../dist/adapters/git-source.js';
import { createFixture, git, initRepository, newSandbox, workspace } from '../fixtures/fixed-source.mjs';

const service = new FixedSourceService(new GitSourceRepository());

test('固定 A 后仍读取原文，允许 HEAD、历史、分叉及根项目', async () => {
  const fixture = await createFixture();
  const { projectRoot, repositoryRoot, commitA, commitB, forkCommit, texts } = fixture;
  assert.equal((await service.pin(projectRoot)).commit, commitB);
  const fixed = await service.pin(projectRoot, commitA);
  for (const [filePath, text] of texts) {
    const file = await service.read(fixed, filePath);
    assert.equal(file.content, text);
    assert.equal(file.commit, commitA);
    assert.equal(file.repositoryPath, `packages/小 项目/${filePath}`);
    assert.deepEqual(Buffer.from(file.content, 'utf8'), Buffer.from(text, 'utf8'));
  }
  const fork = await service.pin(projectRoot, forkCommit);
  assert.equal((await service.read(fork, 'other.ts')).content, 'A\n');
  const root = await service.pin(repositoryRoot, commitA);
  assert.equal(root.projectPrefix, '');
  assert.equal((await service.read(root, 'outside.ts')).content, 'outside project');
});

const cliFile = path.join(workspace, 'dist/cli/main.js');

function cli(args, cwd = workspace, extraEnv = {}) {
  const result = spawnSync(process.execPath, [cliFile, ...args], {
    cwd, env: { ...process.env, ...extraEnv }, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.error, undefined);
  return result;
}

async function snapshot(root) {
  const entries = {};
  async function walk(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const file = path.join(directory, name);
      const stat = await lstat(file);
      const key = path.relative(root, file);
      if (stat.isSymbolicLink()) entries[key] = await readlink(file);
      else if (stat.isDirectory()) { entries[key] = 'directory'; await walk(file); }
      else entries[key] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
  }
  await walk(root);
  return entries;
}

test('pin 在 A 固定一次，产生 B 并删除工作文件后依据保持 A', async () => {
  const root = await newSandbox();
  await initRepository(root);
  await writeFile(path.join(root, 'one.ts'), 'one A');
  await writeFile(path.join(root, 'two.ts'), 'two A');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'A']);
  const fixed = await service.pin(root);
  await writeFile(path.join(root, 'one.ts'), 'one B');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'B']);
  await unlink(path.join(root, 'two.ts'));
  assert.notEqual(git(root, ['rev-parse', 'HEAD']), fixed.commit);
  assert.equal((await service.read(fixed, 'one.ts')).content, 'one A');
  assert.equal((await service.read(fixed, 'two.ts')).content, 'two A');
});

test('真实 CLI 从不同 cwd 读特殊路径，成功与诊断通道分明', async () => {
  const f = await createFixture();
  for (const cwd of [workspace, f.runRoot]) {
    const pinned = cli(['pin', '--project', f.projectRoot, '--revision', f.commitA], cwd);
    assert.equal(pinned.status, 0, pinned.stderr);
    assert.equal(pinned.stderr, '');
    assert.equal(JSON.parse(pinned.stdout).source.commit, f.commitA);
    for (const name of ['中文 空格/[x].ts', '-n.ts', 'cash$.ts', 'empty.ts']) {
      const result = cli(['read', '--project', f.projectRoot, '--commit', f.commitA, '--path', name], cwd);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.equal(JSON.parse(result.stdout).file.content, f.texts.get(name));
    }
  }
  for (const args of [[], ['pin'], ['pin', '--project', f.projectRoot, '--project', f.projectRoot],
    ['pin', '--project', f.projectRoot, '--revision', '--output=side-effect'],
    ['read', '--project', f.projectRoot, '--commit', 'HEAD', '--path', 'other.ts'],
    ['read', '--project', f.projectRoot, '--commit', f.commitA, '--path', '../outside.ts'],
    ['read', '--project', f.projectRoot, '--commit', f.commitA, '--path', 'other.ts', '--unknown', 'x']]) {
    const result = cli(args);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.ok(['INVALID_ARGUMENT', 'INVALID_PATH'].includes(JSON.parse(result.stderr).error.code));
  }
});

test('类型、编码和缺失路径失败准确，成功失败均无目标写入', async () => {
  const f = await createFixture();
  const fixed = await service.pin(f.projectRoot, f.commitB);
  const before = await snapshot(f.repositoryRoot);
  for (const [filePath, code] of [
    ['missing.ts', 'FILE_NOT_FOUND'], ['link', 'UNSUPPORTED_FILE_TYPE'],
    ['link/a.ts', 'UNSUPPORTED_FILE_TYPE'], ['module/a.ts', 'UNSUPPORTED_FILE_TYPE'],
    ['module', 'UNSUPPORTED_FILE_TYPE'], ['中文 空格', 'UNSUPPORTED_FILE_TYPE'],
    ['binary.bin', 'UNSUPPORTED_ENCODING'], ['invalid.txt', 'UNSUPPORTED_ENCODING'], ['utf16.txt', 'UNSUPPORTED_ENCODING'],
  ]) {
    await assert.rejects(service.read(fixed, filePath), { code });
    const result = cli(['read', '--project', f.projectRoot, '--commit', f.commitB, '--path', filePath]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    const error = JSON.parse(result.stderr).error;
    assert.equal(error.code, code);
    assert.equal(error.context.commit, f.commitB);
    assert.equal(error.context.path, filePath);
    assert.ok(error.nextStep);
    assert.equal(result.stderr.includes('export const'), false);
  }
  await service.read(fixed, 'other.ts');
  await assert.rejects(service.read(fixed, '../outside.ts'), { code: 'INVALID_PATH' });
  assert.deepEqual(await snapshot(f.repositoryRoot), before);
});

test('定位失败、无提交、无效版本、Git 不可用与读取失败', async () => {
  const root = await newSandbox();
  await assert.rejects(service.pin(path.join(root, 'missing')), { code: 'PROJECT_UNAVAILABLE' });
  await assert.rejects(service.pin(path.parse(root).root), { code: 'NOT_REPOSITORY' });
  await initRepository(root);
  await assert.rejects(service.pin(root), { code: 'NO_COMMIT' });
  await assert.rejects(service.pin(root, 'does-not-exist'), { code: 'INVALID_REVISION' });
  const unavailable = cli(['pin', '--project', root], workspace, { PATH: '' });
  assert.equal(unavailable.status, 1);
  assert.equal(JSON.parse(unavailable.stderr).error.code, 'GIT_UNAVAILABLE');
  await writeFile(path.join(root, '.git/config'), '[invalid configuration');
  await assert.rejects(service.pin(root), { code: 'GIT_READ_FAILED' });
});

test('缺失提交对象与缺失 blob 区分，失败无回退', async () => {
  const f = await createFixture();
  const fixed = await service.pin(f.projectRoot, f.commitA);
  const blob = git(f.repositoryRoot, ['rev-parse', `${f.commitA}:packages/小 项目/other.ts`]);
  const origin = path.join(f.runRoot, 'promisor-origin.git');
  git(f.runRoot, ['clone', '--bare', '--no-hardlinks', f.repositoryRoot, origin]);
  git(f.repositoryRoot, ['config', 'extensions.partialClone', 'origin']);
  git(f.repositoryRoot, ['config', 'remote.origin.promisor', 'true']);
  git(f.repositoryRoot, ['config', 'remote.origin.url', origin]);
  await unlink(path.join(f.repositoryRoot, '.git/objects', blob.slice(0, 2), blob.slice(2)));
  const before = await snapshot(f.repositoryRoot);
  await assert.rejects(service.read(fixed, 'other.ts'), { code: 'GIT_READ_FAILED' });
  const failedBlob = cli(['read', '--project', f.projectRoot, '--commit', f.commitA, '--path', 'other.ts']);
  assert.equal(JSON.parse(failedBlob.stderr).error.code, 'GIT_READ_FAILED');
  assert.deepEqual(await snapshot(f.repositoryRoot), before);
  await unlink(path.join(f.repositoryRoot, '.git/objects', f.commitA.slice(0, 2), f.commitA.slice(2)));
  await assert.rejects(service.read(fixed, 'other.ts'), { code: 'OBJECT_UNAVAILABLE' });
  const failedCommit = cli(['read', '--project', f.projectRoot, '--commit', f.commitA, '--path', 'other.ts']);
  assert.equal(JSON.parse(failedCommit.stderr).error.code, 'OBJECT_UNAVAILABLE');
});

test('Git 环境与 replace 不改变固定依据，也不产生 trace 日志', async () => {
  const f = await createFixture();
  await assert.rejects(service.pin(path.join(f.repositoryRoot, '.git')), { code: 'UNSUPPORTED_TARGET' });
  git(f.repositoryRoot, ['replace', f.commitA, f.commitB]);
  const trace = path.join(f.runRoot, 'trace.log');
  const before = await snapshot(f.repositoryRoot);
  const result = cli(['read', '--project', f.projectRoot, '--commit', f.commitA, '--path', 'other.ts'], workspace, {
    GIT_DIR: path.join(f.runRoot, 'wrong'), GIT_WORK_TREE: f.runRoot,
    GIT_TRACE: trace, GIT_NO_REPLACE_OBJECTS: '0', GIT_NO_LAZY_FETCH: '0',
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.bare', GIT_CONFIG_VALUE_0: 'true',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).file.content, 'A\n');
  await assert.rejects(lstat(trace), { code: 'ENOENT' });
  assert.deepEqual(await snapshot(f.repositoryRoot), before);
});

test('链接项目、git 文件目标、子模块目录和 bare 有明确诊断', async () => {
  const f = await createFixture();
  const linked = path.join(f.runRoot, 'junction');
  await symlink(f.projectRoot, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(service.pin(linked), { code: 'UNSUPPORTED_TARGET' });
  const worktree = path.join(f.runRoot, 'worktree');
  git(f.repositoryRoot, ['worktree', 'add', '--detach', worktree, f.commitA]);
  await assert.rejects(service.pin(worktree), { code: 'UNSUPPORTED_TARGET' });
  const moduleRoot = path.join(f.projectRoot, 'module');
  await mkdir(moduleRoot);
  await writeFile(path.join(moduleRoot, '.git'), 'gitdir: ../../.git/modules/example');
  await assert.rejects(service.pin(moduleRoot), { code: 'UNSUPPORTED_TARGET' });
  const bare = path.join(f.runRoot, 'bare.git');
  await mkdir(bare);
  git(bare, ['init', '--bare']);
  await assert.rejects(service.pin(bare), { code: 'UNSUPPORTED_TARGET' });
});

test('SHA256 仓库与提交树字面特殊路径', async () => {
  const root = await newSandbox();
  git(root, ['init', '--object-format=sha256', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Synthetic']);
  git(root, ['config', 'user.email', 'synthetic@example.invalid']);
  await writeFile(path.join(root, '[literal].ts'), 'sha256');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'sha256']);
  const fixed = await service.pin(root);
  assert.equal(fixed.commit.length, 64);
  assert.equal((await service.read(fixed, '[literal].ts')).content, 'sha256');
});

test('CLI 在定位前拒绝越界，定位失败保留读取依据', async () => {
  const root = await newSandbox();
  const commit = 'a'.repeat(40);
  const invalid = cli(['read', '--project', root, '--commit', commit, '--path', '../outside.ts'], workspace, { PATH: '' });
  assert.equal(invalid.status, 2);
  const invalidProblem = JSON.parse(invalid.stderr).error;
  assert.equal(invalidProblem.code, 'INVALID_PATH');
  assert.equal(invalidProblem.context.commit, commit);
  assert.equal(invalidProblem.context.path, '../outside.ts');
  const projectRoot = path.join(root, 'missing');
  const missing = cli(['read', '--project', projectRoot, '--commit', commit, '--path', 'a.ts']);
  assert.equal(missing.status, 1);
  assert.deepEqual(JSON.parse(missing.stderr).error.context, { projectRoot, commit, path: 'a.ts' });
});

test('Windows 无盘符根路径从不同 cwd 均在定位前拒绝', { skip: process.platform !== 'win32' }, async () => {
  const f = await createFixture();
  const driveLess = f.projectRoot.slice(2);
  for (const cwd of [f.runRoot, path.parse(process.execPath).root]) {
    const pinned = cli(['pin', '--project', driveLess], cwd, { PATH: '' });
    assert.equal(pinned.status, 2);
    assert.equal(JSON.parse(pinned.stderr).error.code, 'INVALID_ARGUMENT');
    const read = cli(['read', '--project', driveLess, '--commit', f.commitA, '--path', 'other.ts'], cwd, { PATH: '' });
    assert.equal(read.status, 2);
    assert.equal(JSON.parse(read.stderr).error.code, 'INVALID_ARGUMENT');
    const absolute = cli(['pin', '--project', f.projectRoot, '--revision', f.commitA], cwd);
    assert.equal(absolute.status, 0, absolute.stderr);
    assert.equal(JSON.parse(absolute.stdout).source.projectRoot, f.projectRoot);
    const absoluteRead = cli(['read', '--project', f.projectRoot, '--commit', f.commitA, '--path', 'other.ts'], cwd);
    assert.equal(absoluteRead.status, 0, absoluteRead.stderr);
    assert.equal(JSON.parse(absoluteRead.stdout).file.content, 'A\n');
  }
});
