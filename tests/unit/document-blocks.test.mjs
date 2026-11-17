import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDocument, checkDocument, generateSkeleton, physicalLineCount, explanationSize,
} from '../../dist/core/document-blocks.js';

const commit = 'a'.repeat(40);
const documentPath = 'docs/aftertaste/current/a.ts.md';
const header = `<!-- aftertaste:document commit=${commit} -->\n`;
const block = (body = '讲解\n', fields = 'id=abcdefgh lines=1-1') =>
  `<!-- aftertaste:block ${fields} -->\n${body}<!-- aftertaste:end -->\n`;
const check = (raw, count = 1) => checkDocument(parseDocument(raw, documentPath), count);
const codes = result => result.diagnostics.map(problem => problem.code);

test('两类块混排，标题不分块，CRLF 正文逐字保留', () => {
  const body = '\r\n## 标题\r\n\r\n- 一\r\n- 二  \r\n';
  const raw = header + block(body) + block('背景\n', 'id=ijklmnop');
  const result = check(raw);
  assert.equal(result.mechanicallyValid, true);
  assert.equal(result.blocks.length, 2);
  assert.equal(result.blocks[0].body, body);
  assert.equal(result.blocks[1].lines, undefined);
  assert.equal(result.raw, raw);
  assert.equal(result.teachingQuality, 'unchecked');
});

test('CommonMark 代码与容器中的标记均是正文', () => {
  const example = '<!-- aftertaste:block id=zzzzzzzz lines=99-99 -->';
  const end = '<!-- aftertaste:end -->';
  const bodies = [
    `\n\`\`\`md\n${example}\n${end}\n\`\`\`\n\n`,
    `\n~~~~\n${example}\n${end}\n~~~~\n\n`,
    `\n    ${example}\n    ${end}\n\n`,
    `\n> ${example}\n> ${end}\n\n`,
    `\n- 项目\n\n  ${example}\n  ${end}\n\n`,
    `\n1. ${example}\n   ${end}\n\n`,
    `\n<div>\n${example}\n${end}\n</div>\n\n`,
    `\n<!-- 普通注释\n${example}\n\n`,
    `\n正文 ${example}\n\n`,
  ];
  for (const body of bodies) {
    const result = check(header + block(body));
    assert.equal(result.mechanicallyValid, true, JSON.stringify({ body, codes: codes(result) }));
    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0].body, body);
  }
});

test('顶层连续注释、三空格标记与尾随空格', () => {
  const raw = header + '   <!-- aftertaste:block id=abcdefgh lines=1-1 -->  \n文\n   <!-- aftertaste:end -->\n' +
    block('背景\n', 'id=12345678');
  assert.equal(check(raw).mechanicallyValid, true);
  assert.equal(check(raw).blocks[0].startLine, 2);
});

test('坏字段和坏 ID 不静默变为纯讲解', () => {
  for (const fields of ['id=ABCDEFGH lines=1-1', 'id=short lines=1-1', 'id=abcdefghi lines=1-1',
    'lines=1-1', 'id=abcdefgh id=ijklmnop', 'id=abcdefgh extra=x', 'id=abcdefgh lines=no',
    'id=abcdefgh lines=0-1', 'id=abcdefgh lines=2-1', 'id=abcdefgh lines=01-1',
    'id=abcdefgh lines=1-1 lines=1-1', 'id=abcdefgh lines=1-9007199254740992']) {
    const result = check(header + block('文\n', fields));
    assert.equal(result.structureValid, false, fields);
    assert.equal(result.renderMode, 'markdown');
    assert.equal(result.blocks.length, 0, fields);
    assert.ok(result.diagnostics.some(problem => problem.line === 2 && problem.nextStep));
  }
});

test('嵌套、缺配对、重复 ID、坏标记均有稳定诊断', () => {
  const cases = [
    [header + block() + block('背景\n', 'id=abcdefgh'), 'BLOCK_ID_DUPLICATE'],
    [header + '<!-- aftertaste:end -->\n', 'BLOCK_ORPHAN_END'],
    [header + '<!-- aftertaste:block id=abcdefgh lines=1-1 -->\n', 'BLOCK_UNCLOSED'],
    [header + block(block()), 'BLOCK_NESTED'],
    [header + '<!-- aftertaste:block id=abcdefgh lines=1-1\n', 'MARKER_INVALID'],
    [header + '<!-- aftertaste:end bad=x -->\n', 'MARKER_INVALID'],
    [header + '<!-- aftertaste:block id=abcdefgh lines=1-1 --> 尾随内容\n', 'MARKER_INVALID'],
    [header + '<!-- aftertaste:block\nid=abcdefgh -->\n', 'MARKER_INVALID'],
  ];
  for (const [raw, code] of cases) {
    const result = check(raw);
    assert.ok(codes(result).includes(code), JSON.stringify({ code, actual: codes(result) }));
    assert.equal(result.mechanicallyValid, false);
    assert.equal(result.raw, raw);
  }
});

test('文档头严格，块外内容明确报错', () => {
  for (const raw of [block(), header.replace(commit, 'HEAD') + block(),
    header.replace(' -->', ' path=a.ts -->') + block(), '\n' + header + block(), header + header + block()]) {
    assert.ok(codes(check(raw)).includes('DOCUMENT_HEADER'));
  }
  assert.ok(codes(check(header + '外部正文\n' + block())).includes('OUTSIDE_CONTENT'));
  assert.equal(check('\uFEFF' + header + block()).mechanicallyValid, true);
});

test('覆盖独立反例包含空行、漏行、重叠、逆序与越界', () => {
  const raw = ranges => header + ranges.map(([start, end], index) =>
    block('文\n', `id=${String(index).padStart(8, '0')} lines=${start}-${end}`)).join('');
  for (const [ranges, code] of [
    [[[2, 3]], 'SOURCE_GAP'], [[[1, 1]], 'SOURCE_GAP'],
    [[[1, 2], [2, 3]], 'SOURCE_OVERLAP'], [[[2, 3], [1, 1]], 'SOURCE_ORDER'],
    [[[1, 4]], 'SOURCE_BOUNDS'],
  ]) assert.ok(codes(check(raw(ranges), 3)).includes(code), code);
  assert.ok(codes(check(header, 1)).includes('SOURCE_GAP'));
  assert.equal(check(header, 0).mechanicallyValid, true);
  assert.ok(codes(check(header + block(), 0)).includes('SOURCE_BOUNDS'));
});

test('物理行口径涵盖 LF、CRLF、CR、空白及末尾换行', () => {
  for (const [text, count] of [['', 0], ['a', 1], ['a\n', 1], ['\n', 1], ['\r\n', 1],
    ['\r', 1], ['\n\n', 2], ['a\r\nb', 2], ['// 注释\r\n\r\n ', 3]]) {
    assert.equal(physicalLineCount(text), count, JSON.stringify(text));
  }
  for (const eol of ['\n', '\r\n', '\r']) {
    const raw = (header + block()).replaceAll('\n', eol);
    assert.equal(check(raw).mechanicallyValid, true);
    assert.equal(check(raw).blocks[0].body, `讲解${eol}`);
  }
});

test('Unicode 码点和 White_Space 边界，警告保持机械合法', () => {
  assert.equal(explanationSize('😀e\u0301\u200b\uFEFF \t\n\u0085\u00a0\u1680\u2000\u2028\u2029\u202f\u205f\u3000'), 5);
  for (const size of [1200, 1201]) {
    for (const fields of ['id=abcdefgh lines=1-1', 'id=abcdefgh']) {
      const result = check(header + block('😀'.repeat(size) + '\n', fields), fields.includes('lines') ? 1 : 0);
      assert.equal(codes(result).includes('EXPLANATION_TOO_LARGE'), size > 1200);
      assert.equal(result.mechanicallyValid, true);
    }
  }
  for (const count of [60, 61]) {
    const result = check(header + block('文\n', `id=abcdefgh lines=1-${count}`), count);
    assert.equal(codes(result).includes('SOURCE_TOO_LARGE'), count > 60);
    assert.equal(result.renderMode, 'comparison');
  }
});

test('生成只含引用，空正文待填写，碰撞重试且有界', () => {
  const ids = ['aaaaaaaa', 'aaaaaaaa', 'bbbbbbbb', 'cccccccc'];
  const raw = generateSkeleton(commit, [{ lines: { start: 1, end: 1 } }, {}, { lines: { start: 2, end: 3 } }], 3, () => ids.shift());
  const result = check(raw, 3);
  assert.equal(result.mechanicallyValid, true);
  assert.equal(result.contentStatus, 'unfilled');
  assert.deepEqual(result.blocks.map(item => item.id), ['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
  assert.equal(check(generateSkeleton(commit, [], 0), 0).mechanicallyValid, true);
  assert.throws(() => generateSkeleton(commit, [{}, {}], 0, () => 'aaaaaaaa'), { code: 'ID_GENERATION_FAILED' });
  for (const plan of [null, {}, [null], [{ lines: '1-1' }], [{ id: 'abcdefgh' }],
    [{ lines: { start: 1, end: 1, extra: 2 } }], [{ lines: { start: 2, end: 1 } }], []]) {
    assert.throws(() => generateSkeleton(commit, plan, 1), { code: 'BLOCK_PLAN_INVALID' });
  }
});

test('生成解析与覆盖性质，枚举分界、注入纯讲解和独立占用数组', () => {
  for (let length = 1; length <= 8; length++) {
    for (let mask = 0; mask < 2 ** (length - 1); mask++) {
      const plan = [];
      let start = 1;
      for (let line = 1; line <= length; line++) {
        if (line === length || (mask & (1 << (line - 1)))) {
          plan.push({ lines: { start, end: line } }, {});
          start = line + 1;
        }
      }
      const raw = generateSkeleton(commit, plan, length);
      const result = check(raw, length);
      assert.equal(result.mechanicallyValid, true, JSON.stringify({ length, mask }));
      assert.equal(new Set(result.blocks.map(item => item.id)).size, plan.length);
      const occupancy = Array(length).fill(0);
      for (const item of result.blocks) {
        assert.match(item.id, /^[a-z0-9]{8}$/u);
        if (item.lines) for (let i = item.lines.start; i <= item.lines.end; i++) occupancy[i - 1]++;
      }
      assert.deepEqual(occupancy, Array(length).fill(1));
      const body = '\n## 合成😀\n\n> 引用  \n\n';
      const filled = raw.replaceAll('\n\n<!-- aftertaste:end -->', `\n${body}<!-- aftertaste:end -->`);
      assert.ok(check(filled, length).blocks.every(item => item.body === body));
    }
  }
});

test('覆盖判定与直接展开行序列的独立预期相符', () => {
  const ranges = [];
  for (let start = 1; start <= 4; start++) {
    for (let end = start; end <= 4; end++) ranges.push({ start, end });
  }
  const sequences = [[], ...ranges.map(range => [range]), ...ranges.flatMap(first => ranges.map(second => [first, second]))];
  for (const sequence of sequences) {
    const raw = header + sequence.map((range, index) => block('文\n',
      `id=${String(index).padStart(8, '0')} lines=${range.start}-${range.end}`)).join('');
    const expanded = sequence.flatMap(range => Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i));
    assert.equal(check(raw, 3).mechanicallyValid, JSON.stringify(expanded) === '[1,2,3]', JSON.stringify(sequence));
  }
});
