<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import type { DocumentEntry, ReaderProblem } from '../application/file-reader.js';
import type { ReadingDocument } from '../application/document-blocks.js';
import ReaderDocument from './ReaderDocument.vue';
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
let listSequence = 0;
let readSequence = 0;
let controller: AbortController | undefined;

class RequestFailure extends Error {
  constructor(readonly problem: ReaderProblem) { super(problem.code); }
}

async function request<T>(route: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(route, { cache: 'no-store', ...(signal ? { signal } : {}) });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new RequestFailure(data.error);
  return data as T;
}

function failed(error: unknown): ReaderProblem {
  return error instanceof RequestFailure ? error.problem : {
    code: 'NETWORK_ERROR', message: '', nextStep: '', context: {},
  };
}

async function selectDocument(documentPath: string) {
  const sequence = ++readSequence;
  controller?.abort();
  controller = new AbortController();
  selected.value = documentPath;
  readingLoading.value = true;
  result.value = undefined;
  readingError.value = undefined;
  try {
    const data = await request<{ result: ReadingDocument }>(`/api/document?path=${encodeURIComponent(documentPath)}`, controller.signal);
    if (sequence === readSequence) result.value = data.result;
  } catch (error) {
    if (sequence === readSequence) readingError.value = { ...failed(error), context: { ...failed(error).context, documentPath } };
  } finally {
    if (sequence === readSequence) {
      readingLoading.value = false;
      await nextTick();
      readingPane.value?.scrollTo({ top: 0 });
    }
  }
}

async function refresh() {
  const sequence = ++listSequence;
  listLoading.value = true;
  listError.value = undefined;
  try {
    const data = await request<{ projectRoot: string; documents: DocumentEntry[]; problems: ReaderProblem[] }>('/api/documents');
    if (sequence !== listSequence) return;
    projectRoot.value = data.projectRoot;
    documents.value = data.documents;
    problems.value = data.problems;
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
});
</script>

<template>
  <a href="#reading" class="skip-link">{{ t('skip') }}</a>
  <header class="app-header">
    <div class="brand"><strong>{{ t('brand') }}</strong><span>{{ t('title') }}</span></div>
    <div class="toolbar">
      <button type="button" :disabled="listLoading" @click="refresh">{{ t('refresh') }}</button>
      <label class="language-control"><span>{{ t('language') }}</span>
        <select :value="language" :aria-label="t('language')" @change="changeLanguage"><option value="zh-CN">简体中文</option><option value="en">English</option></select>
      </label>
    </div>
  </header>
  <p v-if="languageStatus" class="language-status" role="status">{{ t(languageStatus) }}</p>
  <div class="workspace">
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
      <ReaderDocument v-else-if="result || readingError" :key="selected" v-bind="{ ...(result ? { result } : {}), ...(readingError ? { error: readingError } : {}) }" :language="language" />
      <section v-else-if="!listLoading && !listError && !documents.length && !problems.length" class="empty-state">
        <h1>{{ t('empty') }}</h1><p>{{ t('emptyHelp') }}</p><code>docs/aftertaste/current/</code>
      </section>
      <p v-else-if="!listLoading" class="reading-state">{{ t('choose') }}</p>
    </main>
  </div>
</template>
