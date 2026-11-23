<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge, getBezierPath } from '@vue-flow/core';
import type { EdgeProps } from '@vue-flow/core';

const props = defineProps<EdgeProps<{ from: string; to: string; reason: string; loop?: boolean }> & { active: boolean; lit: boolean }>();
const emit = defineEmits<{ inspect: [] }>();
const line = computed(() => {
  const { sourceX: x, sourceY: y, targetX: tx, targetY: ty } = props;
  const bezier = () => getBezierPath({ sourceX: x, sourceY: y, targetX: tx, targetY: ty,
    sourcePosition: props.sourcePosition, targetPosition: props.targetPosition })[0];
  if (props.source === props.target) {
    return `M ${x},${y} C ${x + 56},${y} ${x + 42},${ty - 56} ${tx + 34},${ty - 42} Q ${tx},${ty - 42} ${tx},${ty}`;
  }

  const gap = tx - x;
  if (gap < 0) {
    // Go around the two cards when the destination's input sits behind the output.
    const lane = Math.min(y, ty) - props.sourceNode.dimensions.height / 2 - 23;
    return `M ${x},${y} C ${x + 55},${y} ${x + 55},${lane} ${x},${lane} H ${tx} C ${tx - 55},${lane} ${tx - 55},${ty} ${tx},${ty}`;
  }
  if (gap > 300) {
    // Cross intermediate columns in the gutter and turn only beside the cards.
    const side = y > ty ? 1 : -1;
    const lane = (props.data.loop ? y : ty) + side * (props.sourceNode.dimensions.height / 2 + 15);
    return `M ${x},${y} C ${x + 42},${y} ${x + 25},${lane} ${x + 64},${lane} H ${tx - 64} C ${tx - 25},${lane} ${tx - 42},${ty} ${tx},${ty}`;
  }
  if (props.data.loop) return bezier();
  const rise = Math.min(17, gap * .13) * Math.max(0, 1 - Math.abs(ty - y) / 48);
  if (!rise) return bezier();
  // An ordinary horizontal-tangent Bézier collapses to a line for same-row files.
  const mid = x + gap / 2, crest = (y + ty) / 2 - rise;
  return `M ${x},${y} C ${x + gap / 4},${y} ${mid - gap / 4},${crest} ${mid},${crest} S ${tx - gap / 4},${ty} ${tx},${ty}`;
});
</script>

<template>
  <g class="edge-ink" :class="{ 'edge-lit': lit, 'inspect-edge': !data.loop, 'inspected-edge': active }" :tabindex="data.loop ? undefined : 0"
    :role="data.loop ? undefined : 'button'" :aria-label="data.loop ? undefined : data.from + ' → ' + data.to"
    :aria-pressed="data.loop ? undefined : active" @click="!data.loop && emit('inspect')"
    @keydown.enter.prevent="!data.loop && emit('inspect')" @keydown.space.prevent="!data.loop && emit('inspect')">
    <title>{{ data.reason }}</title>
    <BaseEdge :id="id" :path="line" :marker-end="markerEnd" :style="style" />
  </g>
</template>
