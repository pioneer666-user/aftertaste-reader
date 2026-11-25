<script setup lang="ts">
import { BaseEdge, type EdgeProps } from '@vue-flow/core';

defineProps<EdgeProps<{ from: string; to: string; reason: string }> & { active: boolean; lit: boolean; line: string | undefined }>();
const emit = defineEmits<{ inspect: []; keyboardFocus: [visible: boolean] }>();
</script>

<template>
  <g class="edge-ink inspect-edge" :class="{ 'edge-lit': lit, 'inspected-edge': active }" :data-edge="id"
    tabindex="0" role="button" :aria-label="data.from + ' → ' + data.to" :aria-pressed="active"
    @focus="emit('keyboardFocus', ($event.target as Element).matches(':focus-visible'))" @blur="emit('keyboardFocus', false)"
    @click.stop="emit('inspect')" @keydown.enter.stop.prevent="emit('inspect')" @keydown.space.stop.prevent="emit('inspect')">
    <title>{{ data.reason }}</title>
    <BaseEdge v-if="line" :id="id" :path="line" :marker-end="markerEnd" :style="style" :interaction-width="26" />
  </g>
</template>
