import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, open, link, rename, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import type { GraphStore } from '../application/dependency-graph.js';
import { SourceError, validateProjectRoot } from '../application/fixed-source.js';
import { GraphError, graphPath } from '../core/dependency-graph.js';
import { dataDirectory, systemCode } from './data-directory.js';
import { isSourcePath } from '../core/source-path.js';

const removalFile = 'dependency-graph-removals.json';
interface RemovalProof { publication: string; paths: string[] }

async function publicationKey(file: string, raw: string) {
  const stamp = await lstat(file, { bigint: true });
  return createHash('sha256').update(raw).update(`\0${stamp.dev}:${stamp.ino}:${stamp.mtimeNs}`).digest('hex');
}

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

async function targetPath(projectRoot: string, create: boolean, name = 'dependency-graph.json'): Promise<string> {
  validateProjectRoot(projectRoot);
  const unsafe = () => new GraphError('GRAPH_PATH_UNSAFE', '图路径包含链接或非普通目录/文件。', '使用项目内无链接的真实资料目录。', { projectRoot, graphPath });
  const directory = await dataDirectory(projectRoot, ['docs', 'aftertaste'], create, unsafe);
  const target = path.join(directory, name);
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

  async confirmedRemovals(projectRoot: string, raw: string): Promise<string[]> {
    return (await this.findRemovalProof(projectRoot, raw))?.paths ?? [];
  }

  private async findRemovalProof(projectRoot: string, raw: string): Promise<RemovalProof | undefined> {
    try {
      const target = await targetPath(projectRoot, false);
      const receipt = await targetPath(projectRoot, false, removalFile);
      const value: unknown = JSON.parse(await readFile(receipt, 'utf8'));
      const publication = await publicationKey(target, raw);
      const records: unknown[] = Array.isArray(value) ? value : [value];
      for (const record of records) {
        if (!record || typeof record !== 'object' || !('publication' in record) || !('paths' in record)) continue;
        if (record.publication === publication && Array.isArray(record.paths) && record.paths.every(isSourcePath)) {
          return { publication, paths: record.paths };
        }
      }
    } catch {
      // Missing or invalid evidence cannot authorize pruning user layout.
    }
    return undefined;
  }

  private async recordRemovals(projectRoot: string, graph: string, raw: string, paths: string[], previous?: RemovalProof): Promise<void> {
    if (!paths.length) return;
    const target = await targetPath(projectRoot, false, removalFile);
    const candidateProof = { publication: await publicationKey(graph, raw), paths: paths.sort() };
    const records = previous && previous.publication !== candidateProof.publication ? [previous, candidateProof] : [candidateProof];
    const content = JSON.stringify(records) + '\n';
    const candidate = path.join(path.dirname(target), `.aftertaste-removals-${randomUUID()}.tmp`);
    const handle = await open(candidate, 'wx');
    let published = false;
    try {
      try {
        await handle.writeFile(content, 'utf8');
        await handle.sync();
      } finally { await handle.close(); }
      await targetPath(projectRoot, false, removalFile);
      await rename(candidate, target);
      published = true;
    } finally {
      if (!published) await unlink(candidate).catch(() => {});
    }
  }

  async save(projectRoot: string, raw: string, previous: string | undefined, removal?: {
    requested: readonly string[]; active: readonly string[];
  }): Promise<void> {
    let temporary: string | undefined;
    let handle: FileHandle | undefined;
    let published = false;
    try {
      const target = await targetPath(projectRoot, true);
      const previousProof = removal && previous !== undefined ? await this.findRemovalProof(projectRoot, previous) : undefined;
      const removed = new Set(previousProof?.paths);
      for (const file of removal?.requested ?? []) removed.add(file);
      for (const file of removal?.active ?? []) removed.delete(file);
      if (raw === previous) {
        if (await this.read(projectRoot) !== previous) throw new GraphError('GRAPH_CHANGED', '原图在本次读取后已变化。',
          '重新查询后决定局部提交。', { projectRoot, graphPath, published: 0 });
        await this.recordRemovals(projectRoot, target, raw, [...removed], previousProof);
        return;
      }
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
      await this.recordRemovals(projectRoot, temporary, raw, [...removed], previousProof);
      if (removed.size && (await this.read(projectRoot) !== previous || await targetPath(projectRoot, false) !== target)) {
        throw new GraphError('GRAPH_CHANGED', '原图在本次读取后已变化。', '重新查询后决定局部提交，不自动重试覆盖。',
          { projectRoot, graphPath, published: 0 });
      }
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
