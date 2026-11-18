import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { validateProjectRoot, SourceError } from '../application/fixed-source.js';
import type { LoopStore } from '../application/loops.js';
import { isLoopId, LoopError } from '../core/loops.js';
import { dataDirectory, systemCode } from './data-directory.js';

const directory = ['docs', 'aftertaste', 'loops'];
const artifact = 'loop.json';

export async function readLoopInput(inputPath: string): Promise<unknown> {
  if (!path.isAbsolute(inputPath) || !inputPath.isWellFormed() || /[\x00-\x1f\x7f]/u.test(inputPath) ||
      (process.platform === 'win32' && path.parse(inputPath).root.length <= 1)) {
    throw new SourceError('INVALID_ARGUMENT', '闭环输入须为完整绝对路径。', '指定已准备的 UTF-8 JSON 输入文件。');
  }
  let raw: string;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(inputPath)); }
  catch (error) {
    throw new LoopError('LOOP_INPUT_READ_FAILED', '闭环输入不可读取为 UTF-8。', '检查输入路径、编码和权限。', {
      inputPath, reason: systemCode(error),
    });
  }
  try { return JSON.parse(raw); }
  catch { throw new LoopError('LOOP_INPUT_INVALID', '闭环输入不是合法 JSON。', '检查并修正输入文件。', { inputPath, field: '$', reason: 'JSON' }); }
}

function checkedPath(projectRoot: string, id: string) {
  validateProjectRoot(projectRoot);
  if (!isLoopId(id)) throw new SourceError('INVALID_ARGUMENT', '闭环 ID 无效。', '使用支持的小写名称，避开设备名。');
  return directory.concat(id, 'current', artifact).join('/');
}

function unsafe(projectRoot: string, loopPath: string): LoopError {
  return new LoopError('LOOP_PATH_UNSAFE', '闭环路径含链接或资料类型异常。', '使用项目中无链接的真实闭环目录及成品文件。', { projectRoot, loopPath });
}

async function requireUnused(target: string, projectRoot: string, loopPath: string): Promise<void> {
  try {
    const entry = await lstat(target);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw unsafe(projectRoot, loopPath);
    throw new LoopError('LOOP_EXISTS', '闭环 ID 已被占用。', '用 read-loop 阅读已有成果，新路线另选 ID。', { projectRoot, loopPath });
  } catch (error) {
    if (systemCode(error) !== 'ENOENT') throw error;
  }
}

export class LoopFileStore implements LoopStore {
  constructor(private readonly publish: typeof rename = rename) {}

  async listIds(projectRoot: string): Promise<string[]> {
    validateProjectRoot(projectRoot);
    const loopPath = directory.join('/');
    try {
      const parent = await dataDirectory(projectRoot, directory, false, () => unsafe(projectRoot, loopPath));
      return (await readdir(parent)).filter(isLoopId).sort();
    } catch (error) {
      if (error instanceof LoopError) throw error;
      const reason = systemCode(error);
      if (reason === 'ENOENT') return [];
      throw new LoopError('LOOP_LIST_FAILED', '闭环目录无法读取。', '检查项目的闭环目录和权限。', { projectRoot, loopPath, reason });
    }
  }

  async create(projectRoot: string, id: string, raw: string): Promise<void> {
    const loopPath = checkedPath(projectRoot, id);
    const unsafePath = () => unsafe(projectRoot, loopPath);
    let staging: string | undefined;
    try {
      const parent = await dataDirectory(projectRoot, directory, true, unsafePath);
      const target = path.join(parent, id);
      await requireUnused(target, projectRoot, loopPath);
      staging = await mkdtemp(path.join(parent, '.aftertaste-loop-'));
      const current = path.join(staging, 'current');
      await mkdir(current);
      const handle = await open(path.join(current, artifact), 'wx');
      try {
        await handle.writeFile(raw, 'utf8');
        await handle.sync();
      } finally { await handle.close(); }

      if (await dataDirectory(projectRoot, directory, false, unsafePath) !== parent) throw unsafePath();
      await requireUnused(target, projectRoot, loopPath);
      // Each publishing writer offers a nonempty directory, so a racing winner cannot be replaced.
      try { await this.publish(staging, target); }
      catch (error) {
        await requireUnused(target, projectRoot, loopPath);
        throw error;
      }
      staging = undefined;
    } catch (error) {
      if (error instanceof LoopError) throw error;
      throw new LoopError('LOOP_WRITE_FAILED', '闭环未能发布。', '检查存储权限与磁盘，再核对目标 ID。', {
        projectRoot, loopPath, reason: systemCode(error),
      });
    } finally {
      if (staging) {
        const current = path.join(staging, 'current');
        try {
          for (const remove of [() => unlink(path.join(current, artifact)), () => rmdir(current), () => rmdir(staging!)]) {
            try { await remove(); }
            catch (error) { if (systemCode(error) !== 'ENOENT') throw error; }
          }
        } catch (error) {
          throw new LoopError('LOOP_WRITE_FAILED', '闭环暂存资料未能清理。', '核对目标 ID 和本次暂存目录后再重试。', {
            projectRoot, loopPath, staging, reason: systemCode(error),
          });
        }
      }
    }
  }

  async read(projectRoot: string, id: string) {
    const loopPath = checkedPath(projectRoot, id);
    const unsafePath = () => unsafe(projectRoot, loopPath);
    try {
      const current = await dataDirectory(projectRoot, directory.concat(id, 'current'), false, unsafePath);
      const target = path.join(current, artifact);
      const entry = await lstat(target);
      if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) throw unsafePath();
      const raw = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(target));
      return { raw, projectRoot: await realpath(projectRoot) };
    } catch (error) {
      if (error instanceof LoopError) throw error;
      const reason = systemCode(error);
      if (reason === 'ENOENT') throw new LoopError('LOOP_NOT_FOUND', '找不到已发布的闭环。', '检查目标项目和闭环 ID。', { projectRoot, loopPath });
      throw new LoopError('LOOP_READ_FAILED', '闭环不可读取为 UTF-8。', '检查成品的编码和读取权限。', { projectRoot, loopPath, reason });
    }
  }
}
