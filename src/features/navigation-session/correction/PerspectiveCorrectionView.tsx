import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigationSessionApi } from '../api/navigationSessionApi';
import type { PerspectivePoint } from './perspectiveTransform';

type PerspectiveCorrectionViewProps = {
  imageDataUrl: string;
  onCancel: () => void;
  onRetake: () => void;
  onConfirm: (correctedImageDataUrl: string) => void;
};

type Size = {
  width: number;
  height: number;
};

const fallbackPoints: PerspectivePoint[] = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.08 },
  { x: 0.92, y: 0.92 },
  { x: 0.08, y: 0.92 },
];

export function PerspectiveCorrectionView({
  imageDataUrl,
  onCancel,
  onRetake,
  onConfirm,
}: PerspectiveCorrectionViewProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState(fallbackPoints);
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [workspaceSize, setWorkspaceSize] = useState<Size>({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 });
  const [isApplying, setIsApplying] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState('正在识别平面图边框...');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isCurrent = true;

    async function detectCorners() {
      try {
        const result = await navigationSessionApi.detectFloorPlanCorners({
          imageDataUrl,
        });

        if (!isCurrent) return;

        if (result.corners.length === 4) {
          setPoints(result.corners);
        }

        setDetectionMessage(
          result.message ??
            (result.source === 'detected'
              ? '已自动识别边框，可继续调整。'
              : '请拖动四角校正平面图边框。'),
        );
      } catch {
        if (isCurrent) {
          setDetectionMessage('未自动识别到边框，请手动调整四角。');
        }
      }
    }

    void detectCorners();

    return () => {
      isCurrent = false;
    };
  }, [imageDataUrl]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setWorkspaceSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  const imageRect = useMemo(
    () => getContainedRect(workspaceSize, imageSize),
    [workspaceSize, imageSize],
  );
  const overlayPoints = points.map((point) => normalizedToOverlay(point, imageRect));
  const polygonPoints = overlayPoints
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  function updatePoint(event: React.PointerEvent<SVGSVGElement>) {
    if (activePoint === null || !workspaceRef.current || imageRect.width <= 0) {
      return;
    }

    const rect = workspaceRef.current.getBoundingClientRect();
    const nextPoint = {
      x: clamp01((event.clientX - rect.left - imageRect.x) / imageRect.width),
      y: clamp01((event.clientY - rect.top - imageRect.y) / imageRect.height),
    };

    setPoints((current) =>
      current.map((point, index) => (index === activePoint ? nextPoint : point)),
    );
  }

  async function handleConfirm() {
    setErrorMessage('');
    setIsApplying(true);

    try {
      const result = await navigationSessionApi.correctFloorPlanPerspective({
        imageDataUrl,
        corners: points,
      });

      onConfirm(result.correctedImageDataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片校正失败，请重试。';
      setErrorMessage(message);
      setIsApplying(false);
    }
  }

  return (
    <section className="perspective-correction-view">
      <header className="correction-header">
        <button type="button" className="correction-icon-button" onClick={onCancel} aria-label="返回">
          <ArrowLeft aria-hidden="true" size={30} />
        </button>
        <div>
          <h1>校正平面图</h1>
          <p>拖动四角，让平面图正对画面。</p>
        </div>
      </header>

      <div ref={workspaceRef} className="correction-workspace">
        <img
          src={imageDataUrl}
          alt="待校正的平面图"
          className="correction-image"
          style={{
            left: imageRect.x,
            top: imageRect.y,
            width: imageRect.width,
            height: imageRect.height,
          }}
          onLoad={(event) => {
            setImageSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            });
          }}
        />
        <svg
          className="correction-overlay"
          role="presentation"
          onPointerMove={updatePoint}
          onPointerUp={() => setActivePoint(null)}
          onPointerCancel={() => setActivePoint(null)}
        >
          <polygon points={polygonPoints} className="correction-polygon-fill" />
          <polyline
            points={`${polygonPoints} ${overlayPoints[0]?.x ?? 0},${overlayPoints[0]?.y ?? 0}`}
            className="correction-polygon-line"
          />
          {overlayPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="13"
              className="correction-point"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setActivePoint(index);
              }}
            />
          ))}
        </svg>
      </div>

      {detectionMessage && <p className="correction-status">{detectionMessage}</p>}
      {errorMessage && <p className="correction-error">{errorMessage}</p>}

      <footer className="correction-actions">
        <button type="button" className="correction-secondary-action" onClick={onRetake}>
          <RotateCcw aria-hidden="true" size={20} />
          重拍
        </button>
        <button
          type="button"
          className="correction-primary-action"
          disabled={isApplying}
          onClick={() => void handleConfirm()}
        >
          <Check aria-hidden="true" size={24} />
          {isApplying ? '校正中' : '确认'}
        </button>
      </footer>
    </section>
  );
}

function getContainedRect(container: Size, image: Size) {
  if (!container.width || !container.height || !image.width || !image.height) {
    return { x: 0, y: 0, width: container.width, height: container.height };
  }

  const imageRatio = image.width / image.height;
  const containerRatio = container.width / container.height;

  if (containerRatio > imageRatio) {
    const height = container.height;
    const width = height * imageRatio;

    return {
      x: (container.width - width) / 2,
      y: 0,
      width,
      height,
    };
  }

  const width = container.width;
  const height = width / imageRatio;

  return {
    x: 0,
    y: (container.height - height) / 2,
    width,
    height,
  };
}

function normalizedToOverlay(point: PerspectivePoint, rect: DOMRect | (Size & { x: number; y: number })) {
  return {
    x: rect.x + point.x * rect.width,
    y: rect.y + point.y * rect.height,
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
