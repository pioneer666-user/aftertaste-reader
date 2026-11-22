<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, reactive, ref, shallowReactive, useTemplateRef, watch } from 'vue';
import type { DocumentEntry, ReaderProblem } from '../application/file-reader.js';
import type { ReadingDocument } from '../application/document-blocks.js';
import type { LoopEntry } from '../application/loop-reader.js';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import type { BlockTarget } from '../core/notes.js';
import type { MarkEdit, ReaderMark, UnderstandingMark } from '../core/understanding-marks.js';
import { bookmarkDraftsKey } from './bookmark-drafts.js';
import type { BlockBookmarkDrafts } from './bookmark-drafts.js';
import { markDraftsKey } from './mark-drafts.js';
import type { MarkDraft } from './mark-drafts.js';
import ReaderDocument from './ReaderDocument.vue';
import ReaderFileTree, { buildFileTree } from './ReaderFileTree.vue';
import ReaderSidebarDivider from './ReaderSidebarDivider.vue';
import RecordWorkbench from './RecordWorkbench.vue';
import ProjectNotes from './ProjectNotes.vue';
import ProjectMarks from './ProjectMarks.vue';
import DependencyCanvas from './DependencyCanvas.vue';
import DependencyDots from './DependencyDots.vue';
import LoopThumbnail from './LoopThumbnail.vue';
import { failed, request } from './reader-api.js';
import { problemText, readLanguage, saveLanguage, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLabel } from './markdown.js';
import { markKey } from '../core/understanding-marks.js';
import type { CanvasPosition } from './canvas-position.js';
import QuickNote from './QuickNote.vue';
import { useNotesEditor } from './notes-editor.js';
import type { NotesPosition } from './notes-editor.js';

const language = ref<Language>(readLanguage());
const t = (key: string) => translate(language.value, key);
const languageStatus = ref('');
const projectRoot = ref('');
const documents = ref<DocumentEntry[]>([]);
const problems = ref<ReaderProblem[]>([]);
const listError = ref<ReaderProblem>();
const readingError = ref<ReaderProblem>();
const result = ref<ReadingDocument>();
const selected = ref('');
const listLoading = ref(true);
const readingLoading = ref(false);
const readingPane = ref<HTMLElement>();
const navigation = ref<HTMLElement>();
const navigationEdge = ref<HTMLElement>();
const treeScroll = ref<HTMLElement>();
const outlineScroll = ref<HTMLElement>();
const navigationButton = ref<HTMLButtonElement>();
const projectInfoButton = ref<HTMLButtonElement>();
const projectInfo = ref<HTMLElement>();
const projectInfoOpen = ref(false);
const fileShare = ref(53);
const navigationMedia = window.matchMedia('(max-width: 850px)');
const narrow = ref(navigationMedia.matches);
const desktopOpen = ref(true);
const desktopPeek = ref(false);
const narrowOpen = ref(false);
const navigationOpen = computed(() => narrow.value ? narrowOpen.value : desktopOpen.value || desktopPeek.value);
const navigationAction = computed(() => desktopPeek.value ? 'pinNavigation' : navigationOpen.value ? 'closeNavigation' : 'openNavigation');
const projectName = computed(() => projectRoot.value.split(/[\\/]/u).filter(Boolean).at(-1) ?? projectRoot.value);
const fileTree = computed(() => buildFileTree(documents.value));
const expandedFolders = reactive(new Set<string>());
const selectedSource = computed(() => documents.value.find(entry => entry.documentPath === selected.value)?.sourcePath ?? '');
const outline = computed(() => result.value?.renderMode === 'comparison' ? result.value.blocks.map((block, index) => ({
  id: block.id, label: blockLabel(block.body), lines: block.lines, number: index + 1,
})) : []);
const activeBlock = ref('');
const canvasOpened = ref(false);
const canvasToolsOpen = ref(true);
type RecordPage = 'notes' | 'bookmarks' | 'marks';
type RecordPosition = { listTop: number; detailTop: number; listOpen: boolean; narrow: boolean };
const recordLists = reactive({ notes: !narrow.value, bookmarks: !narrow.value, marks: !narrow.value });
const listIds = { notes: 'note-navigation', bookmarks: 'bookmark-navigation', marks: 'mark-navigation' };
function isRecordPage(page: Page): page is RecordPage {
  return page === 'notes' || page === 'bookmarks' || page === 'marks';
}
function region(page: RecordPage, part: 'navigation' | 'detail') {
  return document.querySelector<HTMLElement>(`#${page} .record-${part}`);
}
function recordPosition(page: RecordPage): RecordPosition {
  return { listTop: region(page, 'navigation')?.scrollTop ?? 0, detailTop: region(page, 'detail')?.scrollTop ?? 0,
    listOpen: recordLists[page], narrow: narrow.value };
}
async function showDetail(page: RecordPage) {
  if (openingDocument.value || restoring) {
    startNavigation();
    restoring = false;
  }
  if (narrow.value) recordLists[page] = false;
  await nextTick();
  const detail = region(page, 'detail');
  detail?.scrollTo(0, 0);
  detail?.focus({ preventScroll: true });
}
const canvas = useTemplateRef<InstanceType<typeof DependencyCanvas>>('canvas');
const loopCanvases = useTemplateRef<InstanceType<typeof DependencyCanvas>[]>('loop-canvases');
const notes = useTemplateRef<InstanceType<typeof ProjectNotes>>('notes');
const pages = {
  reader: { label: 'files' },
  canvas: { label: 'dependencyCanvas' },
  loops: { label: 'loops' },
  bookmarks: { label: 'bookmarks' },
  marks: { label: 'marks' },
  notes: { label: 'notes' },
};
type Page = keyof typeof pages;
type ReaderPosition = { page: 'reader'; path: string; block: string; top: number; offset: number; bookmark: string; mark: string };
type Position = ReaderPosition | { page: 'canvas'; graph: CanvasPosition | undefined } |
  { page: 'loops'; loop: string; graph: CanvasPosition | undefined; top: number } |
  { page: 'notes'; panes: RecordPosition; note: NotesPosition | undefined; top: number } |
  { page: 'bookmarks'; panes: RecordPosition; item: string; top: number } |
  { page: 'marks'; panes: RecordPosition; item: string; filter: typeof markFilter.value; top: number };
const view = ref<Page>('reader');
const history = shallowReactive<Position[]>([{ page: 'reader', path: '', block: '', top: 0, offset: 0, bookmark: '', mark: '' }]);
const historyIndex = ref(0);
const pageTops: Partial<Record<Page, number>> = {};
const positionNotice = ref('');
let navigationSequence = 0;
let restoring = false;
const openingDocument = ref('');
const fileSwitch = ref<{ source: string; placeholder: boolean }>();
const fileSwitchStatus = computed(() => fileSwitch.value ? t('openingFile') + ' ' + fileSwitch.value.source : '');
const fileSwitchName = computed(() => fileSwitch.value?.source.split('/').at(-1) ?? '');
const fileSwitchFrame = useTemplateRef<HTMLElement>('file-switch-frame');
const fileSwitchGroups = ref(1);
const placeholderCodeLines = [4, 8, 3, 6, 5];
const placeholderProseLines = [7, 5, 8, 4, 6];
let fileSwitchTimer: number | undefined;
watch(fileSwitchFrame, (frame, _, onCleanup) => {
  if (!frame) return;
  // Even the shortest block and its gap take at least 96 CSS px in either column.
  const fill = () => { fileSwitchGroups.value = Math.ceil(frame.clientHeight / 96); };
  fill();
  const resize = new ResizeObserver(fill);
  resize.observe(frame);
  onCleanup(() => resize.disconnect());
}, { flush: 'post' });
const mainId = computed(() => ({ reader: 'reading', canvas: 'canvas-reading',
  loops: selectedLoop.value ? 'loop-canvas-' + selectedLoop.value + '-reading' : catalogOpen.value ? 'loop-navigation' : 'loop-workspace',
  bookmarks: 'bookmarks', marks: 'marks', notes: 'notes' })[view.value]);
const pageMenu = ref<HTMLElement>();
const pageMenuButton = ref<HTMLButtonElement>();
const quickNote = useTemplateRef<InstanceType<typeof QuickNote>>('quick-note');
const loopEntries = ref<LoopEntry[]>([]);
const loopsLoaded = ref(false);
const loopsLoading = ref(false);
const loopProblems = ref<ReaderProblem[]>([]);
const loopListError = ref<ReaderProblem>();
const selectedLoop = ref('');
const openedLoops = ref<string[]>([]);
const bookmarks = ref<Bookmark[]>([]);
const bookmarkDrafts = reactive(new Map<string, BlockBookmarkDrafts>());
provide(bookmarkDraftsKey, bookmarkDrafts);
const bookmarksLoading = ref(false);
const bookmarksSaving = ref(false);
const bookmarkListError = ref<ReaderProblem>();
const unavailableMessage = ref<HTMLElement>();
const unavailableBookmark = ref<Bookmark>();
const readerDocument = ref<InstanceType<typeof ReaderDocument>>();
const activeBookmark = ref('');
const activeMark = ref('');
const bookmarkItem = ref('');
const markItem = ref('');
const currentBookmark = computed(() => bookmarks.value.find(entry => entry.id === bookmarkItem.value));
watch([bookmarks, bookmarkItem], () => {
  if (!currentBookmark.value) bookmarkItem.value = bookmarks.value[0]?.id ?? '';
});
function selectBookmark(bookmark: Bookmark) {
  bookmarkItem.value = bookmark.id;
  unavailableBookmark.value = undefined;
  void showDetail('bookmarks');
}
const visitingBookmark = ref(false);
const markRoute = '/api/understanding-marks';
const marks = ref<ReaderMark[]>([]);
const markFilter = ref<'all' | 'not-understood'>('all');
const marksBusy = ref(false);
const markListError = ref<ReaderProblem>();
const markDrafts = reactive(new Map<string, MarkDraft>());
provide(markDraftsKey, markDrafts);
let listSequence = 0;
let controller: AbortController | undefined;
let handledScrollTop = 0;
let peekTimer: number | undefined;

const catalogOpen = ref(true);
const catalog = ref<HTMLElement>();
const auxiliary = computed(() => {
  if (view.value === 'reader') return { id: 'reader-navigation', open: navigationOpen.value, action: navigationAction.value };
  if (view.value === 'loops') return { id: 'loop-navigation', open: catalogOpen.value,
    action: catalogOpen.value ? 'closeLoopCatalog' : 'openLoopCatalog' };
  if (view.value === 'canvas') return { id: 'dependency-tools', open: canvasToolsOpen.value,
    action: canvasToolsOpen.value ? 'closeCanvasTools' : 'openCanvasTools' };
  if (isRecordPage(view.value)) {
    const page = view.value;
    const labels = { notes: ['closeNoteList', 'openNoteList'], bookmarks: ['closeBookmarks', 'openBookmarks'],
      marks: ['closeMarks', 'openMarks'] } as const;
    return { id: listIds[page], open: recordLists[page], action: labels[page][recordLists[page] ? 0 : 1] };
  }
  return { id: undefined, open: undefined, action: 'noAuxiliaryPanel' };
});

function toggleAuxiliary() {
  if (view.value === 'reader') void setNavigation(desktopPeek.value || !navigationOpen.value);
  if (view.value === 'canvas') canvasToolsOpen.value = !canvasToolsOpen.value;
  if (view.value === 'loops') {
    catalogOpen.value = !catalogOpen.value;
    if (catalogOpen.value) nextTick(() => catalog.value?.focus({ preventScroll: true }));
  }
  const page = view.value;
  if (isRecordPage(page)) {
    recordLists[page] = !recordLists[page];
    nextTick(() => region(page, recordLists[page] ? 'navigation' : 'detail')?.focus({ preventScroll: true }));
  }
}

function expandAncestors(path: string) {
  let end = path.lastIndexOf('/');
  while (end > 0) {
    expandedFolders.add(path.slice(0, end));
    end = path.lastIndexOf('/', end - 1);
  }
}
watch(selectedSource, expandAncestors);

function toggleFolder(path: string) {
  if (expandedFolders.has(path)) expandedFolders.delete(path);
  else expandedFolders.add(path);
}

function revealNavigationItem(scroller: HTMLElement | undefined, selector: string) {
  const item = scroller?.querySelector(selector)?.getBoundingClientRect();
  if (!scroller || !item) return;
  const frame = scroller.getBoundingClientRect();
  if (item.top < frame.top) scroller.scrollTop += item.top - frame.top;
  else if (item.bottom > frame.bottom) scroller.scrollTop += item.bottom - frame.bottom;
}

watch([navigationOpen, selected, view], () => {
  if (navigationOpen.value && view.value === 'reader') {
    revealNavigationItem(treeScroll.value, '[aria-current="page"], [data-current-directory]');
  }
}, { flush: 'post' });
watch([navigationOpen, activeBlock, view], () => {
  if (navigationOpen.value && view.value === 'reader') {
    revealNavigationItem(outlineScroll.value, '[aria-current="location"]');
  }
}, { flush: 'post' });
watch(navigationOpen, open => {
  if (!open) closeProjectInfo();
});
watch(view, current => {
  if (current === 'reader') return;
  closeProjectInfo();
  narrowOpen.value = false;
  closeNavigationPreview();
});

function closeNavigationPreview() {
  window.clearTimeout(peekTimer);
  desktopPeek.value = false;
}

function scheduleNavigationPreview(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.buttons) return;
  window.clearTimeout(peekTimer);
  if (desktopPeek.value) return;
  peekTimer = window.setTimeout(() => { desktopPeek.value = true; }, 180);
}

function holdNavigationPreview(event: PointerEvent) {
  if (event.pointerType === 'mouse' && desktopPeek.value) window.clearTimeout(peekTimer);
}

function schedulePreviewClose() {
  window.clearTimeout(peekTimer);
  if (!desktopPeek.value || projectInfoOpen.value) return;
  peekTimer = window.setTimeout(() => {
    if (!navigation.value?.contains(document.activeElement) && !navigation.value?.matches(':hover') &&
        !navigationEdge.value?.matches(':hover')) {
      desktopPeek.value = false;
    }
  }, 220);
}

function toggleProjectInfo() {
  const panel = projectInfo.value;
  const trigger = projectInfoButton.value;
  if (!panel || !trigger) return;
  if (projectInfoOpen.value) {
    closeProjectInfo(true);
    return;
  }
  const bounds = trigger.getBoundingClientRect();
  panel.style.setProperty('--project-info-x', bounds.left + 'px');
  panel.style.setProperty('--project-info-y', bounds.bottom + 6 + 'px');
  window.clearTimeout(peekTimer);
  projectInfoOpen.value = true;
  panel.showPopover();
  panel.focus({ preventScroll: true });
}

function closeProjectInfo(restoreFocus = false) {
  if (!projectInfoOpen.value) return;
  projectInfoOpen.value = false;
  projectInfo.value?.hidePopover();
  if (restoreFocus) projectInfoButton.value?.focus({ preventScroll: true });
  schedulePreviewClose();
}

function dismissProjectInfoOutside(event: PointerEvent) {
  if (!(event.target instanceof Node) || projectInfo.value?.contains(event.target) ||
      projectInfoButton.value?.contains(event.target)) return;
  closeProjectInfo();
}

function escapeProjectInfo(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || !projectInfoOpen.value) return false;
  event.preventDefault();
  closeProjectInfo(true);
  return true;
}

function dismissSidebar(event: KeyboardEvent) {
  if (!escapeProjectInfo(event)) void setNavigation(false);
}

function dismissNavigationPreview(event: KeyboardEvent) {
  if (escapeProjectInfo(event)) return;
  if (event.key === 'Escape' && desktopPeek.value && !event.defaultPrevented) closeNavigationPreview();
}

function blockElement(id: string) {
  if (!id) return;
  return readingPane.value?.querySelector<HTMLElement>(`.document-block#${CSS.escape(id)}`);
}

function trackReadingPosition() {
  const pane = readingPane.value;
  if (!pane || view.value !== 'reader' || pane.scrollTop === handledScrollTop || !outline.value.length) return;
  handledScrollTop = pane.scrollTop;
  const readingLine = pane.getBoundingClientRect().top + 32;
  const blocks = pane.querySelectorAll<HTMLElement>('.document-block');
  let current = blocks[0];
  for (const block of blocks) {
    if (block.getBoundingClientRect().top > readingLine) break;
    current = block;
  }
  if (pane.scrollTop > 0 && pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1) current = blocks[blocks.length - 1];
  if (current) activeBlock.value = current.id;
}

async function setNavigation(open: boolean) {
  closeNavigationPreview();
  if (narrow.value) {
    narrowOpen.value = open;
    await nextTick();
  } else {
    trackReadingPosition();
    const pane = readingPane.value;
    const block = blockElement(activeBlock.value);
    const before = block?.getBoundingClientRect();
    const previousTop = pane?.scrollTop ?? 0;
    const frameTop = pane?.getBoundingClientRect().top ?? 0;
    desktopOpen.value = open;
    await nextTick();
    if (pane && before && block?.isConnected && previousTop > 0) {
      const after = block.getBoundingClientRect();
      const offset = frameTop - before.top;
      const restored = offset > 0 && before.height ? offset * after.height / before.height : offset;
      pane.scrollTop += after.top + restored - pane.getBoundingClientRect().top;
      handledScrollTop = pane.scrollTop;
    }
  }
  (open ? navigation : navigationButton).value?.focus({ preventScroll: true });
}

async function resizeNavigation(event: MediaQueryListEvent) {
  const focusInSidebar = navigation.value?.contains(document.activeElement);
  const focusInPageMenu = pageMenu.value?.contains(document.activeElement) || document.activeElement === pageMenuButton.value;
  closeProjectInfo();
  narrow.value = event.matches;
  for (const page of ['notes', 'bookmarks', 'marks'] as const) recordLists[page] = !event.matches;
  narrowOpen.value = false;
  closeNavigationPreview();
  await nextTick();
  if (view.value === 'reader' && focusInSidebar && !navigationOpen.value) {
    navigationButton.value?.focus({ preventScroll: true });
  }
  if (focusInPageMenu) {
    const control = narrow.value ? pageMenuButton.value : pageMenu.value?.querySelector<HTMLButtonElement>('[aria-current="page"]');
    control?.focus({ preventScroll: true });
  }
}

let landingBlock: HTMLElement | undefined;
let landingTimer: number | undefined;

function clearLanding() {
  window.clearTimeout(landingTimer);
  landingBlock?.removeAttribute('data-landing');
  landingBlock = undefined;
}

function focusReadingTarget(target: HTMLElement, blockId: string) {
  target.scrollIntoView({ block: 'start', inline: 'nearest' });
  // In a stacked block, a long source listing can put the explanation below the fold.
  const explanation = target.querySelector<HTMLElement>(':scope > .explanation-pane');
  const pane = readingPane.value;
  if (pane && explanation && explanation.getBoundingClientRect().top + 32 > pane.getBoundingClientRect().bottom) {
    explanation.scrollIntoView({ block: 'start', inline: 'nearest' });
  }
  handledScrollTop = pane?.scrollTop ?? 0;
  activeBlock.value = blockId;
  clearLanding();
  if (target.classList.contains('document-block')) {
    landingBlock = target;
    target.setAttribute('data-landing', '');
    landingTimer = window.setTimeout(clearLanding, 1500);
  }
  target.focus({ preventScroll: true });
}

async function jumpToBlock(id: string) {
  const block = blockElement(id);
  if (!block) return;
  narrowOpen.value = false;
  closeNavigationPreview();
  await nextTick();
  if (block.isConnected && view.value === 'reader') focusReadingTarget(block, id);
}

async function readFromTree(path: string, source: string) {
  void openDocument(path, { treeSource: source });
  if (narrow.value || desktopPeek.value) {
    const sequence = navigationSequence;
    narrowOpen.value = false;
    closeNavigationPreview();
    await nextTick();
    if (sequence === navigationSequence) readingPane.value?.focus({ preventScroll: true });
  }
}

async function skipToReading(event: MouseEvent) {
  if (view.value === 'loops') {
    event.preventDefault();
    catalogOpen.value = !selectedLoop.value;
    await nextTick();
    document.getElementById(mainId.value)?.focus({ preventScroll: true });
    return;
  }
  if (view.value !== 'reader' || (!narrowOpen.value && !desktopPeek.value)) return;
  event.preventDefault();
  narrowOpen.value = false;
  closeNavigationPreview();
  await nextTick();
  readingPane.value?.focus({ preventScroll: true });
}

async function loadMarks() {
  try {
    const data = await request<{ marks: ReaderMark[] }>(markRoute);
    marks.value = data.marks;
    markListError.value = undefined;
  } catch (error) { markListError.value = failed(error); }
}

let marksRequest: Promise<void> | undefined;
function refreshMarks() {
  if (marksRequest) return marksRequest;
  if (marksBusy.value) return;
  marksBusy.value = true;
  return marksRequest = loadMarks().finally(() => {
    marksBusy.value = false;
    marksRequest = undefined;
  });
}

async function saveMark(edit: MarkEdit) {
  marksBusy.value = true;
  try {
    const data = await request<{ marks: ReaderMark[] }>(markRoute, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Understanding-Marks': '1' },
      body: JSON.stringify(edit),
    });
    marks.value = data.marks;
  } catch (error) {
    if (failed(error).code === 'MARK_CONFLICT') await loadMarks();
    throw error;
  } finally { marksBusy.value = false; }
}

async function loadBookmarks() {
  try {
    const data = await request<{ bookmarks: Bookmark[] }>('/api/bookmarks');
    bookmarks.value = data.bookmarks;
    bookmarkListError.value = undefined;
  } catch (error) { bookmarkListError.value = failed(error); }
}

let bookmarksRequest: Promise<void> | undefined;
function refreshBookmarks() {
  if (bookmarksRequest) return bookmarksRequest;
  if (bookmarksSaving.value) return;
  bookmarksLoading.value = true;
  return bookmarksRequest = loadBookmarks().finally(() => {
    bookmarksLoading.value = false;
    bookmarksRequest = undefined;
  });
}

async function saveBookmark(action: BookmarkAction) {
  bookmarksSaving.value = true;
  try {
    const data = await request<{ bookmarks: Bookmark[] }>('/api/bookmarks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Bookmarks': '1' },
      body: JSON.stringify(action),
    });
    bookmarks.value = data.bookmarks;
    bookmarkListError.value = undefined;
  } catch (error) {
    if (['BOOKMARK_CONFLICT', 'BOOKMARK_NOT_FOUND'].includes(failed(error).code)) await loadBookmarks();
    throw error;
  } finally { bookmarksSaving.value = false; }
}

function loopCanvas(id: string) {
  return loopCanvases.value?.find(graph => graph.$props.loopId === id);
}

function capturePosition(): Position {
  const top = window.scrollY;
  switch (view.value) {
    case 'canvas': return { page: 'canvas', graph: canvas.value?.capturePosition() };
    case 'loops': return { page: 'loops', top, loop: selectedLoop.value, graph: loopCanvas(selectedLoop.value)?.capturePosition() };
    case 'bookmarks': return { page: 'bookmarks', panes: recordPosition('bookmarks'), top, item: bookmarkItem.value };
    case 'marks': return { page: 'marks', panes: recordPosition('marks'), top, item: markItem.value, filter: markFilter.value };
    case 'notes': return { page: 'notes', panes: recordPosition('notes'), top, note: notes.value?.capturePosition() };
    case 'reader': {
      trackReadingPosition();
      const pane = readingPane.value;
      const block = blockElement(activeBlock.value);
      return { page: 'reader', path: selected.value, block: activeBlock.value,
        top: pane?.scrollTop ?? 0, offset: pane && block ? pane.getBoundingClientRect().top - block.getBoundingClientRect().top : 0,
        bookmark: activeBookmark.value, mark: activeMark.value };
    }
  }
}

function rememberPosition(position = capturePosition()) {
  if (restoring) return;
  history[historyIndex.value] = position;
  if (position.page !== 'reader' && 'top' in position) pageTops[position.page] = position.top;
}

function pushPosition(position: Position) {
  history.splice(historyIndex.value + 1, history.length, position);
  historyIndex.value++;
}

function clearFileSwitch() {
  window.clearTimeout(fileSwitchTimer);
  fileSwitch.value = undefined;
}

function startNavigation() {
  clearLanding();
  controller?.abort();
  clearFileSwitch();
  openingDocument.value = '';
  positionNotice.value = '';
  visitingBookmark.value = false;
  return ++navigationSequence;
}

function navigationProblem(reason: string) {
  positionNotice.value = t('positionUnavailable') + ' ' + reason;
}

function activatePage(page: Page) {
  view.value = page;
  if (page === 'canvas') canvasOpened.value = true;
}

async function stepHistory(step: -1 | 1) {
  const index = historyIndex.value + step;
  const position = history[index];
  if (!position) return;
  rememberPosition();
  const sequence = startNavigation();
  const current = () => sequence === navigationSequence;
  historyIndex.value = index;
  restoring = true;
  readingLoading.value = false;
  if ('panes' in position) recordLists[position.page] = position.panes.listOpen && (!narrow.value || position.panes.narrow);
  activatePage(position.page);
  try { await restorePosition(position, current); }
  finally { if (current()) restoring = false; }
}

async function restorePosition(position: Position, current: () => boolean) {
  switch (position.page) {
    case 'reader': {
      const path = position.path || selected.value || documents.value[0]?.documentPath;
      if (!path) break;
      readingLoading.value = true;
      let data = await readDocument(path);
      if (!current()) return;
      let destination = path;
      if (data.error?.code === 'DOCUMENT_READ_FAILED' && data.error.context.reason === 'ENOENT') {
        const fallback = documents.value.find(entry => entry.documentPath !== path);
        if (fallback) {
          const available = await readDocument(fallback.documentPath);
          if (!current()) return;
          if (!available.error) {
            destination = fallback.documentPath;
            data = available;
            navigationProblem(t('noteDocumentMissing') + ' ' + path);
          }
        }
      }
      setDocument(destination, data, destination === path ? position : undefined);
      await nextTick();
      if (!current()) return;
      const pane = readingPane.value;
      const block = destination === path ? blockElement(position.block) : undefined;
      if (destination !== path) {
        resetReading();
      } else if (block && pane) {
        pane.scrollTop += block.getBoundingClientRect().top + position.offset - pane.getBoundingClientRect().top;
        handledScrollTop = pane.scrollTop;
      } else if (position.block && !data.error) {
        navigationProblem(t('noteBlockMissing') + ' ' + position.block);
        resetReading();
      } else if (pane) {
        pane.scrollTop = data.error ? 0 : position.top;
        handledScrollTop = pane.scrollTop;
      }
      break;
    }
    case 'canvas': {
      await nextTick();
      if (current() && position.graph && !await canvas.value?.restorePosition(position.graph, current) && current()) {
        navigationProblem(t('graphPositionUnavailable'));
      }
      break;
    }
    case 'loops': {
      await refreshLoops();
      if (!current()) return;
      const exists = !!loopListError.value || !position.loop || loopEntries.value.some(loop => loop.id === position.loop);
      showLoop(exists ? position.loop : loopEntries.value[0]?.id ?? '');
      if (!exists) navigationProblem(t('loopPositionUnavailable'));
      await nextTick();
      if (!current()) return;
      if (exists && position.graph && !await loopCanvas(position.loop)?.restorePosition(position.graph, current) && current()) {
        navigationProblem(t('graphPositionUnavailable'));
      }
      break;
    }
    case 'notes':
      if (position.note && !await notes.value?.restorePosition(position.note, current) && current()) {
        navigationProblem(t('recordPositionUnavailable'));
      }
      break;
    case 'bookmarks':
      await refreshBookmarks();
      if (!current()) return;
      bookmarkItem.value = bookmarks.value.some(item => item.id === position.item) ? position.item : '';
      if (position.item && !bookmarkItem.value) navigationProblem(t('recordPositionUnavailable'));
      break;
    case 'marks':
      await refreshMarks();
      if (!current()) return;
      markFilter.value = position.filter;
      markItem.value = marks.value.some(item => markKey(item) === position.item) ? position.item : '';
      if (position.item && !markItem.value) navigationProblem(t('recordPositionUnavailable'));
      break;
  }
  await nextTick();
  if (!current()) return;
  window.scrollTo(0, 'top' in position && position.page !== 'reader' ? position.top : 0);
  if ('panes' in position) {
    region(position.page, 'navigation')?.scrollTo(0, position.panes.listTop);
    region(position.page, 'detail')?.scrollTo(0, position.panes.detailTop);
    if (position.page === 'notes' && position.note) notes.value?.focusReference(position.note);
  }
  const focused = document.activeElement;
  if (focused === document.body || (focused instanceof HTMLButtonElement && focused.disabled)) {
    document.getElementById(mainId.value)?.focus({ preventScroll: true });
  }
}

async function visitBookmark(bookmark: Bookmark) {
  unavailableBookmark.value = undefined;
  bookmarkItem.value = bookmark.id;
  const reason = await openDocument(bookmark.documentPath, { block: bookmark.blockId, bookmark: bookmark.id });
  if (!reason || view.value !== 'bookmarks') return;
  unavailableBookmark.value = bookmark;
  await nextTick();
  if (view.value === 'bookmarks' && narrow.value) { recordLists.bookmarks = false; await nextTick(); }
  if (view.value === 'bookmarks') unavailableMessage.value?.focus({ preventScroll: true });
}

const notesEditor = useNotesEditor();

const visitNoteBlock = (target: BlockTarget) => openDocument(target.documentPath, { block: target.blockId });
function visitMark(target: UnderstandingMark) {
  markItem.value = markKey(target);
  return openDocument(target.documentPath, { block: target.blockId, mark: target.blockId });
}

function positionPageMenu(event: ToggleEvent) {
  if (event.newState !== 'open' || !pageMenu.value || !pageMenuButton.value) return;
  closeProjectInfo();
  const { left, bottom } = pageMenuButton.value.getBoundingClientRect();
  pageMenu.value.style.setProperty('--page-menu-left', `${left}px`);
  pageMenu.value.style.setProperty('--page-menu-top', `${bottom + 4}px`);
}

function openPage(page: Page) {
  if (pageMenu.value?.matches(':popover-open')) pageMenu.value.hidePopover();
  if (page === view.value) {
    if (page === 'bookmarks') void refreshBookmarks();
    if (page === 'marks') void refreshMarks();
    return;
  }
  rememberPosition();
  const sequence = startNavigation();
  restoring = false;
  readingLoading.value = false;
  activatePage(page);
  const position = capturePosition();
  if (position.page !== 'reader' && 'top' in position) position.top = pageTops[page] ?? 0;
  pushPosition(position);
  if (page === 'reader' && !selected.value && documents.value.length) void refreshReading();
  if (page === 'bookmarks') {
    unavailableBookmark.value = undefined;
    void refreshBookmarks();
  }
  if (page === 'marks') void refreshMarks();
  if (page === 'loops' && !loopsLoaded.value) void refreshLoops();
  void nextTick(() => {
    if (sequence !== navigationSequence) return;
    window.scrollTo(0, pageTops[page] ?? 0);
    if (page === 'bookmarks' || page === 'loops' || page === 'marks') {
      document.getElementById(mainId.value)?.focus({ preventScroll: true });
    } else if (narrow.value && (document.activeElement === document.body || pageMenu.value?.contains(document.activeElement))) {
      pageMenuButton.value?.focus({ preventScroll: true });
    }
  });
}

let loopsRequest: Promise<void> | undefined;
function refreshLoops() {
  return loopsRequest ??= loadLoops().finally(() => { loopsRequest = undefined; });
}

async function loadLoops() {
  loopsLoading.value = true;
  loopListError.value = undefined;
  try {
    const data = await request<{ loops: LoopEntry[]; problems: ReaderProblem[] }>('/api/loops');
    loopEntries.value = data.loops;
    loopProblems.value = data.problems;
    loopsLoaded.value = true;
  } catch (error) { loopListError.value = failed(error); }
  finally { loopsLoading.value = false; }
}

async function refreshLoopList() {
  const sequence = navigationSequence;
  await refreshLoops();
  if (sequence === navigationSequence && !restoring && !loopListError.value &&
      !loopEntries.value.some(loop => loop.id === selectedLoop.value)) showLoop('');
}

function showLoop(id: string) {
  if (id && !openedLoops.value.includes(id)) openedLoops.value.push(id);
  selectedLoop.value = id;
  if (!id) catalogOpen.value = true;
}

function closeCatalog() {
  catalogOpen.value = false;
  navigationButton.value?.focus({ preventScroll: true });
}

function leaveCatalogOnTab(event: KeyboardEvent) {
  if (event.shiftKey) return;
  const buttons = catalog.value?.querySelectorAll('button:enabled');
  if (event.target !== (buttons?.item(buttons.length - 1) ?? catalog.value)) return;
  event.preventDefault();
  navigationButton.value?.focus({ preventScroll: true });
}

function catalogEscape(event: KeyboardEvent) {
  if (event.target instanceof Element && event.target.closest('#quick-note')) return;
  if (event.key !== 'Escape' || view.value !== 'loops' || !catalogOpen.value || document.querySelector(':popover-open')) return;
  event.preventDefault();
  event.stopPropagation();
  closeCatalog();
}

function selectLoop(id: string) {
  if (restoring) {
    startNavigation();
    restoring = false;
  }
  showLoop(id);
  closeCatalog();
}

type DocumentData = { result: ReadingDocument; error?: never } | { result?: never; error: ReaderProblem };
async function readDocument(path: string): Promise<DocumentData> {
  controller?.abort();
  controller = new AbortController();
  try {
    return await request<{ result: ReadingDocument }>(`/api/document?path=${encodeURIComponent(path)}`, { signal: controller.signal });
  } catch (error) {
    const problem = failed(error);
    return { error: { ...problem, context: { ...problem.context, documentPath: path } } };
  }
}

function resetReading() {
  if (readingPane.value) readingPane.value.scrollTop = 0;
  handledScrollTop = 0;
}

function setDocument(path: string, data: DocumentData, position?: ReaderPosition) {
  selected.value = path;
  result.value = data.result;
  readingError.value = data.error;
  readingLoading.value = false;
  const block = position?.block;
  const stillExists = outline.value.some(item => item.id === block);
  activeBlock.value = stillExists && block ? block : outline.value[0]?.id ?? '';
  activeBookmark.value = stillExists ? position?.bookmark ?? '' : '';
  activeMark.value = stillExists ? position?.mark ?? '' : '';
}

async function openDocument(path: string, { block = '', bookmark = '', mark = '', treeSource = '' } = {}): Promise<string | undefined> {
  const placeholder = fileSwitch.value?.placeholder ?? false;
  const sequence = startNavigation();
  const origin = view.value;
  const recordOrigin = isRecordPage(origin) ? capturePosition() : undefined;
  openingDocument.value = path;
  if (treeSource && selected.value && selected.value !== path) {
    fileSwitch.value = { source: treeSource, placeholder };
    if (!placeholder) {
      fileSwitchTimer = window.setTimeout(() => {
        if (sequence === navigationSequence && fileSwitch.value) fileSwitch.value.placeholder = true;
      }, 120);
    }
  }
  if (origin === 'bookmarks') visitingBookmark.value = true;
  const data = await readDocument(path);
  if (sequence !== navigationSequence) return;
  const switchSource = fileSwitch.value?.source;
  clearFileSwitch();
  openingDocument.value = '';
  visitingBookmark.value = false;
  if (data.error || (block && (data.result.renderMode !== 'comparison' ||
      !data.result.blocks.some(item => item.id === block) ||
      (bookmark && !bookmarks.value.some(item => item.id === bookmark))))) {
    const invalidBlocks = data.result && data.result.renderMode !== 'comparison';
    const problem = data.error ?? (invalidBlocks
      ? data.result.sourceError ?? data.result.diagnostics.find(item => item.severity === 'error') : undefined);
    let reason = t(invalidBlocks ? 'noteDocumentInvalid' : 'noteBlockMissing');
    if (data.error?.code === 'DOCUMENT_READ_FAILED' && data.error.context.reason === 'ENOENT') reason = t('noteDocumentMissing');
    else if (data.error) reason = problemText(language.value, data.error).message;
    else if (problem) reason += ' ' + problemText(language.value, problem).message;
    const message = `${reason} ${path}${block ? ' · ' + block : ''}`;
    if (switchSource) {
      const detail = problem ? problemText(language.value, problem).nextStep : '';
      positionNotice.value = `${t('fileOpenFailed')} ${switchSource} · ${reason} ${detail}`.trimEnd();
    } else if (origin === 'reader' || origin === 'canvas') {
      navigationProblem(message + (problem ? ' ' + problemText(language.value, problem).nextStep : ''));
    }
    restoring = false;
    readingLoading.value = false;
    return message;
  }
  const duplicate = origin === 'reader' && selected.value === path && (!block || activeBlock.value === block);
  rememberPosition(recordOrigin);
  restoring = false;
  activatePage('reader');
  setDocument(path, data);
  activeBookmark.value = bookmark;
  activeMark.value = mark;
  if (!duplicate) pushPosition(capturePosition());
  await nextTick();
  if (sequence !== navigationSequence) return;
  const target = blockElement(block);
  if (target) {
    focusReadingTarget(target, block);
    if (bookmark || mark) {
      const key = markKey({ documentPath: path, blockId: block });
      const group = bookmarkDrafts.get(key);
      if (bookmark && group) group.selected = '';
      const annotation = markDrafts.get(key)?.annotation;
      if (mark && annotation) annotation.showSaved = true;
      readerDocument.value?.showRecord(block, bookmark ? 'bookmarks' : 'mark');
      await nextTick();
      if (sequence !== navigationSequence) return;
      const row = document.getElementById(bookmark ? `bookmark-${bookmark}` : `mark-${mark}`);
      row?.focus({ preventScroll: true });
      const scroller = row?.closest('.margin-body');
      if (row && scroller) scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    }
  } else {
    resetReading();
    if (origin !== 'reader' || narrow.value) readingPane.value?.focus({ preventScroll: true });
  }
}

async function refresh() {
  const sequence = ++listSequence;
  const navigationAtRequest = navigationSequence;
  listLoading.value = true;
  listError.value = undefined;
  try {
    const data = await request<{ projectRoot: string; documents: DocumentEntry[]; problems: ReaderProblem[] }>('/api/documents');
    if (sequence !== listSequence) return;
    projectRoot.value = data.projectRoot;
    documents.value = data.documents;
    problems.value = data.problems;
    if (view.value === 'reader' && !restoring && !openingDocument.value &&
        (navigationAtRequest === navigationSequence || !selected.value)) await refreshReading();
  } catch (error) {
    if (sequence === listSequence) listError.value = failed(error);
  } finally { if (sequence === listSequence) listLoading.value = false; }
}

async function refreshReading() {
  const current = documents.value.find(entry => entry.documentPath === selected.value) ?? documents.value[0];
  if (!current) {
    selected.value = '';
    result.value = undefined;
    readingError.value = undefined;
    readingLoading.value = false;
    return;
  }
  const sequence = navigationSequence;
  readingLoading.value = true;
  const loading = readDocument(current.documentPath);
  const read = controller;
  const data = await loading;
  if (sequence !== navigationSequence || read !== controller || read?.signal.aborted) return;
  setDocument(current.documentPath, data);
  await nextTick();
  if (sequence === navigationSequence) resetReading();
}

async function changeLanguage(event: Event) {
  const top = readingPane.value?.scrollTop ?? 0;
  language.value = (event.target as HTMLSelectElement).value === 'en' ? 'en' : 'zh-CN';
  languageStatus.value = saveLanguage(language.value) ? 'saved' : 'unsaved';
  document.documentElement.lang = language.value;
  document.title = `${t('brand')} · ${t('title')}`;
  await nextTick();
  readingPane.value?.scrollTo({ top });
  handledScrollTop = readingPane.value?.scrollTop ?? 0;
}

onMounted(() => {
  navigationMedia.addEventListener('change', resizeNavigation);
  document.addEventListener('keydown', catalogEscape, true);
  document.addEventListener('keydown', dismissNavigationPreview);
  document.addEventListener('pointerdown', dismissProjectInfoOutside);
  document.documentElement.lang = language.value;
  document.title = `${t('brand')} · ${t('title')}`;
  void refresh();
  void refreshBookmarks();
  void refreshMarks();
});
onUnmounted(() => {
  clearLanding();
  navigationMedia.removeEventListener('change', resizeNavigation);
  document.removeEventListener('keydown', catalogEscape, true);
  document.removeEventListener('keydown', dismissNavigationPreview);
  document.removeEventListener('pointerdown', dismissProjectInfoOutside);
  closeNavigationPreview();
  startNavigation();
});
</script>

<template>
  <a :href="'#' + mainId"
    class="skip-link" @click="skipToReading">{{ t('skip') }}</a>
  <header class="app-header">
    <div class="app-header-start">
      <button type="button" class="history-arrow" data-history="back"
        :aria-label="t('historyBack')" :title="t('historyBack')" :disabled="historyIndex === 0" @click="stepHistory(-1)">
        <span aria-hidden="true"></span>
      </button>
      <button type="button" class="history-arrow" data-history="forward"
        :aria-label="t('historyForward')" :title="t('historyForward')" :disabled="historyIndex === history.length - 1" @click="stepHistory(1)">
        <span aria-hidden="true"></span>
      </button>
      <button ref="navigationButton" type="button" class="reader-navigation-toggle"
        :class="{ 'navigation-pinned': view === 'reader' ? (narrow ? narrowOpen : desktopOpen) : auxiliary.open }"
        :aria-label="t(auxiliary.action)" :title="t(auxiliary.action)"
        :aria-expanded="auxiliary.open" :aria-controls="auxiliary.id" :disabled="!auxiliary.id"
        @click="toggleAuxiliary">
        <span class="sidebar-icon" aria-hidden="true"></span>
      </button>
      <nav class="app-page-navigation" :aria-label="t('pageNavigation')">
        <button v-if="narrow" ref="pageMenuButton" type="button" class="app-page-menu-toggle" popovertarget="app-page-menu">
          <span>{{ t(pages[view].label) }}</span>
        </button>
        <div id="app-page-menu" ref="pageMenu" class="app-page-menu" :popover="narrow ? 'auto' : undefined" @beforetoggle="positionPageMenu">
          <button v-for="(entry, page) in pages" :key="page" type="button" :data-page="page"
            :aria-current="view === page ? 'page' : undefined" @click="openPage(page)">
            {{ t(entry.label) }}
          </button>
        </div>
      </nav>
    </div>
    <div class="toolbar">
      <button v-if="view === 'reader'" type="button" class="refresh-documents" :aria-label="t('refresh')"
        :title="t('refresh')" :disabled="listLoading" @click="refresh(); refreshMarks()">
        <span class="refresh-documents-label">{{ t('refresh') }}</span><span class="refresh-documents-icon" aria-hidden="true"></span>
      </button>
      <QuickNote ref="quick-note" :editor="notesEditor" :language="language" :visit="visitNoteBlock" />
      <label class="language-control"><span>{{ t('language') }}</span>
        <select :value="language" :aria-label="t('language')" @change="changeLanguage"><option value="zh-CN">简体中文</option><option value="en">English</option></select>
      </label>
    </div>
  </header>
  <p v-if="languageStatus" class="language-status" role="status">{{ t(languageStatus) }}</p>
  <div v-if="positionNotice" class="position-notice">
    <p role="status">{{ positionNotice }}</p>
    <button type="button" @click="positionNotice = ''">{{ t('closePositionNotice') }}</button>
  </div>
  <RecordWorkbench v-show="view === 'bookmarks'" :class="{ 'record-active': view === 'bookmarks' }" page="bookmarks" :heading="t('bookmarks')" :list-id="listIds.bookmarks" :list-open="recordLists.bookmarks">
    <template #action><button type="button" :disabled="bookmarksLoading || bookmarksSaving" @click="refreshBookmarks">{{ t('bookmarkRefresh') }}</button></template>
    <template #status>
      <p v-if="bookmarksLoading || visitingBookmark" role="status">{{ t('loading') }}</p>
      <p v-if="bookmarkListError" role="alert">{{ problemText(language, bookmarkListError).message }} {{ problemText(language, bookmarkListError).nextStep }}</p>
    </template>
    <template #list>
      <p v-if="!bookmarks.length && !bookmarksLoading && !bookmarkListError" class="narrow-list-empty">{{ t('bookmarkEmpty') }}</p>
      <ul class="project-bookmarks">
        <li v-for="bookmark in bookmarks" :key="bookmark.id">
          <button type="button" class="bookmark-entry" :aria-current="bookmarkItem === bookmark.id || undefined" @click="selectBookmark(bookmark)">
            <span class="bookmark-note">{{ bookmark.note || t('bookmarkNoNote') }}</span>
            <small>{{ bookmark.documentPath }} · {{ bookmark.blockId }}</small>
          </button>
          <button type="button" class="record-visit" @click="visitBookmark(bookmark)">{{ t('recordVisit') }}</button>
        </li>
      </ul>
    </template>
    <div v-if="unavailableBookmark" ref="unavailableMessage" class="notice bookmark-unavailable" role="status" tabindex="-1">
      <p>{{ t('bookmarkUnavailable') }}</p>
      <p>{{ unavailableBookmark.documentPath }} · {{ unavailableBookmark.blockId }}</p>
      <p>{{ unavailableBookmark.note || t('bookmarkNoNote') }}</p>
    </div>
    <template v-if="currentBookmark">
      <h2>{{ t('bookmarkReason') }}</h2>
      <p class="record-prose">{{ currentBookmark.note || t('bookmarkNoNote') }}</p>
      <p class="record-location">{{ currentBookmark.documentPath }} · {{ t('block') }} <code>{{ currentBookmark.blockId }}</code></p>
      <button type="button" @click="visitBookmark(currentBookmark)">{{ t('recordVisit') }}</button>
    </template>
    <p v-else-if="!bookmarksLoading && !bookmarkListError">{{ t('bookmarkEmpty') }}</p>
  </RecordWorkbench>
  <ProjectMarks v-show="view === 'marks'" :class="{ 'record-active': view === 'marks' }" v-model:filter="markFilter" v-model:current-item="markItem" :visible="view === 'marks'"
    :list-open="recordLists.marks" :language="language" :marks="marks" @select="showDetail('marks')"
    :busy="marksBusy" v-bind="markListError ? { error: markListError } : {}" :visit="visitMark" @refresh="refreshMarks" />
  <ProjectNotes :editor="notesEditor" v-show="view === 'notes'" :class="{ 'record-active': view === 'notes' }" ref="notes" :visible="view === 'notes'" :list-open="recordLists.notes"
    :language="language" @select="showDetail('notes')" :visit="visitNoteBlock" />
  <DependencyCanvas v-if="canvasOpened" v-show="view === 'canvas'" ref="canvas" :active="view === 'canvas'"
    :tools-open="canvasToolsOpen" :opening-document="openingDocument" :language="language" @read="openDocument" />
  <div id="loop-workspace" v-show="view === 'loops'" class="loop-workspace" :class="{ 'loops-active': view === 'loops' }" tabindex="-1">
    <div v-if="!selectedLoop" class="loop-field">
      <DependencyDots :active="view === 'loops'" :quiet="false" :groups="[]" :viewport="{ x: 0, y: 0, zoom: 1 }" />
      <div class="loop-welcome" :class="{ 'beside-catalog': catalogOpen }">
        <strong>{{ t('brand') }}</strong>
        <p v-if="loopEntries.length || !catalogOpen">{{ t(catalogOpen ? 'loopStart' : 'loopStartClosed') }}</p>
      </div>
    </div>
    <aside ref="catalog" id="loop-navigation" class="loop-catalog" :class="{ open: catalogOpen }" :inert="!catalogOpen"
      :aria-label="t('loopCatalog')" tabindex="-1" @keydown.stop @keydown.tab="leaveCatalogOnTab" @keyup.stop @wheel.stop>
      <header>
        <h2>{{ t('loopCatalog') }} <small v-if="loopsLoaded">{{ loopEntries.length }}</small></h2>
        <button type="button" :aria-label="t('loopRefresh')" :title="t('loopRefresh')" :disabled="loopsLoading" @click="refreshLoopList">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 5v5h-5M20 10a8 8 0 1 0-.8 6"/></svg>
        </button>
      </header>
      <div class="loop-catalog-list">
        <p v-if="loopsLoading" role="status">{{ t('loading') }}</p>
        <p v-else-if="loopsLoaded && !loopEntries.length && !loopListError && !loopProblems.length">{{ t('loopEmpty') }}</p>
        <section v-for="problem in (loopListError ? [loopListError, ...loopProblems] : loopProblems)" :key="problem.context.loopId ?? problem.code"
          class="canvas-problem" role="alert">
          <p>{{ problemText(language, problem).message }} {{ problemText(language, problem).nextStep }}</p>
          <code>{{ problem.code }} {{ problem.context.loopId }} {{ problem.context.field }} {{ problem.context.reason }}</code>
        </section>
        <button v-for="entry in loopEntries" :key="entry.id" type="button" class="loop-catalog-item"
          :data-loop="entry.id" :aria-current="entry.id === selectedLoop || undefined" @click="selectLoop(entry.id)">
          <LoopThumbnail :entry="entry" />
          <span class="loop-catalog-copy">
            <strong>{{ entry.title }}</strong><span class="loop-catalog-goal">{{ entry.goal }}</span>
            <small>{{ t('loopCounts').replace('{steps}', String(entry.steps.length)).replace('{files}', String(entry.fileCount)) }}</small>
          </span>
        </button>
      </div>
    </aside>
    <DependencyCanvas v-for="id in openedLoops" v-show="selectedLoop === id" :key="id" ref="loop-canvases" :loop-id="id"
      :tools-covered="catalogOpen" :active="view === 'loops' && selectedLoop === id" :language="language" />
  </div>
  <div v-show="view === 'reader'" class="workspace"
    :class="{ 'workspace-active': view === 'reader', 'with-navigation': !narrow && desktopOpen, 'file-switch-wait': fileSwitch?.placeholder }">
    <p class="file-switch-announcement" role="status">{{ fileSwitchStatus }}</p>
    <div v-if="!narrow && !desktopOpen" ref="navigationEdge" class="navigation-edge" data-testid="reader-navigation-edge" aria-hidden="true"
      @pointerenter="scheduleNavigationPreview" @pointerleave="schedulePreviewClose"></div>
    <aside v-show="navigationOpen" id="reader-navigation" ref="navigation" class="sidebar"
      :class="{ 'with-outline': outline.length, 'sidebar-overlay': narrow || desktopPeek }"
      :style="{ '--files-share': fileShare + 'fr', '--outline-share': (100 - fileShare) + 'fr' }"
      :aria-label="t('readingNavigation')" tabindex="-1" @keydown.esc.stop="dismissSidebar"
      @pointerenter="holdNavigationPreview" @pointerleave="schedulePreviewClose" @focusout="schedulePreviewClose">
      <header class="sidebar-header">
        <h2 v-if="projectRoot">
          <button ref="projectInfoButton" type="button" class="project-info-toggle" :title="projectName"
            aria-haspopup="dialog" aria-controls="reader-project-info" :aria-expanded="projectInfoOpen" @click="toggleProjectInfo">
            <span>{{ projectName }}</span>
          </button>
        </h2>
        <h2 v-else>{{ t('project') }}</h2>
        <div v-if="projectRoot" id="reader-project-info" ref="projectInfo" class="project-info" popover="manual"
          role="dialog" tabindex="-1" :aria-label="t('projectInfo')">
          <dl>
            <div><dt>{{ t('projectPath') }}</dt><dd>{{ projectRoot }}</dd></div>
            <div v-if="result && !fileSwitch?.placeholder"><dt>{{ t('commit') }}</dt><dd class="commit">{{ result.commit ?? t('unknown') }}</dd></div>
          </dl>
          <p v-if="result?.mechanicallyValid && !fileSwitch?.placeholder" class="check-status">{{ t('verified') }}</p>
        </div>
      </header>
      <nav id="reader-file-navigation" class="sidebar-section" :aria-label="t('files')">
        <h2>{{ t('files') }}</h2>
        <div ref="treeScroll" class="navigation-scroll">
          <p v-if="listLoading" class="navigation-status" role="status">{{ t('loading') }}</p>
          <section v-if="listError" role="alert" class="list-error">
            <h3>{{ t('listError') }}</h3>
            <p>{{ problemText(language, listError).message }}</p>
            <p>{{ problemText(language, listError).nextStep }}</p><code>{{ listError.code }}</code>
          </section>
          <ReaderFileTree :entries="fileTree" :expanded="expandedFolders" :selected="selected" :selected-source="selectedSource"
            :opening="fileSwitch ? openingDocument : ''" @toggle="toggleFolder" @select="readFromTree" />
          <section v-for="(problem, index) in problems" :key="index" class="list-problem" role="alert">
            <code>{{ problem.code }}</code><p>{{ problem.context.documentPath }}</p>
            <p>{{ problemText(language, problem).message }}</p><p>{{ problemText(language, problem).nextStep }}</p>
          </section>
        </div>
      </nav>
      <ReaderSidebarDivider v-if="outline.length" v-model="fileShare" :label="t('resizeNavigationSections')" />
      <nav v-if="outline.length" class="sidebar-section reader-outline" :aria-label="t('outline')" :inert="fileSwitch?.placeholder">
        <h2>{{ t('outline') }}</h2>
        <div ref="outlineScroll" class="navigation-scroll">
          <ol class="outline-list"><li v-for="entry in outline" :key="entry.id">
            <button type="button" :aria-current="entry.id === activeBlock ? 'location' : undefined" @click="jumpToBlock(entry.id)">
              {{ entry.label || (entry.lines ? `${t('sourceLines')} ${entry.lines.start}–${entry.lines.end}` : `${t('block')} ${entry.number}`) }}
            </button>
          </li></ol>
        </div>
      </nav>
    </aside>
    <div class="reading-workspace" :inert="narrow && navigationOpen">
      <main id="reading" ref="readingPane" class="reading-pane" tabindex="-1" :aria-busy="readingLoading || !!fileSwitch"
        @scroll.passive="trackReadingPosition">
        <div class="reading-content" :inert="fileSwitch?.placeholder">
          <p v-if="readingLoading" class="reading-state" role="status">{{ t('loading') }}</p>
          <ReaderDocument ref="readerDocument" v-else-if="result || readingError" :key="selected"
            v-bind="{ ...(result ? { result } : {}), ...(readingError ? { error: readingError } : {}) }"
            :language="language" :active="view === 'reader' && !fileSwitch?.placeholder"
            :bookmarks="bookmarks" :active-bookmark="activeBookmark"
            :bookmarks-busy="bookmarksLoading || bookmarksSaving" :save-bookmark="saveBookmark"
            :marks="marks" :marks-busy="marksBusy" :save-mark="saveMark" :mark-list-error="markListError"
            @refresh-marks="refreshMarks" @add-to-notes="quickNote?.addQuote($event)" />
          <section v-else-if="!listLoading && !listError && !documents.length && !problems.length" class="empty-state">
            <h1>{{ t('empty') }}</h1><p>{{ t('emptyHelp') }}</p><code>docs/aftertaste/current/</code>
          </section>
          <p v-else-if="!listLoading" class="reading-state">{{ t('choose') }}</p>
        </div>
      </main>
      <div v-if="fileSwitch?.placeholder" ref="file-switch-frame" class="file-switch-placeholder" aria-hidden="true">
        <div class="document-header">
          <h1><span class="file-directory">{{ fileSwitch.source.slice(0, -fileSwitchName.length) }}</span><span class="file-name">{{ fileSwitchName }}</span></h1>
          <p class="document-path">{{ t('openingFile') }}</p>
        </div>
        <div class="document-blocks">
          <div class="document-block comparison">
            <div class="placeholder-code">
              <div v-for="group in fileSwitchGroups" :key="group" class="source-pane placeholder-lines">
                <i v-for="line in placeholderCodeLines[(group - 1) % placeholderCodeLines.length]" :key="line"></i>
              </div>
            </div>
            <div class="explanation-pane">
              <div v-for="group in fileSwitchGroups" :key="group" class="placeholder-lines placeholder-paragraph">
                <i v-for="line in placeholderProseLines[(group - 1) % placeholderProseLines.length]" :key="line"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="fileSwitch" class="file-switch-immediate" aria-hidden="true">
        <p>{{ fileSwitchStatus }}</p>
      </div>
    </div>
  </div>
</template>
