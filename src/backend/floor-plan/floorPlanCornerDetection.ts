import type * as OpenCv from '@techstark/opencv-js';
import type { PerspectivePoint } from './perspectiveTransform';

type CvRuntime = typeof OpenCv & {
  calledRun?: boolean;
  onRuntimeInitialized?: () => void;
  then?: undefined;
};

declare global {
  interface Window {
    cv?: CvRuntime;
    __floorRouteCornerDetectionDebug?: boolean;
  }
}

type PixelPoint = {
  x: number;
  y: number;
};

type FittedLine = {
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type Segment = [number, number, number, number];

type ContourRegion = {
  contour: OpenCv.Mat;
  contourIndex: number;
  points: PixelPoint[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
};

type QuadCandidate = {
  contourIndex: number;
  points: PixelPoint[];
  method: string;
  score: number;
};

type DetectionPipeline = {
  cv: CvRuntime;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  scale: number;
  imageData: ImageData;
  gray: Float32Array;
  blurred: Float32Array;
  rawEdges: Uint8Array;
  closedEdges: Uint8Array;
  rawContourCount: number;
  contours: ContourRegion[];
  candidates: QuadCandidate[];
  bestCandidate?: QuadCandidate;
  result: FloorPlanCornerDetectionResult | null;
};

export type FloorPlanCornerDetectionResult = {
  corners: PerspectivePoint[];
  confidence: number;
  method: string;
};

export type FloorPlanCornerDetectionDebugOutput = {
  image: {
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
    scale: number;
  };
  result: FloorPlanCornerDetectionResult | null;
  metrics: {
    rawEdgePixels: number;
    closedEdgePixels: number;
    rawContourCount: number;
    contourCount: number;
    contours: Array<{
      index: number;
      contourIndex: number;
      points: number;
      area: number;
      bounds: { x: number; y: number; width: number; height: number };
      areaRatio: number;
      firstPoints: PixelPoint[];
    }>;
    candidates: Array<{
      index: number;
      contourIndex: number;
      method: string;
      score: number;
      points: PixelPoint[];
    }>;
  };
  stages: Record<string, string>;
};

const MIN_AREA_RATIO = 0.3;
const OPENCV_SCRIPT_SRC = `${import.meta.env.BASE_URL}vendor/opencv.js`;

let openCvPromise: Promise<CvRuntime> | undefined;
let readyOpenCvRuntime: CvRuntime | undefined;

export async function detectFloorPlanCornersInImage(
  imageDataUrl: string,
): Promise<FloorPlanCornerDetectionResult | null> {
  const pipeline = await runDetectionPipeline(imageDataUrl);

  try {
    return pipeline.result;
  } finally {
    disposeDetectionPipeline(pipeline);
  }
}

export async function createFloorPlanCornerDetectionDebug(
  imageDataUrl: string,
): Promise<FloorPlanCornerDetectionDebugOutput> {
  const pipeline = await runDetectionPipeline(imageDataUrl);

  try {
    return {
      image: {
        originalWidth: pipeline.originalWidth,
        originalHeight: pipeline.originalHeight,
        width: pipeline.width,
        height: pipeline.height,
        scale: pipeline.scale,
      },
      result: pipeline.result,
      metrics: {
        rawEdgePixels: countOnes(pipeline.rawEdges),
        closedEdgePixels: countOnes(pipeline.closedEdges),
        rawContourCount: pipeline.rawContourCount,
        contourCount: pipeline.contours.length,
        contours: pipeline.contours.map((contour, index) => ({
          index,
          contourIndex: contour.contourIndex,
          points: contour.points.length,
          area: contour.area,
          bounds: {
            x: contour.minX,
            y: contour.minY,
            width: contour.maxX - contour.minX + 1,
            height: contour.maxY - contour.minY + 1,
          },
          areaRatio: contour.area / (pipeline.width * pipeline.height),
          firstPoints: contour.points.slice(0, 8),
        })),
        candidates: pipeline.candidates.map((candidate, index) => ({
          index,
          contourIndex: candidate.contourIndex,
          method: candidate.method,
          score: candidate.score,
          points: candidate.points,
        })),
      },
      stages: {
        '01-original': imageDataToDataUrl(pipeline.imageData),
        '02-grayscale': scalarToDataUrl(
          pipeline.gray,
          pipeline.width,
          pipeline.height,
        ),
        '03-gaussian-blur': scalarToDataUrl(
          pipeline.blurred,
          pipeline.width,
          pipeline.height,
        ),
        '04-canny-edges': binaryToDataUrl(
          pipeline.rawEdges,
          pipeline.width,
          pipeline.height,
        ),
        '05-morphology-close': binaryToDataUrl(
          pipeline.closedEdges,
          pipeline.width,
          pipeline.height,
        ),
        '06a-contours-direct': contoursDirectToDataUrl(
          pipeline.cv,
          pipeline.width,
          pipeline.height,
          pipeline.contours,
        ),
        '06b-contours-overlay': contoursOverlayToDataUrl(
          pipeline.cv,
          pipeline.imageData,
          pipeline.contours,
        ),
        '07-top-candidates': topCandidatesOverlayToDataUrl(
          pipeline.imageData,
          pipeline.candidates,
        ),
        '08-best-quad': bestCandidateOverlayToDataUrl(
          pipeline.imageData,
          pipeline.bestCandidate,
        ),
      },
    };
  } finally {
    disposeDetectionPipeline(pipeline);
  }
}

async function runDetectionPipeline(imageDataUrl: string): Promise<DetectionPipeline> {
  debugCornerDetectionStage('pipeline:start');
  const cv = await getOpenCv();
  debugCornerDetectionStage('opencv:ready');
  const image = await loadImage(imageDataUrl);
  debugCornerDetectionStage('image:loaded', {
    width: image.naturalWidth,
    height: image.naturalHeight,
  });
  const scale = 1;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const imageData = imageToScaledImageData(image, width, height);

  const src = cv.matFromImageData(imageData);
  const grayMat = new cv.Mat();
  const blurredMat = new cv.Mat();
  const rawEdgesMat = new cv.Mat();
  const closedEdgesMat = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(5, 5),
  );

  try {
    debugCornerDetectionStage('opencv:cvtColor:start');
    cv.cvtColor(src, grayMat, cv.COLOR_RGBA2GRAY);
    debugCornerDetectionStage('opencv:gaussianBlur:start');
    cv.GaussianBlur(grayMat, blurredMat, new cv.Size(5, 5), 0);
    debugCornerDetectionStage('opencv:canny:start');
    cv.Canny(blurredMat, rawEdgesMat, 30, 100);
    debugCornerDetectionStage('opencv:morphologyClose:start');
    cv.morphologyEx(rawEdgesMat, closedEdgesMat, cv.MORPH_CLOSE, kernel);
    debugCornerDetectionStage('opencv:findContours:start');
    cv.findContours(
      closedEdgesMat,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_NONE,
    );
    debugCornerDetectionStage('opencv:findContours:done', {
      count: contours.size(),
    });

    const contourRegions = extractExternalContours(cv, contours);
    debugCornerDetectionStage('contours:done', {
      count: contourRegions.length,
    });
    const candidates = createQuadCandidates(
      cv,
      contourRegions,
      rawEdgesMat,
      width,
      height,
    ).sort((a, b) => b.score - a.score);
    debugCornerDetectionStage('candidates:done', {
      count: candidates.length,
    });
    const bestCandidate = candidates[0];
    const result = bestCandidate
      ? candidateToDetectionResult(bestCandidate, width, height)
      : null;
    debugCornerDetectionStage('pipeline:done', {
      hasResult: result !== null,
    });

    return {
      cv,
      originalWidth: image.naturalWidth,
      originalHeight: image.naturalHeight,
      width,
      height,
      scale,
      imageData,
      gray: matToScalarArray(grayMat),
      blurred: matToScalarArray(blurredMat),
      rawEdges: matToBinaryArray(rawEdgesMat),
      closedEdges: matToBinaryArray(closedEdgesMat),
      rawContourCount: contours.size(),
      contours: contourRegions,
      candidates,
      bestCandidate,
      result,
    };
  } finally {
    deleteMats(src, grayMat, blurredMat, rawEdgesMat, closedEdgesMat, contours, hierarchy, kernel);
  }
}

function disposeDetectionPipeline(pipeline: DetectionPipeline) {
  deleteMats(...pipeline.contours.map((contour) => contour.contour));
}

function extractExternalContours(
  cv: CvRuntime,
  contours: OpenCv.MatVector,
) {
  const contourRegions: ContourRegion[] = [];

  for (let index = 0; index < contours.size(); index += 1) {
    const contour = contours.get(index);

    try {
      const points = contourToPoints(contour);
      if (points.length < 4) {
        continue;
      }

      const bounds = cv.boundingRect(contour);
      const area = cv.contourArea(contour);

      contourRegions.push({
        contour: contour.clone(),
        contourIndex: index,
        points,
        minX: bounds.x,
        minY: bounds.y,
        maxX: bounds.x + bounds.width - 1,
        maxY: bounds.y + bounds.height - 1,
        area,
      });
    } finally {
      contour.delete();
    }
  }

  return contourRegions;
}

function createQuadCandidates(
  cv: CvRuntime,
  contours: ContourRegion[],
  rawEdgesMat: OpenCv.Mat,
  width: number,
  height: number,
) {
  const candidates: QuadCandidate[] = [];
  const seen = new Set<string>();

  for (const contour of contours) {
    const edgeFit = fitQuadByMainEdges(cv, contour, width, height);
    if (!edgeFit || edgeFit.length !== 4) {
      continue;
    }

    const key = canonicalQuadKey(edgeFit);
    if (seen.has(key)) {
      continue;
    }

    const score = scoreQuad(cv, edgeFit, rawEdgesMat, width, height);
    if (score <= 0) {
      continue;
    }

    seen.add(key);
    candidates.push({
      contourIndex: contour.contourIndex,
      points: edgeFit,
      method: 'main_edge_fit',
      score,
    });
  }

  return candidates;
}

function fitQuadByMainEdges(
  cv: CvRuntime,
  contour: ContourRegion,
  width: number,
  height: number,
) {
  const lines = extractHoughLinesForContour(cv, contour, width, height);
  if (lines.length === 0) {
    return null;
  }

  const horizontal: Array<{ segment: Segment; length: number; center: number }> = [];
  const vertical: Array<{ segment: Segment; length: number; center: number }> = [];

  for (const segment of lines) {
    const [x1, y1, x2, y2] = segment;
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const length = Math.hypot(x2 - x1, y2 - y1);

    if (Math.abs(angle) <= 15 || Math.abs(Math.abs(angle) - 180) <= 15) {
      horizontal.push({ segment, length, center: (y1 + y2) / 2 });
    } else if (Math.abs(Math.abs(angle) - 90) <= 15) {
      vertical.push({ segment, length, center: (x1 + x2) / 2 });
    }
  }

  if (horizontal.length < 2 || vertical.length < 2) {
    return null;
  }

  const longestHorizontal = [...horizontal]
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);
  const longestVertical = [...vertical]
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);
  const topSeed = minBy(longestHorizontal, (line) => line.center);
  const bottomSeed = maxBy(longestHorizontal, (line) => line.center);
  const leftSeed = minBy(longestVertical, (line) => line.center);
  const rightSeed = maxBy(longestVertical, (line) => line.center);
  const yTolerance = 25;
  const xTolerance = 25;
  const topGroup = horizontal
    .filter((line) => Math.abs(line.center - topSeed.center) <= yTolerance)
    .map((line) => line.segment);
  const bottomGroup = horizontal
    .filter((line) => Math.abs(line.center - bottomSeed.center) <= yTolerance)
    .map((line) => line.segment);
  const leftGroup = vertical
    .filter((line) => Math.abs(line.center - leftSeed.center) <= xTolerance)
    .map((line) => line.segment);
  const rightGroup = vertical
    .filter((line) => Math.abs(line.center - rightSeed.center) <= xTolerance)
    .map((line) => line.segment);

  if (Math.min(topGroup.length, bottomGroup.length, leftGroup.length, rightGroup.length) < 1) {
    return null;
  }

  const topLine = fitLineFromSegments(cv, topGroup);
  const bottomLine = fitLineFromSegments(cv, bottomGroup);
  const leftLine = fitLineFromSegments(cv, leftGroup);
  const rightLine = fitLineFromSegments(cv, rightGroup);
  const quad = [
    intersectLines(topLine, leftLine),
    intersectLines(topLine, rightLine),
    intersectLines(bottomLine, rightLine),
    intersectLines(bottomLine, leftLine),
  ];

  if (!quad.every(isFinitePoint)) {
    return null;
  }

  return quad;
}

function extractHoughLinesForContour(
  cv: CvRuntime,
  contour: ContourRegion,
  width: number,
  height: number,
) {
  const mask = cv.Mat.zeros(height, width, cv.CV_8UC1);
  const contourVector = new cv.MatVector();
  const linesMat = new cv.Mat();

  try {
    contourVector.push_back(contour.contour);
    cv.drawContours(mask, contourVector, -1, new cv.Scalar(255), 1);
    cv.HoughLinesP(
      mask,
      linesMat,
      1,
      Math.PI / 180,
      60,
      80,
      20,
    );

    const segments: Segment[] = [];
    for (let row = 0; row < linesMat.rows; row += 1) {
      const offset = row * 4;
      segments.push([
        linesMat.data32S[offset],
        linesMat.data32S[offset + 1],
        linesMat.data32S[offset + 2],
        linesMat.data32S[offset + 3],
      ]);
    }

    return segments;
  } finally {
    deleteMats(mask, contourVector, linesMat);
  }
}

function fitLineFromSegments(cv: CvRuntime, segments: Segment[]): FittedLine {
  const pointData = new Float32Array(segments.length * 4);
  segments.forEach(([x1, y1, x2, y2], index) => {
    const offset = index * 4;
    pointData[offset] = x1;
    pointData[offset + 1] = y1;
    pointData[offset + 2] = x2;
    pointData[offset + 3] = y2;
  });

  const points = cv.matFromArray(segments.length * 2, 1, cv.CV_32FC2, pointData);
  const line = new cv.Mat();

  try {
    cv.fitLine(points, line, cv.DIST_L2, 0, 0.01, 0.01);

    return {
      vx: line.data32F[0],
      vy: line.data32F[1],
      x: line.data32F[2],
      y: line.data32F[3],
    };
  } finally {
    deleteMats(points, line);
  }
}

function scoreQuad(
  cv: CvRuntime,
  points: PixelPoint[],
  rawEdgesMat: OpenCv.Mat,
  width: number,
  height: number,
) {
  if (points.length !== 4 || !points.every(isFinitePoint)) {
    return 0;
  }

  const quadMat = pointsToContourMat(cv, points, true);
  const borderMask = cv.Mat.zeros(height, width, cv.CV_8UC1);
  const intersection = new cv.Mat();

  try {
    const area = cv.contourArea(quadMat);
    const areaRatio = area / (height * width);
    if (areaRatio < MIN_AREA_RATIO) {
      return 0;
    }

    const ordered = orderPoints(points);
    const quadInt = ordered.map((point) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
    }));

    for (let index = 0; index < 4; index += 1) {
      const start = quadInt[index];
      const end = quadInt[(index + 1) % 4];
      cv.line(
        borderMask,
        new cv.Point(start.x, start.y),
        new cv.Point(end.x, end.y),
        new cv.Scalar(255),
        6,
      );
    }

    cv.bitwise_and(borderMask, rawEdgesMat, intersection);
    const supportPixels = cv.countNonZero(intersection);
    let perimeter = 0;

    for (let index = 0; index < 4; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % 4];
      perimeter += Math.hypot(end.x - start.x, end.y - start.y);
    }

    const supportRatio = perimeter > 0 ? supportPixels / (perimeter * 0.75) : 0;
    const supportScore = Math.min(supportRatio, 2);
    const areaScore = areaRatio >= 0.25 && areaRatio <= 0.85 ? 1 : 0.3;

    return 0.75 * supportScore + 0.25 * areaScore;
  } finally {
    deleteMats(quadMat, borderMask, intersection);
  }
}

function candidateToDetectionResult(
  candidate: QuadCandidate,
  width: number,
  height: number,
): FloorPlanCornerDetectionResult {
  const ordered = orderPoints(candidate.points);

  return {
    corners: ordered.map((point) => ({
      x: clamp01(point.x / width),
      y: clamp01(point.y / height),
    })),
    confidence: Math.min(1, candidate.score),
    method: candidate.method,
  };
}

function imageToScaledImageData(
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建图片处理画布。');
  }

  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function matToScalarArray(mat: OpenCv.Mat) {
  const output = new Float32Array(mat.rows * mat.cols);

  for (let index = 0; index < output.length; index += 1) {
    output[index] = mat.data[index];
  }

  return output;
}

function matToBinaryArray(mat: OpenCv.Mat) {
  const output = new Uint8Array(mat.rows * mat.cols);

  for (let index = 0; index < output.length; index += 1) {
    output[index] = mat.data[index] > 0 ? 1 : 0;
  }

  return output;
}

function contourToPoints(contour: OpenCv.Mat) {
  const points: PixelPoint[] = [];

  for (let index = 0; index < contour.data32S.length; index += 2) {
    points.push({
      x: contour.data32S[index],
      y: contour.data32S[index + 1],
    });
  }

  return points;
}

function pointsToContourMat(
  cv: CvRuntime,
  points: PixelPoint[],
  rounded: boolean,
) {
  const data = new Float32Array(points.length * 2);

  points.forEach((point, index) => {
    const offset = index * 2;
    data[offset] = rounded ? Math.round(point.x) : point.x;
    data[offset + 1] = rounded ? Math.round(point.y) : point.y;
  });

  return cv.matFromArray(points.length, 1, cv.CV_32FC2, data);
}

function imageDataToDataUrl(imageData: ImageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const context = canvas.getContext('2d');
  if (!context) {
    return '';
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function scalarToDataUrl(values: Float32Array, width: number, height: number) {
  const imageData = new ImageData(width, height);

  for (let index = 0; index < values.length; index += 1) {
    const value = clampInt(Math.round(values[index]), 0, 255);
    const offset = index * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }

  return imageDataToDataUrl(imageData);
}

function binaryToDataUrl(values: Uint8Array, width: number, height: number) {
  const imageData = new ImageData(width, height);

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ? 255 : 0;
    const offset = index * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }

  return imageDataToDataUrl(imageData);
}

function matRgbaToDataUrl(mat: OpenCv.Mat) {
  const rgba = new Uint8ClampedArray(mat.data);
  return imageDataToDataUrl(new ImageData(rgba, mat.cols, mat.rows));
}

function contoursDirectToDataUrl(
  cv: CvRuntime,
  width: number,
  height: number,
  contours: ContourRegion[],
) {
  const output = cv.Mat.zeros(height, width, cv.CV_8UC4);
  const contourVector = new cv.MatVector();

  try {
    contours.forEach((contour) => contourVector.push_back(contour.contour));
    cv.drawContours(
      output,
      contourVector,
      -1,
      new cv.Scalar(0, 255, 0, 255),
      2,
    );

    return matRgbaToDataUrl(output);
  } finally {
    deleteMats(output, contourVector);
  }
}

function contoursOverlayToDataUrl(
  cv: CvRuntime,
  imageData: ImageData,
  contours: ContourRegion[],
) {
  const output = cv.matFromImageData(imageData);
  const contourVector = new cv.MatVector();

  try {
    contours.forEach((contour) => contourVector.push_back(contour.contour));
    cv.drawContours(
      output,
      contourVector,
      -1,
      new cv.Scalar(0, 255, 0, 255),
      2,
    );

    return matRgbaToDataUrl(output);
  } finally {
    deleteMats(output, contourVector);
  }
}

function topCandidatesOverlayToDataUrl(
  imageData: ImageData,
  candidates: QuadCandidate[],
) {
  if (candidates.length === 0) {
    return overlayToDataUrl(imageData, (context) => {
      drawLabel(context, 'no candidate_quads', 16, 28, '#b42318');
    });
  }

  const previews = candidates.slice(0, 3);
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width * previews.length;
  canvas.height = imageData.height;

  const context = canvas.getContext('2d');
  if (!context) {
    return '';
  }

  previews.forEach((candidate, index) => {
    context.putImageData(imageData, index * imageData.width, 0);
    context.save();
    context.translate(index * imageData.width, 0);

    const color = componentColor(index);
    drawQuad(context, orderPoints(candidate.points), color, 3);
    drawLabel(
      context,
      `${candidate.method} | score=${candidate.score.toFixed(3)}`,
      20,
      40,
      color,
    );
    context.restore();
  });

  return canvas.toDataURL('image/png');
}

function bestCandidateOverlayToDataUrl(
  imageData: ImageData,
  candidate: QuadCandidate | undefined,
) {
  return overlayToDataUrl(imageData, (context) => {
    if (!candidate) {
      drawLabel(context, 'no valid candidate', 16, 28, '#b42318');
      return;
    }

    drawQuad(context, orderPoints(candidate.points), '#08d8c0', 5);
    drawLabel(
      context,
      `${candidate.method} ${candidate.score.toFixed(3)}`,
      candidate.points[0].x + 4,
      candidate.points[0].y + 24,
      '#08d8c0',
    );
  });
}

function overlayToDataUrl(
  imageData: ImageData,
  draw: (context: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const context = canvas.getContext('2d');
  if (!context) {
    return '';
  }

  context.putImageData(imageData, 0, 0);
  draw(context);
  return canvas.toDataURL('image/png');
}

function drawQuad(
  context: CanvasRenderingContext2D,
  points: PixelPoint[],
  color: string,
  lineWidth: number,
) {
  if (points.length !== 4) {
    return;
  }

  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }

  context.closePath();
  context.stroke();

  points.forEach((point, index) => {
    context.beginPath();
    context.arc(point.x, point.y, 7, 0, Math.PI * 2);
    context.fill();
    drawLabel(context, String(index), point.x + 8, point.y - 8, color);
  });

  context.restore();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
) {
  context.save();
  context.font = '14px sans-serif';
  const metrics = context.measureText(text);
  context.fillStyle = 'rgba(255,255,255,0.86)';
  context.fillRect(x - 3, y - 15, metrics.width + 6, 20);
  context.fillStyle = color;
  context.fillText(text, x, y);
  context.restore();
}

function intersectLines(first: FittedLine, second: FittedLine): PixelPoint {
  const matrixDeterminant = first.vx * -second.vy - -second.vx * first.vy;
  if (Math.abs(matrixDeterminant) < 1e-6) {
    return { x: Number.NaN, y: Number.NaN };
  }

  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const t = (dx * -second.vy - -second.vx * dy) / matrixDeterminant;

  return {
    x: first.x + t * first.vx,
    y: first.y + t * first.vy,
  };
}

function orderPoints(points: PixelPoint[]) {
  const ordered = new Array<PixelPoint>(4);
  const sums = points.map((point) => point.x + point.y);
  const diffs = points.map((point) => point.y - point.x);

  ordered[0] = points[indexOfMin(sums)];
  ordered[2] = points[indexOfMax(sums)];
  ordered[1] = points[indexOfMin(diffs)];
  ordered[3] = points[indexOfMax(diffs)];

  return ordered;
}

function canonicalQuadKey(points: PixelPoint[]) {
  return orderPoints(points)
    .flatMap((point) => [point.x, point.y])
    .map((value) => value.toFixed(1))
    .join(',');
}

function minBy<T>(items: T[], valueOf: (item: T) => number) {
  return items.reduce((best, item) =>
    valueOf(item) < valueOf(best) ? item : best,
  );
}

function maxBy<T>(items: T[], valueOf: (item: T) => number) {
  return items.reduce((best, item) =>
    valueOf(item) > valueOf(best) ? item : best,
  );
}

function countOnes(values: Uint8Array) {
  let count = 0;

  for (const value of values) {
    if (value === 1) {
      count += 1;
    }
  }

  return count;
}

function isFinitePoint(point: PixelPoint | null): point is PixelPoint {
  return point !== null && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function indexOfMin(values: number[]) {
  return values.reduce(
    (best, value, index) => (value < values[best] ? index : best),
    0,
  );
}

function indexOfMax(values: number[]) {
  return values.reduce(
    (best, value, index) => (value > values[best] ? index : best),
    0,
  );
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function componentColor(index: number) {
  const colors = [
    '#08d8c0',
    '#ff4d4f',
    '#2f80ed',
    '#f2994a',
    '#9b51e0',
    '#27ae60',
    '#eb5757',
    '#56ccf2',
  ];

  return colors[index % colors.length];
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败。'));
    image.src = src;
  });
}

function getOpenCv(): Promise<CvRuntime> {
  openCvPromise ??= loadOpenCvScript();

  return openCvPromise;
}

function loadOpenCvScript() {
  return new Promise<CvRuntime>((resolve, reject) => {
    const existingRuntime = getReadyOpenCv();
    if (existingRuntime) {
      debugCornerDetectionStage('opencv-loader:existing-runtime');
      resolve(existingRuntime);
      return;
    }

    let script = document.querySelector<HTMLScriptElement>(
      'script[data-floor-route-opencv]',
    );

    if (!script) {
      script = document.createElement('script');
      script.src = OPENCV_SCRIPT_SRC;
      script.async = true;
      script.dataset.floorRouteOpencv = 'true';
      script.onload = () => {
        debugCornerDetectionStage('opencv-loader:script-load');
      };
      script.onerror = () => {
        debugCornerDetectionStage('opencv-loader:script-error', {
          src: script?.src,
        });
        reject(new Error('OpenCV.js 加载失败。'));
      };
      debugCornerDetectionStage('opencv-loader:add-script', {
        src: script.src,
      });
      document.head.appendChild(script);
    } else {
      debugCornerDetectionStage('opencv-loader:reuse-script', {
        src: script.src,
      });
    }

    waitForOpenCvRuntime(resolve, reject);
  });
}

function waitForOpenCvRuntime(
  resolve: (cv: CvRuntime) => void,
  reject: (error: Error) => void,
) {
  const startedAt = Date.now();
  let lastLogAt = 0;

  function check() {
    const cv = getReadyOpenCv();
    if (cv) {
      debugCornerDetectionStage('opencv-loader:runtime-ready');
      resolve(cv);
      return;
    }

    if (Date.now() - lastLogAt > 1_000) {
      lastLogAt = Date.now();
      debugCornerDetectionStage('opencv-loader:waiting', {
        cvType: typeof window.cv,
        hasMat: window.cv ? typeof window.cv.Mat : 'missing',
        hasCanny: window.cv ? typeof window.cv.Canny : 'missing',
      });
    }

    if (Date.now() - startedAt > 30_000) {
      reject(new Error('OpenCV.js 初始化超时。'));
      return;
    }

    window.setTimeout(check, 30);
  }

  check();
}

function getReadyOpenCv() {
  const cv = window.cv;

  if (!cv || typeof cv.Mat !== 'function' || typeof cv.Canny !== 'function') {
    return null;
  }

  readyOpenCvRuntime ??= makeNonThenableOpenCvRuntime(cv);

  return readyOpenCvRuntime;
}

function makeNonThenableOpenCvRuntime(cv: CvRuntime) {
  if (typeof Reflect.get(cv, 'then') !== 'function') {
    return cv;
  }

  try {
    Object.defineProperty(cv, 'then', {
      configurable: true,
      value: undefined,
    });

    return cv;
  } catch {
    return new Proxy(cv, {
      get(target, property, receiver) {
        if (property === 'then') {
          return undefined;
        }

        return Reflect.get(target, property, receiver);
      },
    });
  }
}

function debugCornerDetectionStage(label: string, data?: unknown) {
  if (window.__floorRouteCornerDetectionDebug !== true) {
    return;
  }

  console.debug(`[corner-detection] ${label}`, data ?? '');
}

function deleteMats(
  ...mats: Array<{ delete: () => void } | undefined>
) {
  mats.forEach((mat) => {
    mat?.delete();
  });
}
