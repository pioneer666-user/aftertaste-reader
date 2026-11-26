import { createHash, randomBytes } from 'node:crypto';
import { lstat, readFile, open, link, rename, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import type { GraphRemovals, GraphStore } from '../application/dependency-graph.js';
import { SourceError, validateProjectRoot } from '../application/fixed-source.js';
import { GraphError, graphPath, readRemovalMarks } from '../core/dependency-graph.js';
import type { RemovalMarks } from '../core/dependency-graph.js';
import { dataDirectory, systemCode } from './data-directory.js';
import { temporaryFilePath } from '../core/project-write-paths.js';
import { isSourcePath } from '../core/source-path.js';

const removalFile = 'dependency-graph-removals.json';
interface RemovalProof extends GraphRemovals { publication: string }
interface PriorRemovals extends GraphRemovals { unresolvedRecords?: unknown[] }

const noRemovals: GraphRemovals = { removals: {}, registered: [], confirmed: [] };

function proofBytes(records: readonly unknown[]): Buffer {
  return Buffer.from(JSON.stringify(records) + '\n');
}

function pathList(value: unknown, marks: RemovalMarks): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string' && Object.hasOwn(marks, id)) &&
    new Set(value).size === value.length;
}

function publishedProof(value: unknown): RemovalProof | undefined {
  if (!value || typeof value !== 'object' || !('publication' in value) || typeof value.publication !== 'string' ||
      !('removals' in value) || !('registered' in value) || !('confirmed' in value)) return;
  const marks = readRemovalMarks(value.removals);
  if (!marks || !pathList(value.registered, marks) || !pathList(value.confirmed, marks)) return;
  const registered = new Set(value.registered);
  if (value.confirmed.some(id => registered.has(id))) return;
  return { publication: value.publication, removals: marks, registered: value.registered, confirmed: value.confirmed };
}

function legacyMarks(record: object & Record<'publication', unknown>): RemovalMarks | undefined {
  const publication = record.publication;
  if (typeof publication !== 'string' || !/^[a-f0-9]{64}$/u.test(publication) ||
      'registered' in record || 'confirmed' in record) return;
  if ('removals' in record) return readRemovalMarks(record.removals);
  if ('paths' in record && Array.isArray(record.paths) && record.paths.every(isSourcePath)) {
    return Object.fromEntries(record.paths.map(path => [path, publication]));
  }
}

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

  private async readReceipt(projectRoot: string): Promise<Buffer | undefined> {
    try { return await readFile(await targetPath(projectRoot, false, removalFile)); }
    catch (error) { if (systemCode(error) !== 'ENOENT') throw error; }
  }

  async removalState(projectRoot: string, raw: string, active: ReadonlySet<string>, removing: readonly string[] = []): Promise<PriorRemovals> {
    let value: unknown;
    try {
      const receipt = await this.readReceipt(projectRoot);
      if (!receipt) return noRemovals;
      value = JSON.parse(receipt.toString('utf8'));
    } catch (error) {
      throw new GraphError('GRAPH_READ_FAILED', '无法读取依赖图的移除凭据。', '核对项目内的移除凭据，保留布局后重试。', { graphPath, reason: systemCode(error) });
    }
    const publication = await publicationKey(await targetPath(projectRoot, false), raw);
    const records: unknown[] = Array.isArray(value) ? value : [value];
    for (const record of records) {
      if (!record || typeof record !== 'object' || !('publication' in record) || record.publication !== publication) continue;
      const proof = publishedProof(record);
      if (proof) return proof;
      // D012 and the first D013 candidate recorded only snapshot-bound paths or marks.
      const removals = legacyMarks(record);
      if (removals) {
        const ids = Object.keys(removals);
        return { removals, registered: ids.filter(id => active.has(id)), confirmed: ids.filter(id => !active.has(id)) };
      }
    }
    // A single finalized record survives direct edits. Its absence permissions do not.
    const settled = records.length === 1 ? publishedProof(records[0]) : undefined;
    if (settled) return { ...settled, confirmed: [] };
    // Both sides of an interrupted publication may still agree on node identities.
    const [before, after] = records.map(publishedProof);
    if (records.length === 2 && before && after &&
        JSON.stringify(before.removals) === JSON.stringify(after.removals) &&
        JSON.stringify(before.registered) === JSON.stringify(after.registered)) return { ...before, confirmed: [] };
    if (records.length && records.every(record => record && typeof record === 'object' && 'paths' in record && !('removals' in record) &&
        'publication' in record && legacyMarks(record))) return noRemovals;
    // An explicit removal of every ambiguous path establishes a fresh history.
    const marks = records.map(record => record && typeof record === 'object' && 'publication' in record ?
      publishedProof(record)?.removals ?? legacyMarks(record) : undefined);
    if (removing.length && marks.length && marks.every(map => map && Object.keys(map).every(id => removing.includes(id)))) {
      return { ...noRemovals, unresolvedRecords: records };
    }
    throw new GraphError('GRAPH_READ_FAILED', '无法确定旧移除凭据对应哪次图发布。',
      '保留布局，恢复配套的图和凭据，或用图工具明确移除凭据中的路径后按需登记。', { graphPath, receipt: removalFile });
  }

  private async writeReceipt(projectRoot: string, content: Buffer): Promise<void> {
    const target = await targetPath(projectRoot, false, removalFile);
    const candidate = path.join(path.dirname(target), path.posix.basename(temporaryFilePath(`docs/aftertaste/${removalFile}`)));
    const handle = await open(candidate, 'wx');
    let published = false;
    try {
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally { await handle.close(); }
      await targetPath(projectRoot, false, removalFile);
      await this.io.rename(candidate, target);
      published = true;
    } finally {
      if (!published) await unlink(candidate).catch(() => {});
    }
  }

  async save(projectRoot: string, raw: string, previous: string | undefined, removal?: {
    requested: readonly string[]; previousActive: ReadonlySet<string>; active: ReadonlySet<string>;
  }): Promise<void> {
    let temporary: string | undefined;
    let handle: FileHandle | undefined;
    let published = false;
    try {
      const target = await targetPath(projectRoot, true);
      const prior: PriorRemovals = removal && previous !== undefined ?
        await this.removalState(projectRoot, previous, removal.previousActive, removal.requested) : noRemovals;
      const removed = new Map(Object.entries(prior.removals));
      const registered = new Set(prior.registered);
      const confirmed = new Set(prior.confirmed);
      for (const id of removal?.requested ?? []) {
        if (!removed.has(id) || removal?.previousActive.has(id) || registered.has(id)) removed.set(id, randomBytes(32).toString('hex'));
        confirmed.add(id);
        registered.delete(id);
      }
      for (const id of removal?.active ?? []) {
        confirmed.delete(id);
        if (removed.has(id) && !removal?.previousActive.has(id)) registered.add(id);
      }
      const next = { removals: Object.fromEntries(removed), registered: [...registered].sort(), confirmed: [...confirmed].sort() };
      if (raw === previous) {
        if (await this.read(projectRoot) !== previous) throw new GraphError('GRAPH_CHANGED', '原图在本次读取后已变化。',
          '重新查询后决定局部提交。', { projectRoot, graphPath, published: 0 });
        if (removed.size) await this.writeReceipt(projectRoot, proofBytes([{ publication: await publicationKey(target, raw), ...next }]));
        return;
      }
      const candidate = path.join(path.dirname(target), path.posix.basename(temporaryFilePath(graphPath)));
      handle = await this.io.open(candidate, 'wx');
      temporary = candidate;
      await handle.writeFile(raw, 'utf8');
      await handle.close();
      handle = undefined;
      if (await this.read(projectRoot) !== previous) {
        throw new GraphError('GRAPH_CHANGED', '原图在本次读取后已变化。', '重新查询后决定局部提交，不自动重试覆盖。', { projectRoot, graphPath, published: 0 });
      }
      await targetPath(projectRoot, false);
      let candidateProof: RemovalProof | undefined;
      let originalReceipt: Buffer | undefined;
      let stagedReceipt: Buffer | undefined;
      if (removed.size) {
        candidateProof = { publication: await publicationKey(temporary, raw), ...next };
        const previousKey = previous === undefined ? '' : await publicationKey(target, previous);
        const previousRecords = prior.unresolvedRecords ?? [{ ...prior, publication: previousKey }];
        originalReceipt = await this.readReceipt(projectRoot);
        stagedReceipt = proofBytes([...previousRecords, candidateProof]);
        await this.writeReceipt(projectRoot, stagedReceipt);
      }
      try {
        if (stagedReceipt && (await this.read(projectRoot) !== previous || await targetPath(projectRoot, false) !== target)) {
          throw new GraphError('GRAPH_CHANGED', '原图在本次读取后已变化。', '重新查询后决定局部提交，不自动重试覆盖。',
            { projectRoot, graphPath, published: 0 });
        }
        if (previous === undefined) await this.io.link(temporary, target);
        else await this.io.rename(temporary, target);
      } catch (error) {
        // Revoke just our staged receipt if the graph was never published.
        if (stagedReceipt && (await this.readReceipt(projectRoot))?.equals(stagedReceipt)) {
          if (originalReceipt) await this.writeReceipt(projectRoot, originalReceipt);
          else await unlink(await targetPath(projectRoot, false, removalFile));
        }
        throw error;
      }
      published = true;
      if (previous !== undefined) temporary = undefined;
      if (candidateProof) await this.writeReceipt(projectRoot, proofBytes([candidateProof]));
    } catch (error) {
      if (error instanceof GraphError && !published) throw error;
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
