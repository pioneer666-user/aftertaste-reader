<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { blockLink, blockLinkPrefix, blockTarget } from '../core/notes.js';
import type { BlockQuote, BlockTarget } from '../core/notes.js';
import NoteBody from './NoteBody.vue';
import NoteSaveStatus from './NoteSaveStatus.vue';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLinkInsertion, noteName } from './markdown.js';
import { copyNotePreview, renderNote } from './note-preview.js';
import type { NotesEditor } from './notes-editor.js';

const props = defineProps<{ editor: NotesEditor; language: Language; visit: (target: BlockTarget) => Promise<string | undefined> }>();
const t = (key: string) => translate(props.language, key);
const mode = ref<'closed' | 'list' | 'edit'>('closed');
const preview = ref(false), addingTag = ref(false);
const id = ref(''), query = ref(''), tag = ref(''), visitProblem = ref('');
const { drafts, loading, loadProblem } = props.editor;
const draft = computed(() => drafts.get(id.value));
const entries = computed(() => [...drafts.values()].filter(item =>
  noteName(item, t('noteUntitled')).toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())));
const knownTags = computed(() => [...new Set([...drafts.values()].flatMap(item => item.tags))]);
const trigger = ref<HTMLButtonElement>(), search = ref<HTMLInputElement>(), tagInput = ref<HTMLInputElement>();
const input = ref<InstanceType<typeof NoteBody>>();
let scrollTop = 0;

function change(fields: Partial<{ title: string; body: string; tags: readonly string[] }>) {
  if (draft.value?.replacing) return;
  if (!draft.value) id.value = props.editor.create('');
  Object.assign(draft.value!, fields);
  props.editor.changed(draft.value!);
}
const title = computed({ get: () => draft.value?.title ?? '', set: (value: string) => change({ title: value }) });

async function list() {
  query.value = '';
  mode.value = 'list';
  void props.editor.load(true);
  await nextTick();
  search.value?.focus({ preventScroll: true });
}

async function edit(noteId = '') {
  id.value = noteId;
  preview.value = false;
  addingTag.value = false;
  tag.value = visitProblem.value = '';
  mode.value = 'edit';
  await nextTick();
  input.value?.focus();
}

async function addQuote(quote: BlockQuote) {
  // An explicit capture starts its own note unless the reader is already editing one here.
  if (mode.value !== 'edit' || draft.value?.replacing) await edit();
  preview.value = false;
  await nextTick();
  input.value?.append(blockLinkInsertion(draft.value?.body ?? '', blockLink(quote)) + '\n\n');
}
defineExpose({ addQuote });

function close() {
  mode.value = 'closed';
  trigger.value?.focus({ preventScroll: true });
}
async function togglePreview() {
  if (!preview.value) scrollTop = input.value?.scrollTop() ?? 0;
  preview.value = !preview.value;
  if (!preview.value) {
    await nextTick();
    input.value?.focus();
    input.value?.restoreScroll(scrollTop);
  }
}
function addTag() {
  const value = tag.value.trim();
  if (!value) return;
  const tags = draft.value?.tags ?? [];
  if (!tags.includes(value)) change({ tags: [...tags, value] });
  tag.value = '';
  addingTag.value = false;
}
async function follow(event: MouseEvent) {
  const href = (event.target as Element).closest('a')?.getAttribute('href');
  if (!href?.startsWith(blockLinkPrefix)) return;
  event.preventDefault();
  const target = blockTarget(href);
  const current = id.value;
  const problem = target ? await props.visit(target) : t('noteInvalidLink');
  if (mode.value !== 'edit' || current !== id.value) return;
  if (problem) visitProblem.value = problem;
  else mode.value = 'closed';
}
</script>
<template>
  <button ref="trigger" type="button" class="new-note" :aria-label="t('noteList')" :title="t('noteList')"
    :aria-expanded="mode !== 'closed'" :aria-controls="mode !== 'closed' ? 'quick-note' : undefined" @click="list">
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>
    </svg><span>{{ t('noteList') }}</span>
  </button>
  <section v-if="mode !== 'closed'" id="quick-note" :aria-label="t(mode === 'list' ? 'noteList' : 'quickNote')"
    @keydown.esc.stop="!$event.isComposing && close()">
    <div class="quick-note-heading">
      <h2 v-if="mode === 'list'">{{ t('noteList') }}</h2>
      <template v-else>
        <button type="button" :aria-label="t('noteBack')" :title="t('noteBack')" @click="list">‹</button>
        <input v-if="!preview" v-model="title" class="quick-title" :placeholder="t('noteTitle')" :aria-label="t('noteTitle')" :readonly="draft?.replacing">
        <h2 v-else>{{ draft ? noteName(draft, t('noteUntitled')) : t('noteUntitled') }}</h2>
        <button type="button" :aria-label="t(preview ? 'editNote' : 'previewTab')" :title="t(preview ? 'editNote' : 'previewTab')" @click="togglePreview">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path v-if="preview" d="m4 20 1-5L16 4l4 4L9 19l-5 1Zm10-14 4 4" />
            <g v-else><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></g>
          </svg>
        </button>
      </template>
      <button type="button" :aria-label="t('closeQuickNote')" :title="t('closeQuickNote')" @click="close">×</button>
    </div>
    <template v-if="mode === 'list'">
      <input ref="search" v-model="query" class="quick-search" type="search" :aria-label="t('noteSearch')" :placeholder="t('noteSearch')">
      <p v-if="loading" role="status">{{ t('loading') }}</p>
      <div v-if="loadProblem" role="alert">{{ problemText(language, loadProblem).message }} <button @click="editor.load(true)">{{ t('retry') }}</button></div>
      <ul v-if="entries.length" class="quick-list">
        <li v-for="entry in entries" :key="entry.id"><button type="button" @click="edit(entry.id)">
          <span>{{ noteName(entry, t('noteUntitled')) }}</span>
          <small v-if="entry.problem">{{ t('noteSaveFailed') }}</small><small v-else-if="entry.id === id">{{ t('noteCurrent') }}</small>
        </button></li>
      </ul>
      <p v-else-if="!loading && !loadProblem">{{ t(query ? 'noteSearchEmpty' : 'noteEmpty') }}</p>
      <button type="button" class="quick-new" @click="edit()"><span aria-hidden="true">＋</span> {{ t('noteNew') }}</button>
    </template>
    <template v-else>
      <NoteBody v-show="!preview" ref="input" :model-value="draft?.body ?? ''" :label="t('noteBody')" :readonly="!!draft?.replacing"
        @update:model-value="change({ body: $event })" />
      <div v-if="preview" class="quick-preview">
        <div v-if="draft?.body" class="markdown" v-html="renderNote(draft.body, t('noteBlockLink'))" @copy="copyNotePreview" @click="follow"></div>
        <p v-else>{{ t('noteUntitled') }}</p>
        <p v-if="visitProblem" role="alert">{{ visitProblem }}</p>
      </div>
      <div class="quick-tags" :aria-label="t('noteTags')">
        <template v-for="value in draft?.tags" :key="value">
          <span v-if="preview">{{ value }}</span>
          <button v-else type="button" :aria-label="t('noteRemoveTag') + ' ' + value" :disabled="draft?.replacing"
            @click="change({tags: draft!.tags.filter(item => item !== value)})">{{ value }} ×</button>
        </template>
        <template v-if="!preview">
          <form v-if="addingTag" @submit.prevent="addTag">
            <input ref="tagInput" v-model="tag" :aria-label="t('noteTag')" :placeholder="t('noteTag')" list="quick-tag-options">
            <datalist id="quick-tag-options"><option v-for="value in knownTags" :key="value" :value="value" /></datalist>
            <button :disabled="!tag.trim()" type="submit">{{ t('noteAddTag') }}</button>
          </form>
          <button v-else type="button" :disabled="draft?.replacing" @click="addingTag = true; nextTick(() => tagInput?.focus())">＋ {{ t('noteTags') }}</button>
        </template>
      </div>
      <NoteSaveStatus v-if="draft" :draft="draft" :editor="editor" :language="language" show-saved />
    </template>
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
.quick-preview {
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
.note-body-editor { height: min(200px, 45dvh); }
.quick-title, .quick-search, .quick-tags input { min-width: 0; border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; font: inherit; }
.quick-title { flex: 1; font-size: 15px; font-weight: 600; border-color: transparent; }
.quick-search { width: 100%; background: #f5f7f5; }
.quick-list { max-height: min(16rem, 42dvh); overflow: auto; padding: 0; margin: 8px 0; list-style: none; }
.quick-list button, .quick-new { width: 100%; text-align: start; border-color: transparent; }
.quick-list button { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.quick-list span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quick-list small { flex: none; color: var(--muted); }
.quick-new { border-top: 1px solid var(--line); border-radius: 0; }
.quick-tags, .quick-tags form { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.quick-tags { margin-top: 8px; }
.quick-tags button, .quick-tags span { overflow-wrap: anywhere; max-width: 100%; }
.quick-note-heading h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quick-preview > p { margin: 0; color: var(--muted); }
</style>
