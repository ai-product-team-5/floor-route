import type { NormalizedPoint, RouteMode } from '../../../core/types';

export type NavigationStage =
  | 'analyzing-map'
  | 'awaiting-intent'
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
  destinationText: string;
  agentMessage: string;
  mode: RouteMode;
};

export type NavigationFlowAction =
  | { type: 'map-analysis-finished'; message: string }
  | { type: 'intent-text-changed'; value: string }
  | { type: 'intent-analysis-started' }
  | {
      type: 'route-found';
      destinationText: string;
      resultImageUrl: string;
      path: NormalizedPoint[];
      message: string;
    }
  | { type: 'more-info-requested'; destinationText: string; message: string }
  | { type: 'unsupported-intent'; message: string };
