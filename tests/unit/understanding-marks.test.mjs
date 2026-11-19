import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { parseMarkEdit, parseUnderstandingMarks } from '../../dist/core/understanding-marks.js';
import { rulesPath, servicePath, sharedBlockId } from '../fixtures/bookmark-project.mjs';

test('understanding records preserve literal annotation text and require unique block identity', () => {
  const record = { documentPath: rulesPath, blockId: sharedBlockId, status: 'unmarked', annotation: '  <问>\r\n🌱  ' };
  const data = marks => JSON.stringify({ version: 1, marks });
  const other = { ...record, documentPath: servicePath, status: 'not-understood', annotation: '' };
  assert.deepEqual(parseUnderstandingMarks(data([record, other])), [record, other]);
  for (const marks of [[record, record], [{ ...record, annotation: '' }], [{ ...record, blockId: 'invalid' }],
    [{ ...record, annotation: '\ud800' }], [{ ...record, status: 'unknown' }], [{ ...record, note: 'extra' }]]) {
    assert.throws(() => parseUnderstandingMarks(data(marks)), { code: 'MARK_DATA_INVALID' });
  }
  const edit = { documentPath: rulesPath, blockId: sharedBlockId, field: 'annotation',
    previous: createHash('sha256').digest('hex'), value: record.annotation };
  assert.deepEqual(parseMarkEdit(edit), edit);
  for (const invalid of [{ ...edit, field: 'status' }, { ...edit, previous: null }, { ...edit, previous: '原文' },
    { ...edit, status: 'understood' }]) {
    assert.throws(() => parseMarkEdit(invalid), { code: 'MARK_ARGUMENT_INVALID' });
  }
});
