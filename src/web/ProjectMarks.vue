<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { ReaderProblem } from '../application/file-reader.js';
import { markKey } from '../core/understanding-marks.js';
import type { UnderstandingMark } from '../core/understanding-marks.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';

const props = defineProps<{
  marks: readonly UnderstandingMark[];
  language: Language;
  busy: boolean;
  visible: boolean;
  currentItem: string;
  error?: ReaderProblem;
  visit: (mark: UnderstandingMark) => Promise<string | undefined>;
}>();
const filter = defineModel<'all' | 'not-understood'>('filter', { required: true });
const emit = defineEmits<{ refresh: [] }>();
const visitError = ref<HTMLElement>();
const unavailable = ref('');
const visiting = ref(false);
let visitSequence = 0;
const t = (key: string) => translate(props.language, key);
const visible = computed(() => filter.value === 'all' ? props.marks : props.marks.filter(mark => mark.status === filter.value));

async function visit(mark: UnderstandingMark) {
  const sequence = ++visitSequence;
  visiting.value = true;
  unavailable.value = '';
  const problem = await props.visit(mark);
  if (sequence !== visitSequence) return;
  unavailable.value = problem ?? '';
  visiting.value = false;
  await nextTick();
  if (props.visible && unavailable.value && sequence === visitSequence) visitError.value?.focus({ preventScroll: true });
}
</script>

<template>
  <main id="marks" class="bookmark-panel" tabindex="-1" aria-labelledby="marks-heading">
    <div class="bookmark-heading">
      <h1 id="marks-heading">{{ t('marks') }}</h1>
      <button type="button" :disabled="busy || visiting" @click="emit('refresh')">{{ t('markRefresh') }}</button>
    </div>
    <label class="mark-filter">
      <span>{{ t('markFilter') }}</span>
      <select v-model="filter" @change="unavailable = ''">
        <option value="all">{{ t('markAll') }}</option>
        <option value="not-understood">{{ t('not-understood') }}</option>
      </select>
    </label>
    <p v-if="busy || visiting" role="status">{{ t('loading') }}</p>
    <p v-if="error" class="bookmark-error" role="alert">
      {{ problemText(language, error).message }} {{ problemText(language, error).nextStep }}
    </p>
    <p v-if="unavailable" ref="visitError" class="notice bookmark-unavailable" role="status" tabindex="-1">{{ unavailable }}</p>
    <p v-if="!busy && !error && !visible.length">{{ t(filter === 'all' ? 'markEmpty' : 'markNoDifficult') }}</p>
    <ul v-if="visible.length" class="project-bookmarks">
      <li v-for="mark in visible" :key="markKey(mark)">
        <button type="button" class="bookmark-entry" :disabled="busy"
          :aria-current="currentItem === markKey(mark) ? 'true' : undefined" @click="visit(mark)">
          <span>{{ mark.documentPath }} · {{ t('block') }} <code>{{ mark.blockId }}</code></span>
          <span><strong>{{ t(mark.status) }}</strong></span>
          <span class="bookmark-note">{{ mark.annotation || t('annotationEmpty') }}</span>
        </button>
      </li>
    </ul>
  </main>
</template>
