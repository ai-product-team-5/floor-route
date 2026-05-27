import type { DestinationCandidate } from '../../../backend/navigation/navigationBackend';
import type { RouteMode } from '../../../core/types';

export type NavigationStage =
  | 'awaiting-intent'
  | 'searching-destinations'
  | 'destination-candidates'
  | 'generating-path'
  | 'show-result';

export type NavigationFlowState = {
  stage: NavigationStage;
  imageDataUrl?: string;
  resultImageUrl?: string;
  promptText: string;
  destinationCandidates: DestinationCandidate[];
  destinationText: string;
  agentMessage: string;
  mode: RouteMode;
};

export type NavigationFlowAction =
  | { type: 'intent-text-changed'; value: string }
  | { type: 'destination-search-reset'; message?: string }
  | { type: 'destination-search-started' }
  | {
      type: 'destination-search-finished';
      candidates: DestinationCandidate[];
      message: string;
    }
  | { type: 'destination-search-failed'; message: string }
  | { type: 'path-generation-started' }
  | { type: 'path-generation-failed'; message: string }
  | {
      type: 'path-generated';
      destinationText: string;
      resultImageUrl: string;
      message: string;
    };
