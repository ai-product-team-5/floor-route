const FLOOR_ROUTE_API_KEY_STORAGE_KEY = 'floor-route-api-key';

export function getFloorRouteApiKey() {
  return window.localStorage.getItem(FLOOR_ROUTE_API_KEY_STORAGE_KEY)?.trim() ?? '';
}

export function setFloorRouteApiKey(apiKey: string) {
  const normalized = apiKey.trim();

  if (!normalized) {
    clearFloorRouteApiKey();
    return;
  }

  window.localStorage.setItem(FLOOR_ROUTE_API_KEY_STORAGE_KEY, normalized);
}

export function clearFloorRouteApiKey() {
  window.localStorage.removeItem(FLOOR_ROUTE_API_KEY_STORAGE_KEY);
}
