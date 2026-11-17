<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ReadingDocument } from '../application/document-blocks.js';
import type { ReaderProblem } from '../application/file-reader.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import { renderMarkdown } from './markdown.js';

const props = defineProps<{ result?: ReadingDocument; error?: ReaderProblem; language: Language }>();
const t = (key: string) => translate(props.language, key);
const copyStatus = ref('');
const diagnostics = computed(() => props.result?.diagnostics ?? []);
const hasProblems = computed(() => Boolean(props.error || diagnostics.value.length || props.result?.sourceError));
const repairText = computed(() => {
  const result = props.result;
  const localize = (problem: { code: string; message: string; nextStep: string; params?: Readonly<Record<string, string | number>> }) =>
    ({ ...problem, ...problemText(props.language, problem) });
  return JSON.stringify({
    document: result?.documentPath ?? props.error?.context.documentPath,
    source_commit: result?.commit ?? null,
    source_path: result?.sourcePath ?? props.error?.context.sourcePath ?? null,
    problems: diagnostics.value.map(localize),
    ...(result?.sourceError ? { source_error: localize(result.sourceError) } : {}),
    ...(props.error ? { error: localize(props.error) } : {}),
  }, null, 2);
});

async function copyRepair() {
  try {
    await navigator.clipboard.writeText(repairText.value);
    copyStatus.value = 'copied';
  } catch { copyStatus.value = 'copyFailed'; }
}
</script>

<template>
  <section v-if="error" class="reading-error" role="alert">
    <h2>{{ t('readError') }}</h2>
    <p>{{ problemText(language, error).message }}</p>
    <p>{{ problemText(language, error).nextStep }}</p>
    <code>{{ error.code }}</code>
  </section>
  <template v-if="result">
    <header class="document-header">
      <h1>{{ result.sourcePath }}</h1>
      <dl class="document-meta">
        <div><dt>{{ t('document') }}</dt><dd>{{ result.documentPath }}</dd></div>
        <div><dt>{{ t('commit') }}</dt><dd class="commit">{{ result.commit ?? t('unknown') }}</dd></div>
      </dl>
      <p v-if="result.mechanicallyValid" class="check-status">{{ t('verified') }}</p>
      <p v-if="result.contentStatus === 'unfilled'" class="notice">{{ t('unfilled') }}</p>
      <div v-if="result.renderMode === 'markdown'" class="notice" role="status">
        <p v-if="result.sourceCheck === 'unavailable'">{{ t('unavailable') }}</p>
        <p>{{ t('fallback') }}</p>
        <p>{{ t('fallbackHelp') }}</p>
      </div>
    </header>
    <div v-if="result.renderMode === 'comparison'" class="document-blocks">
      <section v-for="block in result.blocks" :id="block.id" :key="block.id" class="document-block" :class="{ comparison: block.lines }">
        <div v-if="block.lines" class="source-pane">
          <h2 class="pane-label">{{ t('source') }} <span>{{ block.lines.start }}–{{ block.lines.end }}</span></h2>
          <div class="source-scroll" tabindex="0" role="region" :aria-label="t('sourceScroll')">
            <pre><code><span v-for="(line, index) in result.sourceLines?.slice(block.lines.start - 1, block.lines.end)" :key="index" class="source-line"><span class="line-number" aria-hidden="true">{{ block.lines.start + index }}</span><span>{{ line }}</span>{{ '\n' }}</span></code></pre>
          </div>
        </div>
        <div class="explanation-pane">
          <h2 class="pane-label">{{ t('explanation') }} <code>{{ block.id }}</code></h2>
          <p v-if="!block.body.trim()" class="notice">{{ t('unfilled') }}</p>
          <div class="markdown" v-html="renderMarkdown(block.body)"></div>
        </div>
      </section>
    </div>
    <article v-else class="markdown fallback-markdown" v-html="renderMarkdown(result.raw)"></article>
  </template>
  <section v-if="hasProblems" class="diagnostics" :aria-label="t('issues')">
    <h2>{{ t('issues') }}</h2>
    <ul class="problem-list">
      <li v-for="(problem, index) in diagnostics" :key="index">
        <p><strong>{{ t(problem.severity) }}</strong> · <code>{{ problem.code }}</code></p>
        <p>{{ problemText(language, problem).message }}</p>
        <p class="problem-location">
          <span v-if="problem.line">{{ t('line') }} {{ problem.line }}</span>
          <span v-if="problem.blockId">{{ t('block') }} <code>{{ problem.blockId }}</code></span>
        </p>
        <p>{{ t('next') }} · {{ problemText(language, problem).nextStep }}</p>
      </li>
      <li v-if="result?.sourceError">
        <code>{{ result.sourceError.code }}</code>
        <p>{{ problemText(language, result.sourceError).message }}</p>
        <p>{{ problemText(language, result.sourceError).nextStep }}</p>
      </li>
    </ul>
    <div class="repair-heading"><h3>{{ t('repair') }}</h3><button type="button" @click="copyRepair">{{ t('copy') }}</button></div>
    <p role="status">{{ copyStatus ? t(copyStatus) : '' }}</p>
    <textarea class="repair-text" readonly :aria-label="t('manual')" :value="repairText" rows="10"></textarea>
  </section>
</template>
