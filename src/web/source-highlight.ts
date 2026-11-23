import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import { bundledLanguages } from 'shiki/langs';
import type { BundledLanguage } from 'shiki/langs';
import type { ThemeRegistrationRaw } from 'shiki/types';

type LanguageLookup = Record<string, BundledLanguage | null>;
declare const __SOURCE_LANGUAGES__: { filenames: LanguageLookup; extensions: LanguageLookup };

const classByColor = new Map([
  ['#000001', 'source-keyword'], ['#000002', 'source-string'], ['#000003', 'source-comment'],
  ['#000004', 'source-tag'], ['#000005', 'source-property'],
]);
// Use the grammar's scopes to select CSS classes. Reader themes provide the actual ink.
const theme = {
  name: 'aftertaste', type: 'light',
  settings: [
    { scope: ['keyword', 'storage', 'constant.language'], settings: { foreground: '#000001' } },
    { scope: ['string', 'constant.character.escape'], settings: { foreground: '#000002' } },
    { scope: 'comment', settings: { foreground: '#000003' } },
    { scope: ['entity.name.tag', 'entity.name.selector', 'entity.other.attribute-name.class.css',
      'entity.other.attribute-name.id.css'], settings: { foreground: '#000004' } },
    { scope: ['entity.other.attribute-name', 'support.type.property-name'], settings: { foreground: '#000005' } },
  ],
} satisfies ThemeRegistrationRaw;

function findLanguage(sourcePath: string) {
  const { filenames, extensions } = __SOURCE_LANGUAGES__;
  const name = sourcePath.slice(sourcePath.lastIndexOf('/') + 1);
  const lowerName = name.toLowerCase();
  if (Object.hasOwn(filenames, lowerName)) return filenames[lowerName];
  for (let dot = name.indexOf('.'); dot >= 0; dot = name.indexOf('.', dot + 1)) {
    const suffix = name.slice(dot);
    if (Object.hasOwn(extensions, suffix)) return extensions[suffix];
    const lowerSuffix = suffix.toLowerCase();
    if (Object.hasOwn(extensions, lowerSuffix)) return extensions[lowerSuffix];
  }
}

let engine: ReturnType<typeof createHighlighterCore> | undefined;
type SourcePart = { text: string; className: string | undefined };

export async function highlightSource(sourcePath: string, sourceLines: readonly string[]): Promise<SourcePart[][] | undefined> {
  const language = findLanguage(sourcePath);
  if (!language) return;

  try {
    engine ??= createHighlighterCore({ engine: createOnigurumaEngine(import('shiki/wasm')), themes: [theme], langs: [] });
    const highlighter = await engine;
    if (!highlighter.getLoadedLanguages().includes(language)) {
      await highlighter.loadLanguage(bundledLanguages[language]);
    }
    // Tokenize the whole file so grammar state continues through explanation block boundaries.
    const lines = highlighter.codeToTokensBase(sourceLines.join('\n'), { lang: language, theme: theme.name });
    if (lines.length !== sourceLines.length || !lines.every((parts, index) =>
      parts.map(part => part.content).join('') === sourceLines[index])) return;
    return lines.map(parts => parts.map(part => ({ text: part.content, className: classByColor.get(part.color ?? '') })));
  } catch {
    return undefined;
  }
}
