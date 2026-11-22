import type { InjectionKey } from 'vue';
import type { ReaderProblem } from '../application/file-reader.js';

export interface BookmarkDraft {
  command: { action: 'create'; id: string; note: string } |
    { action: 'edit'; id: string; note: string; previousNote: string };
  problem?: ReaderProblem;
}

export interface BlockBookmarkDrafts {
  selected: string;
  entries: Map<string, BookmarkDraft>;
}
export const bookmarkDraftsKey: InjectionKey<Map<string, BlockBookmarkDrafts>> = Symbol('bookmark drafts');
