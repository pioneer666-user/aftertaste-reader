import * as linguist from 'linguist-languages';
import { bundledLanguagesInfo } from 'shiki/langs';

// Upstream grammars with GPL, LGPL, or MPL terms in the pinned tm-grammars NOTICE.
const excludedGrammars = new Set(['ada', 'ahk2', 'bird2', 'gnuplot', 'hcl', 'nginx', 'org', 'racket', 'terraform']);
const languageIds = new Map(bundledLanguagesInfo.flatMap(({ id, name, aliases = [] }) =>
  [id, name, ...aliases].map(key => [key.toLowerCase(), id])));

function addMatch(matches, path, id, priority) {
  const previous = matches.get(path);
  if (!previous || priority > previous.priority) matches.set(path, { id, priority });
  else if (priority === previous.priority && id !== previous.id) previous.id = null;
}

function toLookup(matches) {
  return Object.fromEntries([...matches].map(([path, { id }]) => [path, id]));
}

export function sourceLanguages() {
  const filenames = new Map();
  const extensions = new Map();
  for (const language of Object.values(linguist)) {
    const match = [language.name, ...(language.aliases ?? [])]
      .map(name => name.toLowerCase()).map(name => languageIds.get(name)).find(Boolean);
    const id = excludedGrammars.has(match) ? undefined : match;
    for (const name of language.filenames ?? []) addMatch(filenames, name.toLowerCase(), id ?? null, 0);
    for (const [index, extension] of (language.extensions ?? []).entries()) {
      const priority = languageIds.get(extension.slice(1)) === id && id ? 2 : index === 0 ? 1 : 0;
      addMatch(extensions, extension, id ?? null, priority);
    }
  }
  // The Shiki aliases also cover extensions such as .jsx that Linguist groups under another grammar.
  for (const [alias, id] of languageIds) {
    if (excludedGrammars.has(id) || !/^[\w+-]+$/u.test(alias)) continue;
    const ext = '.' + alias;
    if (!extensions.has(ext) || id === 'jsx' || id === 'tsx') addMatch(extensions, ext, id, 3);
  }
  // Both C and C++ headers use .h. The C++ grammar also covers common C syntax.
  return { filenames: toLookup(filenames), extensions: { ...toLookup(extensions), '.h': 'cpp' } };
}

export function sourceGrammarLicenses() {
  const emptyGrammar = '\0aftertaste:empty-grammar';
  return {
    name: 'aftertaste-source-grammar-licenses',
    enforce: 'pre',
    resolveId(source, importer) {
      const bundled = /^@shikijs\/langs\/([^/]+)$/u.exec(source);
      const embedded = importer?.replaceAll('\\', '/').includes('/@shikijs/langs/dist/') && /^\.\/([^/]+)\.mjs$/u.exec(source);
      if (excludedGrammars.has(bundled?.[1] ?? embedded?.[1])) return emptyGrammar;
    },
    load(id) {
      if (id === emptyGrammar) return 'export default []';
    },
  };
}
