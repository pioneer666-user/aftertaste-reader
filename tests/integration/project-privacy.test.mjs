import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const defaultCli = fileURLToPath(new URL('../../dist/cli/main.js', import.meta.url));
const runRoot = fileURLToPath(new URL('../../.local/D057/', import.meta.url));
const docDir = 'docs/aftertaste/';
const current = docDir + 'current/';

test('project privacy uses Git index and live excludes, with repository and subproject grants', async () => {
  await mkdir(runRoot, { recursive: true });
  const run = await mkdtemp(path.join(runRoot, 'git-'));
  const repo = path.join(run, 'work tree');
  const project = path.join(repo, 'sub');
  const sibling = path.join(repo, 'other');
  const outside = path.join(run, 'profile');
  const global = path.join(outside, 'global.ignore');
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: path.join(outside, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', LOCALAPPDATA: outside, XDG_STATE_HOME: outside };
  await mkdir(path.join(project, current), { recursive: true });
  await mkdir(sibling);
  await mkdir(outside);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { env, encoding: 'utf8' });
  const cli = (where, action, input) => {
    const p = spawnSync(process.execPath, [process.env.AFTERTASTE_CLI ?? defaultCli, 'project-privacy', '--project', where, '--action', action],
      { env, input: JSON.stringify(input), encoding: 'utf8', windowsHide: true });
    const json = JSON.parse(p.status === 0 ? p.stdout : p.stderr);
    return { status: p.status, ...json };
  };
  const check = (where, files) => {
    const result = cli(where, 'check', files);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.result.files.map(file => [file.status, file.remembered]);
  };
  const tracked = current + '已有.ts.md';
  const exception = current + 'exception.ts.md';
  const first = current + 'first.ts.md';
  const globalFile = docDir + 'preferences.md';
  const localFile = docDir + 'reading-direction.md';
  git('init', '-q');
  git('config', '--global', 'core.excludesFile', global);
  await writeFile(global, 'preferences.md\n');
  await writeFile(path.join(project, current, '.gitignore'), 'ignored*.md\n!exception.ts.md\n已有.ts.md\n');
  await writeFile(path.join(project, tracked), '已暂存的资料');
  git('add', '-f', '--', 'sub/' + tracked);
  git('-c', 'user.name=Sandbox', '-c', 'user.email=sandbox@example.invalid', 'commit', '-qm', 'sample', '--allow-empty');
  await writeFile(path.join(project, current, 'staged.md'), '本批先暂存');
  git('add', '--', 'sub/' + current + 'staged.md');
  const exclude = path.join(repo, '.git/info/exclude');
  await writeFile(exclude, '# existing custom rule\n/sub/docs/aftertaste/reading-direction.md\nexception.ts.md\n');
  const index = await readFile(path.join(repo, '.git/index'));
  const head = git('rev-parse', 'HEAD');
  const initialExclude = await readFile(exclude);
  assert.deepEqual(check(project, [tracked, current + 'staged.md', first, exception, current + 'ignored-new.md', globalFile, localFile]),
    [['tracked', false], ['tracked', false], ['unignored', false], ['unignored', false],
      ['ignored', false], ['ignored', false], ['ignored', false]]);
  assert.deepEqual(await readFile(exclude), initialExclude);
  const state = path.join(outside, process.platform === 'win32' ? 'Aftertaste Reader/state' : 'aftertaste-reader');
  await assert.rejects(stat(state), { code: 'ENOENT' });
  const remember = cli(project, 'remember', [{ path: first, status: 'unignored' }]);
  assert.equal(remember.result.remembered, true);
  assert.deepEqual(check(project, [first, exception]), [['unignored', true], ['unignored', false]]);
  assert.deepEqual(check(sibling, [first]), [['unignored', false]]);
  assert.equal(cli(project, 'remember', [{ path: tracked, status: 'unignored' }]).error.context.reason, 'VISIBILITY_CHANGED');
  const ignored = cli(project, 'ignore', [first, exception, tracked]);
  assert.deepEqual(ignored.result.files.map(file => file.status), ['ignored', 'unignored', 'tracked']);
  assert.ok((await readFile(exclude)).subarray(0, initialExclude.length).equals(initialExclude));
  assert.doesNotMatch(await readFile(exclude, 'utf8'), /已有\.ts\.md/u);
  assert.deepEqual(await readFile(path.join(repo, '.git/index')), index);
  assert.equal(git('rev-parse', 'HEAD'), head);
  await writeFile(path.join(project, first), '新的资料');
  git('add', '-f', '--', 'sub/' + first);
  assert.deepEqual(check(project, [first]), [['tracked', false]]);
  assert.equal(cli(project, 'remember', [{ path: first, status: 'tracked' }]).result.remembered, true);
  assert.deepEqual(check(project, [first]), [['tracked', true]]);
  assert.equal(cli(project, 'forget').result.forgotten, true);
  assert.deepEqual(check(project, [first]), [['tracked', false]]);
  assert.equal(cli(project, 'check', ['../secret']).error.code, 'INVALID_ARGUMENT');
  await mkdir(path.join(project, docDir, 'other'));
  assert.equal(cli(project, 'check', [docDir + 'other']).error.context.reason, 'UNSAFE_PATH');
});
