import { localNavigationSessionApi } from './localNavigationSessionApi';

// Replace this binding when the real local algorithm/API implementation is ready.
export const navigationSessionApi = localNavigationSessionApi;

export type {
  AnalyzeFloorPlanRequest,
  AnalyzeFloorPlanResult,
  CorrectFloorPlanPerspectiveRequest,
  CorrectFloorPlanPerspectiveResult,
  DetectFloorPlanCornersRequest,
  DetectFloorPlanCornersResult,
  FloorPlanCorner,
  NavigationSessionApi,
  ResolveNavigationIntentRequest,
  ResolveNavigationIntentResult,
} from './navigationSessionApiTypes';
