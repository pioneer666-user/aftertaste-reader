<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge, getBezierPath } from '@vue-flow/core';
import type { EdgeProps } from '@vue-flow/core';

const props = defineProps<EdgeProps<{ reason: string; loop?: boolean }>>();
const line = computed(() => {
  const { sourceX: x, sourceY: y, targetX: tx, targetY: ty } = props;
  const bezier = () => getBezierPath({ sourceX: x, sourceY: y, targetX: tx, targetY: ty,
    sourcePosition: props.sourcePosition, targetPosition: props.targetPosition })[0];
  if (props.source === props.target) {
    return `M ${x},${y} C ${x + 56},${y} ${x + 42},${ty - 56} ${tx + 34},${ty - 42} Q ${tx},${ty - 42} ${tx},${ty}`;
  }
  if (props.data.loop) return bezier();
  const gap = tx - x;
  if (gap < 0) {
    // Go around the two cards when the destination's input sits behind the output.
    const lane = Math.min(y, ty) - props.sourceNode.dimensions.height / 2 - 23;
    return `M ${x},${y} C ${x + 55},${y} ${x + 55},${lane} ${x},${lane} H ${tx} C ${tx - 55},${lane} ${tx - 55},${ty} ${tx},${ty}`;
  }
  const rise = Math.min(17, gap * .13) * Math.max(0, 1 - Math.abs(ty - y) / 48);
  if (!rise) return bezier();
  // An ordinary horizontal-tangent Bézier collapses to a line for same-row files.
  const mid = x + gap / 2, crest = (y + ty) / 2 - rise;
  return `M ${x},${y} C ${x + gap / 4},${y} ${mid - gap / 4},${crest} ${mid},${crest} S ${tx - gap / 4},${ty} ${tx},${ty}`;
});
</script>

<template>
  <title>{{ data.reason }}</title>
  <BaseEdge :id="id" :path="line" :marker-end="markerEnd" :style="style" />
</template>
