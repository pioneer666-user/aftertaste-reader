<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge, getSmoothStepPath } from '@vue-flow/core';
import type { EdgeProps } from '@vue-flow/core';

const props = defineProps<EdgeProps<{ reason: string }>>();
const line = computed(() => {
  if (props.source !== props.target) return getSmoothStepPath(props)[0];
  const { sourceX: x, sourceY: y, targetX, targetY } = props;
  return `M ${x},${y} C ${x + 56},${y} ${x + 42},${targetY - 56} ${targetX + 34},${targetY - 42} Q ${targetX},${targetY - 42} ${targetX},${targetY}`;
});
</script>

<template>
  <title>{{ data.reason }}</title>
  <BaseEdge :id="id" :path="line" :marker-end="markerEnd" />
</template>
