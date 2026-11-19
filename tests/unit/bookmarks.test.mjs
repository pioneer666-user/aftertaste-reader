import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { parseBookmarkAction, parseBookmarks } from '../../dist/core/bookmarks.js';

const entry = { id: randomUUID(), documentPath: 'docs/aftertaste/current/a.ts.md', blockId: 'example1', note: '  原文\n<字>  ' };

test('bookmark data preserves notes, rejects corrupt records and duplicate IDs', () => {
  const data = bookmarks => JSON.stringify({ version: 1, bookmarks });
  const blank = { ...entry, id: randomUUID(), note: '' };
  assert.deepEqual(parseBookmarks(data([entry, blank])), [entry, blank]);
  for (const corrupt of ['!', '{"version":2,"bookmarks":[]}', data([entry, entry]),
    data([{ ...entry, blockId: 'A' }]), data([{ ...entry, extra: 1 }]), data([{ ...entry, note: [] }])]) {
    assert.throws(() => parseBookmarks(corrupt), { code: 'BOOKMARK_DATA_INVALID' });
  }
});

test('bookmark commands accept exact per-record fields and preserve note text', () => {
  const create = { action: 'create', ...entry };
  assert.deepEqual(parseBookmarkAction(create), create);
  const edit = { action: 'edit', id: entry.id, previousNote: entry.note, note: '' };
  assert.deepEqual(parseBookmarkAction(edit), edit);
  assert.throws(() => parseBookmarkAction({ ...create, projectRoot: 'C:/other' }), { code: 'INVALID_ARGUMENT' });
  assert.throws(() => parseBookmarkAction({ ...edit, documentPath: entry.documentPath }), { code: 'INVALID_ARGUMENT' });
  assert.throws(() => parseBookmarkAction({ action: 'remove', id: entry.id }), { code: 'INVALID_ARGUMENT' });
});
