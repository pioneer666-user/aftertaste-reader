import { lstat, realpath, mkdir } from 'node:fs/promises';
import path from 'node:path';

export function systemCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
}

// Compare directory identities so ordinary Windows case aliases remain usable.
export async function dataDirectory(projectRoot: string, segments: readonly string[], create: boolean,
  unsafe: () => Error): Promise<string> {
  async function canonical(directory: string): Promise<string> {
    const entry = await lstat(directory, { bigint: true });
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw unsafe();
    const resolvedPath = await realpath(directory);
    const resolved = await lstat(resolvedPath, { bigint: true });
    if (!resolved.isDirectory() || resolved.isSymbolicLink() || entry.dev !== resolved.dev || entry.ino !== resolved.ino) throw unsafe();
    return resolvedPath;
  }
  let ancestor = path.resolve(projectRoot);
  while (true) {
    const entry = await lstat(ancestor);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw unsafe();
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  let current = await canonical(projectRoot);
  for (const segment of segments) {
    current = path.join(current, segment);
    try { current = await canonical(current); }
    catch (error) {
      if (!create || systemCode(error) !== 'ENOENT') throw error;
      try { await mkdir(current); }
      catch (mkdirError) { if (systemCode(mkdirError) !== 'EEXIST') throw mkdirError; }
      current = await canonical(current);
    }
  }
  return current;
}
