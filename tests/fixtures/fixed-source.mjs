import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspace = fileURLToPath(new URL('../../', import.meta.url));
export const sandbox = path.join(workspace, '.local/D007');

export function git(cwd, args, input) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
  return execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', '-C', cwd, ...args], {
    env: { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' },
    input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

export async function newSandbox() {
  await mkdir(sandbox, { recursive: true });
  return mkdtemp(path.join(sandbox, 'run-'));
}

export async function newExternalSandbox(t) {
  const temporaryRoot = await realpath(tmpdir());
  const root = await mkdtemp(path.join(temporaryRoot, 'aftertaste-D007-'));
  assert.equal(path.dirname(root), temporaryRoot);
  assert.throws(() => git(root, ['rev-parse', '--show-toplevel']));
  t.diagnostic(`独立临时样例 ${root}`);
  t.after(async () => {
    assert.equal(path.dirname(await realpath(root)), temporaryRoot);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

export async function initRepository(root) {
  await mkdir(root, { recursive: true });
  git(root, ['init', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Synthetic D006']);
  git(root, ['config', 'user.email', 'd006@example.invalid']);
}

export async function createFixture() {
  const runRoot = await newSandbox();
  const repositoryRoot = path.join(runRoot, '合成 仓库');
  const projectRoot = path.join(repositoryRoot, 'packages/小 项目');
  await initRepository(repositoryRoot);
  const texts = new Map([
    ['中文 空格/[x].ts', 'export const 文字 = "A";\r\n\n// 尾行'],
    ['other.ts', 'A\n'], ['empty.ts', ''], ['bom.ts', '\uFEFFconst bom = true;\r'],
    ['-n.ts', 'literal -n'], ['cash$.ts', 'literal $'], ['replacement.ts', '\uFFFD'],
  ]);
  for (const [name, text] of texts) {
    const file = path.join(projectRoot, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
  await writeFile(path.join(repositoryRoot, 'outside.ts'), 'outside project');
  await writeFile(path.join(projectRoot, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
  await writeFile(path.join(projectRoot, 'invalid.txt'), Buffer.from([0xc0, 0xaf]));
  await writeFile(path.join(projectRoot, 'utf16.txt'), Buffer.from([0xff, 0xfe, 0x41, 0]));
  git(repositoryRoot, ['add', '.']);
  const linkBlob = git(repositoryRoot, ['hash-object', '-w', '--stdin'], '../outside.ts');
  git(repositoryRoot, ['update-index', '--add', '--cacheinfo', `120000,${linkBlob},packages/小 项目/link`]);
  git(repositoryRoot, ['commit', '-m', 'synthetic A']);
  const commitA = git(repositoryRoot, ['rev-parse', 'HEAD']);
  git(repositoryRoot, ['update-index', '--add', '--cacheinfo', `160000,${commitA},packages/小 项目/module`]);
  await writeFile(path.join(projectRoot, 'other.ts'), 'B\n');
  git(repositoryRoot, ['add', 'packages/小 项目/other.ts']);
  git(repositoryRoot, ['commit', '-m', 'synthetic B']);
  const commitB = git(repositoryRoot, ['rev-parse', 'HEAD']);
  const treeA = git(repositoryRoot, ['rev-parse', `${commitA}^{tree}`]);
  const forkCommit = git(repositoryRoot, ['commit-tree', treeA, '-p', commitA], 'synthetic fork');
  git(repositoryRoot, ['update-ref', 'refs/heads/fork', forkCommit]);
  await writeFile(path.join(projectRoot, 'other.ts'), 'dirty worktree');
  await unlink(path.join(projectRoot, '中文 空格/[x].ts'));
  return { runRoot, repositoryRoot, projectRoot, commitA, commitB, forkCommit, texts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { texts, ...fixture } = await createFixture();
  console.log(JSON.stringify(fixture));
}
