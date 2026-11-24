import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { cli } from './dependency-canvas.mjs';
import { api, audit, legendId, rules, service, readJSON, writeJSON } from './dependency-legends.mjs';
import { fixedArgs } from './loop-authoring.mjs';
import { createLoopReaderProject, loopLayout } from './loop-reader.mjs';

export const routeId = 'path-comparison';
const group = (name, members) => ({ id: randomUUID(), name, members });
const at = (x, y) => ({ x, y });
export async function createRoutingProject(target) {
  const project = await createLoopReaderProject(target);
  const graph = await readJSON(project.graph);
  // Artificial reciprocal and self relationships exercise routing independently of the lesson.
  graph.edges.push({ dependency: api, dependent: service, reason: '合成回边：与正向调用对照。' },
    { dependency: audit, dependent: audit, reason: '合成自环：审计节点回到本身。' });
  await writeJSON(project.graph, graph);
  const seed = await readJSON(project.layout);
  await writeJSON(project.layout, { ...seed, layout: {
    positions: { [rules]: at(85, 100), [legendId]: at(149, 269), [audit]: at(350, 354),
      [api]: at(371, 134), [service]: at(733, 204) },
    groups: [group('规则与工具', [rules, legendId]), group('入口与审计', [api, audit])],
    viewport: { x: 34, y: 35, zoom: .88 },
  } });
  const step = (id, title, file, explanation) => ({ id, title, path: file, block_id: file === api ? 'apiabc12' : 'audit123', explanation });
  const basename = step('basename', '取出上传文件名', api, 'basename 从上传路径中取出最后一段。');
  const join = step('join', '拼出日志路径', audit, 'join 把目录与日志文件名拼成一个路径。');
  basename.library_uses = [{ id: 'node-path', reason: basename.explanation }];
  join.library_uses = [{ id: 'node-path', reason: join.explanation }];
  const content = { format: 'aftertaste-loop-input/v1', title: '对照两种路径用法', goal: '区分取名与拼接。',
    explanation: '从入口选一种用法，顺着箭头读到结果对照。', entry: 'choose',
    nodes: [step('choose', '选择要看的路径操作', api, '选择上传取名或日志拼接。'), basename, join,
      step('compare', '对照两种结果', audit, '上传得到文件名，审计得到拼好的路径。')],
    edges: [['choose', 'basename', '看上传入口。'], ['choose', 'join', '看审计辅助函数。'],
      ['basename', 'compare', '带着文件名对照。'], ['join', 'compare', '带着日志路径对照。']].map(([from, to, reason]) => ({ from, to, reason })),
    reading_order: ['choose', 'basename', 'join', 'compare'], legends: [{ id: 'node-path', paths: [api, audit] }] };
  const input = path.resolve(path.dirname(target), routeId + '.json');
  await writeJSON(input, content);
  execFileSync(process.execPath, [cli, 'create-loop', ...fixedArgs(project), '--id', routeId, '--input', input], { windowsHide: true });
  await writeJSON(loopLayout(project, routeId), { ...seed, graph: 'loop:' + routeId, layout: {
    positions: { choose: at(76, 211), basename: at(379, 116), join: at(379, 361), compare: at(722, 213), [legendId]: at(173, 440) },
    groups: [group('路径入口', ['choose', legendId]), group('两种用法', ['basename', 'join'])],
    viewport: { x: 22, y: 30, zoom: .84 },
  } });
  return project;
}
