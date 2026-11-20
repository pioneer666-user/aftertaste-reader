<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue';
import type { Rect, ViewportTransform } from '@vue-flow/core';
import type { Point, Size } from '../core/canvas-layout.js';

const props = defineProps<{
  nodes: (Rect & { id: string; type: string; selected: boolean })[];
  viewport: ViewportTransform;
  size: Size;
  label: string;
  hint: string;
  enabled: boolean;
}>();
const emit = defineEmits<{ navigate: [view: ViewportTransform, commit: boolean]; dragging: [value: boolean] }>();
const gesture = shallowRef<{ pointer: number; start: Point; client: Point; view: ViewportTransform; frame: string; inside: boolean; moved: boolean }>();
const visible = computed(() => {
  const { x, y, zoom } = props.viewport;
  return { x: -x / zoom, y: -y / zoom, width: props.size.width / zoom, height: props.size.height / zoom };
});
const viewBox = computed(() => {
  const v = visible.value;
  let left = v.x, top = v.y, right = v.x + v.width, bottom = v.y + v.height;
  for (const node of props.nodes) {
    left = Math.min(left, node.x);
    top = Math.min(top, node.y);
    right = Math.max(right, node.x + node.width);
    bottom = Math.max(bottom, node.y + node.height);
  }
  const pad = Math.max(right - left, bottom - top, 1) * 0.055;
  return [left - pad, top - pad, right - left + pad * 2, bottom - top + pad * 2].join(' ');
});

function worldPoint(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement;
  return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
}

function down(event: PointerEvent) {
  if (!props.enabled || event.button !== 0 || gesture.value) return;
  (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
  gesture.value = { pointer: event.pointerId, start: worldPoint(event), client: { x: event.clientX, y: event.clientY },
    moved: false, view: { ...props.viewport },
    frame: viewBox.value, inside: (event.target as Element).classList.contains('minimap-view') };
  emit('dragging', true);
}

function navigate(event: PointerEvent, finish: boolean) {
  const g = gesture.value;
  if (!g || g.pointer !== event.pointerId) return;
  const point = worldPoint(event);
  const { zoom } = g.view;
  const dx = point.x - g.start.x, dy = point.y - g.start.y;
  if (Math.hypot(event.clientX - g.client.x, event.clientY - g.client.y) > 3) g.moved = true;
  const drag = g.inside && g.moved;
  if (!finish && !drag) return;
  const next = drag ? { x: g.view.x - dx * zoom, y: g.view.y - dy * zoom, zoom } :
    { x: props.size.width / 2 - point.x * zoom, y: props.size.height / 2 - point.y * zoom, zoom };
  emit('navigate', next, finish);
  if (finish) end();
}

function end() {
  if (!gesture.value) return;
  gesture.value = undefined;
  emit('dragging', false);
}

function cancel() {
  if (gesture.value) emit('navigate', gesture.value.view, false);
  end();
}
onBeforeUnmount(cancel);

function keyboard(event: KeyboardEvent) {
  if (!props.enabled || gesture.value) return;
  const offsets: Record<string, Point> = {
    ArrowLeft: { x: 1, y: 0 }, ArrowRight: { x: -1, y: 0 },
    ArrowUp: { x: 0, y: 1 }, ArrowDown: { x: 0, y: -1 },
  };
  const offset = offsets[event.key];
  if (!offset) return;
  event.preventDefault();
  const { x, y, zoom } = props.viewport;
  emit('navigate', { x: x + props.size.width * 0.2 * offset.x, y: y + props.size.height * 0.2 * offset.y, zoom }, true);
}
</script>

<template>
  <svg class="dependency-minimap" :viewBox="gesture?.frame ?? viewBox" role="group" tabindex="0"
    :aria-label="label" aria-describedby="minimap-instructions" @keydown="keyboard" @pointerdown="down"
    @pointermove="navigate($event, false)" @pointerup="navigate($event, true)" @pointercancel="cancel" @lostpointercapture="cancel">
    <desc id="minimap-instructions">{{ hint }}</desc>
    <rect v-for="node in nodes" :key="node.id" :x="node.x" :y="node.y" :width="node.width" :height="node.height"
      :rx="node.type === 'canvasGroup' ? 12 : 8" :class="[node.type, { selected: node.selected }]" />
    <rect class="minimap-view" v-bind="visible" rx="12" />
  </svg>
</template>

<style scoped>
.dependency-minimap { display: block; width: 100%; height: 88px; background: #f9fbf8; cursor: crosshair; touch-action: none; }
.canvasGroup { fill: #e7eadb; stroke: #c9d0b8; stroke-width: 1px; vector-effect: non-scaling-stroke; }
.canvasFile { fill: #8eab9b; }
.canvasLegend { fill: #a39ac4; }
.selected { fill: #17624b; }
.minimap-view { fill: #46856b0b; stroke: #42735d; stroke-width: 1.25px; vector-effect: non-scaling-stroke; cursor: grab; }
.minimap-view:active { cursor: grabbing; }
.dependency-minimap:focus-visible { outline-offset: -4px; }
</style>
