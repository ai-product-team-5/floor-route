export type PerspectivePoint = {
  x: number;
  y: number;
};

const MAX_OUTPUT_SIDE = 1400;

export async function correctPerspective(
  imageDataUrl: string,
  points: PerspectivePoint[],
) {
  if (points.length !== 4) {
    throw new Error('需要四个校正点。');
  }

  const image = await loadImage(imageDataUrl);
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;

  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    throw new Error('无法创建图片处理画布。');
  }

  sourceContext.drawImage(image, 0, 0);

  const sourcePoints = points.map((point) => ({
    x: point.x * image.naturalWidth,
    y: point.y * image.naturalHeight,
  }));

  const width = averageDistance(sourcePoints[0], sourcePoints[1], sourcePoints[3], sourcePoints[2]);
  const height = averageDistance(sourcePoints[0], sourcePoints[3], sourcePoints[1], sourcePoints[2]);
  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(width, height));
  const outputWidth = Math.max(64, Math.round(width * scale));
  const outputHeight = Math.max(64, Math.round(height * scale));

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;

  const outputContext = outputCanvas.getContext('2d');
  if (!outputContext) {
    throw new Error('无法创建校正结果画布。');
  }

  const sourceData = sourceContext.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
  const outputData = outputContext.createImageData(outputWidth, outputHeight);
  const homography = createDestinationToSourceHomography(
    outputWidth,
    outputHeight,
    sourcePoints,
  );

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const mapped = applyHomography(homography, x, y);
      writeBilinearSample(sourceData, outputData, x, y, mapped.x, mapped.y);
    }
  }

  outputContext.putImageData(outputData, 0, 0);
  return outputCanvas.toDataURL('image/jpeg', 0.92);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败。'));
    image.src = src;
  });
}

function averageDistance(
  a1: PerspectivePoint,
  a2: PerspectivePoint,
  b1: PerspectivePoint,
  b2: PerspectivePoint,
) {
  return (distance(a1, a2) + distance(b1, b2)) / 2;
}

function distance(a: PerspectivePoint, b: PerspectivePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createDestinationToSourceHomography(
  width: number,
  height: number,
  sourcePoints: PerspectivePoint[],
) {
  const destinationPoints = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];

  const matrix: number[][] = [];
  const values: number[] = [];

  destinationPoints.forEach((destination, index) => {
    const source = sourcePoints[index];

    matrix.push([
      destination.x,
      destination.y,
      1,
      0,
      0,
      0,
      -source.x * destination.x,
      -source.x * destination.y,
    ]);
    values.push(source.x);

    matrix.push([
      0,
      0,
      0,
      destination.x,
      destination.y,
      1,
      -source.y * destination.x,
      -source.y * destination.y,
    ]);
    values.push(source.y);
  });

  const solution = solveLinearSystem(matrix, values);
  return [...solution, 1];
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;

    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < 1e-10) {
      throw new Error('校正区域无效。');
    }

    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];

    const pivot = augmented[column][column];
    for (let col = column; col <= size; col += 1) {
      augmented[column][col] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;

      const factor = augmented[row][column];
      for (let col = column; col <= size; col += 1) {
        augmented[row][col] -= factor * augmented[column][col];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function applyHomography(h: number[], x: number, y: number) {
  const denominator = h[6] * x + h[7] * y + h[8];

  return {
    x: (h[0] * x + h[1] * y + h[2]) / denominator,
    y: (h[3] * x + h[4] * y + h[5]) / denominator,
  };
}

function writeBilinearSample(
  source: ImageData,
  output: ImageData,
  outputX: number,
  outputY: number,
  sourceX: number,
  sourceY: number,
) {
  const x = Math.min(source.width - 1, Math.max(0, sourceX));
  const y = Math.min(source.height - 1, Math.max(0, sourceY));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(source.width - 1, x0 + 1);
  const y1 = Math.min(source.height - 1, y0 + 1);
  const dx = x - x0;
  const dy = y - y0;
  const outputOffset = (outputY * output.width + outputX) * 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const top =
      readChannel(source, x0, y0, channel) * (1 - dx) +
      readChannel(source, x1, y0, channel) * dx;
    const bottom =
      readChannel(source, x0, y1, channel) * (1 - dx) +
      readChannel(source, x1, y1, channel) * dx;

    output.data[outputOffset + channel] = top * (1 - dy) + bottom * dy;
  }
}

function readChannel(data: ImageData, x: number, y: number, channel: number) {
  return data.data[(y * data.width + x) * 4 + channel];
}
