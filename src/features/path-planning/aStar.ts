/**
 * 加权 A* 寻路。8-connected。
 * cost = 步长 + λ · max(0, safe - distToWall) / safe
 * 让路径自然贴走廊中线、远离墙。
 */

import type { WallGrid } from './wallMaskProcessing';

export type GridPoint = { gx: number; gy: number };

export type AStarOptions = {
  /** 安全距离（像素）。距离场 < safe 的点会受到额外代价惩罚 */
  safeDist?: number;
  /** 惩罚权重 */
  lambda?: number;
  /** 节点扩展上限，防止异常时无限循环 */
  maxNodes?: number;
};

const DEFAULT_OPTIONS: Required<AStarOptions> = {
  safeDist: 8,
  lambda: 1.5,
  maxNodes: 200_000,
};

const NEIGHBORS: Array<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * 二叉小顶堆，按 fScore 排序。
 */
class MinHeap {
  private readonly nodes: number[] = [];
  private readonly scores: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, score: number) {
    this.nodes.push(node);
    this.scores.push(score);
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): number | undefined {
    if (this.nodes.length === 0) return undefined;
    const top = this.nodes[0];
    const lastNode = this.nodes.pop()!;
    const lastScore = this.scores.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.scores[0] = lastScore;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.scores[index] >= this.scores[parent]) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  private sinkDown(index: number) {
    const n = this.nodes.length;
    while (true) {
      const l = index * 2 + 1;
      const r = index * 2 + 2;
      let smallest = index;
      if (l < n && this.scores[l] < this.scores[smallest]) smallest = l;
      if (r < n && this.scores[r] < this.scores[smallest]) smallest = r;
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(a: number, b: number) {
    const tn = this.nodes[a];
    this.nodes[a] = this.nodes[b];
    this.nodes[b] = tn;
    const ts = this.scores[a];
    this.scores[a] = this.scores[b];
    this.scores[b] = ts;
  }
}

export function findPath(
  grid: WallGrid,
  start: GridPoint,
  end: GridPoint,
  options: AStarOptions = {},
): GridPoint[] | null {
  const { safeDist, lambda, maxNodes } = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, occupancy, distance } = grid;

  if (
    !inBounds(start.gx, start.gy, width, height) ||
    !inBounds(end.gx, end.gy, width, height) ||
    occupancy[start.gy * width + start.gx] ||
    occupancy[end.gy * width + end.gx]
  ) {
    return null;
  }

  const total = width * height;
  const gScore = new Float32Array(total);
  const fScore = new Float32Array(total);
  const cameFrom = new Int32Array(total);
  const closed = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    gScore[i] = Infinity;
    fScore[i] = Infinity;
    cameFrom[i] = -1;
  }

  const startIdx = start.gy * width + start.gx;
  const endIdx = end.gy * width + end.gx;

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(start.gx, start.gy, end.gx, end.gy);

  const open = new MinHeap();
  open.push(startIdx, fScore[startIdx]);

  let visited = 0;

  while (open.size > 0) {
    const current = open.pop()!;
    if (current === endIdx) {
      return reconstructPath(cameFrom, current, width);
    }
    if (closed[current]) continue;
    closed[current] = 1;
    visited += 1;
    if (visited > maxNodes) {
      return null;
    }

    const cx = current % width;
    const cy = (current - cx) / width;

    for (const [dx, dy, step] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (occupancy[nIdx]) continue;
      // 防止对角线穿过墙角
      if (dx !== 0 && dy !== 0) {
        if (occupancy[cy * width + nx] || occupancy[ny * width + cx]) continue;
      }
      if (closed[nIdx]) continue;

      const nDist = distance[nIdx];
      const wallPenalty =
        nDist < safeDist ? (lambda * (safeDist - nDist)) / safeDist : 0;
      const tentativeG = gScore[current] + step * (1 + wallPenalty);

      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        const f = tentativeG + heuristic(nx, ny, end.gx, end.gy);
        fScore[nIdx] = f;
        open.push(nIdx, f);
      }
    }
  }

  return null;
}

function heuristic(x1: number, y1: number, x2: number, y2: number) {
  // 八向距离（admissible）：dx + dy + (sqrt2 - 2) * min(dx, dy)
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

function inBounds(x: number, y: number, w: number, h: number) {
  return x >= 0 && x < w && y >= 0 && y < h;
}

function reconstructPath(
  cameFrom: Int32Array,
  endIdx: number,
  width: number,
): GridPoint[] {
  const path: GridPoint[] = [];
  let current = endIdx;
  while (current !== -1) {
    const x = current % width;
    const y = (current - x) / width;
    path.push({ gx: x, gy: y });
    current = cameFrom[current];
  }
  path.reverse();
  return path;
}
