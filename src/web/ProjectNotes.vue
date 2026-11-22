<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { blockLink, blockLinkPrefix, blockTarget } from '../core/notes.js';
import type { BlockQuote, BlockTarget } from '../core/notes.js';
import RecordWorkbench from './RecordWorkbench.vue';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLinkInsertion, renderMarkdown } from './markdown.js';
import { useNotesEditor } from './notes-editor.js';
import type { NotesPosition } from './notes-editor.js';

const props = defineProps<{
  visible: boolean; language: Language; quote: BlockQuote | undefined; listOpen: boolean;
  visit: (target: BlockTarget) => Promise<string | undefined>;
}>();
const emit = defineEmits<{ clearQuote: []; select: []; openList: [] }>();
const t = (key: string) => translate(props.language, key);
const editor = useNotesEditor();
const { drafts, selected, loaded, loading, loadProblem } = editor;
const filter = ref('');
const tag = ref('');
const editing = ref(false);
const previewOnly = ref(false);
const query = ref('');
const rendered = ref<HTMLElement>();
const refLink = ref(-1);
let linkOffset = 0;
const explicitTarget = ref('');
const editButton = ref<HTMLButtonElement>();
const textarea = ref<HTMLTextAreaElement>();
const visitMessage = ref<HTMLElement>();
const visitProblem = ref('');
const visiting = ref(false);
let visitSequence = 0;
const active = computed(() => drafts.get(selected.value));
const tags = computed(() => [...new Set([...drafts.values()].flatMap(draft => draft.tags))]);
const matchingTags = computed(() => tags.value.filter(item => item.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())));
const missingTags = computed(() => !!query.value.trim() && !matchingTags.value.length);
const entries = computed(() => missingTags.value ? [] : [...drafts.values()].filter(draft => !filter.value || draft.tags.includes(filter.value)));
function clearFilter() {
  query.value = '';
  filter.value = '';
}
watch([entries, selected], () => {
  if (!entries.value.some(draft => draft.id === selected.value)) {
    selected.value = entries.value[0]?.id ?? '';
    editing.value = false;
    previewOnly.value = false;
  }
});
function select(id: string) {
  selected.value = id;
  explicitTarget.value = id;
  editing.value = false;
  previewOnly.value = false;
  emit('select');
}
function beginEdit() {
  editing.value = true;
  previewOnly.value = false;
  nextTick(() => textarea.value?.focus());
}
function finishEdit() {
  editing.value = false;
  previewOnly.value = false;
  nextTick(() => editButton.value?.focus());
}
defineExpose({
  async createBlank(current: () => boolean) {
    await editor.load(!!loadProblem.value);
    if (current() && loaded.value && !loadProblem.value) create('');
  },
  capturePosition: (): NotesPosition => ({ selected: selected.value, filter: filter.value, query: query.value,
    editing: editing.value, preview: previewOnly.value, link: refLink.value, linkOffset,
    href: rendered.value?.querySelectorAll('a')[refLink.value]?.getAttribute('href') ?? '' }),
  async restorePosition(position: NotesPosition, current: () => boolean) {
    await editor.load(true);
    if (!current()) return false;
    query.value = position.query;
    filter.value = tags.value.includes(position.filter) ? position.filter : '';
    const found = entries.value.find(entry => entry.id === position.selected);
    selected.value = found?.id ?? entries.value[0]?.id ?? '';
    editing.value = !!found && position.editing;
    previewOnly.value = position.preview;
    return (!position.selected || !!found) && (!position.filter || !!filter.value);
  },
  focusReference(position: NotesPosition) {
    if (position.selected !== selected.value || !position.href) return;
    const links = [...(rendered.value?.querySelectorAll('a') ?? [])];
    const same = (link?: HTMLAnchorElement) => link?.getAttribute('href') === position.href;
    const link = same(links[position.link]) ? links[position.link] : links.find(item => same(item));
    if (!link?.getClientRects().length) return;
    const pane = link.closest('.record-detail');
    if (pane) pane.scrollTop += link.getBoundingClientRect().top - pane.getBoundingClientRect().top - position.linkOffset;
    link.focus({ preventScroll: true });
    link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  },
});
watch(() => [props.visible, props.quote] as const, ([visible, quote], [wasVisible, previousQuote]) => {
  if (!visible) return;
  if (quote && quote !== previousQuote) {
    clearFilter();
    explicitTarget.value = '';
    editing.value = false;
  }
  if (!wasVisible) void editor.load();
});
watch(selected, () => { tag.value = ''; visitProblem.value = ''; refLink.value = -1; });
watch(tags, list => { if (!list.includes(filter.value)) filter.value = ''; });

function title(body: string) {
  const firstLine = body.split('\n').find(line => line.trim());
  if (!firstLine) return t('noteUntitled');
  const element = document.createElement('template');
  element.innerHTML = renderMarkdown(firstLine);
  const text = element.content.textContent?.trim() || firstLine.trim();
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}

function create(body: string) {
  editor.create(body);
  clearFilter();
  emit('select');
  beginEdit();
  emit('clearQuote');
}

async function append() {
  const draft = active.value;
  if (!props.quote || !draft || explicitTarget.value !== draft.id) return;
  const insertion = blockLinkInsertion(draft.body, blockLink(props.quote));
  beginEdit();
  await nextTick();
  const input = textarea.value;
  if (!input || active.value !== draft) return;
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
  if (filter.value === value) clearFilter();
  draft.tags = draft.tags.filter(item => item !== value);
  editor.changed(draft);
}

async function follow(event: MouseEvent) {
  const anchor = (event.target as Element).closest('a');
  const href = anchor?.getAttribute('href');
  if (!anchor || !href?.startsWith(blockLinkPrefix)) return;
  event.preventDefault();
  linkOffset = anchor.getBoundingClientRect().top - (anchor.closest('.record-detail')?.getBoundingClientRect().top ?? 0);
  refLink.value = [...(rendered.value?.querySelectorAll('a') ?? [])].findIndex(item => item === anchor);
  const sequence = ++visitSequence;
  visitProblem.value = '';
  const target = blockTarget(href);
  if (target) {
    visiting.value = true;
    const problem = await props.visit(target);
    refLink.value = -1;
    if (sequence !== visitSequence) return;
    visitProblem.value = problem ?? '';
    visiting.value = false;
  } else {
    visiting.value = false;
    visitProblem.value = t('noteInvalidLink');
  }
  await nextTick();
  if (props.visible && sequence === visitSequence && visitMessage.value) {
    visitMessage.value.focus({ preventScroll: true });
    visitMessage.value.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

async function remove() {
  const draft = active.value;
  if (!draft || !window.confirm(t('noteDeleteConfirm'))) return;
  await editor.remove(draft);
  if (!drafts.has(draft.id)) { editing.value = false; emit('select'); }
}

function loadSaved() {
  if (active.value && window.confirm(t('noteLoadConfirm'))) void editor.loadSaved(active.value);
}
</script>

<template>
  <RecordWorkbench page="notes" :heading="t('notes')" list-id="note-navigation" :list-open="listOpen">
    <template #status>
      <p v-if="loading" role="status">{{ t('loading') }}</p>
      <div v-if="loadProblem">
        <p class="bookmark-error" role="alert">{{ problemText(language, loadProblem).message }} {{ problemText(language, loadProblem).nextStep }}</p>
        <button type="button" @click="editor.load(true)">{{ t('retry') }}</button>
      </div>
    </template>
    <template #list>
      <label class="record-filter">{{ t('searchTags') }}
        <input v-model="query" type="search" @input="filter = ''">
      </label>
      <label class="record-filter" for="note-tag-filter">{{ t('noteFilter') }}
        <select id="note-tag-filter" v-model="filter">
          <option value="">{{ t('noteAllTags') }}</option>
          <option v-for="item in matchingTags" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <p v-if="missingTags">{{ t('noTagsFound') }}</p>
      <button v-if="filter || query" type="button" @click="clearFilter">{{ t('clearFilter') }}</button>
      <p v-if="quote">{{ t('noteChooseTarget') }}</p>
      <p v-if="loaded && !entries.length && !missingTags" class="narrow-list-empty">{{ t(filter ? 'noteNoMatches' : 'noteEmpty') }}</p>
      <ul class="note-list">
        <li v-for="entry in entries" :key="entry.id">
          <button type="button" :aria-current="selected === entry.id || undefined" @click="select(entry.id)">
            <strong>{{ title(entry.body) }}</strong>
            <span v-if="entry.tags.length" class="note-list-tags">{{ entry.tags.join(' · ') }}</span>
            <span v-if="entry.problem" class="bookmark-error note-list-tags">{{ t('noteSaveFailed') }}</span>
            <span v-else-if="entry.busy || entry.dirty" class="note-list-tags">{{ t('noteSaving') }}</span>
          </button>
        </li>
      </ul>
    </template>
    <section v-if="quote" class="note-quote">
      <h2>{{ t('noteAddSelection') }}</h2>
      <blockquote>{{ quote.text }}</blockquote>
      <div class="bookmark-actions">
        <button type="button" :disabled="!loaded || loading" @click="create(blockLink(quote))">{{ t('noteNewWithQuote') }}</button>
        <button v-if="!listOpen" type="button" @click="emit('openList')">{{ t('openNoteList') }}</button>
        <button type="button" :disabled="!active || active.replacing || active.id !== explicitTarget" @click="append">{{ t('noteAppend') }}</button>
        <button type="button" @click="emit('clearQuote')">{{ t('bookmarkCancel') }}</button>
      </div>
    </section>
    <p v-if="loaded && !active">{{ t(missingTags ? 'noTagsFound' : filter ? 'noteNoMatches' : 'noteEmpty') }}</p>
    <article v-if="active" :key="active.id" class="note-detail" :class="{ editing, 'preview-only': previewOnly }">
      <div class="note-actions">
        <button v-if="!editing" ref="editButton" type="button" @click="beginEdit">{{ t('editNote') }}</button>
        <template v-else>
          <button type="button" @click="finishEdit">{{ t('doneNote') }}</button>
          <button type="button" :disabled="active.busy" @click="remove">{{ t('noteDelete') }}</button>
        </template>
      </div>
      <div v-if="active.problem" class="note-save-problem">
        <p role="alert" class="bookmark-error">{{ t('noteSaveFailed') }} {{ problemText(language, active.problem).message }}
          {{ problemText(language, active.problem).nextStep }}</p>
        <button v-if="active.problem.code === 'NOTE_CONFLICT'" type="button" :disabled="active.busy"
          @click="loadSaved">{{ t('noteLoadSaved') }}</button>
        <button v-else-if="active.dirty" type="button" :disabled="active.busy" @click="editor.save(active)">{{ t('noteRetry') }}</button>
      </div>
      <p v-else-if="editing || active.busy || active.dirty" class="bookmark-status" role="status">{{ t(active.busy || active.dirty ? 'noteSaving' : 'noteSaved') }}</p>

      <div v-if="editing" class="note-view-switch">
        <button type="button" :aria-pressed="!previewOnly" @click="previewOnly = false">{{ t('editNote') }}</button>
        <button type="button" :aria-pressed="previewOnly" @click="previewOnly = true">{{ t('previewTab') }}</button>
      </div>
      <div class="note-columns">
        <section v-if="editing" class="note-input">
          <label for="note-body">{{ t('noteBody') }}</label>
          <textarea id="note-body" ref="textarea" v-model="active.body" rows="15" aria-describedby="note-body-help" :readonly="active.replacing"
            @update:model-value="editor.changed(active)" />
          <p id="note-body-help" class="note-help">{{ t('noteMarkdown') }}</p>
        </section>
        <section class="note-preview">
          <h2 v-if="editing">{{ t('notePreview') }}</h2>
          <p v-if="visiting" role="status">{{ t('loading') }}</p>
          <p v-if="visitProblem" ref="visitMessage" class="notice note-visit-problem" role="alert" tabindex="-1">{{ visitProblem }}</p>
          <div v-if="active.body.trim()" ref="rendered" class="markdown" :class="{ 'note-with-title': /^[^\n]{1,100}\n\s*\n/u.test(active.body.trimStart()) }"
            v-html="renderMarkdown(active.body, { prefix: blockLinkPrefix, title: t('noteBlockLink') })" @click="follow"></div>
          <p v-else>{{ t('noteUntitled') }}</p>
        </section>
      </div>
      <form v-if="editing" class="note-tag-form" @submit.prevent="addTag">
        <label for="note-tag">{{ t('noteTag') }}</label>
        <div class="bookmark-actions">
          <input id="note-tag" v-model="tag" type="text" :disabled="active.replacing">
          <button type="submit" :disabled="active.replacing || !tag.trim() || active.tags.includes(tag)">{{ t('noteAddTag') }}</button>
        </div>
      </form>
      <ul v-if="active.tags.length" class="note-tags" :aria-label="t('noteTags')">
        <li v-for="item in active.tags" :key="item">
          <span v-if="!editing">{{ item }}</span>
          <button v-else type="button" :disabled="active.replacing" :aria-label="t('noteRemoveTag') + ' ' + item"
            @click="removeTag(item)">{{ item }} <span aria-hidden="true">×</span></button>
        </li>
      </ul>
    </article>
  </RecordWorkbench>
</template>
