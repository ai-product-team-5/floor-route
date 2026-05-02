import type { NormalizedPoint } from '../../../core/types';

type RouteOverlayProps = {
  path: NormalizedPoint[];
};

export function RouteOverlay({ path }: RouteOverlayProps) {
  if (path.length < 2) {
    return null;
  }

  const points = path.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');
  const start = path[0];
  const end = path[path.length - 1];

  return (
    <svg className="route-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline className="route-line-shadow" points={points} />
      <polyline className="route-line" points={points} />
      <circle className="route-point route-point-start" cx={start.x * 100} cy={start.y * 100} r="3" />
      <circle className="route-point route-point-end" cx={end.x * 100} cy={end.y * 100} r="3" />
    </svg>
  );
}
