<script setup lang="ts">
import { translate, problemText } from './i18n.js';
import type { Language } from './i18n.js';
import type { Draft, NotesEditor } from './notes-editor.js';

const props = defineProps<{ draft: Draft; editor: NotesEditor; language: Language; showSaved: boolean }>();
const t = (key: string) => translate(props.language, key);

function loadSaved() {
  if (window.confirm(t('noteLoadConfirm'))) void props.editor.loadSaved(props.draft);
}
</script>

<template>
  <div v-if="draft.problem" class="note-save-problem">
    <p role="alert" class="bookmark-error">{{ t('noteSaveFailed') }} {{ problemText(language, draft.problem).message }}
      {{ problemText(language, draft.problem).nextStep }}</p>
    <button v-if="draft.problem.code === 'NOTE_CONFLICT'" type="button" :disabled="draft.busy"
      @click="loadSaved">{{ t('noteLoadSaved') }}</button>
    <button v-else-if="draft.dirty" type="button" :disabled="draft.busy" @click="editor.save(draft)">{{ t('noteRetry') }}</button>
  </div>
  <p v-else-if="showSaved || draft.busy || draft.dirty" class="bookmark-status" role="status">{{ t(draft.busy || draft.dirty ? 'noteSaving' : 'noteSaved') }}</p>
</template>
