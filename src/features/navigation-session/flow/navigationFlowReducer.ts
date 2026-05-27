import type { RouteHistoryItem } from '../../../core/types';
import type { NavigationFlowAction, NavigationFlowState } from './navigationFlowTypes';

type NavigationFlowInitialInput = {
  initialRoute?: RouteHistoryItem;
  initialImageDataUrl?: string;
};

export const initialNavigationFlowState: NavigationFlowState = {
  stage: 'analyzing-map',
  imageDataUrl: undefined,
  resultImageUrl: undefined,
  path: [],
  promptText: '',
  destinationCandidates: [],
  destinationText: '',
  agentMessage: '',
  mode: 'ai-image',
};

export function createNavigationFlowState(
  input?: NavigationFlowInitialInput,
): NavigationFlowState {
  if (input?.initialRoute) {
    return routeHistoryItemToState(input.initialRoute);
  }

  if (input?.initialImageDataUrl) {
    return {
      ...initialNavigationFlowState,
      imageDataUrl: input.initialImageDataUrl,
      stage: 'analyzing-map',
    };
  }

  return initialNavigationFlowState;
}

export function navigationFlowReducer(
  state: NavigationFlowState,
  action: NavigationFlowAction,
): NavigationFlowState {
  switch (action.type) {
    case 'map-analysis-finished':
      return {
        ...state,
        agentMessage: action.message,
        stage: 'awaiting-intent',
      };
    case 'map-analysis-failed':
      return {
        ...state,
        agentMessage: action.message,
        stage: 'map-analysis-failed',
      };
    case 'intent-text-changed':
      return {
        ...state,
        promptText: action.value,
      };
    case 'destination-search-reset':
      return {
        ...state,
        promptText: '',
        destinationCandidates: [],
        agentMessage: action.message ?? state.agentMessage,
        stage: 'awaiting-intent',
      };
    case 'destination-search-started':
      return state.imageDataUrl
        ? {
            ...state,
            agentMessage: '',
            destinationCandidates: [],
            stage: 'searching-destinations',
          }
        : state;
    case 'destination-search-finished':
      return {
        ...state,
        agentMessage: action.message,
        destinationCandidates: action.candidates,
        stage: 'destination-candidates',
      };
    case 'destination-search-failed':
      return {
        ...state,
        agentMessage: action.message,
        destinationCandidates: [],
        stage: 'destination-candidates',
      };
    case 'intent-analysis-started':
      return state.imageDataUrl
        ? {
            ...state,
            agentMessage: '',
            stage: 'analyzing-intent',
          }
        : state;
    case 'intent-analysis-failed':
      return {
        ...state,
        promptText: '',
        agentMessage: action.message,
        stage: 'needs-more-info',
      };
    case 'route-found':
      return {
        ...state,
        destinationText: action.destinationText,
        promptText: '',
        resultImageUrl: action.resultImageUrl,
        path: action.path,
        agentMessage: action.message,
        mode: 'ai-image',
        stage: 'show-result',
      };
    case 'more-info-requested':
      return {
        ...state,
        destinationText: action.destinationText,
        promptText: '',
        agentMessage: action.message,
        stage: 'needs-more-info',
      };
    case 'unsupported-intent':
      return {
        ...state,
        promptText: '',
        agentMessage: action.message,
        stage: 'unsupported-intent',
      };
  }
}

function routeHistoryItemToState(item: RouteHistoryItem): NavigationFlowState {
  return {
    stage: 'show-result',
    imageDataUrl: item.originalImageUrl,
    resultImageUrl: item.resultImageUrl ?? item.originalImageUrl,
    path: item.path ?? [],
    promptText: '',
    destinationCandidates: [],
    destinationText: item.endText,
    agentMessage: '',
    mode: item.mode,
  };
}
