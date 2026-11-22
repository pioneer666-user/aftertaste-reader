<script setup lang="ts">
import { computed, nextTick, ref, shallowReactive, watch } from 'vue';
import type { ReadingDocument } from '../application/document-blocks.js';
import type { ReaderProblem } from '../application/file-reader.js';
import type { Bookmark } from '../core/bookmarks.js';
import { markKey } from '../core/understanding-marks.js';
import type { UnderstandingMark } from '../core/understanding-marks.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLabel, blockPreview } from './markdown.js';
import { failed, requestDocument } from './reader-api.js';
import RecordIcon from './RecordIcon.vue';
import RecordWorkbench from './RecordWorkbench.vue';

type BlockRecord = Bookmark | UnderstandingMark;
type PreviewDocument = Pick<ReadingDocument, 'blocks' | 'renderMode' | 'structureValid' | 'sourceError' | 'diagnostics'>;
const props = defineProps<{
  page: 'bookmarks' | 'marks';
  records: readonly BlockRecord[];
  language: Language;
  busy: boolean;
  visible: boolean;
  listOpen: boolean;
  error?: ReaderProblem;
  visit: (record: BlockRecord) => Promise<string | undefined>;
  refresh: () => Promise<void> | undefined;
}>();
const filter = defineModel<'all' | 'not-understood'>('filter', { default: 'all' });
const currentItem = defineModel<string>('currentItem', { required: true });
const emit = defineEmits<{ select: []; filterChange: [] }>();
const t = (key: string) => translate(props.language, key);
const refreshLabel = computed(() => t(props.page === 'marks' ? 'markRefresh' : 'bookmarkRefresh'));
const recordId = (record: BlockRecord) => 'id' in record ? record.id : markKey(record);
const recordText = (record: BlockRecord) => 'note' in record ? record.note : record.annotation;
const symbols = { unmarked: '○', understood: '✓', 'not-understood': '?' };
const statusLabel = (mark: UnderstandingMark) => symbols[mark.status] + ' ' + t(mark.status);
const entries = computed(() => props.records.filter(record => filter.value === 'all' || ('status' in record && record.status === filter.value)));
const active = computed(() => entries.value.find(record => recordId(record) === currentItem.value));
const count = computed(() => t(entries.value.length === 1 ? 'recordCountOne' : 'recordCount').replace('{count}', String(entries.value.length)));
const empty = computed(() => t(props.page === 'bookmarks' ? 'bookmarkEmpty' : filter.value === 'all' ? 'markEmpty' : 'markNoDifficult'));
const emptyText = computed(() => t(props.page === 'bookmarks' ? 'bookmarkNoNote' : 'annotationEmpty'));

watch([entries, currentItem], () => {
  if (!active.value) currentItem.value = entries.value.length ? recordId(entries.value[0]!) : '';
}, { immediate: true });

const documents = shallowReactive(new Map<string, PreviewDocument | ReaderProblem>());
const pending = new Map<string, Promise<void>>();
const rows = ref<HTMLElement[]>([]);
const listRevision = ref(0);

function load(path: string, fresh = false) {
  if (!path || pending.has(path) || (!fresh && documents.has(path))) return;
  const reading = requestDocument(path).then(({ result }) => {
    if (pending.get(path) !== reading) return;
    const { blocks, renderMode, structureValid, sourceError, diagnostics } = result;
    documents.set(path, { blocks, renderMode, structureValid, diagnostics, ...(sourceError ? { sourceError } : {}) });
  }, error => {
    if (pending.get(path) === reading) documents.set(path, failed(error));
  }).finally(() => {
    if (pending.get(path) === reading) pending.delete(path);
  });
  pending.set(path, reading);
}

watch([() => props.visible, () => active.value?.documentPath], ([visible, path]) => {
  if (visible && path) load(path, true);
});
watch([() => [...rows.value], () => props.visible, () => props.listOpen, listRevision], ([elements, visible, open], _, cleanup) => {
  if (!visible || !open) return;
  const observer = new IntersectionObserver(items => {
    for (const item of items) {
      if (!item.isIntersecting) continue;
      observer.unobserve(item.target);
      const path = (item.target as HTMLElement).dataset.recordPath;
      if (path) load(path);
    }
  });
  for (const element of elements) observer.observe(element);
  cleanup(() => observer.disconnect());
}, { flush: 'post' });

async function refresh() {
  await props.refresh();
  pending.clear();
  documents.clear();
  if (active.value) load(active.value.documentPath);
  listRevision.value++;
}

function usable(document: PreviewDocument) {
  return document.renderMode === 'comparison' || (document.structureValid && !!document.sourceError);
}

function findBlock(record: BlockRecord) {
  const document = documents.get(record.documentPath);
  return document && 'blocks' in document && usable(document)
    ? document.blocks.find(block => block.id === record.blockId) : undefined;
}

function sourcePath(documentPath: string) {
  return documentPath.replace(/^docs\/aftertaste\/current\/(.+)\.md$/u, '$1');
}
const names = computed(() => {
  const names = new Map<string, Set<string>>();
  for (const record of props.records) {
    const file = sourcePath(record.documentPath);
    const name = file.split('/').at(-1)!;
    const paths = names.get(name) ?? new Set<string>();
    paths.add(file);
    names.set(name, paths);
  }
  return names;
});
function location(record: BlockRecord, short: boolean) {
  const file = sourcePath(record.documentPath);
  const name = file.split('/').at(-1)!;
  const block = findBlock(record);
  const range = block?.lines;
  const target = range ? t('recordLines').replace('{range}', range.start === range.end ? String(range.start) : `${range.start}–${range.end}`)
    : `${t(block ? 'recordExplanationBlock' : 'block')} ${record.blockId}`;
  return `${short && names.value.get(name)?.size === 1 ? name : file} · ${target}`;
}

function rowText(record: BlockRecord) {
  const text = recordText(record);
  if (text) return text;
  const block = findBlock(record);
  return block ? blockLabel(block.body) : '';
}

const titleAndExcerpt = computed(() => {
  const block = active.value && findBlock(active.value);
  return block ? blockPreview(block.body) : undefined;
});
const title = computed(() => titleAndExcerpt.value?.title || `${t('block')} ${active.value?.blockId ?? ''}`);
const previewProblem = computed(() => {
  if (!active.value) return '';
  const document = documents.get(active.value.documentPath);
  if (!document) return '';
  if ('code' in document) {
    if (document.code === 'DOCUMENT_READ_FAILED' && document.context.reason === 'ENOENT') return t('noteDocumentMissing');
    return problemText(props.language, document).message;
  }
  if (usable(document)) return findBlock(active.value) ? '' : t('noteBlockMissing');
  const diagnostic = document.diagnostics.find(item => item.severity === 'error');
  return [t('noteDocumentInvalid'), diagnostic && problemText(props.language, diagnostic).message].filter(Boolean).join(' ');
});

const visitProblem = ref('');
const visitError = ref<HTMLElement>();
const visiting = ref(false);
let visitSequence = 0;
watch(() => props.visible, clearVisit);
function clearVisit() {
  visitSequence++;
  visiting.value = false;
  visitProblem.value = '';
}
function select(record: BlockRecord) {
  clearVisit();
  if (currentItem.value === recordId(record)) load(record.documentPath, true);
  currentItem.value = recordId(record);
  emit('select');
}
function setFilter(next: typeof filter.value) {
  if (next === filter.value) return;
  if (visiting.value) emit('filterChange');
  clearVisit();
  filter.value = next;
}
async function visit(record: BlockRecord) {
  const sequence = ++visitSequence;
  currentItem.value = recordId(record);
  visiting.value = true;
  visitProblem.value = '';
  const problem = await props.visit(record);
  if (sequence !== visitSequence) return;
  visiting.value = false;
  if (!problem || !props.visible || currentItem.value !== recordId(record)) return;
  load(record.documentPath, true);
  visitProblem.value = problem;
  if (props.listOpen && matchMedia('(max-width: 850px)').matches) emit('select');
  await nextTick();
  if (sequence !== visitSequence) return;
  visitError.value?.focus({ preventScroll: true });
  visitError.value?.scrollIntoView({ block: 'nearest' });
}
</script>

<template>
  <RecordWorkbench :page="page" :heading="t(page)" :list-id="page === 'marks' ? 'mark-navigation' : 'bookmark-navigation'"
    :list-open="listOpen" :count="count">
    <template #action>
      <button type="button" class="record-refresh" :aria-label="refreshLabel" :title="refreshLabel" :disabled="busy" @click="refresh">
        <RecordIcon name="refresh" />
      </button>
    </template>
    <template #status>
      <p v-if="busy || visiting" role="status">{{ t('loading') }}</p>
      <p v-if="error" role="alert">{{ problemText(language, error).message }} {{ problemText(language, error).nextStep }}</p>
    </template>
    <template #list>
      <div v-if="page === 'marks'" class="record-segments" role="group" :aria-label="t('markFilter')">
        <button type="button" :aria-pressed="filter === 'all'" @click="setFilter('all')">{{ t('markAll') }}</button>
        <button type="button" :aria-pressed="filter === 'not-understood'" @click="setFilter('not-understood')">{{ t('not-understood') }}</button>
      </div>
      <ul v-if="entries.length" class="project-bookmarks">
        <li v-for="record in entries" :key="recordId(record)" ref="rows" :data-record-path="record.documentPath">
          <button type="button" class="bookmark-entry" :aria-current="currentItem === recordId(record) || undefined" @click="select(record)">
            <span class="bookmark-note">
              <strong v-if="'status' in record" class="record-mark" :data-status="record.status"><span class="state-symbol">{{ statusLabel(record) }}</span></strong>
              <span>{{ rowText(record) }}</span>
            </span>
            <small class="record-list-location">{{ location(record, true) }}</small>
          </button>
          <button type="button" class="record-visit" :aria-label="t('recordVisit')" :data-tooltip="t('recordVisit')" @click="visit(record)">
            <RecordIcon name="visit" />
          </button>
        </li>
      </ul>
      <p v-else-if="!busy && !error" class="narrow-list-empty">{{ empty }}</p>
    </template>

    <article v-if="active" class="record-article">
      <h2 v-if="'status' in active" class="record-label record-mark" :data-status="active.status"><span class="state-symbol">{{ statusLabel(active) }}</span></h2>
      <h2 v-else class="record-label record-icon-label"><RecordIcon name="bookmark" />{{ t('bookmarkReason') }}</h2>
      <p class="record-prose">{{ recordText(active) || title }}</p>
      <p v-if="!recordText(active)" class="record-location record-no-text">{{ emptyText }}</p>
      <section v-if="!previewProblem" class="record-context" :aria-label="t('currentExplanation')">
        <p class="record-location record-icon-label"><RecordIcon name="explanation" />{{ t('currentExplanation') }}</p>
        <p v-if="!titleAndExcerpt" role="status">{{ t('loading') }}</p>
        <template v-else>
          <h3 v-if="recordText(active) && titleAndExcerpt.title">{{ titleAndExcerpt.title }}</h3>
          <p v-if="titleAndExcerpt.excerpt" class="record-excerpt">{{ titleAndExcerpt.excerpt }}</p>
        </template>
        <div class="record-context-footer">
          <span class="record-location">{{ location(active, false) }}</span>
          <button type="button" class="record-visit-text" @click="visit(active)">{{ t('recordVisit') }} <RecordIcon name="visit" /></button>
        </div>
      </section>
      <div v-if="previewProblem || visitProblem" class="record-context record-unavailable">
        <div ref="visitError" role="status" tabindex="-1">
          <strong>{{ t('recordUnavailable') }}</strong>
          <p>{{ previewProblem || visitProblem }}</p>
        </div>
        <button type="button" @click="visitProblem ? visit(active) : load(active.documentPath, true)">{{ t('retry') }}</button>
        <button v-if="previewProblem" type="button" class="record-visit-text" @click="visit(active)">{{ t('recordVisit') }} <RecordIcon name="visit" /></button>
      </div>
      <details :key="recordId(active)" class="record-full-location">
        <summary>{{ t('recordFullLocation') }}</summary>
        <p><code>{{ active.documentPath }}</code></p>
        <p>{{ t('block') }} <code>{{ active.blockId }}</code></p>
      </details>
    </article>
    <template v-else-if="!busy && !error">
      <p>{{ empty }}</p>
      <button v-if="filter !== 'all'" type="button" @click="setFilter('all')">{{ t('clearFilter') }}</button>
    </template>
  </RecordWorkbench>
</template>
