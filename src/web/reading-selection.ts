import { onMounted, onUnmounted, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';

export function useReadingSelection(root: Ref<HTMLElement | undefined>, active: () => boolean, identity: () => unknown) {
  const selected = shallowRef<{ element: HTMLElement; text: string }>();
  const anchor = shallowRef<{ x: number; y: number }>();
  const pane = () => root.value?.closest<HTMLElement>('.reading-pane, .canvas-inspector');
  let selecting = false;
  function clearSelection() {
    selected.value = undefined;
    anchor.value = undefined;
  }

  function captureSelection(point?: { x: number; y: number }, reposition = false) {
    if (!active() || selecting ||
        document.activeElement?.closest('.selection-copy-panel .location-copy-manual')) return;
    const selection = window.getSelection();
    if (selection?.rangeCount !== 1 || selection.isCollapsed || !selection.focusNode) {
      clearSelection();
      return;
    }
    const range = selection.getRangeAt(0);
    const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    const explanation = start?.closest<HTMLElement>('[data-quote-field]');
    const text = selection.toString();
    if (!explanation || !root.value?.contains(explanation) || !explanation.contains(range.endContainer) || !text.trim()) {
      clearSelection();
      return;
    }
    if (!point && !reposition && selected.value?.element === explanation && selected.value.text === text) return;
    selected.value = { element: explanation, text };
    const caret = document.createRange();
    caret.setStart(selection.focusNode, selection.focusOffset);
    caret.collapse(true);
    let edge = caret.getBoundingClientRect();
    // A selection ending at an element boundary can have a zero-sized caret (touch/select-all).
    if (!edge.height) {
      const boxes = range.getClientRects();
      const backwards = selection.focusNode === range.startContainer && selection.focusOffset === range.startOffset;
      edge = boxes[backwards ? 0 : boxes.length - 1] ?? edge;
    }
    const frame = pane()?.getBoundingClientRect();
    anchor.value = point ?? (frame && edge.bottom >= frame.top && edge.top <= frame.bottom
      ? { x: edge.left, y: edge.bottom } : undefined);
  }

  function selectionChanged() {
    captureSelection();
  }

  function selectionStarted(event: PointerEvent) {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    if (event.target.closest('.selection-copy-panel')) return;
    selecting = active() && !!event.target.closest('[data-quote-field]') && !!root.value?.contains(event.target);
    anchor.value = undefined;
  }

  function selectionFinished(event: PointerEvent) {
    if (!selecting) return;
    selecting = false;
    captureSelection({ x: event.clientX, y: event.clientY });
  }

  function selectionCanceled() {
    selecting = false;
  }

  function followSelection() {
    if (anchor.value) captureSelection(undefined, true);
  }

  function selectionKeys(event: KeyboardEvent) {
    const button = root.value?.querySelector<HTMLButtonElement>('.selection-copy-action');
    if (!button || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      if (document.activeElement?.closest('.selection-copy-panel')) {
        pane()?.focus({ preventScroll: true });
      }
      anchor.value = undefined;
    } else if (event.key === 'Tab' && !event.shiftKey && startsInSelection(event.target, button)) {
      event.preventDefault();
      button.focus({ preventScroll: true });
    }
  }

  function startsInSelection(target: EventTarget | null, button: HTMLButtonElement) {
    if (target === document.body || target === pane()) return true;
    return target instanceof Element && (selected.value?.element.contains(target) ||
      target === button.closest('.document-block, .loop-step') || target.matches('.loop-step-heading'));
  }
  watch([active, identity], () => {
    const selection = window.getSelection();
    if (selected.value?.element.contains(selection?.anchorNode ?? null)) selection?.removeAllRanges();
    selecting = false;
    clearSelection();
  }, { flush: 'sync' });
  onMounted(() => {
    document.addEventListener('scroll', followSelection, true);
    window.addEventListener('resize', followSelection);
    document.addEventListener('selectionchange', selectionChanged);
    document.addEventListener('pointerdown', selectionStarted);
    document.addEventListener('pointerup', selectionFinished);
    document.addEventListener('pointercancel', selectionCanceled);
    document.addEventListener('keydown', selectionKeys);
  });
  onUnmounted(() => {
    document.removeEventListener('scroll', followSelection, true);
    window.removeEventListener('resize', followSelection);
    document.removeEventListener('selectionchange', selectionChanged);
    document.removeEventListener('pointerdown', selectionStarted);
    document.removeEventListener('pointerup', selectionFinished);
    document.removeEventListener('pointercancel', selectionCanceled);
    document.removeEventListener('keydown', selectionKeys);
  });
  return { selected, anchor, clearSelection };
}
