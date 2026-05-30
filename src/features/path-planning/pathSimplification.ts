/**
 * Douglas-Peucker 路径简化：把 A* 输出的逐像素折线压缩成几个关键拐点。
 */

import type { GridPoint } from './aStar';

export function simplifyPath(
  points: GridPoint[],
  epsilon: number = 2,
): GridPoint[] {
  if (points.length <= 2) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIndex = -1;

    for (let i = start + 1; i < end; i += 1) {
      const d = perpendicularDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }

    if (maxIndex !== -1 && maxDist > epsilon) {
      keep[maxIndex] = 1;
      stack.push([start, maxIndex]);
      stack.push([maxIndex, end]);
    }
  }

  const result: GridPoint[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

function perpendicularDistance(
  p: GridPoint,
  a: GridPoint,
  b: GridPoint,
): number {
  const dx = b.gx - a.gx;
  const dy = b.gy - a.gy;
  if (dx === 0 && dy === 0) {
    const ex = p.gx - a.gx;
    const ey = p.gy - a.gy;
    return Math.hypot(ex, ey);
  }
  const num = Math.abs(dy * p.gx - dx * p.gy + b.gx * a.gy - b.gy * a.gx);
  const den = Math.hypot(dx, dy);
  return num / den;
}
