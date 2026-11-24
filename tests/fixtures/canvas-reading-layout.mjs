import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyGraphUpdate, cli } from './dependency-canvas.mjs';
import { api, audit, legendId, rules, thirdPartyLegend, readJSON, writeJSON } from './dependency-legends.mjs';
import { fixedArgs } from './loop-authoring.mjs';
import { loopLayout } from './loop-reader.mjs';
import { createRoutingProject } from './canvas-routing.mjs';

export const denseId = 'input-comparison';
const pathCases = ['report.csv', 'uploads/report.csv', 'archive.tar.gz', 'photos/图.jpg', '.env', 'notes/', 'a b.txt', 'README', ''];
const numberCases = ['1', '9', '0', '10', '2.5', '4', '04', '-1', ''];
export async function createReadingLayoutProject(target) {
  const project = await createRoutingProject(target);
  const numberLegend = { id: 'number', kind: 'standard', name: 'Number', description: 'JavaScript 的数值转换与整数判断。',
    uses: [{ path: rules, reason: '先调用 Number 转成数字，再检查整数与范围。' }] };
  await applyGraphUpdate(project, { legendUpserts: [thirdPartyLegend, numberLegend] });
  const seed = await readJSON(project.layout);
  Object.assign(seed.layout.positions, { 'legend:number': { x: 65, y: 420 }, 'legend:zod': { x: 675, y: 420 } });
  await writeJSON(project.layout, seed);

  const step = (id, title, file, explanation) => ({ id, title, path: file, explanation,
    block_id: file === api ? 'apiabc12' : file === rules ? 'x4y6az2y' : 'audit123' });
  const nodes = [step('choose', '选择输入样例', api, '选路径或数量，也可沿直达箭头先看结果汇总。'),
    step('paths', '查看文件名', api, '先校验字符串，再用 basename 取末段。'),
    step('numbers', '查看数量', rules, '先转成数字，再判断整数与范围。')];
  nodes[1].library_uses = [{ id: 'zod', reason: '先校验输入的类型。' }, { id: 'node-path', reason: '从路径取出文件名。' }];
  nodes[2].library_uses = [{ id: 'number', reason: '用 Number 转成数字。' }];
  const edge = (from, to, reason) => ({ from, to, reason });
  const edges = [edge('choose', 'paths', '检查路径。'), edge('choose', 'numbers', '检查数量。'),
    edge('choose', 'compare', '直接看结果汇总。')];
  const cases = [...pathCases, ...numberCases].map((input, i) => {
    const isPath = i < pathCases.length, n = Number(input);
    const shown = input ? '「' + input + '」' : '空字符串';
    const result = isPath ? '取出的文件名为 ' + JSON.stringify(path.posix.basename(input)) + '。'
      : Number.isInteger(n) && n >= 1 && n <= 9 ? '得到有效数量 ' + n + '。' : '数量不符合 1 到 9 的整数约定。';
    const item = step('case-' + String(i + 1).padStart(2, '0'), (isPath ? '路径 ' : '数量 ') + shown,
      isPath ? api : rules, result);
    edges.push(edge(isPath ? 'paths' : 'numbers', item.id, '代入' + shown + '。'), edge(item.id, 'compare', result));
    return item;
  });
  cases[0].library_uses = [{ id: 'node-path', reason: 'basename 保留没有目录前缀的文件名。' }];
  nodes.push(...cases, step('compare', '结果汇总', audit, '两种分支分别得到文件名与数量判断。回到各个样例可对照具体结果。'));
  const input = path.resolve(path.dirname(target), denseId + '.json');
  await writeJSON(input, { format: 'aftertaste-loop-input/v1', title: '路径与数量 · 18 个输入样例',
    goal: '在两个输入类别中对照边界值。', explanation: '每个样例是一条独立分支，可任选一个阅读。', entry: 'choose',
    nodes, edges, reading_order: nodes.map(n => n.id), legends: [
      { id: 'node-path', paths: [api] }, { id: 'number', paths: [rules] }, { id: 'zod', paths: [api] }] });
  execFileSync(process.execPath, [cli, 'create-loop', ...fixedArgs(project), '--id', denseId, '--input', input], { windowsHide: true });
  const positions = Object.fromEntries(cases.map((item, i) => [item.id, { x: 427, y: 180 + i * 83 }]));
  Object.assign(positions, { choose: { x: 95, y: 165 }, compare: { x: 782, y: 182 },
    paths: { x: 103, y: 331 }, numbers: { x: 103, y: 457 }, [legendId]: { x: 396, y: 52 },
    'legend:number': { x: 675, y: 440 }, 'legend:zod': { x: 675, y: 325 } });
  await writeJSON(loopLayout(project, denseId), { ...seed, graph: 'loop:' + denseId, layout: { positions,
    groups: [{ id: randomUUID(), name: '输入类别', members: ['paths', 'numbers'] }], viewport: { x: 15, y: 20, zoom: .85 } } });
  return project;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await createReadingLayoutProject(process.argv[2])));
}
