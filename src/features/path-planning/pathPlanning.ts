/**
 * 把 AI 给的归一化起终点坐标 → snap → A* → 简化 → 归一化路径点。
 */

import type { NormalizedPoint } from '../../core/types';
import { findPath } from './aStar';
import { simplifyPath } from './pathSimplification';
import { snapToFreePixel, type WallGrid } from './wallMaskProcessing';

export type PlanPathInput = {
  grid: WallGrid;
  start: NormalizedPoint;
  end: NormalizedPoint;
};

export type PlanPathResult = {
  /** 归一化路径关键点（含起终点本身），按顺序连成线 */
  pathPoints: NormalizedPoint[];
  /** snap 后的起终点（归一化），用于结果页画起终点圆点 */
  snappedStart: NormalizedPoint;
  snappedEnd: NormalizedPoint;
};

export function planPath({ grid, start, end }: PlanPathInput): PlanPathResult {
  const snappedStart = snapToFreePixel(grid, start, Math.max(60, grid.width * 0.1));
  const snappedEnd = snapToFreePixel(grid, end, Math.max(60, grid.width * 0.1));

  if (!snappedStart) {
    throw new Error('起点附近没有可通行区域，请重试或重新拍摄。');
  }
  if (!snappedEnd) {
    throw new Error('终点附近没有可通行区域，请换个目的地或重新拍摄。');
  }

  const rawPath = findPath(grid, snappedStart, snappedEnd, {
    safeDist: 8,
    lambda: 1.5,
  });

  if (!rawPath || rawPath.length === 0) {
    throw new Error('起点和终点之间不连通，请尝试换张图或换个目的地。');
  }

  const simplified = simplifyPath(rawPath, 2);

  const pathPoints: NormalizedPoint[] = simplified.map((p) => ({
    x: p.gx / (grid.width - 1),
    y: p.gy / (grid.height - 1),
  }));

  return {
    pathPoints,
    snappedStart: {
      x: snappedStart.gx / (grid.width - 1),
      y: snappedStart.gy / (grid.height - 1),
    },
    snappedEnd: {
      x: snappedEnd.gx / (grid.width - 1),
      y: snappedEnd.gy / (grid.height - 1),
    },
  };
}
