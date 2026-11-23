<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import NoteIcon from './NoteIcon.vue';
import { fitFloatingAxis } from './floating-position.js';
import { translate } from './i18n.js';
import type { Language } from './i18n.js';

const props = defineProps<{
  location: string;
  step?: boolean;
  language: Language;
  anchor?: { x: number; y: number };
}>();
const emit = defineEmits<{ addToNotes: [] }>();
const t = (key: string) => translate(props.language, key);
const control = ref<HTMLElement>();
const button = ref<HTMLButtonElement>();
const manualPanel = ref<HTMLElement>();
const manualInput = ref<HTMLTextAreaElement>();
const manualText = ref('');
const copied = ref(false);
const keyboardLabel = ref(false);
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
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const left = fitFloatingAxis(point.x, width, window.innerWidth);
  const top = fitFloatingAxis(point.y, height, window.innerHeight);
  const readingTop = panel.closest('.reading-pane, .canvas-inspector')?.getBoundingClientRect().top ?? 0;
  panel.classList.toggle('labels-below', top - readingTop < 48);
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
    if (props.step && !props.anchor) manualPanel.value?.showPopover();
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
  if (props.step) control.value.showPopover();
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
  <div ref="control" :popover="step && anchor ? 'manual' : undefined" class="block-location-control" :class="{ 'selection-copy-panel selection-float': anchor, 'keyboard-label': keyboardLabel }"
    @focusin="keyboardLabel = true" @pointermove="keyboardLabel = false">
    <button ref="button" type="button" :class="anchor ? 'selection-copy-action selection-float-action' : 'block-copy-button'"
      :aria-label="t(step ? 'copyStepLocation' : 'copyBlockLocation')" :title="anchor ? undefined : t(step ? 'copyStepLocation' : 'copyBlockLocation')"
      @mousedown="anchor && $event.preventDefault()" @click="copyLocation">
      <span class="copy-location-icon" aria-hidden="true"></span>
      <span v-if="anchor" class="selection-label" aria-hidden="true">{{ t(step ? 'copyStepLocation' : 'copyBlockLocation') }}</span>
    </button>
    <button v-if="anchor" type="button" class="selection-float-action" :aria-label="t('noteAddSelection')"
      @mousedown.prevent @click="emit('addToNotes')">
      <NoteIcon />
      <span class="selection-label" aria-hidden="true">{{ t('noteAddSelection') }}</span>
    </button>
    <span class="location-copy-status" role="status">{{ copied ? t('copied') : '' }}</span>
    <div v-if="manualText" ref="manualPanel" :popover="step && !anchor ? 'manual' : undefined" class="location-copy-manual" @keydown.esc.stop.prevent="dismissManual">
      <p role="alert">{{ t('copyFailed') }}</p>
      <textarea ref="manualInput" readonly rows="5" class="location-copy-text"
        :aria-label="t(step ? 'manualStepLocation' : 'manualBlockLocation')" :value="manualText"></textarea>
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
  inset: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  padding: 1px 3px;
  border: 1px solid rgb(140 140 140 / .55);
  border-radius: 10px;
  background: #fafafa;
  box-shadow: inset 0 1px rgb(255 255 255 / .95), 0 2px 7px rgb(0 0 0 / .12);
}
@supports (backdrop-filter: blur(4px)) {
  .selection-copy-panel {
    background: linear-gradient(145deg, rgb(255 255 255 / .52), transparent 65%), rgb(247 247 247 / .70);
    backdrop-filter: blur(4px);
  }
}
@media (forced-colors: active) {
  .selection-copy-panel { background: Canvas; border-color: ButtonText; backdrop-filter: none; }
}
.selection-copy-panel .selection-float-action {
  display: inline-grid;
  place-items: center;
  vertical-align: middle;
  width: 28px;
  height: 28px;
  min-height: 28px;
  background: transparent;
  color: #353535;
  padding: 0;
}
.selection-float-action svg { width: 16px; height: 16px; }
.selection-float-action:is(:hover, :focus-visible) { background: #ebebeb; border-color: #949494; }
@media (pointer: coarse) {
  .selection-copy-panel .selection-float-action { width: 44px; min-height: 44px; }
}
.selection-label {
  display: none;
  position: absolute;
  inset: auto 0 calc(100% + 4px);
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: #353535;
  font-size: 12px;
  line-height: 1.4;
  white-space: normal;
  pointer-events: none;
}
.labels-below .selection-label { inset-block: calc(100% + 4px) auto; }
.selection-float-action:is(:hover, :focus-visible) .selection-label { display: block; }
.selection-copy-panel:not(.keyboard-label):has(button:hover) button:not(:hover) .selection-label,
.keyboard-label:has(:focus-visible) button:not(:focus-visible) .selection-label { display: none; }
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
  background: #f4faf5;
  color: #353535;
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
  inset: auto;
  margin: 0;
  z-index: 2;
  width: min(26rem, calc(100vw - 16px));
  max-height: calc(100dvh - 16px);
  overflow: auto;
  padding: 12px;
  background: #fff;
  box-shadow: 0 4px 20px #183d2b3b;
  font-size: 13px;
}
.selection-copy-panel:has(.location-copy-manual) { width: min(26rem, calc(100vw - 16px)); }
.selection-copy-panel .location-copy-manual {
  position: static;
  width: 100%;
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
  font: 12px/1.5 Consolas, monospace;
  resize: vertical;
}
</style>
