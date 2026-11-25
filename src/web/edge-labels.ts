import type { Point } from '../core/canvas-layout.js';

interface Bounds extends Point { width: number; height: number }
interface LabelEdge { id: string; data: { label: string; accent: string } }

export function sampleCurve(line: string) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', line);
  const length = path.getTotalLength();
  const start = path.getPointAtLength(0);
  const count = Math.min(48, Math.max(1, Math.ceil(length / 32)));
  const segments: (Bounds & { dx: number; dy: number })[] = [];
  let a = start;
  for (let i = 1; i <= count; i++) {
    const b = path.getPointAtLength(length * i / count);
    segments.push({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y),
      dx: b.x - a.x, dy: b.y - a.y });
    a = b;
  }
  return { path, length, start, segments };
}

const measure = document.createElement('canvas').getContext('2d');
function overlaps(a: Bounds, b: Bounds) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function placeEdgeLabels(edges: LabelEdge[], curves: Map<string, ReturnType<typeof sampleCurve>>,
  occupied: Bounds[], view: Point & { zoom: number }, paneWidth: number, paneHeight: number) {
  const result: { id: string; label: string; color: string; width: number; x: number; y: number }[] = [];
  if (!measure) return result;
  measure.font = '600 12px system-ui, sans-serif';
  for (const { id, data } of edges) {
    const curve = curves.get(id);
    const width = Math.ceil(measure.measureText(data.label).width) + 12;
    if (!curve || curve.length * view.zoom < width + 24) continue;
    // Try near the middle first. All clearance is in screen pixels, including after zoom.
    const anchors = [.5, .4, .6, .3, .7, .2, .8, .13, .87].flatMap(fraction => {
      const at = curve.length * fraction;
      const point = curve.path.getPointAtLength(at);
      const next = curve.path.getPointAtLength(at + 1);
      const dx = next.x - point.x, dy = next.y - point.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = dy / length, ny = -dx / length;
      const gap = (Math.abs(nx) * width / 2 + Math.abs(ny) * 10 + 3) / view.zoom;
      return [1, -1].map(side => ({ x: point.x + side * nx * gap, y: point.y + side * ny * gap }));
    });
    for (const { x, y } of anchors) {
      const box = { x: x - (width / 2 + 4) / view.zoom, y: y - 14 / view.zoom,
        width: (width + 8) / view.zoom, height: 28 / view.zoom };
      if (box.x * view.zoom + view.x < 0 || (box.x + box.width) * view.zoom + view.x > paneWidth ||
          box.y * view.zoom + view.y < 0 || (box.y + box.height) * view.zoom + view.y > paneHeight) continue;
      if (occupied.some(obstacle => overlaps(box, obstacle))) continue;
      let crossing = false;
      for (const [other, route] of curves) {
        if (other === id) continue;
        crossing = route.segments.some(segment => {
          if (!overlaps(box, segment)) return false;
          // The two axis intervals overlap. Also test the normal to the sampled segment
          // so the empty corners of a diagonal segment's bounding box remain usable.
          const cx = box.x + box.width / 2 - (segment.x + segment.width / 2);
          const cy = box.y + box.height / 2 - (segment.y + segment.height / 2);
          return Math.abs(cx * segment.dy - cy * segment.dx) <=
            (box.width * Math.abs(segment.dy) + box.height * Math.abs(segment.dx)) / 2;
        });
        if (crossing) break;
      }
      if (crossing) continue;
      occupied.push(box);
      result.push({ id, label: data.label, color: data.accent, width, x, y });
      break;
    }
  }
  return result;
}
