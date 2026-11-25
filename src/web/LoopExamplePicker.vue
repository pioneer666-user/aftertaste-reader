<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SavedLoop } from '../core/loops.js';
import { translate, type Language } from './i18n.js';

const props = defineProps<{ id: string; examples: NonNullable<SavedLoop['examples']>; language: Language; active: boolean }>();
const selected = defineModel<string>({ required: true });
const t = (key: string) => translate(props.language, key);
const trigger = ref<HTMLButtonElement>();
const panel = ref<HTMLElement>();

function close() {
  panel.value?.hidePopover();
  trigger.value?.focus({ preventScroll: true });
}
function choose(name: string) {
  selected.value = name;
  close();
}
function navigate(event: KeyboardEvent) {
  const items = Array.from(panel.value!.querySelectorAll('button'));
  const index = items.indexOf(event.target as HTMLButtonElement);
  const next = { Home: 0, End: items.length - 1, ArrowDown: (index + 1) % items.length,
    ArrowUp: (index + items.length - 1) % items.length }[event.key];
  if (next !== undefined) {
    event.preventDefault();
    items[next]?.focus();
  }
}
watch(() => props.active, active => {
  if (!active && panel.value?.matches(':popover-open')) panel.value.hidePopover();
});
</script>

<template>
  <div class="example-tool">
    <button ref="trigger" type="button" class="example-trigger" :data-active="!!selected || undefined"
      :aria-label="t('exampleRoute')" :aria-description="selected || t('exampleAll')" :popovertarget="id">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 17v-4c0-4 10-2 10-7M6 13c0-3 3-5 3-7" />
        <circle cx="6" cy="19" r="2"/><circle cx="9" cy="4" r="2"/><circle cx="16" cy="4" r="2"/>
      </svg>
      <span aria-hidden="true" class="canvas-tool-label">{{ t('exampleRoute') }}</span>
    </button>
    <div :id="id" ref="panel" popover="auto" class="example-panel" role="group" :aria-label="t('exampleRoute')"
      @keydown="navigate" @keydown.esc.stop.prevent="close">
      <h2>{{ t('exampleRoute') }}</h2>
      <button v-for="item in examples" :key="item.name" type="button" class="example-choice"
        :autofocus="selected === item.name" :aria-pressed="selected === item.name" @click="choose(item.name)">
        <strong>{{ item.name }}</strong><small>{{ item.scenario }}</small>
      </button>
      <button type="button" class="example-choice example-all" :autofocus="!selected" :aria-pressed="!selected" @click="choose('')">
        {{ t('exampleAll') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.example-trigger[data-active], .example-tool:has(:popover-open) .example-trigger {
  color: var(--route-ink); background: var(--current);
}
.example-panel {
  position: fixed; inset: auto; position-area: right; align-self: anchor-center; margin: 0 0 0 12px; box-sizing: border-box; width: min(19.5rem, calc(100vw - 76px));
  max-height: min(26rem, 64dvh); overflow: auto; overscroll-behavior: contain; padding: 6px;
  background: var(--paper); color: var(--text); border: 1px solid var(--divider); border-radius: 12px;
  box-shadow: 0 6px 24px color-mix(in srgb, var(--shadow-ink) 15%, transparent);
}
.example-panel h2 { margin: 5px 10px 7px; font-size: 13px; color: var(--secondary); }
.example-panel .example-choice {
  position: relative; display: block; width: 100%; height: auto; min-height: 34px; padding: 8px 26px 8px 10px;
  justify-items: stretch; border: 0; border-radius: 7px; text-align: start; color: var(--text); overflow-wrap: anywhere;
}
.example-choice strong, .example-choice small { display: block; }
.example-choice small { margin-top: 3px; font-size: 12px; line-height: 1.5; color: var(--secondary); }
.example-panel .example-choice[aria-pressed=true] { background: var(--current); }
.example-choice[aria-pressed=true]::after { content: '✓'; position: absolute; top: 8px; right: 10px; color: var(--action); }
.example-panel .example-choice:focus-visible { outline-offset: -2px; }
.example-panel .example-all { margin-top: 5px; border-top: 1px solid var(--divider); border-radius: 0 0 6px 6px; }
</style>
