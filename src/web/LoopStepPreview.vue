<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { renderMarkdown } from './markdown.js';
import { translate, type Language } from './i18n.js';

const props = defineProps<{ stepId: string; explanation: string; language: Language; leaving: boolean; id: string }>();
const emit = defineEmits<{ placed: [visible: boolean] }>();
const html = computed(() => renderMarkdown(props.explanation));
const root = ref<HTMLElement>(), body = ref<HTMLElement>();
const clipped = ref(false);
let cleanup: (() => void) | undefined;

onMounted(() => {
  const bubble = root.value!, content = body.value!;
  const card = bubble.previousElementSibling as HTMLButtonElement;
  const area = card.closest('.graph-area')!, workspace = area.closest('.canvas-workspace')!;
  // Screen-space dimensions keep the type size constant through canvas zoom.
  const selector = '.canvas-rail, .canvas-dock, .loop-canvas-heading > *, .loop-relations, .loop-reader-toggle, ' +
    '.loop-annotation.expanded, .canvas-workspace:not(.reader-stowed) .canvas-inspector, .canvas-tools[open] .canvas-tools-menu, .example-panel:popover-open, .switch-directions button, .loop-source-panel';
  let frame = 0, displayed = false;
  const resize = new ResizeObserver(schedule);
  function schedule() { if (!frame) frame = requestAnimationFrame(place); }
  function place() {
    frame = 0;
    const bounds = area.getBoundingClientRect(), anchor = card.getBoundingClientRect();
    const left = Math.max(0, bounds.left) + 5, right = Math.min(innerWidth, bounds.right) - 5;
    const bottom = anchor.top - 10, top = Math.max(0, bounds.top) + 5;
    const center = (anchor.left + anchor.right) / 2;
    const obstacles = [...workspace.querySelectorAll(selector)].map(el => el.getBoundingClientRect())
      .filter(r => r.width && r.height && r.bottom > top && r.top < anchor.top);
    let best: { x: number; width: number; height: number; tail: number; score: number } | undefined;
    if (anchor.bottom > top && anchor.top < Math.min(bounds.bottom, innerHeight)) {
      for (const width of [326, 266, 206].map(w => Math.min(w, right - left))) {
        if (width < 160) continue;
        const ideal = center - width / 2;
        const positions = [ideal, left, right - width, ...obstacles.flatMap(r => [r.left - width - 4, r.right + 4])];
        for (const pos of positions) {
          const x = Math.max(left, Math.min(right - width, pos));
          const tailLeft = Math.max(anchor.left + 3, x + 15), tailRight = Math.min(anchor.right - 3, x + width - 15);
          if (tailRight < tailLeft) continue;
          const tail = Math.max(tailLeft, Math.min(tailRight, center));
          const roof = obstacles.reduce((y, r) => r.left < x + width && r.right > x ? Math.max(y, r.bottom + 4) : y, top);
          const height = Math.min(214, Math.floor(bottom - roof));
          if (height < 62) continue;
          const score = Math.min(height, Math.max(88, content.scrollHeight + 24)) * width - Math.abs(ideal - x);
          if (!best || score > best.score) best = { x, width, height, tail, score };
        }
      }
    }
    if (best) {
      bubble.style.left = best.x + 'px';
      bubble.style.top = anchor.top + 'px';
      bubble.style.width = best.width + 'px';
      bubble.style.setProperty('--preview-height', best.height + 'px');
      bubble.style.setProperty('--preview-tail', (best.tail - best.x) + 'px');
      if (!bubble.matches(':popover-open')) bubble.showPopover();
      // Measure against the full allowance, before reserving the continuation line.
      clipped.value = content.scrollHeight > best.height - 22;
    } else if (bubble.matches(':popover-open')) bubble.hidePopover();
    if (displayed !== !!best) { displayed = !!best; emit('placed', displayed); }
  }
  resize.observe(area);
  resize.observe(content);
  for (const el of workspace.querySelectorAll(selector)) resize.observe(el);
  const mutations = new MutationObserver(entries => {
    if (entries.some(e => !bubble.contains(e.target))) schedule();
  });
  mutations.observe(workspace, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'open'] });
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  place();
  cleanup = () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
  };
});
onUnmounted(() => { cleanup?.(); emit('placed', false); });
</script>

<template>
  <div :id="id" ref="root" popover="manual" class="loop-step-preview nodrag nopan nowheel" :data-preview-for="stepId"
    :class="{ leaving, clipped }" role="region" :aria-label="translate(language, 'loopStepExplanation')"
    @pointerdown.stop @mousedown.stop @click.stop @dblclick.stop @wheel.stop>
    <div class="preview-motion">
      <div class="preview-paper">
        <div ref="body" class="preview-body"><div class="markdown" v-html="html"></div></div>
        <small v-if="clipped">{{ translate(language, 'loopPreviewMore') }}</small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loop-step-preview {
  position: fixed; inset: auto; margin: 0; padding: 0; border: 0; overflow: visible;
  background: transparent; color: var(--text); transform: translateY(-100%); text-align: start;
  cursor: auto; user-select: text;
}
.preview-motion { position: relative; padding-bottom: 10px; filter: drop-shadow(0 3px 7px color-mix(in srgb, var(--shadow-ink) 15%, transparent)); }
.preview-motion::after {
  content: ''; position: absolute; bottom: 2px; left: calc(var(--preview-tail) - 8px);
  border: 8px solid transparent; border-top-color: var(--paper); border-bottom: 0;
}
.preview-paper {
  position: relative; overflow: hidden; color: var(--text); background: var(--paper); padding: 11px 15px;
  --corner-size: var(--corner-control); border-radius: calc(var(--corner-size) * var(--corner-radius-scale)); corner-shape: squircle;
}
.preview-paper::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--action); }
.preview-body { overflow: auto; overscroll-behavior: contain; max-height: calc(var(--preview-height) - 22px); }
.clipped .preview-body { max-height: calc(var(--preview-height) - 42px); }
.preview-body .markdown { font-size: 15px; line-height: 1.55; }
.preview-body :deep(.markdown > *) { margin-block: 0 6px; }
.preview-body :deep(.markdown > :last-child) { margin-bottom: 0; }
.preview-body :deep(.markdown pre) { padding: 8px; }
.preview-paper small { display: block; padding-top: 4px; color: var(--secondary); font-size: 12px; line-height: 16px; }
@media (prefers-reduced-motion: no-preference) {
  .preview-motion { transition: opacity 150ms ease-out, transform 150ms ease-out; }
  .leaving .preview-motion { opacity: 0; transform: translateY(3px); transition: opacity 100ms ease-in, transform 100ms ease-in; }
  @starting-style { .loop-step-preview:popover-open .preview-motion { opacity: 0; transform: translateY(3px); } }
}
</style>
