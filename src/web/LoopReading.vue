<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { ReadingLoop } from '../application/loops.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { renderMarkdown } from './markdown.js';

const props = defineProps<{ reading: ReadingLoop; language: Language; selected: string }>();
const emit = defineEmits<{ select: [id: string] }>();
const t = (key: string) => translate(props.language, key);
const loop = computed(() => props.reading.loop);
const nodes = computed(() => new Map(loop.value.nodes.map(node => [node.id, node])));
const step = computed(() => nodes.value.get(props.selected));
const source = computed(() => props.reading.sources.find(item => item.node_id === props.selected));
const choices = computed(() => loop.value.edges.filter(edge => edge.from === props.selected));
const stepIndex = computed(() => loop.value.reading_order.indexOf(props.selected));
const stepHeading = ref<HTMLElement>();

async function selectStep(id: string) {
  emit('select', id);
  await nextTick();
  stepHeading.value?.focus();
}
</script>

<template>
  <div class="loop-overview">
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
    <h2 ref="stepHeading" tabindex="-1" aria-live="polite">{{ step.title }}</h2>
    <p class="canvas-hint"><code>{{ step.path }}</code> · {{ t('block') }} <code>{{ step.block_id }}</code></p>
    <div :key="step.id">
      <details>
        <summary>{{ t('loopStepExplanation') }}</summary>
        <div class="markdown" v-html="renderMarkdown(step.explanation)"></div>
        <template v-if="step.hint">
          <h3>{{ t('loopHint') }}</h3>
          <div class="markdown" v-html="renderMarkdown(step.hint)"></div>
        </template>
      </details>
      <details>
        <summary>{{ t('loopOriginal') }}</summary>
        <div class="markdown" v-html="renderMarkdown(step.block_explanation)"></div>
      </details>
      <details v-if="step.lines" :open="source?.status === 'unavailable'">
        <summary>{{ t('source') }} · {{ step.lines.start }}–{{ step.lines.end }}</summary>
        <p class="canvas-hint">{{ t('commit') }} <code>{{ loop.source_commit }}</code></p>
        <div v-if="source?.status === 'available'" class="source-scroll source-pane" tabindex="0" role="region" :aria-label="t('sourceScroll')">
          <pre><code><span v-for="(line, index) in source.lines" :key="index" class="source-line"><span class="line-number" aria-hidden="true">{{ step.lines.start + index }}</span><span>{{ line }}</span>{{ '\n' }}</span></code></pre>
        </div>
        <div v-else-if="source?.status === 'unavailable'" role="alert" class="canvas-problem">
          <strong>{{ t('unavailable') }}</strong>
          <p>{{ problemText(language, source.error).message }} {{ problemText(language, source.error).nextStep }}</p>
          <code>{{ source.error.code }} · {{ source.error.context.repositoryRoot }}</code>
        </div>
      </details>
    </div>
    <h3>{{ t('loopConnections') }}</h3>
    <ul v-if="choices.length" class="canvas-relations">
      <li v-for="edge in choices" :key="edge.to">
        <button type="button" @click="selectStep(edge.to)">{{ nodes.get(edge.to)?.title }}</button>
        <div class="markdown" v-html="renderMarkdown(edge.reason)"></div>
      </li>
    </ul>
    <p v-else class="canvas-hint">{{ t('loopEnd') }}</p>
    <nav class="loop-step-controls" :aria-label="t('loopOrder')">
      <button type="button" :disabled="stepIndex <= 0" @click="selectStep(loop.reading_order[stepIndex - 1]!)">{{ t('loopPrevious') }}</button>
      <button type="button" :disabled="stepIndex >= loop.reading_order.length - 1" @click="selectStep(loop.reading_order[stepIndex + 1]!)">{{ t('loopNext') }}</button>
    </nav>
  </section>
</template>
