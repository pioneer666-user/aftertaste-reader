import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFile, lstat, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { SourceError, validateProjectRoot } from '../application/fixed-source.js';
import type { ProjectMapping } from '../application/fixed-source.js';
import { isSourcePath } from '../core/source-path.js';
import { dataDirectory, systemCode } from './data-directory.js';
import { GitSourceRepository } from './git-source.js';

const visibility = ['ignored', 'unignored', 'tracked'] as const;
type Visibility = typeof visibility[number];
type Visible = Exclude<Visibility, 'ignored'>;
type Grant = { path: string; status: Visible };

const invalid = (message: string) => new SourceError('INVALID_ARGUMENT', message, '按 project-privacy 契约提供项目与本批资料路径。');
const failed = (step: string, reason: string) => new SourceError('PRIVACY_CHECK_FAILED', '无法判定或更新 Git 可见性设置。',
  '核对该步骤和路径；检查失败时先保留项目资料原状。', { step, reason });

function isDataPath(value: unknown): value is string {
  return isSourcePath(value) && value.startsWith('docs/aftertaste/') && value.split('/').every(segment =>
    process.platform !== 'win32' || (!/[<>"|?*]/u.test(segment) && !/[. ]$/u.test(segment) &&
      !/^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:[ .]|$)/iu.test(segment)));
}

function isGrant(value: unknown): value is Grant {
  return typeof value === 'object' && value !== null && 'path' in value && isDataPath(value.path) &&
    'status' in value && (value.status === 'unignored' || value.status === 'tracked');
}

const repoOverrides = new Set(['GIT_PREFIX', 'GIT_INTERNAL_SUPER_PREFIX', 'GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS',
  'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS']);

async function git(cwd: string, args: string[], input?: string): Promise<string> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !repoOverrides.has(key.toUpperCase())));
  return new Promise((resolve, reject) => {
    const child = execFile('git', ['--no-optional-locks', '--no-lazy-fetch', '-C', cwd, ...args],
      { env, encoding: 'buffer', windowsHide: true, timeout: 30_000, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
        const step = args[0]!;
        if ((error && !(step === 'check-ignore' && error.code === 1 && !error.killed)) ||
            (stderr.length > 0 && step !== 'config')) {
          reject(failed(step, String(error?.code ?? 'GIT_WARNING')));
          return;
        }
        try { resolve(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(stdout)); }
        catch { reject(failed(step, 'NOT_UTF8')); }
      });
    child.stdin?.on('error', () => {});
    child.stdin?.end(input);
  });
}

async function inspect(project: ProjectMapping, paths: string[]) {
  const { projectRoot, repositoryRoot, projectPrefix } = project;
  const actual = await git(projectRoot, ['rev-parse', '--path-format=absolute', '--show-toplevel', '--absolute-git-dir', '--git-common-dir']);
  const [root, gitDir, common, extra] = actual.replace(/\r?\n$/u, '').split(/\r?\n/u);
  const metadata = path.join(repositoryRoot, '.git');
  if (!root || !gitDir || !common || extra !== undefined || await realpath(root) !== repositoryRoot ||
      await realpath(gitDir) !== metadata || await realpath(common) !== metadata) throw failed('rev-parse', 'MAPPING_MISMATCH');
  const repositoryPaths = paths.map(file => projectPrefix ? `${projectPrefix}/${file}` : file);
  for (const file of paths) await checkTarget(projectRoot, file);

  const caseInsensitive = process.platform === 'win32' ||
    (await git(repositoryRoot, ['config', '--type=bool', '--default=false', '--get', 'core.ignoreCase'])).trim() === 'true';
  const key = (value: string) => caseInsensitive ? value.toLowerCase() : value;
  const index = await git(repositoryRoot, ['ls-files', '--cached', '--stage', '-z']);
  const entries = new Set<string>();
  const indexedParents = new Set<string>();
  for (const entry of index.split('\0').filter(Boolean)) {
    const file = key(entry.slice(entry.indexOf('\t') + 1));
    entries.add(file);
    for (let end = file.lastIndexOf('/'); end !== -1; end = file.lastIndexOf('/', end - 1)) {
      indexedParents.add(file.slice(0, end));
    }
  }
  const tracked = new Set<string>();
  for (const file of repositoryPaths) {
    const identity = key(file);
    if (indexedParents.has(identity)) throw failed(file, 'INDEX_DIRECTORY');
    for (let end = identity.lastIndexOf('/'); end !== -1; end = identity.lastIndexOf('/', end - 1)) {
      if (entries.has(identity.slice(0, end))) throw failed(file, 'INDEX_ANCESTOR');
    }
    if (entries.has(identity)) tracked.add(file);
  }
  const untracked = repositoryPaths.filter(file => !tracked.has(file));
  const ignored = new Set(untracked.length ? (await git(repositoryRoot, ['check-ignore', '--no-index', '-z', '--stdin'],
    untracked.join('\0') + '\0')).split('\0') : []);
  return paths.map((file, i) => {
    const repositoryPath = repositoryPaths[i]!;
    const status: Visibility = tracked.has(repositoryPath) ? 'tracked' : ignored.has(repositoryPath) ? 'ignored' : 'unignored';
    return { path: file, repositoryPath, status };
  });
}

async function checkTarget(root: string, file: string) {
  const parts = file.split('/');
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    try {
      const item = await lstat(current);
      if (item.isSymbolicLink() || (index === parts.length - 1 ? !item.isFile() : !item.isDirectory())) {
        throw failed(file, 'UNSAFE_PATH');
      }
    } catch (error) {
      if (systemCode(error) === 'ENOENT') return;
      throw error;
    }
    if (index < parts.length - 1) {
      try {
        await lstat(path.join(current, '.git'));
        throw failed(file, 'NESTED_REPOSITORY');
      } catch (error) {
        if (systemCode(error) !== 'ENOENT') throw error;
      }
    }
  }
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

async function grantPath(project: ProjectMapping, create = false): Promise<string> {
  const { projectRoot, repositoryRoot } = project;
  const base = process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local'), 'Aftertaste Reader', 'state')
    : path.join(process.env.XDG_STATE_HOME && path.isAbsolute(process.env.XDG_STATE_HOME) ? process.env.XDG_STATE_HOME :
      path.join(homedir(), '.local', 'state'), 'aftertaste-reader');
  const root = path.parse(base).root;
  if (!root || isInside(repositoryRoot, base)) throw failed('state', 'STATE_INSIDE_REPOSITORY');
  const unsafe = () => failed('state', 'UNSAFE_STATE_PATH');
  const directory = await dataDirectory(root, base.slice(root.length).split(path.sep), create, unsafe);
  if (isInside(repositoryRoot, directory)) throw unsafe();
  const identities = await Promise.all([path.join(repositoryRoot, '.git'), projectRoot].map(async location => {
    const item = await lstat(location, { bigint: true });
    return [location, String(item.dev), String(item.ino), String(item.birthtimeNs)];
  }));
  const id = createHash('sha256').update(JSON.stringify(identities)).digest('hex');
  return path.join(directory, `git-visibility-${id}.json`);
}

async function readGrants(file: string): Promise<Grant[]> {
  try {
    const item = await lstat(file);
    if (!item.isFile() || item.nlink !== 1 || (process.getuid && (item.uid !== process.getuid() || (item.mode & 0o022) !== 0))) {
      throw failed('state', 'UNSAFE_STATE_FILE');
    }
    const input: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(input) || !input.every(isGrant) || new Set(input.map(grant => grant.path)).size !== input.length) {
      throw failed('state', 'INVALID_STATE');
    }
    return input;
  } catch (error) {
    if (systemCode(error) === 'ENOENT') return [];
    throw error;
  }
}

function stateBusy(lock: string) {
  return new SourceError('PRIVACY_CHECK_FAILED', '本机 Git 许可正在更新或有遗留锁，不能复用旧许可。',
    '等待进行中的许可操作结束。确认没有许可命令运行后，可删除所示遗留锁，再重新撤销或记住。',
    { step: 'state', reason: 'STATE_BUSY', lock });
}

async function requireUnlocked(file: string): Promise<void> {
  const lock = file + '.lock';
  try { await lstat(lock); }
  catch (error) {
    if (systemCode(error) === 'ENOENT') return;
    throw error;
  }
  throw stateBusy(lock);
}

async function updateGrants(project: ProjectMapping, grants?: Grant[]): Promise<void> {
  const target = await grantPath(project, !!grants);
  const lock = target + '.lock';
  try { await writeFile(lock, '', { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (systemCode(error) === 'EEXIST') throw stateBusy(lock);
    throw error;
  }
  try {
    if (!grants) {
      await unlink(target).catch(error => { if (systemCode(error) !== 'ENOENT') throw error; });
      return;
    }
    const saved = new Map((await readGrants(target)).map(grant => [grant.path, grant]));
    for (const grant of grants) saved.set(grant.path, grant);
    const temporary = target + '.' + randomUUID();
    try {
      await writeFile(temporary, JSON.stringify([...saved.values()]) + '\n', { flag: 'wx', mode: 0o600 });
      await rename(temporary, target);
    } finally { await unlink(temporary).catch(() => {}); }
  } finally { await unlink(lock); }
}

export async function projectPrivacy(projectRoot: string, action: string, payload: unknown) {
  validateProjectRoot(projectRoot);
  const project = await new GitSourceRepository().locate(projectRoot);
  try {
    if (action === 'forget') {
      try { await updateGrants(project); }
      catch (error) { if (systemCode(error) !== 'ENOENT') throw error; }
      return { ...project, forgotten: true };
    }
    const items = Array.isArray(payload) ? payload as unknown[] : [];
    const grants = action === 'remember' && items.every(isGrant) ? items as Grant[] : undefined;
    const paths: unknown[] = grants ? grants.map(grant => grant.path) : items;
    if (!paths.length || !paths.every(isDataPath) || new Set(paths).size !== paths.length || (action === 'remember' && !grants)) {
      throw invalid('需提供非空、不重复的资料文件路径；记住许可时须带实际 Git 状态。');
    }
    const files = await inspect(project, paths);
    if (grants) {
      if (files.some((file, i) => file.status !== grants[i]?.status)) throw failed('remember', 'VISIBILITY_CHANGED');
      await updateGrants(project, grants);
      return { ...project, files, remembered: true };
    }
    if (action === 'ignore') {
      const changed = files.filter(file => file.status === 'unignored');
      const exclude = path.join(project.repositoryRoot, '.git', 'info', 'exclude');
      if (changed.length) {
        const info = await dataDirectory(project.repositoryRoot, ['.git', 'info'], true, () => failed('exclude', 'UNSAFE_PATH'));
        if (path.join(info, 'exclude') !== exclude) throw failed('exclude', 'UNSAFE_PATH');
        try {
          const item = await lstat(exclude);
          if (!item.isFile() || item.nlink !== 1) throw failed('exclude', 'UNSAFE_PATH');
        } catch (error) { if (systemCode(error) !== 'ENOENT') throw error; }
        const patterns = changed.map(file => '/' + file.repositoryPath.replace(/[\\*?\[\] ]/gu, '\\$&'));
        await appendFile(exclude, '\n' + patterns.join('\n') + '\n', 'utf8');
      }
      return { ...project, exclude, files: await inspect(project, paths) };
    }

    let saved: Grant[] = [];
    let stateIssue: string | undefined;
    try {
      const file = await grantPath(project);
      await requireUnlocked(file);
      const grants = await readGrants(file);
      await requireUnlocked(file);
      saved = grants;
    }
    catch (error) {
      if (systemCode(error) !== 'ENOENT') stateIssue = error instanceof SourceError ? String(error.context.reason) : systemCode(error);
    }
    const approvals = new Map(saved.map(grant => [grant.path, grant.status]));
    return { ...project, stateIssue, files: files.map(file => {
      const approved = approvals.get(file.path);
      return { ...file, remembered: file.status !== 'ignored' && approved !== undefined &&
        visibility.indexOf(approved) >= visibility.indexOf(file.status) };
    }) };
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw failed(action, systemCode(error));
  }
}
