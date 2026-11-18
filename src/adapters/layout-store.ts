import { randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { CanvasError, layoutPath } from '../core/canvas-layout.js';
import { dataDirectory, systemCode } from './data-directory.js';

export class LayoutFileStore {
  constructor(private readonly projectRoot: string) {}

  private async target(): Promise<string> {
    const unsafe = () => new CanvasError('LAYOUT_PATH_UNSAFE', '布局路径包含链接或非普通条目。',
      '检查项目资料目录和布局文件的类型。', { layoutPath });
    const dir = await dataDirectory(this.projectRoot, ['docs', 'aftertaste'], false, unsafe);
    const target = path.join(dir, path.posix.basename(layoutPath));
    try {
      const item = await lstat(target);
      if (!item.isFile() || item.isSymbolicLink() || item.nlink !== 1) throw unsafe();
    } catch (error) {
      if (systemCode(error) !== 'ENOENT') throw error;
    }
    return target;
  }

  async read(): Promise<string | undefined> {
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(await this.target()));
    } catch (error) {
      if (error instanceof CanvasError) throw error;
      const reason = systemCode(error);
      if (reason === 'ENOENT') return undefined;
      throw new CanvasError('LAYOUT_READ_FAILED', '布局文件无法读取为 UTF-8。', '核对布局文件编码和权限，保留原件。',
        { layoutPath, reason });
    }
  }

  async save(raw: string, previous: string | undefined, checkGraph: () => Promise<void>): Promise<void> {
    let temporary: string | undefined;
    try {
      const target = await this.target();
      const candidate = path.join(path.dirname(target), `.aftertaste-layout-${randomUUID()}.tmp`);
      const handle = await open(candidate, 'wx');
      temporary = candidate;
      try {
        await handle.writeFile(raw, 'utf8');
        await handle.sync();
      } finally { await handle.close(); }
      await checkGraph();
      if (await this.read() !== previous) {
        throw new CanvasError('LAYOUT_CONFLICT', '磁盘上的布局已变化。', '重新读取磁盘布局。', { layoutPath });
      }
      if (await this.target() !== target) throw new CanvasError('LAYOUT_PATH_UNSAFE', '布局目录发生变化。', '检查项目资料目录。', { layoutPath });
      await rename(temporary, target);
      temporary = undefined;
    } catch (error) {
      if (error instanceof CanvasError) throw error;
      throw new CanvasError('LAYOUT_WRITE_FAILED', '布局写入失败。', '检查文件占用和目录权限后重试。',
        { layoutPath, reason: systemCode(error) });
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
    }
  }
}
