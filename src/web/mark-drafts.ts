import type { InjectionKey } from 'vue';
import type { ReaderProblem } from '../application/file-reader.js';
import type { MarkStatus } from '../core/understanding-marks.js';

interface FieldDraft<T> {
  previous: T;
  value: T;
  problem?: ReaderProblem;
}

export interface MarkDraft {
  status?: FieldDraft<MarkStatus>;
  annotation?: FieldDraft<string>;
}

export const markDraftsKey: InjectionKey<Map<string, MarkDraft>> = Symbol('mark drafts');
