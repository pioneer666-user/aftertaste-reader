<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

const percentage = defineModel<number>({ required: true });
defineProps<{ label: string }>();

const dividerElement = ref<HTMLElement>();
const minimum = ref(20);
const maximum = computed(() => 100 - minimum.value);
const visiblePercentage = computed(() => clamp(percentage.value));
const drag = ref<{ pointerId: number; offset: number }>();
let observer: ResizeObserver | undefined;

onMounted(() => {
  const divider = dividerElement.value;
  const files = divider?.previousElementSibling;
  const outline = divider?.nextElementSibling;
  if (!divider || !files || !outline) return;
  observer = new ResizeObserver(() => {
    const total = files.clientHeight + outline.clientHeight;
    if (total === 0) return;
    const pixels = Number.parseFloat(getComputedStyle(divider).getPropertyValue('--sidebar-section-minimum'));
    minimum.value = Math.min(50, Math.max(20, Math.ceil(pixels / total * 100)));
  });
  observer.observe(files);
  observer.observe(outline);
});
onUnmounted(() => observer?.disconnect());

function clamp(value: number) {
  return Math.min(maximum.value, Math.max(minimum.value, Math.round(value)));
}

function resize(value: number) {
  percentage.value = clamp(value);
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
    case 'ArrowUp': resize(visiblePercentage.value - 5); break;
    case 'ArrowDown': resize(visiblePercentage.value + 5); break;
    case 'Home': resize(minimum.value); break;
    case 'End': resize(maximum.value); break;
    default: return;
  }
  event.preventDefault();
}
</script>

<template>
  <div
    ref="dividerElement" class="sidebar-divider" role="separator" tabindex="0" aria-orientation="horizontal"
    aria-controls="reader-file-navigation" :aria-label="label" :aria-valuemin="minimum" :aria-valuemax="maximum"
    :aria-valuenow="visiblePercentage" :aria-valuetext="`${visiblePercentage}%`" :data-dragging="drag ? '' : undefined"
    @pointerdown="startDrag" @pointermove="moveDivider" @lostpointercapture="endDrag" @keydown="resizeFromKeyboard"
  ></div>
</template>

<style scoped>
.sidebar-divider {
  position: relative;
  display: grid;
  place-items: center;
  height: 12px;
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
  background: var(--control-rim);
}
.sidebar-divider:focus-visible { outline-offset: -2px; }
.sidebar-divider:is(:hover, :focus-visible, [data-dragging])::before { border-color: var(--control-rim); }
.sidebar-divider:is(:hover, :focus-visible, [data-dragging])::after { background: var(--accent); }
</style>
