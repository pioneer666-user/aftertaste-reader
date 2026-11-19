import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReaderProject } from './reader-project.mjs';

export const sharedBlockId = 'visit001';
export const rulesPath = 'docs/aftertaste/current/src/rules.mjs.md';
export const servicePath = 'docs/aftertaste/current/src/service.mjs.md';

export async function createBookmarkProject(target) {
  const project = await createReaderProject(target);
  const rules = path.join(project.projectRoot, rulesPath);
  const service = path.join(project.projectRoot, servicePath);
  const original = await readFile(rules, 'utf8');
  await writeFile(rules, original.replace('lines=1-7', 'lines=1-3') + `
<!-- aftertaste:block id=${sharedBlockId} lines=4-7 -->
## 数量超出范围时

边界校验拒绝不符合要求的数量。回顾这个块可以找到拒绝发生的位置。

<!-- aftertaste:end -->
`);
  await writeFile(service, await readFile(service, 'utf8') + `
<!-- aftertaste:block id=${sharedBlockId} -->
## 从数量规则到订单

本块回顾订单创建时怎样使用数量规则。

<!-- aftertaste:end -->
`);
  return { ...project, rules, service, bookmarks: path.join(project.projectRoot, 'docs/aftertaste/bookmarks.json') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await createBookmarkProject(process.argv[2])));
}
