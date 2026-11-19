import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { git, initRepository, workspace } from '../fixtures/fixed-source.mjs';

const cli = path.join(workspace, 'dist/cli/main.js');
const tools = path.join(workspace, 'skills/aftertaste-reader/references/tools.md');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const projectPrefix = '包 空间/子 项目';
const smallPath = '唯 一 A.txt';
const largePath = '较大 文件.txt';
const smallText = '固定版本 A 的正文\r\n第二行\n';
const largeText = '中文\r\n"\\\t'.repeat(72_000);
const aPaths = ['根 A.txt', `${projectPrefix}/${smallPath}`, `${projectPrefix}/${largePath}`,
  `${projectPrefix}-相邻/邻居.txt`].sort();
const bPaths = ['根 B.txt', `${projectPrefix}/唯 一 B.txt`, `${projectPrefix}/${largePath}`,
  `${projectPrefix}-相邻/邻居.txt`].sort();

async function examples() {
  const markdown = await readFile(tools, 'utf8');
  const fixedSource = markdown.split(/^## 已有命令$/mu)[0];
  const blocks = [...fixedSource.matchAll(/^```javascript\r?\n([\s\S]*?)^```$/gmu)].map(match => match[1]);
  assert.equal(blocks.length, 3);
  const [pin, list, read] = blocks;
  // Inject only inputs and the in-memory observation points between the public steps.
  return new AsyncFunction('cli', 'projectRoot', 'revision', `
    ${pin}
    ${list}
    return { fixed, paths, sourceArgs, runCli, read: sourcePath => {
      ${read}
      return file;
    } };
  `);
}

async function writeFiles(repository, files) {
  for (const [name, body] of Object.entries(files)) {
    const filename = path.join(repository, name);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, body);
  }
  git(repository, ['add', '-A']);
}

function unisolatedTree(repository, commit) {
  return spawnSync('git', ['--no-pager', '--no-lazy-fetch', '-C', repository,
    'ls-tree', '-r', '-z', '--name-only', commit], { encoding: 'utf8', windowsHide: true });
}

test('按 Skill 原样执行 pin、固定树枚举和 read', async t => {
  const runs = path.join(workspace, '.local/D017');
  await mkdir(runs, { recursive: true });
  const run = await mkdtemp(path.join(runs, 'example-'));
  t.diagnostic(`合成样例 ${run}`);
  const repository = path.join(run, '合成 仓库');
  const foreign = path.join(run, '另一个 仓库');
  await initRepository(repository);
  await writeFiles(repository, {
    '根 A.txt': smallText,
    [`${projectPrefix}/${smallPath}`]: smallText,
    [`${projectPrefix}/${largePath}`]: largeText,
    [`${projectPrefix}-相邻/邻居.txt`]: '相似边界外\n',
  });
  git(repository, ['commit', '-m', 'synthetic A']);
  const a = git(repository, ['rev-parse', 'HEAD']);
  await unlink(path.join(repository, '根 A.txt'));
  await unlink(path.join(repository, projectPrefix, smallPath));
  await writeFiles(repository, { '根 B.txt': 'B only', [`${projectPrefix}/唯 一 B.txt`]: 'B only' });
  git(repository, ['commit', '-m', 'synthetic B']);
  const b = git(repository, ['rev-parse', 'HEAD']);
  await initRepository(foreign);
  await writeFiles(foreign, { '外部仓库.txt': 'foreign' });
  git(foreign, ['commit', '-m', 'synthetic foreign']);
  const runExamples = await examples();
  const project = path.join(repository, projectPrefix);
  t.diagnostic(`提交 A ${a}，提交 B ${b}`);

  async function checkBothProjects() {
    for (const [root, expectedPrefix, expectedPaths, selection] of [
      [repository, '', aPaths, '根 A.txt'],
      [project, projectPrefix, [smallPath, largePath].sort(), smallPath],
    ]) {
      const { fixed, paths, read } = await runExamples(cli, root, a);
      assert.equal(fixed.projectPrefix, expectedPrefix);
      assert.equal(fixed.repositoryRoot, repository);
      assert.deepEqual([...paths].sort(), expectedPaths);
      const file = read(paths.find(name => name === selection));
      assert.equal(file.path, selection);
      assert.equal(file.commit, a);
      assert.ok(file.content === smallText, '普通 UTF-8 正文须逐字一致');
    }
  }

  await t.test('启用 A → B 的对象替换，仍只枚举并读回 A', async () => {
    git(repository, ['replace', a, b]);
    try {
      const before = unisolatedTree(repository, a);
      assert.equal(before.status, 0);
      assert.deepEqual(before.stdout.split('\0').slice(0, -1).sort(), bPaths);
      await checkBothProjects();
    } finally {
      git(repository, ['replace', '-d', a]);
    }
  });

  await t.test('宿主 GIT_DIR 指向独立仓库，仍只枚举并读回 A', async () => {
    const previous = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(foreign, '.git');
    try {
      assert.equal(unisolatedTree(repository, a).status, 128);
      await checkBothProjects();
    } finally {
      if (previous === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = previous;
    }
  });

  await t.test('读取超过 1 MiB 的 JSON，源码完整，中断与命令失败仅给诊断', async t => {
    const { paths, read, sourceArgs, runCli } = await runExamples(cli, project, a);
    const selection = paths.find(name => name === largePath);
    const file = read(selection);
    assert.equal(file.path, largePath);
    assert.equal(file.repositoryPath, `${projectPrefix}/${largePath}`);
    assert.equal(file.commit, a);
    assert.ok(file.content === largeText, '大文件正文须逐字一致');
    const bytes = Buffer.byteLength(file.content);
    const jsonBytes = Buffer.byteLength(`${JSON.stringify({ ok: true, file })}\n`);
    const digest = createHash('sha256').update(file.content).digest('hex');
    assert.ok(bytes < 1024 * 1024 && jsonBytes > 1024 * 1024);
    t.diagnostic(`源码 ${bytes} B，CLI JSON ${jsonBytes} B，正文 SHA-256 ${digest}`);
    assert.throws(() => runCli(['read', ...sourceArgs, '--path', selection], 1024 * 1024), error =>
      error.code === 'ENOBUFS' && !('stdout' in error) && !('stderr' in error) && !('cause' in error));
    assert.throws(() => read('唯 一 B.txt'), error =>
      error.status === 1 && error.code === 'FILE_NOT_FOUND' && !('stdout' in error) && !('stderr' in error));
  });
});
