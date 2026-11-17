export function isSourcePath(value: unknown): value is string {
  return typeof value === 'string' && value.isWellFormed() && value.length > 0 &&
    !/[\\:\x00-\x1f\x7f]/u.test(value) &&
    value.split('/').every(part => part !== '' && part !== '.' && part !== '..' && part.toLowerCase() !== '.git');
}
