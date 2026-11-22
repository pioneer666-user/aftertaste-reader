import { fromMarkdown } from 'mdast-util-from-markdown';
import type { RootContent } from 'mdast';
import { blockLinkPrefix, blockTarget } from '../core/notes.js';

// Use Markdown source positions so the clipboard retains the original entity and path encoding.
export function noteReferences(body: string) {
  const references: { from: number; to: number; label: string; source: string; href: string; raw: string }[] = [];
  if (!body.includes(blockLinkPrefix)) return references;
  function visit(node: RootContent) {
    if (node.type === 'link') {
      const target = blockTarget(node.url);
      const from = node.position?.start.offset, to = node.position?.end.offset;
      if (target && from !== undefined && to !== undefined && node.children.every(child => child.type === 'text')) {
        const raw = body.slice(from, to);
        if (raw.startsWith('[') && raw.includes('](<' + blockLinkPrefix) && raw.endsWith('>)')) {
          const label = node.children.map(child => child.type === 'text' ? child.value : '').join('');
          const source = target.documentPath.slice('docs/aftertaste/current/'.length, -3) + ' · ' + target.blockId;
          references.push({ from, to, label, source, href: node.url, raw });
        }
      }
    } else if ('children' in node) node.children.forEach(visit);
  }
  fromMarkdown(body).children.forEach(visit);
  return references;
}

export type NoteReference = ReturnType<typeof noteReferences>[number];
