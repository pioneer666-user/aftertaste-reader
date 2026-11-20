import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { repository } from './dependency-canvas.mjs';
import { api, audit, legendId, readJSON, rules, service, writeJSON } from './dependency-legends.mjs';
import { createLoopReaderProject } from './loop-reader.mjs';

export async function preparePolishProject(suite) {
  const channel = process.env.AFTERTASTE_BROWSER ?? 'edge';
  const root = path.join(repository, '.local/D027');
  await mkdir(root, { recursive: true });
  const run = await mkdtemp(path.join(root, suite + '-' + channel + '-'));
  const project = path.join(run, 'project');
  const source = process.env.AFTERTASTE_D027_INPUT ?? path.join(root, 'input');
  const disk = path.join(project, 'docs/aftertaste/dependency-layout.json');
  if (existsSync(source) || process.env.AFTERTASTE_D027_INPUT) {
    await cp(source, project, { recursive: true, force: false, errorOnExist: true });
    return { channel, run, project, source, disk };
  }
  await createLoopReaderProject(project);
  const seed = await readJSON(disk);
  seed.layout.positions = { [api]: { x: 192, y: 208 }, [rules]: { x: -471, y: 309 },
    [service]: { x: -157, y: 309 }, [audit]: { x: -475, y: 458 }, [legendId]: { x: -818, y: 208 } };
  seed.layout.viewport = { x: 919.31, y: 127.95, zoom: 0.7917047464637365 };
  await writeJSON(disk, seed);
  return { channel, run, project, disk, source: 'order fixture at D027 coordinates' };
}
