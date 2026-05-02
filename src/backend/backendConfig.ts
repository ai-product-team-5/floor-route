export type BackendMode = 'local' | 'remote';

const rawMode = import.meta.env.VITE_FLOOR_ROUTE_BACKEND_MODE?.toLowerCase();

export const backendConfig = {
  mode: rawMode === 'remote' ? 'remote' : 'local',
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_FLOOR_ROUTE_API_BASE_URL),
  apiToken: import.meta.env.VITE_FLOOR_ROUTE_API_TOKEN?.trim() ?? '',
} satisfies {
  mode: BackendMode;
  apiBaseUrl: string;
  apiToken: string;
};

function normalizeBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '') ?? '';
}
