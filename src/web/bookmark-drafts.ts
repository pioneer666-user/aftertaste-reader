import type { InjectionKey } from 'vue';
import type { ReaderProblem } from '../application/file-reader.js';

export interface BookmarkDraft {
  command: { action: 'create'; id: string; note: string } |
    { action: 'edit'; id: string; note: string; previousNote: string };
  problem?: ReaderProblem;
}

export const bookmarkDraftsKey: InjectionKey<Map<string, BookmarkDraft>> = Symbol('bookmark drafts');
