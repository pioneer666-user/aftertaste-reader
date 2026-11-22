<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { ReaderProblem } from '../application/file-reader.js';
import { markKey } from '../core/understanding-marks.js';
import type { UnderstandingMark } from '../core/understanding-marks.js';
import RecordWorkbench from './RecordWorkbench.vue';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';

const props = defineProps<{
  marks: readonly UnderstandingMark[];
  language: Language;
  busy: boolean;
  visible: boolean;
  listOpen: boolean;
  error?: ReaderProblem;
  visit: (mark: UnderstandingMark) => Promise<string | undefined>;
}>();
const filter = defineModel<'all' | 'not-understood'>('filter', { required: true });
const currentItem = defineModel<string>('currentItem', { required: true });
const emit = defineEmits<{ refresh: []; select: [] }>();
const visitError = ref<HTMLElement>();
const unavailable = ref('');
const visiting = ref(false);
let visitSequence = 0;
const t = (key: string) => translate(props.language, key);
const visible = computed(() => filter.value === 'all' ? props.marks : props.marks.filter(mark => mark.status === filter.value));

const active = computed(() => visible.value.find(mark => markKey(mark) === currentItem.value));
watch([visible, currentItem], () => {
  if (!active.value) currentItem.value = visible.value.length ? markKey(visible.value[0]!) : '';
}, { immediate: true });
function select(mark: UnderstandingMark) {
  currentItem.value = markKey(mark);
  unavailable.value = '';
  emit('select');
}

async function visit(mark: UnderstandingMark) {
  const sequence = ++visitSequence;
  visiting.value = true;
  unavailable.value = '';
  const problem = await props.visit(mark);
  if (sequence !== visitSequence) return;
  unavailable.value = problem ?? '';
  visiting.value = false;
  if (problem && props.visible) emit('select');
  await nextTick();
  if (props.visible && unavailable.value && sequence === visitSequence) visitError.value?.focus({ preventScroll: true });
}
</script>

<template>
  <RecordWorkbench page="marks" :heading="t('marks')" list-id="mark-navigation" :list-open="listOpen">
    <template #action><button type="button" :disabled="busy || visiting" @click="emit('refresh')">{{ t('markRefresh') }}</button></template>
    <template #status>
      <p v-if="busy || visiting" role="status">{{ t('loading') }}</p>
      <p v-if="error" role="alert">{{ problemText(language, error).message }} {{ problemText(language, error).nextStep }}</p>
    </template>
    <template #list>
      <label class="record-filter">{{ t('markFilter') }}
        <select v-model="filter" @change="unavailable = ''">
          <option value="all">{{ t('markAll') }}</option><option value="not-understood">{{ t('not-understood') }}</option>
        </select>
      </label>
      <ul class="project-bookmarks">
        <li v-for="mark in visible" :key="markKey(mark)">
          <button type="button" class="bookmark-entry" :aria-current="currentItem === markKey(mark) || undefined" @click="select(mark)">
            <strong>{{ t(mark.status) }}</strong>
            <span class="bookmark-note">{{ mark.annotation || t('annotationEmpty') }}</span>
            <small>{{ mark.documentPath }} · {{ mark.blockId }}</small>
          </button>
          <button type="button" class="record-visit" :disabled="busy" @click="visit(mark)">{{ t('recordVisit') }}</button>
        </li>
      </ul>
      <p v-if="!visible.length && !busy && !error">{{ t(filter === 'all' ? 'markEmpty' : 'markNoDifficult') }}</p>
    </template>
    <p v-if="unavailable" ref="visitError" class="notice bookmark-unavailable" role="status" tabindex="-1">{{ unavailable }}</p>
    <template v-if="active">
      <h2>{{ t(active.status) }}</h2>
      <p class="record-prose">{{ active.annotation || t('annotationEmpty') }}</p>
      <p class="record-location">{{ active.documentPath }} · {{ t('block') }} <code>{{ active.blockId }}</code></p>
      <button type="button" @click="visit(active)">{{ t('recordVisit') }}</button>
    </template>
    <template v-else-if="!busy && !error">
      <p>{{ t(filter === 'all' ? 'markEmpty' : 'markNoDifficult') }}</p>
      <button v-if="filter !== 'all'" type="button" @click="filter = 'all'">{{ t('clearFilter') }}</button>
    </template>
  </RecordWorkbench>
</template>
