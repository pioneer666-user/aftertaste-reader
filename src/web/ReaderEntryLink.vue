<script setup lang="ts">
import { ref } from 'vue';
import { translate, type Language } from './i18n.js';
import { request } from './reader-api.js';

const props = defineProps<{ language: Language }>();
const t = (key: string) => translate(props.language, key);
const originalLocation = window.location.hash;
const dialog = ref<HTMLDialogElement>();
const linkInput = ref<HTMLInputElement>();
const url = ref('');
const status = ref('');
let pending: AbortController | undefined;

async function showLink() {
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  url.value = '';
  status.value = 'loading';
  dialog.value?.showModal();
  try {
    const { entryPath } = await request<{ entryPath: string }>('/api/reader-entry', {
      headers: { 'X-Aftertaste-Entry': '1' }, signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    url.value = window.location.origin + entryPath + originalLocation;
    status.value = '';
  } catch {
    if (!controller.signal.aborted) status.value = 'readerLinkFailed';
  }
}

function clearLink() {
  if (dialog.value?.open) return;
  pending?.abort();
  url.value = '';
  status.value = '';
}

async function copyLink() {
  const controller = pending;
  try {
    await navigator.clipboard.writeText(url.value);
    if (!controller?.signal.aborted) status.value = 'copied';
  } catch {
    if (controller?.signal.aborted) return;
    linkInput.value?.focus();
    linkInput.value?.select();
    status.value = 'readerLinkManual';
  }
}
</script>

<template>
  <button type="button" class="reader-entry-button" aria-haspopup="dialog" :aria-label="t('readerLink')" :title="t('readerLink')" @click="showLink">
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" aria-hidden="true">
      <path d="m8 12 4-4m-5.4 2.2-1.9 1.9a2.9 2.9 0 0 0 4.1 4.1l2.5-2.5a2.9 2.9 0 0 0 .3-3.7m1.8-.2 1.9-1.9a2.9 2.9 0 0 0-4.1-4.1L8.7 6.3a2.9 2.9 0 0 0-.3 3.7"/>
    </svg>
    <span class="reader-entry-label">{{ t('readerLink') }}</span>
  </button>
  <dialog ref="dialog" class="reader-entry-dialog" aria-labelledby="reader-entry-title" @close="clearLink">
    <div class="reader-entry-title">
      <h2 id="reader-entry-title">{{ t('readerLink') }}</h2>
      <button type="button" @click="dialog?.close()">{{ t('closeBlockLocation') }}</button>
    </div>
    <p>{{ t('readerLinkHint') }}</p>
    <div v-if="url" class="reader-entry-copy">
      <input ref="linkInput" :aria-label="t('readerLink')" :value="url" readonly spellcheck="false" />
      <button type="button" @click="copyLink">{{ t('readerLinkCopy') }}</button>
    </div>
    <p v-if="status" role="status">{{ t(status) }}</p>
  </dialog>
</template>

<style scoped>
.reader-entry-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
.reader-entry-dialog {
  width: min(30rem, calc(100% - 24px)); padding: 16px;
  color: var(--text); background: var(--panel); border: 1px solid var(--control-rim);
  border-radius: calc(var(--corner-panel) * var(--corner-radius-scale)); corner-shape: squircle;
}
.reader-entry-dialog::backdrop { background: color-mix(in srgb, var(--shadow-ink) 25%, transparent); }
.reader-entry-title, .reader-entry-copy { display: flex; align-items: center; gap: 8px; }
.reader-entry-title { justify-content: space-between; }
.reader-entry-title h2 { margin: 0; font-size: 1rem; }
.reader-entry-dialog p { margin: 8px 0; font-size: .875rem; }
.reader-entry-copy input {
  flex: 1; min-width: 0; padding: 8px; font: inherit; font-size: .875rem; border: 1px solid var(--control-rim);
  border-radius: calc(var(--corner-control) * var(--corner-radius-scale)); corner-shape: squircle;
}
.reader-entry-copy button { flex: none; }
@media (max-width: 1100px) { .reader-entry-label { display: none; } }
@media (pointer: coarse) { .reader-entry-button, .reader-entry-dialog button { min-height: 44px; } }
</style>
