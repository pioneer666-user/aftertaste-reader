<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import type { DocumentEntry, ReaderProblem } from '../application/file-reader.js';
import type { ReadingDocument } from '../application/document-blocks.js';
import type { LoopEntry } from '../application/loop-reader.js';
import type { Bookmark, BookmarkAction } from '../core/bookmarks.js';
import ReaderDocument from './ReaderDocument.vue';
import DependencyCanvas from './DependencyCanvas.vue';
import { failed, request } from './reader-api.js';
import { problemText, readLanguage, saveLanguage, translate } from './i18n.js';
import type { Language } from './i18n.js';

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
const canvasOpened = ref(false);
const view = ref<'reader' | 'canvas' | 'loops' | 'bookmarks'>('reader');
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
const bookmarksLoading = ref(false);
const bookmarksSaving = ref(false);
const bookmarkListError = ref<ReaderProblem>();
const bookmarkPanel = ref<HTMLElement>();
const unavailableMessage = ref<HTMLElement>();
const unavailableBookmark = ref<Bookmark>();
const activeBookmark = ref('');
const visitingBookmark = ref(false);
let listSequence = 0;
let readSequence = 0;
let bookmarkVisitSequence = 0;
let controller: AbortController | undefined;

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
      record.scrollIntoView({ block: 'center', inline: 'nearest' });
      record.focus({ preventScroll: true });
      return;
    }
    view.value = 'bookmarks';
  }
  unavailableBookmark.value = bookmark;
  await nextTick();
  if (visit === bookmarkVisitSequence && view.value === 'bookmarks') unavailableMessage.value?.focus();
}

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
}

async function selectDocument(documentPath: string, resetScroll = true) {
  const sequence = ++readSequence;
  controller?.abort();
  controller = new AbortController();
  selected.value = documentPath;
  activeBookmark.value = '';
  readingLoading.value = true;
  result.value = undefined;
  readingError.value = undefined;
  try {
    const data = await request<{ result: ReadingDocument }>(`/api/document?path=${encodeURIComponent(documentPath)}`, { signal: controller.signal });
    if (sequence === readSequence) result.value = data.result;
  } catch (error) {
    if (sequence === readSequence) readingError.value = { ...failed(error), context: { ...failed(error).context, documentPath } };
  } finally {
    if (sequence === readSequence) {
      readingLoading.value = false;
      await nextTick();
      if (resetScroll && sequence === readSequence) readingPane.value?.scrollTo({ top: 0 });
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
}

onMounted(() => {
  document.documentElement.lang = language.value;
  document.title = `${t('brand')} · ${t('title')}`;
  void refresh();
  void refreshBookmarks();
});
</script>

<template>
  <a :href="view === 'canvas' ? '#canvas-reading' : view === 'loops' ? '#loop-navigation' : view === 'bookmarks' ? '#bookmarks' : '#reading'"
    class="skip-link">{{ t('skip') }}</a>
  <header class="app-header">
    <div class="brand"><strong>{{ t('brand') }}</strong><span>{{ t('title') }}</span></div>
    <div class="toolbar">
      <button v-if="view !== 'canvas'" type="button" @click="openCanvas">{{ t(view === 'reader' && fromCanvas ? 'canvasBack' : 'dependencyCanvas') }}</button>
      <button v-if="view !== 'reader'" type="button" @click="view = 'reader'; fromCanvas = false">{{ t('files') }}</button>
      <button type="button" :aria-pressed="view === 'loops'" @click="openLoops">{{ t('loops') }}</button>
      <button type="button" :aria-pressed="view === 'bookmarks'" @click="openBookmarks">{{ t('bookmarks') }}</button>
      <button v-if="view === 'reader'" type="button" :disabled="listLoading" @click="refresh">{{ t('refresh') }}</button>
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
  <div v-show="view === 'reader'" class="workspace">
    <aside class="sidebar">
      <h2>{{ t('files') }}</h2>
      <p class="project-root" :title="projectRoot">{{ projectRoot }}</p>
      <p v-if="listLoading" role="status">{{ t('loading') }}</p>
      <section v-if="listError" role="alert" class="list-error">
        <h3>{{ t('listError') }}</h3>
        <p>{{ problemText(language, listError).message }}</p>
        <p>{{ problemText(language, listError).nextStep }}</p><code>{{ listError.code }}</code>
      </section>
      <nav :aria-label="t('files')"><ul class="file-list"><li v-for="entry in documents" :key="entry.documentPath">
        <button type="button" :aria-current="selected === entry.documentPath ? 'page' : undefined" @click="selectDocument(entry.documentPath)">{{ entry.sourcePath }}</button>
      </li></ul></nav>
      <section v-for="(problem, index) in problems" :key="index" class="list-problem" role="alert">
        <code>{{ problem.code }}</code><p>{{ problem.context.documentPath }}</p>
        <p>{{ problemText(language, problem).message }}</p><p>{{ problemText(language, problem).nextStep }}</p>
      </section>
      <p class="read-only">{{ t('readOnly') }}</p>
    </aside>
    <main id="reading" ref="readingPane" class="reading-pane" tabindex="-1" :aria-busy="readingLoading">
      <p v-if="readingLoading" class="reading-state" role="status">{{ t('loading') }}</p>
      <ReaderDocument v-else-if="result || readingError" :key="selected"
        v-bind="{ ...(result ? { result } : {}), ...(readingError ? { error: readingError } : {}) }"
        :language="language" :bookmarks="bookmarks" :active-bookmark="activeBookmark"
        :bookmarks-busy="bookmarksLoading || bookmarksSaving" :save-bookmark="saveBookmark" />
      <section v-else-if="!listLoading && !listError && !documents.length && !problems.length" class="empty-state">
        <h1>{{ t('empty') }}</h1><p>{{ t('emptyHelp') }}</p><code>docs/aftertaste/current/</code>
      </section>
      <p v-else-if="!listLoading" class="reading-state">{{ t('choose') }}</p>
    </main>
  </div>
</template>
