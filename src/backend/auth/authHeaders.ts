import { getFloorRouteApiKey } from './floorRouteApiKey';

export function createBackendAuthHeaders(): Record<string, string> {
  const apiKey = getFloorRouteApiKey();

  if (!apiKey) {
    throw new Error('请先在「我的」页面设置 API Key');
  }

  return {
    Authorization: `Bearer ${apiKey}`,
  };
}
