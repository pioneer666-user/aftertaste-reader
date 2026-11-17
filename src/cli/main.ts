import { FixedSourceService, SourceError } from '../application/fixed-source.js';
import type { ErrorContext } from '../application/fixed-source.js';
import { GitSourceRepository } from '../adapters/git-source.js';
import { DocumentService } from '../application/document-blocks.js';
import { DocumentFileStore } from '../adapters/document-store.js';
import { DocumentError } from '../core/document-blocks.js';
import { GraphService } from '../application/dependency-graph.js';
import { GraphFileStore, readGraphInput } from '../adapters/graph-store.js';
import { GraphError } from '../core/dependency-graph.js';
import { startReader } from '../server/reader.js';
import { ReaderError } from '../application/file-reader.js';

const fixedOptions = ['--project', '--repository', '--prefix', '--commit'];

const commands: Record<string, { allowed: string[]; required: string[] }> = {
  serve: { allowed: ['--project', '--port'], required: ['--project'] },
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
  'apply-graph': { allowed: [...fixedOptions, '--input'], required: [...fixedOptions, '--input'] },
  'query-graph': { allowed: [...fixedOptions, '--path'], required: [...fixedOptions, '--path'] },
  'validate-graph': { allowed: fixedOptions, required: fixedOptions },
};

function argumentsFor(argv: string[]): { command: string; options: Map<string, string> } {
  const command = argv[0];
  const definition = command === undefined ? undefined : Object.hasOwn(commands, command) ? commands[command] : undefined;
  if (!command || !definition) {
    throw new SourceError('INVALID_ARGUMENT', '缺少有效命令。', '使用取源、文档或图命令，调用约定见 specs/002、003 与 004 的 contracts/cli.md。');
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
    if (command === 'serve') {
      const value = options.get('--port') ?? '4317';
      if (!/^[1-9]\d*$/u.test(value) || Number(value) > 65535) {
        throw new SourceError('INVALID_ARGUMENT', '阅读端口参数无效。', '使用 1 至 65535 的整数端口。');
      }
      const reader = await startReader(projectRoot, Number(value));
      process.stdout.write(`${JSON.stringify({ ok: true, status: 'ready', url: reader.url, projectRoot: reader.projectRoot })}\n`);
      const stop = async () => {
        await reader.server.close();
        process.stdout.write(`${JSON.stringify({ ok: true, status: 'stopped' })}\n`);
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    } else if (command === 'pin') {
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
      if (['apply-graph', 'query-graph', 'validate-graph'].includes(command)) {
        const graphs = new GraphService(service, new GraphFileStore());
        const source = { ...mapping, commit: options.get('--commit')! };
        requestContext = { ...source };
        if (command === 'apply-graph') {
          const inputPath = options.get('--input')!;
          requestContext = { ...source, inputPath };
          const result = await graphs.apply(source, await readGraphInput(inputPath));
          process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
        } else if (command === 'query-graph') {
          const filePath = options.get('--path')!;
          requestContext = { ...source, path: filePath };
          const result = await graphs.query(source, filePath);
          process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
        } else {
          const result = await graphs.validate(source);
          process.stdout.write(`${JSON.stringify({ ok: result.mechanicallyValid, result })}\n`);
          process.exitCode = result.mechanicallyValid ? 0 : 1;
        }
        return;
      }
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
    const problem = error instanceof SourceError || error instanceof DocumentError || error instanceof GraphError || error instanceof ReaderError ? error :
      new SourceError('INTERNAL_ERROR', '命令发生未预期错误。', '将命令及问题标识交给维护者检查。');
    process.stderr.write(`${JSON.stringify({ ok: false, error: {
      code: problem.code, message: problem.message, nextStep: problem.nextStep, context: { ...requestContext, ...problem.context },
      ...(problem instanceof GraphError && problem.diagnostics.length ? { diagnostics: problem.diagnostics } : {}),
    } })}\n`);
    process.exitCode = ['INVALID_ARGUMENT', 'INVALID_PATH', 'BLOCK_PLAN_INVALID', 'GRAPH_INPUT_INVALID'].includes(problem.code) ? 2 : 1;
  }
}

await main();
