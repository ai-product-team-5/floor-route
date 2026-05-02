import { getFloorRouteApiKey } from './floorRouteApiKey';

export function createBackendAuthHeaders(): Record<string, string> {
  const apiKey = getFloorRouteApiKey();

  if (!apiKey) {
    throw new Error('远程 API key 未配置。请在“我的”页面设置 FloorRoute API key。');
  }

  return {
    Authorization: `Bearer ${apiKey}`,
  };
}
