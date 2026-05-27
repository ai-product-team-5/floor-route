export const backendConfig = {
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_FLOOR_ROUTE_API_BASE_URL),
};

function normalizeBaseUrl(value: string | undefined) {
  return (value?.trim() ?? '').replace(/\/+$/, '');
}
