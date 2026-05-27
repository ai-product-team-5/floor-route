import { createDemoPath } from '../../core/path';
import { backendConfig } from '../backendConfig';
import type {
  ResolveNavigationIntentRequest,
  ResolveNavigationIntentResult,
} from '../navigation/navigationBackendTypes';

type TextModelIntentDecision =
  | {
      type: 'route-found';
      destinationText: string;
      message?: string;
    }
  | {
      type: 'need-more-info';
      destinationText?: string;
      message?: string;
    }
  | {
      type: 'unsupported-intent';
      message?: string;
    };

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function resolveNavigationIntentWithTextModel(
  request: ResolveNavigationIntentRequest,
): Promise<ResolveNavigationIntentResult> {
  if (request.destinationCandidate) {
    return {
      type: 'route-found',
      destinationText: request.destinationCandidate.title,
      resultImageUrl: request.imageDataUrl,
      path: createDemoPath(),
      message: '已根据候选目的地生成路径。',
    };
  }

  if (
    !backendConfig.textModelBaseUrl ||
    !backendConfig.textModelApiKey ||
    !backendConfig.textModelName
  ) {
    throw new Error(
      '文本模型未配置。请设置 VITE_FLOOR_ROUTE_MODEL_*，或设置 VITE_FLOOR_ROUTE_TEXT_MODEL_BASE_URL、VITE_FLOOR_ROUTE_TEXT_MODEL_API_KEY 和 VITE_FLOOR_ROUTE_TEXT_MODEL_NAME。',
    );
  }

  const decision = await requestTextModelIntentDecision(request);
  return decisionToNavigationResult(decision, request);
}

async function requestTextModelIntentDecision(
  request: ResolveNavigationIntentRequest,
): Promise<TextModelIntentDecision> {
  const response = await fetch(`${backendConfig.textModelBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendConfig.textModelApiKey}`,
    },
    body: JSON.stringify({
      model: backendConfig.textModelName,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: [
            '你是方寸识途的室内导航意图识别器。',
            '你只判断用户输入是不是基于已上传平面图的导航请求，并提取目的地。',
            '不要生成路线，不要编造地图信息，不要回答闲聊。',
            '如果用户要求生图、修图、换风格、生成海报、画图，返回 unsupported-intent。',
            '如果用户没有给出明确目的地，返回 need-more-info。',
            '如果用户给出了可导航目的地，返回 route-found。',
            '只能输出 JSON，不要输出 Markdown。',
            'JSON 格式为 {"type":"route-found|need-more-info|unsupported-intent","destinationText":"...","message":"..."}。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            currentPrompt: request.prompt,
            previousDestination: request.previousPrompt ?? '',
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`文本模型请求失败：${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('文本模型没有返回识别结果。');
  }

  return parseIntentDecision(content);
}

function parseIntentDecision(content: string): TextModelIntentDecision {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1);
  const parsed = JSON.parse(jsonText) as Partial<TextModelIntentDecision>;

  if (
    parsed.type !== 'route-found' &&
    parsed.type !== 'need-more-info' &&
    parsed.type !== 'unsupported-intent'
  ) {
    throw new Error('文本模型返回了无法识别的意图类型。');
  }

  return parsed as TextModelIntentDecision;
}

function decisionToNavigationResult(
  decision: TextModelIntentDecision,
  request: ResolveNavigationIntentRequest,
): ResolveNavigationIntentResult {
  switch (decision.type) {
    case 'route-found': {
      const destinationText = mergeDestinationText(
        request.previousPrompt,
        decision.destinationText || request.prompt,
      );

      return {
        type: 'route-found',
        destinationText,
        resultImageUrl: request.imageDataUrl,
        path: createDemoPath(),
        message: decision.message || '已识别目的地，正在生成路径。',
      };
    }
    case 'need-more-info':
      return {
        type: 'need-more-info',
        destinationText: mergeDestinationText(
          request.previousPrompt,
          decision.destinationText ?? '',
        ),
        message: decision.message || '请补充楼层、门店名或附近标识。',
      };
    case 'unsupported-intent':
      return {
        type: 'unsupported-intent',
        message: decision.message || '我只能处理基于平面图的导航请求。请告诉我你想去哪里。',
      };
  }
}

function mergeDestinationText(previousPrompt: string | undefined, nextText: string) {
  return `${previousPrompt ?? ''} ${nextText}`.trim();
}
