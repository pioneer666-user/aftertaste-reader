import { checkedMapping, FixedSourceService, SourceError, validateSourcePath } from './fixed-source.js';
import type { FixedSource, ProjectMapping } from './fixed-source.js';
import { checkDocument, generateSkeleton, parseDocument, physicalLineCount } from '../core/document-blocks.js';
import type { DocumentResult } from '../core/document-blocks.js';

export interface DocumentStore {
  create(projectRoot: string, documentPath: string, raw: string): Promise<void>;
  read(projectRoot: string, documentPath: string): Promise<string>;
}

const mirrorRoot = 'docs/aftertaste/current/';

export function sourcePathForDocument(documentPath: unknown): string {
  validateSourcePath(documentPath);
  if (!documentPath.startsWith(mirrorRoot) || !documentPath.endsWith('.md')) {
    throw new SourceError('INVALID_PATH', '文档路径不符合 current 镜像约定。', '提供项目相对的 docs/aftertaste/current/<源码路径>.md。');
  }
  const sourcePath = documentPath.slice(mirrorRoot.length, -3);
  validateSourcePath(sourcePath);
  return sourcePath;
}

export class DocumentService {
  constructor(private readonly sources: FixedSourceService, private readonly documents: DocumentStore) {}

  async create(input: FixedSource, sourcePath: string, blocks: unknown): Promise<DocumentResult> {
    const mapping = checkedMapping(input);
    const fixed = Object.freeze({ ...mapping, commit: input.commit });
    validateSourcePath(sourcePath);
    const file = await this.sources.read(fixed, sourcePath);
    const lineCount = physicalLineCount(file.content);
    const raw = generateSkeleton(file.commit, blocks, lineCount);
    const documentPath = `${mirrorRoot}${sourcePath}.md`;
    const result = { ...checkDocument(parseDocument(raw, documentPath), lineCount), sourcePath };
    await this.documents.create(mapping.projectRoot, documentPath, raw);
    return result;
  }

  async validate(input: ProjectMapping, documentPath: string): Promise<DocumentResult> {
    const mapping = checkedMapping(input);
    const sourcePath = sourcePathForDocument(documentPath);
    const raw = await this.documents.read(mapping.projectRoot, documentPath);
    const parsed = parseDocument(raw, documentPath);
    if (!parsed.commit) return { ...checkDocument(parsed), sourcePath };
    try {
      const file = await this.sources.read({ ...mapping, commit: parsed.commit }, sourcePath);
      return { ...checkDocument(parsed, physicalLineCount(file.content)), sourcePath };
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      const result = checkDocument(parsed);
      return { ...result, sourcePath, sourceCheck: 'unavailable', sourceError: {
        code: error.code, message: error.message, nextStep: error.nextStep, context: error.context,
      }, diagnostics: [...result.diagnostics, { code: 'SOURCE_UNAVAILABLE', severity: 'error',
        message: '固定源码不可读取，源码校验未完成。', nextStep: error.nextStep,
        documentPath, line: 1, params: { sourceCode: error.code } }] };
    }
  }
}
