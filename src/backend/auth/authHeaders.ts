import { backendConfig } from '../backendConfig';

export function createBackendAuthHeaders(): Record<string, string> {
  if (!backendConfig.apiToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${backendConfig.apiToken}`,
  };
}
