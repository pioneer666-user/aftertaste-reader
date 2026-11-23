<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch, watchPostEffect } from 'vue';
import type { ReadingLoop } from '../application/loops.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import BlockLocationControl from './BlockLocationControl.vue';
import { useReadingSelection } from './reading-selection.js';
import type { NoteQuote } from '../core/notes.js';
import { renderMarkdown } from './markdown.js';

const props = withDefaults(defineProps<{ reading: ReadingLoop; language: Language; selected: string; legendSelected?: boolean; panelOpen: boolean; active?: boolean }>(), {
  legendSelected: false,
  active: true,
});
const emit = defineEmits<{ select: [id: string]; addToNotes: [quote: NoteQuote] }>();
const t = (key: string) => translate(props.language, key);
const loop = computed(() => props.reading.loop);
const nodes = computed(() => new Map(loop.value.nodes.map(node => [node.id, node])));
const step = computed(() => nodes.value.get(props.selected));
const source = computed(() => props.reading.sources.find(item => item.node_id === props.selected));
const incoming = computed(() => loop.value.edges.filter(edge => edge.to === props.selected));
const choices = computed(() => loop.value.edges.filter(edge => edge.from === props.selected));
const stepRoot = ref<HTMLElement>();
const { selected: excerpt, anchor, clearSelection } = useReadingSelection(stepRoot,
  () => props.active && props.panelOpen, () => step.value);
function stepLocation(withSelection = false) {
  const fields = { format: 'aftertaste-loop-step/v1', loop_id: loop.value.id, step_id: step.value?.id,
    source_commit: loop.value.source_commit, ...(withSelection && excerpt.value && {
      field: excerpt.value.element.dataset.quoteField, selection: excerpt.value.text,
    }) };
  return 'Aftertaste 闭环步骤定位\n```json\n' + JSON.stringify(fields, null, 2) + '\n```';
}
function addSelection() {
  if (!step.value || !excerpt.value) return;
  emit('addToNotes', { loopId: loop.value.id, stepId: step.value.id, text: excerpt.value.text });
  window.getSelection()?.removeAllRanges();
  clearSelection();
}
const stepHeading = ref<HTMLElement>();
const sourceTrigger = ref<HTMLButtonElement>();
const sourcePanel = ref<HTMLElement>();
const sourceCode = ref<HTMLElement>();
const previewOpen = ref(false);
const pinned = ref(false);
const inlineSource = ref(false);
const sourceVisible = computed(() => !!step.value?.lines && (previewOpen.value || pinned.value));
const sourceId = computed(() => 'loop-source-' + loop.value.id);
const sourceKey = computed(() => step.value?.lines ? `${step.value.path}:${step.value.lines.start}-${step.value.lines.end}` : '');
let closeTimer: number | undefined;
let skipFocusPreview = false;

function selectStep(id: string) {
  emit('select', id);
}

function schedulePreviewClose() {
  window.clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => {
    if (!pinned.value && !sourceTrigger.value?.matches(':hover, :focus-visible') && !sourcePanel.value?.matches(':hover, :focus-within')) {
      previewOpen.value = false;
    }
  }, 140);
}

function openPreview() {
  window.clearTimeout(closeTimer);
  if (step.value?.lines) previewOpen.value = true;
}

function focusPreview() {
  if (skipFocusPreview) {
    skipFocusPreview = false;
    return;
  }
  openPreview();
}

function toggleSource() {
  window.clearTimeout(closeTimer);
  if (pinned.value) {
    pinned.value = false;
    previewOpen.value = false;
  } else {
    pinned.value = true;
    previewOpen.value = true;
  }
}

function closeSource(restoreFocus = false) {
  window.clearTimeout(closeTimer);
  skipFocusPreview = restoreFocus;
  pinned.value = false;
  previewOpen.value = false;
  if (restoreFocus) nextTick(() => sourceTrigger.value?.focus({ preventScroll: true }));
}

function sourceKeys(event: KeyboardEvent) {
  if (event.key === 'Escape' && sourceVisible.value) {
    event.preventDefault();
    event.stopPropagation();
    closeSource(true);
  }
}

watch(() => props.selected, async () => {
  previewOpen.value = false;
  if (!step.value?.lines) pinned.value = false;
  await nextTick();
  const heading = stepHeading.value;
  const inspector = heading?.closest('.canvas-inspector');
  if (!heading || !inspector) return;
  inspector.scrollTop = 0;
  if (props.panelOpen) heading.focus({ preventScroll: true });
});
watch(() => props.panelOpen, open => {
  if (!open) previewOpen.value = false;
});
watch(() => props.active, active => { if (!active) closeSource(); }, { flush: 'sync' });
watch(sourceKey, async (current, previous) => {
  if (current === previous) return;
  await nextTick();
  if (sourceCode.value) {
    sourceCode.value.scrollLeft = 0;
    sourceCode.value.scrollTop = 0;
  }
});
watchPostEffect(onCleanup => {
  if (!sourceVisible.value || !props.panelOpen) return;
  const place = () => {
    const trigger = sourceTrigger.value;
    const inspector = trigger?.closest('.canvas-inspector');
    if (!trigger || !inspector) return;
    const anchor = inspector.getBoundingClientRect();
    const desiredWidth = Math.min(520, Math.max(320, window.innerWidth * .38));
    inlineSource.value = window.innerWidth <= 760 || anchor.left < desiredWidth + 16;
    const panel = sourcePanel.value;
    if (!panel) return;
    if (inlineSource.value) {
      for (const property of ['width', 'left', 'top', 'max-height']) panel.style.removeProperty(property);
      return;
    }
    const width = Math.min(desiredWidth, Math.max(0, anchor.left - 16));
    panel.style.width = width + 'px';
    panel.style.left = Math.max(8, anchor.left - width) + 'px';
    const triggerBox = trigger.getBoundingClientRect();
    const height = panel.offsetHeight;
    const preferred = triggerBox.top - 8;
    panel.style.top = Math.max(anchor.top + 8, Math.min(anchor.bottom - height - 8, preferred)) + 'px';
    panel.style.maxHeight = Math.max(120, anchor.height - 16) + 'px';
  };
  void nextTick(place);
  const frame = requestAnimationFrame(place);
  const observer = new ResizeObserver(place);
  if (sourcePanel.value) observer.observe(sourcePanel.value);
  const anchor = sourceTrigger.value?.closest('.canvas-inspector');
  if (anchor) observer.observe(anchor);
  window.addEventListener('resize', place);
  onCleanup(() => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('resize', place);
  });
});
onUnmounted(() => window.clearTimeout(closeTimer));
</script>

<template>
  <div v-if="!step && !legendSelected" class="loop-overview" :inert="!panelOpen">
    <div class="markdown loop-goal" v-html="renderMarkdown(loop.goal)"></div>
    <details>
      <summary>{{ t('loopOverview') }}</summary>
      <div class="markdown" v-html="renderMarkdown(loop.explanation)"></div>
      <p class="canvas-hint">{{ t('commit') }} <code>{{ loop.source_commit }}</code></p>
    </details>
    <details>
      <summary>{{ t('loopOrder') }}</summary>
      <ol class="canvas-relations loop-order">
        <li v-for="id in loop.reading_order" :key="id">
          <button type="button" :aria-current="id === selected ? 'step' : undefined" @click="selectStep(id)">
            {{ nodes.get(id)?.title }}
          </button>
        </li>
      </ol>
    </details>
  </div>

  <section v-if="step" ref="stepRoot" class="loop-step canvas-selection" :inert="!panelOpen" :data-reading-step="step.id" :aria-label="t('loopSelected')">
    <BlockLocationControl v-if="active && panelOpen" :key="step.id" step :location="stepLocation()" :language="language" />
    <BlockLocationControl v-if="anchor && excerpt" step :anchor="anchor" :location="stepLocation(true)" :language="language" @add-to-notes="addSelection" />
    <h2 ref="stepHeading" class="loop-step-heading" tabindex="-1" aria-live="polite">{{ step.title }}</h2>
    <div class="loop-step-reading">
      <div data-quote-field="explanation" class="markdown loop-step-explanation" v-html="renderMarkdown(step.explanation)"></div>
      <template v-if="step.hint">
        <h3>{{ t('loopHint') }}</h3>
        <div data-quote-field="hint" class="markdown loop-step-hint" v-html="renderMarkdown(step.hint)"></div>
      </template>
    </div>
    <button v-if="step.lines" ref="sourceTrigger" type="button" class="loop-source-trigger"
      :aria-expanded="sourceVisible" :aria-controls="sourceId" :aria-pressed="pinned"
      @mouseenter="openPreview" @mouseleave="schedulePreviewClose" @focus="focusPreview" @blur="schedulePreviewClose"
      @click="toggleSource" @keydown="sourceKeys">
      <span>{{ t('loopCompareSource') }}</span> · <code>{{ step.path }}</code> · <span>{{ step.lines.start }}–{{ step.lines.end }} {{ t('loopSourceLines') }}</span>
    </button>
    <Teleport to="#loop-workspace" :disabled="inlineSource">
      <section v-if="sourceVisible && step.lines" :id="sourceId" ref="sourcePanel" class="loop-source-panel"
        :class="[inlineSource ? 'loop-source-inline' : 'loop-source-floating', { 'source-stowed': !panelOpen }]" :inert="!panelOpen" :aria-label="t('loopCompareSource')"
        @mouseenter="openPreview" @mouseleave="schedulePreviewClose" @focusin="openPreview" @focusout="schedulePreviewClose" @keydown="sourceKeys">
        <header class="loop-source-header">
          <div><strong>{{ step.path }}</strong><p>{{ step.lines.start }}–{{ step.lines.end }} {{ t('loopSourceLines') }}</p></div>
          <button type="button" :aria-label="t('loopCloseSource')" :title="t('loopCloseSource')" @click="closeSource(true)">×</button>
        </header>
        <p class="canvas-hint">{{ t('commit') }} <code>{{ loop.source_commit }}</code></p>
        <div v-if="source?.status === 'available'" ref="sourceCode" class="source-scroll source-pane" tabindex="0" role="region" :aria-label="t('sourceScroll')">
          <pre><code><span v-for="(line, index) in source.lines" :key="index" class="source-line"><span class="line-number" aria-hidden="true">{{ step.lines.start + index }}</span><span>{{ line }}</span>{{ '\n' }}</span></code></pre>
        </div>
        <div v-else-if="source?.status === 'unavailable'" role="alert" class="canvas-problem">
          <strong>{{ t('unavailable') }}</strong>
          <p>{{ problemText(language, source.error).message }} {{ problemText(language, source.error).nextStep }}</p>
          <code>{{ source.error.code }} · {{ source.error.context.repositoryRoot }}</code>
        </div>
      </section>
    </Teleport>
    <h3 v-if="choices.length > 1">{{ t('loopConnections') }}</h3>
    <ul v-if="choices.length" class="canvas-relations loop-connections" :class="{ 'loop-single-exit': choices.length === 1 }">
      <li v-for="edge in choices" :key="edge.to">
        <button type="button" :data-choice="edge.to" @click="selectStep(edge.to)">
          <span class="markdown loop-choice-reason" v-html="renderMarkdown(edge.reason)"></span>
          <strong><span aria-hidden="true">→ </span>{{ nodes.get(edge.to)?.title }}</strong>
        </button>
      </li>
    </ul>
    <p v-else class="canvas-hint loop-end">{{ t('loopEnd') }}</p>
    <section v-if="incoming.length" class="loop-incoming">
      <h3>{{ t('loopFrom') }}</h3>
      <ul class="canvas-relations loop-connections">
        <li v-for="edge in incoming" :key="edge.from">
          <button type="button" :data-incoming="edge.from" @click="selectStep(edge.from)">
            <strong>{{ nodes.get(edge.from)?.title }}</strong>
            <span class="markdown loop-choice-reason" v-html="renderMarkdown(edge.reason)"></span>
          </button>
        </li>
      </ul>
    </section>
    <details :key="step.id" class="loop-original">
      <summary>{{ t('loopOriginal') }}</summary>
      <div class="markdown" v-html="renderMarkdown(step.block_explanation)"></div>
    </details>
  </section>
</template>
