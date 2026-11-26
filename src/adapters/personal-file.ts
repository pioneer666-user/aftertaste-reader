import { randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory, systemCode } from './data-directory.js';
import { preparePosixAccess, windowsPersonalAccess } from './personal-access.js';

interface FileProblems {
  unsafe(): Error;
  conflict(): Error;
  read(reason: string): Error;
  write(reason: string): Error;
}

export class PersonalFile {
  constructor(private readonly projectRoot: string, private readonly name: string,
    private readonly createDirectory: boolean, private readonly problems: FileProblems) {}

  private async target(create = false): Promise<string> {
    const directory = await dataDirectory(this.projectRoot, ['docs', 'aftertaste'], create, this.problems.unsafe);
    const target = path.join(directory, `${this.name}.json`);
    await this.entry(target);
    return target;
  }

  private async entry(target: string) {
    try {
      const item = await lstat(target, { bigint: true });
      if (!item.isFile() || item.isSymbolicLink() || item.nlink !== 1n) throw this.problems.unsafe();
      return item;
    } catch (error) {
      if (systemCode(error) !== 'ENOENT') throw error;
    }
  }

  private async raw(): Promise<string | undefined> {
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(await this.target()));
    } catch (error) {
      if (systemCode(error) === 'ENOENT') return undefined;
      throw error;
    }
  }

  async read(): Promise<string | undefined> {
    try { return await this.raw(); }
    catch (error) {
      if (error instanceof Error && 'nextStep' in error) throw error;
      throw this.problems.read(systemCode(error));
    }
  }

  async save(raw: string, previous: string | undefined): Promise<void> {
    let temporary: string | undefined;
    try {
      const target = await this.target(this.createDirectory);
      const original = await this.entry(target);
      if ((original === undefined) !== (previous === undefined)) throw this.problems.conflict();
      const candidate = path.join(path.dirname(target), `.aftertaste-${this.name}-${randomUUID()}.tmp`);
      let descriptor: string | undefined;
      if (process.platform === 'win32') {
        descriptor = await windowsPersonalAccess(target, candidate, !!original, { raw });
        temporary = candidate;
      } else {
        const handle = await open(candidate, 'wx', 0o600);
        temporary = candidate;
        try {
          await handle.chmod(0o600);
          await preparePosixAccess(target, candidate, !!original);
          const opened = await handle.stat({ bigint: true });
          const staged = await this.entry(candidate);
          if (!staged || opened.nlink !== 1n || opened.ino !== staged.ino || opened.dev !== staged.dev) throw this.problems.unsafe();
          if (original && !samePosixPermissions(opened, original)) throw this.problems.write('POSIX_PERMISSIONS_CHANGED');
          await handle.truncate(0);
          await handle.writeFile(raw, 'utf8');
          await handle.sync();
        } finally { await handle.close(); }
      }
      const staged = await this.entry(candidate);
      if (!staged) throw this.problems.unsafe();
      if (original && process.platform !== 'win32' && !samePosixPermissions(staged, original)) {
        throw this.problems.write('POSIX_PERMISSIONS_CHANGED');
      }
      if (original && descriptor !== undefined) await windowsPersonalAccess(target, candidate, true, { verify: descriptor });
      if (await this.read() !== previous) throw this.problems.conflict();
      if (await this.target() !== target) throw this.problems.unsafe();
      const latest = await this.entry(target);
      const ready = await this.entry(candidate);
      if (latest?.ino !== original?.ino || latest?.dev !== original?.dev || latest?.ctimeNs !== original?.ctimeNs) {
        throw this.problems.conflict();
      }
      if (ready?.ino !== staged.ino || ready.dev !== staged.dev) throw this.problems.unsafe();
      await rename(temporary, target);
      temporary = undefined;
    } catch (error) {
      if (error instanceof Error && 'nextStep' in error) throw error;
      throw this.problems.write(systemCode(error));
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
    }
  }
}

function samePosixPermissions(left: { mode: bigint; uid: bigint; gid: bigint }, right: typeof left): boolean {
  return left.mode === right.mode && left.uid === right.uid && left.gid === right.gid;
}
