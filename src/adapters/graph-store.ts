import { randomUUID } from 'node:crypto';
import { lstat, readFile, open, link, rename, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import type { GraphStore } from '../application/dependency-graph.js';
import { SourceError, validateProjectRoot } from '../application/fixed-source.js';
import { GraphError, graphPath } from '../core/dependency-graph.js';
import { dataDirectory, systemCode } from './data-directory.js';

export async function readGraphInput(filePath: string): Promise<unknown> {
  if (!path.isAbsolute(filePath) || !filePath.isWellFormed() || /[\x00-\x1f\x7f]/u.test(filePath) ||
      (process.platform === 'win32' && path.parse(filePath).root.length <= 1)) {
    throw new SourceError('INVALID_ARGUMENT', '局部输入文件须为完整绝对路径。', '明确指定 AI 准备的 UTF-8 JSON 输入文件。');
  }
  let raw: string;
  try { raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(filePath)); }
  catch (error) {
    throw new GraphError('GRAPH_INPUT_READ_FAILED', '局部输入不可读取为 UTF-8。', '检查输入文件存在性、编码和权限；保留输入。', { inputPath: filePath, reason: systemCode(error) });
  }
  try { return JSON.parse(raw.replace(/^\uFEFF/u, '')); }
  catch {
    throw new GraphError('GRAPH_INPUT_INVALID', '局部输入不是合法 JSON。', '修正输入 JSON 后重试，原图未更改。', { inputPath: filePath }, [
      { code: 'GRAPH_JSON', field: '$', message: '局部输入不是合法 JSON。', nextStep: '修正输入 JSON。', params: {} },
    ]);
  }
}

async function targetPath(projectRoot: string, create: boolean): Promise<string> {
  validateProjectRoot(projectRoot);
  const unsafe = () => new GraphError('GRAPH_PATH_UNSAFE', '图路径包含链接或非普通目录/文件。', '使用项目内无链接的真实资料目录。', { projectRoot, graphPath });
  const directory = await dataDirectory(projectRoot, ['docs', 'aftertaste'], create, unsafe);
  const target = path.join(directory, 'dependency-graph.json');
  try {
    const entry = await lstat(target);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink > 1) throw unsafe();
  } catch (error) { if (systemCode(error) !== 'ENOENT') throw error; }
  return target;
}

export class GraphFileStore implements GraphStore {
  constructor(private readonly io: Pick<typeof import('node:fs/promises'), 'open' | 'link' | 'rename' | 'unlink'> = { open, link, rename, unlink }) {}

  async read(projectRoot: string): Promise<string | undefined> {
    try {
      const target = await targetPath(projectRoot, false);
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(target));
    } catch (error) {
      if (error instanceof GraphError) throw error;
      if (systemCode(error) === 'ENOENT') return undefined;
      throw new GraphError('GRAPH_READ_FAILED', '图不可读取为 UTF-8。', '核对资料路径、编码和权限，保留原图。', { projectRoot, graphPath, reason: systemCode(error) });
    }
  }

  async save(projectRoot: string, raw: string, previous: string | undefined): Promise<void> {
    let temporary: string | undefined;
    let handle: FileHandle | undefined;
    let published = false;
    try {
      const target = await targetPath(projectRoot, true);
      const candidate = path.join(path.dirname(target), `.aftertaste-graph-${randomUUID()}.tmp`);
      handle = await this.io.open(candidate, 'wx');
      temporary = candidate;
      await handle.writeFile(raw, 'utf8');
      await handle.close();
      handle = undefined;
      if (await this.read(projectRoot) !== previous) {
        throw new GraphError('GRAPH_CHANGED', '原图在本次读取后已变化。', '重新查询后决定局部提交，不自动重试覆盖。', { projectRoot, graphPath, published: 0 });
      }
      await targetPath(projectRoot, false);
      if (previous === undefined) await this.io.link(temporary, target);
      else await this.io.rename(temporary, target);
      published = true;
      if (previous !== undefined) temporary = undefined;
    } catch (error) {
      if (error instanceof GraphError) throw error;
      throw new GraphError('GRAPH_WRITE_FAILED', '图保存失败。', '检查权限与文件系统，核对原图后重试。', { projectRoot, graphPath, published: Number(published), reason: systemCode(error) });
    } finally {
      if (temporary) {
        try {
          await handle?.close();
          await this.io.unlink(temporary);
        } catch (error) {
          if (systemCode(error) !== 'ENOENT') throw new GraphError('GRAPH_WRITE_FAILED', '图临时文件清理失败。', '核对 published、目标图及临时文件，再决定清理。', {
            projectRoot, graphPath, temporary, published: Number(published), reason: systemCode(error),
          });
        }
      }
    }
  }
}
