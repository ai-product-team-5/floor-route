import { backendConfig } from '../backendConfig';
import { createBackendAuthHeaders } from '../auth/authHeaders';
import type {
  GeneratePathRequest,
  GeneratePathResult,
  NavigationBackend,
  SearchDestinationsRequest,
  SearchDestinationsResult,
} from './navigationBackendTypes';

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 480_000;

export const navigationBackend: NavigationBackend = {
  async searchDestinations(request) {
    return postBackendJson<SearchDestinationsRequest, SearchDestinationsResult>(
      '/api/search',
      { ...request, imageDataUrl: await compressImageDataUrl(request.imageDataUrl) },
    );
  },

  async generatePath(request) {
    const compressed = await compressImageDataUrl(request.imageDataUrl);

    // Submit task
    const { taskId } = await postBackendJson<
      GeneratePathRequest,
      { taskId: string; message: string }
    >('/api/path', { ...request, imageDataUrl: compressed });

    // Poll until completed or failed
    return pollTask(taskId);
  },
};

async function pollTask(taskId: string): Promise<GeneratePathResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const result = await getBackendJson<{
      status: 'processing' | 'completed' | 'failed';
      resultImageUrl?: string;
      message?: string;
    }>(`/api/task/${taskId}`);

    if (result.status === 'completed' && result.resultImageUrl) {
      return { resultImageUrl: result.resultImageUrl, message: result.message ?? '路线已生成' };
    }

    if (result.status === 'failed') {
      throw new Error(result.message ?? '路线生成失败');
    }
  }

  throw new Error('路线生成超时，请重试');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function getBackendJson<ResponseBody>(path: string): Promise<ResponseBody> {
  if (!backendConfig.apiBaseUrl) {
    throw new Error('API 未配置。请设置 VITE_FLOOR_ROUTE_API_BASE_URL。');
  }

  const response = await fetch(`${backendConfig.apiBaseUrl}${path}`, {
    method: 'GET',
    headers: createBackendAuthHeaders(),
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
