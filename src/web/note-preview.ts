import { blockLinkPrefix } from '../core/notes.js';
import { renderMarkdown } from './markdown.js';
import { noteReferences } from './note-references.js';

export function renderNote(body: string, title: string) {
  const references = noteReferences(body);
  const byMarker = new Map<string, (typeof references)[number]>();
  const parts: string[] = [];
  let offset = 0;
  // Mark the exact source span so another link to the same block keeps its own label and clipboard text.
  const markerPrefix = references.length ? '#' + crypto.randomUUID() + '/' : '';
  for (const reference of references) {
    const marker = markerPrefix + reference.from;
    byMarker.set(marker, reference);
    const destination = reference.raw.lastIndexOf('](<');
    parts.push(body.slice(offset, reference.from), reference.raw.slice(0, destination + 3), marker, '>)');
    offset = reference.to;
  }
  parts.push(body.slice(offset));
  return renderMarkdown(parts.join(''), { prefix: blockLinkPrefix, title, byMarker });
}

export function copyNotePreview(event: ClipboardEvent) {
  const root = event.currentTarget;
  const selection = window.getSelection();
  if (!(root instanceof HTMLElement) || !event.clipboardData || !selection?.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0).cloneRange();
  if (!root.contains(range.commonAncestorContainer)) return;
  const links = [...root.querySelectorAll('a[data-note-raw]')].filter(link => range.intersectsNode(link));
  if (!links.length) return;
  for (const link of links) {
    if (link.contains(range.startContainer)) range.setStartBefore(link);
    if (link.contains(range.endContainer)) range.setEndAfter(link);
  }
  const copy = document.createElement('div');
  copy.append(range.cloneContents());
  for (const link of copy.querySelectorAll<HTMLAnchorElement>('a[data-note-raw]')) link.replaceWith(link.dataset.noteRaw!);
  // innerText needs a rendered container to preserve paragraph and line boundaries.
  copy.style.cssText = 'position:fixed;left:-100000px;white-space:pre-wrap';
  document.body.append(copy);
  try {
    event.clipboardData.setData('text/plain', copy.innerText);
    event.preventDefault();
  } finally { copy.remove(); }
}
