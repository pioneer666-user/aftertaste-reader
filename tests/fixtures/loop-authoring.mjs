import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, createCanvasProject } from './dependency-canvas.mjs';

export const orderInput = JSON.parse(await readFile(new URL('./loop-order.json', import.meta.url), 'utf8'));
export const orderId = 'order-quantity';
export const fixedArgs = project => ['--project', project.projectRoot, '--repository', project.repositoryRoot ?? project.projectRoot,
  '--prefix', project.projectPrefix ?? '', '--commit', project.commit];

export async function buildOrderLoop(target) {
  const run = path.resolve(target);
  await mkdir(path.dirname(run), { recursive: true });
  await mkdir(run);
  const project = await createCanvasProject(path.join(run, 'project'));
  const input = path.join(run, 'order-input.json');
  await writeFile(input, JSON.stringify(orderInput, null, 2) + '\n');
  const command = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true });
  const { result } = JSON.parse(command('create-loop', ...fixedArgs(project), '--id', orderId, '--input', input));
  const markdown = path.join(run, orderId + '.md');
  await writeFile(markdown, command('read-loop', '--project', project.projectRoot, '--id', orderId, '--format', 'markdown'));
  return { ...result, projectRoot: project.projectRoot, markdown };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv[2], 'provide a new sandbox path');
  console.log(JSON.stringify(await buildOrderLoop(process.argv[2])));
}
