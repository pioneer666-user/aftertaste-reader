import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { dataDirectory, systemCode } from './data-directory.js';
import { sourcePathForDocument } from '../application/document-blocks.js';
import { validateProjectRoot, SourceError } from '../application/fixed-source.js';
import { ReaderError } from '../application/file-reader.js';
import type { DocumentEntry, ReaderDirectory, ReaderProblem } from '../application/file-reader.js';

export async function readerProject(projectRoot: string): Promise<string> {
  validateProjectRoot(projectRoot);
  try {
    const root = await dataDirectory(projectRoot, [], false, () => new ReaderError('PROJECT_PATH_UNSAFE',
      '项目路径含链接或非普通目录。', '指定无链接祖先的真实项目目录。', { projectRoot }));
    await readdir(root);
    return root;
  } catch (error) {
    if (error instanceof ReaderError) throw error;
    throw new SourceError('PROJECT_UNAVAILABLE', '项目目录无法读取。', '核对绝对路径、目录存在性与访问权限。', { projectRoot, reason: systemCode(error) });
  }
}

export class ReaderFileDirectory implements ReaderDirectory {
  async list(projectRoot: string): Promise<{ documents: DocumentEntry[]; problems: ReaderProblem[] }> {
    const documents: DocumentEntry[] = [];
    const problems: ReaderProblem[] = [];
    const unsafe = (documentPath: string) => new ReaderError('DOCUMENT_PATH_UNSAFE',
      '资料目录或文件包含链接或非普通条目。', '检查 current 镜像中的真实目录与普通文件。', { documentPath });
    const visit = async (segments: string[]): Promise<void> => {
      const directoryPath = segments.join('/');
      let directory: string;
      try {
        directory = await dataDirectory(projectRoot, segments, false, () => unsafe(directoryPath));
      } catch (error) {
        if (systemCode(error) === 'ENOENT' && segments.length === 3) return;
        throw error;
      }
      const entries = await readdir(directory, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
      for (const entry of entries) {
        const next = [...segments, entry.name];
        const documentPath = next.join('/');
        try {
          // Validate directory names through the same mirror boundary before descending.
          sourcePathForDocument(entry.isDirectory() ? `${documentPath}/entry.md` : documentPath);
          const info = await lstat(path.join(directory, entry.name));
          if (info.isSymbolicLink() || (!info.isDirectory() && (!info.isFile() || info.nlink > 1))) throw unsafe(documentPath);
          if (info.isDirectory()) await visit(next);
          else if (entry.name.endsWith('.md')) documents.push({ documentPath, sourcePath: sourcePathForDocument(documentPath) });
        } catch (error) {
          if (error instanceof SourceError || error instanceof ReaderError) {
            problems.push({ code: error.code, message: error.message, nextStep: error.nextStep,
              context: { ...error.context, documentPath } });
          } else {
            problems.push({ code: 'DOCUMENT_LIST_FAILED', message: '资料条目无法读取。',
              nextStep: '检查目录权限和文件存在性后刷新。', context: { documentPath, reason: systemCode(error) } });
          }
        }
      }
    };
    try { await visit(['docs', 'aftertaste', 'current']); }
    catch (error) {
      if (error instanceof ReaderError) throw error;
      throw new ReaderError('DOCUMENT_LIST_FAILED', '讲解资料列表无法读取。', '检查 current 目录权限、类型及路径后刷新。', { reason: systemCode(error) });
    }
    return { documents, problems };
  }
}
