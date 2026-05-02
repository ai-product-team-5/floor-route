import { normalizePoint } from './coordinates';
import type { NormalizedPoint } from './types';

export function createDemoPath(): NormalizedPoint[] {
  return [
    { x: 0.14, y: 0.78 },
    { x: 0.28, y: 0.78 },
    { x: 0.34, y: 0.58 },
    { x: 0.56, y: 0.58 },
    { x: 0.62, y: 0.38 },
    { x: 0.84, y: 0.32 },
  ].map(normalizePoint);
}
