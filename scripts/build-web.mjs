import { build } from 'vite';
import { appendFile, readFile } from 'node:fs/promises';

await build({ build: { license: { fileName: 'third-party-licenses.md' } } });

const notices = [
  ['Shiki TextMate grammars (tm-grammars)', ['tm-grammars/LICENSE', 'tm-grammars/NOTICE']],
  ['Shiki Oniguruma WebAssembly (vscode-oniguruma)', ['vscode-oniguruma/LICENSE.txt', 'vscode-oniguruma/NOTICES.txt']],
  ['File associations (linguist-languages)', ['linguist-languages/LICENSE', 'linguist-languages/ThirdPartyNoticeText.txt']],
];
const libraries = new URL('../node_modules/', import.meta.url);
const output = new URL('../dist/web/third-party-licenses.md', import.meta.url);
for (const [name, paths] of notices) {
  const licenses = await Promise.all(paths.map(path => readFile(new URL(path, libraries), 'utf8')));
  await appendFile(output, `\n\n## ${name}\n\n${licenses.join('\n\n')}`);
}
