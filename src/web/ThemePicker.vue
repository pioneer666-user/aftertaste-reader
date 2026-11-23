<script setup lang="ts">
import { ref } from 'vue';
import { selectTheme, theme, themes } from './theme.js';
import type { Theme } from './theme.js';
import { translate, type Language } from './i18n.js';

const props = defineProps<{ language: Language }>();
const emit = defineEmits<{ selected: [saved: boolean] }>();
const t = (key: string) => translate(props.language, key);
const trigger = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();

function place(event: ToggleEvent) {
  if (event.newState === 'open' && menu.value && trigger.value) {
    menu.value.style.top = trigger.value.getBoundingClientRect().bottom + 4 + 'px';
  }
}
function focusCurrent(event: ToggleEvent) {
  if (event.newState === 'open') menu.value?.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus({ preventScroll: true });
}
function close() {
  menu.value?.hidePopover();
  trigger.value?.focus({ preventScroll: true });
}
function choose(value: Theme) {
  emit('selected', selectTheme(value));
  close();
}
function move(event: KeyboardEvent) {
  const buttons = Array.from(menu.value!.querySelectorAll('button'));
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = { ArrowDown: (index + 1) % buttons.length, ArrowUp: (index + buttons.length - 1) % buttons.length,
    Home: 0, End: buttons.length - 1 }[event.key];
  if (next !== undefined) {
    event.preventDefault();
    buttons[next]?.focus();
  }
}
</script>

<template>
  <div class="theme-picker" @pointerdown.stop @mousedown.prevent>
    <button type="button" ref="trigger" popovertarget="reader-theme-menu">{{ t('theme') }}</button>
    <div ref="menu" id="reader-theme-menu" popover="auto" :aria-label="t('theme')" role="group"
      @beforetoggle="place" @toggle="focusCurrent"
      @keydown="move" @keydown.esc.stop.prevent="close">
      <button v-for="value in themes" :key="value" :data-theme-choice="value" :aria-pressed="value === theme"
        type="button" @click="choose(value)"><span aria-hidden="true">{{ value === theme ? '✓' : '' }}</span>{{ t('theme-' + value) }}</button>
    </div>
  </div>
</template>

<style scoped>
.theme-picker { flex: none; }
#reader-theme-menu {
  position: fixed; inset: auto 8px auto auto; margin: 0; padding: 4px; min-width: 9rem;
  max-height: 70dvh; overflow: auto; background: var(--panel); color: var(--text);
  border: 1px solid var(--control-rim); border-radius: var(--corner-control);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--shadow-ink) 16%, transparent);
}
#reader-theme-menu button { display: flex; align-items: center; gap: 6px; width: 100%; border-color: transparent; text-align: start; background: transparent; }
#reader-theme-menu button span { width: 1em; }
#reader-theme-menu [aria-pressed="true"] { color: var(--action); background: var(--current); font-weight: 600; }
#reader-theme-menu button:hover { background: var(--hover); }
@media (pointer: coarse) { .theme-picker button { min-height: 44px; } }
</style>
