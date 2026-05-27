import type { DestinationCandidate } from '../../../backend/navigation/navigationBackend';
import type { NormalizedPoint, RouteMode } from '../../../core/types';

export type NavigationStage =
  | 'analyzing-map'
  | 'map-analysis-failed'
  | 'awaiting-intent'
  | 'searching-destinations'
  | 'destination-candidates'
  | 'analyzing-intent'
  | 'needs-more-info'
  | 'show-result'
  | 'unsupported-intent';

export type NavigationFlowState = {
  stage: NavigationStage;
  imageDataUrl?: string;
  resultImageUrl?: string;
  path: NormalizedPoint[];
  promptText: string;
  destinationCandidates: DestinationCandidate[];
  destinationText: string;
  agentMessage: string;
  mode: RouteMode;
};

export type NavigationFlowAction =
  | { type: 'map-analysis-finished'; message: string }
  | { type: 'map-analysis-failed'; message: string }
  | { type: 'intent-text-changed'; value: string }
  | { type: 'destination-search-reset'; message?: string }
  | { type: 'destination-search-started' }
  | {
      type: 'destination-search-finished';
      candidates: DestinationCandidate[];
      message: string;
    }
  | { type: 'destination-search-failed'; message: string }
  | { type: 'intent-analysis-started' }
  | { type: 'intent-analysis-failed'; message: string }
  | {
      type: 'route-found';
      destinationText: string;
      resultImageUrl: string;
      path: NormalizedPoint[];
      message: string;
    }
  | { type: 'more-info-requested'; destinationText: string; message: string }
  | { type: 'unsupported-intent'; message: string };
