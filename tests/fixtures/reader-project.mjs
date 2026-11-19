import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerationProject } from './generation-project.mjs';

export async function createReaderProject(target) {
  const project = await createGenerationProject(target);
  const sample = fileURLToPath(new URL('./order-reading/current/src/', import.meta.url));
  const documents = path.join(project.projectRoot, 'docs/aftertaste/current/src');
  await mkdir(documents, { recursive: true });
  for (const name of ['rules.mjs.md', 'service.mjs.md']) {
    await copyFile(path.join(sample, name), path.join(documents, name));
  }
  return project;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await createReaderProject(process.argv[2])));
}
