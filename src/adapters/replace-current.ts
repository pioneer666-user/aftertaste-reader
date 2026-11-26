import { createHash, randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory, systemCode } from './data-directory.js';
import { RevisionError } from '../application/revisions.js';
import { gitStaging } from './git-staging.js';

export async function replaceCurrent(project: string, relative: string, expected: string, candidate: string) {
  const parts = relative.split('/');
  const unsafe = () => new RevisionError('REVISION_PATH_UNSAFE', '目标资料路径类型已改变。');
  const directory = () => dataDirectory(project, parts.slice(0, -1), false, unsafe);
  const dir = await directory();
  const target = path.join(dir, parts.at(-1)!);
  let lock: string | undefined, temp: string | undefined;
  const busy = () => new RevisionError('REVISION_BUSY', '目标修订锁已存在。请核对正在运行的修订或中断后遗留的锁。');
  try {
    try { await lstat(target + '.revision.lock'); throw busy(); }
    catch (error) { if (systemCode(error) !== 'ENOENT') throw error; }
    const staging = await gitStaging(project, dir);
    const identity = process.platform === 'win32' ? target.toLowerCase() : target;
    const lockPath = path.join(staging, createHash('sha256').update(identity).digest('hex') + '.revision.lock');
    const guard = await open(lockPath, 'wx');
    lock = lockPath;
    await guard.close();
    const candidatePath = path.join(staging, 'revision-' + randomUUID() + '.tmp');
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
    if (!lock && systemCode(error) === 'EEXIST') throw busy();
    throw new RevisionError('REVISION_WRITE_FAILED', '未能发布修订。', { reason: systemCode(error) });
  } finally {
    try { if (temp) await unlink(temp); }
    finally { if (lock) await unlink(lock); }
  }
}
