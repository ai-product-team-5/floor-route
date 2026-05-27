import { backendConfig } from '../backendConfig';
import { createBackendAuthHeaders } from '../auth/authHeaders';
import { localNavigationBackend } from './localNavigationBackend';
import type {
  AnalyzeFloorPlanRequest,
  AnalyzeFloorPlanResult,
  NavigationBackend,
  ResolveNavigationIntentRequest,
  ResolveNavigationIntentResult,
  SearchDestinationCandidatesRequest,
  SearchDestinationCandidatesResult,
} from './navigationBackendTypes';

export const remoteNavigationBackend: NavigationBackend = {
  detectFloorPlanCorners: localNavigationBackend.detectFloorPlanCorners,
  correctFloorPlanPerspective: localNavigationBackend.correctFloorPlanPerspective,

  analyzeFloorPlan(request) {
    return postBackendJson<AnalyzeFloorPlanRequest, AnalyzeFloorPlanResult>(
      '/api/navigation/analyze-floor-plan',
      request,
    );
  },

  searchDestinationCandidates(request) {
    return postBackendJson<SearchDestinationCandidatesRequest, SearchDestinationCandidatesResult>(
      '/api/navigation/search-destinations',
      request,
    );
  },

  resolveNavigationIntent(request) {
    return postBackendJson<ResolveNavigationIntentRequest, ResolveNavigationIntentResult>(
      '/api/navigation/resolve-intent',
      request,
    );
  },
};

async function postBackendJson<RequestBody, ResponseBody>(
  path: string,
  body: RequestBody,
): Promise<ResponseBody> {
  if (!backendConfig.apiBaseUrl) {
    throw new Error('远程 API 未配置。请设置 VITE_FLOOR_ROUTE_API_BASE_URL。');
  }

  const response = await fetch(`${backendConfig.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...createBackendAuthHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await createBackendErrorMessage(response));
  }

  return response.json() as Promise<ResponseBody>;
}

async function createBackendErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return data.message || data.error || `远程 API 请求失败：${response.status}`;
  } catch {
    return `远程 API 请求失败：${response.status}`;
  }
}
