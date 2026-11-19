import { BookmarkError } from '../core/bookmarks.js';
import { PersonalFile } from './personal-file.js';

export class BookmarkFileStore extends PersonalFile {
  constructor(projectRoot: string) {
    super(projectRoot, 'bookmarks', false, {
      unsafe: () => new BookmarkError('BOOKMARK_PATH_UNSAFE', '书签资料路径包含链接或非普通条目。', '检查项目资料目录和书签文件的类型。'),
      conflict: () => new BookmarkError('BOOKMARK_CONFLICT', '磁盘上的书签资料已变化。', '重新读取已保存书签后重试。'),
      read: reason => new BookmarkError('BOOKMARK_READ_FAILED', '无法读取书签资料。', '核对书签文件编码和权限后重试。', { reason }),
      write: reason => new BookmarkError('BOOKMARK_WRITE_FAILED', '无法保存书签资料。', '检查文件占用和目录权限后重试。', { reason }),
    });
  }
}
