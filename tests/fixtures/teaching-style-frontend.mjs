import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const project = path.resolve(process.argv[2]);
await mkdir(project);

await writeFile(path.join(project, 'index.html'), `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Gallery filter</title>
<label>Tag <select id="tag">
  <option value="all">All</option>
  <option value="ink">Ink</option>
  <option value="clay">Clay</option>
  <option value="wood">Wood</option>
</select></label>
<p id="count" aria-live="polite"></p>
<ul id="gallery"></ul>
<script type="module" src="./gallery.mjs"></script>
</html>
`);
await writeFile(path.join(project, 'gallery.mjs'), `import { selectPieces } from './filter.mjs';

const pieces = [
  { title: 'Night river', tag: 'ink' },
  { title: 'Small bowl', tag: 'clay' },
];
const tag = document.querySelector('#tag');
const gallery = document.querySelector('#gallery');
const count = document.querySelector('#count');

function render() {
  const visible = selectPieces(pieces, tag.value);
  gallery.replaceChildren(...visible.map(({ title }) => {
    const item = document.createElement('li');
    item.textContent = title;
    return item;
  }));
  count.textContent = visible.length ? String(visible.length) + ' shown' : 'No pieces';
}

tag.addEventListener('change', render);
render();
`);
await writeFile(path.join(project, 'filter.mjs'), `export function selectPieces(pieces, tag) {
  return tag === 'all' ? pieces : pieces.filter(piece => piece.tag === tag);
}
`);

const git = (...args) => execFileSync('git', ['-C', project, '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' });
git('init', '--initial-branch=main', '--object-format=sha1');
git('add', 'index.html', 'gallery.mjs', 'filter.mjs');
execFileSync('git', ['-C', project, '-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid',
  '-c', 'commit.gpgsign=false', '-c', 'i18n.commitEncoding=UTF-8', 'commit', '-m', 'synthetic gallery fixture'], {
  encoding: 'utf8',
  env: { ...process.env, GIT_AUTHOR_DATE: '2026-11-24T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-24T00:00:00Z' },
});
console.log(JSON.stringify({ projectRoot: project, commit: git('rev-parse', 'HEAD').trim() }));
