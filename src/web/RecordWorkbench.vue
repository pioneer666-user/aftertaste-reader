<script setup lang="ts">
defineProps<{ page: string; heading: string; compactHeading?: boolean; listId: string; listOpen: boolean }>();
</script>

<template>
  <main :id="page" class="record-workbench" :class="{ 'list-open': listOpen, 'compact-heading': compactHeading }" tabindex="-1" :aria-labelledby="page + '-heading'">
    <header class="record-heading">
      <h1 :id="page + '-heading'">{{ heading }}</h1>
      <slot name="action" />
      <div class="record-status"><slot name="status" /></div>
    </header>
    <aside v-show="listOpen" :id="listId" class="record-navigation" :aria-label="heading" tabindex="-1">
      <slot name="list" />
    </aside>
    <section class="record-detail" tabindex="-1" :aria-label="heading">
      <div class="record-sheet"><slot /></div>
    </section>
  </main>
</template>
