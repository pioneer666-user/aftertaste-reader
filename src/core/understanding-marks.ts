import { isDocumentBlockId } from './document-blocks.js';

export const markStatuses = ['unmarked', 'understood', 'not-understood'] as const;
export type MarkStatus = typeof markStatuses[number];
export const emptyAnnotationRevision = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

interface MarkTarget {
  readonly documentPath: string;
  readonly blockId: string;
}

export interface UnderstandingMark extends MarkTarget {
  readonly status: MarkStatus;
  readonly annotation: string;
}

export interface ReaderMark extends UnderstandingMark {
  readonly annotationRevision: string;
}

export type MarkEdit = MarkTarget & (
  { readonly field: 'status'; readonly previous: MarkStatus; readonly value: MarkStatus } |
  { readonly field: 'annotation'; readonly previous: string; readonly value: string }
);

export class MarkError extends Error {
  constructor(readonly code: string, message: string, readonly nextStep: string,
    readonly context: Readonly<Record<string, string>> = {}) {
    super(message);
  }
}

export function invalidMarkData() {
  return new MarkError('MARK_DATA_INVALID', '标注资料格式无效。', '保留原文件，修复格式后重试。');
}

export function invalidMarkEdit() {
  return new MarkError('MARK_ARGUMENT_INVALID', '标注参数无效。', '使用本机阅读页面提交标注。');
}

export function markConflict() {
  return new MarkError('MARK_CONFLICT', '标注已被其他操作修改。', '核对已保存的内容后再决定是否重试。');
}

export function markKey(target: MarkTarget): string {
  return `${target.documentPath}\n${target.blockId}`;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function target(value: Record<string, unknown>): value is Record<string, unknown> & MarkTarget {
  return typeof value.documentPath === 'string' && isDocumentBlockId(value.blockId);
}

export function isMarkStatus(value: unknown): value is MarkStatus {
  return markStatuses.some(status => status === value);
}

function annotation(value: unknown): value is string {
  return typeof value === 'string' && value.isWellFormed();
}

export function parseUnderstandingMarks(raw: string): UnderstandingMark[] {
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw invalidMarkData(); }
  if (!object(data) || Object.keys(data).length !== 2 || data.version !== 1 || !Array.isArray(data.marks)) {
    throw invalidMarkData();
  }
  const keys = new Set<string>();
  const marks: UnderstandingMark[] = [];
  for (const mark of data.marks as unknown[]) {
    if (!object(mark) || Object.keys(mark).length !== 4 || !target(mark) ||
        !isMarkStatus(mark.status) || !annotation(mark.annotation) ||
        (mark.status === 'unmarked' && mark.annotation === '')) throw invalidMarkData();
    const key = markKey(mark);
    if (keys.has(key)) throw invalidMarkData();
    keys.add(key);
    marks.push({ documentPath: mark.documentPath, blockId: mark.blockId, status: mark.status, annotation: mark.annotation });
  }
  return marks;
}

export function parseMarkEdit(input: unknown): MarkEdit {
  if (object(input) && Object.keys(input).length === 5 && target(input)) {
    const { documentPath, blockId, field, previous, value } = input;
    if (field === 'status' && isMarkStatus(previous) && isMarkStatus(value)) {
      return { documentPath, blockId, field, previous, value };
    }
    if (field === 'annotation' && typeof previous === 'string' && previous.length === 64 &&
        !/[^a-f0-9]/u.test(previous) && annotation(value)) {
      return { documentPath, blockId, field, previous, value };
    }
  }
  throw invalidMarkEdit();
}
