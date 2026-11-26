import { lstat } from 'node:fs/promises';
import { dataDirectory } from './data-directory.js';
import { GitSourceRepository } from './git-source.js';

export async function gitStaging(projectRoot: string, destinationDirectory: string): Promise<string> {
  const { repositoryRoot } = await new GitSourceRepository().locate(projectRoot);
  // Git never includes metadata in its working tree, even when only the final document is ignored.
  const stage = await dataDirectory(repositoryRoot, ['.git', 'aftertaste-staging'], true,
    () => Object.assign(new Error('Unsafe Git staging directory'), { code: 'UNSAFE_GIT_STAGING' }));
  const [staging, destination] = await Promise.all([lstat(stage, { bigint: true }), lstat(destinationDirectory, { bigint: true })]);
  if (staging.dev !== destination.dev) throw Object.assign(new Error('Staging and destination require the same filesystem'), { code: 'EXDEV' });
  return stage;
}
