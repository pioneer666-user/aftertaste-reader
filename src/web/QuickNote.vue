<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import NoteIcon from './NoteIcon.vue';
import NoteSaveStatus from './NoteSaveStatus.vue';
import { translate } from './i18n.js';
import type { Language } from './i18n.js';
import { renderMarkdown } from './markdown.js';
import type { NotesEditor } from './notes-editor.js';

const props = defineProps<{ editor: NotesEditor; language: Language }>();
const t = (key: string) => translate(props.language, key);
const opened = ref(false);
const preview = ref(false);
const id = ref('');
const draft = computed(() => props.editor.drafts.get(id.value));
const trigger = ref<HTMLButtonElement>();
const input = ref<HTMLTextAreaElement>();
const previewButton = ref<HTMLButtonElement>();
let scrollTop = 0;

const body = computed({
  get: () => draft.value?.body ?? '',
  set(text: string) {
    if (draft.value) {
      draft.value.body = text;
      props.editor.changed(draft.value);
    } else if (text.length) {
      id.value = props.editor.create(text);
    }
  },
});

async function open() {
  if (!opened.value) {
    if (!draft.value?.dirty && !draft.value?.busy && !draft.value?.problem) id.value = '';
    preview.value = false;
    opened.value = true;
  }
  await nextTick();
  (preview.value ? previewButton.value : input.value)?.focus({ preventScroll: true });
}

function close() {
  opened.value = false;
  trigger.value?.focus({ preventScroll: true });
}

async function togglePreview() {
  if (!preview.value) scrollTop = input.value?.scrollTop ?? 0;
  preview.value = !preview.value;
  if (!preview.value) {
    await nextTick();
    input.value?.focus({ preventScroll: true });
    if (input.value) input.value.scrollTop = scrollTop;
  }
}
</script>

<template>
  <button ref="trigger" type="button" class="new-note" :aria-label="t('noteNew')" :title="t('noteNew')"
    :aria-expanded="opened" :aria-controls="opened ? 'quick-note' : undefined" @click="open">
    <NoteIcon /><span>{{ t('noteNew') }}</span>
  </button>
  <section v-if="opened" id="quick-note" :aria-label="t('quickNote')"
    @keydown.esc.stop="!$event.isComposing && close()">
    <div class="quick-note-heading">
      <h2>{{ t('quickNote') }}</h2>
      <button ref="previewButton" type="button" :aria-label="t(preview ? 'editNote' : 'previewTab')"
        :title="t(preview ? 'editNote' : 'previewTab')" @click="togglePreview">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="preview" d="m4 20 1-5L16 4l4 4L9 19l-5 1Zm10-14 4 4" />
          <g v-else><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></g>
        </svg>
      </button>
      <button type="button" :aria-label="t('closeQuickNote')" :title="t('closeQuickNote')" @click="close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <textarea v-show="!preview" ref="input" v-model="body" :aria-label="t('noteBody')" :readonly="draft?.replacing" />
    <div v-if="preview" class="quick-preview">
      <div v-if="body" class="markdown" v-html="renderMarkdown(body)"></div>
      <p v-else>{{ t('noteUntitled') }}</p>
    </div>
    <NoteSaveStatus v-if="draft" :draft="draft" :editor="editor" :language="language" show-saved />
  </section>
</template>

<style scoped>
#quick-note {
  position: absolute;
  inset: calc(100% + 4px) 8px auto auto;
  width: min(380px, calc(100vw - 16px));
  max-height: calc(100dvh - 100% - 12px);
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 6px 24px rgb(0 0 0 / .13);
}
.quick-note-heading { display: flex; gap: 4px; align-items: center; margin-bottom: 8px; }
.quick-note-heading h2 { flex: 1; margin: 0; font-size: 15px; }
.quick-note-heading button { width: 32px; padding: 0; display: grid; place-items: center; border-color: transparent; }
.quick-note-heading svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
textarea, .quick-preview {
  display: block;
  width: 100%;
  height: min(200px, 45dvh);
  overflow: auto;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font: inherit;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
textarea { resize: none; }
.quick-preview > p { margin: 0; color: var(--muted); }
</style>
