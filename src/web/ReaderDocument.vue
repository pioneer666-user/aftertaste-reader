<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { ReadingDocument } from '../application/document-blocks.js';
import type { ReaderProblem } from '../application/file-reader.js';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import type { BlockQuote } from '../core/notes.js';
import type { MarkEdit, ReaderMark } from '../core/understanding-marks.js';
import BlockMarginRecords from './BlockMarginRecords.vue';
import BlockLocationControl from './BlockLocationControl.vue';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLabel, renderMarkdown } from './markdown.js';

const props = defineProps<{
  result?: ReadingDocument; error?: ReaderProblem; language: Language; active: boolean;
  bookmarks: readonly Bookmark[]; activeBookmark: string; bookmarksBusy: boolean;
  saveBookmark: (action: BookmarkAction) => Promise<void>;
  marks: readonly ReaderMark[]; activeMark: string; marksBusy: boolean; markListError: ReaderProblem | undefined;
  saveMark: (edit: MarkEdit) => Promise<void>;
}>();
const emit = defineEmits<{ addToNotes: [quote: BlockQuote]; refreshMarks: [] }>();
const t = (key: string) => translate(props.language, key);
type RecordKind = 'bookmarks' | 'mark';
const openRecord = ref<{ id: string; kind: RecordKind }>();
function showRecord(id: string, kind: RecordKind) {
  openRecord.value = { id, kind };
}
defineExpose({ showRecord });
const copyStatus = ref('');
const blockRoot = ref<HTMLElement>();
const quote = ref<BlockQuote>();
const anchor = shallowRef<{ x: number; y: number }>();
const stickyBlocks = shallowRef(new Set<string>());
const sourcePath = computed(() => props.result?.sourcePath ?? '');
const sourceNameIndex = computed(() => sourcePath.value.lastIndexOf('/') + 1);
const selectionLocation = computed(() => quote.value ? blockLocation(quote.value.blockId, quote.value.text) : '');
let readingPane: HTMLElement | null | undefined;
let sourceObserver: ResizeObserver | undefined;
let selecting = false;
const blockMarks = computed(() => new Map(props.marks.filter(mark => mark.documentPath === props.result?.documentPath)
  .map(mark => [mark.blockId, mark])));
const diagnostics = computed(() => props.result?.diagnostics ?? []);
const hasProblems = computed(() => Boolean(props.error || diagnostics.value.length || props.result?.sourceError));
const repairText = computed(() => {
  const result = props.result;
  const localize = (problem: { code: string; message: string; nextStep: string; params?: Readonly<Record<string, string | number>> }) =>
    ({ ...problem, ...problemText(props.language, problem) });
  return JSON.stringify({
    document: result?.documentPath ?? props.error?.context.documentPath,
    source_commit: result?.commit ?? null,
    source_path: result?.sourcePath ?? props.error?.context.sourcePath ?? null,
    problems: diagnostics.value.map(localize),
    ...(result?.sourceError ? { source_error: localize(result.sourceError) } : {}),
    ...(props.error ? { error: localize(props.error) } : {}),
  }, null, 2);
});

async function copyRepair() {
  try {
    await navigator.clipboard.writeText(repairText.value);
    copyStatus.value = 'copied';
  } catch { copyStatus.value = 'copyFailed'; }
}

function blockLocation(blockId: string, text?: string) {
  const current = props.result;
  if (current?.renderMode !== 'comparison' || !current.commit) return '';
  const fields = { format: 'aftertaste-block/v1', document: current.documentPath, block_id: blockId,
    source_commit: current.commit, ...(text === undefined ? {} : { selection: text }) };
  return 'Aftertaste 文档块定位\n```json\n' + JSON.stringify(fields, null, 2) + '\n```';
}

function clearSelection() {
  quote.value = undefined;
  anchor.value = undefined;
}

function captureSelection(point?: { x: number; y: number }, reposition = false) {
  if (!props.active || selecting ||
      document.activeElement?.closest('.selection-copy-panel .location-copy-manual')) return;
  const selection = window.getSelection();
  if (selection?.rangeCount !== 1 || selection.isCollapsed || !selection.focusNode || !props.result) {
    clearSelection();
    return;
  }
  const range = selection.getRangeAt(0);
  const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  const explanation = start?.closest('.explanation-text');
  const block = explanation?.closest<HTMLElement>('.document-block');
  const text = selection.toString();
  if (!block || !blockRoot.value?.contains(block) || !explanation?.contains(range.endContainer) || !text.trim()) {
    clearSelection();
    return;
  }
  if (!point && !reposition && quote.value?.blockId === block.id && quote.value.text === text) return;
  quote.value = { documentPath: props.result.documentPath, blockId: block.id, text };
  const caret = document.createRange();
  caret.setStart(selection.focusNode, selection.focusOffset);
  caret.collapse(true);
  const edge = caret.getBoundingClientRect();
  const frame = readingPane?.getBoundingClientRect();
  anchor.value = point ?? (frame && edge.bottom >= frame.top && edge.top <= frame.bottom
    ? { x: edge.left, y: edge.bottom } : undefined);
}

function selectionChanged() {
  captureSelection();
}

function selectionStarted(event: PointerEvent) {
  if (event.button !== 0 || !(event.target instanceof Element)) return;
  if (event.target.closest('.selection-copy-panel')) return;
  selecting = !!event.target.closest('.explanation-text') && !!blockRoot.value?.contains(event.target);
  anchor.value = undefined;
}

function selectionFinished(event: PointerEvent) {
  if (!selecting) return;
  selecting = false;
  captureSelection({ x: event.clientX, y: event.clientY });
}

function selectionCanceled() {
  selecting = false;
}

function followSelection() {
  if (anchor.value) captureSelection(undefined, true);
}

function selectionKeys(event: KeyboardEvent) {
  const button = blockRoot.value?.querySelector<HTMLButtonElement>('.selection-copy-action');
  if (!button || event.defaultPrevented) return;
  if (event.key === 'Escape') {
    if (document.activeElement?.closest('.selection-copy-panel')) {
      readingPane?.focus({ preventScroll: true });
    }
    anchor.value = undefined;
  } else if (event.key === 'Tab' && !event.shiftKey && startsInSelection(event.target, button)) {
    event.preventDefault();
    button.focus({ preventScroll: true });
  }
}

function startsInSelection(target: EventTarget | null, button: HTMLButtonElement) {
  if (target === document.body || target === readingPane) return true;
  const block = button.closest('.document-block');
  return target instanceof Element &&
    (target === block || block?.querySelector('.explanation-text')?.contains(target));
}

function addSelection() {
  if (!quote.value) return;
  emit('addToNotes', quote.value);
  window.getSelection()?.removeAllRanges();
  clearSelection();
}

watch(() => props.active, active => { if (!active) { clearSelection(); openRecord.value = undefined; } });
onMounted(() => {
  readingPane = blockRoot.value?.closest<HTMLElement>('.reading-pane');
  const sources = blockRoot.value?.querySelectorAll<HTMLElement>('.source-pane');
  if (readingPane && sources?.length) {
    sourceObserver = new ResizeObserver(() => {
      const height = readingPane!.clientHeight;
      stickyBlocks.value = new Set(Array.from(sources)
        .filter(source => source.offsetHeight + 32 <= height).map(source => source.parentElement!.id));
    });
    sourceObserver.observe(readingPane);
    sources.forEach(source => sourceObserver!.observe(source));
  }
  readingPane?.addEventListener('scroll', followSelection, { passive: true });
  window.addEventListener('resize', followSelection);
  document.addEventListener('selectionchange', selectionChanged);
  document.addEventListener('pointerdown', selectionStarted);
  document.addEventListener('pointerup', selectionFinished);
  document.addEventListener('pointercancel', selectionCanceled);
  document.addEventListener('keydown', selectionKeys);
});
onUnmounted(() => {
  sourceObserver?.disconnect();
  readingPane?.removeEventListener('scroll', followSelection);
  window.removeEventListener('resize', followSelection);
  document.removeEventListener('selectionchange', selectionChanged);
  document.removeEventListener('pointerdown', selectionStarted);
  document.removeEventListener('pointerup', selectionFinished);
  document.removeEventListener('pointercancel', selectionCanceled);
  document.removeEventListener('keydown', selectionKeys);
});
</script>

<template>
  <section v-if="error" class="reading-error" role="alert">
    <h2>{{ t('readError') }}</h2>
    <p>{{ problemText(language, error).message }}</p>
    <p>{{ problemText(language, error).nextStep }}</p>
    <code>{{ error.code }}</code>
  </section>
  <template v-if="result">
    <header class="document-header">
      <h1 :title="sourcePath" :aria-label="sourcePath">
        <span v-if="sourceNameIndex" class="file-directory">{{ sourcePath.slice(0, sourceNameIndex) }}</span><span
          class="file-name">{{ sourcePath.slice(sourceNameIndex) }}</span>
      </h1>
      <p class="document-path">{{ result.documentPath }}</p>
      <p v-if="result.contentStatus === 'unfilled'" class="notice">{{ t('unfilled') }}</p>
      <div v-if="result.renderMode === 'markdown'" class="notice" role="status">
        <p v-if="result.sourceCheck === 'unavailable'">{{ t('unavailable') }}</p>
        <p>{{ t('fallback') }}</p>
        <p>{{ t('fallbackHelp') }} <a href="#reader-diagnostics">{{ t('repair') }}</a></p>
      </div>
    </header>
    <div v-if="result.renderMode === 'comparison' && markListError" class="mark-read-error">
      <p class="bookmark-error" role="alert">
        {{ problemText(language, markListError).message }} {{ problemText(language, markListError).nextStep }}
      </p>
      <button type="button" :disabled="marksBusy" @click="emit('refreshMarks')">{{ t('markRefresh') }}</button>
    </div>
    <div v-if="result.renderMode === 'comparison'" ref="blockRoot" class="document-blocks">
      <section v-for="block in result.blocks" :id="block.id" :key="block.id" tabindex="-1" class="document-block" :class="{ comparison: block.lines }">
        <div v-if="block.lines" class="source-pane" :class="{ 'is-sticky': stickyBlocks.has(block.id) }">
          <h2 class="pane-label">{{ t('source') }} <span>{{ block.lines.start }}–{{ block.lines.end }}</span></h2>
          <div class="source-scroll" tabindex="0" role="region" :aria-label="t('sourceScroll')">
            <pre><code><span v-for="(line, index) in result.sourceLines?.slice(block.lines.start - 1, block.lines.end)" :key="index" class="source-line"><span class="line-number" aria-hidden="true">{{ block.lines.start + index }}</span><span>{{ line }}</span>{{ '\n' }}</span></code></pre>
          </div>
        </div>
        <div class="explanation-pane">
          <BlockLocationControl v-if="result.commit" :key="active + ':' + block.id"
            :location="blockLocation(block.id)" :language="language" />
          <p v-if="!block.body.trim()" class="notice">{{ t('unfilled') }}</p>
          <div class="markdown explanation-text" v-html="renderMarkdown(block.body)"></div>
          <BlockLocationControl v-if="anchor && selectionLocation && quote?.blockId === block.id"
            :location="selectionLocation" :language="language" :anchor="anchor" @add-to-notes="addSelection" />
        </div>
        <BlockMarginRecords :document-path="result.documentPath" :block-id="block.id" :label="blockLabel(block.body) || block.id"
          :kind="openRecord?.id === block.id ? openRecord.kind : undefined" :language="language"
          :bookmarks="bookmarks.filter(entry => entry.documentPath === result?.documentPath && entry.blockId === block.id)"
          :active-bookmark="activeBookmark" :bookmarks-busy="bookmarksBusy" :save-bookmark="saveBookmark"
          :mark="blockMarks.get(block.id)" :active-mark="activeMark === block.id" :marks-busy="marksBusy"
          :unavailable="!!markListError" :save-mark="saveMark" @open="showRecord(block.id, $event)" @close="openRecord = undefined" />
      </section>
    </div>
    <article v-else class="markdown fallback-markdown" v-html="renderMarkdown(result.raw)"></article>
  </template>
  <section v-if="hasProblems" id="reader-diagnostics" class="diagnostics" :aria-label="t('issues')">
    <h2>{{ t('issues') }}</h2>
    <ul class="problem-list">
      <li v-for="(problem, index) in diagnostics" :key="index">
        <p><strong>{{ t(problem.severity) }}</strong> · <code>{{ problem.code }}</code></p>
        <p>{{ problemText(language, problem).message }}</p>
        <p class="problem-location">
          <span v-if="problem.line">{{ t('line') }} {{ problem.line }}</span>
          <span v-if="problem.blockId">{{ t('block') }} <code>{{ problem.blockId }}</code></span>
        </p>
        <p>{{ t('next') }} · {{ problemText(language, problem).nextStep }}</p>
      </li>
      <li v-if="result?.sourceError">
        <code>{{ result.sourceError.code }}</code>
        <p>{{ problemText(language, result.sourceError).message }}</p>
        <p>{{ problemText(language, result.sourceError).nextStep }}</p>
      </li>
    </ul>
    <div class="repair-heading"><h3>{{ t('repair') }}</h3><button type="button" @click="copyRepair">{{ t('copy') }}</button></div>
    <p role="status">{{ copyStatus ? t(copyStatus) : '' }}</p>
    <textarea class="repair-text" readonly :aria-label="t('manual')" :value="repairText" rows="10"></textarea>
  </section>
</template>
