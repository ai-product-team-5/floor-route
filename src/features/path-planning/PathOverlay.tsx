import { useEffect, useRef, useState } from 'react';
import type { NormalizedPoint } from '../../core/types';

type PathOverlayProps = {
  imageUrl: string;
  pathPoints: NormalizedPoint[];
  start: NormalizedPoint;
  end: NormalizedPoint;
  /** 是否启用 dash 流动动画 */
  animated?: boolean;
};

/**
 * 原图 + SVG 叠加层（红虚线路径 + 起绿/终红圆点）。
 *
 * 实现要点：
 * - SVG 用图像自然像素尺寸作为 viewBox（保证路径粗细、虚线间距视觉一致）
 * - 容器 position:relative，img 和 svg 都 absolute 充满，几何随图像缩放
 * - preserveAspectRatio=meet，让 svg 与 img(object-fit:contain) 行为一致
 */
export function PathOverlay({
  imageUrl,
  pathPoints,
  start,
  end,
  animated = false,
}: PathOverlayProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  // 用复合 state 把 size 和它对应的 url 绑在一起，imageUrl 变化时旧 size 自然失效（不再使用）。
  const [sizeState, setSizeState] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    function update() {
      if (!img) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setSizeState({
          url: imageUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
    }

    if (img.complete) {
      update();
      return;
    }

    img.addEventListener('load', update);
    return () => img.removeEventListener('load', update);
  }, [imageUrl]);

  const size = sizeState && sizeState.url === imageUrl ? sizeState : null;

  const W = size?.width ?? 1000;
  const H = size?.height ?? 1000;

  const dotR = Math.max(8, Math.min(W, H) * 0.012);
  const strokeWidth = Math.max(4, Math.min(W, H) * 0.008);
  const dashLen = strokeWidth * 2;
  const gapLen = strokeWidth * 1.4;

  const pathD = buildSvgPath(pathPoints, W, H);

  return (
    <div className="path-overlay-frame">
      <img ref={imgRef} src={imageUrl} alt="带路径的平面图" />
      {size && (
        <svg
          className="path-overlay-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {pathD && (
            <path
              d={pathD}
              stroke="#dc2626"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${dashLen} ${gapLen}`}
              fill="none"
              className={animated ? 'path-overlay-anim' : undefined}
            />
          )}
          <circle
            cx={start.x * W}
            cy={start.y * H}
            r={dotR}
            fill="#16a34a"
            stroke="#ffffff"
            strokeWidth={Math.max(2, strokeWidth * 0.4)}
          />
          <circle
            cx={end.x * W}
            cy={end.y * H}
            r={dotR}
            fill="#dc2626"
            stroke="#ffffff"
            strokeWidth={Math.max(2, strokeWidth * 0.4)}
          />
        </svg>
      )}
    </div>
  );
}

function buildSvgPath(
  points: NormalizedPoint[],
  width: number,
  height: number,
): string {
  if (!points.length) return '';
  const parts: string[] = [];
  points.forEach((p, i) => {
    const cmd = i === 0 ? 'M' : 'L';
    parts.push(`${cmd} ${(p.x * width).toFixed(2)} ${(p.y * height).toFixed(2)}`);
  });
  return parts.join(' ');
}
