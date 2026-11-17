import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createGenerationProject } from '../fixtures/generation-project.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sample = path.join(root, 'docs/work/2026/11/D010-generation-skill/sample');

test('已归档的首批试读产物可在重建固定源码上真实校验', async () => {
  const runs = path.join(root, '.local/D010');
  await mkdir(runs, { recursive: true });
  const run = await mkdtemp(path.join(runs, 'sample-check-'));
  const fixed = await createGenerationProject(path.join(run, 'project'));
  const data = path.join(fixed.projectRoot, 'docs/aftertaste');
  await mkdir(data, { recursive: true });
  for (const file of ['current', 'dependency-graph.json', 'preferences.md', 'reading-direction.md']) {
    await cp(path.join(sample, file), path.join(data, file), { recursive: true, errorOnExist: true, force: false });
  }
  const mapping = ['--project', fixed.projectRoot, '--repository', fixed.projectRoot, '--prefix', ''];
  const sourceArgs = [...mapping, '--commit', fixed.commit];
  const cli = (command, args) => JSON.parse(execFileSync(process.execPath,
    [path.join(root, 'dist/cli/main.js'), command, ...args],
    { encoding: 'utf8', cwd: run, windowsHide: true }));
  for (const name of ['rules', 'service']) {
    const document = `docs/aftertaste/current/src/${name}.mjs.md`;
    const before = await readFile(path.join(fixed.projectRoot, document));
    const { result } = cli('validate-document', [...mapping, '--document', document]);
    assert.equal(result.mechanicallyValid, true);
    assert.equal(result.sourceCheck, 'completed');
    assert.equal(result.contentStatus, 'provided');
    assert.equal(result.teachingQuality, 'unchecked');
    assert.equal(result.sourceLineCount, fixed.sourceLines[`src/${name}.mjs`]);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(await readFile(path.join(fixed.projectRoot, document)), before);
  }
  const { result } = cli('validate-graph', sourceArgs);
  assert.equal(result.mechanicallyValid, true);
  assert.equal(result.sourceCheck, 'completed');
  const graph = JSON.parse(await readFile(path.join(data, 'dependency-graph.json'), 'utf8'));
  assert.equal(graph.source_commit, fixed.commit);
  assert.deepEqual(graph.nodes, [
    { path: 'src/rules.mjs', analysis: 'reviewed' },
    { path: 'src/service.mjs', analysis: 'reviewed' },
    { path: 'support/audit.mjs', analysis: 'unreviewed' },
  ]);
  assert.deepEqual(graph.edges.map(({ dependency, dependent }) => [dependency, dependent]), [
    ['src/rules.mjs', 'src/service.mjs'], ['support/audit.mjs', 'src/service.mjs'],
  ]);
  assert.deepEqual((await readdir(path.join(data, 'current/src'))).sort(), ['rules.mjs.md', 'service.mjs.md']);
  await assert.rejects(readdir(path.join(data, 'current/support')), { code: 'ENOENT' });
});
