import { backendConfig } from '../backendConfig';
import { localNavigationBackend } from './localNavigationBackend';
import { remoteNavigationBackend } from './remoteNavigationBackend';

export const navigationBackend =
  backendConfig.mode === 'remote' ? remoteNavigationBackend : localNavigationBackend;

export type {
  AnalyzeFloorPlanRequest,
  AnalyzeFloorPlanResult,
  CorrectFloorPlanPerspectiveRequest,
  CorrectFloorPlanPerspectiveResult,
  DetectFloorPlanCornersRequest,
  DetectFloorPlanCornersResult,
  FloorPlanCorner,
  NavigationBackend,
  ResolveNavigationIntentRequest,
  ResolveNavigationIntentResult,
} from './navigationBackendTypes';
