import type { RouteHistoryItem } from '../../../core/types';
import type { NavigationFlowAction, NavigationFlowState } from './navigationFlowTypes';

type NavigationFlowInitialInput = {
  initialRoute?: RouteHistoryItem;
  initialImageDataUrl?: string;
};

const baseInitialState: NavigationFlowState = {
  stage: 'generating-walls',
  imageDataUrl: undefined,
  wallMaskDataUrl: undefined,
  promptText: '',
  destinationCandidates: [],
  destinationText: '',
  agentMessage: '正在分析平面图墙体结构…',
  mode: 'astar',
  startPoint: undefined,
  endPoint: undefined,
  pathPoints: undefined,
  resultImageUrl: undefined,
};

export function createNavigationFlowState(
  input?: NavigationFlowInitialInput,
): NavigationFlowState {
  if (input?.initialRoute) {
    return routeHistoryItemToState(input.initialRoute);
  }

  if (input?.initialImageDataUrl) {
    return {
      ...baseInitialState,
      imageDataUrl: input.initialImageDataUrl,
      stage: 'generating-walls',
      agentMessage: '正在分析平面图墙体结构…',
    };
  }

  return baseInitialState;
}

export function navigationFlowReducer(
  state: NavigationFlowState,
  action: NavigationFlowAction,
): NavigationFlowState {
  switch (action.type) {
    case 'walls-generation-started':
      return {
        ...state,
        stage: 'generating-walls',
        agentMessage: '正在分析平面图墙体结构…',
      };
    case 'walls-generation-finished':
      return {
        ...state,
        stage: 'showing-walls',
        wallMaskDataUrl: action.wallMaskDataUrl,
        agentMessage: 'AI 已识别平面图墙体结构。',
      };
    case 'walls-generation-failed':
      return {
        ...state,
        stage: 'generating-walls',
        agentMessage: action.message,
      };
    case 'walls-acknowledged':
      return {
        ...state,
        stage: 'awaiting-intent',
        agentMessage: '请描述你想去的位置。',
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
        destinationText: '',
        startPoint: undefined,
        endPoint: undefined,
        pathPoints: undefined,
        resultImageUrl: undefined,
        agentMessage: action.message ?? '请描述你想去的位置。',
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
    case 'endpoints-location-started':
      return {
        ...state,
        destinationText: action.destinationText,
        agentMessage: '正在定位起点和终点…',
        stage: 'locating-endpoints',
      };
    case 'endpoints-location-finished':
      // 直接进 planning-path；坐标由调用方使用，不必长期存 state
      return {
        ...state,
        agentMessage: action.message,
        stage: 'planning-path',
      };
    case 'endpoints-location-failed':
      return {
        ...state,
        agentMessage: action.message,
        stage: 'destination-candidates',
      };
    case 'path-planning-started':
      return {
        ...state,
        agentMessage: '正在规划路径…',
        stage: 'planning-path',
      };
    case 'path-planned':
      return {
        ...state,
        destinationText: action.destinationText,
        pathPoints: action.pathPoints,
        startPoint: action.startPoint,
        endPoint: action.endPoint,
        promptText: '',
        agentMessage: '路径已规划。',
        mode: 'astar',
        stage: 'show-result',
      };
    case 'path-planning-failed':
      return {
        ...state,
        agentMessage: action.message,
        stage: 'destination-candidates',
      };
  }
}

function routeHistoryItemToState(item: RouteHistoryItem): NavigationFlowState {
  return {
    stage: 'show-result',
    imageDataUrl: item.originalImageUrl,
    wallMaskDataUrl: item.wallMaskDataUrl,
    promptText: '',
    destinationCandidates: [],
    destinationText: item.endText,
    agentMessage: '',
    mode: item.mode,
    startPoint: item.startPoint,
    endPoint: item.endPoint,
    pathPoints: item.pathPoints,
    resultImageUrl: item.resultImageUrl,
  };
}
