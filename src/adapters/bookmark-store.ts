import { randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { BookmarkError } from '../core/bookmarks.js';
import { dataDirectory, systemCode } from './data-directory.js';

function unsafe() {
  return new BookmarkError('BOOKMARK_PATH_UNSAFE', '书签资料路径包含链接或非普通条目。', '检查项目资料目录和书签文件的类型。');
}

export class BookmarkFileStore {
  constructor(private readonly projectRoot: string) {}

  private async target(): Promise<string> {
    const directory = await dataDirectory(this.projectRoot, ['docs', 'aftertaste'], false, unsafe);
    const target = path.join(directory, 'bookmarks.json');
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
      if (error instanceof BookmarkError) throw error;
      const reason = systemCode(error);
      if (reason === 'ENOENT') return undefined;
      throw new BookmarkError('BOOKMARK_READ_FAILED', '无法读取书签资料。', '核对书签文件编码和权限后重试。', { reason });
    }
  }

  async save(raw: string, previous: string | undefined): Promise<void> {
    let temporary: string | undefined;
    try {
      const target = await this.target();
      const candidate = path.join(path.dirname(target), `.aftertaste-bookmarks-${randomUUID()}.tmp`);
      const handle = await open(candidate, 'wx');
      temporary = candidate;
      try {
        await handle.writeFile(raw, 'utf8');
        await handle.sync();
      } finally { await handle.close(); }
      if (await this.read() !== previous) {
        throw new BookmarkError('BOOKMARK_CONFLICT', '磁盘上的书签资料已变化。', '重新读取已保存书签后重试。');
      }
      if (await this.target() !== target) throw unsafe();
      await rename(temporary, target);
      temporary = undefined;
    } catch (error) {
      if (error instanceof BookmarkError) throw error;
      throw new BookmarkError('BOOKMARK_WRITE_FAILED', '无法保存书签资料。', '检查文件占用和目录权限后重试。', { reason: systemCode(error) });
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
    }
  }
}
