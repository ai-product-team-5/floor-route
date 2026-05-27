import { backendConfig } from '../backendConfig';
import { createBackendAuthHeaders } from '../auth/authHeaders';
import type {
  DetectCornersRequest,
  DetectCornersResult,
  GeneratePathRequest,
  GeneratePathResult,
  NavigationBackend,
  SearchDestinationsRequest,
  SearchDestinationsResult,
} from './navigationBackendTypes';

export const navigationBackend: NavigationBackend = {
  detectCorners(request) {
    return postBackendJson<DetectCornersRequest, DetectCornersResult>(
      '/api/corner',
      request,
    );
  },

  searchDestinations(request) {
    return postBackendJson<SearchDestinationsRequest, SearchDestinationsResult>(
      '/api/search',
      request,
    );
  },

  generatePath(request) {
    return postBackendJson<GeneratePathRequest, GeneratePathResult>(
      '/api/path',
      request,
    );
  },
};

async function postBackendJson<RequestBody, ResponseBody>(
  path: string,
  body: RequestBody,
): Promise<ResponseBody> {
  if (!backendConfig.apiBaseUrl) {
    throw new Error('API 未配置。请设置 VITE_FLOOR_ROUTE_API_BASE_URL。');
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
    return data.message || data.error || `API 请求失败：${response.status}`;
  } catch {
    return `API 请求失败：${response.status}`;
  }
}
