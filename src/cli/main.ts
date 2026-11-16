import { FixedSourceService, SourceError } from '../application/fixed-source.js';
import { GitSourceRepository } from '../adapters/git-source.js';
import path from 'node:path';

function argumentsFor(argv: string[]): { command: string; options: Map<string, string> } {
  const command = argv[0];
  if (command !== 'pin' && command !== 'read') {
    throw new SourceError('INVALID_ARGUMENT', '缺少有效取源命令。', '使用 pin 或 read，调用约定见 specs/002-fixed-source/contracts/cli.md。');
  }
  const allowed = command === 'pin' ? ['--project', '--revision'] : ['--project', '--commit', '--path'];
  const options = new Map<string, string>();
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === undefined || !allowed.includes(key) || options.has(key) || value === undefined || value.length === 0) {
      throw new SourceError('INVALID_ARGUMENT', '命令选项无效、重复或缺少值。', '按调用约定提供各选项及独立参数值。');
    }
    options.set(key, value);
  }
  if (!options.has('--project') || (command === 'read' && (!options.has('--commit') || !options.has('--path')))) {
    throw new SourceError('INVALID_ARGUMENT', '缺少必要取源参数。', 'pin 需要 --project，read 还需要 --commit 和 --path。');
  }
  return { command, options };
}

async function main(): Promise<void> {
  try {
    const { command, options } = argumentsFor(process.argv.slice(2));
    const repository = new GitSourceRepository();
    const service = new FixedSourceService(repository);
    const projectRoot = options.get('--project')!;
    if (!projectRoot.isWellFormed() || !path.isAbsolute(projectRoot) || /[\x00-\x1f\x7f]/u.test(projectRoot)) {
      throw new SourceError('INVALID_ARGUMENT', '项目路径无效。', '提供绝对项目路径。');
    }
    if (command === 'pin') {
      const source = await service.pin(projectRoot, options.get('--revision'));
      process.stdout.write(`${JSON.stringify({ ok: true, source })}\n`);
    } else {
      const commit = options.get('--commit')!;
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commit)) {
        throw new SourceError('INVALID_ARGUMENT', 'read 需要完整固定提交标识。', '使用 pin 返回的完整 commit。');
      }
      const source = { ...await repository.locate(projectRoot), commit };
      const file = await service.read(source, options.get('--path')!);
      process.stdout.write(`${JSON.stringify({ ok: true, file })}\n`);
    }
  } catch (error) {
    const problem = error instanceof SourceError ? error :
      new SourceError('INTERNAL_ERROR', '取源发生未预期错误。', '将命令及问题标识交给维护者检查。');
    process.stderr.write(`${JSON.stringify({ ok: false, error: {
      code: problem.code, message: problem.message, nextStep: problem.nextStep, context: problem.context,
    } })}\n`);
    process.exitCode = problem.code === 'INVALID_ARGUMENT' || problem.code === 'INVALID_PATH' ? 2 : 1;
  }
}

await main();
