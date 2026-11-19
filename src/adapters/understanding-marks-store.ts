import { markConflict, MarkError } from '../core/understanding-marks.js';
import { PersonalFile } from './personal-file.js';

export class UnderstandingMarkFileStore extends PersonalFile {
  constructor(projectRoot: string) {
    super(projectRoot, 'understanding-marks', false, {
      unsafe: () => new MarkError('MARK_PATH_UNSAFE', '标注资料路径包含链接或非普通条目。', '检查项目资料目录和标注文件的类型。'),
      conflict: markConflict,
      read: reason => new MarkError('MARK_READ_FAILED', '无法读取标注资料。', '核对标注文件编码和权限后重试。', { reason }),
      write: reason => new MarkError('MARK_WRITE_FAILED', '无法保存标注资料。', '检查文件占用和目录权限后重试。', { reason }),
    });
  }
}
