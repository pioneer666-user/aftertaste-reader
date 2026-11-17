import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { git, initRepository, workspace } from './fixed-source.mjs';

export const sourceText = 'const syntheticD008 = 1;\n\n// 合成尾行';
export const plan = [{ lines: { start: 1, end: 1 } }, {}, { lines: { start: 2, end: 3 } }];
export const documentPath = 'docs/aftertaste/current/a.ts.md';

export async function createDocumentFixture() {
  const sandbox = path.join(workspace, '.local/D008');
  await mkdir(sandbox, { recursive: true });
  const runRoot = await mkdtemp(path.join(sandbox, 'run-'));
  const repositoryRoot = path.join(runRoot, '合成 仓库');
  const projectRoot = path.join(repositoryRoot, 'packages/小 项目');
  await initRepository(repositoryRoot);
  for (const [name, text] of [['a.ts', sourceText], ['nested/a.ts', sourceText], ['a.py', sourceText], ['empty.ts', '']]) {
    const target = path.join(projectRoot, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
  }
  git(repositoryRoot, ['add', '.']);
  git(repositoryRoot, ['commit', '-m', 'synthetic D008 A']);
  const commit = git(repositoryRoot, ['rev-parse', 'HEAD']);
  return { runRoot, projectRoot, repositoryRoot, projectPrefix: 'packages/小 项目', commit };
}

export function cli(fixture, command, options = {}, cwd = workspace) {
  const argv = [path.join(workspace, 'dist/cli/main.js'), command];
  const values = { project: fixture.projectRoot, repository: fixture.repositoryRoot,
    prefix: fixture.projectPrefix, ...options };
  for (const [key, value] of Object.entries(values)) argv.push(`--${key}`, value);
  const result = spawnSync(process.execPath, argv, { cwd, encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr,
    json: JSON.parse(result.stdout || result.stderr) };
}

export async function demo() {
  const f = await createDocumentFixture();
  const pin = JSON.parse(execFileSync(process.execPath, [path.join(workspace, 'dist/cli/main.js'),
    'pin', '--project', f.projectRoot, '--revision', f.commit], { encoding: 'utf8', windowsHide: true }));
  assert.equal(pin.source.commit, f.commit);
  const created = cli(f, 'create-document', { commit: f.commit, path: 'a.ts', blocks: JSON.stringify(plan) }, f.runRoot);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(created.json.result.contentStatus, 'unfilled');
  const target = path.join(f.projectRoot, documentPath);
  const raw = await readFile(target, 'utf8');
  await writeFile(target, raw.replaceAll('\n\n<!-- aftertaste:end -->', '\n合成讲解正文。\n<!-- aftertaste:end -->'));
  const filled = cli(f, 'validate-document', { document: documentPath });
  assert.equal(filled.status, 0, filled.stdout + filled.stderr);
  assert.equal(filled.json.result.contentStatus, 'provided');
  await writeFile(path.join(f.projectRoot, 'a.ts'), 'B\n');
  git(f.repositoryRoot, ['add', 'packages/小 项目/a.ts']);
  git(f.repositoryRoot, ['commit', '-m', 'synthetic D008 B']);
  await writeFile(path.join(f.projectRoot, 'a.ts'), 'dirty\n');
  const afterChange = cli(f, 'validate-document', { document: documentPath }, f.runRoot);
  assert.equal(afterChange.status, 0);
  assert.equal(afterChange.json.result.commit, f.commit);
  console.log(JSON.stringify({ ...f, generated: created.json.generated,
    skeleton: created.json.result.contentStatus, filled: filled.json.result.contentStatus,
    afterChange: afterChange.json.result.mechanicallyValid,
    ids: afterChange.json.result.blocks.map(block => block.id) }));
}

if (process.argv.includes('--demo') && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await demo();
