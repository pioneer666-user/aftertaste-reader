import path from 'node:path';
import { isSourcePath } from '../core/source-path.js';

export interface ProjectMapping {
  readonly projectRoot: string;
  readonly repositoryRoot: string;
  readonly projectPrefix: string;
}

export interface FixedSource extends ProjectMapping {
  readonly commit: string;
}

export type ProjectSource = Pick<FixedSource, 'projectRoot' | 'commit'>;

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
  | 'GIT_READ_FAILED' | 'PRIVACY_CHECK_FAILED' | 'INTERNAL_ERROR';

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
  verifyCommit(source: FixedSource): Promise<void>;
  readFile(source: FixedSource, path: string): Promise<SourceFile>;
}

function isAbsoluteDirectory(value: unknown): value is string {
  return typeof value === 'string' && value.isWellFormed() && path.isAbsolute(value) &&
    (process.platform !== 'win32' || path.parse(value).root.length > 1) && !/[\x00-\x1f\x7f]/u.test(value);
}

export function validateProjectRoot(value: unknown): asserts value is string {
  if (!isAbsoluteDirectory(value)) {
    throw new SourceError('INVALID_ARGUMENT', '项目路径无效。', '提供完整绝对项目路径，Windows 需含盘符或 UNC 根。');
  }
}

export function validateSourcePath(value: unknown, context: ErrorContext = {}): asserts value is string {
  if (!isSourcePath(value)) {
    throw new SourceError('INVALID_PATH', '源码路径不符合项目相对路径约定。', '使用项目内以 / 分隔的规范相对路径。', context);
  }
}

export function checkedMapping(input: ProjectMapping): ProjectMapping {
  if (typeof input !== 'object' || input === null) throw new SourceError('INVALID_ARGUMENT', '缺少项目映射。', '完整复用 pin 的项目和仓库映射。');
  const { projectRoot, repositoryRoot, projectPrefix } = input;
  validateProjectRoot(projectRoot);
  validateProjectRoot(repositoryRoot);
  if (projectPrefix !== '') validateSourcePath(projectPrefix);
  if (projectRoot !== path.join(repositoryRoot, projectPrefix)) {
    throw new SourceError('INVALID_ARGUMENT', '项目和仓库映射不一致。', '完整复用 pin 的项目与仓库映射。', { reason: 'MAPPING_MISMATCH' });
  }
  return Object.freeze({ projectRoot, repositoryRoot, projectPrefix });
}

export function checkedFixedSource(input: FixedSource): FixedSource {
  const mapping = checkedMapping(input);
  if (typeof input.commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(input.commit)) {
    throw new SourceError('INVALID_ARGUMENT', '固定源码提交无效。', '完整复用 pin 的 commit。', { reason: 'INVALID_FIXED_SOURCE' });
  }
  return Object.freeze({ ...mapping, commit: input.commit });
}

export class FixedSourceService {
  constructor(private readonly repository: SourceRepository) {}

  async verify(input: FixedSource): Promise<FixedSource> {
    const fixed = checkedFixedSource(input);
    const project = await this.repository.locate(fixed.repositoryRoot);
    if (project.projectRoot !== fixed.repositoryRoot || project.repositoryRoot !== fixed.repositoryRoot || project.projectPrefix !== '') {
      throw new SourceError('INVALID_ARGUMENT', '固定引用的仓库根已失配。', '核对目标仓库与原固定引用。', { ...fixed, reason: 'MAPPING_MISMATCH' });
    }
    await this.repository.verifyCommit(fixed);
    return fixed;
  }

  async pin(projectRoot: string, revision: string = 'HEAD'): Promise<FixedSource> {
    validateProjectRoot(projectRoot);
    if (typeof revision !== 'string' || !revision.isWellFormed() || revision.length === 0 ||
        revision.startsWith('-') || /[\x00-\x1f\x7f]/u.test(revision)) {
      throw new SourceError('INVALID_ARGUMENT', '项目或版本参数无效。', '提供绝对项目路径及本地提交引用。');
    }
    const project = await this.repository.locate(projectRoot);
    const commit = await this.repository.resolveCommit(project, revision);
    return Object.freeze({ ...project, commit });
  }

  async read(source: FixedSource | ProjectSource, filePath: string): Promise<SourceFile> {
    if (typeof source !== 'object' || source === null || !isAbsoluteDirectory(source.projectRoot) ||
        typeof source.commit !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(source.commit)) {
      throw new SourceError('INVALID_ARGUMENT', '固定源码引用无效。', '复用 pin 返回的完整固定引用。', { reason: 'INVALID_FIXED_SOURCE' });
    }
    validateSourcePath(filePath, { projectRoot: source.projectRoot, commit: source.commit });
    const hasMapping = 'repositoryRoot' in source || 'projectPrefix' in source;
    const supplied = Object.freeze({ projectRoot: source.projectRoot, commit: source.commit,
      repositoryRoot: (source as FixedSource).repositoryRoot, projectPrefix: (source as FixedSource).projectPrefix });
    if (hasMapping) {
      if (!isAbsoluteDirectory(supplied.repositoryRoot) ||
          (supplied.projectPrefix !== '' && !isSourcePath(supplied.projectPrefix))) {
        throw new SourceError('INVALID_ARGUMENT', '固定源码映射字段无效。', '完整复用 pin 返回的仓库与项目前缀。', { reason: 'INVALID_FIXED_SOURCE' });
      }
      if (supplied.projectRoot !== path.join(supplied.repositoryRoot, supplied.projectPrefix)) {
        throw new SourceError('INVALID_ARGUMENT', '固定引用的根与前缀不一致。', '核对原固定引用的项目和仓库映射。', { reason: 'MAPPING_MISMATCH' });
      }
    }
    const request = hasMapping ? { ...supplied,
      repositoryPath: supplied.projectPrefix ? `${supplied.projectPrefix}/${filePath}` : filePath } :
      { projectRoot: supplied.projectRoot, commit: supplied.commit };
    try {
      const project = await this.repository.locate(hasMapping ? supplied.repositoryRoot : supplied.projectRoot);
      if (hasMapping && (project.projectRoot !== supplied.repositoryRoot || project.repositoryRoot !== supplied.repositoryRoot ||
          project.projectPrefix !== '')) {
        throw new SourceError('INVALID_ARGUMENT', '固定引用的仓库根已失配。', '核对目标仓库与原固定引用。', { reason: 'MAPPING_MISMATCH' });
      }
      const fixed = Object.freeze({ projectRoot: hasMapping ? supplied.projectRoot : project.projectRoot,
        repositoryRoot: project.repositoryRoot, projectPrefix: hasMapping ? supplied.projectPrefix : project.projectPrefix,
        commit: supplied.commit });
      return await this.repository.readFile(fixed, filePath);
    } catch (error) {
      if (error instanceof SourceError) {
        throw new SourceError(error.code, error.message, error.nextStep, {
          ...request, path: filePath,
          ...error.context,
          projectRoot: request.projectRoot,
        });
      }
      throw error;
    }
  }
}
