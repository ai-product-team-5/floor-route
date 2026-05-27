import type { RouteHistoryItem } from '../../../core/types';
import type { NavigationFlowAction, NavigationFlowState } from './navigationFlowTypes';

type NavigationFlowInitialInput = {
  initialRoute?: RouteHistoryItem;
  initialImageDataUrl?: string;
};

export const initialNavigationFlowState: NavigationFlowState = {
  stage: 'awaiting-intent',
  imageDataUrl: undefined,
  resultImageUrl: undefined,
  promptText: '',
  destinationCandidates: [],
  destinationText: '',
  agentMessage: '请描述你想去的位置。',
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
    };
  }

  return initialNavigationFlowState;
}

export function navigationFlowReducer(
  state: NavigationFlowState,
  action: NavigationFlowAction,
): NavigationFlowState {
  switch (action.type) {
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
    case 'path-generation-started':
      return state.imageDataUrl
        ? {
            ...state,
            agentMessage: '',
            stage: 'generating-path',
          }
        : state;
    case 'path-generation-failed':
      return {
        ...state,
        promptText: '',
        agentMessage: action.message,
        stage: 'awaiting-intent',
      };
    case 'path-generated':
      return {
        ...state,
        destinationText: action.destinationText,
        promptText: '',
        resultImageUrl: action.resultImageUrl,
        agentMessage: action.message,
        mode: 'ai-image',
        stage: 'show-result',
      };
  }
}

function routeHistoryItemToState(item: RouteHistoryItem): NavigationFlowState {
  return {
    stage: 'show-result',
    imageDataUrl: item.originalImageUrl,
    resultImageUrl: item.resultImageUrl ?? item.originalImageUrl,
    promptText: '',
    destinationCandidates: [],
    destinationText: item.endText,
    agentMessage: '',
    mode: item.mode,
  };
}
