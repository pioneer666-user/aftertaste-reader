<script setup lang="ts">
defineProps<{ name: 'visit' | 'bookmark' | 'explanation' | 'refresh' }>();
</script>

<template>
  <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.15"
    stroke-linecap="round" stroke-linejoin="round">
    <path v-if="name === 'visit'" d="M3 13 13 3M5.5 3H13v7.5" />
    <path v-else-if="name === 'bookmark'" d="M4 3.25A1.25 1.25 0 0 1 5.25 2h5.5A1.25 1.25 0 0 1 12 3.25V14l-4-2.7L4 14z" />
    <path v-else-if="name === 'explanation'" d="M8 4.6C6.3 3.45 4 3.3 1.75 4v8.1c2.25-.7 4.55-.55 6.25.6 1.7-1.15 4-1.3 6.25-.6V4C12 3.3 9.7 3.45 8 4.6Zm0 0v8.1M4 6.35l1.75.4M4 8.55l1.75.4m4.5-2.2 1.75-.4m-1.75 2.6 1.75-.4" />
    <path v-else d="M13.25 3.5v3.25H10M13.25 6.75a5.25 5.25 0 1 0-.5 4" />
  </svg>
</template>
