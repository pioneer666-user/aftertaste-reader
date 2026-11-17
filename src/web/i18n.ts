export type Language = 'zh-CN' | 'en';

const chinese: Record<string, string> = {
  brand: '回味', title: '源码对照阅读', files: '文件讲解', refresh: '刷新资料',
  language: '界面语言', loading: '正在读取…', choose: '选择一篇讲解开始阅读',
  empty: '还没有文件讲解', emptyHelp: '请先为这个项目生成讲解，再刷新此页。',
  source: '固定源码', explanation: '讲解', document: '文档', commit: '源码提交',
  verified: '结构与源码范围校验通过', unfilled: '讲解尚未填写完成',
  fallback: '当前按普通 Markdown 阅读原文', unavailable: '固定源码不可用',
  fallbackHelp: '请按下方信息修复资料，完成后刷新页面。',
  issues: '检查结果', repair: '修复信息', copy: '复制修复信息', copied: '已复制',
  copyFailed: '自动复制失败，请选择下方文本手动复制。', manual: '可选择复制的修复信息',
  warning: '警告', error: '错误', line: '文档行', block: '块', next: '下一步',
  unknown: '未知', saved: '语言选择已保存', unsaved: '语言已切换，浏览器无法保存。本次页面内有效。',
  readError: '讲解读取失败', listError: '资料列表读取失败', project: '当前项目',
  retry: '重试读取', sourceScroll: '源码，可横向滚动查看长行',
  example: '示例代码', skip: '跳至阅读内容', readOnly: '本地只读',
};

const english: Record<string, string> = {
  title: 'Source comparison', files: 'File explanations', refresh: 'Refresh documents',
  language: 'Interface language', loading: 'Reading…', choose: 'Choose an explanation to start reading',
  empty: 'No file explanations yet', emptyHelp: 'Generate explanations for this project, then refresh this page.',
  source: 'Fixed source', explanation: 'Explanation', document: 'Document', commit: 'Source commit',
  verified: 'Structure and source ranges checked', unfilled: 'This explanation is unfinished',
  fallback: 'Reading the original as standard Markdown', unavailable: 'Fixed source unavailable',
  fallbackHelp: 'Use the repair information below, then refresh the page.',
  issues: 'Check results', repair: 'Repair information', copy: 'Copy repair information', copied: 'Copied',
  copyFailed: 'Automatic copy failed. Select the text below and copy it manually.', manual: 'Selectable repair information',
  warning: 'Warning', error: 'Error', line: 'Document line', block: 'Block', next: 'Next step',
  unknown: 'Unknown', saved: 'Language preference saved', unsaved: 'Language changed for this page. The browser could not save your preference.',
  readError: 'Could not read this explanation', listError: 'Could not read the document list', project: 'Current project',
  retry: 'Retry reading', sourceScroll: 'Source code, scroll horizontally to read long lines',
  example: 'Example code', skip: 'Skip to reading content', readOnly: 'Local read-only',
};

export function translate(language: Language, key: string): string {
  return (language === 'en' ? english[key] : undefined) ?? chinese[key] ?? key;
}

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

export function readLanguage(storage?: StorageReader): Language {
  try {
    const value = (storage ?? globalThis.localStorage).getItem('aftertaste.language');
    return value === 'en' ? 'en' : 'zh-CN';
  } catch { return 'zh-CN'; }
}

export function saveLanguage(language: Language, storage?: StorageWriter): boolean {
  try {
    (storage ?? globalThis.localStorage).setItem('aftertaste.language', language);
    return true;
  } catch { return false; }
}

// Stable codes select translations. User content and error sentences never select behavior.
const problems: Record<string, { zh: readonly [string, string]; en: readonly [string, string] }> = {
  DOCUMENT_HEADER: { zh: ['固定提交头缺失、重复或位置无效。', '仅在首行保留一个含完整提交的 document 标记。'], en: ['The fixed-commit header is missing, duplicated or misplaced.', 'Keep one document marker with the full commit on the first line.'] },
  OUTSIDE_CONTENT: { zh: ['块外含有正文。', '将正文放进成对块标记内。'], en: ['Content appears outside a block.', 'Move content inside paired block markers.'] },
  MARKER_INVALID: { zh: ['块标记格式无效。', '按块契约将完整标记独占一行。'], en: ['A block marker is malformed.', 'Place a complete marker on its own top-level line.'] },
  BLOCK_ORPHAN_END: { zh: ['结束标记没有开始标记。', '补齐开始标记或移除多余结束标记。'], en: ['An end marker has no opening marker.', 'Add its opening marker or remove the extra end marker.'] },
  BLOCK_NESTED: { zh: ['文档块发生嵌套。', '先结束当前块，再开始下一块。'], en: ['Document blocks are nested.', 'Close the current block before opening the next.'] },
  BLOCK_FIELDS_INVALID: { zh: ['块字段非法或重复。', '提供一个 id 和至多一个 lines 字段。'], en: ['Block fields are invalid or duplicated.', 'Provide one id and at most one lines field.'] },
  BLOCK_ID_INVALID: { zh: ['块 ID 格式无效。', '使用 8 位小写字母数字 ID。'], en: ['A block ID is invalid.', 'Use an eight-character lowercase alphanumeric ID.'] },
  BLOCK_ID_DUPLICATE: { zh: ['同篇块 ID 重复。', '核对块身份并由 AI 修复。'], en: ['A block ID is repeated in this document.', 'Ask the AI to check block identities and repair the duplicate.'] },
  RANGE_INVALID: { zh: ['源码范围无效。', '使用首尾包含的正整数范围。'], en: ['A source range is invalid.', 'Use a positive, inclusive start–end line range.'] },
  BLOCK_UNCLOSED: { zh: ['文档块尚未闭合。', '补齐顶层 aftertaste:end 标记。'], en: ['A document block is unclosed.', 'Add its top-level aftertaste:end marker.'] },
  EXPLANATION_EMPTY: { zh: ['块正文尚未填写。', '由 AI 填写讲解后再校验。'], en: ['This block has no explanation yet.', 'Ask the AI to fill in the explanation, then validate again.'] },
  EXPLANATION_TOO_LARGE: { zh: ['讲解大小 {count} 超过阈值 {limit}。', '由 AI 检查是否聚焦并告知用户。'], en: ['The explanation size of {count} exceeds the {limit} limit.', 'Ask the AI to check its focus and inform the reader.'] },
  SOURCE_TOO_LARGE: { zh: ['源码块 {count} 行超过阈值 {limit}。', '由 AI 检查分块并告知用户。'], en: ['This source block has {count} lines, exceeding the {limit}-line limit.', 'Ask the AI to review the block and inform the reader.'] },
  SOURCE_BOUNDS: { zh: ['范围 {start}–{end} 超过源码 {sourceLineCount} 行。', '按固定提交源码调整范围。'], en: ['Range {start}–{end} exceeds the source length of {sourceLineCount} lines.', 'Adjust the range against the fixed source.'] },
  SOURCE_ORDER: { zh: ['源码对照块顺序有误。', '按源码行号从前到后排列对照块。'], en: ['Source comparison blocks are out of order.', 'Order comparison blocks by source line number.'] },
  SOURCE_GAP: { zh: ['源码 {start}–{end} 行尚未覆盖。', '补齐固定源码的连续完整覆盖。'], en: ['Source lines {start}–{end} are not covered.', 'Cover every fixed-source line in consecutive ranges.'] },
  SOURCE_OVERLAP: { zh: ['源码 {start}–{end} 行重复覆盖。', '调整范围使每行恰好归属一块。'], en: ['Source lines {start}–{end} are covered more than once.', 'Adjust ranges so each source line belongs to one block.'] },
  SOURCE_UNAVAILABLE: { zh: ['固定源码不可读，源码校验未完成。', '核对下方 Git 问题后刷新。'], en: ['Fixed source could not be read. Source validation is incomplete.', 'Check the Git problem below, then refresh.'] },
  INVALID_ARGUMENT: { zh: ['读取参数无效。', '从页面选择已有讲解后重试。'], en: ['The reading arguments are invalid.', 'Select an existing explanation and try again.'] },
  INVALID_PATH: { zh: ['路径不符合镜像约定。', '使用 current 内无设备名、尾点或保留符号的规范镜像路径。'], en: ['The path does not follow the document mirror convention.', 'Use a canonical current mirror path without reserved names, trailing dots or reserved characters.'] },
  DOCUMENT_PATH_UNSAFE: { zh: ['资料路径含链接或非普通条目。', '使用指定项目中无链接的真实资料目录和普通文件。'], en: ['The document path contains a link or a non-regular entry.', 'Use real, unlinked directories and regular document files in the selected project.'] },
  DOCUMENT_READ_FAILED: { zh: ['讲解文档无法读取为 UTF-8。', '检查文件存在性、编码与读取权限。'], en: ['The explanation could not be read as UTF-8.', 'Check that the file exists, uses UTF-8 and is readable.'] },
  DOCUMENT_LIST_FAILED: { zh: ['资料条目或目录无法读取。', '检查 current 目录权限、类型和路径后刷新。'], en: ['A document entry or directory could not be read.', 'Check current directory permissions, entry types and paths, then refresh.'] },
  PROJECT_UNAVAILABLE: { zh: ['项目目录无法访问。', '检查项目目录存在性和访问权限。'], en: ['The project directory is unavailable.', 'Check that the project directory exists and is accessible.'] },
  PROJECT_PATH_UNSAFE: { zh: ['项目路径含链接或非普通目录。', '指定无链接祖先的真实项目目录。'], en: ['The project path contains a link or a non-directory entry.', 'Choose a real project directory with no linked ancestors.'] },
  NOT_REPOSITORY: { zh: ['项目不在可读取的 Git 仓库中。', '核对原项目仓库位置和可读性。'], en: ['The project is not in a readable Git repository.', 'Check the original project repository location and access.'] },
  GIT_UNAVAILABLE: { zh: ['Git 程序不可用。', '检查 Git 安装与进程权限。'], en: ['Git is unavailable.', 'Check the Git installation and process permissions.'] },
  NO_COMMIT: { zh: ['Git 中没有可用提交。', '核对文档引用的原始提交。'], en: ['Git has no available commit.', 'Check the original commit referenced by the document.'] },
  INVALID_REVISION: { zh: ['提交引用无效。', '核对文档头中的完整本地提交。'], en: ['The commit reference is invalid.', 'Check the full local commit in the document header.'] },
  OBJECT_UNAVAILABLE: { zh: ['Git 提交或对象不可读取。', '核对原仓库中引用对象的存在性和访问权限。'], en: ['The Git commit or object is unavailable.', 'Check that the referenced object exists and is readable in the original repository.'] },
  FILE_NOT_FOUND: { zh: ['固定提交中找不到源码文件。', '核对文档镜像路径及其提交。'], en: ['The source file is missing from the fixed commit.', 'Check the document mirror path and its commit.'] },
  UNSUPPORTED_FILE_TYPE: { zh: ['固定源码的文件类型不受支持。', '使用普通文本源码文件。'], en: ['The fixed source has an unsupported file type.', 'Use a regular text source file.'] },
  UNSUPPORTED_ENCODING: { zh: ['固定源码编码不受支持。', '核对原提交中的 UTF-8 文本文件。'], en: ['The fixed source encoding is unsupported.', 'Check the UTF-8 text file in the original commit.'] },
  UNSUPPORTED_TARGET: { zh: ['Git 项目类型或映射不受支持。', '使用普通本地仓库内的真实项目目录。'], en: ['The Git project type or mapping is unsupported.', 'Use a real project directory in a regular local repository.'] },
  GIT_READ_FAILED: { zh: ['Git 读取未完成。', '检查 Git 2.45+、权限、本地对象及读取限制。'], en: ['Git could not complete the read.', 'Check Git 2.45+, permissions, local objects and read limits.'] },
  ACCESS_DENIED: { zh: ['请求来源不允许访问。', '直接打开启动命令输出的本机阅读地址。'], en: ['This request origin is not allowed.', 'Open the local reading URL printed by the start command.'] },
  NOT_FOUND: { zh: ['阅读资源不存在。', '刷新列表并选择已有讲解。'], en: ['The reading resource was not found.', 'Refresh the list and choose an existing explanation.'] },
  METHOD_NOT_ALLOWED: { zh: ['阅读接口仅支持读取。', '使用页面的选择和刷新。'], en: ['The reading endpoint only accepts reads.', 'Use the page file selector or refresh control.'] },
  NETWORK_ERROR: { zh: ['无法连接本地阅读服务。', '检查服务仍在运行，然后重试。'], en: ['Could not connect to the local reading service.', 'Check that the service is running, then retry.'] },
  INTERNAL_ERROR: { zh: ['阅读服务发生未预期错误。', '将问题标识和操作交给维护者检查。'], en: ['An unexpected reading service error occurred.', 'Share the problem code and your action with the maintainer.'] },
};

export function problemText(language: Language, problem: {
  code: string; params?: Readonly<Record<string, string | number>>; message?: string; nextStep?: string;
}): { message: string; nextStep: string } {
  const entry = problems[problem.code];
  const pair = language === 'en' ? entry?.en ?? entry?.zh : entry?.zh;
  const fill = (text: string) => text.replace(/\{(\w+)\}/gu, (_match, key: string) => String(problem.params?.[key] ?? '?'));
  return {
    message: fill(pair?.[0] ?? problem.message ?? translate('zh-CN', 'unknown')),
    nextStep: fill(pair?.[1] ?? problem.nextStep ?? translate('zh-CN', 'retry')),
  };
}
