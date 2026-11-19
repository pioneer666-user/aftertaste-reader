import { BookmarkError, invalidBookmarkData, parseBookmarkAction, parseBookmarks } from '../core/bookmarks.js';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import { DocumentError } from '../core/document-blocks.js';
import { sourcePathForDocument } from './document-blocks.js';
import type { ReadingDocument } from './document-blocks.js';

export interface BookmarkStore {
  read(): Promise<string | undefined>;
  save(raw: string, previous: string | undefined): Promise<void>;
}

function conflict() {
  return new BookmarkError('BOOKMARK_CONFLICT', '已保存的书签发生变化。', '查看已保存的内容后重试。');
}

function unavailable() {
  return new BookmarkError('BOOKMARK_TARGET_UNAVAILABLE', '当前讲解中暂时无法定位这个块。', '刷新讲解后重试。');
}

export class BookmarkService {
  private pending = Promise.resolve();

  constructor(private readonly store: BookmarkStore, private readonly readDocument: (path: string) => Promise<ReadingDocument>) {}

  async list(): Promise<Bookmark[]> {
    return this.read(await this.store.read());
  }

  save(body: unknown): Promise<Bookmark[]> {
    const action = parseBookmarkAction(body);
    const result = this.pending.then(() => this.apply(action));
    this.pending = result.then(() => {}, () => {});
    return result;
  }

  private read(raw: string | undefined): Bookmark[] {
    if (raw === undefined) return [];
    const bookmarks = parseBookmarks(raw);
    for (const record of bookmarks) {
      try { sourcePathForDocument(record.documentPath); }
      catch { throw invalidBookmarkData(); }
    }
    return bookmarks;
  }

  private async apply(action: BookmarkAction): Promise<Bookmark[]> {
    if (action.action === 'create') sourcePathForDocument(action.documentPath);
    const previous = await this.store.read();
    const bookmarks = this.read(previous);
    const index = bookmarks.findIndex(bookmark => bookmark.id === action.id);
    const stored = bookmarks[index];

    if (action.action === 'create') {
      const { action: _, ...record } = action;
      if (stored) {
        if (stored.documentPath === record.documentPath && stored.blockId === record.blockId && stored.note === record.note) return bookmarks;
        throw conflict();
      }
      const document = await this.readDocument(record.documentPath).catch((error: unknown) => {
        if (error instanceof DocumentError) throw unavailable();
        throw error;
      });
      if (document.renderMode !== 'comparison' || !document.blocks.some(block => block.id === record.blockId)) throw unavailable();
      bookmarks.push(record);
    } else if (action.action === 'edit') {
      if (!stored) throw new BookmarkError('BOOKMARK_NOT_FOUND', '这条书签已被移除。', '可在原块添加新书签。');
      if (stored.note === action.note) return bookmarks;
      if (stored.note !== action.previousNote) throw conflict();
      bookmarks[index] = { ...stored, note: action.note };
    } else {
      if (!stored) return bookmarks;
      if (stored.note !== action.previousNote) throw conflict();
      bookmarks.splice(index, 1);
    }

    await this.store.save(JSON.stringify({ version: 1, bookmarks }, null, 2) + '\n', previous);
    return bookmarks;
  }
}
