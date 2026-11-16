import path from 'node:path';

export interface ProjectMapping {
  readonly projectRoot: string;
  readonly repositoryRoot: string;
  readonly projectPrefix: string;
}

export interface FixedSource extends ProjectMapping {
  readonly commit: string;
}

export interface SourceFile extends FixedSource {
  readonly path: string;
  readonly repositoryPath: string;
  readonly blob: string;
  readonly encoding: 'utf-8';
  readonly content: string;
}

export type ProblemCode =
  | 'INVALID_ARGUMENT' | 'INVALID_PATH' | 'PROJECT_UNAVAILABLE'
  | 'UNSUPPORTED_TARGET' | 'NOT_REPOSITORY' | 'GIT_UNAVAILABLE'
  | 'NO_COMMIT' | 'INVALID_REVISION' | 'OBJECT_UNAVAILABLE'
  | 'FILE_NOT_FOUND' | 'UNSUPPORTED_FILE_TYPE' | 'UNSUPPORTED_ENCODING'
  | 'GIT_READ_FAILED' | 'INTERNAL_ERROR';

export type ErrorContext = Readonly<Record<string, string | number>>;

export class SourceError extends Error {
  constructor(
    public readonly code: ProblemCode,
    message: string,
    public readonly nextStep: string,
    public readonly context: ErrorContext = {},
  ) {
    super(message);
    this.name = 'SourceError';
  }
}

export interface SourceRepository {
  locate(projectRoot: string): Promise<ProjectMapping>;
  resolveCommit(project: ProjectMapping, revision: string): Promise<string>;
  readFile(source: FixedSource, path: string): Promise<SourceFile>;
}

function isAbsoluteDirectory(value: unknown): value is string {
  return typeof value === 'string' && value.isWellFormed() && path.isAbsolute(value) && !/[\x00-\x1f\x7f]/u.test(value);
}

function isFilePath(value: unknown): value is string {
  return typeof value === 'string' && value.isWellFormed() && value.length > 0 &&
    !/[\\:\x00-\x1f\x7f]/u.test(value) &&
    value.split('/').every(part => part !== '' && part !== '.' && part !== '..' && part.toLowerCase() !== '.git');
}

export class FixedSourceService {
  constructor(private readonly repository: SourceRepository) {}

  async pin(projectRoot: string, revision: string = 'HEAD'): Promise<FixedSource> {
    if (!isAbsoluteDirectory(projectRoot) || typeof revision !== 'string' || !revision.isWellFormed() || revision.length === 0 ||
        revision.startsWith('-') || /[\x00-\x1f\x7f]/u.test(revision)) {
      throw new SourceError('INVALID_ARGUMENT', '项目或版本参数无效。', '提供绝对项目路径及本地提交引用。');
    }
    const project = await this.repository.locate(projectRoot);
    const commit = await this.repository.resolveCommit(project, revision);
    return Object.freeze({ ...project, commit });
  }

  async read(source: FixedSource, filePath: string): Promise<SourceFile> {
    if (typeof source !== 'object' || source === null || !isAbsoluteDirectory(source.projectRoot) ||
        !isAbsoluteDirectory(source.repositoryRoot) || typeof source.commit !== 'string' ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(source.commit) ||
        (source.projectPrefix !== '' && !isFilePath(source.projectPrefix))) {
      throw new SourceError('INVALID_ARGUMENT', '固定源码引用无效。', '复用 pin 返回的完整固定引用。');
    }
    if (!isFilePath(filePath)) {
      throw new SourceError('INVALID_PATH', '源码路径不符合项目相对路径约定。', '使用项目内以 / 分隔的规范相对路径。', {
        projectRoot: source.projectRoot, commit: source.commit,
      });
    }
    const fixed = Object.freeze({ projectRoot: source.projectRoot, repositoryRoot: source.repositoryRoot,
      projectPrefix: source.projectPrefix, commit: source.commit });
    try {
      const project = await this.repository.locate(fixed.projectRoot);
      if (project.projectRoot !== fixed.projectRoot || project.repositoryRoot !== fixed.repositoryRoot ||
          project.projectPrefix !== fixed.projectPrefix) {
        throw new SourceError('INVALID_ARGUMENT', '固定引用的项目映射已失配。', '核对目标仓库与原固定引用。');
      }
      return await this.repository.readFile(fixed, filePath);
    } catch (error) {
      if (error instanceof SourceError) {
        throw new SourceError(error.code, error.message, error.nextStep, {
          ...fixed, path: filePath, repositoryPath: fixed.projectPrefix ? `${fixed.projectPrefix}/${filePath}` : filePath,
          ...error.context,
        });
      }
      throw error;
    }
  }
}
