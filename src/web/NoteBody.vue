<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Compartment, EditorState, StateField, Transaction } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, drawSelection, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { noteReferences } from './note-references.js';
import type { NoteReference } from './note-references.js';

const props = defineProps<{ modelValue: string; label: string; inputId?: string; readonly?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const host = ref<HTMLElement>();
let view: EditorView | undefined;
let composing = false;
const settings = new Compartment();

class Quote extends WidgetType {
  constructor(readonly quote: NoteReference, readonly selected: boolean) { super(); }
  eq(other: Quote) { return other.quote.raw === this.quote.raw && other.selected === this.selected; }
  toDOM(editor: EditorView) {
    const chip = document.createElement('span');
    chip.className = this.selected ? 'note-reference selected' : 'note-reference';
    const text = document.createElement('span'), source = document.createElement('small');
    text.textContent = this.quote.label;
    source.textContent = this.quote.source;
    chip.append(text, source);
    chip.addEventListener('mousedown', event => { if (event.button === 0) event.preventDefault(); });
    chip.addEventListener('click', () => {
      const from = editor.posAtDOM(chip);
      editor.dispatch({ selection: { anchor: from, head: from + this.quote.raw.length } });
      editor.focus();
    });
    return chip;
  }
}
function decorations(state: EditorState, references = noteReferences(state.doc.toString())) {
  const { from, to } = state.selection.main;
  const ranges = Decoration.set(references.map(quote => Decoration.replace({
    widget: new Quote(quote, from < quote.to && to > quote.from),
  }).range(quote.from, quote.to)));
  return { references, ranges };
}
const quotes = StateField.define({
  create: decorations,
  update(value, tr) {
    if (tr.docChanged) return decorations(tr.state);
    return tr.selection ? decorations(tr.state, value.references) : value;
  },
  provide: field => [EditorView.decorations.from(field, value => value.ranges),
    EditorView.atomicRanges.of(v => v.state.field(field).ranges)],
});
function attributes() {
  return [EditorState.readOnly.of(!!props.readonly), EditorView.editable.of(!props.readonly),
    EditorView.contentAttributes.of({ 'aria-label': props.label, ...(props.inputId ? { id: props.inputId } : {}) })];
}
function publish() {
  if (view && !composing) {
    const text = view.state.doc.toString();
    if (text !== props.modelValue) emit('update:modelValue', text);
  }
}
onMounted(() => {
  view = new EditorView({ parent: host.value!, doc: props.modelValue, extensions: [
    EditorView.cspNonce.of(document.querySelector<HTMLElement>('meta[name="reader-editor-style"]')?.nonce ?? ''),
    quotes, history(), drawSelection(), keymap.of([...defaultKeymap, ...historyKeymap]), EditorView.lineWrapping,
    settings.of(attributes()), EditorState.lineSeparator.of('\n'),
    EditorView.domEventObservers({
      compositionstart() { composing = true; },
      compositionend() { composing = false; queueMicrotask(publish); },
    }),
    EditorView.updateListener.of(update => { if (update.docChanged) publish(); }),
  ] });
});
watch(() => [props.readonly, props.label], () => view?.dispatch({ effects: settings.reconfigure(attributes()) }));
watch(() => props.modelValue, text => {
  if (!view) return;
  const old = view.state.doc.toString();
  if (old === text) return;
  let from = 0, suffix = 0;
  while (from < old.length && from < text.length && old[from] === text[from]) from++;
  while (suffix < Math.min(old.length, text.length) - from && old.at(-1 - suffix) === text.at(-1 - suffix)) suffix++;
  view.dispatch({ changes: { from, to: old.length - suffix, insert: text.slice(from, text.length - suffix) },
    annotations: Transaction.addToHistory.of(false) });
});
onBeforeUnmount(() => { view?.destroy(); view = undefined; });

defineExpose({
  focus: () => view?.focus(),
  scrollTop: () => view?.scrollDOM.scrollTop ?? 0,
  restoreScroll(top: number) { if (view) view.scrollDOM.scrollTop = top; },
  append(text: string) {
    if (!view || props.readonly) return;
    const end = view.state.doc.length;
    view.dispatch({ changes: { from: end, insert: text }, selection: { anchor: end + text.length },
      scrollIntoView: true, userEvent: 'input' });
    view.focus();
  },
});
</script>
<template><div ref="host" class="note-body-editor"></div></template>
<style>
.note-body-editor { border: 1px solid var(--line); border-radius: 6px; background: var(--paper); }
.note-body-editor:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
.note-body-editor .cm-editor { height: 100%; }
.note-body-editor .cm-editor.cm-focused { outline: none; }
.note-body-editor .cm-editor .cm-cursor { border-left-color: var(--text); }
.note-body-editor .cm-content { caret-color: var(--text); }
.note-body-editor .cm-editor .cm-selectionBackground,
.note-body-editor .cm-editor.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground { background: var(--selection); }
.note-body-editor .cm-scroller { overflow: auto; font: inherit; line-height: 1.65; }
.note-body-editor .cm-content { padding: 8px 6px; }
.note-reference, .markdown a.note-block-link[data-source] { display: inline-block; max-width: 100%; vertical-align: middle; padding: 3px 9px; border-inline-start: 3px solid var(--control-rim); border-radius: 3px; background: var(--current); color: var(--action); overflow-wrap: anywhere; white-space: pre-wrap; }
.note-reference.selected { outline: 2px solid var(--accent); outline-offset: -2px; }
.note-reference small, .markdown a.note-block-link[data-source]::after { display: block; color: var(--secondary); font-size: 11px; }
.markdown a.note-block-link[data-source]::after { content: attr(data-source); }
.note-input .note-body-editor { height: 20rem; }
</style>
