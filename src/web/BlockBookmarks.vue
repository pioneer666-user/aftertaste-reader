<script setup lang="ts">
import { nextTick, ref } from 'vue';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import type { ReaderProblem } from '../application/file-reader.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { failed } from './reader-api.js';

const props = defineProps<{
  documentPath: string;
  blockId: string;
  bookmarks: readonly Bookmark[];
  activeBookmark: string;
  language: Language;
  busy: boolean;
  saveBookmark: (action: BookmarkAction) => Promise<void>;
}>();

const t = (key: string) => translate(props.language, key);
const editor = ref<{ action: 'create'; id: string; note: string } |
  { action: 'edit'; id: string; note: string; previousNote: string }>();
const noteInput = ref<HTMLTextAreaElement>();
const addButton = ref<HTMLButtonElement>();
const errorMessage = ref<HTMLElement>();
const status = ref('');
const error = ref<ReaderProblem>();

async function start(bookmark?: Bookmark) {
  status.value = '';
  error.value = undefined;
  editor.value = bookmark ? { action: 'edit', id: bookmark.id, note: bookmark.note, previousNote: bookmark.note } :
    { action: 'create', id: crypto.randomUUID(), note: '' };
  await nextTick();
  noteInput.value?.focus();
}

async function cancel() {
  const previous = editor.value;
  editor.value = undefined;
  error.value = undefined;
  await nextTick();
  const editButton = previous?.action === 'edit' ? document.getElementById(`edit-bookmark-${previous.id}`) : null;
  (editButton ?? addButton.value)?.focus();
}

async function save(action: BookmarkAction) {
  status.value = '';
  error.value = undefined;
  try {
    await props.saveBookmark(action);
    editor.value = undefined;
    status.value = action.action === 'remove' ? 'bookmarkRemoved' : 'bookmarkSaved';
    await nextTick();
    const target = action.action === 'remove' ? addButton.value : document.getElementById(`bookmark-${action.id}`);
    target?.focus();
  } catch (cause) {
    error.value = failed(cause);
    await nextTick();
    const draft = editor.value;
    if (error.value.code === 'BOOKMARK_CONFLICT' && draft?.action === 'edit') {
      const latest = props.bookmarks.find(bookmark => bookmark.id === draft.id);
      if (latest) draft.previousNote = latest.note;
    }
    (noteInput.value ?? errorMessage.value)?.focus();
  }
}

function submit() {
  const draft = editor.value;
  if (!draft || props.busy) return;
  void save(draft.action === 'create' ? { ...draft, documentPath: props.documentPath, blockId: props.blockId } : draft);
}
</script>

<template>
  <div class="bookmark-heading">
    <slot />
    <button ref="addButton" type="button" :disabled="busy || !!editor"
      :aria-expanded="editor?.action === 'create'" @click="start()">{{ t('bookmarkAdd') }}</button>
  </div>
  <ul v-if="bookmarks.length" class="block-bookmarks">
    <li v-for="bookmark in bookmarks" :id="'bookmark-' + bookmark.id" :key="bookmark.id" tabindex="-1"
      :class="{ 'bookmark-visited': bookmark.id === activeBookmark }">
      <span v-if="bookmark.id === activeBookmark" class="bookmark-current">{{ t('bookmarkRevisited') }}</span>
      <p class="bookmark-note">{{ bookmark.note || t('bookmarkNoNote') }}</p>
      <div class="bookmark-actions">
        <button :id="'edit-bookmark-' + bookmark.id" type="button" :disabled="busy || !!editor"
          @click="start(bookmark)">{{ t('bookmarkEdit') }}</button>
        <button type="button" :disabled="busy || !!editor"
          @click="save({ action: 'remove', id: bookmark.id, previousNote: bookmark.note })">{{ t('bookmarkRemove') }}</button>
      </div>
    </li>
  </ul>
  <form v-if="editor" class="bookmark-editor" @submit.prevent="submit">
    <label>
      <span>{{ t('bookmarkNote') }}</span>
      <textarea ref="noteInput" v-model="editor.note" :readonly="busy" rows="3" />
    </label>
    <div class="bookmark-actions">
      <button type="submit" :disabled="busy">{{ t('bookmarkSave') }}</button>
      <button type="button" :disabled="busy" @click="cancel">{{ t('bookmarkCancel') }}</button>
    </div>
  </form>
  <p v-if="error" ref="errorMessage" class="bookmark-error" role="alert" tabindex="-1">
    <strong>{{ t('bookmarkSaveFailed') }}</strong>
    {{ problemText(language, error).message }} {{ problemText(language, error).nextStep }}
  </p>
  <p class="bookmark-status" role="status">{{ status ? t(status) : '' }}</p>
</template>
