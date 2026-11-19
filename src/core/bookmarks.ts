import { isDocumentBlockId } from './document-blocks.js';

export interface Bookmark {
  readonly id: string;
  readonly documentPath: string;
  readonly blockId: string;
  readonly note: string;
}

export type BookmarkAction = ({ readonly action: 'create' } & Bookmark) |
  { readonly action: 'edit'; readonly id: string; readonly previousNote: string; readonly note: string } |
  { readonly action: 'remove'; readonly id: string; readonly previousNote: string };

export class BookmarkError extends Error {
  constructor(readonly code: string, message: string, readonly nextStep: string,
    readonly context: Readonly<Record<string, string>> = {}) {
    super(message);
  }
}

export function invalidBookmarkData() {
  return new BookmarkError('BOOKMARK_DATA_INVALID', '书签资料格式无效。', '保留原文件，修复格式后重试。');
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
}

function note(value: unknown): value is string {
  return typeof value === 'string' && value.isWellFormed();
}

function bookmark(value: Record<string, unknown>): value is Record<string, unknown> & Bookmark {
  return id(value.id) && typeof value.documentPath === 'string' && isDocumentBlockId(value.blockId) && note(value.note);
}

export function parseBookmarks(raw: string): Bookmark[] {
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw invalidBookmarkData(); }
  if (!object(data) || Object.keys(data).length !== 2 || data.version !== 1 || !Array.isArray(data.bookmarks)) {
    throw invalidBookmarkData();
  }
  const ids = new Set<string>();
  const bookmarks: Bookmark[] = [];
  for (const value of data.bookmarks as unknown[]) {
    if (!object(value) || Object.keys(value).length !== 4 || !bookmark(value) || ids.has(value.id)) {
      throw invalidBookmarkData();
    }
    ids.add(value.id);
    bookmarks.push(value);
  }
  return bookmarks;
}

export function parseBookmarkAction(value: unknown): BookmarkAction {
  if (object(value)) {
    const count = Object.keys(value).length;
    if (value.action === 'create' && count === 5 && bookmark(value)) {
      return { action: 'create', id: value.id, documentPath: value.documentPath, blockId: value.blockId, note: value.note };
    }
    if (id(value.id) && note(value.previousNote)) {
      if (value.action === 'edit' && count === 4 && note(value.note)) {
        return { action: 'edit', id: value.id, previousNote: value.previousNote, note: value.note };
      }
      if (value.action === 'remove' && count === 3) {
        return { action: 'remove', id: value.id, previousNote: value.previousNote };
      }
    }
  }
  throw new BookmarkError('INVALID_ARGUMENT', '书签操作参数无效。', '从本机阅读页面提交单条书签操作。');
}
