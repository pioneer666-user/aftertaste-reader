import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
const standardValidate = markdown.validateLink.bind(markdown);
markdown.validateLink = (url: string) => standardValidate(url) && /^(?:https?:|mailto:|#)/iu.test(url);
markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index]?.content ?? '');
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index]!.attrSet('rel', 'noopener noreferrer');
  tokens[index]!.attrSet('target', '_blank');
  return renderer.renderToken(tokens, index, options);
};

export function renderMarkdown(raw: string): string {
  return markdown.render(raw);
}
