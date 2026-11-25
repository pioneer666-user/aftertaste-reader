import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli } from './dependency-canvas.mjs';
import { readJSON, writeJSON } from './dependency-legends.mjs';
import { fixedArgs } from './loop-authoring.mjs';
import { loopLayout } from './loop-reader.mjs';
import { createSwitchProject, loopId } from './switch-legends.mjs';

export const exampleId = 'quantity-examples';
export const examples = [
  { name: '“04” · 成功建单', scenario: '推演：从空集合开始。建单时集合仍为空，追加后有一条订单。',
    steps: ['check', 'build', 'append'] },
  { name: '“4.5” · 校验失败', scenario: '推演：另从空集合开始。整数检查抛错，集合仍为空。',
    steps: ['check', 'reject'] },
];

export async function createExampleProject(target) {
  const project = await createSwitchProject(target);
  const dir = path.dirname(project.projectRoot);
  const input = await readJSON(path.join(dir, 'quantity-outcomes.json'));
  input.title = '同一份数量校验，两种订单结果';
  input.examples = examples;
  const inputPath = path.join(dir, 'quantity-examples.json');
  await writeJSON(inputPath, input);
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true });
  run('create-loop', ...fixedArgs(project), '--id', exampleId, '--input', inputPath);
  const args = ['read-loop', '--project', project.projectRoot, '--id', exampleId];
  const { result } = JSON.parse(run(...args));
  assert.equal(result.loop.source_commit, project.commit);
  assert.ok(result.mechanicallyValid);
  assert.deepEqual(result.loop.examples, examples);
  const md = run(...args, '--format', 'markdown');
  for (const item of examples) {
    const titles = item.steps.map(id => result.loop.nodes.find(node => node.id === id).title + ' `' + id + '`');
    assert.ok(md.includes([item.name, item.scenario, titles.join(' → ')].join('\n\n')));
  }
  const seed = await readJSON(loopLayout(project, loopId));
  Object.assign(seed.layout.positions, { check: { x: 44, y: 230 }, build: { x: 370, y: 125 },
    append: { x: 694, y: 125 }, reject: { x: 370, y: 358 }, 'legend:number': { x: 45, y: 52 },
    'legend:outcomes': { x: 370, y: 485 } });
  seed.layout.viewport = { x: 32, y: 42, zoom: 0.9 };
  await writeJSON(loopLayout(project, exampleId), { ...seed, graph: 'loop:' + exampleId });
  return project;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { projectRoot, commit } = await createExampleProject(process.argv[2]);
  console.log(projectRoot, commit);
}
