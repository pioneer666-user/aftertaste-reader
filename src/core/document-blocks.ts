import { fromMarkdown } from 'mdast-util-from-markdown';

export interface LineRange { readonly start: number; readonly end: number }
export interface BlockPlan { readonly lines?: LineRange }
export interface DocumentBlock extends BlockPlan {
  readonly id: string;
  readonly body: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface Diagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly nextStep: string;
  readonly documentPath: string;
  readonly blockId?: string;
  readonly line?: number;
  readonly params: Readonly<Record<string, string | number>>;
}

export interface ParsedDocument {
  readonly documentPath: string;
  readonly raw: string;
  readonly commit?: string;
  readonly blocks: readonly DocumentBlock[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface DocumentResult extends ParsedDocument {
  readonly structureValid: boolean;
  readonly sourceCheck: 'completed' | 'unavailable' | 'not-run';
  readonly mechanicallyValid: boolean;
  readonly renderMode: 'comparison' | 'markdown';
  readonly contentStatus: 'provided' | 'unfilled';
  readonly teachingQuality: 'unchecked';
  readonly sourceLineCount?: number;
  readonly sourcePath?: string;
  readonly sourceError?: {
    readonly code: string;
    readonly message: string;
    readonly nextStep: string;
    readonly context: Readonly<Record<string, string | number>>;
  };
}

export type DocumentErrorCode = 'BLOCK_PLAN_INVALID' | 'ID_GENERATION_FAILED' | 'DOCUMENT_EXISTS' |
  'DOCUMENT_PATH_UNSAFE' | 'DOCUMENT_READ_FAILED' | 'DOCUMENT_WRITE_FAILED';

export class DocumentError extends Error {
  constructor(
    public readonly code: DocumentErrorCode,
    message: string,
    public readonly nextStep: string,
    public readonly context: Readonly<Record<string, string | number>> = {},
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

export function physicalLineCount(text: string): number {
  if (text === '') return 0;
  const breaks = text.match(/\r\n|\r|\n/gu)?.length ?? 0;
  return breaks + (/[\r\n]$/u.test(text) ? 0 : 1);
}

export function explanationSize(text: string): number {
  let size = 0;
  for (const point of text) if (!/\p{White_Space}/u.test(point)) size++;
  return size;
}

function validRange(value: unknown): value is LineRange {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const range = value as LineRange;
  return Object.keys(value).length === 2 && Number.isSafeInteger(range.start) && range.start > 0 &&
    Number.isSafeInteger(range.end) && range.end >= range.start;
}

function problem(documentPath: string, code: string, message: string, nextStep: string,
  line?: number, blockId?: string, params: Diagnostic['params'] = {}, severity: Diagnostic['severity'] = 'error'): Diagnostic {
  return { code, severity, message, nextStep, documentPath, params,
    ...(line === undefined ? {} : { line }), ...(blockId === undefined ? {} : { blockId }) };
}

export function parseDocument(raw: string, documentPath: string): ParsedDocument {
  const diagnostics: Diagnostic[] = [];
  const blocks: DocumentBlock[] = [];
  const lines = [...raw.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/gu)].filter(match => match[0] !== '');
  const first = lines[0]?.[1]?.replace(/^\uFEFF/u, '') ?? '';
  const header = /^<!-- aftertaste:document commit=([a-f0-9]{40}|[a-f0-9]{64}) -->[ \t]*$/u.exec(first);
  if (!header) diagnostics.push(problem(documentPath, 'DOCUMENT_HEADER', '文档首行缺少合法固定提交头。', '将完整提交写入唯一的首行 document 注释。', 1));
  let cursor = header ? lines[0]!.index + lines[0]![0].length : 0;
  let active: { id?: string; lines?: LineRange; valid: boolean; line: number; bodyStart: number } | undefined;
  const seen = new Set<string>();
  const outside = (end: number, line: number) => {
    if (raw.slice(cursor, end).trim() !== '') diagnostics.push(problem(documentPath, 'OUTSIDE_CONTENT',
      '块外含有非空正文。', '将正文放进成对块标记之间。', line));
  };
  for (const node of fromMarkdown(raw).children) {
    if (node.type !== 'html' || !node.position) continue;
    const position = node.position;
    const row = lines[position.start.line - 1];
    if (!row || !/^ {0,3}<!--\s*aftertaste:/u.test(row[1]!)) continue;
    if (header && position.start.line === 1) continue;
    const line = position.start.line;
    const text = row[1]!;
    const marker = /^ {0,3}<!-- aftertaste:(block(?:[ \t]+.*?)?|end|document(?:[ \t]+.*?)?) -->[ \t]*$/u.exec(text);
    const endOffset = row.index + row[0].length;
    if (!marker || position.end.line !== line) {
      diagnostics.push(problem(documentPath, 'MARKER_INVALID', '块标记必须为独占一行的合法注释。', '按块契约修正标记与闭合符。', line));
      continue;
    }
    const command = marker[1]!;
    if (command.startsWith('document')) {
      diagnostics.push(problem(documentPath, 'DOCUMENT_HEADER', '固定提交头重复或位置无效。', '只保留首行的固定提交头。', line));
      continue;
    }
    if (command === 'end') {
      if (!active) {
        diagnostics.push(problem(documentPath, 'BLOCK_ORPHAN_END', '结束标记没有对应开始标记。', '补齐开始标记或删除多余结束标记。', line));
      } else {
        if (active.valid && active.id) blocks.push({ id: active.id, body: raw.slice(active.bodyStart, row.index),
          startLine: active.line, endLine: line, ...(active.lines ? { lines: active.lines } : {}) });
        active = undefined;
      }
      cursor = endOffset;
      continue;
    }
    if (active) {
      diagnostics.push(problem(documentPath, 'BLOCK_NESTED', '块不能嵌套。', '先结束当前块，再创建下一个块。', line, active.id));
      active.valid = false;
      continue;
    }
    outside(row.index, line);
    active = { valid: true, line, bodyStart: endOffset };
    const fields = new Map<string, string>();
    for (const field of command.slice('block'.length).trim().split(/[ \t]+/u)) {
      const pair = /^(id|lines)=([^\s=]+)$/u.exec(field);
      if (!pair || fields.has(pair[1]!)) {
        diagnostics.push(problem(documentPath, 'BLOCK_FIELDS_INVALID', '块字段非法或重复。', '仅提供一个 id 和可选的一个 lines 字段。', line));
        active.valid = false;
      } else fields.set(pair[1]!, pair[2]!);
    }
    const id = fields.get('id');
    if (!id || !/^[a-z0-9]{8}$/u.test(id)) {
      diagnostics.push(problem(documentPath, 'BLOCK_ID_INVALID', '块 ID 格式无效。', '使用同篇唯一的 8 位小写字母数字 ID。', line));
      active.valid = false;
    } else {
      active.id = id;
      if (seen.has(id)) diagnostics.push(problem(documentPath, 'BLOCK_ID_DUPLICATE', '同篇出现重复块 ID。', '核对块身份并由 AI 修复，不自动重写已有 ID。', line, id));
      seen.add(id);
    }
    if (fields.has('lines')) {
      const range = /^([1-9]\d*)-([1-9]\d*)$/u.exec(fields.get('lines')!);
      const value = range ? { start: Number(range[1]), end: Number(range[2]) } : undefined;
      if (!validRange(value)) {
        diagnostics.push(problem(documentPath, 'RANGE_INVALID', '源码范围无效。', '使用首尾包含的正整数连续范围，如 lines=1-1。', line, active.id));
        active.valid = false;
      } else active.lines = value;
    }
  }
  if (active) diagnostics.push(problem(documentPath, 'BLOCK_UNCLOSED', '开始标记缺少结束标记。', '补齐顶层 aftertaste:end 标记。', active.line, active.id));
  else outside(raw.length, physicalLineCount(raw));
  return { documentPath, raw, blocks, diagnostics, ...(header ? { commit: header[1]! } : {}) };
}

export function checkDocument(parsed: ParsedDocument, sourceLineCount?: number): DocumentResult {
  const diagnostics = [...parsed.diagnostics];
  const structureValid = !diagnostics.some(item => item.severity === 'error');
  let expected = 1;
  let previousStart = 0;
  for (const block of parsed.blocks) {
    const report = (code: string, message: string, nextStep: string, params: Diagnostic['params'] = {}, severity: Diagnostic['severity'] = 'error') =>
      diagnostics.push(problem(parsed.documentPath, code, message, nextStep, block.startLine, block.id, params, severity));
    const size = explanationSize(block.body);
    if (size === 0) report('EXPLANATION_EMPTY', '块正文尚未填写。', '由 AI 填写本块讲解，再运行校验。', {}, 'warning');
    if (size > 1200) report('EXPLANATION_TOO_LARGE', '讲解正文超过大小阈值。', '由 AI 检查是否聚焦并告知用户，不自动拆块。', { count: size, limit: 1200 }, 'warning');
    if (!block.lines) continue;
    const { start, end } = block.lines;
    if (end - start + 1 > 60) report('SOURCE_TOO_LARGE', '块引用源码超过行数阈值。', '由 AI 检查分块并告知用户，不自动拆块。', { count: end - start + 1, limit: 60 }, 'warning');
    if (sourceLineCount === undefined) continue;
    if (end > sourceLineCount) report('SOURCE_BOUNDS', '源码范围超出文件。', '按固定提交的真实物理行调整范围。', { start, end, sourceLineCount });
    if (start < previousStart) report('SOURCE_ORDER', '对照块未按源码顺序排列。', '按源码行号排列对照块。', { start, previousStart });
    if (start > expected) report('SOURCE_GAP', '对照块之间遗漏源码行。', '补齐遗漏行的连续覆盖。', { start: expected, end: start - 1 });
    if (start < expected) report('SOURCE_OVERLAP', '源码行被重复覆盖。', '修正范围，使每行只归属一个块。', { start, end: Math.min(expected - 1, end) });
    expected = Math.max(expected, end + 1);
    previousStart = start;
  }
  if (sourceLineCount !== undefined && expected <= sourceLineCount) diagnostics.push(problem(parsed.documentPath,
    'SOURCE_GAP', '文件尾部或全部源码尚未覆盖。', '补齐固定提交文件的所有物理行。', undefined, undefined, { start: expected, end: sourceLineCount }));
  const mechanicallyValid = structureValid && sourceLineCount !== undefined && !diagnostics.some(item => item.severity === 'error');
  return { ...parsed, diagnostics, structureValid, sourceCheck: sourceLineCount === undefined ? 'not-run' : 'completed',
    mechanicallyValid, renderMode: mechanicallyValid ? 'comparison' : 'markdown',
    contentStatus: parsed.blocks.length > 0 && parsed.blocks.every(block => explanationSize(block.body) > 0) ? 'provided' : 'unfilled',
    teachingQuality: 'unchecked', ...(sourceLineCount === undefined ? {} : { sourceLineCount }) };
}

function randomId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  while (id.length < 8) {
    for (const value of crypto.getRandomValues(new Uint8Array(16))) {
      if (value < 252) id += alphabet[value % 36];
      if (id.length === 8) break;
    }
  }
  return id;
}

export function generateSkeleton(commit: string, input: unknown, lineCount: number, makeId: () => string = randomId): string {
  const invalid = () => new DocumentError('BLOCK_PLAN_INVALID', '有序分块清单不合法或未按序完整覆盖。', '提供只含可选 lines 的数组，按固定源码逐行覆盖，纯讲解使用空对象。');
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit) || !Number.isSafeInteger(lineCount) || lineCount < 0 || !Array.isArray(input)) throw invalid();
  let expected = 1;
  const plan: BlockPlan[] = [];
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry) || Object.keys(entry).some(key => key !== 'lines')) throw invalid();
    if ('lines' in entry) {
      if (!validRange(entry.lines) || entry.lines.start !== expected || entry.lines.end > lineCount) throw invalid();
      expected = entry.lines.end + 1;
      plan.push({ lines: { ...entry.lines } });
    } else plan.push({});
  }
  if (expected !== lineCount + 1) throw invalid();
  const used = new Set<string>();
  const rendered = plan.map(entry => {
    let id = '';
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = makeId();
      if (typeof candidate === 'string' && /^[a-z0-9]{8}$/u.test(candidate) && !used.has(candidate)) {
        id = candidate;
        break;
      }
    }
    if (!id) throw new DocumentError('ID_GENERATION_FAILED', '无法生成同篇唯一的块 ID。', '检查随机数环境后重试新建，不修改已有文档。');
    used.add(id);
    const range = entry.lines ? ` lines=${entry.lines.start}-${entry.lines.end}` : '';
    return `<!-- aftertaste:block id=${id}${range} -->\n\n<!-- aftertaste:end -->\n`;
  });
  return `<!-- aftertaste:document commit=${commit} -->\n\n${rendered.join('\n')}`;
}
