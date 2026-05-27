import type { NormalizedPoint } from '../../core/types';
import type { PerspectivePoint } from '../floor-plan/perspectiveTransform';

export type FloorPlanCorner = PerspectivePoint;

export type DetectFloorPlanCornersRequest = {
  imageDataUrl: string;
};

export type DetectFloorPlanCornersResult = {
  corners: FloorPlanCorner[];
  source: 'detected' | 'fallback';
  confidence?: number;
  method?: string;
  message?: string;
};

export type CorrectFloorPlanPerspectiveRequest = {
  imageDataUrl: string;
  corners: FloorPlanCorner[];
};

export type CorrectFloorPlanPerspectiveResult = {
  correctedImageDataUrl: string;
};

export type AnalyzeFloorPlanRequest = {
  imageDataUrl: string;
};

export type AnalyzeFloorPlanResult = {
  message: string;
};

export type DestinationCandidate = {
  id: string;
  title: string;
  subtitle?: string;
  confidence: number;
};

export type SearchDestinationCandidatesRequest = {
  imageDataUrl: string;
  query: string;
  limit?: number;
};

export type SearchDestinationCandidatesResult = {
  candidates: DestinationCandidate[];
  message: string;
};

export type ResolveNavigationIntentRequest = {
  imageDataUrl: string;
  prompt: string;
  previousPrompt?: string;
  destinationCandidate?: DestinationCandidate;
};

export type ResolveNavigationIntentResult =
  | {
      type: 'route-found';
      destinationText: string;
      resultImageUrl: string;
      path: NormalizedPoint[];
      message: string;
    }
  | {
      type: 'need-more-info';
      destinationText: string;
      message: string;
    }
  | {
      type: 'unsupported-intent';
      message: string;
    };

export type NavigationBackend = {
  detectFloorPlanCorners(
    request: DetectFloorPlanCornersRequest,
  ): Promise<DetectFloorPlanCornersResult>;
  correctFloorPlanPerspective(
    request: CorrectFloorPlanPerspectiveRequest,
  ): Promise<CorrectFloorPlanPerspectiveResult>;
  analyzeFloorPlan(request: AnalyzeFloorPlanRequest): Promise<AnalyzeFloorPlanResult>;
  searchDestinationCandidates(
    request: SearchDestinationCandidatesRequest,
  ): Promise<SearchDestinationCandidatesResult>;
  resolveNavigationIntent(
    request: ResolveNavigationIntentRequest,
  ): Promise<ResolveNavigationIntentResult>;
};
