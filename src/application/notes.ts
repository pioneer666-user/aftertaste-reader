import { noteConflict, parseNoteAction, parseNotes } from '../core/notes.js';
import type { Note, NoteAction } from '../core/notes.js';

interface NotesStore {
  read(): Promise<string | undefined>;
  save(raw: string, previous: string | undefined): Promise<void>;
}

function records(raw: string | undefined): Note[] {
  return raw === undefined ? [] : parseNotes(raw);
}

export class NotesService {
  private pending = Promise.resolve();

  constructor(private readonly store: NotesStore) {}

  async list(): Promise<Note[]> {
    return records(await this.store.read());
  }

  save(input: unknown): Promise<Note | null> {
    const action = parseNoteAction(input);
    const result = this.pending.then(() => this.apply(action));
    this.pending = result.then(() => {}, () => {});
    return result;
  }

  private async apply(action: NoteAction): Promise<Note | null> {
    const previous = await this.store.read();
    const notes = records(previous);
    const index = notes.findIndex(note => note.id === action.id);
    const stored = notes[index];
    let note: Note | null = null;
    if (action.action === 'remove') {
      if (!stored) return null;
      if (stored.revision !== action.previousRevision) throw noteConflict();
      notes.splice(index, 1);
    } else {
      const { id, revision, body, tags } = action;
      if (stored?.revision === revision) {
        if ((stored.title ?? '') === (action.title ?? '') && stored.body === body && stored.tags.length === tags.length && tags.every((tag, i) => tag === stored.tags[i])) return stored;
        throw noteConflict();
      }
      if ((stored?.revision ?? null) !== action.previousRevision) throw noteConflict();
      note = { id, revision, body, tags, ...(action.title ? { title: action.title } : {}) };
      if (stored) notes[index] = note;
      else notes.push(note);
    }
    await this.store.save(JSON.stringify({ version: 1, notes }, null, 2) + '\n', previous);
    return note;
  }
}
