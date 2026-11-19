import { randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory, systemCode } from './data-directory.js';

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
    try {
      const item = await lstat(target);
      if (!item.isFile() || item.isSymbolicLink() || item.nlink !== 1) throw this.problems.unsafe();
    } catch (error) {
      if (systemCode(error) !== 'ENOENT') throw error;
    }
    return target;
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
      const candidate = path.join(path.dirname(target), `.aftertaste-${this.name}-${randomUUID()}.tmp`);
      const handle = await open(candidate, 'wx');
      temporary = candidate;
      try {
        await handle.writeFile(raw, 'utf8');
        await handle.sync();
      } finally { await handle.close(); }
      if (await this.read() !== previous) throw this.problems.conflict();
      if (await this.target() !== target) throw this.problems.unsafe();
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
