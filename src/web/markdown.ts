import MarkdownIt from 'markdown-it';

interface InternalLinks {
  prefix: string;
  title: string;
}

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
const standardValidate = markdown.validateLink.bind(markdown);
markdown.validateLink = (url: string) => standardValidate(url) && /^(?:https?:|mailto:|#)/iu.test(url);
markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index]?.content ?? '');
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  const token = tokens[index]!;
  const href = token.attrGet('href');
  const links = env?.internalLinks as InternalLinks | undefined;
  if (links && typeof href === 'string' && href.startsWith(links.prefix)) {
    token.attrSet('class', 'note-block-link');
    token.attrSet('title', links.title);
  } else {
    token.attrSet('rel', 'noopener noreferrer');
    token.attrSet('target', '_blank');
  }
  return renderer.renderToken(tokens, index, options);
};

export function renderMarkdown(raw: string, internalLinks?: InternalLinks): string {
  return markdown.render(raw, { internalLinks });
}

export function blockLinkInsertion(body: string, link: string): string {
  if (!body) return link;
  const tail = markdown.parse(body + '\n\n' + link, {}).at(-1);
  // If the new paragraph is absorbed by an open fence, close the fence before adding it.
  if (tail?.type === 'fence') return `${body.endsWith('\n') ? '' : '\n'}${tail.markup}\n\n${link}`;
  return '\n\n' + link;
}
