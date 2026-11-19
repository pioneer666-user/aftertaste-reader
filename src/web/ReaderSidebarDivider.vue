<script setup lang="ts">
import { ref } from 'vue';

const percentage = defineModel<number>({ required: true });
defineProps<{ label: string }>();

const minimum = 20;
const maximum = 80;
const drag = ref<{ pointerId: number; offset: number }>();

function resize(value: number) {
  percentage.value = Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || drag.value) return;
  const divider = event.currentTarget as HTMLElement;
  drag.value = { pointerId: event.pointerId, offset: event.clientY - divider.getBoundingClientRect().top };
  divider.setPointerCapture(event.pointerId);
  divider.focus({ preventScroll: true });
  event.preventDefault();
}

function moveDivider(event: PointerEvent) {
  if (!drag.value || event.pointerId !== drag.value.pointerId) return;
  const divider = event.currentTarget as HTMLElement;
  const files = divider.previousElementSibling;
  const outline = divider.nextElementSibling;
  if (!files || !outline) return;
  const top = files.getBoundingClientRect().top;
  const height = outline.getBoundingClientRect().bottom - top - divider.getBoundingClientRect().height;
  if (height > 0) resize((event.clientY - top - drag.value.offset) / height * 100);
}

function endDrag(event: PointerEvent) {
  if (event.pointerId === drag.value?.pointerId) drag.value = undefined;
}

function resizeFromKeyboard(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowUp': resize(percentage.value - 5); break;
    case 'ArrowDown': resize(percentage.value + 5); break;
    case 'Home': resize(minimum); break;
    case 'End': resize(maximum); break;
    default: return;
  }
  event.preventDefault();
}
</script>

<template>
  <div
    class="sidebar-divider" role="separator" tabindex="0" aria-orientation="horizontal"
    aria-controls="reader-file-navigation" :aria-label="label" :aria-valuemin="minimum" :aria-valuemax="maximum"
    :aria-valuenow="percentage" :aria-valuetext="`${percentage}%`" :data-dragging="drag ? '' : undefined"
    @pointerdown="startDrag" @pointermove="moveDivider" @lostpointercapture="endDrag" @keydown="resizeFromKeyboard"
  ></div>
</template>

<style scoped>
.sidebar-divider {
  position: relative;
  display: grid;
  place-items: center;
  height: 12px;
  border-radius: 4px;
  cursor: row-resize;
  touch-action: none;
  user-select: none;
}
.sidebar-divider::before {
  content: '';
  position: absolute;
  inset: 50% 0 auto;
  border-top: 1px solid var(--line);
}
.sidebar-divider::after {
  content: '';
  position: relative;
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: #758b7d;
}
.sidebar-divider:focus-visible { outline-offset: -2px; }
.sidebar-divider:is(:hover, :focus-visible, [data-dragging])::before { border-color: #8aaf9a; }
.sidebar-divider:is(:hover, :focus-visible, [data-dragging])::after { background: var(--accent); }
</style>
