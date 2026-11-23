<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ReadingLoop } from '../application/loops.js';
import { translate, type Language } from './i18n.js';

const props = defineProps<{ loop: ReadingLoop['loop']; selected: string; language: Language; panelOpen: boolean }>();
const emit = defineEmits<{ select: [id: string]; toggle: [] }>();
const t = (key: string) => translate(props.language, key);
const disclosure = ref<HTMLButtonElement>();
const titles = computed(() => new Map(props.loop.nodes.map(node => [node.id, node.title])));
const sides = computed(() => [
  { label: 'loopFrom', empty: 'loopOrigin', items: props.loop.edges.filter(e => e.to === props.selected).map(e => ({ id: e.from, reason: e.reason })) },
  { label: 'loopTo', empty: 'loopTerminal', items: props.loop.edges.filter(e => e.from === props.selected).map(e => ({ id: e.to, reason: e.reason })) },
]);
function follow(id: string) {
  // A selected branch can disappear when the summary changes. Keep keyboard focus on the new summary.
  disclosure.value?.focus({ preventScroll: true });
  emit('select', id);
}

</script>

<template>
  <section class="canvas-panel canvas-panel-compact loop-relations" :aria-label="t('loopConnections')">
    <div v-for="side in sides" :key="side.label" class="loop-relation-side">
      <strong>{{ t(side.label) }}</strong>
      <span v-if="!side.items.length">{{ t(side.empty) }}</span>
      <button v-for="item in side.items.slice(0, 2)" :key="item.id" type="button"
        :data-relation="item.id" :title="titles.get(item.id) + ' · ' + item.reason" @click="follow(item.id)">
        <span>{{ titles.get(item.id) }}</span>
      </button>
    </div>
    <button ref="disclosure" type="button" class="loop-relation-details" :aria-expanded="panelOpen"
      :aria-controls="'loop-canvas-' + loop.id + '-inspector'" @click="emit('toggle')">{{ t(panelOpen ? 'hideLesson' : 'showLesson') }}</button>
  </section>
</template>
