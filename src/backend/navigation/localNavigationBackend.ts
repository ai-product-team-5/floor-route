import { createDemoPath } from '../../core/path';
import { detectFloorPlanCornersInImage } from '../floor-plan/floorPlanCornerDetection';
import { correctPerspective } from '../floor-plan/perspectiveTransform';
import type {
  FloorPlanCorner,
  NavigationBackend,
  ResolveNavigationIntentRequest,
  ResolveNavigationIntentResult,
} from './navigationBackendTypes';

const fallbackCorners: FloorPlanCorner[] = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.08 },
  { x: 0.92, y: 0.92 },
  { x: 0.08, y: 0.92 },
];

const unsupportedIntentPattern =
  /生图|生成图片|画一张|画图|改成|变成|风格|头像|壁纸|海报|赛博朋克|修图|p图/i;

const directRoutePattern =
  /卫生间|厕所|洗手间|出口|电梯|扶梯|楼梯|服务台|前台|收银|停车|入口|会议室|教室|办公室/i;

export const localNavigationBackend: NavigationBackend = {
  async detectFloorPlanCorners({ imageDataUrl }) {
    const detected = await detectFloorPlanCornersInImage(imageDataUrl);

    if (detected) {
      return {
        corners: detected.corners,
        source: 'detected',
        confidence: detected.confidence,
        method: detected.method,
        message: '已自动识别边框，可继续调整四角。',
      };
    }

    return {
      corners: fallbackCorners,
      source: 'fallback',
      message: '请拖动四角校正平面图边框。',
    };
  },

  async correctFloorPlanPerspective({ imageDataUrl, corners }) {
    const correctedImageDataUrl = await correctPerspective(imageDataUrl, corners);

    return { correctedImageDataUrl };
  },

  async analyzeFloorPlan({ imageDataUrl }) {
    void imageDataUrl;
    await delay(850);

    return {
      message: '已识别平面图。请描述你想去的位置。',
    };
  },

  async resolveNavigationIntent(request) {
    await delay(950);
    return resolveIntentLocally(request);
  },
};

function resolveIntentLocally({
  imageDataUrl,
  prompt,
  previousPrompt,
}: ResolveNavigationIntentRequest): ResolveNavigationIntentResult {
  const text = prompt.trim();
  const combinedText = `${previousPrompt ?? ''} ${text}`.trim();

  if (!text) {
    return {
      type: 'need-more-info',
      destinationText: previousPrompt ?? '',
      message: '请描述你想去的位置。',
    };
  }

  if (unsupportedIntentPattern.test(text)) {
    return {
      type: 'unsupported-intent',
      message: '我只能处理基于平面图的导航请求。请告诉我你想去哪里。',
    };
  }

  if (directRoutePattern.test(combinedText) || combinedText.length >= 10) {
    return {
      type: 'route-found',
      destinationText: combinedText,
      resultImageUrl: imageDataUrl,
      path: createDemoPath(),
      message: '已生成路径。',
    };
  }

  return {
    type: 'need-more-info',
    destinationText: combinedText,
    message: '没有找到足够明确的目标，请补充楼层、门店名或附近标识。',
  };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
