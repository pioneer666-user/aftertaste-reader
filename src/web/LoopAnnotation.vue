<script setup lang="ts">
import { computed, ref, watchPostEffect } from 'vue';
import type { CardBounds } from '../core/canvas-routing.js';
import type { SavedNode } from '../core/loops.js';
import { translate, type Language } from './i18n.js';
import { renderMarkdown } from './markdown.js';

const props = defineProps<{ step: SavedNode; language: Language; open: boolean; raised: boolean; paneWidth: number }>();
const emit = defineEmits<{ toggle: [open: boolean]; read: [source: boolean]; bounds: [offset: CardBounds | undefined] }>();
const t = (key: string) => translate(props.language, key);
const attachment = ref<HTMLElement>();
const body = ref<HTMLElement>();
const clipped = ref(false);
const html = computed(() => renderMarkdown(props.step.annotation ?? ''));
watchPostEffect(onCleanup => {
  const element = body.value;
  if (!element) return;
  const measure = () => { clipped.value = element.scrollHeight > element.clientHeight + 1; };
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  if (element.firstElementChild) observer.observe(element.firstElementChild);
  onCleanup(() => observer.disconnect());
});
// Local offsets keep label clearance attached to a dragged card at any viewport scale.
watchPostEffect(onCleanup => {
  const note = attachment.value;
  if (!note) return;
  const measure = () => emit('bounds', { x: note.offsetLeft, y: note.offsetTop, width: note.offsetWidth, height: note.offsetHeight });
  const resize = new ResizeObserver(measure);
  resize.observe(note);
  const move = new MutationObserver(measure);
  move.observe(note, { attributes: true, attributeFilter: ['class', 'style'] });
  measure();
  onCleanup(() => { resize.disconnect(); move.disconnect(); emit('bounds', undefined); });
});
// Only an explicitly opened note may need to dodge the edge of a hand-placed view.
watchPostEffect(onCleanup => {
  const note = attachment.value;
  const card = note?.closest<HTMLElement>('.vue-flow__node');
  const area = card?.closest('.graph-area');
  const pane = card?.closest('.vue-flow__transformationpane');
  if (!note || !card || !area || !pane || !props.open || !props.raised) return;
  const paneWidth = props.paneWidth;
  const obstacles = area.closest('.canvas-workspace')!.querySelectorAll('.loop-relations, .canvas-dock');
  const place = () => {
    const anchor = card.getBoundingClientRect(), frame = area.getBoundingClientRect();
    const scale = anchor.width / card.offsetWidth;
    if (!scale) return;
    const right = frame.left + paneWidth;
    if (anchor.right <= frame.left || anchor.left >= right || anchor.bottom <= frame.top || anchor.top >= frame.bottom) {
      note.classList.remove('above');
      note.style.removeProperty('left');
      note.style.removeProperty('--stem-x');
      return;
    }
    const width = note.offsetWidth * scale;
    const left = Math.max(frame.left + 4, Math.min(anchor.left, right - width - 4));
    let bottom = frame.bottom;
    for (const item of obstacles) {
      const obstacle = item.getBoundingClientRect();
      if (obstacle.right > left && obstacle.left < left + width && obstacle.bottom > anchor.bottom) bottom = Math.min(bottom, obstacle.top);
    }
    const above = anchor.bottom + note.offsetHeight * scale > bottom && anchor.top - frame.top > bottom - anchor.bottom;
    note.classList.toggle('above', above);
    note.style.left = (left - anchor.left) / scale + 'px';
    note.style.setProperty('--stem-x', Math.max(8, Math.min(note.offsetWidth - 8, (anchor.left - left) / scale + 13)) + 'px');
  };
  const resize = new ResizeObserver(place);
  for (const el of [note, area, ...obstacles]) resize.observe(el);
  const move = new MutationObserver(place);
  for (const el of [card, pane]) move.observe(el, { attributes: true, attributeFilter: ['style'] });
  place();
  onCleanup(() => {
    resize.disconnect();
    move.disconnect();
    note.classList.remove('above');
    note.style.removeProperty('left');
    note.style.removeProperty('--stem-x');
  });
});
</script>

<template>
  <div ref="attachment" class="loop-annotation nodrag nopan nowheel" :class="{ raised, expanded: open }"
    @pointerdown.stop @mousedown.stop @click.stop @dblclick.stop>
    <div class="annotation-paper">
      <button type="button" class="annotation-summary" :aria-expanded="open" @click="emit('toggle', !open)">
        <span aria-hidden="true">{{ open ? '▾' : '▸' }}</span> {{ t('loopAnnotation') }}
      </button>
      <div v-if="open" class="annotation-content">
        <div ref="body" class="annotation-preview"><div class="markdown" v-html="html"></div></div>
        <button v-if="clipped" type="button" class="annotation-link" @click="emit('read', false)">{{ t('loopReadAnnotation') }} ↗</button>
        <button v-if="step.lines" type="button" class="annotation-link" @click="emit('read', true)">
          {{ t('loopCompareSource') }} · {{ step.path }} · {{ step.lines.start }}–{{ step.lines.end }} {{ t('loopSourceLines') }} ↗
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loop-annotation { position: absolute; top: 100%; left: 0; padding-top: 3px; width: max-content; cursor: auto; }
.loop-annotation.expanded { padding-top: 18px; width: 240px; }
.loop-annotation::before { content: ''; position: absolute; left: var(--stem-x, 13px); top: 0; bottom: calc(100% - 3px); border-left: 1px solid var(--action); }
.loop-annotation.expanded::before { bottom: calc(100% - 18px); }
.loop-annotation.above { top: auto; bottom: 100%; padding: 0 0 18px; }
.loop-annotation.above::before { top: auto; bottom: 0; height: 18px; }
.annotation-paper { color: var(--text); background: var(--paper); border-left: 3px solid var(--action); border-radius: 2px 6px 6px 2px; text-align: left; }
.annotation-summary, .annotation-link { min-height: 24px; border: 0; background: transparent; font: inherit; cursor: pointer; }
.annotation-summary { display: block; padding: 2px 10px; color: var(--secondary); font-size: 12px; line-height: 19px; }
.expanded .annotation-summary { padding-block: 7px; }
.annotation-content { padding: 0 11px 9px; overflow-wrap: anywhere; user-select: text; }
.annotation-preview { max-height: 85px; overflow: hidden; }
.annotation-preview .markdown { font-size: 14px; line-height: 1.5; }
.annotation-preview :deep(.markdown > *) { margin: 0 0 5px; }
.annotation-preview :deep(ul), .annotation-preview :deep(ol) { padding-inline-start: 1.3em; }
.annotation-link { display: block; padding: 2px 0; color: var(--action); font-size: 12px; line-height: 16px; text-align: left; text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
</style>
