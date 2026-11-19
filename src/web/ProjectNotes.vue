<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { blockLink, blockLinkPrefix, blockTarget } from '../core/notes.js';
import type { BlockQuote, BlockTarget } from '../core/notes.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLinkInsertion, renderMarkdown } from './markdown.js';
import { useNotesEditor } from './notes-editor.js';

const props = defineProps<{
  visible: boolean; language: Language; quote: BlockQuote | undefined;
  visit: (target: BlockTarget) => Promise<string | undefined>;
}>();
const emit = defineEmits<{ clearQuote: [] }>();
const t = (key: string) => translate(props.language, key);
const editor = useNotesEditor();
const { drafts, selected, loaded, loading, loadProblem } = editor;
const filter = ref('');
const tag = ref('');
const panel = ref<HTMLElement>();
const textarea = ref<HTMLTextAreaElement>();
const visitMessage = ref<HTMLElement>();
const visitProblem = ref('');
const visiting = ref(false);
const active = computed(() => drafts.get(selected.value));
const tags = computed(() => [...new Set([...drafts.values()].flatMap(draft => draft.tags))]);
const entries = computed(() => [...drafts.values()].filter(draft => !filter.value || draft.tags.includes(filter.value)));

watch(() => [props.visible, props.quote] as const, async ([visible, quote], [wasVisible]) => {
  if (!visible) return;
  if (quote) {
    filter.value = '';
    selected.value = '';
  }
  if (!wasVisible) {
    void editor.load();
    await nextTick();
    panel.value?.focus();
  }
});
watch(selected, () => { tag.value = ''; visitProblem.value = ''; });
watch(tags, list => { if (!list.includes(filter.value)) filter.value = ''; });

function title(body: string) {
  const firstLine = body.split('\n').find(line => line.trim());
  if (!firstLine) return t('noteUntitled');
  const element = document.createElement('template');
  element.innerHTML = renderMarkdown(firstLine);
  const text = element.content.textContent?.trim() || firstLine.trim();
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}

async function create() {
  editor.create(props.quote ? blockLink(props.quote) : '');
  filter.value = '';
  emit('clearQuote');
  await nextTick();
  textarea.value?.focus();
}

function append() {
  const draft = active.value;
  const input = textarea.value;
  if (!props.quote || !draft || !input) return;
  const insertion = blockLinkInsertion(draft.body, blockLink(props.quote));
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  if (!document.execCommand('insertText', false, insertion)) {
    input.setRangeText(insertion, input.value.length, input.value.length, 'end');
  }
  draft.body = input.value;
  editor.changed(draft);
  emit('clearQuote');
}

function addTag() {
  const draft = active.value;
  if (!draft || !tag.value.trim() || draft.tags.includes(tag.value)) return;
  draft.tags = [...draft.tags, tag.value];
  tag.value = '';
  editor.changed(draft);
}

function removeTag(value: string) {
  const draft = active.value!;
  draft.tags = draft.tags.filter(item => item !== value);
  editor.changed(draft);
}

async function follow(event: MouseEvent) {
  const anchor = (event.target as Element).closest('a');
  const href = anchor?.getAttribute('href');
  if (!href?.startsWith(blockLinkPrefix)) return;
  event.preventDefault();
  if (visiting.value) return;
  visitProblem.value = '';
  const target = blockTarget(href);
  if (target) {
    visiting.value = true;
    try { visitProblem.value = await props.visit(target) ?? ''; }
    finally { visiting.value = false; }
  } else visitProblem.value = t('noteInvalidLink');
  await nextTick();
  visitMessage.value?.focus();
}

async function remove() {
  const draft = active.value;
  if (!draft || !window.confirm(t('noteDeleteConfirm'))) return;
  await editor.remove(draft);
  if (!active.value) panel.value?.focus();
}

function loadSaved() {
  if (active.value && window.confirm(t('noteLoadConfirm'))) void editor.loadSaved(active.value);
}
</script>

<template>
  <main id="notes" ref="panel" class="notes-panel" tabindex="-1" aria-labelledby="notes-heading">
    <div class="bookmark-heading">
      <h1 id="notes-heading">{{ t('notes') }}</h1>
      <button type="button" :disabled="!loaded" @click="create">{{ t('noteNew') }}</button>
    </div>
    <p v-if="loading" role="status">{{ t('loading') }}</p>
    <div v-if="loadProblem">
      <p class="bookmark-error" role="alert">{{ problemText(language, loadProblem).message }} {{ problemText(language, loadProblem).nextStep }}</p>
      <button type="button" @click="editor.load">{{ t('retry') }}</button>
    </div>
    <section v-if="quote" class="note-quote" aria-labelledby="note-quote-heading">
      <h2 id="note-quote-heading">{{ t('noteAddSelection') }}</h2>
      <blockquote>{{ quote.text }}</blockquote>
      <p>{{ t('noteChooseTarget') }}</p>
      <div class="bookmark-actions">
        <button type="button" :disabled="!active || active.replacing" @click="append">{{ t('noteAppend') }}</button>
        <button type="button" @click="emit('clearQuote')">{{ t('bookmarkCancel') }}</button>
      </div>
    </section>
    <div v-if="loaded" class="note-workspace">
      <aside class="note-navigation" :aria-label="t('notes')">
        <label for="note-tag-filter">{{ t('noteFilter') }}</label>
        <select id="note-tag-filter" v-model="filter">
          <option value="">{{ t('noteAllTags') }}</option>
          <option v-for="item in tags" :key="item" :value="item">{{ item }}</option>
        </select>
        <p v-if="!entries.length">{{ t(filter ? 'noteNoMatches' : 'noteEmpty') }}</p>
        <ul v-else class="note-list">
          <li v-for="entry in entries" :key="entry.id">
            <button type="button" :aria-current="selected === entry.id ? 'true' : undefined" @click="selected = entry.id">
              {{ title(entry.body) }}
              <span v-if="entry.tags.length" class="note-list-tags">{{ entry.tags.join(' · ') }}</span>
              <span v-if="entry.problem" class="bookmark-error note-list-tags">{{ t('noteSaveFailed') }}</span>
            </button>
          </li>
        </ul>
      </aside>
      <section v-if="active" :key="active.id" class="note-detail" :aria-label="t('noteEditor')">
        <div class="note-edit-heading">
          <label for="note-body">{{ t('noteBody') }}</label>
          <button type="button" :disabled="active.busy" @click="remove">{{ t('noteDelete') }}</button>
        </div>
        <textarea id="note-body" ref="textarea" v-model="active.body" rows="8" aria-describedby="note-body-help" :readonly="active.replacing"
          @update:model-value="editor.changed(active)" />
        <p id="note-body-help" class="note-help">{{ t('noteMarkdown') }}</p>
        <div v-if="active.problem" class="note-save-problem">
          <p role="alert" class="bookmark-error">{{ t('noteSaveFailed') }} {{ problemText(language, active.problem).message }}
            {{ problemText(language, active.problem).nextStep }}</p>
          <button v-if="active.problem.code === 'NOTE_CONFLICT'" type="button" :disabled="active.busy"
            @click="loadSaved">{{ t('noteLoadSaved') }}</button>
          <button v-else-if="active.dirty" type="button" :disabled="active.busy" @click="editor.save(active)">{{ t('noteRetry') }}</button>
        </div>
        <p v-else class="bookmark-status" role="status">{{ t(active.busy || active.dirty ? 'noteSaving' : 'noteSaved') }}</p>

        <form class="note-tag-form" @submit.prevent="addTag">
          <label for="note-tag">{{ t('noteTag') }}</label>
          <div class="bookmark-actions">
            <input id="note-tag" v-model="tag" type="text" :disabled="active.replacing">
            <button type="submit" :disabled="active.replacing || !tag.trim() || active.tags.includes(tag)">{{ t('noteAddTag') }}</button>
          </div>
        </form>
        <ul v-if="active.tags.length" class="note-tags" :aria-label="t('noteTags')">
          <li v-for="item in active.tags" :key="item">
            <button type="button" :disabled="active.replacing" :aria-label="t('noteRemoveTag') + ' ' + item"
              @click="removeTag(item)">{{ item }} <span aria-hidden="true">×</span></button>
          </li>
        </ul>

        <section v-if="active.body" class="note-preview" aria-labelledby="note-preview-heading">
          <h2 id="note-preview-heading">{{ t('notePreview') }}</h2>
          <p v-if="visiting" role="status">{{ t('loading') }}</p>
          <p v-if="visitProblem" ref="visitMessage" class="notice note-visit-problem" role="alert" tabindex="-1">{{ visitProblem }}</p>
          <div class="markdown" v-html="renderMarkdown(active.body, { prefix: blockLinkPrefix, title: t('noteBlockLink') })"
            @click="follow"></div>
        </section>
      </section>
    </div>
  </main>
</template>
