import type { Viewport } from '../core/canvas-layout.js';

export interface CanvasPosition {
  selected: string;
  viewport?: Viewport;
  edge: string;
  detailScroll: number;
}
