import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { workspace } from '../fixtures/fixed-source.mjs';
import { createGenerationProject } from '../fixtures/generation-project.mjs';

test('按 Skill 校验讲解和图，分别取得有效结果、无效结果和调用错误', async () => {
  const runs = path.join(workspace, '.local/D018');
  await mkdir(runs, { recursive: true });
  const run = await mkdtemp(path.join(runs, 'validation-'));
  const { projectRoot, commit } = await createGenerationProject(path.join(run, 'project'));
  const markdown = await readFile(path.join(workspace, 'skills/aftertaste-reader/references/tools.md'), 'utf8');
  const firstExample = section => section.match(/^\x60{3}javascript\r?\n([\s\S]*?)^\x60{3}$/mu)[1];
  const setup = firstExample(markdown);
  const validation = firstExample(markdown.split('## 读取校验结果')[1]);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const load = new AsyncFunction('cli', 'projectRoot', 'revision', 'previousFixed',
    [setup, validation, 'return { runValidation, mapping, sourceArgs };'].join('\n'));
  const { runValidation, mapping, sourceArgs } = await load(path.join(workspace, 'dist/cli/main.js'), projectRoot);

  // A missing graph is an operation error on stderr, also with exit code 1.
  assert.throws(() => runValidation(['validate-graph', ...sourceArgs]), error =>
    error.status === 1 && error.code === 'GRAPH_NOT_FOUND' && error.context.projectRoot === projectRoot);

  const sample = path.join(workspace, 'docs/work/2026/11/D010-generation-skill/sample');
  const document = 'docs/aftertaste/current/src/rules.mjs.md';
  const target = path.join(projectRoot, document);
  const raw = await readFile(path.join(sample, 'current/src/rules.mjs.md'), 'utf8');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, raw);
  const checkDocument = () => runValidation(['validate-document', ...mapping, '--document', document]);
  assert.equal(checkDocument().mechanicallyValid, true);
  await writeFile(target, raw.replace('<!-- aftertaste:end -->', ''));
  const invalid = checkDocument();
  assert.equal(invalid.mechanicallyValid, false);
  const unclosed = invalid.diagnostics.find(item => item.code === 'BLOCK_UNCLOSED');
  assert.equal(unclosed.documentPath, document);
  assert.equal(unclosed.blockId, 'x4y6az2y');
  assert.deepEqual(invalid.diagnostics.find(item => item.code === 'SOURCE_GAP').params, { start: 1, end: 7 });

  const graph = JSON.parse(await readFile(path.join(sample, 'dependency-graph.json'), 'utf8'));
  assert.equal(graph.source_commit, commit);
  graph.source_commit = '0'.repeat(commit.length);
  await writeFile(path.join(projectRoot, 'docs/aftertaste/dependency-graph.json'), JSON.stringify(graph));
  const unavailable = runValidation(['validate-graph', ...mapping, '--commit', graph.source_commit]);
  assert.equal(unavailable.mechanicallyValid, false);
  assert.equal(unavailable.sourceCheck, 'unavailable');
  assert.equal(unavailable.diagnostics[0].field, '$.source_commit');
  assert.equal(unavailable.diagnostics[0].params.sourceCode, 'OBJECT_UNAVAILABLE');
});
