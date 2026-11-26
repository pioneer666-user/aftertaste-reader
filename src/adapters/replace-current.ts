import { createHash } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory, systemCode } from './data-directory.js';
import { RevisionError } from '../application/revisions.js';
import { temporaryFilePath } from '../core/project-write-paths.js';

export async function replaceCurrent(project: string, relative: string, expected: string, candidate: string) {
  const parts = relative.split('/');
  const unsafe = () => new RevisionError('REVISION_PATH_UNSAFE', '目标资料路径类型已改变。');
  const directory = () => dataDirectory(project, parts.slice(0, -1), false, unsafe);
  const dir = await directory();
  const target = path.join(dir, parts.at(-1)!);
  const candidatePath = path.join(dir, path.posix.basename(temporaryFilePath(relative)));
  const legacyLock = target + '.revision.lock';
  let temp: string | undefined;
  const busy = (temporaryPath: string) => new RevisionError('REVISION_BUSY', '目标修订的暂存或锁已存在。请核对正在运行的修订或中断后的遗留文件。', { temporaryPath });
  try {
    try { await lstat(legacyLock); throw busy(legacyLock); }
    catch (error) { if (systemCode(error) !== 'ENOENT') throw error; }
    const handle = await open(candidatePath, 'wx');
    temp = candidatePath;
    try { await handle.writeFile(candidate, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    if (await directory() !== dir) throw unsafe();
    const entry = await lstat(target);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) throw unsafe();
    if (createHash('sha256').update(await readFile(target)).digest('hex') !== expected) {
      throw new RevisionError('REVISION_CONFLICT', '讲解自读取后已变化。');
    }
    await rename(temp, target);
    temp = undefined;
  } catch (error) {
    if (error instanceof RevisionError) throw error;
    if (!temp && systemCode(error) === 'EEXIST') throw busy(candidatePath);
    throw new RevisionError('REVISION_WRITE_FAILED', '未能发布修订。', { reason: systemCode(error) });
  } finally {
    if (temp) await unlink(temp);
  }
}
