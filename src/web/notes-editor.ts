import { onBeforeUnmount, reactive, ref } from 'vue';
import type { ReaderProblem } from '../application/file-reader.js';
import type { Note, NoteAction, SaveNote } from '../core/notes.js';
import { failed, request } from './reader-api.js';

interface Draft {
  id: string;
  revision: string | null;
  body: string;
  tags: readonly string[];
  dirty: boolean;
  busy: boolean;
  replacing: boolean;
  problem?: ReaderProblem;
  pending?: SaveNote;
}

function draftFor(id: string, body = '', tags: readonly string[] = [], revision: string | null = null): Draft {
  return { id, body, tags, revision, dirty: revision === null, busy: false, replacing: false };
}

const endpoint = '/api/notes';

function submit(action: NoteAction) {
  return request<{ note: Note | null }>(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Notes': '1' },
    body: JSON.stringify(action),
  });
}

export function useNotesEditor() {
  const drafts = reactive(new Map<string, Draft>());
  const selected = ref('');
  const loaded = ref(false);
  const loading = ref(false);
  const loadProblem = ref<ReaderProblem>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearTimer(draft: Draft) {
    clearTimeout(timers.get(draft.id));
    timers.delete(draft.id);
  }

  async function load() {
    if (loaded.value || loading.value) return;
    loading.value = true;
    loadProblem.value = undefined;
    try {
      const { notes } = await request<{ notes: Note[] }>(endpoint);
      for (const note of notes) drafts.set(note.id, draftFor(note.id, note.body, note.tags, note.revision));
      loaded.value = true;
    } catch (error) { loadProblem.value = failed(error); }
    finally { loading.value = false; }
  }

  function schedule(draft: Draft) {
    clearTimer(draft);
    timers.set(draft.id, setTimeout(() => { void save(draft); }, 350));
  }

  function changed(draft: Draft) {
    draft.dirty = true;
    if (!draft.problem && !draft.busy) schedule(draft);
  }

  function create(body = '') {
    const id = crypto.randomUUID();
    drafts.set(id, draftFor(id, body));
    selected.value = id;
    schedule(drafts.get(id)!);
  }

  async function save(draft: Draft) {
    clearTimer(draft);
    if (draft.busy || (!draft.dirty && !draft.pending)) return;
    if (draft.problem?.code === 'NOTE_CONFLICT') return;
    const action = draft.pending ?? {
      action: 'save', id: draft.id, previousRevision: draft.revision,
      revision: crypto.randomUUID(), body: draft.body, tags: [...draft.tags],
    };
    draft.dirty = draft.body !== action.body || draft.tags.length !== action.tags.length ||
      draft.tags.some((tag, index) => tag !== action.tags[index]);
    draft.busy = true;
    delete draft.problem;
    try {
      await submit(action);
      draft.revision = action.revision;
      delete draft.pending;
    } catch (error) {
      draft.problem = failed(error);
      draft.dirty = true;
      // A lost response may follow a successful commit. Replay that exact request first.
      if (draft.problem.code === 'NETWORK_ERROR') draft.pending = action;
      else delete draft.pending;
    } finally {
      draft.busy = false;
      if (draft.dirty && !draft.problem) schedule(draft);
    }
  }

  async function remove(draft: Draft) {
    clearTimer(draft);
    draft.busy = true;
    draft.replacing = true;
    delete draft.problem;
    try {
      const revision = draft.pending?.revision ?? draft.revision;
      if (revision) await submit({ action: 'remove', id: draft.id, previousRevision: revision });
      drafts.delete(draft.id);
      if (selected.value === draft.id) selected.value = '';
    } catch (error) { draft.problem = failed(error); }
    finally { draft.busy = false; draft.replacing = false; }
  }

  async function loadSaved(draft: Draft) {
    if (draft.busy) return;
    draft.busy = true;
    draft.replacing = true;
    try {
      const { notes } = await request<{ notes: Note[] }>(endpoint);
      const note = notes.find(note => note.id === draft.id);
      if (note) {
        drafts.set(draft.id, draftFor(note.id, note.body, note.tags, note.revision));
      } else {
        drafts.delete(draft.id);
        if (selected.value === draft.id) selected.value = '';
      }
      delete draft.problem;
    } catch (error) { draft.problem = failed(error); }
    finally { draft.busy = false; draft.replacing = false; }
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    if ([...drafts.values()].some(draft => draft.dirty || draft.busy)) {
      event.preventDefault();
      event.returnValue = true;
    }
  }
  window.addEventListener('beforeunload', beforeUnload);
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', beforeUnload);
    timers.forEach(timer => clearTimeout(timer));
  });

  return { drafts, selected, loaded, loading, loadProblem, load, create, changed, save, remove, loadSaved };
}
