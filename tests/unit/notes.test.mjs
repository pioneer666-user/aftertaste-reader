import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { blockLink, blockTarget, parseNoteAction, parseNotes } from '../../dist/core/notes.js';
import { blockLinkInsertion, renderMarkdown } from '../../src/web/markdown.ts';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt();

test('note records preserve original content and reject invalid data or operations', () => {
  const note = { id: randomUUID(), revision: randomUUID(), body: '  问题 🌱\n', tags: [' 调查 ', 'x,y'] };
  const serialized = notes => JSON.stringify({ version: 1, notes });
  assert.deepEqual(parseNotes(serialized([note])), [note]);
  for (const invalid of [[note, note], [{ ...note, body: '\ud800' }], [{ ...note, tags: [' '] }],
    [{ ...note, tags: ['同', '同'] }], [{ ...note, documentPath: 'unexpected' }]]) {
    assert.throws(() => parseNotes(serialized(invalid)), { code: 'NOTE_DATA_INVALID' });
  }
  const create = { action: 'save', previousRevision: null, ...note };
  assert.deepEqual(parseNoteAction(create), create);
  assert.throws(() => parseNoteAction({ ...create, previousRevision: note.revision }), { code: 'INVALID_ARGUMENT' });
  assert.throws(() => parseNoteAction({ ...create, project: '../outside' }), { code: 'INVALID_ARGUMENT' });
});

test('block links preserve literal punctuation and newlines and carry the complete document identity', () => {
  const target = { documentPath: "docs/aftertaste/current/src/路径 (it's #1).ts.md", blockId: 'visit001' };
  const quote = '  # [内容](https://example.org) & <> `代码`\n第二行 🌱  ';
  const link = blockLink({ ...target, text: quote });
  const encoded = link.slice(link.indexOf('<') + 1, -2);
  assert.deepEqual(blockTarget(encoded), target);
  assert.match(markdown.render(link), /href="#aftertaste-block\//u);
  const children = markdown.parseInline(link, {})[0].children;
  assert.deepEqual(children.map(token => token.type), ['link_open', 'text', 'link_close']);
  assert.equal(children[1].content, quote);
  assert.equal(blockTarget('#aftertaste-block/%/visit001'), undefined);
  assert.equal(blockTarget('#aftertaste-block/..%2Fnotes.json/visit001'), undefined);
  assert.equal(blockTarget('#aftertaste-block/docs/visit001'), undefined);
  const body = '~~~text\n已有内容';
  const html = renderMarkdown(body + blockLinkInsertion(body, link), {
    prefix: '#aftertaste-block/', title: '回到讲解块',
  });
  assert.match(html, /<pre><code class="language-text">已有内容\n<\/code><\/pre>/u);
  assert.match(html, /class="note-block-link" title="回到讲解块"/u);
});

test('同源步骤分别定位；原句的标点、换行与文字逐字保留', () => {
  for (const stepId of ['start', 'resume']) {
    const target = { loopId: 'order-quantity', stepId };
    const text = '「对象」 "ready"\n集合 [0]';
    const tokens = markdown.parseInline(blockLink({ ...target, text }), {})[0].children;
    assert.deepEqual(blockTarget(tokens[0].attrGet('href')), target);
    assert.equal(tokens[1].content, text);
  }
  for (const path of ['con/start', 'orders/../resume', 'orders/', 'orders/%2f']) {
    assert.equal(blockTarget('#aftertaste-loop/' + path), undefined);
  }
});
