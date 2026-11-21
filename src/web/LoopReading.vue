<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch, watchPostEffect } from 'vue';
import type { ReadingLoop } from '../application/loops.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { renderMarkdown } from './markdown.js';

const props = withDefaults(defineProps<{ reading: ReadingLoop; language: Language; selected: string; legendSelected?: boolean; active?: boolean }>(), {
  legendSelected: false,
  active: true,
});
const emit = defineEmits<{ select: [id: string] }>();
const t = (key: string) => translate(props.language, key);
const loop = computed(() => props.reading.loop);
const nodes = computed(() => new Map(loop.value.nodes.map(node => [node.id, node])));
const step = computed(() => nodes.value.get(props.selected));
const source = computed(() => props.reading.sources.find(item => item.node_id === props.selected));
const choices = computed(() => loop.value.edges.filter(edge => edge.from === props.selected));
const stepIndex = computed(() => loop.value.reading_order.indexOf(props.selected));
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
  heading.focus({ preventScroll: true });
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
  if (!sourceVisible.value) return;
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
    panel.style.top = Math.max(8, Math.min(window.innerHeight - height - 8, preferred)) + 'px';
    panel.style.maxHeight = Math.max(120, window.innerHeight - 16) + 'px';
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
  <div v-if="!step && !legendSelected" class="loop-overview">
    <div class="markdown loop-goal" v-html="renderMarkdown(loop.goal)"></div>
    <button type="button" class="loop-entry" @click="selectStep(loop.entry)">
      {{ t('loopEntry') }} · {{ nodes.get(loop.entry)?.title }}
    </button>
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

  <section v-if="step" class="loop-step canvas-selection" :data-reading-step="step.id" :aria-label="t('loopSelected')">
    <h2 ref="stepHeading" class="loop-step-heading" tabindex="-1" aria-live="polite">{{ step.title }}</h2>
    <button v-if="step.lines" ref="sourceTrigger" type="button" class="loop-source-trigger"
      :aria-expanded="sourceVisible" :aria-controls="sourceId" :aria-pressed="pinned"
      @mouseenter="openPreview" @mouseleave="schedulePreviewClose" @focus="focusPreview" @blur="schedulePreviewClose"
      @click="toggleSource" @keydown="sourceKeys">
      <span>{{ t('loopCompareSource') }}</span><code>{{ step.path }}</code><span>{{ step.lines.start }}–{{ step.lines.end }} {{ t('loopSourceLines') }}</span>
    </button>
    <Teleport to="body" :disabled="inlineSource">
      <section v-if="sourceVisible && step.lines" :id="sourceId" ref="sourcePanel" class="loop-source-panel"
        :class="inlineSource ? 'loop-source-inline' : 'loop-source-floating'" :aria-label="t('loopCompareSource')"
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
    <div :key="step.id" class="loop-step-reading">
      <div class="markdown loop-step-explanation" v-html="renderMarkdown(step.explanation)"></div>
      <template v-if="step.hint">
        <h3>{{ t('loopHint') }}</h3>
        <div class="markdown loop-step-hint" v-html="renderMarkdown(step.hint)"></div>
      </template>
      <details class="loop-original">
        <summary>{{ t('loopOriginal') }}</summary>
        <div class="markdown" v-html="renderMarkdown(step.block_explanation)"></div>
      </details>
    </div>
    <h3>{{ t('loopConnections') }}</h3>
    <ul v-if="choices.length" class="canvas-relations loop-connections">
      <li v-for="edge in choices" :key="edge.to">
        <button type="button" :data-choice="edge.to" @click="selectStep(edge.to)">
          <strong>{{ nodes.get(edge.to)?.title }}</strong>
          <span class="markdown loop-choice-reason" v-html="renderMarkdown(edge.reason)"></span>
        </button>
      </li>
    </ul>
    <p v-else class="canvas-hint loop-end">{{ t('loopEnd') }}</p>
    <nav class="loop-step-controls" :aria-label="t('loopOrder')">
      <button type="button" data-step-nav="previous" :disabled="stepIndex <= 0"
        @click="selectStep(loop.reading_order[stepIndex - 1]!)">
        {{ t('loopPrevious') }}<template v-if="stepIndex > 0"> · {{ nodes.get(loop.reading_order[stepIndex - 1]!)?.title }}</template>
      </button>
      <button type="button" data-step-nav="next" :disabled="stepIndex >= loop.reading_order.length - 1"
        @click="selectStep(loop.reading_order[stepIndex + 1]!)">
        {{ t('loopNext') }}<template v-if="stepIndex < loop.reading_order.length - 1"> · {{ nodes.get(loop.reading_order[stepIndex + 1]!)?.title }}</template>
      </button>
    </nav>
  </section>
</template>
