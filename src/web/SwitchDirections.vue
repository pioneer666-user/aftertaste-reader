<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue';
import type { Point, Viewport } from '../core/canvas-layout.js';
import { translate, type Language } from './i18n.js';

const props = defineProps<{ targets: Point[][]; width: number; height: number; viewport: Viewport; language: Language; unit: string }>();
const emit = defineEmits<{ navigate: [viewport: Viewport]; returnFocus: [] }>();
const home = shallowRef<Viewport>();
const back = ref<HTMLButtonElement>();
const t = (key: string) => translate(props.language, key);
const directions = computed(() => {
  const { width, height, viewport } = props;
  const groups = new Map<string, Point[]>();
  if (width <= 0 || height <= 0) return groups;
  for (const points of props.targets) {
    if (!points.length || points.some(p => {
      const x = viewport.x + p.x * viewport.zoom, y = viewport.y + p.y * viewport.zoom;
      return x >= 0 && x <= width && y >= 0 && y <= height;
    })) continue;
    const point = points[Math.floor(points.length / 2)]!;
    const dx = (viewport.x + point.x * viewport.zoom) / width - .5;
    const dy = (viewport.y + point.y * viewport.zoom) / height - .5;
    const side = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'Left' : 'Right') : (dy < 0 ? 'Top' : 'Bottom');
    const group = groups.get(side) ?? [];
    group.push(point);
    groups.set(side, group);
  }
  return groups;
});
function locate(points: Point[]) {
  home.value ??= { ...props.viewport };
  const point = points[0]!;
  const zoom = props.viewport.zoom;
  emit('navigate', { x: props.width / 2 - point.x * zoom, y: props.height / 2 - point.y * zoom, zoom });
  void nextTick(() => back.value?.focus({ preventScroll: true }));
}
function restore() {
  if (home.value) emit('navigate', home.value);
  home.value = undefined;
  emit('returnFocus');
}
</script>

<template>
  <div class="switch-directions" :style="{ width: width + 'px' }">
    <button v-for="[side, points] in directions" :key="side" type="button" :data-direction="side" @click="locate(points)">
      {{ t('switch' + side).replace('{count}', String(points.length)).replace('{unit}', unit) }}
    </button>
    <button v-if="home" ref="back" type="button" class="switch-return" @click="restore">← {{ t('switchReturn') }}</button>
  </div>
</template>
