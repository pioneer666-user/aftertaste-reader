<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { emptyAnnotationRevision, isMarkStatus, markKey, markStatuses } from '../core/understanding-marks.js';
import type { MarkEdit, ReaderMark } from '../core/understanding-marks.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { markDraftsKey } from './mark-drafts.js';
import { failed } from './reader-api.js';

const props = defineProps<{
  documentPath: string;
  blockId: string;
  mark: ReaderMark | undefined;
  active: boolean;
  language: Language;
  busy: boolean;
  unavailable: boolean;
  saveMark: (edit: MarkEdit) => Promise<void>;
}>();

const t = (key: string) => translate(props.language, key);
const drafts = inject(markDraftsKey)!;
const identity = { documentPath: props.documentPath, blockId: props.blockId };
const key = markKey(identity);
const draft = computed(() => drafts.get(key));
const expanded = ref(!!draft.value?.annotation);
const detailsId = `annotation-${props.blockId}`;
const annotationInput = ref<HTMLTextAreaElement>();
const annotationButton = ref<HTMLButtonElement>();
const feedback = ref('');
const savedStatus = computed(() => props.mark?.status ?? 'unmarked');
const savedAnnotation = computed(() => props.mark?.annotation ?? '');
const savedAnnotationRevision = computed(() => props.mark?.annotationRevision ?? emptyAnnotationRevision);
const shownStatus = computed(() => draft.value?.status?.value ?? savedStatus.value);
const statusConflict = computed(() => draft.value?.status?.problem?.code === 'MARK_CONFLICT');
const annotationConflict = computed(() => draft.value?.annotation?.problem?.code === 'MARK_CONFLICT');

watch(() => props.active, active => {
  if (active) expanded.value = true;
}, { immediate: true });

function getDraft() {
  if (!draft.value) drafts.set(key, {});
  return draft.value!;
}

function clear(field: 'status' | 'annotation') {
  const entry = draft.value;
  if (!entry) return;
  delete entry[field];
  if (!entry.status && !entry.annotation) drafts.delete(key);
}

async function openAnnotation() {
  feedback.value = '';
  getDraft().annotation ??= { previous: savedAnnotationRevision.value, value: savedAnnotation.value };
  await nextTick();
  annotationInput.value?.focus();
}

async function closeAnnotation() {
  clear('annotation');
  await nextTick();
  if (expanded.value) annotationButton.value?.focus();
}

function changeStatus(event: Event) {
  const control = event.target as HTMLSelectElement;
  const value = control.value;
  if (props.busy || props.unavailable || !isMarkStatus(value)) {
    control.value = shownStatus.value;
    return;
  }
  const entry = getDraft();
  const existing = entry.status;
  entry.status = { ...existing, previous: existing?.previous ?? savedStatus.value, value };
  if (!statusConflict.value) void saveStatus();
}

function saveStatus() {
  const entry = draft.value?.status;
  if (!entry || props.busy || props.unavailable) return;
  if (statusConflict.value) entry.previous = savedStatus.value;
  void persist({ ...identity, field: 'status', previous: entry.previous, value: entry.value });
}

function saveAnnotation() {
  const entry = draft.value?.annotation;
  if (!entry || props.busy || props.unavailable) return;
  if (annotationConflict.value) entry.previous = savedAnnotationRevision.value;
  void persist({ ...identity, field: 'annotation', previous: entry.previous, value: entry.value });
}

async function persist(edit: MarkEdit) {
  const entry = draft.value?.[edit.field];
  if (!entry) return;
  feedback.value = '';
  try {
    await props.saveMark(edit);
    if (edit.field === 'annotation') await closeAnnotation();
    else clear('status');
    feedback.value = edit.field === 'status' ? 'markSaved' : 'annotationSaved';
  } catch (error) { entry.problem = failed(error); }
}
</script>

<template>
  <div :id="'mark-' + blockId" class="block-mark" tabindex="-1" role="group" :aria-label="t('markStatus')">
    <div class="mark-controls">
      <label>
        <span>{{ t('markStatus') }}</span>
        <select :value="shownStatus" :disabled="unavailable" :aria-disabled="busy" @change="changeStatus">
          <option v-for="status in markStatuses" :key="status" :value="status">{{ t(status) }}</option>
        </select>
      </label>
      <button type="button" class="record-toggle" :aria-controls="detailsId" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ t(savedAnnotation ? 'annotationPresent' : 'annotation') }}
      </button>
    </div>
    <div v-if="draft?.status?.problem" class="bookmark-error" role="alert">
      <p>{{ t('markSaveFailed') }} {{ problemText(language, draft.status.problem).message }} {{ problemText(language, draft.status.problem).nextStep }}</p>
      <p v-if="statusConflict && !unavailable">{{ t('savedMarkStatus') }} · {{ t(savedStatus) }}</p>
    </div>
    <div v-if="draft?.status?.problem" class="bookmark-actions">
      <button type="button" :disabled="busy || unavailable" @click="saveStatus">{{ t(statusConflict ? 'applyMyStatus' : 'retryMark') }}</button>
      <button type="button" :disabled="busy" @click="clear('status')">{{ t('cancelMark') }}</button>
    </div>
    <div v-show="expanded" :id="detailsId" class="annotation-details">
      <p v-if="savedAnnotation && (!draft?.annotation || (active && !annotationConflict))" class="bookmark-note annotation-text">{{ savedAnnotation }}</p>
      <button v-if="!draft?.annotation" ref="annotationButton" type="button" :disabled="busy || unavailable"
        @click="openAnnotation">{{ t('editAnnotation') }}</button>
      <form v-else class="bookmark-editor" @submit.prevent="saveAnnotation">
        <label>
          <span>{{ t('annotationOptional') }}</span>
          <textarea ref="annotationInput" v-model="draft.annotation.value" :readonly="busy" rows="3" />
        </label>
        <div v-if="draft.annotation.problem" class="bookmark-error" role="alert">
          <p>{{ t('annotationSaveFailed') }} {{ problemText(language, draft.annotation.problem).message }} {{ problemText(language, draft.annotation.problem).nextStep }}</p>
          <p v-if="annotationConflict && !unavailable">{{ t('savedAnnotation') }}</p>
          <p v-if="annotationConflict && !unavailable" class="bookmark-note">{{ savedAnnotation || t('annotationEmpty') }}</p>
        </div>
        <div class="bookmark-actions">
          <button type="submit" :disabled="busy || unavailable">{{ t(annotationConflict ? 'applyMyAnnotation' : 'saveAnnotation') }}</button>
          <button type="button" :disabled="busy" @click="closeAnnotation">{{ t('cancelMark') }}</button>
        </div>
      </form>
    </div>
    <p class="bookmark-status" role="status">{{ feedback ? t(feedback) : '' }}</p>
  </div>
</template>

<style scoped>
.block-mark { margin: 0; scroll-margin-block: 8px; }
.block-mark:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
.annotation-details { margin-block-start: 8px; }
.annotation-details > button { font-size: 13px; }
.annotation-text {
  margin: 0 0 8px;
  padding: 10px 12px;
  background: #f2f6f2;
  line-height: 1.5;
}
</style>
