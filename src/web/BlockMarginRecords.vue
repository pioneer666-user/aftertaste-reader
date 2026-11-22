<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import type { MarkEdit, ReaderMark } from '../core/understanding-marks.js';
import BlockBookmarks from './BlockBookmarks.vue';
import BlockUnderstandingMark from './BlockUnderstandingMark.vue';
import { markDraftsKey } from './mark-drafts.js';
import { bookmarkDraftsKey } from './bookmark-drafts.js';
import { problemText, translate, type Language } from './i18n.js';

type Kind = 'bookmarks' | 'mark';
const props = defineProps<{
  documentPath: string; blockId: string; label: string; kind: Kind | undefined; language: Language;
  bookmarks: readonly Bookmark[]; activeBookmark: string; bookmarksBusy: boolean;
  saveBookmark: (action: BookmarkAction) => Promise<void>;
  mark: ReaderMark | undefined; activeMark: boolean; marksBusy: boolean; unavailable: boolean;
  saveMark: (edit: MarkEdit) => Promise<void>;
}>();
const emit = defineEmits<{ open: [kind: Kind]; close: [] }>();
const t = (key: string) => translate(props.language, key);
const state = computed(() => props.mark?.status ?? 'unmarked');
const markLabel = computed(() => [t('marginMark'), t(state.value), ...(props.mark?.annotation ? [t('hasAnnotation')] : [])].join(' · '));
const bookmarkLabel = computed(() => t('bookmarks') + (props.bookmarks.length ? ' · ' + props.bookmarks.length : ''));
const key = props.documentPath + '\n' + props.blockId;
const markDrafts = inject(markDraftsKey)!;
const bookmarkDrafts = inject(bookmarkDraftsKey)!;
const failedBookmark = computed(() => Array.from(bookmarkDrafts.get(key)?.entries.values() ?? []).find(draft => draft.problem)?.problem);
const failedMark = computed(() => markDrafts.get(key)?.annotation?.problem || markDrafts.get(key)?.status?.problem);
const rail = ref<HTMLElement>();
const panel = ref<HTMLElement>();
const left = ref(0);
const top = ref(0);
const panelId = 'records-' + props.blockId;

function trigger(kind = props.kind) {
  return rail.value?.querySelector<HTMLButtonElement>(`[data-kind="${kind}"]`);
}
function place() {
  const anchor = trigger()?.getBoundingClientRect();
  if (!anchor || !panel.value) return;
  left.value = Math.max(8, anchor.left - panel.value.offsetWidth - 8);
  const pane = rail.value?.closest('main')?.getBoundingClientRect();
  const block = rail.value?.closest('.document-block')?.getBoundingClientRect();
  if (block && pane && (block.bottom <= pane.top || block.top >= pane.bottom)) return close();
  const readerTop = pane?.top ?? 0;
  top.value = Math.max(readerTop + 4, Math.min(anchor.top, innerHeight - panel.value.offsetHeight - 8));
}
function close(focus = false) {
  if (focus) trigger()?.focus({ preventScroll: true });
  emit('close');
}
function outside(event: PointerEvent) {
  const target = event.target as Node;
  if (!rail.value?.contains(target) && !panel.value?.contains(target)) close();
}
function escape(event: KeyboardEvent) {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault();
    close(true);
  }
}
async function toggle(kind: Kind) {
  if (props.kind === kind) return close(true);
  emit('open', kind);
  await nextTick();
  if (trigger(kind) === document.activeElement) panel.value?.focus({ preventScroll: true });
}

watch(() => props.kind, (kind, _, cleanup) => {
  if (!kind || !panel.value) return;
  place();
  const observer = new ResizeObserver(place);
  observer.observe(panel.value);
  const pane = rail.value?.closest('main');
  pane?.addEventListener('scroll', place, { passive: true });
  window.addEventListener('resize', place);
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', escape);
  cleanup(() => {
    observer.disconnect();
    pane?.removeEventListener('scroll', place);
    window.removeEventListener('resize', place);
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('keydown', escape);
  });
}, { flush: 'post' });
</script>

<template>
  <div class="margin-track">
    <div ref="rail" class="margin-rail">
      <button type="button" data-kind="bookmarks" class="margin-entry block-bookmarks-toggle"
        :class="{ recorded: bookmarks.length || failedBookmark }" :aria-label="bookmarkLabel"
        :aria-controls="panelId" :aria-expanded="kind === 'bookmarks'" @click="toggle('bookmarks')">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.5h10v13l-5-3-5 3z" /></svg>
        <small v-if="bookmarks.length">{{ bookmarks.length }}</small><span class="entry-tip">{{ bookmarkLabel }}</span>
      </button>
      <button type="button" data-kind="mark" class="margin-entry" :data-status="state"
        :class="{ recorded: state !== 'unmarked' || mark?.annotation || failedMark }" :aria-label="markLabel"
        :aria-controls="panelId" :aria-expanded="kind === 'mark'" @click="toggle('mark')">
        <svg v-if="state === 'unmarked' && mark?.annotation" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 4h14v10H8l-4 3v-3H3zM6 7.5h8M6 10.5h5" />
        </svg>
        <span v-else class="state-symbol" aria-hidden="true">{{ state === 'understood' ? '✓' : state === 'not-understood' ? '?' : '○' }}</span>
        <span class="entry-tip">{{ markLabel }}</span>
      </button>
      <span v-if="failedMark && kind !== 'mark'" class="margin-failure" role="alert">{{ problemText(language, failedMark).message }}</span>
      <span v-if="failedBookmark && kind !== 'bookmarks'" class="margin-failure" role="alert">{{ t('bookmarkSaveFailed') }}</span>
    </div>
  </div>
  <section v-show="kind" :id="panelId" ref="panel" class="margin-panel" role="dialog" tabindex="-1"
    :aria-labelledby="panelId + '-title'" :style="{ '--panel-left': left + 'px', '--panel-top': top + 'px' }">
    <header class="margin-heading">
      <div><strong :id="panelId + '-title'">{{ t(kind === 'bookmarks' ? 'bookmarks' : 'marginMark') }}</strong>
        <span :title="label">{{ label }}</span></div>
      <button type="button" :aria-label="t('closeBlockLocation')" @click="close(true)">×</button>
    </header>
    <div class="margin-body">
      <BlockBookmarks v-show="kind === 'bookmarks'" :opened="kind === 'bookmarks'" :document-path="documentPath" :block-id="blockId"
        :bookmarks="bookmarks" :active-bookmark="activeBookmark" :busy="bookmarksBusy" :language="language" :save-bookmark="saveBookmark" />
      <BlockUnderstandingMark v-show="kind === 'mark'" :opened="kind === 'mark'" :document-path="documentPath" :block-id="blockId"
        :mark="mark" :active="activeMark" :language="language" :busy="marksBusy" :unavailable="unavailable" :save-mark="saveMark" />
    </div>
  </section>
</template>

<style>
.document-block { position: relative; --rail-width: 32px; }
.explanation-pane {
  padding-inline-end: max(0px, calc(var(--rail-width) + 6px - var(--reader-gutter)));
  min-height: calc(2 * var(--rail-width));
}
.margin-track {
  position: absolute; inset: 0; max-width: 70ch; margin-inline: auto; padding-block: inherit; pointer-events: none;
}
.comparison > .margin-track { grid-column: 2; margin-inline: 0; }
.margin-rail {
  position: sticky; top: 12px; display: grid; width: var(--rail-width); margin-inline-start: auto;
  transform: translateX(calc(min(var(--rail-width), var(--reader-gutter)) - 4px));
}
@media (max-width: 1050px) {
  .comparison > .margin-track { grid-column: 1; max-width: none; }
  .comparison:has(> .source-pane.is-sticky) > .margin-track { grid-row: 2; padding-block-start: 0; max-width: 70ch; }
  .comparison > .source-pane:not(.is-sticky) { margin-inline-end: max(0px, calc(var(--rail-width) + 6px - var(--reader-gutter))); }
}
.margin-rail .margin-entry { position: relative; pointer-events: auto; width: 100%; min-height: var(--rail-width); padding: 2px; display: grid; place-content: center; color: var(--muted); background: white; border-color: transparent; }
.margin-failure { position: absolute; right: 100%; bottom: 0; width: max-content; max-width: 50vw; padding: 4px 8px; background: white; color: #93352e; font-size: 12px; }
.margin-entry svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 1.6; fill: none; stroke-linejoin: round; }
.margin-entry small { font-size: 10px; line-height: 1; font-variant-numeric: tabular-nums; }
.margin-entry.recorded[data-kind="bookmarks"] svg { fill: #e5eee7; }
.state-symbol { font-size: 19px; font-weight: 650; line-height: 1; color: #69746f; }
[data-status="not-understood"] > .state-symbol { color: #ac3536; }
[data-status="understood"] > .state-symbol { color: #197047; }
.margin-entry:is(:hover,:focus-visible,[aria-expanded="true"]) { background: #edf4ee; border-color: var(--line); }
.entry-tip { display: none; position: absolute; z-index: 2; right: calc(100% + 4px); top: 0; width: max-content; max-width: 65vw; padding: 5px 8px; background: #24362b; color: white; font-size: 12px; border-radius: 5px; }
.margin-entry:not([aria-expanded="true"]):is(:hover,:focus-visible) .entry-tip { display: block; }
@media (hover: hover) and (pointer: fine) {
  .document-block:not(:hover) .margin-entry:not(.recorded,:focus-visible,[aria-expanded="true"]) { opacity: 0; }
}
.margin-panel { position: fixed; z-index: 3; left: var(--panel-left); top: var(--panel-top); display: flex; flex-direction: column; width: min(350px,calc(100vw - 16px)); max-height: min(62dvh,560px); overflow: hidden; background: white; border: 1px solid var(--line); box-shadow: 0 8px 28px #23352b26; border-radius: calc(var(--corner-panel) * var(--corner-radius-scale)); corner-shape: squircle; }
.margin-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px 16px 10px; border-bottom: 1px solid var(--line); }
.margin-heading div { min-width: 0; }
.margin-heading strong, .margin-heading span { display: block; }
.margin-heading span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 12px; margin-top: 3px; }
.margin-heading button { font-size: 19px; min-width: 32px; padding: 0; }
.margin-body { padding: 12px 16px; overflow: auto; overscroll-behavior: contain; }
.margin-body .block-mark { padding: 0; border: 0; }
.margin-body .mark-controls { display: flex; flex-wrap: wrap; gap: 4px; }
.mark-controls button { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; }
.mark-controls [aria-pressed="true"] { background: #edf4ee; border-color: #6a8172; font-weight: 600; }
.margin-body .bookmark-status:empty { display: none; }
@media (pointer: coarse) { .document-block { --rail-width: 44px; } }
@media (max-width: 650px) {
  .margin-panel { inset: auto 8px max(6px,env(safe-area-inset-bottom)); width: auto; max-height: 52dvh; }
}
</style>
