<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import type { ReaderProblem } from '../application/file-reader.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { failed } from './reader-api.js';
import RecordEditor from './RecordEditor.vue';
import { bookmarkDraftsKey } from './bookmark-drafts.js';

const props = defineProps<{
  documentPath: string;
  blockId: string;
  bookmarks: readonly Bookmark[];
  activeBookmark: string;
  opened: boolean;
  language: Language;
  busy: boolean;
  saveBookmark: (action: BookmarkAction) => Promise<void>;
}>();

const t = (key: string) => translate(props.language, key);
const drafts = inject(bookmarkDraftsKey)!;
const draftKey = `${props.documentPath}\n${props.blockId}`;
const group = computed(() => drafts.get(draftKey));
const editor = computed(() => group.value?.entries.get(group.value.selected));
const root = ref<HTMLElement>();
const menu = ref('');
const rows = computed(() => {
  const saved = props.bookmarks.map(bookmark => ({ id: bookmark.id, note: bookmark.note }));
  // Keep an editor reachable even if a concurrent removal invalidates its record.
  for (const [id, draft] of group.value?.entries ?? []) {
    if (draft.command.action === 'edit' && !saved.some(row => row.id === id)) {
      saved.push({ id, note: draft.command.previousNote });
    }
  }
  if (group.value?.selected === 'new') saved.unshift({ id: 'new', note: '' });
  return saved;
});
function changed(id: string) {
  const command = group.value?.entries.get(id)?.command;
  return command?.action === 'edit' && command.note !== command.previousNote;
}
function discard(id: string) {
  const current = group.value;
  if (!current) return;
  current.entries.delete(id);
  if (current.selected === id) current.selected = '';
  if (!current.entries.size) drafts.delete(draftKey);
}
function focusInPanel(target?: HTMLElement | null) {
  target?.focus({ preventScroll: true });
  const scroller = target?.closest('.margin-body');
  if (!target || !scroller) return;
  const area = scroller.getBoundingClientRect();
  const item = target.getBoundingClientRect();
  if (item.top < area.top || item.bottom > area.bottom) scroller.scrollTop += item.top - area.top;
}
const input = () => root.value?.querySelector('textarea');
const addButton = () => root.value?.closest('.margin-panel')?.querySelector<HTMLButtonElement>('.bookmark-add');
function closeMenu() {
  document.getElementById('more-bookmark-' + menu.value)?.focus({ preventScroll: true });
  menu.value = '';
}
function escapeMenu(event: KeyboardEvent, id: string) {
  if (menu.value !== id) return;
  event.preventDefault();
  closeMenu();
}
function leaveMenu(event: FocusEvent, id: string) {
  if (menu.value === id && !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) menu.value = '';
}
async function toggleMenu(id: string) {
  if (menu.value === id) return closeMenu();
  menu.value = id;
  await nextTick();
  const remove = document.getElementById('remove-bookmark-' + id) as HTMLButtonElement | null;
  if (remove && !remove.disabled) remove.focus({ preventScroll: true });
}
const errorMessage = ref<HTMLElement>();
const status = ref('');
const removeError = ref<ReaderProblem>();
const error = computed(() => editor.value?.problem ?? removeError.value);

let opening = false;
watch([() => props.opened, () => props.busy], ([opened, busy], [wasOpen]) => {
  if (!opened) menu.value = '';
  if (opened !== wasOpen) opening = opened;
  if (!opening || busy) return;
  opening = false;
  if (!props.bookmarks.length && !editor.value) void start();
});

async function start(bookmark?: Pick<Bookmark, 'id' | 'note'>) {
  menu.value = '';
  status.value = '';
  removeError.value = undefined;
  const id = bookmark?.id ?? 'new';
  if (!group.value) drafts.set(draftKey, { selected: id, entries: new Map() });
  const current = drafts.get(draftKey)!;
  current.selected = id;
  if (!current.entries.has(id)) current.entries.set(id, { command: bookmark ?
    { action: 'edit', id, note: bookmark.note, previousNote: bookmark.note } :
    { action: 'create', id: crypto.randomUUID(), note: '' } });
  await nextTick();
  if (props.opened) focusInPanel(input());
}

async function cancel() {
  const previous = editor.value?.command;
  if (group.value) discard(group.value.selected);
  await nextTick();
  const editButton = previous?.action === 'edit' ? document.getElementById(`edit-bookmark-${previous.id}`) : null;
  focusInPanel(editButton ?? addButton());
}

async function save(action: BookmarkAction) {
  const id = action.action === 'create' ? 'new' : action.id;
  const draft = action.action === 'remove' ? undefined : group.value?.entries.get(id);
  status.value = '';
  removeError.value = undefined;
  if (draft) delete draft.problem;
  try {
    await props.saveBookmark(action);
    discard(id);
    menu.value = '';
    status.value = action.action === 'remove' ? 'bookmarkRemoved' : 'bookmarkSaved';
    await nextTick();
    const target = action.action === 'remove' ? addButton() : document.getElementById(`bookmark-${action.id}`);
    if (props.opened && (document.activeElement === document.body || root.value?.contains(document.activeElement))) focusInPanel(target);
  } catch (cause) {
    if (draft) draft.problem = failed(cause);
    else removeError.value = failed(cause);
    await nextTick();
    if (props.opened && (document.activeElement === document.body || root.value?.contains(document.activeElement))) focusInPanel(errorMessage.value);
  }
}

function submit() {
  const draft = editor.value;
  if (!draft || props.busy) return;
  const command = draft.command;
  if (command.action === 'edit' && draft.problem?.code === 'BOOKMARK_CONFLICT') {
    const latest = props.bookmarks.find(bookmark => bookmark.id === command.id);
    if (latest) return void save({ ...command, previousNote: latest.note });
  }
  void save(command.action === 'create' ? { ...command, documentPath: props.documentPath, blockId: props.blockId } : command);
}
defineExpose({ start });
</script>

<template>
  <div ref="root" class="bookmark-records">
    <ul v-if="rows.length" class="block-bookmarks">
      <li v-for="row in rows" :id="'bookmark-' + row.id" :key="row.id" tabindex="-1"
        :class="{ 'bookmark-visited': row.id === activeBookmark }">
        <span v-if="row.id === activeBookmark" class="bookmark-current">{{ t('bookmarkRevisited') }}</span>
        <template v-if="group?.selected === row.id && editor">
          <p v-if="editor.problem?.code === 'BOOKMARK_CONFLICT'" class="bookmark-note saved-reason">{{ t('savedBookmark') }} · {{ row.note || t('bookmarkNoNote') }}</p>
          <RecordEditor v-model="editor.command.note" :label="t('bookmarkNote')" :save-label="t('bookmarkSave')"
            :language="language" :busy="busy" :dirty="changed(row.id)" @cancel="cancel" @save="submit" />
        </template>
        <template v-else>
          <div class="bookmark-line">
            <div class="bookmark-copy"><p class="bookmark-note">{{ row.note || t('bookmarkNoNote') }}</p>
              <small v-if="changed(row.id)">{{ t('bookmarkDraft') }}</small></div>
            <button :id="'edit-bookmark-' + row.id" class="record-icon" type="button" :disabled="busy"
              :aria-label="t('bookmarkEdit')" @click="start(row)">
              <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 12.5 8.9-8.9 3.5 3.5-8.9 8.9-4.4.9zM11 5.5 14.5 9"/></svg>
            </button>
            <div class="bookmark-more" @keydown.esc="escapeMenu($event, row.id)"
              @focusout="leaveMenu($event, row.id)">
              <button :id="'more-bookmark-' + row.id" class="record-icon" type="button" :disabled="busy"
                :aria-label="t('bookmarkMore')" :aria-expanded="menu === row.id"
                :aria-controls="menu === row.id ? 'remove-bookmark-' + row.id : undefined" @click="toggleMenu(row.id)">⋯</button>
              <button v-if="menu === row.id" :id="'remove-bookmark-' + row.id" class="record-menu" type="button"
                :disabled="busy || changed(row.id)" @click="save({ action: 'remove', id: row.id, previousNote: row.note })">
                {{ t('bookmarkRemove') }}
              </button>
            </div>
          </div>
        </template>
      </li>
    </ul>
    <p v-if="error" ref="errorMessage" class="bookmark-error" role="alert" tabindex="-1">
      <strong>{{ t('bookmarkSaveFailed') }}</strong>
      {{ problemText(language, error).message }} {{ problemText(language, error).nextStep }}
    </p>
    <p class="bookmark-status" role="status">{{ status ? t(status) : '' }}</p>
  </div>
</template>
