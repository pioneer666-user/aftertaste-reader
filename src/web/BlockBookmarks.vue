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
  language: Language;
  busy: boolean;
  saveBookmark: (action: BookmarkAction) => Promise<void>;
}>();

const t = (key: string) => translate(props.language, key);
const drafts = inject(bookmarkDraftsKey)!;
const draftKey = `${props.documentPath}\n${props.blockId}`;
const editor = computed(() => drafts.get(draftKey));
const expanded = ref(!!editor.value);
const detailsId = `bookmarks-${props.blockId}`;
const noteInput = ref<HTMLTextAreaElement>();
const addButton = ref<HTMLButtonElement>();
const errorMessage = ref<HTMLElement>();
const status = ref('');
const removeError = ref<ReaderProblem>();
const error = computed(() => editor.value?.problem ?? removeError.value);

watch(() => props.bookmarks.some(bookmark => bookmark.id === props.activeBookmark), revisited => {
  if (revisited) expanded.value = true;
}, { immediate: true });

async function start(bookmark?: Bookmark) {
  status.value = '';
  removeError.value = undefined;
  drafts.set(draftKey, { command: bookmark ?
    { action: 'edit', id: bookmark.id, note: bookmark.note, previousNote: bookmark.note } :
    { action: 'create', id: crypto.randomUUID(), note: '' } });
  await nextTick();
  noteInput.value?.focus();
}

async function cancel() {
  const previous = editor.value?.command;
  drafts.delete(draftKey);
  await nextTick();
  const editButton = previous?.action === 'edit' ? document.getElementById(`edit-bookmark-${previous.id}`) : null;
  (editButton ?? addButton.value)?.focus();
}

async function save(action: BookmarkAction) {
  const draft = editor.value;
  status.value = '';
  removeError.value = undefined;
  if (draft) delete draft.problem;
  try {
    await props.saveBookmark(action);
    drafts.delete(draftKey);
    status.value = action.action === 'remove' ? 'bookmarkRemoved' : 'bookmarkSaved';
    await nextTick();
    const target = action.action === 'remove' ? addButton.value : document.getElementById(`bookmark-${action.id}`);
    if (expanded.value) target?.focus();
  } catch (cause) {
    if (draft) draft.problem = failed(cause);
    else removeError.value = failed(cause);
    await nextTick();
    if (expanded.value) (noteInput.value ?? errorMessage.value)?.focus();
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
    <button type="button" class="block-bookmarks-toggle record-toggle" :aria-controls="detailsId" :aria-expanded="expanded"
      @click="expanded = !expanded">{{ t('bookmarks') }}<span v-if="bookmarks.length">({{ bookmarks.length }})</span></button>
    <div v-show="expanded" :id="detailsId" class="block-bookmark-details">
      <button ref="addButton" type="button" :disabled="busy || !!editor"
        :aria-expanded="editor?.command.action === 'create'" @click="start()">{{ t('bookmarkAdd') }}</button>
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
          <textarea ref="noteInput" v-model="editor.command.note" :readonly="busy" rows="3" />
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
.block-bookmark-details { margin-block-start: 8px; }
.block-bookmark-details > button { font-size: 13px; }
.block-bookmarks li { scroll-margin-block: 8px; }
</style>
