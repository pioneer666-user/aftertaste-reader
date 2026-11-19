<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue';
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
import ProjectNotes from './ProjectNotes.vue';
import ProjectMarks from './ProjectMarks.vue';
import DependencyCanvas from './DependencyCanvas.vue';
import { failed, request } from './reader-api.js';
import { problemText, readLanguage, saveLanguage, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { blockLabel } from './markdown.js';

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
const treeScroll = ref<HTMLElement>();
const outlineScroll = ref<HTMLElement>();
const openNavigationButton = ref<HTMLButtonElement>();
const closeNavigationButton = ref<HTMLButtonElement>();
const navigationMedia = window.matchMedia('(max-width: 850px)');
const narrow = ref(navigationMedia.matches);
const desktopOpen = ref(true);
const narrowOpen = ref(false);
const navigationOpen = computed(() => narrow.value ? narrowOpen.value : desktopOpen.value);
const projectName = computed(() => projectRoot.value.split(/[\\/]/u).filter(Boolean).at(-1) ?? projectRoot.value);
const fileTree = computed(() => buildFileTree(documents.value));
const expandedFolders = reactive(new Set<string>());
const selectedSource = computed(() => documents.value.find(entry => entry.documentPath === selected.value)?.sourcePath ?? '');
const outline = computed(() => result.value?.renderMode === 'comparison' ? result.value.blocks.map((block, index) => ({
  id: block.id, label: blockLabel(block.body), lines: block.lines, number: index + 1,
})) : []);
const activeBlock = ref('');
const canvasOpened = ref(false);
const view = ref<'reader' | 'canvas' | 'loops' | 'bookmarks' | 'notes' | 'marks'>('reader');
const noteQuote = ref<BlockQuote>();
const fromCanvas = ref(false);
const loopEntries = ref<LoopEntry[]>([]);
const loopsLoaded = ref(false);
const loopsLoading = ref(false);
const loopProblems = ref<ReaderProblem[]>([]);
const loopListError = ref<ReaderProblem>();
const loopNavigation = ref<HTMLElement>();
const selectedLoop = ref('');
const openedLoops = ref<string[]>([]);
const bookmarks = ref<Bookmark[]>([]);
provide(bookmarkDraftsKey, reactive(new Map<string, BookmarkDraft>()));
const bookmarksLoading = ref(false);
const bookmarksSaving = ref(false);
const bookmarkListError = ref<ReaderProblem>();
const bookmarkPanel = ref<HTMLElement>();
const unavailableMessage = ref<HTMLElement>();
const unavailableBookmark = ref<Bookmark>();
const activeBookmark = ref('');
const activeMark = ref('');
const visitingBookmark = ref(false);
const markRoute = '/api/understanding-marks';
const marks = ref<ReaderMark[]>([]);
const markFilter = ref<'all' | 'not-understood'>('all');
const marksBusy = ref(false);
const markListError = ref<ReaderProblem>();
provide(markDraftsKey, reactive(new Map<string, MarkDraft>()));
let listSequence = 0;
let readSequence = 0;
let bookmarkVisitSequence = 0;
let controller: AbortController | undefined;
let handledScrollTop = 0;

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
watch(view, current => { if (current !== 'reader') narrowOpen.value = false; });

function blockElement(id: string) {
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
  (open ? closeNavigationButton : openNavigationButton).value?.focus({ preventScroll: true });
}

async function resizeNavigation(event: MediaQueryListEvent) {
  const focusInSidebar = navigation.value?.contains(document.activeElement);
  const focusOnOpener = document.activeElement === openNavigationButton.value;
  narrow.value = event.matches;
  narrowOpen.value = false;
  await nextTick();
  if (view.value !== 'reader') return;
  if (focusInSidebar && !navigationOpen.value) openNavigationButton.value?.focus({ preventScroll: true });
  else if (focusOnOpener && navigationOpen.value) closeNavigationButton.value?.focus({ preventScroll: true });
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
  await nextTick();
  if (block.isConnected && view.value === 'reader') focusReadingTarget(block, id);
}

async function readFromTree(path: string) {
  void selectDocument(path);
  if (narrow.value) {
    narrowOpen.value = false;
    await nextTick();
    readingPane.value?.focus({ preventScroll: true });
  }
}

async function skipToReading(event: MouseEvent) {
  if (view.value !== 'reader' || !narrowOpen.value) return;
  event.preventDefault();
  narrowOpen.value = false;
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

async function refreshMarks() {
  if (marksBusy.value) return;
  marksBusy.value = true;
  try { await loadMarks(); }
  finally { marksBusy.value = false; }
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

async function refreshBookmarks() {
  if (bookmarksLoading.value || bookmarksSaving.value) return;
  bookmarksLoading.value = true;
  await loadBookmarks();
  bookmarksLoading.value = false;
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

async function openBookmarks() {
  ++bookmarkVisitSequence;
  view.value = 'bookmarks';
  unavailableBookmark.value = undefined;
  visitingBookmark.value = false;
  void refreshBookmarks();
  await nextTick();
  if (view.value === 'bookmarks') bookmarkPanel.value?.focus();
}

async function visitBookmark(bookmark: Bookmark) {
  const visit = ++bookmarkVisitSequence;
  visitingBookmark.value = true;
  unavailableBookmark.value = undefined;
  const loading = selectDocument(bookmark.documentPath, false);
  const reading = readSequence;
  await loading;
  if (visit !== bookmarkVisitSequence || view.value !== 'bookmarks') return;
  visitingBookmark.value = false;
  if (reading !== readSequence) return;
  const canVisit = result.value?.renderMode === 'comparison' &&
    result.value.blocks.some(block => block.id === bookmark.blockId) &&
    bookmarks.value.some(record => record.id === bookmark.id);
  if (canVisit) {
    activeBookmark.value = bookmark.id;
    fromCanvas.value = false;
    view.value = 'reader';
    await nextTick();
    if (reading !== readSequence || view.value !== 'reader') return;
    const record = document.getElementById(`bookmark-${bookmark.id}`);
    if (record && readingPane.value?.contains(record)) {
      focusReadingTarget(record, bookmark.blockId);
      return;
    }
    view.value = 'bookmarks';
  }
  unavailableBookmark.value = bookmark;
  await nextTick();
  if (visit === bookmarkVisitSequence && view.value === 'bookmarks') unavailableMessage.value?.focus();
}

function addToNotes(quote: BlockQuote) {
  noteQuote.value = quote;
  view.value = 'notes';
}

async function visitBlock(target: BlockTarget, from: 'notes' | 'marks'): Promise<string | undefined> {
  const loading = selectDocument(target.documentPath, false);
  const reading = readSequence;
  await loading;
  if (reading !== readSequence || view.value !== from) return;
  const location = `${target.documentPath} · ${target.blockId}`;
  if (readingError.value) {
    const message = readingError.value.code === 'DOCUMENT_READ_FAILED' && readingError.value.context.reason === 'ENOENT'
      ? t('noteDocumentMissing') : problemText(language.value, readingError.value).message;
    return `${message} ${location}`;
  }
  if (result.value?.renderMode !== 'comparison') {
    const problem = result.value?.sourceError ?? result.value?.diagnostics.find(item => item.severity === 'error');
    return `${t('noteDocumentInvalid')} ${problem ? problemText(language.value, problem).message + ' ' : ''}${location}`;
  }
  if (!result.value.blocks.some(block => block.id === target.blockId)) return `${t('noteBlockMissing')} ${location}`;

  fromCanvas.value = false;
  activeMark.value = from === 'marks' ? target.blockId : '';
  view.value = 'reader';
  await nextTick();
  if (reading !== readSequence || view.value !== 'reader') return;
  const block = blockElement(target.blockId);
  const record = activeMark.value ? block?.querySelector<HTMLElement>(`#mark-${CSS.escape(target.blockId)}`) : undefined;
  const destination = record ?? block;
  if (destination) focusReadingTarget(destination, target.blockId);
}

const visitNoteBlock = (target: BlockTarget) => visitBlock(target, 'notes');
const visitMark = (target: UnderstandingMark) => visitBlock(target, 'marks');

function openCanvas() {
  canvasOpened.value = true;
  view.value = 'canvas';
}

async function openLoops() {
  view.value = 'loops';
  await nextTick();
  loopNavigation.value?.focus();
  if (!loopsLoaded.value) void refreshLoops();
}

async function refreshLoops() {
  if (loopsLoading.value) return;
  loopsLoading.value = true;
  loopListError.value = undefined;
  try {
    const data = await request<{ loops: LoopEntry[]; problems: ReaderProblem[] }>('/api/loops');
    loopEntries.value = data.loops;
    loopProblems.value = data.problems;
    loopsLoaded.value = true;
    if (!data.loops.some(loop => loop.id === selectedLoop.value)) selectedLoop.value = '';
  } catch (error) { loopListError.value = failed(error); }
  finally { loopsLoading.value = false; }
}

function selectLoop(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (id && !openedLoops.value.includes(id)) openedLoops.value.push(id);
  selectedLoop.value = id;
}

function readFromCanvas(documentPath: string) {
  view.value = 'reader';
  fromCanvas.value = true;
  void selectDocument(documentPath);
  expandAncestors(selectedSource.value);
}

async function selectDocument(documentPath: string, resetScroll = true) {
  const sequence = ++readSequence;
  controller?.abort();
  controller = new AbortController();
  selected.value = documentPath;
  if (!resetScroll) expandAncestors(selectedSource.value);
  activeBookmark.value = '';
  activeMark.value = '';
  activeBlock.value = '';
  readingLoading.value = true;
  result.value = undefined;
  readingError.value = undefined;
  try {
    const data = await request<{ result: ReadingDocument }>(`/api/document?path=${encodeURIComponent(documentPath)}`, { signal: controller.signal });
    if (sequence === readSequence) {
      result.value = data.result;
      activeBlock.value = outline.value[0]?.id ?? '';
    }
  } catch (error) {
    if (sequence === readSequence) readingError.value = { ...failed(error), context: { ...failed(error).context, documentPath } };
  } finally {
    if (sequence === readSequence) {
      readingLoading.value = false;
      await nextTick();
      if (resetScroll && sequence === readSequence) {
        readingPane.value?.scrollTo({ top: 0 });
        handledScrollTop = 0;
      }
    }
  }
}

async function refresh() {
  const sequence = ++listSequence;
  const readingAtRequest = readSequence;
  listLoading.value = true;
  listError.value = undefined;
  try {
    const data = await request<{ projectRoot: string; documents: DocumentEntry[]; problems: ReaderProblem[] }>('/api/documents');
    if (sequence !== listSequence) return;
    projectRoot.value = data.projectRoot;
    documents.value = data.documents;
    problems.value = data.problems;
    if (readingAtRequest !== readSequence) return;
    const current = data.documents.find(entry => entry.documentPath === selected.value) ?? data.documents[0];
    if (current) await selectDocument(current.documentPath);
    else {
      ++readSequence;
      controller?.abort();
      selected.value = '';
      result.value = undefined;
      readingError.value = undefined;
      readingLoading.value = false;
    }
  } catch (error) {
    if (sequence === listSequence) listError.value = failed(error);
  } finally { if (sequence === listSequence) listLoading.value = false; }
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
  document.documentElement.lang = language.value;
  document.title = `${t('brand')} · ${t('title')}`;
  void refresh();
  void refreshBookmarks();
  void refreshMarks();
});
onUnmounted(() => navigationMedia.removeEventListener('change', resizeNavigation));
</script>

<template>
  <a :href="view === 'canvas' ? '#canvas-reading' : view === 'loops' ? '#loop-navigation' : view === 'reader' ? '#reading' : '#' + view"
    class="skip-link" @click="skipToReading">{{ t('skip') }}</a>
  <header class="app-header">
    <div class="brand"><strong>{{ t('brand') }}</strong><span>{{ t('title') }}</span></div>
    <div class="toolbar">
      <button v-if="view !== 'canvas'" type="button" @click="openCanvas">{{ t(view === 'reader' && fromCanvas ? 'canvasBack' : 'dependencyCanvas') }}</button>
      <button v-if="view !== 'reader'" type="button" @click="view = 'reader'; fromCanvas = false">{{ t('files') }}</button>
      <button type="button" :aria-pressed="view === 'loops'" @click="openLoops">{{ t('loops') }}</button>
      <button type="button" :aria-pressed="view === 'bookmarks'" @click="openBookmarks">{{ t('bookmarks') }}</button>
      <button type="button" :aria-pressed="view === 'marks'" @click="view = 'marks'; refreshMarks()">{{ t('marks') }}</button>
      <button type="button" :aria-pressed="view === 'notes'" @click="view = 'notes'">{{ t('notes') }}</button>
      <button v-if="view === 'reader'" type="button" :disabled="listLoading" @click="refresh(); refreshMarks()">{{ t('refresh') }}</button>
      <label class="language-control"><span>{{ t('language') }}</span>
        <select :value="language" :aria-label="t('language')" @change="changeLanguage"><option value="zh-CN">简体中文</option><option value="en">English</option></select>
      </label>
    </div>
  </header>
  <p v-if="languageStatus" class="language-status" role="status">{{ t(languageStatus) }}</p>
  <main v-if="view === 'bookmarks'" id="bookmarks" ref="bookmarkPanel" class="bookmark-panel" tabindex="-1"
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
        <button type="button" class="bookmark-entry" @click="visitBookmark(bookmark)">
          <span>{{ bookmark.documentPath }} · {{ t('block') }} <code>{{ bookmark.blockId }}</code></span>
          <span class="bookmark-note">{{ bookmark.note || t('bookmarkNoNote') }}</span>
        </button>
      </li>
    </ul>
  </main>
  <ProjectMarks v-if="view === 'marks'" v-model:filter="markFilter" :language="language" :marks="marks"
    :busy="marksBusy" v-bind="markListError ? { error: markListError } : {}" :visit="visitMark" @refresh="refreshMarks" />
  <ProjectNotes v-show="view === 'notes'" :visible="view === 'notes'" :language="language" :quote="noteQuote"
    :visit="visitNoteBlock" @clear-quote="noteQuote = undefined" />
  <DependencyCanvas v-if="canvasOpened" v-show="view === 'canvas'" :active="view === 'canvas'" :language="language" @read="readFromCanvas" />
  <div v-show="view === 'loops'">
    <section id="loop-navigation" ref="loopNavigation" class="loop-navigation" :aria-label="t('loops')" tabindex="-1">
      <template v-if="loopEntries.length">
        <label for="saved-loop">{{ t('loopChoose') }}</label>
        <select id="saved-loop" :value="selectedLoop" @change="selectLoop">
          <option value="">{{ t('loopSelect') }}</option>
          <option v-for="loop in loopEntries" :key="loop.id" :value="loop.id">{{ loop.title }}</option>
        </select>
      </template>
      <button type="button" :disabled="loopsLoading" @click="refreshLoops">{{ t('loopRefresh') }}</button>
      <p v-if="loopsLoading" role="status">{{ t('loading') }}</p>
      <p v-else-if="loopsLoaded && !loopEntries.length && !loopListError">{{ t('loopEmpty') }}</p>
      <section v-for="problem in (loopListError ? [loopListError, ...loopProblems] : loopProblems)" :key="problem.context.loopId ?? problem.code"
        class="canvas-problem" role="alert">
        <p>{{ problemText(language, problem).message }} {{ problemText(language, problem).nextStep }}</p>
        <code>{{ problem.code }} {{ problem.context.loopId }} {{ problem.context.field }} {{ problem.context.reason }}</code>
      </section>
    </section>
    <DependencyCanvas v-for="id in openedLoops" v-show="selectedLoop === id" :key="id" :loop-id="id"
      :active="view === 'loops' && selectedLoop === id" :language="language" />
  </div>
  <div v-show="view === 'reader'" class="workspace"
    :class="{ 'workspace-active': view === 'reader', 'with-navigation': navigationOpen }">
    <aside v-show="navigationOpen" id="reader-navigation" ref="navigation" class="sidebar"
      :class="{ 'with-outline': outline.length }" :aria-label="t('readingNavigation')" @keydown.esc.stop="setNavigation(false)">
      <header class="sidebar-header">
        <div class="sidebar-project">
          <h2 :title="projectRoot || undefined">{{ projectName || t('project') }}</h2>
          <details v-if="projectRoot" class="project-location">
            <summary>{{ t('projectPath') }}</summary>
            <p>{{ projectRoot }}</p>
          </details>
        </div>
        <button ref="closeNavigationButton" type="button" class="sidebar-close" :aria-label="t('closeNavigation')"
          :title="t('closeNavigation')" aria-controls="reader-navigation" @click="setNavigation(false)"></button>
      </header>
      <nav class="sidebar-section" :aria-label="t('files')">
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
      <nav v-if="outline.length" class="sidebar-section block-outline" :aria-label="t('outline')">
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
      <div v-if="!navigationOpen || narrow" class="navigation-tools">
        <button ref="openNavigationButton" type="button" :aria-expanded="navigationOpen" aria-controls="reader-navigation"
          @click="setNavigation(true)">{{ t('openNavigation') }}</button>
      </div>
      <main id="reading" ref="readingPane" class="reading-pane" tabindex="-1" :aria-busy="readingLoading" @scroll.passive="trackReadingPosition">
        <p v-if="readingLoading" class="reading-state" role="status">{{ t('loading') }}</p>
        <ReaderDocument v-else-if="result || readingError" :key="selected"
          v-bind="{ ...(result ? { result } : {}), ...(readingError ? { error: readingError } : {}) }"
          :language="language" :bookmarks="bookmarks" :active-bookmark="activeBookmark" :active-mark="activeMark"
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
