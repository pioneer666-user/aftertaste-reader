<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import type { ReaderProblem } from '../application/file-reader.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { failed } from './reader-api.js';
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
const noteInput = ref<HTMLTextAreaElement>();
const addButton = ref<HTMLButtonElement>();
const errorMessage = ref<HTMLElement>();
const status = ref('');
const removeError = ref<ReaderProblem>();
const error = computed(() => editor.value?.problem ?? removeError.value);

let opening = false;
watch([() => props.opened, () => props.busy], ([opened, busy], [wasOpen]) => {
  if (opened !== wasOpen) opening = opened;
  if (!opening || busy) return;
  opening = false;
  if (!props.bookmarks.length && !editor.value) void start();
});

async function start(bookmark?: Bookmark) {
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
  if (props.opened) focusInPanel(noteInput.value);
}

async function cancel() {
  const previous = editor.value?.command;
  if (group.value) discard(group.value.selected);
  await nextTick();
  const editButton = previous?.action === 'edit' ? document.getElementById(`edit-bookmark-${previous.id}`) : null;
  (editButton ?? addButton.value)?.focus({ preventScroll: true });
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
    status.value = action.action === 'remove' ? 'bookmarkRemoved' : 'bookmarkSaved';
    await nextTick();
    const target = action.action === 'remove' ? addButton.value : document.getElementById(`bookmark-${action.id}`);
    if (props.opened && document.activeElement?.closest('.bookmark-records')) focusInPanel(target);
  } catch (cause) {
    if (draft) draft.problem = failed(cause);
    else removeError.value = failed(cause);
    await nextTick();
    if (props.opened && document.activeElement?.closest('.bookmark-records')) (noteInput.value ?? errorMessage.value)?.focus({ preventScroll: true });
  }
}

function submit() {
  const draft = editor.value;
  if (!draft || props.busy) return;
  const command = draft.command;
  if (command.action === 'edit' && draft.problem?.code === 'BOOKMARK_CONFLICT') {
    const latest = props.bookmarks.find(bookmark => bookmark.id === command.id);
    if (latest) command.previousNote = latest.note;
  }
  void save(command.action === 'create' ? { ...command, documentPath: props.documentPath, blockId: props.blockId } : command);
}
</script>

<template>
  <div class="bookmark-records">
    <div class="block-bookmark-details">
      <button v-if="bookmarks.length || !editor" ref="addButton" type="button" :disabled="busy || group?.selected === 'new'"
        @click="start()">{{ t(bookmarks.length ? 'bookmarkAnother' : 'bookmarkAdd') }}</button>
      <ul v-if="bookmarks.length" class="block-bookmarks">
        <li v-for="bookmark in bookmarks" :id="'bookmark-' + bookmark.id" :key="bookmark.id" tabindex="-1"
          :class="{ 'bookmark-visited': bookmark.id === activeBookmark }">
          <span v-if="bookmark.id === activeBookmark" class="bookmark-current">{{ t('bookmarkRevisited') }}</span>
          <small v-if="group?.entries.has(bookmark.id)">{{ t('bookmarkDraft') }}</small>
          <p class="bookmark-note">{{ bookmark.note || t('bookmarkNoNote') }}</p>
          <div class="bookmark-actions">
            <button :id="'edit-bookmark-' + bookmark.id" type="button" :disabled="busy || group?.selected === bookmark.id"
              @click="start(bookmark)">{{ t('bookmarkEdit') }}</button>
            <button type="button" :disabled="busy || group?.entries.has(bookmark.id)"
              @click="save({ action: 'remove', id: bookmark.id, previousNote: bookmark.note })">{{ t('bookmarkRemove') }}</button>
          </div>
        </li>
      </ul>
      <form v-if="editor" class="bookmark-editor" @submit.prevent="submit">
        <label>
          <span v-if="editor.command.action === 'edit'" class="bookmark-editing-reason">{{ t('bookmarkEdit') }} · {{ bookmarks.find(item => item.id === editor?.command.id)?.note || t('bookmarkNoNote') }}</span>
          <span>{{ t('bookmarkNote') }}</span>
          <textarea ref="noteInput" :aria-label="t('bookmarkNote')" v-model="editor.command.note" :readonly="busy" rows="3" />
        </label>
        <div class="bookmark-actions">
          <button type="submit" :disabled="busy">{{ t('bookmarkSave') }}</button>
          <button type="button" :disabled="busy" @click="cancel">{{ t('bookmarkCancel') }}</button>
        </div>
      </form>
    </div>
    <p v-if="error" ref="errorMessage" class="bookmark-error" role="alert" tabindex="-1">
      <strong>{{ t('bookmarkSaveFailed') }}</strong>
      {{ problemText(language, error).message }} {{ problemText(language, error).nextStep }}
    </p>
    <p class="bookmark-status" role="status">{{ status ? t(status) : '' }}</p>
  </div>
</template>

<style scoped>
.bookmark-editing-reason { display: block; margin-block-end: 6px; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.block-bookmark-details > button { font-size: 13px; }
.block-bookmarks li { scroll-margin-block: 8px; }
</style>
