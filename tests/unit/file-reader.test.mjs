import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { DocumentService } from '../../dist/application/document-blocks.js';
import { renderMarkdown } from '../../src/web/markdown.ts';
import { translate, problemText, readLanguage, saveLanguage } from '../../src/web/i18n.ts';

const commit = 'a'.repeat(40);
const mapping = { projectRoot: path.resolve('D:/synthetic'), repositoryRoot: path.resolve('D:/synthetic'), projectPrefix: '' };

test('reading uses one document snapshot for raw, ranges, validation and source', async () => {
  let reads = 0;
  const raw = `<!-- aftertaste:document commit=${commit} -->\n\n<!-- aftertaste:block id=abcdefgh lines=1-3 -->\nBody\n<!-- aftertaste:end -->\n`;
  const service = new DocumentService({ read: async (source, sourcePath) => {
    assert.equal(source.commit, commit);
    assert.equal(sourcePath, 'src/a.ts');
    return { content: '// comment\r\n\r\nlast\r\n' };
  } }, { read: async () => { reads++; return raw; } });
  const result = await service.read(mapping, 'docs/aftertaste/current/src/a.ts.md');
  assert.equal(reads, 1);
  assert.equal(result.raw, raw);
  assert.equal(result.mechanicallyValid, true);
  assert.deepEqual(result.sourceLines, ['// comment', '', 'last']);
});

test('reading snapshots the project mapping before awaiting disk', async () => {
  const input = { ...mapping };
  const service = new DocumentService({ read: async source => {
    assert.deepEqual(source, { ...mapping, commit });
    return { content: '' };
  } }, { read: async () => {
    input.projectRoot = 'D:/changed';
    return `<!-- aftertaste:document commit=${commit} -->\n\n<!-- aftertaste:block id=abcdefgh -->\nBody\n<!-- aftertaste:end -->\n`;
  } });
  assert.equal((await service.read(input, 'docs/aftertaste/current/src/a.ts.md')).mechanicallyValid, true);
});

test('Markdown is text-safe and blocks automatic resource loads and filesystem links', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n![secret](https://external.invalid/a)\n\n[x](file:///C:/a) [local](../../secret) [bad](javascript:alert(1)) [good](https://example.com)\n\n```html\n<img onerror=alert(1)>\n```');
  assert.doesNotMatch(html, /<script|<img|href="(?:file:|javascript:|\.\.)/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /&lt;img onerror/);
});

test('language defaults, saved values, denied storage and fallback', () => {
  assert.equal(readLanguage({ getItem: () => 'en' }), 'en');
  assert.equal(readLanguage({ getItem: () => 'bad' }), 'zh-CN');
  assert.equal(readLanguage({ getItem: () => { throw new Error(); } }), 'zh-CN');
  assert.equal(saveLanguage('en', { setItem: () => { throw new Error(); } }), false);
  assert.equal(translate('en', 'brand'), '回味');
  assert.match(problemText('en', { code: 'SOURCE_GAP', params: { start: 2, end: 4 } }).message, /2.*4/);
});

test('reading preserves each physical line across newline styles and empty inputs', async () => {
  for (const expected of [[], [''], ['a'], ['// comment', '', 'tail'], ['中文', 'x'.repeat(2000)]]) {
    for (const separator of ['\n', '\r\n', '\r']) {
      for (const terminated of [false, true]) {
        if (expected.length === 1 && expected[0] === '' && !terminated) continue;
        const content = expected.join(separator) + (terminated && expected.length ? separator : '');
        const range = expected.length ? ` lines=1-${expected.length}` : '';
        const raw = `<!-- aftertaste:document commit=${commit} -->\n\n<!-- aftertaste:block id=abcdefgh${range} -->\nBody\n<!-- aftertaste:end -->\n`;
        const service = new DocumentService({ read: async () => ({ content }) }, { read: async () => raw });
        const result = await service.read(mapping, 'docs/aftertaste/current/src/a.ts.md');
        assert.deepEqual(result.sourceLines, expected);
        assert.equal(result.mechanicallyValid, true);
      }
    }
  }
});

test('reading keeps exact warning thresholds and unfilled status', async () => {
  for (const [lineCount, size] of [[60, 1200], [61, 1201], [0, 0]]) {
    const content = 'a\n'.repeat(lineCount);
    const range = lineCount ? ` lines=1-${lineCount}` : '';
    const raw = `<!-- aftertaste:document commit=${commit} -->\n\n<!-- aftertaste:block id=abcdefgh${range} -->\n${'文'.repeat(size)}\n<!-- aftertaste:end -->\n`;
    const service = new DocumentService({ read: async () => ({ content }) }, { read: async () => raw });
    const result = await service.read(mapping, 'docs/aftertaste/current/src/a.ts.md');
    assert.equal(result.mechanicallyValid, true);
    assert.equal(result.diagnostics.some(d => d.code === 'SOURCE_TOO_LARGE'), lineCount > 60);
    assert.equal(result.diagnostics.some(d => d.code === 'EXPLANATION_TOO_LARGE'), size > 1200);
    assert.equal(result.contentStatus, size ? 'provided' : 'unfilled');
  }
});

test('all predictable reading diagnostic codes have English messages and recovery', () => {
  const codes = ['DOCUMENT_HEADER', 'OUTSIDE_CONTENT', 'MARKER_INVALID', 'BLOCK_ORPHAN_END', 'BLOCK_NESTED',
    'BLOCK_FIELDS_INVALID', 'BLOCK_ID_INVALID', 'BLOCK_ID_DUPLICATE', 'RANGE_INVALID', 'BLOCK_UNCLOSED',
    'EXPLANATION_EMPTY', 'EXPLANATION_TOO_LARGE', 'SOURCE_TOO_LARGE', 'SOURCE_BOUNDS', 'SOURCE_ORDER',
    'SOURCE_GAP', 'SOURCE_OVERLAP', 'SOURCE_UNAVAILABLE', 'INVALID_ARGUMENT', 'INVALID_PATH',
    'DOCUMENT_PATH_UNSAFE', 'DOCUMENT_READ_FAILED', 'DOCUMENT_LIST_FAILED', 'PROJECT_UNAVAILABLE',
    'PROJECT_PATH_UNSAFE', 'NOT_REPOSITORY', 'GIT_UNAVAILABLE', 'NO_COMMIT', 'INVALID_REVISION',
    'OBJECT_UNAVAILABLE', 'FILE_NOT_FOUND', 'UNSUPPORTED_FILE_TYPE', 'UNSUPPORTED_ENCODING',
    'UNSUPPORTED_TARGET', 'GIT_READ_FAILED', 'ACCESS_DENIED', 'NOT_FOUND', 'METHOD_NOT_ALLOWED',
    'NETWORK_ERROR', 'INTERNAL_ERROR'];
  for (const code of codes) {
    const message = problemText('en', { code, message: '中文哨兵', nextStep: '中文哨兵' });
    assert.doesNotMatch(message.message + message.nextStep, /[\u4e00-\u9fff]/, code);
    assert.ok(message.message.length && message.nextStep.length, code);
  }
});
