<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  kind: 'reviewed' | 'unreviewed' | 'library';
  status: string;
}>();
const slash = computed(() => props.label.lastIndexOf('/'));
const title = computed(() => props.kind === 'library' ? props.label : props.label.slice(slash.value + 1));
const directory = computed(() => slash.value < 0 ? '.' : props.label.slice(0, slash.value));

// Each corner starts and ends with collinear control points, meeting the straight sides at zero curvature.
const perimeter = 'M24 1H188c10 0 15 0 19 4s4 9 4 19v8c0 10 0 15-4 19s-9 4-19 4H24c-10 0-15 0-19-4s-4-9-4-19v-8c0-10 0-15 4-19s9-4 19-4Z';
</script>

<template>
  <button type="button" class="file-node dependency-card" :class="{ 'package-card': kind === 'library' }"
    :title="label" :aria-label="label + ' · ' + status">
    <svg class="card-outline" viewBox="0 0 212 56" preserveAspectRatio="none" aria-hidden="true">
      <path class="card-focus" :d="perimeter" />
      <path class="card-pick" :d="perimeter" />
      <path class="card-surface" :d="perimeter" />
    </svg>
    <strong class="card-name">{{ title }}</strong>
    <svg v-if="kind === 'library'" class="card-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m10 2 7 4v8l-7 4-7-4V6z M3 6l7 4 7-4 M10 10v8 M6.5 4l7 4" />
    </svg>
    <svg v-else-if="kind === 'reviewed'" class="card-icon reviewed-check" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4.5 10 3.5 3.5 7.5-8" />
    </svg>
    <small class="card-directory">{{ kind === 'library' ? status : directory }}</small>
    <small v-if="kind === 'unreviewed'" class="pending-label">{{ status }}</small>
  </button>
</template>

<style scoped>
button.dependency-card {
  --surface: #fdfefb;
  --stroke: #97aa9e;
  --ink: #203b2e;
  --detail: #526759;
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template: auto auto / minmax(0, 1fr) auto;
  align-content: center;
  align-items: center;
  gap: 2px 8px;
  padding: 0 16px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  outline: none;
}
button.package-card {
  --surface: #f4f1fb;
  --stroke: #a69bbb;
  --ink: #493d67;
  --detail: #655878;
}
.card-outline {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.card-surface { fill: var(--surface); stroke: var(--stroke); stroke-width: 1.35; }
.dependency-card:hover .card-surface { stroke: var(--ink); }
.dependency-card[aria-pressed="true"] .card-surface { fill: #eff8ef; stroke: #226448; stroke-width: 2.7; }
.package-card[aria-pressed="true"] .card-surface { fill: #ece5fa; stroke: #675482; }
.dependency-card[data-route-member] .card-surface { fill: #fff1c9; stroke: #946916; stroke-width: 3; }
.dependency-card[data-route-member][aria-pressed="true"] .card-surface { stroke: #226448; stroke-width: 4; }
.dependency-card[data-route-member] .card-name::before { content: '◆'; color: #916417; font-size: .7em; margin-right: .45em; }
.card-focus, .card-pick { fill: none; stroke: none; }
.dependency-card[data-box-selected="true"] .card-pick { stroke: #41765c; stroke-width: 7; stroke-dasharray: 5 4; }
button.dependency-card:focus-visible { outline: none; }
.dependency-card:focus-visible .card-focus { stroke: #286aab; stroke-width: 8; }
.dependency-card[data-box-selected="true"]:focus-visible .card-focus { stroke-width: 13; }
.card-name, .card-directory {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-name {
  grid-area: 1 / 1 / 2 / -1;
  font-size: 17px;
  line-height: 20px;
  font-weight: 650;
  letter-spacing: -.016em;
}
.dependency-card:has(.card-icon) .card-name { padding-inline-end: 22px; }
.card-icon {
  grid-area: 1 / 2;
  justify-self: end;
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.reviewed-check { color: #51846a; width: 16px; height: 16px; }
.dependency-card small { color: var(--detail); font-size: 12.5px; line-height: 15px; }
.card-directory { grid-area: 2 / 1 / 3 / -1; }
.dependency-card:has(.pending-label) .card-directory { grid-column-end: 2; }
.dependency-card .pending-label { grid-area: 2 / 2; justify-self: end; color: #835a25; }
@media (forced-colors: active) {
  .card-surface { fill: ButtonFace; stroke: ButtonText; }
  .dependency-card[aria-pressed="true"] .card-surface, .dependency-card:focus-visible .card-focus,
  .dependency-card[data-box-selected="true"] .card-pick { stroke: Highlight; }
}
</style>
