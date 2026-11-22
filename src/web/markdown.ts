import MarkdownIt from 'markdown-it';
import type { NoteReference } from './note-references.js';

interface InternalLinks {
  prefix: string;
  title: string;
  byMarker?: ReadonlyMap<string, NoteReference>;
}

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
const standardValidate = markdown.validateLink.bind(markdown);
markdown.validateLink = (url: string) => standardValidate(url) && /^(?:https?:|mailto:|#)/iu.test(url);
markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index]?.content ?? '');
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  const token = tokens[index]!;
  const attribute = token.attrGet('href');
  const href = typeof attribute === 'string' ? attribute : '';
  const links = env?.internalLinks as InternalLinks | undefined;
  const reference = href ? links?.byMarker?.get(href) : undefined;
  if (links && (reference || href?.startsWith(links.prefix))) {
    token.attrSet('class', 'note-block-link');
    token.attrSet('title', links.title);
    if (reference) {
      token.attrSet('href', reference.href);
      token.attrSet('data-note-raw', reference.raw);
      token.attrSet('data-source', reference.source);
      token.attrSet('aria-label', reference.label);
    }
  } else {
    token.attrSet('rel', 'noopener noreferrer');
    token.attrSet('target', '_blank');
  }
  return renderer.renderToken(tokens, index, options);
};

export function renderMarkdown(raw: string, internalLinks?: InternalLinks): string {
  return markdown.render(raw, { internalLinks });
}

type InlineToken = { type: string; content: string; children?: InlineToken[] | null };
const sentences = new Intl.Segmenter(undefined, { granularity: 'sentence' });

function inlineText(tokens: readonly InlineToken[], includeCode: boolean): string {
  return tokens.map(token => {
    if (token.type === 'text' || (includeCode && token.type === 'code_inline')) return token.content;
    if (token.type === 'image') return inlineText(token.children ?? [], includeCode);
    return token.type === 'softbreak' || token.type === 'hardbreak' ? ' ' : '';
  }).join('').replace(/\s+/gu, ' ').trim();
}

export function blockLabel(body: string): string {
  const tokens: InlineToken[] = markdown.parse(body, {});
  if (tokens[0]?.type === 'heading_open') {
    const title = inlineText(tokens[1]?.children ?? [], true);
    if (title) return title;
  }
  for (const [index, token] of tokens.entries()) {
    if (token.type !== 'inline' || tokens[index - 1]?.type === 'heading_open') continue;
    const children = token.children ?? [];
    if (!inlineText(children, false)) continue;
    const first = sentences.segment(inlineText(children, true))[Symbol.iterator]().next().value?.segment.trim() ?? '';
    const characters = [...first];
    return characters.length > 48 ? `${characters.slice(0, 48).join('')}…` : first;
  }
  return '';
}

export function blockLinkInsertion(body: string, link: string): string {
  if (!body) return link;
  const tail = markdown.parse(body + '\n\n' + link, {}).at(-1);
  // If the new paragraph is absorbed by an open fence, close the fence before adding it.
  if (tail?.type === 'fence') return `${body.endsWith('\n') ? '' : '\n'}${tail.markup}\n\n${link}`;
  return '\n\n' + link;
}

export function noteName(note: {title: string; body: string}, fallback: string) {
  if (note.title.trim()) return note.title;
  const firstLine = note.body.split('\n').find(line => line.trim());
  if (!firstLine) return fallback;
  const element = document.createElement('template');
  element.innerHTML = renderMarkdown(firstLine);
  const text = element.content.textContent?.trim() || firstLine.trim();
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}
