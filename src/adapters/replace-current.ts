import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory, systemCode } from './data-directory.js';
import { RevisionError } from '../application/revisions.js';

export async function replaceCurrent(project: string, relative: string, expected: string, candidate: string) {
  const parts = relative.split('/');
  const unsafe = () => new RevisionError('REVISION_PATH_UNSAFE', '目标资料路径类型已改变。');
  const directory = () => dataDirectory(project, parts.slice(0, -1), false, unsafe);
  const dir = await directory();
  const target = path.join(dir, parts.at(-1)!);
  const lock = target + '.revision.lock';
  const temp = path.join(dir, '.aftertaste-' + randomUUID() + '.tmp');
  let locked = false, staged = false;
  try {
    const guard = await open(lock, 'wx');
    locked = true;
    await guard.close();
    const handle = await open(temp, 'wx');
    staged = true;
    try { await handle.writeFile(candidate, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    if (await directory() !== dir) throw unsafe();
    const entry = await lstat(target);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) throw unsafe();
    if (createHash('sha256').update(await readFile(target)).digest('hex') !== expected) {
      throw new RevisionError('REVISION_CONFLICT', '讲解自读取后已变化。');
    }
    await rename(temp, target);
    staged = false;
  } catch (error) {
    if (error instanceof RevisionError) throw error;
    if (!locked && systemCode(error) === 'EEXIST') throw new RevisionError('REVISION_BUSY', '目标修订锁已存在。请核对正在运行的修订或中断后遗留的锁。');
    throw new RevisionError('REVISION_WRITE_FAILED', '未能发布修订。', { reason: systemCode(error) });
  } finally {
    try { if (staged) await unlink(temp); }
    finally { if (locked) await unlink(lock); }
  }
}
