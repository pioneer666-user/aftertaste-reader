import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvasProject, applyGraphUpdate } from './dependency-canvas.mjs';

export const rules = 'src/rules.mjs', service = 'src/service.mjs', audit = 'support/audit.mjs', api = 'src/api.mjs';
export const standardLegend = {
  id: 'node-path', kind: 'standard', name: 'node:path',
  description: 'Node.js 提供的路径工具，负责拼接路径以及从路径中取出文件名。',
  uses: [
    { path: api, reason: '用 basename 取得上传路径中的文件名，向调用者返回文件名。' },
    { path: audit, reason: '用 join 将日志目录和 audit.log 拼成当前系统可用的路径。' },
  ],
};
export const thirdPartyLegend = {
  id: 'zod', kind: 'third-party', name: 'zod',
  description: '通过 schema 定义并校验输入数据的结构。',
  uses: [{ path: api, reason: '用字符串 schema 检查上传路径，避免把其他类型传给 basename。' }],
};
export const legendId = 'legend:' + standardLegend.id;
export const updatedDescription = 'Node.js 的路径工具。它能按操作系统的规则拼接路径，也能从已有路径中提取文件名。';
export const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
export const writeJSON = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n');

export async function createLegendProject(target) {
  const project = await createCanvasProject(target);
  const git = (...args) => execFileSync('git', ['-C', project.projectRoot, '-c', 'core.autocrlf=false', ...args],
    { encoding: 'utf8', windowsHide: true,
      env: { ...process.env, GIT_AUTHOR_DATE: '2026-11-18T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-18T00:00:00Z' } });
  const additions = {
    [api]: "import { basename } from 'node:path';\nimport { z } from 'zod';\n\nexport const getUploadName = input => basename(z.string().parse(input));\n",
    [audit]: "import { join } from 'node:path';\n\nexport const auditPath = logDirectory => join(logDirectory, 'audit.log');\n",
  };
  for (const [file, addition] of Object.entries(additions)) {
    await writeFile(path.join(project.projectRoot, file), addition + '\n' + git('show', `${project.commit}:${file}`));
  }
  git('add', '--', api, audit);
  git('-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', 'Add library uses for the reader fixture');
  const commit = git('rev-parse', 'HEAD').trim();
  for (const file of [rules, service]) {
    const document = path.join(project.data, 'current', file + '.md');
    await writeFile(document, (await readFile(document, 'utf8')).replace(project.commit, commit));
  }
  await writeJSON(project.graph, { ...await readJSON(project.graph), source_commit: commit });
  const fixed = { ...project, commit, receipt: path.join(project.data, 'dependency-graph-removals.json') };
  await applyGraphUpdate(fixed, { reviews: [{ path: api, analysis: 'reviewed',
    dependencies: [{ path: service, reason: '调用 createOrder 处理订单。' }] }] });
  await writeJSON(fixed.layout, {
    format: 'aftertaste-canvas-layout/v1', graph: 'dependency', revision: randomUUID(),
    layout: {
      positions: { [rules]: { x: 32, y: 64 }, [service]: { x: 315, y: 64 },
        [audit]: { x: 32, y: 225 }, [api]: { x: 315, y: 225 } },
      groups: [{ id: randomUUID(), name: '订单处理', members: [rules, service] }],
      viewport: { x: 20, y: 18, zoom: 1.2 },
    },
  });
  return fixed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const project = await createLegendProject(process.argv[2]);
  await applyGraphUpdate(project, { legendUpserts: [standardLegend, thirdPartyLegend] });
  console.log(JSON.stringify(project));
}
