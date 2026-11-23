<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { isNoteHref, blockTarget } from '../core/notes.js';
import type { NoteTarget } from '../core/notes.js';
import NoteBody from './NoteBody.vue';
import NoteSaveStatus from './NoteSaveStatus.vue';
import RecordWorkbench from './RecordWorkbench.vue';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { copyNotePreview, noteParts } from './note-preview.js';
import { noteName } from './markdown.js';
import type { NotesEditor, NotesPosition } from './notes-editor.js';

const props = defineProps<{
  editor: NotesEditor; visible: boolean; language: Language; listOpen: boolean;
  visit: (target: NoteTarget) => Promise<string | undefined>;
}>();
const emit = defineEmits<{ select: [] }>();
const t = (key: string) => translate(props.language, key);
const { editor } = props;
const { drafts, loaded, loading, loadProblem } = editor;
const selected = ref('');
const filter = ref('');
const tag = ref('');
const titleOpen = ref(false);
const addingTag = ref(false);
const titleInput = ref<HTMLInputElement>();
const tagInput = ref<HTMLInputElement>();
const tagButton = ref<HTMLButtonElement>();
const popup = ref<'filter' | 'more'>();
const filterButton = ref<HTMLButtonElement>();
const moreButton = ref<HTMLButtonElement>();
const search = ref<HTMLInputElement>();
const deleteButton = ref<HTMLButtonElement>();
const editing = ref(false);
const previewOnly = ref(false);
const query = ref('');
const rendered = ref<HTMLElement>();
const readTitle = ref<HTMLElement>();
const previewTitle = ref<HTMLElement>();
const refLink = ref(-1);
let linkOffset = 0;
const editButton = ref<HTMLButtonElement>();
const textarea = ref<InstanceType<typeof NoteBody>>();
const visitMessage = ref<HTMLElement>();
const visitProblem = ref('');
const visiting = ref(false);
let visitSequence = 0;
const active = computed(() => drafts.get(selected.value));
const tags = computed(() => [...new Set([...drafts.values()].flatMap(draft => draft.tags))]);
const matchingTags = computed(() => tags.value.filter(item => item.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())));
const entries = computed(() => [...drafts.values()].filter(draft => !filter.value || draft.tags.includes(filter.value)));
const preview = computed(() => noteParts(active.value?.body ?? '', t('noteBlockLink'), !active.value?.title.trim()));
const heading = computed(() => active.value?.title.trim() ? active.value.title : preview.value.heading
  || (!active.value?.body.trim() ? t('noteUntitled') : ''));

function closePopup(restoreFocus = false) {
  const trigger = popup.value === 'filter' ? filterButton.value : moreButton.value;
  popup.value = undefined;
  query.value = '';
  if (restoreFocus) nextTick(() => trigger?.focus({ preventScroll: true }));
}
function escapePopup(event: KeyboardEvent) {
  if (!popup.value || event.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  closePopup(true);
}
function togglePopup(which: 'filter' | 'more') {
  if (popup.value === which) return closePopup(true);
  popup.value = which;
  nextTick(() => (which === 'filter' ? search.value : deleteButton.value)?.focus());
}
function dismissOutside(event: Event) {
  const trigger = popup.value === 'filter' ? filterButton.value : moreButton.value;
  if (event.target instanceof Node && !trigger?.parentElement?.contains(event.target)) closePopup();
}
watch(popup, open => {
  for (const type of ['pointerdown', 'focusin']) {
    if (open) document.addEventListener(type, dismissOutside);
    else document.removeEventListener(type, dismissOutside);
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissOutside);
  document.removeEventListener('focusin', dismissOutside);
});
watch([() => props.visible, () => props.listOpen], () => closePopup());
function chooseFilter(value: string) {
  filter.value = value;
  closePopup(true);
}
function resetFields() {
  titleOpen.value = false;
  addingTag.value = false;
  tag.value = '';
  closePopup();
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
  editing.value = false;
  previewOnly.value = false;
  emit('select');
}
function beginEdit() {
  resetFields();
  titleOpen.value = !!active.value?.title.trim();
  editing.value = true;
  previewOnly.value = false;
  nextTick(() => textarea.value?.focus());
}
function finishEdit() {
  resetFields();
  editing.value = false;
  previewOnly.value = false;
  nextTick(() => editButton.value?.focus());
}
defineExpose({
  capturePosition: (): NotesPosition => ({ selected: selected.value, filter: filter.value, query: query.value,
    editing: editing.value, preview: previewOnly.value, link: refLink.value, linkOffset,
    href: rendered.value?.querySelectorAll('a')[refLink.value]?.getAttribute('href') ?? '' }),
  async restorePosition(position: NotesPosition, current: () => boolean) {
    await editor.load(true);
    if (!current()) return false;
    resetFields();
    filter.value = tags.value.includes(position.filter) ? position.filter : '';
    const found = entries.value.find(entry => entry.id === position.selected);
    selected.value = found?.id ?? entries.value[0]?.id ?? '';
    editing.value = !!found && position.editing;
    titleOpen.value = !!found?.title.trim();
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
watch(() => props.visible, visible => { if (visible) void editor.load(); });
watch(selected, () => { addingTag.value = false; tag.value = ''; visitProblem.value = ''; refLink.value = -1; });
watch(tags, list => { if (!list.includes(filter.value)) filter.value = ''; });

function addTag() {
  const draft = active.value;
  if (!draft || !tag.value.trim() || draft.tags.includes(tag.value)) return;
  draft.tags = [...draft.tags, tag.value];
  tag.value = '';
  addingTag.value = false;
  nextTick(() => tagButton.value?.focus());
  editor.changed(draft);
}

function removeTag(value: string) {
  const draft = active.value!;
  if (filter.value === value) filter.value = '';
  draft.tags = draft.tags.filter(item => item !== value);
  editor.changed(draft);
}

async function follow(event: MouseEvent) {
  const anchor = (event.target as Element).closest('a');
  const href = anchor?.getAttribute('href');
  if (!anchor || !isNoteHref(href)) return;
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
  closePopup(true);
  if (!draft || !window.confirm(t('noteDeleteConfirm'))) return;
  await editor.remove(draft);
  if (!drafts.has(draft.id)) { editing.value = false; emit('select'); }
}

</script>

<template>
  <RecordWorkbench page="notes" compact-heading :heading="t('notes')" list-id="note-navigation" :list-open="listOpen">
    <template #status>
      <p v-if="loading" role="status">{{ t('loading') }}</p>
      <div v-if="loadProblem">
        <p class="bookmark-error" role="alert">{{ problemText(language, loadProblem).message }} {{ problemText(language, loadProblem).nextStep }}</p>
        <button type="button" @click="editor.load(true)">{{ t('retry') }}</button>
      </div>
    </template>
    <template #list>
      <div class="note-filter-control" @keydown.esc="escapePopup">
        <button id="note-tag-filter" ref="filterButton" type="button" :aria-expanded="popup === 'filter'"
          @click="togglePopup('filter')">{{ filter || t('noteAllTags') }} <span aria-hidden="true">▾</span></button>
        <div v-if="popup === 'filter'" class="note-menu filter-menu">
          <input ref="search" v-model="query" type="search" :aria-label="t('searchTags')" :placeholder="t('searchTags')">
          <button type="button" :aria-pressed="!filter" @click="chooseFilter('')">{{ t('noteAllTags') }}</button>
          <button v-for="item in matchingTags" :key="item" type="button" :aria-pressed="filter === item"
            @click="chooseFilter(item)">{{ item }}</button>
          <p v-if="query && !matchingTags.length" role="status">{{ t('noTagsFound') }}</p>
        </div>
      </div>
      <p v-if="loaded && !entries.length" class="narrow-list-empty">{{ t(filter ? 'noteNoMatches' : 'noteEmpty') }}</p>
      <ul class="note-list">
        <li v-for="entry in entries" :key="entry.id">
          <button type="button" :aria-current="selected === entry.id || undefined" @click="select(entry.id)">
            <strong>{{ noteName(entry, t('noteUntitled')) }}</strong>
            <span v-if="entry.tags.length" class="note-list-tags">{{ entry.tags.join(' · ') }}</span>
            <span v-if="entry.problem" class="bookmark-error note-list-tags">{{ t('noteSaveFailed') }}</span>
            <span v-else-if="entry.busy || entry.dirty" class="note-list-tags">{{ t('noteSaving') }}</span>
          </button>
        </li>
      </ul>
    </template>
    <p v-if="loaded && !active">{{ t(filter ? 'noteNoMatches' : 'noteEmpty') }}</p>
    <article v-if="active" :key="active.id" class="note-detail" @copy="copyNotePreview($event, rendered, editing ? previewTitle : readTitle)" :class="{ editing, 'preview-only': previewOnly }">
      <header class="note-front">
        <div class="note-front-title">
          <template v-if="editing">
            <input v-if="titleOpen || active.title.trim()" ref="titleInput" class="workbench-note-title" v-model="active.title"
              :aria-label="t('noteTitle')" :placeholder="t('noteTitle')" :readonly="active.replacing" @input="editor.changed(active)">
            <button v-else type="button" class="note-secondary" @click="titleOpen = true; nextTick(() => titleInput?.focus())">{{ t('setNoteTitle') }}</button>
          </template>
          <h2 v-else-if="heading" ref="readTitle">{{ heading }}</h2>
        </div>
        <div class="note-actions">
          <NoteSaveStatus :draft="active" :editor="editor" :language="language" :show-saved="editing" />
          <button v-if="!editing" ref="editButton" type="button" @click="beginEdit">{{ t('editNote') }}</button>
          <template v-else>
            <button type="button" @click="finishEdit">{{ t('doneNote') }}</button>
            <div class="note-more" @keydown.esc="escapePopup">
              <button ref="moreButton" type="button" :aria-expanded="popup === 'more'" @click="togglePopup('more')">{{ t('noteMore') }}</button>
              <div v-if="popup === 'more'" class="note-menu">
                <button ref="deleteButton" type="button" :disabled="active.busy" @click="remove">{{ t('noteDelete') }}</button>
              </div>
            </div>
          </template>
        </div>
        <div v-if="editing || active.tags.length" class="note-tags" :aria-label="t('noteTags')">
          <template v-for="item in active.tags" :key="item">
            <button v-if="editing" type="button" :disabled="active.replacing" :aria-label="t('noteRemoveTag') + ' ' + item"
              @click="removeTag(item)">{{ item }} <span aria-hidden="true">×</span></button>
            <span v-else class="note-tag">{{ item }}</span>
          </template>
          <template v-if="editing">
            <form v-if="addingTag" class="note-tag-form" @submit.prevent="addTag"
              @keydown.esc.stop.prevent="addingTag = false; tag = ''; nextTick(() => tagButton?.focus())">
              <input id="note-tag" ref="tagInput" v-model="tag" type="text" :aria-label="t('noteTag')" :placeholder="t('noteTag')" :disabled="active.replacing">
              <button type="submit" :disabled="active.replacing || !tag.trim() || active.tags.includes(tag)">{{ t('noteAddTag') }}</button>
            </form>
            <button v-else ref="tagButton" type="button" class="note-secondary" :disabled="active.replacing"
              @click="addingTag = true; nextTick(() => tagInput?.focus())">＋ {{ t('noteTags') }}</button>
          </template>
        </div>
      </header>

      <div v-if="editing" class="note-view-switch">
        <button type="button" :aria-pressed="!previewOnly" @click="previewOnly = false">{{ t('editNote') }}</button>
        <button type="button" :aria-pressed="previewOnly" @click="previewOnly = true">{{ t('previewTab') }}</button>
      </div>
      <div class="note-columns">
        <section v-if="editing" class="note-input">
          <label for="note-body">{{ t('noteBody') }}</label>
          <NoteBody ref="textarea" input-id="note-body" :label="t('noteBody')" :readonly="active.replacing"
            :model-value="active.body" @update:model-value="active.body = $event; editor.changed(active)" />
          <p id="note-body-help" class="note-help">{{ t('noteMarkdown') }}</p>
        </section>
        <section class="note-preview">
          <h2 v-if="editing">{{ t('notePreview') }}</h2>
          <p v-if="visiting" role="status">{{ t('loading') }}</p>
          <p v-if="visitProblem" ref="visitMessage" class="notice note-visit-problem" role="alert" tabindex="-1">{{ visitProblem }}</p>
          <h2 v-if="editing && heading" ref="previewTitle" class="note-preview-title">{{ heading }}</h2>
          <div ref="rendered" class="markdown" v-html="preview.html" @click="follow"></div>
        </section>
      </div>
    </article>
  </RecordWorkbench>
</template>
