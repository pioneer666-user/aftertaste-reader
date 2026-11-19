import { execFileSync } from 'node:child_process';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerationProject } from './generation-project.mjs';

export const repository = fileURLToPath(new URL('../../', import.meta.url));
export const build = path.resolve(repository, process.env.AFTERTASTE_BUILD ?? 'dist');
export const cli = path.join(build, 'cli/main.js');

export async function createCanvasProject(target) {
  const fixed = await createGenerationProject(target);
  const data = path.join(fixed.projectRoot, 'docs/aftertaste');
  const sample = fileURLToPath(new URL('./order-reading/', import.meta.url));
  await mkdir(data, { recursive: true });
  for (const entry of ['current', 'dependency-graph.json', 'preferences.md', 'reading-direction.md']) {
    await cp(path.join(sample, entry), path.join(data, entry), { recursive: true, errorOnExist: true, force: false });
  }
  return { ...fixed, data, graph: path.join(data, 'dependency-graph.json'), layout: path.join(data, 'dependency-layout.json') };
}

export async function applyGraphUpdate(fixture, update) {
  const input = path.join(path.dirname(fixture.projectRoot), 'graph-update.json');
  await writeFile(input, JSON.stringify({ format: 'aftertaste-dependency-update/v1', ...update }));
  return JSON.parse(execFileSync(process.execPath, [cli, 'apply-graph', '--project', fixture.projectRoot,
    '--repository', fixture.projectRoot, '--prefix', '', '--commit', fixture.commit, '--input', input],
  { encoding: 'utf8', windowsHide: true })).result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await createCanvasProject(process.argv[2])));
}
