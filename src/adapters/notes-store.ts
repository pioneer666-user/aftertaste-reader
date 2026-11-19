import { NoteError, noteConflict } from '../core/notes.js';
import { PersonalFile } from './personal-file.js';

export class NotesFileStore extends PersonalFile {
  constructor(projectRoot: string) {
    super(projectRoot, 'notes', true, {
      unsafe: () => new NoteError('NOTE_PATH_UNSAFE', '笔记资料路径包含链接或非普通条目。', '检查项目资料目录和笔记文件的类型。'),
      conflict: noteConflict,
      read: reason => new NoteError('NOTE_READ_FAILED', '无法读取笔记文件。', '检查文件占用、编码和权限后重试。', { reason }),
      write: reason => new NoteError('NOTE_WRITE_FAILED', '无法保存笔记文件。', '检查文件占用和目录权限后重试。', { reason }),
    });
  }
}
