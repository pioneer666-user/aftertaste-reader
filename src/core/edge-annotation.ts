export interface EdgeAnnotation {
  readonly label?: string;
  readonly color?: 'theme' | 'red' | 'green';
}

export const edgeAnnotationKeys = ['label', 'color'];

export function readEdgeAnnotation(data: Record<string, unknown>, field: string,
  fail: (field: string, reason: string) => never): EdgeAnnotation {
  const { label, color } = data;
  if (label !== undefined && (typeof label !== 'string' || !label.isWellFormed() ||
      !label.trim() || /[\r\n\u2028\u2029]/u.test(label))) return fail(field + '.label', 'EDGE_LABEL');
  if (color !== undefined && color !== 'theme' && color !== 'red' && color !== 'green') return fail(field + '.color', 'EDGE_COLOR');
  return { ...(label !== undefined && { label }), ...(color !== undefined && { color }) };
}
