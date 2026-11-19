import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 合成教学输入，固定提交可重建。工作区差异用于确认生成仍取 Git 对象。
export async function createGenerationProject(target) {
  const project = path.resolve(target);
  await mkdir(project, { recursive: false });
  await mkdir(path.join(project, 'src'));
  await mkdir(path.join(project, 'support'));
  const files = {
    'src/rules.mjs': [
      'export function parseQuantity(value) {',
      '  const quantity = Number(value);',
      '  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9) {',
      "    throw new Error('quantity must be an integer from 1 to 9');",
      '  }',
      '  return quantity;',
      '}',
    ].join('\n') + '\n',
    'src/service.mjs': [
      "import { parseQuantity } from './rules.mjs';",
      "import { record } from '../support/audit.mjs';",
      '',
      'export function createOrder(input, orders) {',
      '  const quantity = parseQuantity(input.quantity);',
      '  const order = { id: orders.length + 1, quantity };',
      '  orders.push(order);',
      "  record('created', order.id);",
      '  return order;',
      '}',
    ].join('\n') + '\n',
    'src/api.mjs': [
      "import { createOrder } from './service.mjs';",
      '',
      'export function postOrder(body, orders) {',
      '  try {',
      '    return { status: 201, body: createOrder(body, orders) };',
      '  } catch {',
      "    return { status: 400, body: { error: 'invalid order' } };",
      '  }',
      '}',
    ].join('\n') + '\n',
    'support/audit.mjs': [
      'export function record(event, id) {',
      '  return `${event}:${id}`;',
      '}',
    ].join('\n') + '\n',
  };
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(project, name), content, 'utf8');
  }
  const git = (...args) => execFileSync('git', ['-C', project, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8', windowsHide: true });
  git('init', '--initial-branch=main', '--object-format=sha1');
  git('add', 'src', 'support');
  execFileSync('git', ['-C', project, '-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'i18n.commitEncoding=UTF-8',
    'commit', '-m', 'synthetic reading fixture'], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_AUTHOR_DATE: '2026-11-17T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-17T00:00:00Z' },
  });
  const commit = git('rev-parse', 'HEAD').trim();
  assert.match(commit, /^[a-f0-9]{40}$/);
  await writeFile(path.join(project, 'src/rules.mjs'), 'export const WORKTREE_ONLY = true;\n', 'utf8');
  await writeFile(path.join(project, 'src/worktree-only.mjs'), 'export const uncommitted = true;\n', 'utf8');
  assert.equal(git('show', `${commit}:src/rules.mjs`), files['src/rules.mjs']);
  return { projectRoot: project, commit, scope: 'src/', sourceLines: { 'src/rules.mjs': 7, 'src/service.mjs': 10, 'src/api.mjs': 9, 'support/audit.mjs': 3 } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv[2], 'provide a new sandbox path');
  console.log(JSON.stringify(await createGenerationProject(process.argv[2])));
}
