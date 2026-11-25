import path from 'node:path';
import { DocumentError, explanationSize, physicalLineCount } from '../core/document-blocks.js';
import { isLoopId, loopFormat, LoopError, parseLoopInput, parseSavedLoop } from '../core/loops.js';
import type { SavedLoop } from '../core/loops.js';
import type { GraphService } from './dependency-graph.js';
import type { DocumentService, ReadingDocument } from './document-blocks.js';
import { checkedFixedSource, FixedSourceService, SourceError, validateProjectRoot } from './fixed-source.js';
import type { ErrorContext, FixedSource } from './fixed-source.js';

export interface LoopStore {
  create(projectRoot: string, id: string, raw: string): Promise<void>;
  read(projectRoot: string, id: string): Promise<{ raw: string; projectRoot: string }>;
}

type SourceIssue = Pick<SourceError, 'code' | 'message' | 'nextStep' | 'context'>;
type NodeSource =
  | { node_id: string; status: 'not-applicable' }
  | { node_id: string; status: 'available'; lines: string[] }
  | { node_id: string; status: 'unavailable'; error: SourceIssue };

export interface ReadingLoop {
  loop: SavedLoop;
  sources: NodeSource[];
  sourceCheck: 'completed' | 'unavailable';
  mechanicallyValid: boolean;
  teachingQuality: 'unchecked';
}

export function checkLoopId(id: string): void {
  if (!isLoopId(id)) throw new SourceError('INVALID_ARGUMENT', '闭环 ID 无效。', '使用支持的小写名称，避开设备名。', { loopId: id });
}

const documentPath = (filePath: string) => `docs/aftertaste/current/${filePath}.md`;

function blockError(context: ErrorContext, reason: string, details: ErrorContext = {}): LoopError {
  return new LoopError('LOOP_BLOCK_INVALID', '闭环引用的讲解块无法使用。', '核对所指文档的固定版本、块与校验结果。', { ...details, ...context, reason });
}

export class LoopService {
  constructor(private readonly sources: FixedSourceService, private readonly documents: DocumentService,
    private readonly graphs: Pick<GraphService, 'queryLegends'>, private readonly store: LoopStore) {}

  async create(source: FixedSource, id: string, value: unknown) {
    checkLoopId(id);
    const fixed = checkedFixedSource(source);
    const { nodes, legends, ...route } = parseLoopInput(value);
    await this.sources.verify(fixed);
    const documents = new Map<string, ReadingDocument>();
    const savedNodes: SavedLoop['nodes'] = [];
    for (const node of nodes) {
      const document = documentPath(node.path);
      const context = { nodeId: node.id, documentPath: document, path: node.path, blockId: node.block_id, commit: fixed.commit };
      let result = documents.get(document);
      if (!result) {
        try { result = await this.documents.read(fixed, document); }
        catch (error) {
          if (error instanceof SourceError || error instanceof DocumentError) {
            throw blockError(context, error.code, { ...error.context, ...(error.context.reason ? { cause: error.context.reason } : {}) });
          }
          throw error;
        }
        if (result.commit && result.commit !== fixed.commit) throw blockError(context, 'VERSION_MISMATCH', { actualCommit: result.commit });
        if (result.sourceError) throw blockError(context, result.sourceError.code, result.sourceError.context);
        if (!result.mechanicallyValid) {
          const diagnostic = result.diagnostics.find(item => item.severity === 'error');
          throw blockError(context, diagnostic?.code ?? 'DOCUMENT_INVALID', { ...diagnostic?.params, ...(diagnostic?.line ? { documentLine: diagnostic.line } : {}) });
        }
        documents.set(document, result);
      }
      const block = result.blocks.find(block => block.id === node.block_id);
      if (!block) throw blockError(context, 'BLOCK_NOT_FOUND');
      if (!block.body.trim() || explanationSize(block.body) === 0) throw blockError(context, 'EXPLANATION_EMPTY');
      savedNodes.push({ ...node, block_explanation: block.body, ...(block.lines ? { lines: block.lines } : {}) });
    }
    const library = legends.length ? (await this.graphs.queryLegends(fixed)).legends : [];
    const savedLegends = legends.map(selection => {
      const legend = library.find(legend => legend.id === selection.id);
      const invalidLegend = (filePath?: string) => new LoopError('LOOP_LEGEND_INVALID', '闭环图例或指定用法不在固定版本文件图中。',
        '查询该版本图例和参与文件的用法后重新选择。', { legendId: selection.id, ...(filePath ? { path: filePath } : {}) });
      if (!legend) throw invalidLegend();
      const uses = selection.paths.map(filePath => {
        const use = legend.uses.find(use => use.path === filePath);
        if (!use) throw invalidLegend(filePath);
        return use;
      });
      return { ...legend, uses };
    });
    const loop: SavedLoop = { format: loopFormat, id, source_commit: fixed.commit, project_prefix: fixed.projectPrefix,
      ...route, nodes: savedNodes, legends: savedLegends };
    await this.store.create(fixed.projectRoot, id, JSON.stringify(loop, null, 2) + '\n');
    return { id, path: `docs/aftertaste/loops/${id}/current/loop.json`, source_commit: fixed.commit,
      mechanicallyValid: true, teachingQuality: 'unchecked' as const };
  }

  async read(projectRoot: string, id: string): Promise<ReadingLoop> {
    validateProjectRoot(projectRoot);
    checkLoopId(id);
    const saved = await this.store.read(projectRoot, id);
    return this.readSources(saved.projectRoot, parseSavedLoop(saved.raw, id));
  }

  async readSources(projectRoot: string, loop: SavedLoop, verifyStep?: string): Promise<ReadingLoop> {
    const projectPrefix = loop.project_prefix;
    const repositoryRoot = path.resolve(projectRoot, ...projectPrefix.split('/').filter(Boolean).map(() => '..'));
    const fixed = { projectRoot, repositoryRoot, projectPrefix, commit: loop.source_commit };
    const step = verifyStep && loop.nodes.find(node => node.id === verifyStep);
    if (step && !step.lines) await this.sources.read(fixed, step.path);
    const files = new Map<string, string[] | SourceError>();
    const sources: NodeSource[] = [];
    for (const node of loop.nodes) {
      const node_id = node.id;
      if (!node.lines) {
        sources.push({ node_id, status: 'not-applicable' });
        continue;
      }
      let file = files.get(node.path);
      if (!file) {
        try {
          const source = await this.sources.read(fixed, node.path);
          file = source.content.split(/\r\n|\r|\n/u).slice(0, physicalLineCount(source.content));
        } catch (error) {
          if (!(error instanceof SourceError)) throw error;
          file = error;
        }
        files.set(node.path, file);
      }
      const { start, end } = node.lines;
      const problem = file instanceof SourceError ? file : end > file.length ?
        new SourceError('INVALID_ARGUMENT', '保存的行范围超出固定文件。', '核对闭环中保存的行范围。', { reason: 'SOURCE_BOUNDS', lineCount: file.length }) : undefined;
      if (problem) {
        sources.push({ node_id, status: 'unavailable', error: { code: problem.code, message: problem.message,
          nextStep: problem.nextStep, context: { ...fixed, path: node.path, ...problem.context, nodeId: node.id,
            documentPath: documentPath(node.path), blockId: node.block_id, start, end } } });
      } else if (Array.isArray(file)) sources.push({ node_id, status: 'available', lines: file.slice(start - 1, end) });
    }
    const mechanicallyValid = sources.every(source => source.status !== 'unavailable');
    return { loop, sources, mechanicallyValid, sourceCheck: mechanicallyValid ? 'completed' : 'unavailable', teachingQuality: 'unchecked' };
  }
}

function oneLine(value: string): string {
  return value.trim().replace(/[\r\n]+/gu, ' ');
}

function inlineCode(value: string): string {
  const fence = '`'.repeat(Math.max(0, ...Array.from(value.matchAll(/`+/gu), match => match[0].length)) + 1);
  return fence.length === 1 ? `${fence}${value}${fence}` : `${fence} ${value} ${fence}`;
}

function edgeNote({ label, color }: import('../core/edge-annotation.js').EdgeAnnotation): string {
  return [label && inlineCode(label), color && ({ red: '红色', green: '绿色', theme: '主题色' })[color]]
    .filter(Boolean).map(part => ' · ' + part).join('');
}

export function loopMarkdown(result: ReadingLoop): string {
  const { loop, sources } = result;
  const nodes = new Map(loop.nodes.map(node => [node.id, node]));
  const title = (id: string) => oneLine(nodes.get(id)!.title);
  const problems = new Map(sources.filter(source => source.status === 'unavailable').map(source => [source.node_id, source.error]));
  const parts = [`# ${oneLine(loop.title)}`, loop.goal, `固定提交 ${inlineCode(loop.source_commit)}`, loop.explanation,
    '## 推荐阅读顺序', `从 **${title(loop.entry)}** 进入。`];
  const blocks = new Map<string, { reference: string; explanation: string }>();
  for (const [index, nodeId] of loop.reading_order.entries()) {
    const node = nodes.get(nodeId)!;
    const ref = [inlineCode(node.path), `块 ${inlineCode(node.block_id)}`,
      node.lines ? `第 ${node.lines.start}–${node.lines.end} 行` : '纯讲解'].join(' · ');
    parts.push(`### ${index + 1}. ${title(nodeId)}`, ref, node.explanation);
    for (const use of node.library_uses ?? []) parts.push(`**${oneLine(loop.legends.find(legend => legend.id === use.id)!.name)}**${edgeNote(use)} ${use.reason}`);
    if (node.annotation) parts.push('**节点说明**', node.annotation);
    if (node.hint) parts.push(`**提示** ${node.hint}`);
    const problem = problems.get(nodeId);
    if (problem) parts.push(`**固定源码不可用** ${problem.code} · ${problem.message} ${problem.nextStep}\n\n仓库 ${inlineCode(String(problem.context.repositoryRoot))}`);
    const blockKey = `${node.path}:${node.block_id}`;
    if (!blocks.has(blockKey)) blocks.set(blockKey, { reference: ref, explanation: node.block_explanation });
  }
  parts.push('## 关系', loop.edges.map(edge => `- **${title(edge.from)} → ${title(edge.to)}**${edgeNote(edge)}\n\n  ${edge.reason.trim().replace(/\r\n|\r|\n/gu, '\n  ')}`).join('\n\n'));
  if (loop.legends.length) {
    parts.push('## 图例');
    for (const legend of loop.legends) {
      parts.push(`### ${oneLine(legend.name)}`, legend.description, legend.uses.map(use =>
        `- ${inlineCode(use.path)}${edgeNote(use)} · ${use.reason.trim().replace(/\r\n|\r|\n/gu, '\n  ')}`).join('\n'));
    }
  }
  parts.push('## 保存的原块讲解');
  for (const block of blocks.values()) {
    parts.push(block.reference, block.explanation.trimEnd().split(/\r\n|\r|\n/u).map(line => line.trim() ? '> ' + line : '>').join('\n'));
  }
  return parts.join('\n\n') + '\n';
}
