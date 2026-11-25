import { computed, ref, watch } from 'vue';

// The card and its preview share an owner across pointer and keyboard transitions.
export function useStepPreview(enabled: () => boolean, visible: (id: string) => boolean) {
  const pointed = ref(''), focused = ref(''), dismissed = ref('');
  const owner = ref(''), leaving = ref(false), keyboardFirst = ref(false);
  const wanted = computed(() => {
    const preferFocus = keyboardFirst.value || document.activeElement?.closest('.loop-step-preview');
    const id = preferFocus && focused.value ? focused.value : pointed.value || focused.value;
    return enabled() && id !== dismissed.value && visible(id) ? id : '';
  });
  function step(target: EventTarget | null) {
    return target instanceof Element ? target.closest<HTMLElement>('[data-step], [data-preview-for]')?.dataset : undefined;
  }
  function idOf(target: EventTarget | null) {
    const data = step(target);
    return data?.step ?? data?.previewFor ?? '';
  }
  function point(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    if (owner.value && document.activeElement?.matches('[data-step]') && idOf(document.activeElement) === owner.value) focused.value = owner.value;
    const next = idOf(event.type === 'pointerout' ? event.relatedTarget : event.target);
    if (next && next !== pointed.value) keyboardFirst.value = false;
    pointed.value = next;
    if (dismissed.value !== pointed.value && dismissed.value !== focused.value) dismissed.value = '';
  }
  function focus(event: FocusEvent) {
    const target = event.target;
    focused.value = target instanceof Element && (target.matches(':focus-visible') || idOf(target) === owner.value || target.closest('.loop-step-preview'))
      ? idOf(target) : '';
    keyboardFirst.value = target instanceof Element && target.matches(':focus-visible');
    if (focused.value && focused.value !== dismissed.value) dismissed.value = '';
  }
  function blur(event: FocusEvent) {
    focused.value = idOf(event.relatedTarget);
    if (dismissed.value !== pointed.value && dismissed.value !== focused.value) dismissed.value = '';
  }
  function reset() {
    dismissed.value = pointed.value || focused.value;
    pointed.value = focused.value = owner.value = '';
    leaving.value = false;
  }
  function escape(event: KeyboardEvent, area: HTMLElement | undefined) {
    if (event.key !== 'Escape' || (!owner.value && !wanted.value)) return;
    const id = wanted.value || owner.value;
    dismissed.value = id;
    if (document.activeElement?.closest('.loop-step-preview')) {
      area?.querySelector<HTMLButtonElement>('[data-step="' + CSS.escape(id) + '"]')?.focus({ preventScroll: true });
    }
    event.preventDefault();
    event.stopPropagation();
  }

  watch([wanted, focused], ([id], _, onCleanup) => {
    let openTimer: number | undefined, closeTimer: number | undefined;
    onCleanup(() => { window.clearTimeout(openTimer); window.clearTimeout(closeTimer); });
    if (owner.value && (!enabled() || !visible(owner.value))) { reset(); return; }
    if (id === owner.value) { leaving.value = false; return; }
    if (id && id === focused.value) { leaving.value = false; owner.value = id; return; }
    if (owner.value) {
      leaving.value = true;
      closeTimer = window.setTimeout(() => { owner.value = ''; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 100);
    }
    if (id) openTimer = window.setTimeout(() => { leaving.value = false; owner.value = id; }, 350);
  }, { flush: 'post' });
  watch(enabled, ok => { if (!ok) reset(); }, { flush: 'sync' });
  return { owner, leaving, point, focus, blur, escape };
}
