import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdir, readFile, writeFile, readdir, symlink, rm, rmdir, link, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import * as application from '../../dist/application/dependency-graph.js';
import { FixedSourceService } from '../../dist/application/fixed-source.js';
import { GitSourceRepository } from '../../dist/adapters/git-source.js';
import { GraphFileStore } from '../../dist/adapters/graph-store.js';
import { createGraphFixture, cli, inputFile, update, review, graphPath, graphFormat, sourceText } from '../fixtures/dependency-graph.mjs';
import { git } from '../fixtures/fixed-source.mjs';

const io = { open, link, rename, unlink };
const service = store => new application.GraphService(new FixedSourceService(new GitSourceRepository()), store ?? new GraphFileStore());
const emptyGraph = commit => ({ format: graphFormat, source_commit: commit, nodes: [], edges: [] });
const target = f => path.join(f.projectRoot, graphPath);

test('真实 CLI 登记/查询/替换/重复/环/删除，异 cwd、固定 A、无关资料和输入保持', async () => {
  const f = await createGraphFixture();
  const absent = cli(f, 'query-graph', { path: 'service.ts' });
  assert.equal(absent.status, 1);
  assert.equal(absent.json.error.code, 'GRAPH_NOT_FOUND');
  assert.equal(cli(f, 'validate-graph').json.error.code, 'GRAPH_NOT_FOUND');
  assert.ok(!(await readdir(f.projectRoot)).includes('docs'));
  const first = await inputFile(f, update({ register: ['service.ts', 'router.ts', 'empty.ts', '[x].ts'] }));
  const created = cli(f, 'apply-graph', { input: first });
  assert.equal(created.status, 0, created.stderr);
  assert.equal(created.json.result.graph.nodes.every(node => node.analysis === 'unreviewed'), true);
  assert.equal(cli(f, 'query-graph', { path: 'service.ts' }).json.result.analysis, 'unreviewed');
  assert.equal(cli(f, 'query-graph', { path: 'other.ts' }).json.result.registered, false);
  const asset = path.join(f.projectRoot, 'docs/aftertaste/notes.json');
  await writeFile(asset, 'synthetic personal asset');
  const apply = async actions => {
    const input = await inputFile(f, update(actions));
    const original = await readFile(input);
    const result = cli(f, 'apply-graph', { input });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await readFile(input), original);
    return result.json.result;
  };
  await apply({ reviews: [review('service.ts', ['schema.ts', 'old_repo.ts']), review('router.ts', ['service.ts'])] });
  const beforeUpdate = JSON.parse(await readFile(target(f), 'utf8'));
  const revised = await apply({ reviews: [review('service.ts', ['schema.ts', 'new_repo.ts'])] });
  assert.deepEqual(revised.graph.edges.filter(edge => edge.dependent === 'router.ts'), beforeUpdate.edges.filter(edge => edge.dependent === 'router.ts'));
  assert.equal(revised.graph.nodes.find(node => node.path === 'new_repo.ts').analysis, 'unreviewed');
  const same = await readFile(target(f), 'utf8');
  await apply({ reviews: [review('service.ts', ['schema.ts', 'new_repo.ts'])] });
  assert.equal(await readFile(target(f), 'utf8'), same);
  await apply({ register: ['service.ts'] });
  assert.equal(cli(f, 'query-graph', { path: 'service.ts' }).json.result.analysis, 'reviewed');
  await apply({ reviews: [review('schema.ts', ['service.ts'])] });
  await writeFile(path.join(f.projectRoot, 'service.ts'), 'B');
  git(f.repositoryRoot, ['add', `${f.projectPrefix}/service.ts`]);
  git(f.repositoryRoot, ['commit', '-m', 'synthetic D009 B']);
  await writeFile(path.join(f.projectRoot, 'service.ts'), 'dirty');
  const fixed = cli(f, 'validate-graph', {}, path.parse(process.env.SystemRoot ?? f.runRoot).root);
  assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
  assert.equal(fixed.json.result.graph.source_commit, f.commit);
  const removed = await apply({ remove: ['schema.ts'] });
  assert.deepEqual(removed.affectedDependents, ['service.ts']);
  assert.equal(removed.removedEdges.length, 2);
  const queried = cli(f, 'query-graph', { path: 'service.ts' });
  assert.equal(queried.json.result.analysis, 'unreviewed');
  assert.equal(queried.json.result.dependents[0].dependent, 'router.ts');
  const afterDelete = await readFile(target(f), 'utf8');
  await apply({ remove: ['schema.ts'] });
  assert.equal(await readFile(target(f), 'utf8'), afterDelete);
  await apply({ reviews: [review('service.ts')] });
  assert.equal(cli(f, 'query-graph', { path: 'service.ts' }).json.result.analysis, 'reviewed');
  assert.deepEqual(cli(f, 'query-graph', { path: 'service.ts' }).json.result.dependencies, []);
  assert.equal(await readFile(asset, 'utf8'), 'synthetic personal asset');
  assert.equal(await readFile(path.join(f.projectRoot, 'schema.ts'), 'utf8'), sourceText);
  assert.equal((await readFile(target(f), 'utf8')).includes('SYNTHETIC_D009_SOURCE'), false);
  assert.ok(!(await readdir(path.dirname(target(f)))).includes('current'));
});

test('空图/空输入仍核完整提交与映射，拒绝缺对象和形似完整 ID 的分支别名', async () => {
  const f = await createGraphFixture();
  const input = await inputFile(f, update({ register: [] }));
  const alias = 'a'.repeat(64);
  git(f.repositoryRoot, ['update-ref', `refs/heads/${alias}`, f.commit]);
  const cases = [
    [{ commit: '0'.repeat(40) }, 'OBJECT_UNAVAILABLE', 1],
    [{ commit: alias }, 'INVALID_ARGUMENT', 2],
    [{ commit: 'HEAD' }, 'INVALID_ARGUMENT', 2],
    [{ prefix: 'wrong' }, 'INVALID_ARGUMENT', 2],
    [{ repository: path.join(f.repositoryRoot, 'packages'), prefix: '小 项目' }, 'INVALID_ARGUMENT', 2],
    [{ prefix: undefined }, 'INVALID_ARGUMENT', 2],
  ];
  for (const [options, code, status] of cases) {
    const result = cli(f, 'apply-graph', { input, ...options });
    assert.equal(result.status, status, JSON.stringify(result));
    assert.equal(result.json.error.code, code);
    assert.ok(!(await readdir(f.projectRoot)).includes('docs'));
  }
  assert.equal(cli(f, 'apply-graph', { input }).status, 0);
  const old = await readFile(target(f));
  const missing = { ...emptyGraph('0'.repeat(40)) };
  await writeFile(target(f), JSON.stringify(missing));
  const checked = cli({ ...f, commit: missing.source_commit }, 'validate-graph');
  assert.equal(checked.status, 1);
  assert.equal(checked.json.result.sourceCheck, 'unavailable');
  assert.equal(checked.json.result.diagnostics[0].params.sourceCode, 'OBJECT_UNAVAILABLE');
  await writeFile(target(f), old);
  const full = await service().validate(f);
  assert.equal(full.mechanicallyValid, true);
});

test('SHA256 空图拒绝 40 位分支别名，接受完整 64 位提交', async () => {
  const f = await createGraphFixture();
  const repositoryRoot = path.join(f.runRoot, 'sha256');
  await mkdir(repositoryRoot);
  git(repositoryRoot, ['init', '--object-format=sha256', '--initial-branch=main']);
  git(repositoryRoot, ['config', 'user.name', 'Synthetic D009']);
  git(repositoryRoot, ['config', 'user.email', 'd009@example.invalid']);
  await writeFile(path.join(repositoryRoot, 'a.ts'), sourceText);
  git(repositoryRoot, ['add', '.']);
  git(repositoryRoot, ['commit', '-m', 'synthetic sha256']);
  const commit = git(repositoryRoot, ['rev-parse', 'HEAD']);
  const mapping = { ...f, projectRoot: repositoryRoot, repositoryRoot, projectPrefix: '', commit };
  const input = await inputFile(f, update({ register: [] }));
  const alias = 'b'.repeat(40);
  git(repositoryRoot, ['update-ref', `refs/heads/${alias}`, commit]);
  assert.equal(cli(mapping, 'apply-graph', { input, commit: alias }).json.error.context.reason, 'COMMIT_ID_MISMATCH');
  assert.equal(cli(mapping, 'apply-graph', { input }).status, 0);
  assert.equal(cli(mapping, 'validate-graph').json.result.graph.source_commit, commit);
});

test('坏图、非法更新、不可读编码及版本不同均不覆盖，独立检查定位字段', async () => {
  const f = await createGraphFixture();
  const initial = await inputFile(f, update({ register: ['service.ts'] }));
  assert.equal(cli(f, 'apply-graph', { input: initial }).status, 0);
  const old = await readFile(target(f));
  const oldValue = JSON.parse(old);
  const malformed = ['{', JSON.stringify({ ...oldValue, nodes: [...oldValue.nodes, oldValue.nodes[0]] }),
    JSON.stringify({ ...oldValue, edges: [{ dependency: 'missing.ts', dependent: 'service.ts', reason: 'synthetic' }] }),
    Buffer.from([0xc0, 0xaf])];
  for (const raw of malformed) {
    await writeFile(target(f), raw);
    const before = await readFile(target(f));
    const checked = cli(f, 'validate-graph');
    assert.equal(checked.status, 1);
    const applied = cli(f, 'apply-graph', { input: initial });
    assert.equal(applied.status, 1);
    assert.ok(['GRAPH_INVALID', 'GRAPH_READ_FAILED'].includes(applied.json.error.code));
    assert.deepEqual(await readFile(target(f)), before);
  }
  await writeFile(target(f), old);
  for (const value of [update({ reviews: [{ path: 'service.ts', dependencies: [] }] }), update({ register: ['../outside.ts'] }),
    update({ register: ['missing.ts'] }), update({ register: ['link'] })]) {
    const input = await inputFile(f, value);
    const original = await readFile(input);
    const failed = cli(f, 'apply-graph', { input });
    assert.ok([1, 2].includes(failed.status));
    assert.deepEqual(await readFile(target(f)), old);
    assert.deepEqual(await readFile(input), original);
  }
  const missingPath = await inputFile(f, update({ register: ['missing.ts'] }));
  assert.equal(cli(f, 'apply-graph', { input: missingPath }).json.error.diagnostics[0].params.sourceCode, 'FILE_NOT_FOUND');
  await writeFile(initial, '{');
  assert.equal(cli(f, 'apply-graph', { input: initial }).json.error.code, 'GRAPH_INPUT_INVALID');
  await writeFile(initial, Buffer.from([0xc0, 0xaf]));
  assert.equal(cli(f, 'apply-graph', { input: initial }).json.error.code, 'GRAPH_INPUT_READ_FAILED');
  assert.equal(cli(f, 'apply-graph', { input: 'relative.json' }).status, 2);
  const later = git(f.repositoryRoot, ['commit-tree', `${f.commit}^{tree}`, '-p', f.commit], 'synthetic another commit');
  const different = cli({ ...f, commit: later }, 'apply-graph', { input: await inputFile(f, update({ register: [] })) });
  assert.equal(different.json.error.code, 'GRAPH_VERSION_MISMATCH');
  assert.deepEqual(await readFile(target(f)), old);
  assert.equal(cli({ ...f, commit: later }, 'validate-graph').json.result.diagnostics[0].code, 'GRAPH_VERSION_MISMATCH');
});

test('对象缺失仍查询原关系，独立校验真实未完成；空图同样不能绕过 Git', async () => {
  const f = await createGraphFixture();
  await service().apply(f, update({ reviews: [review('service.ts', ['schema.ts'])] }));
  const before = await readFile(target(f));
  const object = path.join(f.repositoryRoot, '.git/objects', f.commit.slice(0, 2), f.commit.slice(2));
  const saved = path.join(f.runRoot, 'saved-object');
  await rename(object, saved);
  try {
    const queried = cli(f, 'query-graph', { path: 'service.ts' });
    assert.equal(queried.status, 0, queried.stderr);
    assert.equal(queried.json.result.sourceCheck, 'not-run');
    assert.equal(queried.json.result.dependencies[0].dependency, 'schema.ts');
    const checked = cli(f, 'validate-graph');
    assert.equal(checked.status, 1);
    assert.equal(checked.json.result.mechanicallyValid, false);
    assert.equal(checked.json.result.sourceCheck, 'unavailable');
    assert.equal(checked.json.result.diagnostics[0].params.sourceCode, 'OBJECT_UNAVAILABLE');
    await assert.rejects(service().apply(f, update({ register: [] })), { code: 'OBJECT_UNAVAILABLE' });
    assert.deepEqual(await readFile(target(f)), before);
  } finally { await rename(saved, object); }
});

test('存储的 Windows 大小写普通别名可读写，现存 junction/硬链接/目录拒绝', async () => {
  const f = await createGraphFixture();
  const store = new GraphFileStore();
  const actual = process.platform === 'win32' ? 'Docs/AfterTaste' : 'docs/aftertaste';
  await mkdir(path.join(f.projectRoot, actual), { recursive: true });
  const raw = JSON.stringify(emptyGraph(f.commit));
  const alias = process.platform === 'win32' ? f.projectRoot.replace(`${path.sep}packages${path.sep}`, `${path.sep}PACKAGES${path.sep}`) : f.projectRoot;
  await store.save(alias, raw, undefined);
  assert.equal(await store.read(alias), raw);
  await store.save(f.projectRoot, raw + '\n', raw);
  assert.equal(await store.read(alias), raw + '\n');
  const outside = path.join(f.runRoot, 'outside');
  await mkdir(outside);
  await rm(target(f));
  const outsideFile = path.join(outside, 'asset.json');
  await writeFile(outsideFile, 'external');
  await link(outsideFile, target(f));
  await assert.rejects(store.read(f.projectRoot), { code: 'GRAPH_PATH_UNSAFE' });
  await assert.rejects(store.save(f.projectRoot, raw, undefined), { code: 'GRAPH_PATH_UNSAFE' });
  assert.equal(await readFile(outsideFile, 'utf8'), 'external');
  await rm(target(f));
  await mkdir(target(f));
  assert.equal(cli(f, 'apply-graph', { input: await inputFile(f, update({ register: [] })) }).json.error.code, 'GRAPH_PATH_UNSAFE');
  await rmdir(target(f));
  for (const relative of [actual, 'docs']) {
    const linked = path.join(f.projectRoot, relative);
    assert.ok(path.resolve(linked).startsWith(path.resolve(f.runRoot) + path.sep));
    await rm(linked, { recursive: true });
    await symlink(outside, linked, 'junction');
    await assert.rejects(store.read(f.projectRoot), { code: 'GRAPH_PATH_UNSAFE' });
    await assert.rejects(store.save(f.projectRoot, raw, undefined), { code: 'GRAPH_PATH_UNSAFE' });
    await rm(linked);
  }
  assert.deepEqual(await readdir(outside), ['asset.json']);
});

test('存储失败注入：部分写/link/rename/碰撞保持旧图及无关文件，只清理自己临时文件', async () => {
  const f = await createGraphFixture();
  const normal = new GraphFileStore();
  const raw = JSON.stringify(emptyGraph(f.commit));
  const failed = code => Object.assign(new Error('synthetic failure'), { code });
  const partial = new GraphFileStore({ ...io, async open(filePath, flags) {
    const handle = await open(filePath, flags);
    const write = handle.writeFile.bind(handle);
    handle.writeFile = async text => { await write(text.slice(0, 10)); throw failed('ENOSPC'); };
    return handle;
  } });
  await assert.rejects(partial.save(f.projectRoot, raw, undefined), { code: 'GRAPH_WRITE_FAILED', context: { projectRoot: f.projectRoot, graphPath, published: 0, reason: 'ENOSPC' } });
  const parent = path.dirname(target(f));
  assert.deepEqual(await readdir(parent), []);
  const badLink = new GraphFileStore({ ...io, async link() { throw failed('EPERM'); } });
  await assert.rejects(badLink.save(f.projectRoot, raw, undefined), { code: 'GRAPH_WRITE_FAILED' });
  assert.deepEqual(await readdir(parent), []);
  await normal.save(f.projectRoot, raw, undefined);
  const asset = path.join(parent, 'notes.json');
  await writeFile(asset, 'asset');
  const badRename = new GraphFileStore({ ...io, async rename() { throw failed('EACCES'); } });
  await assert.rejects(badRename.save(f.projectRoot, raw + '\n', raw), { code: 'GRAPH_WRITE_FAILED' });
  await assert.rejects(partial.save(f.projectRoot, raw + '\n', raw), { code: 'GRAPH_WRITE_FAILED' });
  assert.equal(await normal.read(f.projectRoot), raw);
  let conflict;
  const collision = new GraphFileStore({ ...io, async open(filePath) {
    conflict = filePath;
    await writeFile(filePath, 'pre-existing temporary', { flag: 'wx' });
    throw failed('EEXIST');
  } });
  await assert.rejects(collision.save(f.projectRoot, raw + '\n', raw), { code: 'GRAPH_WRITE_FAILED' });
  assert.equal(await readFile(conflict, 'utf8'), 'pre-existing temporary');
  assert.equal(await readFile(asset, 'utf8'), 'asset');
  assert.equal(await normal.read(f.projectRoot), raw);
  const staging = path.join(f.repositoryRoot, '.git', 'aftertaste-staging');
  assert.equal(path.dirname(conflict), staging);
  assert.deepEqual(await readdir(staging), [path.basename(conflict)]);
  assert.deepEqual((await readdir(parent)).sort(), ['dependency-graph.json', 'notes.json']);
  assert.doesNotMatch(git(f.repositoryRoot, ['ls-files', '--others', '--exclude-standard']), /aftertaste-staging|graph-.*\.tmp/u);
});

test('发布后清理失败报告目标已更新，旧图变化不覆盖', async () => {
  const f = await createGraphFixture();
  await appendFile(path.join(f.repositoryRoot, '.git', 'info', 'exclude'), `\n/${f.projectPrefix}/${graphPath}\n`);
  const raw = JSON.stringify(emptyGraph(f.commit));
  const cleanup = new GraphFileStore({ ...io, async unlink() { throw Object.assign(new Error(), { code: 'EPERM' }); } });
  let temporary;
  await assert.rejects(cleanup.save(f.projectRoot, raw, undefined), error => {
    assert.equal(error.code, 'GRAPH_WRITE_FAILED');
    assert.equal(error.context.published, 1);
    temporary = error.context.temporary;
    return true;
  });
  assert.equal(await readFile(target(f), 'utf8'), raw);
  assert.equal(await readFile(temporary, 'utf8'), raw);
  assert.equal(path.dirname(temporary), path.join(f.repositoryRoot, '.git', 'aftertaste-staging'));
  assert.doesNotMatch(git(f.repositoryRoot, ['ls-files', '--others', '--exclude-standard']), /dependency-graph\.json|graph-.*\.tmp/u);
  // The retained hard link must be explicitly removed before the next normal operation.
  await unlink(temporary);
  const normal = new GraphFileStore();
  await writeFile(target(f), raw + '\n');
  await assert.rejects(normal.save(f.projectRoot, 'candidate', raw), { code: 'GRAPH_CHANGED' });
  assert.equal(await normal.read(f.projectRoot), raw + '\n');
});
