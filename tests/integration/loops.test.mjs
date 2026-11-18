import assert from 'node:assert/strict';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, readdir, rename, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyGraphUpdate, cli, createCanvasProject, repository } from '../fixtures/dependency-canvas.mjs';
import { api, audit, createLegendProject, readJSON, rules, service, standardLegend, updatedDescription, writeJSON } from '../fixtures/dependency-legends.mjs';
import { fixedArgs, orderId, orderInput } from '../fixtures/loop-authoring.mjs';

const root = path.join(repository, '.local/D015');
await mkdir(root, { recursive: true });
const fixture = async (tag, create = createCanvasProject) => create(path.join(await mkdtemp(path.join(root, tag + '-')), 'project'));
const document = (project, file) => path.join(project.data, 'current', file + '.md');
const loops = project => path.join(project.data, 'loops');
const stored = (project, id = orderId) => path.join(loops(project), id, 'current', 'loop.json');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true });
const createArgs = (project, input, id = orderId) => ['create-loop', ...fixedArgs(project), '--id', id, '--input', input];
const readLoop = (project, id = orderId, ...args) => run('read-loop', '--project', project.projectRoot, '--id', id, ...args);
const git = (project, ...args) => execFileSync('git', ['-C', project.projectRoot, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', windowsHide: true });

async function inputFile(project, name, value = orderInput) {
  const input = path.join(path.dirname(project.projectRoot), name + '.json');
  await writeJSON(input, value);
  return input;
}
function success({ status, stdout, stderr }) {
  assert.equal(status, 0, stderr);
  const response = JSON.parse(stdout);
  assert.equal(response.ok, true);
  return response.result;
}
function failure({ status, stderr }, code, exitCode = 1) {
  assert.equal(status, exitCode, stderr);
  const { error } = JSON.parse(stderr);
  assert.equal(error.code, code);
  return error;
}

test('订单新建和读回分别保存分支、顺序与原块，缺少已讲解文件时不写成品', async () => {
  const project = await fixture('order');
  const graph = await readFile(project.graph);
  const first = success(run(...createArgs(project, await inputFile(project, 'order'))));
  assert.equal(first.source_commit, project.commit);
  const result = success(readLoop(project));
  assert.deepEqual(result.loop, await readJSON(stored(project)));
  assert.deepEqual(result.loop.reading_order, orderInput.reading_order);
  assert.deepEqual(result.loop.edges, orderInput.edges);
  assert.equal(result.loop.nodes.filter(node => node.path === rules).length, 2);
  assert.match(result.loop.nodes.find(node => node.id === 'check').block_explanation, /数量规则承担转换与边界检查/);
  assert.deepEqual(result.sources.find(source => source.node_id === 'check').lines, git(project, 'show', project.commit + ':' + rules).trimEnd().split('\n'));
  const markdown = readLoop(project, orderId, '--format', 'markdown');
  assert.equal(markdown.status, 0, markdown.stderr);
  assert.match(markdown.stdout, /假设示例[\s\S]*原集合仍为空/u);
  assert.match(markdown.stdout, /规则转换并检查边界 → 无效数量让创建提前结束/u);
  assert.doesNotMatch(markdown.stdout, /export function|WORKTREE_ONLY/u);

  const missing = structuredClone(orderInput);
  missing.nodes[0].path = api;
  const error = failure(run(...createArgs(project, await inputFile(project, 'missing', missing), 'api-entry')), 'LOOP_BLOCK_INVALID');
  assert.equal(error.context.path, api);
  assert.equal(error.context.nodeId, 'start');
  assert.deepEqual(await readdir(loops(project)), [orderId]);
  assert.deepEqual(await readFile(project.graph), graph);
});

test('图例按参与文件冻结，改原文和 HEAD 后读原版，缺一个对象仍可读完整讲解', async () => {
  const project = await fixture('reread', createLegendProject);
  await applyGraphUpdate(project, { legendUpserts: [standardLegend] });
  for (const [file, block, body] of [[api, 'apiabc12', '入口提取上传文件名。'], [audit, 'audit123', '辅助文件把日志目录和文件名拼接为路径。']]) {
    const text = git(project, 'show', project.commit + ':' + file);
    await mkdir(path.dirname(document(project, file)), { recursive: true });
    await writeFile(document(project, file), '<!-- aftertaste:document commit=' + project.commit + ' -->\n\n' +
      '<!-- aftertaste:block id=' + block + ' lines=1-' + text.trimEnd().split('\n').length + ' -->\n' + body + '\n<!-- aftertaste:end -->\n');
  }
  const plan = {
    format: orderInput.format, title: '路径工具怎样处理文件名', goal: '看取末段与拼接两种操作如何处理路径',
    explanation: '上传入口从路径提取末段作为文件名。审计辅助函数则从目录与文件名构建路径。',
    entry: 'upload',
    nodes: [
      { id: 'upload', path: api, block_id: 'apiabc12', title: '上传文件名', explanation: '这里只取路径的末段。' },
      { id: 'audit', path: audit, block_id: 'audit123', title: '日志路径', explanation: '这里已有文件名，需要拼出可用的日志路径。' },
    ],
    edges: [{ from: 'upload', to: 'audit', reason: '教学对照。先看从路径得到文件名，再看用文件名构建路径。' }],
    reading_order: ['upload', 'audit'],
    legends: [{ id: standardLegend.id, paths: [api] }],
  };
  const invalidLegend = structuredClone(plan);
  invalidLegend.legends[0].id = 'missing-legend';
  failure(run(...createArgs(project, await inputFile(project, 'bad-legend', invalidLegend))), 'LOOP_LEGEND_INVALID');
  success(run(...createArgs(project, await inputFile(project, 'with-legend', plan))));
  const before = success(readLoop(project));
  const bytes = await readFile(stored(project));
  assert.deepEqual(before.loop.legends, [{ ...standardLegend, uses: [standardLegend.uses[0]] }]);
  assert.doesNotMatch(bytes.toString('utf8'), /export function|return quantity;|WORKTREE_ONLY|orders\.push\(/u);

  const oldDoc = await readFile(document(project, api), 'utf8');
  await writeFile(document(project, api), oldDoc.replace('入口提取上传文件名。', '后来的原文件讲解'));
  await applyGraphUpdate(project, { legendUpserts: [{ id: standardLegend.id, description: updatedDescription }] });
  await writeFile(path.join(project.projectRoot, api), 'export const WORKTREE_ONLY = true;\n');
  git(project, 'add', '--', api);
  git(project, '-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Advance fixture HEAD');
  assert.notEqual(git(project, 'rev-parse', 'HEAD').trim(), project.commit);
  assert.deepEqual(success(readLoop(project)), before);
  assert.deepEqual(await readFile(stored(project)), bytes);

  const oid = git(project, 'rev-parse', project.commit + ':' + api).trim();
  const object = path.join(project.projectRoot, '.git/objects', oid.slice(0, 2), oid.slice(2));
  const unavailable = object + '.off';
  await rename(object, unavailable);
  try {
    const degraded = success(readLoop(project));
    assert.deepEqual(degraded.loop, before.loop);
    assert.equal(degraded.mechanicallyValid, false);
    assert.equal(degraded.sourceCheck, 'unavailable');
    const affected = degraded.sources.filter(source => source.status === 'unavailable');
    assert.deepEqual(affected.map(source => source.node_id), ['upload']);
    const { error } = affected[0];
    assert.equal(error.context.path, api);
    assert.equal(error.context.commit, project.commit);
    assert.equal(error.context.blockId, 'apiabc12');
    const { start, end } = before.loop.nodes[0].lines;
    assert.deepEqual([error.context.start, error.context.end], [start, end]);
    assert.match(error.code, /^(OBJECT_UNAVAILABLE|GIT_READ_FAILED)$/u);
    assert.equal(degraded.sources.find(source => source.node_id === 'audit').status, 'available');
    const markdown = readLoop(project, orderId, '--format', 'markdown');
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.match(markdown.stdout, /固定源码不可用/u);
    assert.match(markdown.stdout, /入口提取上传文件名/u);
    assert.match(markdown.stdout, new RegExp(project.commit, 'u'));
  } finally { await rename(unavailable, object); }
  assert.deepEqual(success(readLoop(project)), before);
});

test('子项目按原 Git 前缀取源，纯讲解块不会制造行范围', async () => {
  const project = await fixture('prefix');
  const projectRoot = path.join(project.projectRoot, 'src');
  const nested = { projectRoot, repositoryRoot: project.projectRoot, projectPrefix: 'src', commit: project.commit,
    data: path.join(projectRoot, 'docs/aftertaste') };
  await mkdir(path.join(nested.data, 'current'), { recursive: true });
  for (const name of ['service.mjs', 'rules.mjs']) {
    const original = await readFile(document(project, 'src/' + name), 'utf8');
    const pure = name === 'rules.mjs' ?
      '\n<!-- aftertaste:block id=pureread -->\n纯讲解说明。\n<!-- aftertaste:end -->\n' : '';
    await writeFile(document(nested, name), original + pure);
  }
  const plan = structuredClone(orderInput);
  plan.nodes.forEach(node => { node.path = node.path.slice('src/'.length); });
  plan.nodes[4].block_id = 'pureread';
  success(run(...createArgs(nested, await inputFile(nested, 'nested', plan))));
  const result = success(readLoop(nested));
  assert.equal(result.loop.project_prefix, 'src');
  assert.deepEqual(result.sources.find(source => source.node_id === 'stop'), { node_id: 'stop', status: 'not-applicable' });
  assert.equal(Object.hasOwn(result.loop.nodes[4], 'lines'), false);
  assert.deepEqual(result.sources.find(source => source.node_id === 'check').lines,
    git(project, 'show', project.commit + ':' + rules).trimEnd().split('\n'));
  if (process.platform === 'win32') {
    assert.deepEqual(success(readLoop({ ...nested, projectRoot: path.join(project.projectRoot, 'SRC') })), result);
  }
});

test('路线在所有阅读顺序轮换下保留同一关系，顺序缺项或重复时拒绝', async () => {
  const { parseLoopInput } = await import('../../dist/core/loops.js');
  const order = orderInput.reading_order;
  for (let shift = 0; shift < order.length; shift++) {
    const reading_order = order.slice(shift).concat(order.slice(0, shift));
    const plan = { ...orderInput, reading_order };
    const route = parseLoopInput(plan);
    assert.deepEqual(route.reading_order, reading_order);
    assert.deepEqual(route.edges, orderInput.edges);
    assert.equal(route.entry, orderInput.entry);
    for (const changed of [reading_order.slice(1), reading_order.slice(1).concat(reading_order[1])]) {
      assert.throws(() => parseLoopInput({ ...plan, reading_order: changed }), { code: 'LOOP_INPUT_INVALID' });
    }
  }
});

test('拒绝无效块、悬空边和同名创建，保存中断重试不伤旧成品及个人资料', async () => {
  const project = await fixture('write');
  const input = await inputFile(project, 'order');
  success(run(...createArgs(project, input)));
  const old = await readFile(stored(project));
  const note = path.join(project.data, 'notes.md');
  await writeFile(note, '个人资料');
  failure(run(...createArgs(project, input)), 'LOOP_EXISTS');

  const broken = structuredClone(orderInput);
  broken.nodes[0].block_id = 'badblock';
  failure(run(...createArgs(project, await inputFile(project, 'bad-block', broken), 'bad-block')), 'LOOP_BLOCK_INVALID');
  broken.nodes[0].block_id = orderInput.nodes[0].block_id;
  broken.edges[0].to = 'missing';
  failure(run(...createArgs(project, await inputFile(project, 'dangling', broken), 'dangling')), 'LOOP_INPUT_INVALID', 2);
  for (const id of ['../outside', 'nul', 'order-quantity.', 'order-quantity ']) {
    failure(run(...createArgs(project, input, id)), 'INVALID_ARGUMENT', 2);
  }
  assert.deepEqual(await readdir(loops(project)), [orderId]);

  const { LoopFileStore } = await import('../../dist/adapters/loop-store.js');
  const retryId = 'retry';
  const retryRaw = JSON.stringify({ ...JSON.parse(old), id: retryId });
  const interrupted = new LoopFileStore(async (staging, target) => {
    assert.equal(target, path.join(loops(project), retryId));
    assert.equal(await readFile(path.join(staging, 'current/loop.json'), 'utf8'), retryRaw);
    failure(readLoop(project, retryId), 'LOOP_NOT_FOUND');
    throw Object.assign(new Error('test interruption before publication'), { code: 'EIO' });
  });
  await assert.rejects(interrupted.create(project.projectRoot, retryId, retryRaw), { code: 'LOOP_WRITE_FAILED' });
  assert.deepEqual(await readdir(loops(project)), [orderId]);
  const orphan = await mkdtemp(path.join(loops(project), '.aftertaste-loop-'));
  await mkdir(path.join(orphan, 'current'));
  await writeFile(path.join(orphan, 'current/loop.json'), '{');
  failure(readLoop(project, path.basename(orphan)), 'INVALID_ARGUMENT', 2);
  success(run(...createArgs(project, input, retryId)));
  assert.equal(success(readLoop(project, retryId)).loop.id, retryId);
  assert.deepEqual(await readFile(stored(project)), old);
  assert.equal(await readFile(note, 'utf8'), '个人资料');

  const race = args => new Promise(resolve => execFile(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true },
    (error, stdout, stderr) => resolve({ status: error?.code ?? 0, stdout, stderr })));
  const contenders = await Promise.all([race(createArgs(project, input, 'race')), race(createArgs(project, input, 'race'))]);
  assert.deepEqual(contenders.map(result => result.status).sort(), [0, 1]);
  failure(contenders.find(result => result.status === 1), 'LOOP_EXISTS');
  assert.equal(success(readLoop(project, 'race')).loop.id, 'race');
});

test('读取拒绝外部链接、硬链接及损坏成品，创建保护已有目录', async () => {
  const project = await fixture('paths');
  const outside = path.join(path.dirname(project.projectRoot), 'elsewhere');
  await mkdir(outside);
  await mkdir(loops(project));
  await symlink(outside, path.join(loops(project), 'outside'), 'junction');
  const input = await inputFile(project, 'order');
  failure(readLoop(project, 'outside'), 'LOOP_PATH_UNSAFE');
  failure(run(...createArgs(project, input, 'outside')), 'LOOP_PATH_UNSAFE');
  assert.deepEqual(await readdir(outside), []);
  success(run(...createArgs(project, input)));
  await mkdir(path.dirname(stored(project, 'alias')), { recursive: true });
  await link(stored(project), stored(project, 'alias'));
  failure(readLoop(project, 'alias'), 'LOOP_PATH_UNSAFE');
  await mkdir(path.dirname(stored(project, 'bad')), { recursive: true });
  await writeFile(stored(project, 'bad'), '{broken');
  failure(readLoop(project, 'bad'), 'LOOP_INVALID');
  failure(run(...createArgs(project, input, 'bad')), 'LOOP_EXISTS');
});
