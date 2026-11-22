<script setup lang="ts">
import { translate, type Language } from './i18n.js';

const props = defineProps<{
  language: Language; label: string; saveLabel: string; confirm?: boolean; busy: boolean; disabled?: boolean; dirty?: boolean;
}>();
const value = defineModel<string>({ required: true });
defineEmits<{ save: []; cancel: [] }>();
const t = (key: string) => translate(props.language, key);
</script>

<template>
  <form class="record-editor" @submit.prevent="$emit('save')">
    <textarea v-model="value" :aria-label="label" :placeholder="label" :readonly="busy" rows="2" />
    <div class="editor-footer">
      <small v-if="dirty">{{ t('bookmarkDraft') }}</small>
      <button type="button" :disabled="busy" @click="$emit('cancel')">{{ t('bookmarkCancel') }}</button>
      <button type="submit" :disabled="busy || disabled" :aria-label="saveLabel">{{ confirm ? saveLabel : t('recordSave') }}</button>
    </div>
  </form>
</template>
