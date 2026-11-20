export function fitFloatingAxis(position: number, size: number, limit: number): number {
  const gap = 8;
  const near = position + gap;
  const far = position - gap - size;
  return Math.max(gap, Math.min(limit - size - gap, near + size + gap <= limit ? near : far));
}
