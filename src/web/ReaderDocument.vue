<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { ReadingDocument } from '../application/document-blocks.js';
import type { ReaderProblem } from '../application/file-reader.js';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import type { BlockQuote } from '../core/notes.js';
import type { MarkEdit, ReaderMark } from '../core/understanding-marks.js';
import { useReadingSelection } from './reading-selection.js';
import BlockMarginRecords from './BlockMarginRecords.vue';
import BlockLocationControl from './BlockLocationControl.vue';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLabel, renderMarkdown } from './markdown.js';
import { highlightSource } from './source-highlight.js';

const props = defineProps<{
  result?: ReadingDocument; error?: ReaderProblem; language: Language; active: boolean;
  bookmarks: readonly Bookmark[]; activeBookmark: string; bookmarksBusy: boolean;
  saveBookmark: (action: BookmarkAction) => Promise<void>;
  marks: readonly ReaderMark[]; marksBusy: boolean; markListError: ReaderProblem | undefined;
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
const { selected, anchor, clearSelection } = useReadingSelection(blockRoot, () => props.active, () => props.result);
const quote = computed(() => {
  const blockId = selected.value?.element.closest('.document-block')?.id;
  if (blockId && selected.value && props.result) return { documentPath: props.result.documentPath, blockId, text: selected.value.text };
});
const stickyBlocks = shallowRef(new Set<string>());
const sourcePath = computed(() => props.result?.sourcePath ?? '');
const highlightedSource = shallowRef<Awaited<ReturnType<typeof highlightSource>>>();
watch(() => props.result, async (result, _, onCleanup) => {
  highlightedSource.value = undefined;
  if (result?.renderMode === 'comparison' && result.sourcePath && result.sourceLines) {
    let current = true;
    onCleanup(() => {
      current = false;
      document.removeEventListener('selectionchange', applyHighlighting);
    });
    const highlighted = await highlightSource(result.sourcePath, result.sourceLines);
    if (!current || !highlighted) return;

    function applyHighlighting() {
      // Keep the text nodes while the reader has an active native source selection.
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        const source = blockRoot.value?.querySelectorAll('.source-scroll code') ?? [];
        if (Array.from(source).some(code => range.intersectsNode(code))) return;
      }
      document.removeEventListener('selectionchange', applyHighlighting);
      highlightedSource.value = highlighted;
    }

    document.addEventListener('selectionchange', applyHighlighting);
    applyHighlighting();
  }
}, { immediate: true });
const sourceNameIndex = computed(() => sourcePath.value.lastIndexOf('/') + 1);
const selectionLocation = computed(() => quote.value ? blockLocation(quote.value.blockId, quote.value.text) : '');
let readingPane: HTMLElement | null | undefined;
let sourceObserver: ResizeObserver | undefined;
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

});
onUnmounted(() => {
  sourceObserver?.disconnect();

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
            <pre><code><span v-for="(line, index) in result.sourceLines?.slice(block.lines.start - 1, block.lines.end)"
              :key="index" class="source-line"><span class="line-number" aria-hidden="true">{{ block.lines.start + index }}</span><span
              v-if="highlightedSource"><template v-for="(part, partIndex) in highlightedSource[block.lines.start - 1 + index]"
              :key="partIndex"><span v-if="part.className" :class="part.className">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></span><span v-else>{{ line }}</span>{{ '\n' }}</span></code></pre>
          </div>
        </div>
        <div class="explanation-pane">
          <BlockLocationControl v-if="result.commit" :key="active + ':' + block.id"
            :location="blockLocation(block.id)" :language="language" />
          <p v-if="!block.body.trim()" class="notice">{{ t('unfilled') }}</p>
          <div class="markdown explanation-text" data-quote-field="body" v-html="renderMarkdown(block.body)"></div>
          <BlockLocationControl v-if="anchor && selectionLocation && quote?.blockId === block.id"
            :location="selectionLocation" :language="language" :anchor="anchor" @add-to-notes="addSelection" />
        </div>
        <BlockMarginRecords :document-path="result.documentPath" :block-id="block.id" :label="blockLabel(block.body) || block.id"
          :kind="openRecord?.id === block.id ? openRecord.kind : undefined" :language="language"
          :bookmarks="bookmarks.filter(entry => entry.documentPath === result?.documentPath && entry.blockId === block.id)"
          :active-bookmark="activeBookmark" :bookmarks-busy="bookmarksBusy" :save-bookmark="saveBookmark"
          :mark="blockMarks.get(block.id)" :marks-busy="marksBusy"
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
