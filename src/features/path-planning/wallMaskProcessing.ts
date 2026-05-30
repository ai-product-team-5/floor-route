/**
 * 把 AI 返回的墙体掩码 data URL 处理成可寻路的占用栅格 + 距离场。
 *
 * 处理步骤：
 * 1. 加载图像，按长边等比缩放到工作分辨率（默认 400px）
 * 2. 灰度化 + 阈值化（< 128 视为墙）
 * 3. 形态学闭运算（3×3 三次迭代等价的方式：先膨胀后腐蚀）补小缝
 * 4. 距离变换（Chamfer 3-4，足够精度且 O(W*H)）
 *
 * 输出物可被 A* 直接消费，且可独立用于落点 snap。
 */

export type WallGrid = {
  /** 工作分辨率宽度（像素） */
  width: number;
  /** 工作分辨率高度（像素） */
  height: number;
  /** 占用栅格：1 = 墙（不可通行），0 = 空闲 */
  occupancy: Uint8Array;
  /** 距离场：每个像素到最近墙的欧氏距离近似（墙处为 0） */
  distance: Float32Array;
};

const DEFAULT_LONG_EDGE = 400;
const WALL_THRESHOLD = 128;

export async function buildWallGridFromMask(
  wallMaskDataUrl: string,
  longEdge: number = DEFAULT_LONG_EDGE,
): Promise<WallGrid> {
  const image = await loadImage(wallMaskDataUrl);
  const { width, height } = computeWorkSize(
    image.naturalWidth,
    image.naturalHeight,
    longEdge,
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('无法创建画布以处理墙体掩码');
  }
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  const occupancy = thresholdToOccupancy(imageData);
  const closed = morphClose(occupancy, width, height);
  const distance = chamferDistance(closed, width, height);

  return { width, height, occupancy: closed, distance };
}

function computeWorkSize(
  naturalWidth: number,
  naturalHeight: number,
  longEdge: number,
) {
  const scale = Math.min(1, longEdge / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(16, Math.round(naturalWidth * scale));
  const height = Math.max(16, Math.round(naturalHeight * scale));
  return { width, height };
}

function thresholdToOccupancy(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    // 灰度估计
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    out[j] = gray < WALL_THRESHOLD ? 1 : 0;
  }
  return out;
}

/**
 * 形态学闭运算：先 dilate（让墙变粗，缝隙合并）再 erode（恢复原粗细）。
 * 用 3×3 邻域，迭代 1 次足够补 1px 的缝。
 */
function morphClose(
  src: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const dilated = dilate3x3(src, width, height);
  const eroded = erode3x3(dilated, width, height);
  return eroded;
}

function dilate3x3(src: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let v = 0;
      for (let dy = -1; dy <= 1 && !v; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          if (src[ny * width + nx]) {
            v = 1;
            break;
          }
        }
      }
      out[y * width + x] = v;
    }
  }
  return out;
}

function erode3x3(src: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let v = 1;
      for (let dy = -1; dy <= 1 && v; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) {
          v = 0;
          break;
        }
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) {
            v = 0;
            break;
          }
          if (!src[ny * width + nx]) {
            v = 0;
            break;
          }
        }
      }
      out[y * width + x] = v;
    }
  }
  return out;
}

/**
 * 两遍 Chamfer 3-4 距离变换：
 * - 墙像素距离设为 0
 * - 空闲像素初始化为大值，正向遍历用左/上/左上/右上邻居松弛，反向遍历用右/下/右下/左下
 *
 * 距离单位是"近似像素"，结果除以 3 得到大致欧氏像素距离。
 */
function chamferDistance(
  occupancy: Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const INF = 1e9;
  const dist = new Float32Array(width * height);
  for (let i = 0; i < dist.length; i += 1) {
    dist[i] = occupancy[i] ? 0 : INF;
  }

  // 前向扫描
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (dist[idx] === 0) continue;
      let best = dist[idx];
      if (x > 0) best = Math.min(best, dist[idx - 1] + 3);
      if (y > 0) best = Math.min(best, dist[idx - width] + 3);
      if (x > 0 && y > 0) best = Math.min(best, dist[idx - width - 1] + 4);
      if (x < width - 1 && y > 0) best = Math.min(best, dist[idx - width + 1] + 4);
      dist[idx] = best;
    }
  }

  // 反向扫描
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const idx = y * width + x;
      if (dist[idx] === 0) continue;
      let best = dist[idx];
      if (x < width - 1) best = Math.min(best, dist[idx + 1] + 3);
      if (y < height - 1) best = Math.min(best, dist[idx + width] + 3);
      if (x < width - 1 && y < height - 1)
        best = Math.min(best, dist[idx + width + 1] + 4);
      if (x > 0 && y < height - 1)
        best = Math.min(best, dist[idx + width - 1] + 4);
      dist[idx] = best;
    }
  }

  // 转换成"近似像素"
  for (let i = 0; i < dist.length; i += 1) {
    dist[i] = dist[i] / 3;
  }
  return dist;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('墙体掩码图加载失败'));
    image.crossOrigin = 'anonymous';
    image.src = src;
  });
}

/**
 * 把归一化坐标 snap 到最近的可通行像素。
 * 用 BFS 在工作分辨率上从该点附近搜空闲像素。
 */
export function snapToFreePixel(
  grid: WallGrid,
  normalized: { x: number; y: number },
  maxRadius: number = 60,
): { gx: number; gy: number } | null {
  const { width, height, occupancy } = grid;
  const cx = Math.round(normalized.x * (width - 1));
  const cy = Math.round(normalized.y * (height - 1));

  if (cx < 0 || cx >= width || cy < 0 || cy >= height) return null;

  if (!occupancy[cy * width + cx]) {
    return { gx: cx, gy: cy };
  }

  const visited = new Uint8Array(width * height);
  const queue: number[] = [cx, cy];
  visited[cy * width + cx] = 1;

  while (queue.length > 0) {
    const x = queue.shift()!;
    const y = queue.shift()!;
    const r = Math.max(Math.abs(x - cx), Math.abs(y - cy));
    if (r > maxRadius) return null;

    if (!occupancy[y * width + x]) {
      return { gx: x, gy: y };
    }

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const idx = ny * width + nx;
      if (visited[idx]) continue;
      visited[idx] = 1;
      queue.push(nx, ny);
    }
  }

  return null;
}
