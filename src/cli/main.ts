import { FixedSourceService, SourceError } from '../application/fixed-source.js';
import type { ErrorContext } from '../application/fixed-source.js';
import { GitSourceRepository } from '../adapters/git-source.js';
import { DocumentService } from '../application/document-blocks.js';
import { DocumentFileStore } from '../adapters/document-store.js';
import { DocumentError } from '../core/document-blocks.js';

const commands: Record<string, { allowed: string[]; required: string[] }> = {
  pin: { allowed: ['--project', '--revision'], required: ['--project'] },
  read: { allowed: ['--project', '--commit', '--path', '--repository', '--prefix'], required: ['--project', '--commit', '--path'] },
  'create-document': {
    allowed: ['--project', '--repository', '--prefix', '--commit', '--path', '--blocks'],
    required: ['--project', '--repository', '--prefix', '--commit', '--path', '--blocks'],
  },
  'validate-document': {
    allowed: ['--project', '--repository', '--prefix', '--document'],
    required: ['--project', '--repository', '--prefix', '--document'],
  },
};

function argumentsFor(argv: string[]): { command: string; options: Map<string, string> } {
  const command = argv[0];
  const definition = command === undefined ? undefined : Object.hasOwn(commands, command) ? commands[command] : undefined;
  if (!command || !definition) {
    throw new SourceError('INVALID_ARGUMENT', '缺少有效命令。', '使用 pin、read、create-document 或 validate-document，调用约定见 specs/002 与 003。');
  }
  const options = new Map<string, string>();
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === undefined || !definition.allowed.includes(key) || options.has(key) || value === undefined || (value.length === 0 && key !== '--prefix')) {
      throw new SourceError('INVALID_ARGUMENT', '命令选项无效、重复或缺少值。', '按调用约定提供各选项及独立参数值。');
    }
    options.set(key, value);
  }
  if (definition.required.some(key => !options.has(key))) {
    throw new SourceError('INVALID_ARGUMENT', '缺少必要参数。', '按对应命令契约提供全部必填参数。');
  }
  if (options.has('--repository') !== options.has('--prefix')) {
    throw new SourceError('INVALID_ARGUMENT', '仓库根与项目前缀必须成对提供。', '同时传回 pin 的 repositoryRoot 与 projectPrefix。', {
      reason: 'INCOMPLETE_MAPPING',
    });
  }
  return { command, options };
}

async function main(): Promise<void> {
  let requestContext: ErrorContext = {};
  try {
    const { command, options } = argumentsFor(process.argv.slice(2));
    const repository = new GitSourceRepository();
    const service = new FixedSourceService(repository);
    const projectRoot = options.get('--project')!;
    if (command === 'pin') {
      const source = await service.pin(projectRoot, options.get('--revision'));
      process.stdout.write(`${JSON.stringify({ ok: true, source })}\n`);
    } else if (command === 'read') {
      const commit = options.get('--commit')!;
      const filePath = options.get('--path')!;
      const source = options.has('--repository') ? { projectRoot, commit,
        repositoryRoot: options.get('--repository')!, projectPrefix: options.get('--prefix')! } : { projectRoot, commit };
      requestContext = { ...source, path: filePath };
      const file = await service.read(source, filePath);
      process.stdout.write(`${JSON.stringify({ ok: true, file })}\n`);
    } else {
      const mapping = { projectRoot, repositoryRoot: options.get('--repository')!, projectPrefix: options.get('--prefix')! };
      const documents = new DocumentService(service, new DocumentFileStore());
      if (command === 'create-document') {
        let blocks: unknown;
        try { blocks = JSON.parse(options.get('--blocks')!); }
        catch { throw new SourceError('INVALID_ARGUMENT', '分块清单不是合法 JSON。', '按文档契约传入有序 JSON 数组。'); }
        const source = { ...mapping, commit: options.get('--commit')! };
        const filePath = options.get('--path')!;
        requestContext = { ...source, path: filePath };
        const result = await documents.create(source, filePath, blocks);
        process.stdout.write(`${JSON.stringify({ ok: true, generated: true, result })}\n`);
      } else {
        const documentPath = options.get('--document')!;
        requestContext = { ...mapping, documentPath };
        const result = await documents.validate(mapping, documentPath);
        process.stdout.write(`${JSON.stringify({ ok: result.mechanicallyValid, result })}\n`);
        process.exitCode = result.mechanicallyValid ? 0 : 1;
      }
    }
  } catch (error) {
    const problem = error instanceof SourceError || error instanceof DocumentError ? error :
      new SourceError('INTERNAL_ERROR', '命令发生未预期错误。', '将命令及问题标识交给维护者检查。');
    process.stderr.write(`${JSON.stringify({ ok: false, error: {
      code: problem.code, message: problem.message, nextStep: problem.nextStep, context: { ...requestContext, ...problem.context },
    } })}\n`);
    process.exitCode = ['INVALID_ARGUMENT', 'INVALID_PATH', 'BLOCK_PLAN_INVALID'].includes(problem.code) ? 2 : 1;
  }
}

await main();
