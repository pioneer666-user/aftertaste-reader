<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Point, Size, Viewport } from '../core/canvas-layout.js';

interface GroupBox extends Point, Size { id: string }
interface PushedDot extends Point { dx: number; dy: number; glow: number }

const props = defineProps<{ active: boolean; quiet: boolean; viewport: Viewport; groups: readonly GroupBox[] }>();
const surface = ref<HTMLCanvasElement>();
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const spacing = 24; // graph units
const reach = 70; // pointer distances and ripple travel are in screen CSS pixels
const releaseMs = 205;
const rippleMs = 540;
const outside = '#698173';
const inside = '#807454';
let pointer: Point | undefined;
let held = new Map<string, PushedDot>();
const released = new Map<string, { dot: PushedDot; start: number }>();
const ripples = new Map<string, number>();
let frame = 0;
let cleanup: (() => void) | undefined;

function schedule() {
  if (!frame && props.active && !document.hidden) frame = requestAnimationFrame(draw);
}

function resetHover() {
  pointer = undefined;
  held.clear();
  released.clear();
}

function resetMotion() {
  cancelAnimationFrame(frame);
  frame = 0;
  resetHover();
  ripples.clear();
  if ((!props.active || document.hidden) && surface.value) surface.value.width = 0;
  schedule();
}

function ripple(groupId: string) {
  if (!props.active || document.hidden || reduced.matches) return;
  ripples.set(groupId, performance.now());
  schedule();
}
defineExpose({ ripple });

function leave() {
  if (!pointer) return;
  pointer = undefined;
  schedule();
}

function track(event: PointerEvent) {
  const target = event.target;
  if (!props.active || props.quiet || reduced.matches || event.buttons || event.pointerType === 'touch' ||
      !(target instanceof Element) || !target.closest('.vue-flow, .loop-field') ||
      target.closest('.vue-flow__node:not(.vue-flow__node-canvasGroup), .group-handle, .vue-flow__edge')) {
    leave();
    return;
  }
  const pane = surface.value!.getBoundingClientRect();
  pointer = { x: event.clientX - pane.left, y: event.clientY - pane.top };
  schedule();
}

// All three inks share one repeating tile transform, including during a group drag.
function ink(ctx: CanvasRenderingContext2D, size: number, radius: number, color: string) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const pen = tile.getContext('2d')!;
  pen.fillStyle = color;
  pen.beginPath();
  pen.arc(size / 2, size / 2, radius, 0, 2 * Math.PI);
  pen.fill();
  return ctx.createPattern(tile, 'repeat')!;
}

let inks: { size: number; scale: number; field: CanvasPattern; group: CanvasPattern; wave: CanvasPattern } | undefined;

function draw(now: number) {
  frame = 0;
  const canvas = surface.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || !props.active || document.hidden) return;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const dpr = window.devicePixelRatio;
  if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
  if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const view = props.viewport;
  const step = spacing * view.zoom;
  const radius = Math.max(0.6, Math.sqrt(view.zoom));
  const fade = Math.min(1, view.zoom);
  const origin = { x: view.x % step, y: view.y % step };
  const size = Math.ceil(step * dpr);
  const scale = size / step;
  if (!inks || inks.size !== size || inks.scale !== scale) {
    inks = { size, scale, field: ink(ctx, size, radius * scale, outside),
      group: ink(ctx, size, radius * scale, inside), wave: ink(ctx, size, (radius + 0.95) * scale, '#397a59') };
  }
  const transform = new DOMMatrix([1 / scale, 0, 0, 1 / scale, origin.x - step / 2, origin.y - step / 2]);
  for (const pattern of [inks.field, inks.group, inks.wave]) pattern.setTransform(transform);
  const fieldAlpha = 0.18 + 0.21 * fade;
  ctx.fillStyle = inks.field;
  ctx.globalAlpha = fieldAlpha;
  ctx.fillRect(0, 0, width, height);
  const groups = props.groups.map(box => ({ id: box.id, x: view.x + box.x * view.zoom,
    y: view.y + box.y * view.zoom, width: box.width * view.zoom, height: box.height * view.zoom }));
  for (const box of groups) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, 8 * view.zoom);
    ctx.clip();
    ctx.clearRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = inks.group;
    ctx.globalAlpha = fieldAlpha + 0.08;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.restore();
  }

  // Only the few grid points under or just behind the pointer need individual drawing.
  const next = new Map<string, PushedDot>();
  if (pointer) {
    for (let col = Math.ceil((pointer.x - reach - origin.x) / step); col * step + origin.x <= pointer.x + reach; col++) {
      for (let row = Math.ceil((pointer.y - reach - origin.y) / step); row * step + origin.y <= pointer.y + reach; row++) {
        const x = col * step + origin.x, y = row * step + origin.y;
        const dx = x - pointer.x, dy = y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= reach) continue;
        const ratio = distance / reach;
        const push = distance ? 2 * Math.sin(Math.PI * ratio) ** 2 / distance : 0;
        const key = col + ',' + row;
        next.set(key, { x, y, dx: dx * push, dy: dy * push, glow: (1 - ratio * ratio) ** 2 });
        released.delete(key);
      }
    }
  }
  for (const [key, dot] of held) if (!next.has(key)) released.set(key, { dot, start: now });
  held = next;
  const drawDot = (dot: PushedDot, amount: number) => {
    const grouped = groups.some(b => dot.x >= b.x && dot.x <= b.x + b.width && dot.y >= b.y && dot.y <= b.y + b.height);
    const gain = Math.max(0, amount) * dot.glow;
    const clear = radius + 1.5;
    ctx.clearRect(dot.x - clear, dot.y - clear, 2 * clear, 2 * clear);
    ctx.fillStyle = grouped ? inside : outside;
    ctx.globalAlpha = fieldAlpha + (grouped ? 0.08 : 0) + gain * 0.43;
    ctx.beginPath();
    ctx.arc(dot.x + amount * dot.dx, dot.y + amount * dot.dy, radius + gain * 0.7, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const dot of held.values()) drawDot(dot, 1);
  for (const [key, release] of released) {
    const t = (now - release.start) / releaseMs;
    if (t >= 1) released.delete(key);
    else drawDot(release.dot, (1 - t) ** 2 * (1 - 3 * t));
  }

  for (const [id, start] of ripples) {
    const t = Math.max(0, (now - start) / rippleMs);
    const box = groups.find(group => group.id === id);
    if (!box || t >= 1) { ripples.delete(id); continue; }
    const travel = 36 * (1 - (1 - t) ** 2);
    ctx.beginPath();
    ctx.roundRect(box.x - travel, box.y - travel, box.width + 2 * travel, box.height + 2 * travel, 8 * view.zoom + travel);
    ctx.strokeStyle = inks.wave;
    ctx.lineWidth = 18;
    ctx.globalAlpha = 0.35 * (1 - t);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.globalAlpha = 0.8 * (1 - t);
    ctx.stroke();
  }
  if (released.size || ripples.size) schedule();
}

watch(() => [props.viewport.x, props.viewport.y, props.viewport.zoom, props.quiet], () => { resetHover(); schedule(); });
watch(() => props.groups, schedule, { deep: true });
watch(() => props.active, resetMotion);
onMounted(() => {
  const area = surface.value!.parentElement!;
  const size = new ResizeObserver(schedule);
  size.observe(surface.value!);
  const listeners = new AbortController();
  const options = { passive: true, capture: true, signal: listeners.signal };
  area.addEventListener('pointermove', track, options);
  area.addEventListener('pointerleave', leave, { signal: listeners.signal });
  area.addEventListener('pointerdown', leave, options);
  window.addEventListener('blur', leave, options);
  document.addEventListener('visibilitychange', resetMotion, options);
  reduced.addEventListener('change', resetMotion, options);
  schedule();
  cleanup = () => { size.disconnect(); listeners.abort(); cancelAnimationFrame(frame); };
});
onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <canvas ref="surface" class="dependency-dots" aria-hidden="true" />
</template>

<style scoped>
.dependency-dots { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
</style>
