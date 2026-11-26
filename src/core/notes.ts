import { isDocumentBlockId } from './document-blocks.js';
import { isLoopId, isNodeId } from './loops.js';
import { isSourcePath } from './source-path.js';

export interface Note {
  readonly id: string;
  readonly revision: string;
  readonly title?: string;
  readonly body: string;
  readonly tags: readonly string[];
}

export type SaveNote = Note & { readonly action: 'save'; readonly previousRevision: string | null };
export type NoteAction = SaveNote | { readonly action: 'remove'; readonly id: string; readonly previousRevision: string };

export interface BlockTarget {
  readonly documentPath: string;
  readonly blockId: string;
}

export interface StepTarget {
  readonly loopId: string;
  readonly stepId: string;
}
export type NoteTarget = BlockTarget | StepTarget;
export type NoteQuote = NoteTarget & { readonly text: string };

export interface BlockQuote extends BlockTarget {
  readonly text: string;
}

export class NoteError extends Error {
  constructor(readonly code: string, message: string, readonly nextStep: string,
    readonly context: Readonly<Record<string, string>> = {}) {
    super(message);
  }
}

export function noteConflict() {
  return new NoteError('NOTE_CONFLICT', '这条笔记的已保存版本已变化。', '查看已保存版本后再处理本页草稿。');
}

function invalidData() {
  return new NoteError('NOTE_DATA_INVALID', '笔记文件格式无效。', '保留原文件，修复格式后重试。');
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
}

function isNote(value: Record<string, unknown>): value is Record<string, unknown> & Note {
  return (!('title' in value) || (typeof value.title === 'string' && value.title.isWellFormed())) &&
    uuid(value.id) && uuid(value.revision) && typeof value.body === 'string' && value.body.isWellFormed() &&
    Array.isArray(value.tags) && value.tags.every(tag => typeof tag === 'string' && tag.isWellFormed() && tag.trim()) &&
    new Set(value.tags).size === value.tags.length;
}

export function parseNotes(raw: string): Note[] {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw invalidData(); }
  if (!object(value) || Object.keys(value).length !== 2 || value.version !== 1 || !Array.isArray(value.notes)) throw invalidData();
  const ids = new Set<string>();
  const notes: Note[] = [];
  for (const item of value.notes as unknown[]) {
    if (!object(item) || Object.keys(item).length !== ('title' in item ? 5 : 4) || !isNote(item) || ids.has(item.id)) throw invalidData();
    ids.add(item.id);
    notes.push(item);
  }
  return notes;
}

export function parseNoteAction(value: unknown): NoteAction {
  if (object(value)) {
    const fields = Object.keys(value).length;
    const previous = value.previousRevision;
    if (value.action === 'save' && fields === ('title' in value ? 7 : 6) && isNote(value) &&
        (previous === null || uuid(previous)) && previous !== value.revision) {
      const { id, revision, body, tags } = value;
      return { action: 'save', id, previousRevision: previous, revision, body, tags, ...(value.title ? { title: value.title } : {}) };
    }
    if (value.action === 'remove' && fields === 3 && uuid(value.id) && uuid(previous)) {
      return { action: 'remove', id: value.id, previousRevision: previous };
    }
  }
  throw new NoteError('INVALID_ARGUMENT', '笔记操作参数无效。', '从本机阅读页面提交单条笔记操作。');
}

export const blockLinkPrefix = '#aftertaste-block/';
export const stepLinkPrefix = '#aftertaste-loop/';
export function isNoteHref(href: string | null | undefined): href is string {
  return !!href && (href.startsWith(blockLinkPrefix) || href.startsWith(stepLinkPrefix));
}
const mirrorRoot = 'docs/aftertaste/current/';

export function readingLocation(target: NoteTarget): string {
  return 'loopId' in target ? stepLinkPrefix + target.loopId + '/' + target.stepId :
    blockLinkPrefix + encodeURIComponent(target.documentPath) + '/' + target.blockId;
}

export function blockLink(quote: NoteQuote): string {
  // Encode Markdown punctuation and whitespace so the label renders as the original selection.
  const label = quote.text.replace(/[\t\r\n\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/gu,
    character => `&#${character.charCodeAt(0)};`);
  return `[${label}](<${readingLocation(quote)}>)`;
}

export function blockTarget(href: string): NoteTarget | undefined {
  if (href.startsWith(stepLinkPrefix)) {
    const [loopId, stepId, extra] = href.slice(stepLinkPrefix.length).split('/');
    return isLoopId(loopId) && isNodeId(stepId) && extra === undefined ? { loopId, stepId } : undefined;
  }
  if (!href.startsWith(blockLinkPrefix)) return;
  const [encoded, blockId, extra] = href.slice(blockLinkPrefix.length).split('/');
  if (!encoded || extra !== undefined || !isDocumentBlockId(blockId)) return;
  let documentPath: string;
  try { documentPath = decodeURIComponent(encoded); }
  catch { return; }
  if (documentPath.startsWith(mirrorRoot) && documentPath.endsWith('.md') &&
      isSourcePath(documentPath) && isSourcePath(documentPath.slice(mirrorRoot.length, -3))) {
    return { documentPath, blockId };
  }
}
