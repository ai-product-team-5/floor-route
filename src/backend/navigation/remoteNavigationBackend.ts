import { backendConfig } from '../backendConfig';
import { createBackendAuthHeaders } from '../auth/authHeaders';
import type {
  GenerateWallMaskRequest,
  GenerateWallMaskResult,
  LocateEndpointsRequest,
  LocateEndpointsResult,
  NavigationBackend,
  SearchDestinationsRequest,
  SearchDestinationsResult,
} from './navigationBackendTypes';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 480_000;

export const navigationBackend: NavigationBackend = {
  async searchDestinations(request, options) {
    return postBackendJson<SearchDestinationsRequest, SearchDestinationsResult>(
      '/api/search',
      { ...request, imageDataUrl: await compressImageDataUrl(request.imageDataUrl) },
      options?.signal,
    );
  },

  async generateWallMask(request, options) {
    const compressed = await compressImageDataUrl(request.imageDataUrl);

    const { taskId } = await postBackendJson<
      GenerateWallMaskRequest,
      { taskId: string; message: string }
    >('/api/walls', { imageDataUrl: compressed }, options?.signal);

    return pollWallMaskTask(taskId, options?.signal);
  },

  async locateEndpoints(request, options) {
    const compressed = await compressImageDataUrl(request.imageDataUrl);
    return postBackendJson<LocateEndpointsRequest, LocateEndpointsResult>(
      '/api/endpoints',
      { ...request, imageDataUrl: compressed },
      options?.signal,
    );
  },
};

async function pollWallMaskTask(
  taskId: string,
  signal?: AbortSignal,
): Promise<GenerateWallMaskResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    await sleep(POLL_INTERVAL_MS, signal);

    const result = await getBackendJson<{
      status: 'processing' | 'completed' | 'failed';
      wallMaskDataUrl?: string;
      message?: string;
    }>(`/api/task/${taskId}`, signal);

    if (result.status === 'completed' && result.wallMaskDataUrl) {
      return {
        wallMaskDataUrl: result.wallMaskDataUrl,
        message: result.message ?? '墙体掩码已生成',
      };
    }

    if (result.status === 'failed') {
      throw new Error(result.message ?? '墙体生成失败');
    }
  }

  throw new Error('墙体生成超时，请重试');
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort);
  });
}

function compressImageDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = dataUrl;
  });
}

async function postBackendJson<RequestBody, ResponseBody>(
  path: string,
  body: RequestBody,
  signal?: AbortSignal,
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
    signal,
  });

  if (!response.ok) {
    throw new Error(await createBackendErrorMessage(response));
  }

  return response.json() as Promise<ResponseBody>;
}

async function getBackendJson<ResponseBody>(
  path: string,
  signal?: AbortSignal,
): Promise<ResponseBody> {
  if (!backendConfig.apiBaseUrl) {
    throw new Error('API 未配置。请设置 VITE_FLOOR_ROUTE_API_BASE_URL。');
  }

  const response = await fetch(`${backendConfig.apiBaseUrl}${path}`, {
    method: 'GET',
    headers: createBackendAuthHeaders(),
    signal,
  });

  if (!response.ok) {
    throw new Error(await createBackendErrorMessage(response));
  }

  return response.json() as Promise<ResponseBody>;
}

const errorMessageMap: Record<string, string> = {
  missing_api_key: '请先在「我的」页面设置 API Key',
  invalid_api_key: 'API Key 无效，请检查后重新输入',
  disabled_api_key: 'API Key 已被禁用',
  insufficient_credits: '算力不足，请充值后重试',
  task_not_found: '任务不存在',
};

async function createBackendErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    return errorMessageMap[data.error ?? ''] || data.message || `请求失败（${response.status}）`;
  } catch {
    return `请求失败（${response.status}）`;
  }
}
