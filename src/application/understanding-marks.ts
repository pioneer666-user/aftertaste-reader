import { DocumentError } from '../core/document-blocks.js';
import { invalidMarkData, markConflict, MarkError, parseMarkEdit, parseUnderstandingMarks } from '../core/understanding-marks.js';
import type { MarkEdit, UnderstandingMark } from '../core/understanding-marks.js';
import { sourcePathForDocument } from './document-blocks.js';
import type { ReadingDocument } from './document-blocks.js';

interface MarkStore {
  read(): Promise<string | undefined>;
  save(raw: string, previous: string | undefined): Promise<void>;
}

function unavailable() {
  return new MarkError('MARK_TARGET_UNAVAILABLE', '当前讲解中暂时无法定位这个块。', '恢复讲解后重试。');
}

export class UnderstandingMarkService {
  private pending = Promise.resolve();

  constructor(private readonly store: MarkStore, private readonly readDocument: (path: string) => Promise<ReadingDocument>) {}

  async list(): Promise<UnderstandingMark[]> {
    return this.read(await this.store.read());
  }

  save(body: unknown): Promise<UnderstandingMark[]> {
    const edit = parseMarkEdit(body);
    sourcePathForDocument(edit.documentPath);
    const result = this.pending.then(() => this.apply(edit));
    this.pending = result.then(() => {}, () => {});
    return result;
  }

  private read(raw: string | undefined): UnderstandingMark[] {
    if (raw === undefined) return [];
    const marks = parseUnderstandingMarks(raw);
    for (const mark of marks) {
      try { sourcePathForDocument(mark.documentPath); }
      catch { throw invalidMarkData(); }
    }
    return marks;
  }

  private async apply(edit: MarkEdit): Promise<UnderstandingMark[]> {
    const { documentPath, blockId, field, value } = edit;
    const previous = await this.store.read();
    const marks = this.read(previous);
    const index = marks.findIndex(mark => mark.documentPath === documentPath && mark.blockId === blockId);
    const current: UnderstandingMark = marks[index] ?? { documentPath, blockId, status: 'unmarked', annotation: '' };
    if (current[field] === value) return marks;
    if (current[field] !== edit.previous) throw markConflict();

    const document = await this.readDocument(documentPath).catch((error: unknown) => {
      if (error instanceof DocumentError) throw unavailable();
      throw error;
    });
    if (document.renderMode !== 'comparison' || !document.blocks.some(block => block.id === blockId)) throw unavailable();

    const updated = field === 'status' ? { ...current, status: value } : { ...current, annotation: value };
    if (updated.status === 'unmarked' && updated.annotation === '') marks.splice(index, 1);
    else if (index === -1) marks.push(updated);
    else marks[index] = updated;
    await this.store.save(JSON.stringify({ version: 1, marks }, null, 2) + '\n', previous);
    return marks;
  }
}
