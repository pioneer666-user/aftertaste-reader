import type { DocumentService, ReadingDocument } from './document-blocks.js';

export interface DocumentEntry {
  readonly documentPath: string;
  readonly sourcePath: string;
}

export interface ReaderProblem {
  readonly code: string;
  readonly message: string;
  readonly nextStep: string;
  readonly context: Readonly<Record<string, string | number>>;
}

export class ReaderError extends Error implements ReaderProblem {
  constructor(public readonly code: string, message: string, public readonly nextStep: string,
    public readonly context: ReaderProblem['context'] = {}) {
    super(message);
    this.name = 'ReaderError';
  }
}

export interface ReaderDirectory {
  list(projectRoot: string): Promise<{ documents: DocumentEntry[]; problems: ReaderProblem[] }>;
}

export class FileReaderService {
  constructor(readonly projectRoot: string, private readonly directory: ReaderDirectory,
    private readonly documents: DocumentService) {}

  async list() {
    return { projectRoot: this.projectRoot, ...await this.directory.list(this.projectRoot) };
  }

  async read(documentPath: string): Promise<ReadingDocument> {
    return this.documents.read({ projectRoot: this.projectRoot }, documentPath);
  }
}
