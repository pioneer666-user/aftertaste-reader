import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const firstBlock = 'syntax01';
export const documentPath = file => `docs/aftertaste/current/${file}.md`;
export const blockLink = (origin, file, block = firstBlock) =>
  `${origin}/#aftertaste-block/${encodeURIComponent(documentPath(file))}/${block}`;

export const examples = {
  'config.py': {
    lines: ['from demo import example', '', 'message = """if <message> &', '', '\tclass Test is text',
      '"""', '# if this is a comment', 'class Demo:', '    label = "Ready"'],
    samples: [[1, 'from', 'keyword'], [1, 'import', 'keyword'], [1, 'demo', 'plain'],
      [3, 'if <message> &', 'string'], [5, 'class Test', 'string'], [7, 'if this', 'comment'],
      [8, 'class', 'keyword'], [8, 'Demo', 'plain'], [9, 'Ready', 'string']],
    split: 3,
  },
  'Demo.java': { lines: ['public class Demo { String label = "Ready"; }'], samples: [[1, 'public', 'keyword'], [1, 'Ready', 'string']] },
  'demo.c': { lines: ['static const char *label = "Ready";'], samples: [[1, 'static', 'keyword'], [1, 'Ready', 'string']] },
  'Demo.vue': {
    lines: ['<template>', '  <button aria-label="Example">{{ message }}</button>', '</template>',
      '<script setup lang="ts">', 'const message: string = "Ready";', '</script>',
      '<style>', '.notice { color: red; }', '</style>'],
    samples: [[2, 'button', 'tag'], [2, 'aria-label', 'property'], [2, 'Example', 'string'],
      [5, 'const', 'keyword'], [5, 'message', 'plain'], [5, 'Ready', 'string'], [8, 'notice', 'tag'], [8, 'color', 'property']],
  },
  'demo.js': { lines: ['const message = "Ready"; // return'], samples: [[1, 'const', 'keyword'], [1, 'return', 'comment']] },
  'demo.ts': { lines: ['const message: string = "Ready";'], samples: [[1, 'const', 'keyword'], [1, 'Ready', 'string']] },
  'demo.html': { lines: ['<main title="Ready">&amp;</main>'], samples: [[1, 'main', 'tag'], [1, 'title', 'property'], [1, 'Ready', 'string']] },
  'demo.css': { lines: ['.notice { color: red; }'], samples: [[1, 'notice', 'tag'], [1, 'color', 'property']] },
  'demo.hpp': { lines: ['namespace demo { const char *label = "Ready"; }'], samples: [[1, 'namespace', 'keyword']] },
  'demo.h': { lines: ['struct demo { const char *label; };'], samples: [[1, 'struct', 'keyword']] },
  'Demo.cs': { lines: ['public class Demo { string Label = "Ready"; }'], samples: [[1, 'public', 'keyword'], [1, 'Ready', 'string']] },
  'demo.go': { lines: ['package demo', 'const label = "Ready"'], samples: [[1, 'package', 'keyword'], [2, 'Ready', 'string']] },
  'demo.rs': { lines: ['pub const LABEL: &str = "Ready";'], samples: [[1, 'pub', 'keyword'], [1, 'Ready', 'string']] },
  'demo.php': { lines: ['<?php', 'return "Ready";'], samples: [[2, 'return', 'keyword'], [2, 'Ready', 'string']] },
  'demo.rb': { lines: ['def label', '  "Ready"', 'end'], samples: [[1, 'def', 'keyword'], [2, 'Ready', 'string']] },
  'demo.sh': { lines: ['if true; then', '  printf "Ready"', 'fi'], samples: [[1, 'if', 'keyword'], [2, 'Ready', 'string']] },
  'demo.ps1': { lines: ['if ($true) { Write-Output "Ready" }'], samples: [[1, 'if', 'keyword'], [1, 'Ready', 'string']] },
  'demo.sql': { lines: ['SELECT label FROM demo WHERE label = \'Ready\';'], samples: [[1, 'SELECT', 'keyword'], [1, 'Ready', 'string']] },
  'demo.json': { lines: ['{"label": "Ready"}'], samples: [[1, 'Ready', 'string']] },
  'demo.yml': { lines: ['label: "Ready" # if'], samples: [[1, 'Ready', 'string'], [1, '# if', 'comment']] },
  'Dockerfile': { lines: ['FROM scratch', 'LABEL label="Ready"'], samples: [[1, 'FROM', 'keyword'], [2, 'Ready', 'string']] },
  'alias.mjs': { lines: ['export const label = "Ready";'], samples: [[1, 'export', 'keyword']] },
  'alias.mts': { lines: ['export const label: string = "Ready";'], samples: [[1, 'export', 'keyword']] },
  'settings.tf': { lines: ['variable "demo" { default = "Ready" }'], samples: [] },
  'unknown.aftertaste-example': {
    lines: ['  <b data-test="keep">& sample</b>', '', '\t' + 'scroll '.repeat(120) + 'REACHABLE_END'],
    samples: [],
  },
};

export async function createSyntaxProject(root) {
  await mkdir(root);
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' }).trim();
  git('init', '--quiet');
  for (const [file, { lines }] of Object.entries(examples)) await writeFile(path.join(root, file), lines.join('\n') + '\n');
  git('add', '--', ...Object.keys(examples));
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false',
    'commit', '--quiet', '-m', 'Synthetic syntax examples');
  const commit = git('rev-parse', 'HEAD');
  const current = path.join(root, 'docs/aftertaste/current');
  await mkdir(current, { recursive: true });
  for (const [file, { lines, split }] of Object.entries(examples)) {
    const end = split ?? lines.length;
    const markdown = [
      `<!-- aftertaste:document commit=${commit} -->`, '',
      `<!-- aftertaste:block id=${firstBlock} lines=1-${end} -->`,
      `## ${file} · 合成试读`, '', '在固定源码栏阅读本段。', '', '```python', 'from sample import example', '```',
      '<!-- aftertaste:end -->', '',
      ...(split ? [`<!-- aftertaste:block id=syntax02 lines=${split + 1}-${lines.length} -->`,
        '## 源码继续', '', '字符串从上一块延续到这一块。', '<!-- aftertaste:end -->', ''] : []),
    ];
    await writeFile(path.join(root, documentPath(file)), markdown.join('\n'));
  }
  // The working tree deliberately differs from the Git source used by the explanation.
  await writeFile(path.join(root, 'config.py'), '# working tree only\n');
  return commit;
}
