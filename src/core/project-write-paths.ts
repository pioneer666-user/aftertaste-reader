import { createHash } from 'node:crypto';
import { posix as path } from 'node:path';

export function temporaryFilePath(file: string): string {
  const identity = process.platform === 'win32' ? file.toLowerCase() : file;
  const key = createHash('sha256').update(identity).digest('hex').slice(0, 24);
  return path.join(path.dirname(file), `.aftertaste-${key}.tmp`);
}

export function temporaryLoopDirectory(id: string): string {
  return `docs/aftertaste/loops/.aftertaste-loop-${id}`;
}
