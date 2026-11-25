import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyGraphUpdate, cli } from './dependency-canvas.mjs';
import { createReadingLayoutProject } from './canvas-reading-layout.mjs';
import { audit, rules, service, readJSON, writeJSON } from './dependency-legends.mjs';
import { fixedArgs } from './loop-authoring.mjs';
import { loopLayout } from './loop-reader.mjs';

export const quantityId = 'quantity-edges';
export async function createEdgeProject(target) {
  const project = await createReadingLayoutProject(path.resolve(target));
  const input = await readJSON(new URL('../../docs/work/2026/11/D051-loop-node-annotations/trial-input.json', import.meta.url));
  Object.assign(input.edges[0], { label: '返回 4', color: 'green' });
  Object.assign(input.edges[1], { label: '非整数，抛错', color: 'red' });
  input.legends = [{ id: 'number', paths: [rules] }];
  input.nodes[0].library_uses = [{ id: 'number', reason: '先转换数量文本，再检查整数与范围。', color: 'theme' }];
  // Use only dependencies present in this commit; the routing fixture also has artificial cycles.
  const graph = await readJSON(project.graph);
  const numberUse = graph.legends.find(item => item.id === 'number').uses[0];
  await applyGraphUpdate(project, { reviews: [
    { path: service, analysis: 'reviewed', dependencies: [
      { path: rules, reason: '服务将规则返回的数值写入新订单的数量字段。', label: '提供订单数量' },
      { path: audit, reason: '追加订单后，服务用新编号记录创建事件。' }] },
    { path: audit, analysis: 'reviewed', dependencies: [] }],
    legendUpserts: [{ id: 'number', uses: [{ ...numberUse, label: '转换数量文本' }] }],
  });
  const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true });
  const fixed = fixedArgs(project);
  const result = (...args) => JSON.parse(run(...args)).result;
  assert.ok(result('validate-graph', ...fixed).mechanicallyValid);
  assert.equal(result('query-graph', ...fixed, '--path', service).dependencies.find(e => e.dependency === rules).label, '提供订单数量');
  assert.equal(result('query-legends', ...fixed, '--id', 'number').legends[0].uses[0].label, '转换数量文本');
  const dir = path.dirname(project.projectRoot);
  const file = path.join(dir, 'quantity-edges.json');
  await writeJSON(file, input);
  run('create-loop', ...fixed, '--id', quantityId, '--input', file);
  const args = ['read-loop', '--project', project.projectRoot, '--id', quantityId];
  const reading = result(...args);
  assert.ok(reading.mechanicallyValid);
  assert.deepEqual(reading.loop.edges, input.edges);
  assert.deepEqual(reading.loop.nodes[0].library_uses, input.nodes[0].library_uses);
  assert.equal(reading.loop.legends[0].uses[0].label, '转换数量文本');
  const md = run(...args, '--format', 'markdown');
  for (const word of ['返回 4','绿色','非整数，抛错','红色','转换数量文本','主题色']) assert.ok(md.includes(word));
  const seed = await readJSON(project.layout);
  // Keep the order-quantity dependency visible in the author trial. The dense diagram tests hidden labels separately.
  seed.layout.positions['src/api.mjs'].y = 32;
  await writeJSON(project.layout, seed);
  await writeJSON(loopLayout(project, quantityId), { ...seed, graph: 'loop:' + quantityId, layout: {
    positions: { check: { x: 48, y: 220 }, build: { x: 472, y: 110 }, reject: { x: 472, y: 375 },
      append: { x: 808, y: 110 }, 'legend:number': { x: 48, y: 50 } },
    groups: [], viewport: { x: 50, y: 34, zoom: .95 },
  } });
  return project;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { projectRoot, commit } = await createEdgeProject(process.argv[2]);
  console.log(projectRoot, commit);
}
