export type BackendMode = 'local' | 'remote';
export type IntentRecognitionMode = 'mock' | 'text-model';
export type FloorPlanAnalysisMode = 'mock' | 'vision-model';

const rawMode = import.meta.env.VITE_FLOOR_ROUTE_BACKEND_MODE?.toLowerCase();
const rawIntentRecognitionMode =
  import.meta.env.VITE_FLOOR_ROUTE_INTENT_RECOGNITION_MODE?.toLowerCase();
const rawFloorPlanAnalysisMode =
  import.meta.env.VITE_FLOOR_ROUTE_FLOOR_PLAN_ANALYSIS_MODE?.toLowerCase();
const modelBaseUrl = normalizeBaseUrl(import.meta.env.VITE_FLOOR_ROUTE_MODEL_BASE_URL);
const modelApiKey = normalizeString(import.meta.env.VITE_FLOOR_ROUTE_MODEL_API_KEY);
const modelName = normalizeString(import.meta.env.VITE_FLOOR_ROUTE_MODEL_NAME);

export const backendConfig = {
  mode: rawMode === 'remote' ? 'remote' : 'local',
  intentRecognitionMode:
    rawIntentRecognitionMode === 'text-model' ? 'text-model' : 'mock',
  floorPlanAnalysisMode:
    rawFloorPlanAnalysisMode === 'vision-model' ? 'vision-model' : 'mock',
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_FLOOR_ROUTE_API_BASE_URL),
  modelBaseUrl,
  modelApiKey,
  modelName,
  textModelBaseUrl:
    normalizeBaseUrl(import.meta.env.VITE_FLOOR_ROUTE_TEXT_MODEL_BASE_URL) || modelBaseUrl,
  textModelApiKey:
    normalizeString(import.meta.env.VITE_FLOOR_ROUTE_TEXT_MODEL_API_KEY) || modelApiKey,
  textModelName:
    normalizeString(import.meta.env.VITE_FLOOR_ROUTE_TEXT_MODEL_NAME) || modelName,
  visionModelBaseUrl:
    normalizeBaseUrl(import.meta.env.VITE_FLOOR_ROUTE_VISION_MODEL_BASE_URL) || modelBaseUrl,
  visionModelApiKey:
    normalizeString(import.meta.env.VITE_FLOOR_ROUTE_VISION_MODEL_API_KEY) || modelApiKey,
  visionModelName:
    normalizeString(import.meta.env.VITE_FLOOR_ROUTE_VISION_MODEL_NAME) || modelName,
} satisfies {
  mode: BackendMode;
  intentRecognitionMode: IntentRecognitionMode;
  floorPlanAnalysisMode: FloorPlanAnalysisMode;
  apiBaseUrl: string;
  modelBaseUrl: string;
  modelApiKey: string;
  modelName: string;
  textModelBaseUrl: string;
  textModelApiKey: string;
  textModelName: string;
  visionModelBaseUrl: string;
  visionModelApiKey: string;
  visionModelName: string;
};

function normalizeBaseUrl(value: string | undefined) {
  return normalizeString(value).replace(/\/+$/, '');
}

function normalizeString(value: string | undefined) {
  return value?.trim() ?? '';
}
