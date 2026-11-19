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
  entries: readonly FileTreeEntry[]; expanded: ReadonlySet<string>; selected: string; selectedSource: string;
}>();
const emit = defineEmits<{ toggle: [path: string]; select: [documentPath: string] }>();
</script>

<template>
  <ul class="file-list">
    <li v-for="entry in entries" :key="'children' in entry ? entry.path : entry.documentPath">
      <template v-if="'children' in entry">
        <button type="button" class="directory-button" :title="entry.path" :aria-expanded="expanded.has(entry.path)"
          :data-current-directory="!expanded.has(entry.path) && selectedSource.startsWith(entry.path + '/') || undefined"
          @click="emit('toggle', entry.path)">{{ entry.name }}</button>
        <ReaderFileTree v-if="expanded.has(entry.path)" :entries="entry.children" :expanded="expanded"
          :selected="selected" :selected-source="selectedSource" @toggle="emit('toggle', $event)" @select="emit('select', $event)" />
      </template>
      <button v-else type="button" :title="entry.path" :aria-current="selected === entry.documentPath ? 'page' : undefined"
        @click="emit('select', entry.documentPath)">{{ entry.name }}</button>
    </li>
  </ul>
</template>
