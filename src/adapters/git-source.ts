import { execFile } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { SourceError } from '../application/fixed-source.js';
import type { ErrorContext, FixedSource, ProjectMapping, SourceFile, SourceRepository } from '../application/fixed-source.js';

interface GitResult {
  stdout: Buffer;
  status: number;
}

async function git(cwd: string, args: string[]): Promise<GitResult> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
  return new Promise((resolve, reject) => {
    execFile('git', ['--no-lazy-fetch', '--no-optional-locks', '--no-replace-objects', '--literal-pathspecs',
      '-c', 'core.fsmonitor=false', '-C', cwd, ...args], {
      env: { ...env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' },
      encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 30_000, windowsHide: true,
    }, (error, stdout) => {
      if (error && typeof error.code !== 'number') {
        const code = error.code === 'ENOENT' ? 'GIT_UNAVAILABLE' : 'GIT_READ_FAILED';
        reject(new SourceError(code, 'Git 进程无法完成读取。', '检查 Git 安装、权限及输出限制。', {
          repositoryRoot: cwd, operation: args[0] ?? 'git', reason: error.code ?? 'PROCESS_INTERRUPTED',
        }));
        return;
      }
      if (error?.killed) {
        reject(new SourceError('GIT_READ_FAILED', 'Git 读取被中断。', '检查 Git 读取耗时和对象可读性。', {
          repositoryRoot: cwd, operation: args[0] ?? 'git', reason: 'PROCESS_INTERRUPTED',
        }));
        return;
      }
      resolve({ stdout, status: error && typeof error.code === 'number' ? error.code : 0 });
    });
  });
}

function requireSuccess(result: GitResult, context: ErrorContext): Buffer {
  if (result.status !== 0) {
    throw new SourceError('GIT_READ_FAILED', 'Git 无法读取所需对象。', '核对 Git 2.45+、本地对象和仓库访问权限。', {
      ...context, status: result.status,
    });
  }
  return result.stdout;
}

async function checkDirectory(directory: string): Promise<string> {
  const resolved = path.resolve(directory);
  let current = resolved;
  try {
    while (true) {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new SourceError('UNSUPPORTED_TARGET', '项目路径包含链接或 junction。', '直接指定普通目录的真实项目路径。', { projectRoot: directory });
      }
      if (!entry.isDirectory()) {
        throw new SourceError('PROJECT_UNAVAILABLE', '项目路径不是目录。', '指定现存项目目录。', { projectRoot: directory });
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return await realpath(resolved);
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError('PROJECT_UNAVAILABLE', '项目目录无法访问。', '核对目录存在性与访问权限。', { projectRoot: directory });
  }
}

export class GitSourceRepository implements SourceRepository {
  async locate(projectRoot: string): Promise<ProjectMapping> {
    const canonicalProject = await checkDirectory(projectRoot);
    let repositoryRoot = canonicalProject;
    while (true) {
      try {
        const marker = await lstat(path.join(repositoryRoot, '.git'));
        if (!marker.isDirectory() || marker.isSymbolicLink()) {
          throw new SourceError('UNSUPPORTED_TARGET', '该目标使用 Git 文件或链接目录。', '使用普通本地仓库，子模块和 linked worktree 目标暂不支持。', { projectRoot });
        }
        break;
      } catch (error) {
        if (error instanceof SourceError) throw error;
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
          throw new SourceError('PROJECT_UNAVAILABLE', 'Git 目录无法访问。', '核对仓库目录访问权限。', { projectRoot });
        }
      }
      const parent = path.dirname(repositoryRoot);
      if (parent === repositoryRoot) {
        throw new SourceError('NOT_REPOSITORY', '项目不在受支持的 Git 仓库中。', '指定普通本地 Git 仓库内的项目目录。', { projectRoot });
      }
      repositoryRoot = parent;
    }
    const bare = await git(canonicalProject, ['rev-parse', '--is-bare-repository']);
    if (bare.status === 0 && bare.stdout.toString('ascii').trim() === 'true') {
      throw new SourceError('UNSUPPORTED_TARGET', 'bare 仓库没有受支持的项目工作区。', '指定普通本地仓库内的项目目录。', { projectRoot });
    }
    const projectPrefix = path.relative(repositoryRoot, canonicalProject).split(path.sep).join('/');
    if (projectPrefix.split('/').some(part => part.toLowerCase() === '.git')) {
      throw new SourceError('UNSUPPORTED_TARGET', 'Git 元数据目录不能作为源码项目。', '指定仓库内的普通项目目录。', { projectRoot, repositoryRoot });
    }
    const result = await git(repositoryRoot, ['rev-parse', '--show-toplevel']);
    const reportedRoot = requireSuccess(result, { projectRoot, repositoryRoot, operation: 'locate' }).toString('utf8').replace(/\r?\n$/u, '');
    if (await checkDirectory(reportedRoot) !== repositoryRoot) {
      throw new SourceError('UNSUPPORTED_TARGET', 'Git 工作区根与项目映射不一致。', '指定普通本地仓库内的真实项目目录。', { projectRoot, repositoryRoot });
    }
    return { projectRoot: canonicalProject, repositoryRoot, projectPrefix };
  }

  async resolveCommit(project: ProjectMapping, revision: string): Promise<string> {
    const result = await git(project.repositoryRoot, ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`]);
    if (result.status !== 0) {
      // An unborn HEAD has a symbolic branch name whose ref does not exist yet.
      const symbolic = await git(project.repositoryRoot, ['symbolic-ref', '-q', 'HEAD']);
      const branch = symbolic.stdout.toString('utf8').trim();
      const reference = branch ? await git(project.repositoryRoot, ['show-ref', '--verify', '--quiet', branch]) : undefined;
      const unborn = revision === 'HEAD' && symbolic.status === 0 && reference?.status === 1;
      throw new SourceError(unborn ? 'NO_COMMIT' : 'INVALID_REVISION', '无法固定指定的本地提交。',
        unborn ? '先由用户准备本地提交。' : '核对本地提交引用及对象可读性。', { ...project, revision, status: result.status });
    }
    const commit = result.stdout.toString('ascii').trim();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit)) {
      throw new SourceError('GIT_READ_FAILED', 'Git 返回的提交标识无效。', '检查 Git 对象格式。', { ...project, revision });
    }
    return commit;
  }

  async readFile(source: FixedSource, filePath: string): Promise<SourceFile> {
    const repositoryPath = source.projectPrefix ? `${source.projectPrefix}/${filePath}` : filePath;
    const context = { ...source, path: filePath, repositoryPath };
    const type = await git(source.repositoryRoot, ['cat-file', '-t', source.commit]);
    if (type.status !== 0 || type.stdout.toString('ascii').trim() !== 'commit') {
      throw new SourceError('OBJECT_UNAVAILABLE', '固定提交对象不可读取。', '核对原仓库中的本地提交对象。', { ...context, operation: 'commit', status: type.status });
    }
    let tree = `${source.commit}^{tree}`;
    const parts = repositoryPath.split('/');
    let blob = '';
    for (const [index, part] of parts.entries()) {
      const result = await git(source.repositoryRoot, ['ls-tree', '-z', tree, '--', part]);
      const entry = requireSuccess(result, { ...context, operation: 'tree' });
      if (entry.length === 0) {
        throw new SourceError('FILE_NOT_FOUND', '固定提交中不存在指定文件。', '核对该提交的项目相对路径。', context);
      }
      const header = entry.subarray(0, entry.indexOf(9)).toString('ascii');
      const match = /^(\d{6}) (blob|tree|commit) ([a-f0-9]{40}|[a-f0-9]{64})$/u.exec(header);
      if (!match) {
        throw new SourceError('GIT_READ_FAILED', 'Git 树条目无法解析。', '检查 Git 对象完整性。', context);
      }
      const [, mode, kind, oid] = match;
      const last = index === parts.length - 1;
      if (last ? kind !== 'blob' || (mode !== '100644' && mode !== '100755') : kind !== 'tree') {
        throw new SourceError('UNSUPPORTED_FILE_TYPE', '指定路径包含不支持的 Git 条目类型。', '选择普通文件，排除链接、子模块和目录。', context);
      }
      tree = oid!;
      blob = oid!;
    }
    const bytes = requireSuccess(await git(source.repositoryRoot, ['cat-file', 'blob', blob]), { ...context, operation: 'blob' });
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(content)) throw new Error('binary');
    } catch {
      throw new SourceError('UNSUPPORTED_ENCODING', '文件不符合本批 UTF-8 文本约定。', '选择严格 UTF-8 且不含二进制控制字节的文本。', context);
    }
    return { ...source, path: filePath, repositoryPath, blob, encoding: 'utf-8', content };
  }
}
