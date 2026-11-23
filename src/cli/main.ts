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
import { LoopService, loopMarkdown } from '../application/loops.js';
import { LoopFileStore, readLoopInput } from '../adapters/loop-store.js';
import { LoopError } from '../core/loops.js';

import { buffer as readBuffer } from 'node:stream/consumers';
import { isUtf8 } from 'node:buffer';
import { reviseDocument, reviseStep, RevisionError } from '../application/revisions.js';
import { replaceCurrent } from '../adapters/replace-current.js';

const revisionOptions = ['--project', '--commit', '--expected'];
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
  'query-legends': { allowed: [...fixedOptions, '--id'], required: fixedOptions },
  'validate-graph': { allowed: fixedOptions, required: fixedOptions },
  'revise-document': { allowed: [...revisionOptions, '--document', '--block', '--blocks'], required: [...revisionOptions, '--document'] },
  'revise-step': { allowed: [...revisionOptions, '--id', '--step', '--field'], required: [...revisionOptions, '--id', '--step', '--field'] },
  'create-loop': { allowed: [...fixedOptions, '--id', '--input'], required: [...fixedOptions, '--id', '--input'] },
  'read-loop': { allowed: ['--project', '--id', '--format'], required: ['--project', '--id'] },
};

function argumentsFor(argv: string[]): { command: string; options: Map<string, string> } {
  const command = argv[0];
  const definition = command === undefined ? undefined : Object.hasOwn(commands, command) ? commands[command] : undefined;
  if (!command || !definition) {
    throw new SourceError('INVALID_ARGUMENT', '缺少有效命令。', '使用取源、文档、图或闭环命令，调用约定见各能力的 contracts/cli.md。');
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
    } else if (command === 'revise-document' || command === 'revise-step') {
      const commit = options.get('--commit')!, expected = options.get('--expected')!;
      requestContext = Object.fromEntries(options);
      if (!/^[a-f0-9]{64}$/u.test(expected)) throw new SourceError('INVALID_ARGUMENT', '原文摘要无效。', '提供读取原文时的 SHA-256。');
      const documents = new DocumentService(service, new DocumentFileStore());
      const input = await readBuffer(process.stdin);
      if (!isUtf8(input)) throw new RevisionError('REVISION_INVALID', '修订正文不是有效 UTF-8。');
      const text = input.toString('utf8');
      if (!text.trim()) throw new RevisionError('REVISION_INVALID', '修订正文为空。');
      let result;
      if (command === 'revise-document') {
        const single = options.get('--block'), multiple = options.get('--blocks');
        if (!!single === !!multiple) throw new SourceError('INVALID_ARGUMENT', '需指定普通修订或重新分块。', '单选 --block 或 --blocks。');
        result = await reviseDocument(documents, replaceCurrent, projectRoot, options.get('--document')!,
          commit, expected, single ? [single] : multiple!.split(','), !!multiple, text);
      } else {
        const store = new LoopFileStore();
        const loops = new LoopService(service, documents, new GraphService(service, new GraphFileStore()), store);
        result = await reviseStep(loops, store, replaceCurrent, projectRoot, options.get('--id')!, options.get('--step')!,
          options.get('--field')!, commit, expected, text);
      }
      process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
    } else if (command === 'create-loop' || command === 'read-loop') {
      const loops = new LoopService(service, new DocumentService(service, new DocumentFileStore()),
        new GraphService(service, new GraphFileStore()), new LoopFileStore());
      const id = options.get('--id')!;
      requestContext = { projectRoot, loopId: id };
      if (command === 'create-loop') {
        const source = { projectRoot, repositoryRoot: options.get('--repository')!,
          projectPrefix: options.get('--prefix')!, commit: options.get('--commit')! };
        const inputPath = options.get('--input')!;
        requestContext = { ...requestContext, ...source, inputPath };
        const result = await loops.create(source, id, await readLoopInput(inputPath));
        process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
      } else {
        const format = options.get('--format') ?? 'json';
        if (format !== 'json' && format !== 'markdown') {
          throw new SourceError('INVALID_ARGUMENT', '读回格式无效。', '使用 json 或 markdown。');
        }
        const result = await loops.read(projectRoot, id);
        process.stdout.write(format === 'markdown' ? loopMarkdown(result) : `${JSON.stringify({ ok: true, result })}\n`);
      }
    } else {
      const mapping = { projectRoot, repositoryRoot: options.get('--repository')!, projectPrefix: options.get('--prefix')! };
      if (['apply-graph', 'query-graph', 'query-legends', 'validate-graph'].includes(command)) {
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
        } else if (command === 'query-legends') {
          const result = await graphs.queryLegends(source, options.get('--id'));
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
    const problem = error instanceof RevisionError || error instanceof SourceError || error instanceof DocumentError || error instanceof GraphError || error instanceof ReaderError || error instanceof LoopError ? error :
      new SourceError('INTERNAL_ERROR', '命令发生未预期错误。', '将命令及问题标识交给维护者检查。');
    process.stderr.write(`${JSON.stringify({ ok: false, error: {
      code: problem.code, message: problem.message, nextStep: problem.nextStep, context: { ...requestContext, ...problem.context },
      ...(problem instanceof GraphError && problem.diagnostics.length ? { diagnostics: problem.diagnostics } : {}),
    } })}\n`);
    process.exitCode = ['INVALID_ARGUMENT', 'INVALID_PATH', 'BLOCK_PLAN_INVALID', 'GRAPH_INPUT_INVALID', 'LOOP_INPUT_INVALID'].includes(problem.code) ? 2 : 1;
  }
}

await main();
