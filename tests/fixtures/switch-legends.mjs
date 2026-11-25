import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyGraphUpdate, cli } from './dependency-canvas.mjs';
import { audit, service, readJSON, writeJSON } from './dependency-legends.mjs';
import { createEdgeProject, quantityId } from './edge-labels.mjs';
import { fixedArgs } from './loop-authoring.mjs';
import { loopLayout } from './loop-reader.mjs';

export const loopId = 'quantity-outcomes';
export async function createSwitchProject(target) {
  const project = await createEdgeProject(target);
  const dir = path.dirname(project.projectRoot);
  const fixed = fixedArgs(project);
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true });
  const result = (...args) => JSON.parse(run(...args)).result;
  const auditTrail = { type: 'switch', id: 'audit-trail', question: '新订单在哪里留下审计记录？',
    nodes: [], edges: [{ from: audit, to: service }] };
  for (let i = 0; i < 2; i++) await applyGraphUpdate(project, { legendUpserts: [auditTrail] });
  assert.deepEqual(result('query-legends', ...fixed, '--id', auditTrail.id).legends, [auditTrail]);
  assert.ok(result('validate-graph', ...fixed).mechanicallyValid);
  const input = await readJSON(path.join(dir, 'quantity-edges.json'));
  const outcomes = { type: 'switch', id: 'outcomes', question: '通过和拒绝后，各自会发生什么？',
    nodes: ['append', 'reject'], edges: [] };
  input.legends.push(outcomes);
  const inputPath = path.join(dir, 'quantity-outcomes.json');
  await writeJSON(inputPath, input);
  run('create-loop', ...fixed, '--id', loopId, '--input', inputPath);
  const args = ['read-loop', '--project', project.projectRoot, '--id', loopId];
  const reading = result(...args);
  assert.deepEqual(reading.loop.legends.at(-1), outcomes);
  assert.ok(reading.sources.every(item => item.status === 'available'));
  assert.ok(run(...args, '--format', 'markdown').includes(outcomes.question));
  const dep = await readJSON(project.layout);
  dep.layout.positions['legend:audit-trail'] = { x: 405, y: 535 };
  await writeJSON(project.layout, dep);
  const seed = await readJSON(loopLayout(project, quantityId));
  Object.assign(seed.layout.positions, { check: { x: 70, y: 155 }, build: { x: 460, y: 155 },
    reject: { x: 465, y: 415 }, append: { x: 1800, y: 160 }, 'legend:outcomes': { x: 85, y: 460 } });
  await writeJSON(loopLayout(project, loopId), { ...seed, graph: 'loop:' + loopId });
  return project;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { projectRoot, commit } = await createSwitchProject(process.argv[2]);
  console.log(projectRoot, commit);
}
