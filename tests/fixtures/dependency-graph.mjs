import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, initRepository, workspace } from './fixed-source.mjs';

export const graphPath = 'docs/aftertaste/dependency-graph.json';
export const updateFormat = 'aftertaste-dependency-update/v1';
export const graphFormat = 'aftertaste-dependency-graph/v1';
export const sourceText = '// SYNTHETIC_D009_SOURCE\nexport const example = 1;\n';
export const update = actions => ({ format: updateFormat, ...actions });
export const review = (filePath, dependencies = []) => ({ path: filePath, analysis: 'reviewed',
  dependencies: dependencies.map(filePath => ({ path: filePath, reason: `合成关系：使用 ${filePath}` })) });

export async function createGraphFixture() {
  const sandbox = path.join(workspace, '.local/D009');
  await mkdir(sandbox, { recursive: true });
  const runRoot = await mkdtemp(path.join(sandbox, 'run-'));
  const repositoryRoot = path.join(runRoot, '合成 仓库');
  const projectPrefix = 'packages/小 项目';
  const projectRoot = path.join(repositoryRoot, projectPrefix);
  await initRepository(repositoryRoot);
  await mkdir(projectRoot, { recursive: true });
  for (const name of ['schema.ts', 'service.ts', 'router.ts', 'old_repo.ts', 'new_repo.ts', 'other.ts', '[x].ts']) {
    await writeFile(path.join(projectRoot, name), sourceText);
  }
  await writeFile(path.join(projectRoot, 'empty.ts'), '');
  await writeFile(path.join(repositoryRoot, 'outside.ts'), sourceText);
  git(repositoryRoot, ['add', '.']);
  const blob = git(repositoryRoot, ['hash-object', '-w', '--stdin'], 'schema.ts');
  git(repositoryRoot, ['update-index', '--add', '--cacheinfo', `120000,${blob},${projectPrefix}/link`]);
  git(repositoryRoot, ['commit', '-m', 'synthetic D009 A']);
  const commit = git(repositoryRoot, ['rev-parse', 'HEAD']);
  return { runRoot, repositoryRoot, projectRoot, projectPrefix, commit };
}

export async function inputFile(fixture, value, name = 'input.json') {
  const target = path.join(fixture.runRoot, name);
  await writeFile(target, JSON.stringify(value, null, 2));
  return target;
}

export function cli(fixture, command, options = {}, cwd = fixture.runRoot) {
  const values = { project: fixture.projectRoot, repository: fixture.repositoryRoot,
    prefix: fixture.projectPrefix, commit: fixture.commit, ...options };
  const args = [path.join(workspace, 'dist/cli/main.js'), command];
  for (const [key, value] of Object.entries(values)) if (value !== undefined) args.push(`--${key}`, value);
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr,
    json: JSON.parse(result.stdout || result.stderr) };
}

export async function demo() {
  const f = await createGraphFixture();
  const steps = [];
  const run = (name, command, options, expected) => {
    const result = cli(f, command, options);
    assert.equal(result.status, expected, JSON.stringify(result));
    steps.push({ name, status: result.status, ok: result.json.ok,
      ...(result.json.error ? { code: result.json.error.code, context: result.json.error.context } : {}) });
    return result;
  };
  const target = path.join(f.projectRoot, graphPath);
  run('首次登记', 'apply-graph', { input: await inputFile(f, update({ register: ['schema.ts', 'service.ts', 'router.ts'] })) }, 0);
  run('完整依赖', 'apply-graph', { input: await inputFile(f, update({ reviews: [review('service.ts', ['schema.ts', 'old_repo.ts']), review('router.ts', ['service.ts'])] })) }, 0);
  const revision = await inputFile(f, update({ reviews: [review('service.ts', ['schema.ts', 'new_repo.ts'])] }));
  run('局部替换', 'apply-graph', { input: revision }, 0);
  const beforeRepeat = await readFile(target, 'utf8');
  run('重复提交', 'apply-graph', { input: revision }, 0);
  assert.equal(await readFile(target, 'utf8'), beforeRepeat);
  run('明确删除', 'apply-graph', { input: await inputFile(f, update({ remove: ['schema.ts'] })) }, 0);
  const beforeInvalid = await readFile(target, 'utf8');
  const badInput = await inputFile(f, update({ reviews: [{ path: 'service.ts', dependencies: [] }] }));
  run('非法输入', 'apply-graph', { input: badInput }, 2);
  assert.equal(await readFile(target, 'utf8'), beforeInvalid);
  if (process.platform === 'win32') {
    const next = await inputFile(f, update({ reviews: [review('service.ts')] }));
    await chmod(target, 0o444);
    try { run('只读目标替换失败', 'apply-graph', { input: next }, 1); }
    finally { await chmod(target, 0o666); }
    assert.equal(await readFile(target, 'utf8'), beforeInvalid);
  }
  run('独立检查', 'validate-graph', {}, 0);
  const queried = run('查询删除影响', 'query-graph', { path: 'service.ts' }, 0);
  assert.equal(queried.json.result.analysis, 'unreviewed');
  console.log(JSON.stringify({ ...f, steps, graph: JSON.parse(await readFile(target, 'utf8')) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--demo')) await demo();
