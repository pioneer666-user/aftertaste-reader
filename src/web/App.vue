<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, reactive, ref, shallowReactive, useTemplateRef, watch } from 'vue';
import type { DocumentEntry, ReaderProblem } from '../application/file-reader.js';
import type { ReadingDocument } from '../application/document-blocks.js';
import type { LoopEntry } from '../application/loop-reader.js';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import type { BlockQuote, BlockTarget } from '../core/notes.js';
import type { MarkEdit, ReaderMark, UnderstandingMark } from '../core/understanding-marks.js';
import { bookmarkDraftsKey } from './bookmark-drafts.js';
import type { BookmarkDraft } from './bookmark-drafts.js';
import { markDraftsKey } from './mark-drafts.js';
import type { MarkDraft } from './mark-drafts.js';
import ReaderDocument from './ReaderDocument.vue';
import ReaderFileTree, { buildFileTree } from './ReaderFileTree.vue';
import ReaderSidebarDivider from './ReaderSidebarDivider.vue';
import ProjectNotes from './ProjectNotes.vue';
import ProjectMarks from './ProjectMarks.vue';
import DependencyCanvas from './DependencyCanvas.vue';
import { failed, request } from './reader-api.js';
import { problemText, readLanguage, saveLanguage, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLabel } from './markdown.js';
import { markKey } from '../core/understanding-marks.js';
import type { CanvasPosition } from './canvas-position.js';
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
const notesListOpen = ref(true);
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
  { page: 'notes'; note: NotesPosition | undefined; top: number } |
  { page: 'bookmarks'; item: string; top: number } |
  { page: 'marks'; item: string; filter: typeof markFilter.value; top: number };
const view = ref<Page>('reader');
const history = shallowReactive<Position[]>([{ page: 'reader', path: '', block: '', top: 0, offset: 0, bookmark: '', mark: '' }]);
const historyIndex = ref(0);
const pageTops: Partial<Record<Page, number>> = {};
const positionNotice = ref('');
let navigationSequence = 0;
let restoring = false;
let openingDocument = false;
const mainId = computed(() => ({ reader: 'reading', canvas: 'canvas-reading', loops: 'loop-navigation',
  bookmarks: 'bookmarks', marks: 'marks', notes: 'notes' })[view.value]);
const pageMenu = ref<HTMLElement>();
const pageMenuButton = ref<HTMLButtonElement>();
const noteQuote = ref<BlockQuote>();
const loopEntries = ref<LoopEntry[]>([]);
const loopsLoaded = ref(false);
const loopsLoading = ref(false);
const loopProblems = ref<ReaderProblem[]>([]);
const loopListError = ref<ReaderProblem>();
const selectedLoop = ref('');
const openedLoops = ref<string[]>([]);
const bookmarks = ref<Bookmark[]>([]);
provide(bookmarkDraftsKey, reactive(new Map<string, BookmarkDraft>()));
const bookmarksLoading = ref(false);
const bookmarksSaving = ref(false);
const bookmarkListError = ref<ReaderProblem>();
const unavailableMessage = ref<HTMLElement>();
const unavailableBookmark = ref<Bookmark>();
const activeBookmark = ref('');
const activeMark = ref('');
const bookmarkItem = ref('');
const markItem = ref('');
const visitingBookmark = ref(false);
const markRoute = '/api/understanding-marks';
const marks = ref<ReaderMark[]>([]);
const markFilter = ref<'all' | 'not-understood'>('all');
const marksBusy = ref(false);
const markListError = ref<ReaderProblem>();
provide(markDraftsKey, reactive(new Map<string, MarkDraft>()));
let listSequence = 0;
let controller: AbortController | undefined;
let handledScrollTop = 0;
let peekTimer: number | undefined;

const auxiliary = computed(() => {
  if (view.value === 'reader') return { id: 'reader-navigation', open: navigationOpen.value, action: navigationAction.value };
  if (view.value === 'canvas') return { id: 'dependency-tools', open: canvasToolsOpen.value,
    action: canvasToolsOpen.value ? 'closeCanvasTools' : 'openCanvasTools' };
  if (view.value === 'notes' && notes.value?.canHideList) return { id: 'note-navigation', open: notesListOpen.value,
    action: notesListOpen.value ? 'closeNoteList' : 'openNoteList' };
  return { id: undefined, open: undefined, action: 'noAuxiliaryPanel' };
});

function toggleAuxiliary() {
  if (view.value === 'reader') void setNavigation(desktopPeek.value || !navigationOpen.value);
  if (view.value === 'canvas') canvasToolsOpen.value = !canvasToolsOpen.value;
  if (view.value === 'notes') notesListOpen.value = !notesListOpen.value;
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

function focusReadingTarget(target: HTMLElement, blockId: string) {
  target.scrollIntoView({ block: 'start', inline: 'nearest' });
  handledScrollTop = readingPane.value?.scrollTop ?? 0;
  activeBlock.value = blockId;
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

async function readFromTree(path: string) {
  void openDocument(path);
  if (narrow.value || desktopPeek.value) {
    narrowOpen.value = false;
    closeNavigationPreview();
    await nextTick();
    readingPane.value?.focus({ preventScroll: true });
  }
}

async function skipToReading(event: MouseEvent) {
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
    case 'bookmarks': return { page: 'bookmarks', top, item: bookmarkItem.value };
    case 'marks': return { page: 'marks', top, item: markItem.value, filter: markFilter.value };
    case 'notes': return { page: 'notes', top, note: notes.value?.capturePosition() };
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

function rememberPosition() {
  if (restoring) return;
  const position = capturePosition();
  history[historyIndex.value] = position;
  if (position.page !== 'reader' && 'top' in position) pageTops[position.page] = position.top;
}

function pushPosition(position: Position) {
  history.splice(historyIndex.value + 1, history.length, position);
  historyIndex.value++;
}

function startNavigation() {
  controller?.abort();
  openingDocument = false;
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
  const focused = document.activeElement;
  if (focused === document.body || (focused instanceof HTMLButtonElement && focused.disabled)) {
    document.getElementById(mainId.value)?.focus({ preventScroll: true });
  }
}

async function visitBookmark(bookmark: Bookmark) {
  unavailableBookmark.value = undefined;
  bookmarkItem.value = bookmark.id;
  const reason = await openDocument(bookmark.documentPath, bookmark.blockId, bookmark.id);
  if (!reason || view.value !== 'bookmarks') return;
  unavailableBookmark.value = bookmark;
  await nextTick();
  if (view.value === 'bookmarks') unavailableMessage.value?.focus({ preventScroll: true });
}

function addToNotes(quote: BlockQuote) {
  openPage('notes');
  noteQuote.value = quote;
}

const visitNoteBlock = (target: BlockTarget) => openDocument(target.documentPath, target.blockId);
function visitMark(target: UnderstandingMark) {
  markItem.value = markKey(target);
  return openDocument(target.documentPath, target.blockId, '', target.blockId);
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
}

function selectLoop(event: Event) {
  if (restoring) {
    startNavigation();
    restoring = false;
  }
  showLoop((event.target as HTMLSelectElement).value);
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

async function openDocument(path: string, block = '', bookmark = '', mark = ''): Promise<string | undefined> {
  const sequence = startNavigation();
  const origin = view.value;
  openingDocument = true;
  if (origin === 'bookmarks') visitingBookmark.value = true;
  const data = await readDocument(path);
  if (sequence !== navigationSequence) return;
  openingDocument = false;
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
    if (origin === 'reader' || origin === 'canvas') {
      navigationProblem(message + (problem ? ' ' + problemText(language.value, problem).nextStep : ''));
    }
    restoring = false;
    readingLoading.value = false;
    return message;
  }
  const duplicate = origin === 'reader' && selected.value === path && (!block || activeBlock.value === block);
  rememberPosition();
  restoring = false;
  activatePage('reader');
  setDocument(path, data);
  activeBookmark.value = bookmark;
  activeMark.value = mark;
  if (!duplicate) pushPosition(capturePosition());
  await nextTick();
  if (sequence !== navigationSequence) return;
  const target = bookmark ? document.getElementById(`bookmark-${bookmark}`) :
    mark ? blockElement(block)?.querySelector<HTMLElement>(`#mark-${CSS.escape(mark)}`) : blockElement(block);
  if (target) focusReadingTarget(target, block);
  else {
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
    if (view.value === 'reader' && !restoring && !openingDocument &&
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
  document.addEventListener('keydown', dismissNavigationPreview);
  document.addEventListener('pointerdown', dismissProjectInfoOutside);
  document.documentElement.lang = language.value;
  document.title = `${t('brand')} · ${t('title')}`;
  void refresh();
  void refreshBookmarks();
  void refreshMarks();
});
onUnmounted(() => {
  navigationMedia.removeEventListener('change', resizeNavigation);
  document.removeEventListener('keydown', dismissNavigationPreview);
  document.removeEventListener('pointerdown', dismissProjectInfoOutside);
  closeNavigationPreview();
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
  <main v-show="view === 'bookmarks'" id="bookmarks" class="bookmark-panel" tabindex="-1"
    aria-labelledby="bookmarks-heading">
    <div class="bookmark-heading">
      <h1 id="bookmarks-heading">{{ t('bookmarks') }}</h1>
      <button type="button" :disabled="bookmarksLoading || bookmarksSaving" @click="refreshBookmarks">{{ t('bookmarkRefresh') }}</button>
    </div>
    <p v-if="bookmarksLoading || visitingBookmark" role="status">{{ t('loading') }}</p>
    <p v-else-if="bookmarkListError" class="bookmark-error" role="alert">
      {{ problemText(language, bookmarkListError).message }} {{ problemText(language, bookmarkListError).nextStep }}
    </p>
    <p v-else-if="!bookmarks.length">{{ t('bookmarkEmpty') }}</p>
    <div v-if="unavailableBookmark" ref="unavailableMessage" class="notice bookmark-unavailable" role="status" tabindex="-1">
      <p>{{ t('bookmarkUnavailable') }}</p>
      <p><code>{{ unavailableBookmark.documentPath }}</code> · <code>{{ unavailableBookmark.blockId }}</code></p>
      <p class="bookmark-note">{{ unavailableBookmark.note || t('bookmarkNoNote') }}</p>
    </div>
    <ul v-if="bookmarks.length" class="project-bookmarks">
      <li v-for="bookmark in bookmarks" :key="bookmark.id">
        <button type="button" class="bookmark-entry" :aria-current="bookmarkItem === bookmark.id ? 'true' : undefined" @click="visitBookmark(bookmark)">
          <span>{{ bookmark.documentPath }} · {{ t('block') }} <code>{{ bookmark.blockId }}</code></span>
          <span class="bookmark-note">{{ bookmark.note || t('bookmarkNoNote') }}</span>
        </button>
      </li>
    </ul>
  </main>
  <ProjectMarks v-show="view === 'marks'" v-model:filter="markFilter" :visible="view === 'marks'" :current-item="markItem"
    :language="language" :marks="marks"
    :busy="marksBusy" v-bind="markListError ? { error: markListError } : {}" :visit="visitMark" @refresh="refreshMarks" />
  <ProjectNotes v-show="view === 'notes'" ref="notes" :visible="view === 'notes'" :list-open="notesListOpen"
    :language="language" :quote="noteQuote"
    :visit="visitNoteBlock" @clear-quote="noteQuote = undefined" />
  <DependencyCanvas v-if="canvasOpened" v-show="view === 'canvas'" ref="canvas" :active="view === 'canvas'"
    :tools-open="canvasToolsOpen" :language="language" @read="openDocument" />
  <div v-show="view === 'loops'">
    <section id="loop-navigation" class="loop-navigation" :aria-label="t('loops')" tabindex="-1">
      <template v-if="loopEntries.length">
        <label for="saved-loop">{{ t('loopChoose') }}</label>
        <select id="saved-loop" :value="selectedLoop" @change="selectLoop">
          <option value="">{{ t('loopSelect') }}</option>
          <option v-for="loop in loopEntries" :key="loop.id" :value="loop.id">{{ loop.title }}</option>
        </select>
      </template>
      <button type="button" :disabled="loopsLoading" @click="refreshLoopList">{{ t('loopRefresh') }}</button>
      <p v-if="loopsLoading" role="status">{{ t('loading') }}</p>
      <p v-else-if="loopsLoaded && !loopEntries.length && !loopListError">{{ t('loopEmpty') }}</p>
      <section v-for="problem in (loopListError ? [loopListError, ...loopProblems] : loopProblems)" :key="problem.context.loopId ?? problem.code"
        class="canvas-problem" role="alert">
        <p>{{ problemText(language, problem).message }} {{ problemText(language, problem).nextStep }}</p>
        <code>{{ problem.code }} {{ problem.context.loopId }} {{ problem.context.field }} {{ problem.context.reason }}</code>
      </section>
    </section>
    <DependencyCanvas v-for="id in openedLoops" v-show="selectedLoop === id" :key="id" ref="loop-canvases" :loop-id="id"
      :active="view === 'loops' && selectedLoop === id" :language="language" />
  </div>
  <div v-show="view === 'reader'" class="workspace"
    :class="{ 'workspace-active': view === 'reader', 'with-navigation': !narrow && desktopOpen }">
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
            <div v-if="result"><dt>{{ t('commit') }}</dt><dd class="commit">{{ result.commit ?? t('unknown') }}</dd></div>
          </dl>
          <p v-if="result?.mechanicallyValid" class="check-status">{{ t('verified') }}</p>
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
            @toggle="toggleFolder" @select="readFromTree" />
          <section v-for="(problem, index) in problems" :key="index" class="list-problem" role="alert">
            <code>{{ problem.code }}</code><p>{{ problem.context.documentPath }}</p>
            <p>{{ problemText(language, problem).message }}</p><p>{{ problemText(language, problem).nextStep }}</p>
          </section>
        </div>
      </nav>
      <ReaderSidebarDivider v-if="outline.length" v-model="fileShare" :label="t('resizeNavigationSections')" />
      <nav v-if="outline.length" class="sidebar-section" :aria-label="t('outline')">
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
      <main id="reading" ref="readingPane" class="reading-pane" tabindex="-1" :aria-busy="readingLoading" @scroll.passive="trackReadingPosition">
        <p v-if="readingLoading" class="reading-state" role="status">{{ t('loading') }}</p>
        <ReaderDocument v-else-if="result || readingError" :key="selected"
          v-bind="{ ...(result ? { result } : {}), ...(readingError ? { error: readingError } : {}) }"
          :language="language" :active="view === 'reader'" :bookmarks="bookmarks" :active-bookmark="activeBookmark" :active-mark="activeMark"
          :bookmarks-busy="bookmarksLoading || bookmarksSaving" :save-bookmark="saveBookmark"
          :marks="marks" :marks-busy="marksBusy" :save-mark="saveMark" :mark-list-error="markListError"
          @refresh-marks="refreshMarks" @add-to-notes="addToNotes" />
        <section v-else-if="!listLoading && !listError && !documents.length && !problems.length" class="empty-state">
          <h1>{{ t('empty') }}</h1><p>{{ t('emptyHelp') }}</p><code>docs/aftertaste/current/</code>
        </section>
        <p v-else-if="!listLoading" class="reading-state">{{ t('choose') }}</p>
      </main>
    </div>
  </div>
</template>
