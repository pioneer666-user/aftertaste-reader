import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, readlink, rename, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FixedSourceService } from '../../dist/application/fixed-source.js';
import { GitSourceRepository } from '../../dist/adapters/git-source.js';
import { createFixture, git, initRepository, newExternalSandbox, newSandbox, workspace } from '../fixtures/fixed-source.mjs';

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
  const result = cli(['read', '--project', root, '--commit', fixed.commit, '--path', '[literal].ts']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).file.commit, fixed.commit);
  const alias = 'a'.repeat(40);
  git(root, ['update-ref', `refs/heads/${alias}`, fixed.commit]);
  assert.equal((await service.pin(root, alias)).commit, fixed.commit);
  await assert.rejects(service.read({ ...fixed, commit: alias }, '[literal].ts'), {
    code: 'INVALID_ARGUMENT',
  });
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
  for (const cwd of [f.runRoot, path.parse(process.env.SystemRoot ?? process.execPath).root]) {
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

test('D007 H01 形似完整提交的移动分支不能冒充固定身份', async t => {
  const f = await createFixture();
  const fixed = await service.pin(f.projectRoot, f.commitA);
  const alias = 'a'.repeat(64);
  const outcomes = [];
  for (const commit of [f.commitA, f.commitB]) {
    git(f.repositoryRoot, ['update-ref', `refs/heads/${alias}`, commit]);
    assert.equal((await service.pin(f.projectRoot, alias)).commit, commit);
    let serviceResult;
    try {
      serviceResult = { content: (await service.read({ ...fixed, commit: alias }, 'other.ts')).content };
    } catch (error) {
      serviceResult = { code: error.code, reason: error.context?.reason };
    }
    const result = cli(['read', '--project', f.projectRoot, '--commit', alias, '--path', 'other.ts']);
    const cliResult = JSON.parse(result.status === 0 ? result.stdout : result.stderr);
    outcomes.push({ serviceResult, status: result.status, cliCode: cliResult.error?.code,
      cliReason: cliResult.error?.context.reason, cliContent: cliResult.file?.content });
  }
  t.diagnostic(JSON.stringify(outcomes));
  for (const outcome of outcomes) {
    assert.deepEqual(outcome.serviceResult, { code: 'INVALID_ARGUMENT', reason: 'COMMIT_ID_MISMATCH' });
    assert.equal(outcome.status, 2);
    assert.equal(outcome.cliCode, 'INVALID_ARGUMENT');
    assert.equal(outcome.cliReason, 'COMMIT_ID_MISMATCH');
  }
  assert.equal((await service.read(fixed, 'other.ts')).content, 'A\n');
});

test('D007 H02 整个当前子项目消失后原固定引用和 CLI 仍可读', async t => {
  const f = await createFixture();
  const pinned = cli(['pin', '--project', f.projectRoot, '--revision', f.commitA]);
  assert.equal(pinned.status, 0, pinned.stderr);
  const fixed = JSON.parse(pinned.stdout).source;
  await rename(f.projectRoot, path.join(f.runRoot, 'removed-project'));
  assert.equal(git(f.repositoryRoot, ['cat-file', '-t', f.commitA]), 'commit');
  const before = await snapshot(f.repositoryRoot);
  const outcomes = [];
  try {
    outcomes.push({ content: (await service.read(fixed, 'other.ts')).content });
  } catch (error) {
    outcomes.push({ code: error.code });
  }
  for (const cwd of [workspace, f.runRoot]) {
    const result = cli(['read', '--project', fixed.projectRoot, '--repository', fixed.repositoryRoot,
      '--prefix', fixed.projectPrefix, '--commit', fixed.commit, '--path', 'other.ts'], cwd);
    const body = JSON.parse(result.status === 0 ? result.stdout : result.stderr);
    outcomes.push({ status: result.status, content: body.file?.content, code: body.error?.code });
  }
  t.diagnostic(JSON.stringify(outcomes));
  assert.deepEqual(outcomes, [{ content: 'A\n' }, { status: 0, content: 'A\n', code: undefined },
    { status: 0, content: 'A\n', code: undefined }]);
  assert.deepEqual(await snapshot(f.repositoryRoot), before);
});

test('D007 H03 独立 bare 与普通非仓库诊断不同', async t => {
  const root = await newExternalSandbox(t);
  await assert.rejects(service.pin(root), { code: 'NOT_REPOSITORY' });
  const ordinary = cli(['pin', '--project', root]);
  assert.equal(JSON.parse(ordinary.stderr).error.code, 'NOT_REPOSITORY');
  git(root, ['init', '--bare']);
  assert.equal(git(root, ['rev-parse', '--is-bare-repository']), 'true');
  const result = cli(['pin', '--project', root]);
  t.diagnostic(result.stderr.trim());
  assert.equal(JSON.parse(result.stderr).error.code, 'UNSUPPORTED_TARGET');
  assert.equal(JSON.parse(result.stderr).error.context.reason, 'BARE_REPOSITORY');
  await assert.rejects(service.pin(root), { code: 'UNSUPPORTED_TARGET', context: {
    projectRoot: root, reason: 'BARE_REPOSITORY',
  } });
});

test('D007 历史固定映射拒绝篡改、元数据及提交树链接/gitlink', async () => {
  const f = await createFixture();
  const fixed = await service.pin(f.projectRoot, f.commitB);
  await rename(f.projectRoot, path.join(f.runRoot, 'removed-project'));
  const before = await snapshot(f.repositoryRoot);
  for (const changed of [
    { projectPrefix: 'packages/other' }, { projectRoot: f.repositoryRoot },
    { projectPrefix: '../outside' }, { projectPrefix: 'packages//小 项目' },
    { projectPrefix: '.git' }, { projectPrefix: 'packages/.GIT' },
    { projectPrefix: '/absolute' }, { projectPrefix: 'C:/outside' },
    { repositoryRoot: path.join(f.repositoryRoot, 'packages'), projectPrefix: '小 项目' },
  ]) {
    const forged = { ...fixed, ...changed };
    await assert.rejects(service.read(forged, 'other.ts'), { code: 'INVALID_ARGUMENT' });
    const result = cli(['read', '--project', forged.projectRoot, '--repository', forged.repositoryRoot,
      '--prefix', forged.projectPrefix, '--commit', forged.commit, '--path', 'other.ts']);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).error.code, 'INVALID_ARGUMENT');
  }
  for (const prefix of [`${fixed.projectPrefix}/link`, `${fixed.projectPrefix}/module`]) {
    const forged = { ...fixed, projectRoot: path.join(f.repositoryRoot, prefix), projectPrefix: prefix };
    await assert.rejects(service.read(forged, 'a.ts'), { code: 'UNSUPPORTED_FILE_TYPE' });
    const result = cli(['read', '--project', forged.projectRoot, '--repository', forged.repositoryRoot,
      '--prefix', prefix, '--commit', fixed.commit, '--path', 'a.ts']);
    assert.equal(JSON.parse(result.stderr).error.code, 'UNSUPPORTED_FILE_TYPE');
  }
  for (const [filePath, code] of [['../outside.ts', 'INVALID_PATH'], ['.git/config', 'INVALID_PATH'],
    ['module/a.ts', 'UNSUPPORTED_FILE_TYPE'], ['link/a.ts', 'UNSUPPORTED_FILE_TYPE']]) {
    await assert.rejects(service.read(fixed, filePath), { code });
  }
  assert.deepEqual(await snapshot(f.repositoryRoot), before);
  await symlink(path.join(f.runRoot, 'removed-project'), f.projectRoot, process.platform === 'win32' ? 'junction' : 'dir');
  const linkedBefore = await snapshot(f.repositoryRoot);
  assert.equal((await service.read(fixed, 'other.ts')).content, 'B\n');
  const linkedRead = cli(['read', '--project', fixed.projectRoot, '--repository', fixed.repositoryRoot,
    '--prefix', fixed.projectPrefix, '--commit', fixed.commit, '--path', 'other.ts']);
  assert.equal(linkedRead.status, 0, linkedRead.stderr);
  assert.equal(JSON.parse(linkedRead.stdout).file.content, 'B\n');
  await assert.rejects(service.pin(f.projectRoot), { code: 'UNSUPPORTED_TARGET' });
  assert.deepEqual(await snapshot(f.repositoryRoot), linkedBefore);
});

test('D007 完整映射参数成对校验、根项目前缀为空且前置拒绝路径', async () => {
  const f = await createFixture();
  const pinned = await service.pin(f.repositoryRoot, f.commitA);
  const rootRead = cli(['read', '--project', pinned.projectRoot, '--repository', pinned.repositoryRoot,
    '--prefix', '', '--commit', pinned.commit, '--path', 'outside.ts']);
  assert.equal(rootRead.status, 0, rootRead.stderr);
  assert.equal(JSON.parse(rootRead.stdout).file.content, 'outside project');
  const base = ['read', '--project', f.projectRoot, '--commit', f.commitA, '--path', 'other.ts'];
  for (const args of [[...base, '--repository', f.repositoryRoot], [...base, '--prefix', 'packages/小 项目']]) {
    const result = cli(args, workspace, { PATH: '' });
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stderr).error.context.reason, 'INCOMPLETE_MAPPING');
  }
  const invalid = cli(['read', '--project', f.projectRoot, '--repository', f.repositoryRoot,
    '--prefix', 'packages/other', '--commit', f.commitA, '--path', 'other.ts'], workspace, { PATH: '' });
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stderr).error.context.reason, 'MAPPING_MISMATCH');
  const outside = cli(['read', '--project', f.projectRoot, '--repository', f.repositoryRoot,
    '--prefix', 'packages/小 项目', '--commit', f.commitA, '--path', '../outside.ts'], workspace, { PATH: '' });
  assert.equal(outside.status, 2);
  assert.equal(JSON.parse(outside.stderr).error.code, 'INVALID_PATH');
});

test('D007 历史映射的原仓库或提交确实不可用时准确失败', async () => {
  const f = await createFixture();
  const fixed = await service.pin(f.projectRoot, f.commitA);
  await rename(f.projectRoot, path.join(f.runRoot, 'removed-project'));
  await unlink(path.join(f.repositoryRoot, '.git/objects', f.commitA.slice(0, 2), f.commitA.slice(2)));
  await assert.rejects(service.read(fixed, 'other.ts'), { code: 'OBJECT_UNAVAILABLE' });
  const unavailable = cli(['read', '--project', fixed.projectRoot, '--repository', fixed.repositoryRoot,
    '--prefix', fixed.projectPrefix, '--commit', fixed.commit, '--path', 'other.ts']);
  assert.equal(unavailable.status, 1);
  assert.equal(JSON.parse(unavailable.stderr).error.code, 'OBJECT_UNAVAILABLE');
  await rename(f.repositoryRoot, path.join(f.runRoot, 'removed-repository'));
  await assert.rejects(service.read(fixed, 'other.ts'), { code: 'PROJECT_UNAVAILABLE' });
  const missing = cli(['read', '--project', fixed.projectRoot, '--repository', fixed.repositoryRoot,
    '--prefix', fixed.projectPrefix, '--commit', fixed.commit, '--path', 'other.ts']);
  assert.equal(missing.status, 1);
  const problem = JSON.parse(missing.stderr).error;
  assert.equal(problem.code, 'PROJECT_UNAVAILABLE');
  assert.equal(problem.context.repositoryRoot, fixed.repositoryRoot);
  assert.equal(problem.context.projectRoot, fixed.projectRoot);
  assert.equal(problem.context.repositoryPath, `${fixed.projectPrefix}/other.ts`);
  assert.equal(problem.context.commit, fixed.commit);
  assert.equal(problem.context.path, 'other.ts');
});
