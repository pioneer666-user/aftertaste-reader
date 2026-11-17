import assert from 'node:assert/strict';
import { readFile, access, mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createGenerationProject } from '../fixtures/generation-project.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const skill = path.join(root, 'skills/aftertaste-reader');

test('入口、参考、模板均存在，包内相对链接可解析', async () => {
  const files = ['SKILL.md', ...['authoring', 'teaching', 'generation', 'feedback', 'tools'].map(name => `references/${name}.md`),
    'assets/templates/preferences.md', 'assets/templates/reading-direction.md'];
  for (const name of files) {
    const source = await readFile(path.join(skill, name), 'utf8');
    assert.ok(source.trim(), name);
    assert.doesNotMatch(source, /[CD]:[\\/]|\/Users\//, `machine path in ${name}`);
    for (const match of source.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      const target = path.resolve(path.dirname(path.join(skill, name)), match[1]);
      assert.ok(target.startsWith(skill + path.sep), `package link escapes: ${name}`);
      await access(target);
    }
  }
  const entry = await readFile(path.join(skill, 'SKILL.md'), 'utf8');
  assert.match(entry, /^---\r?\nname: aftertaste-reader\r?\ndescription: .+\r?\n---/);
});

test('合成项目可重建同一 Git 提交，工作区差异独立存在', async () => {
  const runs = path.join(root, '.local/D010');
  await mkdir(runs, { recursive: true });
  const run = await mkdtemp(path.join(runs, 'fixture-check-'));
  const first = await createGenerationProject(path.join(run, 'first'));
  const second = await createGenerationProject(path.join(run, 'second'));
  assert.equal(first.commit, second.commit);
  assert.equal(await readFile(path.join(first.projectRoot, 'src/rules.mjs'), 'utf8'), 'export const WORKTREE_ONLY = true;\n');
  await assert.rejects(createGenerationProject(first.projectRoot), { code: 'EEXIST' });
});
