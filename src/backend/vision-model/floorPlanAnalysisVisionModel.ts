import { backendConfig } from '../backendConfig';
import type {
  AnalyzeFloorPlanRequest,
  AnalyzeFloorPlanResult,
  SearchDestinationCandidatesRequest,
  SearchDestinationCandidatesResult,
} from '../navigation/navigationBackendTypes';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type FloorPlanAnalysisDecision = {
  message?: string;
};

type DestinationSearchDecision = {
  message?: string;
  candidates?: Array<{
    id?: string;
    title?: string;
    subtitle?: string;
    confidence?: number;
  }>;
};

export async function analyzeFloorPlanWithVisionModel({
  imageDataUrl,
}: AnalyzeFloorPlanRequest): Promise<AnalyzeFloorPlanResult> {
  if (
    !backendConfig.visionModelBaseUrl ||
    !backendConfig.visionModelApiKey ||
    !backendConfig.visionModelName
  ) {
    throw new Error(
      '图片模型未配置。请设置 VITE_FLOOR_ROUTE_MODEL_*，或设置 VITE_FLOOR_ROUTE_VISION_MODEL_BASE_URL、VITE_FLOOR_ROUTE_VISION_MODEL_API_KEY 和 VITE_FLOOR_ROUTE_VISION_MODEL_NAME。',
    );
  }

  const response = await fetch(`${backendConfig.visionModelBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendConfig.visionModelApiKey}`,
    },
    body: JSON.stringify({
      model: backendConfig.visionModelName,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: [
            '你是方寸识途的平面图分析器。',
            '你只判断图片是否像室内平面图、导览图、疏散图或楼层地图。',
            '不要生成路线，不要识别用户目的地，不要编造地图细节。',
            '如果图片可用于导航，提示用户描述目的地。',
            '只能输出 JSON，不要输出 Markdown。',
            'JSON 格式为 {"message":"..."}。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请分析这张图片是否可以作为室内导航平面图使用，并给出一句给用户看的下一步提示。',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`图片模型请求失败：${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('图片模型没有返回分析结果。');
  }

  return {
    message: parseAnalysisDecision(content).message || '已识别平面图。请描述你想去的位置。',
  };
}

export async function searchDestinationCandidatesWithVisionModel({
  imageDataUrl,
  query,
  limit = 5,
}: SearchDestinationCandidatesRequest): Promise<SearchDestinationCandidatesResult> {
  if (
    !backendConfig.visionModelBaseUrl ||
    !backendConfig.visionModelApiKey ||
    !backendConfig.visionModelName
  ) {
    throw new Error(
      '图片模型未配置。请设置 VITE_FLOOR_ROUTE_MODEL_*，或设置 VITE_FLOOR_ROUTE_VISION_MODEL_BASE_URL、VITE_FLOOR_ROUTE_VISION_MODEL_API_KEY 和 VITE_FLOOR_ROUTE_VISION_MODEL_NAME。',
    );
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      candidates: [],
      message: '请输入你想去的位置。',
    };
  }

  const response = await fetch(`${backendConfig.visionModelBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendConfig.visionModelApiKey}`,
    },
    body: JSON.stringify({
      model: backendConfig.visionModelName,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: [
            '你是方寸识途的室内平面图目的地搜索器。',
            '用户会给你一张平面图图片和一个目的地搜索词。',
            '请只根据图片中可见的文字、房间、设施、图例或区域标识，返回与搜索词最匹配的候选目的地。',
            '不要编造图片里看不到的地点。没有匹配项时返回空 candidates。',
            'confidence 是 0 到 1 的匹配置信度。',
            `最多返回 ${limit} 个候选。`,
            '只能输出 JSON，不要输出 Markdown。',
            'JSON 格式为 {"message":"...","candidates":[{"id":"...","title":"...","subtitle":"...","confidence":0.9}]}。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `搜索词：${normalizedQuery}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`目的地搜索模型请求失败：${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('图片模型没有返回目的地候选。');
  }

  const decision = parseDestinationSearchDecision(content);
  const candidates = (decision.candidates ?? [])
    .filter((candidate) => candidate.title?.trim())
    .slice(0, limit)
    .map((candidate, index) => ({
      id: candidate.id?.trim() || `vision-${index}`,
      title: candidate.title?.trim() ?? '',
      subtitle: candidate.subtitle?.trim() || undefined,
      confidence: clampConfidence(candidate.confidence ?? 0),
    }));

  return {
    candidates,
    message: decision.message || (candidates.length ? '请选择最匹配的目的地。' : '没有找到匹配目的地，请换个关键词。'),
  };
}

function parseAnalysisDecision(content: string): FloorPlanAnalysisDecision {
  return JSON.parse(extractJsonObject(content)) as FloorPlanAnalysisDecision;
}

function parseDestinationSearchDecision(content: string): DestinationSearchDecision {
  return JSON.parse(extractJsonObject(content)) as DestinationSearchDecision;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  return trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1);
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.min(1, Math.max(0, value));
}
