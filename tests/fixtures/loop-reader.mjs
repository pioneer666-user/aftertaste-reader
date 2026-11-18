import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyGraphUpdate, cli } from './dependency-canvas.mjs';
import { api, audit, createLegendProject, standardLegend, writeJSON } from './dependency-legends.mjs';
import { fixedArgs, orderId, orderInput } from './loop-authoring.mjs';

export const legendLoopId = 'path-tools';
export const loopLayout = (project, id) => path.join(project.data, 'loops', id, 'layout.json');
export const artifact = (project, id) => path.join(project.data, 'loops', id, 'current', 'loop.json');
export const explanationFile = (project, file) => path.join(project.data, 'current', file + '.md');
export const git = (project, ...args) => execFileSync('git', ['-C', project.projectRoot, ...args], { encoding: 'utf8', windowsHide: true });

export async function createLoopReaderProject(target) {
  const project = await createLegendProject(path.resolve(target));
  await applyGraphUpdate(project, { legendUpserts: [standardLegend] });
  for (const [file, id, body] of [[api, 'apiabc12', '入口提取上传文件名。'], [audit, 'audit123', '辅助文件拼接日志路径。']]) {
    const size = git(project, 'show', project.commit + ':' + file).trimEnd().split('\n').length;
    const overview = file === audit ? '\n<!-- aftertaste:block id=overview -->\n从已有名字构建路径。\n<!-- aftertaste:end -->\n' : '';
    await mkdir(path.dirname(explanationFile(project, file)), { recursive: true });
    await writeFile(explanationFile(project, file), '<!-- aftertaste:document commit=' + project.commit + ' -->\n\n' +
      '<!-- aftertaste:block id=' + id + ' lines=1-' + size + ' -->\n' + body + '\n<!-- aftertaste:end -->\n' + overview);
  }
  const legendInput = {
    format: orderInput.format, title: '路径工具怎样处理文件名', goal: '理解从路径取名和拼接路径的区别',
    explanation: '上传入口取出文件名。审计辅助函数从目录与文件名构建路径。',
    entry: 'upload',
    nodes: [
      { id: 'upload', path: api, block_id: 'apiabc12', title: '上传文件名', explanation: '这里只取路径的末段。' },
      { id: 'audit', path: audit, block_id: 'overview', title: '日志路径', explanation: '这里有文件名，需要拼出日志路径。' },
    ],
    edges: [{ from: 'upload', to: 'audit', reason: '对照取名和拼路径的两个操作。' }],
    reading_order: ['upload', 'audit'],
    legends: [{ id: standardLegend.id, paths: [api, audit] }],
  };
  for (const [id, content] of [[orderId, orderInput], [legendLoopId, legendInput]]) {
    const input = path.join(path.dirname(project.projectRoot), id + '-input.json');
    await writeJSON(input, content);
    execFileSync(process.execPath, [cli, 'create-loop', ...fixedArgs(project), '--id', id, '--input', input], { windowsHide: true });
  }
  return project;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await createLoopReaderProject(process.argv[2])));
}
