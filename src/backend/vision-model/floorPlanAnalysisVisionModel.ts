import { backendConfig } from '../backendConfig';
import type {
  AnalyzeFloorPlanRequest,
  AnalyzeFloorPlanResult,
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

function parseAnalysisDecision(content: string): FloorPlanAnalysisDecision {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1);

  return JSON.parse(jsonText) as FloorPlanAnalysisDecision;
}
