import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { sourceGrammarLicenses, sourceLanguages } from './scripts/source-languages.mjs';

export default defineConfig({
  root: fileURLToPath(new URL('./src/web', import.meta.url)),
  plugins: [sourceGrammarLicenses(), vue()],
  define: { __SOURCE_LANGUAGES__: JSON.stringify(sourceLanguages()) },
  build: {
    outDir: fileURLToPath(new URL('./dist/web', import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
