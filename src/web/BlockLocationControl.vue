<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { fitFloatingAxis } from './floating-position.js';
import { translate } from './i18n.js';
import type { Language } from './i18n.js';

const props = defineProps<{
  location: string;
  language: Language;
  anchor?: { x: number; y: number };
}>();
const t = (key: string) => translate(props.language, key);
const control = ref<HTMLElement>();
const button = ref<HTMLButtonElement>();
const manualPanel = ref<HTMLElement>();
const manualInput = ref<HTMLTextAreaElement>();
const manualText = ref('');
const copied = ref(false);
let feedbackTimer: number | undefined;
let observer: ResizeObserver | undefined;
let attempt = 0;

function focusButton() {
  button.value?.focus({ preventScroll: true });
}

function placePanel() {
  const panel = props.anchor ? control.value : manualPanel.value;
  const bounds = button.value?.getBoundingClientRect();
  const point = props.anchor ?? (bounds && { x: bounds.right, y: bounds.bottom });
  if (!panel || !point) return;
  const gap = 8;
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const left = fitFloatingAxis(point.x, width, window.innerWidth);
  let top = fitFloatingAxis(point.y, height, window.innerHeight);
  if (props.anchor && !manualText.value) {
    const note = panel.closest('.explanation-pane')?.querySelector('.note-selection-action')?.getBoundingClientRect();
    if (note && left < note.right && left + width > note.left && top < note.bottom && top + height > note.top) {
      const above = Math.min(point.y, note.top) - gap - height;
      top = above >= gap ? above : fitFloatingAxis(note.bottom, height, window.innerHeight);
    }
  }
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
}

async function copyLocation() {
  const request = ++attempt;
  const text = props.location;
  window.clearTimeout(feedbackTimer);
  copied.value = false;
  try {
    await navigator.clipboard.writeText(text);
    if (request !== attempt) return;
    manualText.value = '';
    copied.value = true;
    feedbackTimer = window.setTimeout(() => { copied.value = false; }, 2200);
  } catch {
    if (request !== attempt) return;
    manualText.value = text;
    await nextTick();
    if (request !== attempt) return;
    placePanel();
    manualInput.value?.focus({ preventScroll: true });
    manualInput.value?.select();
  }
}

function dismissManual() {
  manualText.value = '';
  focusButton();
}

watch(() => props.location, () => {
  ++attempt;
  copied.value = false;
  manualText.value = '';
});
watch(() => props.anchor, placePanel, { flush: 'post' });
watch(manualText, text => {
  if (text) window.addEventListener('resize', placePanel);
  else window.removeEventListener('resize', placePanel);
});
onMounted(() => {
  if (!props.anchor || !control.value) return;
  placePanel();
  observer = new ResizeObserver(placePanel);
  observer.observe(control.value);
});
onUnmounted(() => {
  ++attempt;
  observer?.disconnect();
  window.removeEventListener('resize', placePanel);
  window.clearTimeout(feedbackTimer);
});
</script>

<template>
  <div ref="control" class="block-location-control" :class="{ 'selection-copy-panel selection-float': anchor }">
    <button ref="button" type="button" :class="anchor ? 'selection-copy-action selection-float-action' : 'block-copy-button'"
      :aria-label="t('copyBlockLocation')" :title="anchor ? undefined : t('copyBlockLocation')"
      @mousedown="anchor && $event.preventDefault()" @click="copyLocation">
      <span v-if="anchor">{{ t('copyBlockLocation') }}</span>
      <span v-else class="copy-location-icon" aria-hidden="true"></span>
    </button>
    <span class="location-copy-status" role="status">{{ copied ? t('copied') : '' }}</span>
    <div v-if="manualText" ref="manualPanel" class="location-copy-manual" @keydown.esc.stop.prevent="dismissManual">
      <p role="alert">{{ t('copyFailed') }}</p>
      <textarea ref="manualInput" readonly rows="5" class="location-copy-text"
        :aria-label="t('manualBlockLocation')" :value="manualText"></textarea>
      <button type="button" @click="dismissManual">{{ t('closeBlockLocation') }}</button>
    </div>
  </div>
</template>

<style scoped>
.block-location-control {
  position: relative;
  float: inline-end;
  margin-inline-start: 8px;
}
.block-copy-button {
  display: grid;
  place-items: center;
  width: 32px;
  min-height: 32px;
  padding: 0;
  border-color: transparent;
  color: var(--accent);
}
.block-copy-button:hover, .block-copy-button:focus-visible { border-color: var(--line); }
.copy-location-icon {
  position: relative;
  width: 9px;
  height: 11px;
  border: 1px solid;
  border-radius: 2px;
  margin: 3px 0 0 3px;
}
.copy-location-icon::before {
  content: '';
  position: absolute;
  inset: -4px 2px 2px -4px;
  border: 1px solid;
  border-right: 0;
  border-bottom: 0;
  border-radius: 2px 0 0;
}
.selection-copy-panel {
  position: fixed;
  margin: 0;
}
.location-copy-manual button {
  min-height: 32px;
  padding: 5px 10px;
  font-size: 13px;
}
.location-copy-status:not(:empty) {
  position: absolute;
  inset-inline-end: 0;
  top: 100%;
  width: max-content;
  padding: 4px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: #f4faf5;
  color: var(--accent);
  font-size: 12px;
}
.selection-copy-panel .location-copy-status:not(:empty) {
  position: static;
  margin-inline: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  white-space: nowrap;
}
.location-copy-manual {
  position: fixed;
  z-index: 2;
  width: min(26rem, calc(100vw - 16px));
  max-height: calc(100dvh - 16px);
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 20px #183d2b3b;
  font-size: 13px;
}
.selection-copy-panel:has(.location-copy-manual) { width: min(26rem, calc(100vw - 16px)); }
.selection-copy-panel .location-copy-manual {
  position: static;
  width: auto;
  max-height: max(5rem, calc(100dvh - 60px));
  box-shadow: none;
}
.location-copy-manual p { margin: 0 0 8px; color: #743b1e; }
.location-copy-text {
  display: block;
  width: 100%;
  margin-block-end: 8px;
  padding: 8px;
  border: 1px solid #a7b8ac;
  border-radius: 4px;
  font: 12px/1.5 Consolas, monospace;
  resize: vertical;
}
</style>
