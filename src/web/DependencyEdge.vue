<script setup lang="ts">
import { BaseEdge } from '@vue-flow/core';
import type { EdgeProps } from '@vue-flow/core';

defineProps<EdgeProps<{ from: string; to: string; reason: string; loop?: boolean }> & { active: boolean; lit: boolean; line: string | undefined }>();
const emit = defineEmits<{ inspect: [] }>();
</script>

<template>
  <g class="edge-ink" :class="{ 'edge-lit': lit, 'inspect-edge': !data.loop, 'inspected-edge': active }" :tabindex="data.loop ? undefined : 0"
    :role="data.loop ? undefined : 'button'" :aria-label="data.loop ? undefined : data.from + ' → ' + data.to"
    :aria-pressed="data.loop ? undefined : active" @click="!data.loop && emit('inspect')"
    @keydown.enter.prevent="!data.loop && emit('inspect')" @keydown.space.prevent="!data.loop && emit('inspect')">
    <title>{{ data.reason }}</title>
    <BaseEdge v-if="line" :id="id" :path="line" :marker-end="markerEnd" :style="style" />
  </g>
</template>
