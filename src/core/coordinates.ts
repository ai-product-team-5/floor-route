import type { NormalizedPoint } from './types';

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function normalizePoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: clamp01(point.x),
    y: clamp01(point.y),
  };
}
