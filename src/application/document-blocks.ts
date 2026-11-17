import { checkedMapping, FixedSourceService, SourceError, validateProjectRoot, validateSourcePath } from './fixed-source.js';
import type { FixedSource, ProjectMapping } from './fixed-source.js';
import { checkDocument, DocumentError, generateSkeleton, parseDocument, physicalLineCount } from '../core/document-blocks.js';
import type { DocumentResult } from '../core/document-blocks.js';

export interface DocumentStore {
  create(projectRoot: string, documentPath: string, raw: string): Promise<void>;
  read(projectRoot: string, documentPath: string): Promise<string>;
}

export interface ReadingDocument extends DocumentResult {
  readonly sourceLines?: readonly string[];
}

const mirrorRoot = 'docs/aftertaste/current/';

export function sourcePathForDocument(documentPath: unknown): string {
  validateSourcePath(documentPath);
  if (!documentPath.startsWith(mirrorRoot) || !documentPath.endsWith('.md')) {
    throw new SourceError('INVALID_PATH', '文档路径不符合 current 镜像约定。', '提供项目相对的 docs/aftertaste/current/<源码路径>.md。');
  }
  const sourcePath = documentPath.slice(mirrorRoot.length, -3);
  validateSourcePath(sourcePath);
  if (process.platform === 'win32' && documentPath.split('/').some(part =>
    /[<>"|?*]/u.test(part) || /[. ]$/u.test(part) || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(part))) {
    throw new SourceError('INVALID_PATH', '文档路径含 Windows 不支持的名称。', '使用没有设备名、尾点、尾空格或保留符号的镜像路径。');
  }
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
    const { sourceLines: _, ...result } = await this.read(mapping, documentPath);
    return result;
  }

  async read(input: ProjectMapping | Pick<ProjectMapping, 'projectRoot'>, documentPath: string): Promise<ReadingDocument> {
    const mapping = 'repositoryRoot' in input || 'projectPrefix' in input ? checkedMapping(input as ProjectMapping) :
      Object.freeze({ projectRoot: input.projectRoot });
    validateProjectRoot(mapping.projectRoot);
    const sourcePath = sourcePathForDocument(documentPath);
    let raw: string;
    try { raw = await this.documents.read(mapping.projectRoot, documentPath); }
    catch (error) {
      if (error instanceof DocumentError) throw new DocumentError(error.code, error.message, error.nextStep, { ...error.context, sourcePath });
      throw error;
    }
    const parsed = parseDocument(raw, documentPath);
    if (!parsed.commit) return { ...checkDocument(parsed), sourcePath };
    try {
      const file = await this.sources.read({ ...mapping, commit: parsed.commit }, sourcePath);
      const lineCount = physicalLineCount(file.content);
      const sourceLines = file.content.split(/\r\n|\r|\n/u).slice(0, lineCount);
      return { ...checkDocument(parsed, lineCount), sourcePath, sourceLines };
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
