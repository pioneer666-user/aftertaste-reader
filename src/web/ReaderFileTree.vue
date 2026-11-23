<script lang="ts">
import type { DocumentEntry } from '../application/file-reader.js';

export type FileTreeEntry =
  | { name: string; path: string; children: FileTreeEntry[] }
  | { name: string; path: string; documentPath: string };

export function buildFileTree(documents: readonly DocumentEntry[]): FileTreeEntry[] {
  const tree: FileTreeEntry[] = [];
  const folders = new Map<string, FileTreeEntry[]>();
  for (const entry of documents) {
    const segments = entry.sourcePath.split('/');
    const name = segments.pop()!;
    let siblings = tree;
    let path = '';
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment;
      let children = folders.get(path);
      if (!children) {
        children = [];
        folders.set(path, children);
        siblings.push({ name: segment, path, children });
      }
      siblings = children;
    }
    siblings.push({ name, path: entry.sourcePath, documentPath: entry.documentPath });
  }
  return tree;
}
</script>

<script setup lang="ts">
defineProps<{
  depth?: number; entries: readonly FileTreeEntry[]; expanded: ReadonlySet<string>; selected: string; selectedSource: string; opening: string;
}>();
const emit = defineEmits<{ toggle: [path: string]; select: [documentPath: string, sourcePath: string] }>();
</script>

<template>
  <ul class="file-list" :style="{ '--tree-depth': depth ?? 0 }">
    <li v-for="entry in entries" :key="'children' in entry ? entry.path : entry.documentPath">
      <template v-if="'children' in entry">
        <button type="button" class="directory-button" :title="entry.path" :aria-expanded="expanded.has(entry.path)"
          :data-current-directory="!expanded.has(entry.path) && selectedSource.startsWith(entry.path + '/') || undefined"
          @click="emit('toggle', entry.path)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4a1 1 0 0 1 1-1H6l1.5 2h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z" /></svg>
          <span>{{ entry.name }}</span>
        </button>
        <ReaderFileTree v-if="expanded.has(entry.path)" :depth="(depth ?? 0) + 1" :entries="entry.children" :expanded="expanded"
          :selected="selected" :selected-source="selectedSource" :opening="opening"
          @toggle="emit('toggle', $event)" @select="(path, source) => emit('select', path, source)" />
      </template>
      <button v-else type="button" class="file-button" :class="{ 'file-opening': opening === entry.documentPath }"
        :title="entry.path" :aria-current="selected === entry.documentPath ? 'page' : undefined"
        @click="emit('select', entry.documentPath, entry.path)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5L13 6v8.5H4Z M9 2v4h4" /></svg>
        <span>{{ entry.name }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.file-list { margin: 0; padding: 0; list-style: none; }
.file-list button {
  display: flex; align-items: center; gap: 5px; width: 100%; min-height: 24px;
  padding: 2px 4px 2px calc(4px + var(--tree-depth) * 10px); border: 1px solid transparent;
  background: transparent; color: var(--text); text-align: left; font: inherit; font-size: 13px; line-height: 18px;
}
.file-list button:hover { background: var(--hover); }
.file-list button:focus-visible { outline-offset: -2px; }
.file-list :is([aria-current="page"], [data-current-directory]) { color: var(--action); background: var(--current); font-weight: 600; }
.file-list button::before { content: ''; width: 6px; flex: none; }
.directory-button::before { height: 6px; border: solid var(--muted); border-width: 0 1.5px 1.5px 0; transform: rotate(-45deg); }
.directory-button[aria-expanded="true"]::before { transform: translateY(-2px) rotate(45deg); }
.file-list svg { flex: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-linejoin: round; color: var(--secondary); }
.file-list span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.file-list .file-opening { background: var(--hover); border-color: var(--scroll-thumb); }
.file-opening::after { content: ''; margin-left: auto; width: 9px; border-bottom: 2px dotted currentColor; }
@media (max-width: 850px), (pointer: coarse) { .file-list button { min-height: 44px; } }
</style>
