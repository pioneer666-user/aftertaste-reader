<script setup lang="ts">
import { computed, useId } from 'vue';
import type { LoopEntry } from '../application/loop-reader.js';

const props = defineProps<{ entry: LoopEntry }>();
const arrow = useId();
const diagram = computed(() => {
  const { steps, edges } = props.entry;
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const parents = incoming.get(edge.to) ?? [];
    parents.push(edge.from);
    incoming.set(edge.to, parents);
  }
  const columns = new Map<string, number>();
  const lanes: string[][] = [];
  // Earlier steps determine columns. Back-edges still point to their actual target.
  steps.forEach(id => {
    let depth = 0;
    for (const parent of incoming.get(id) ?? []) depth = Math.max(depth, (columns.get(parent) ?? -1) + 1);
    columns.set(id, depth);
    (lanes[depth] ??= []).push(id);
  });
  const points = new Map<string, { x: number; y: number }>();
  lanes.forEach((lane, depth) => lane.forEach((id, row) => points.set(id, {
    x: lanes.length > 1 ? 9 + 71 * depth / (lanes.length - 1) : 45,
    y: lane.length > 1 ? 13 + 29 * row / (lane.length - 1) : 27,
  })));
  const paths = edges.map(({ from, to }) => {
    const a = points.get(from)!, b = points.get(to)!;
    if (from === to) return `M ${a.x} ${a.y - 2} c -9 -12 10 -12 4 -2`;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return `M ${a.x} ${a.y} L ${b.x - 4 * (b.x - a.x) / length} ${b.y - 4 * (b.y - a.y) / length}`;
  });
  return { points: [...points.values()], paths };
});
</script>

<template>
  <svg class="loop-thumbnail" viewBox="0 0 90 55" aria-hidden="true" focusable="false">
    <defs><marker :id="arrow" viewBox="0 0 4 4" refX="3.6" refY="2" markerWidth="3" markerHeight="3" orient="auto">
      <path d="M0 0 4 2 0 4Z" fill="currentColor" />
    </marker></defs>
    <path v-for="(path, i) in diagram.paths" :key="i" :d="path" fill="none" stroke="currentColor" stroke-width="1.5" :marker-end="`url(#${arrow})`" />
    <circle v-for="(point, i) in diagram.points" :key="i" :cx="point.x" :cy="point.y" r="2.7" fill="var(--inset)" stroke="currentColor" stroke-width="1.5" />
  </svg>
</template>
