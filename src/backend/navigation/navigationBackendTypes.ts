import type { PerspectivePoint } from '../floor-plan/perspectiveTransform';

export type FloorPlanCorner = PerspectivePoint;

export type DetectCornersRequest = {
  imageDataUrl: string;
};

export type DetectCornersResult = {
  corners: FloorPlanCorner[];
  message?: string;
};

export type SearchDestinationsRequest = {
  imageDataUrl: string;
  query: string;
  limit?: number;
};

export type DestinationCandidate = {
  id: string;
  title: string;
  subtitle?: string;
  confidence: number;
};

export type SearchDestinationsResult = {
  candidates: DestinationCandidate[];
  message: string;
};

export type GeneratePathRequest = {
  imageDataUrl: string;
  destination: string;
};

export type GeneratePathResult = {
  resultImageUrl: string;
  message: string;
};

export type NavigationBackend = {
  detectCorners(request: DetectCornersRequest): Promise<DetectCornersResult>;
  searchDestinations(request: SearchDestinationsRequest): Promise<SearchDestinationsResult>;
  generatePath(request: GeneratePathRequest): Promise<GeneratePathResult>;
};
