import { randomUUID } from 'node:crypto';
import { lstat, readFile, open, link, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import type { DocumentStore } from '../application/document-blocks.js';
import { sourcePathForDocument } from '../application/document-blocks.js';
import { validateProjectRoot, SourceError } from '../application/fixed-source.js';
import { DocumentError } from '../core/document-blocks.js';
import { dataDirectory, systemCode } from './data-directory.js';
import { gitStaging } from './git-staging.js';

function unsafe(projectRoot: string, documentPath: string): DocumentError {
  return new DocumentError('DOCUMENT_PATH_UNSAFE', '文档路径包含链接或非普通目录/文件。', '使用指定项目中无链接的真实资料目录。', { projectRoot, documentPath });
}

async function targetPath(projectRoot: string, documentPath: string, create: boolean): Promise<string> {
  validateProjectRoot(projectRoot);
  sourcePathForDocument(documentPath);
  const segments = documentPath.split('/');
  const current = await dataDirectory(projectRoot, segments.slice(0, -1), create, () => unsafe(projectRoot, documentPath));
  const target = path.join(current, segments.at(-1)!);
  try {
    const entry = await lstat(target);
    if (!entry.isFile() || entry.isSymbolicLink()) throw unsafe(projectRoot, documentPath);
    if (create) throw new DocumentError('DOCUMENT_EXISTS', '讲解文档已存在。', '保留原文，由 AI 编辑已有正文，再运行校验。', { projectRoot, documentPath });
    if (entry.nlink > 1) throw unsafe(projectRoot, documentPath);
  } catch (error) {
    if (systemCode(error) !== 'ENOENT') throw error;
    if (!create) throw error;
  }
  return target;
}

export class DocumentFileStore implements DocumentStore {
  constructor(private readonly io: Pick<typeof import('node:fs/promises'), 'open' | 'link'> = { open, link }) {}

  async create(projectRoot: string, documentPath: string, raw: string): Promise<void> {
    let temporary: string | undefined;
    let handle: FileHandle | undefined;
    let published = false;
    try {
      const target = await targetPath(projectRoot, documentPath, true);
      const candidate = path.join(await gitStaging(projectRoot, path.dirname(target)), `document-${randomUUID()}.tmp`);
      handle = await this.io.open(candidate, 'wx');
      temporary = candidate;
      await handle.writeFile(raw, 'utf8');
      await handle.close();
      handle = undefined;
      // link publishes the complete document with exclusive destination creation.
      try { await this.io.link(temporary, target); }
      catch (error) {
        if (systemCode(error) === 'EEXIST') throw new DocumentError('DOCUMENT_EXISTS', '讲解文档已存在。', '保留原文，编辑后再校验。', { projectRoot, documentPath });
        throw error;
      }
      published = true;
    } catch (error) {
      if (error instanceof DocumentError || error instanceof SourceError) throw error;
      throw new DocumentError('DOCUMENT_WRITE_FAILED', '新讲解文档写入失败。', '检查资料目录权限及文件系统能力后重试新建。', { projectRoot, documentPath, reason: systemCode(error) });
    } finally {
      if (temporary) {
        try {
          await handle?.close();
          await unlink(temporary);
        }
        catch (error) {
          if (systemCode(error) !== 'ENOENT') throw new DocumentError('DOCUMENT_WRITE_FAILED', '骨架临时文件清理失败。', '检查资料目录权限并核对目标和临时文件。', {
            projectRoot, documentPath, temporary, published: Number(published), reason: systemCode(error),
          });
        }
      }
    }
  }

  async read(projectRoot: string, documentPath: string): Promise<string> {
    try {
      const target = await targetPath(projectRoot, documentPath, false);
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(target));
    } catch (error) {
      if (error instanceof DocumentError || error instanceof SourceError) throw error;
      throw new DocumentError('DOCUMENT_READ_FAILED', '讲解文档不可读取为 UTF-8。', '检查镜像路径、文件存在性、编码和权限。', { projectRoot, documentPath, reason: systemCode(error) });
    }
  }
}
