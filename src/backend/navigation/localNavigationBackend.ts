import { createDemoPath } from '../../core/path';
import { backendConfig } from '../backendConfig';
import { detectFloorPlanCornersInImage } from '../floor-plan/floorPlanCornerDetection';
import { correctPerspective } from '../floor-plan/perspectiveTransform';
import { resolveNavigationIntentWithTextModel } from '../text-model/navigationIntentTextModel';
import {
  analyzeFloorPlanWithVisionModel,
  searchDestinationCandidatesWithVisionModel,
} from '../vision-model/floorPlanAnalysisVisionModel';
import type {
  DestinationCandidate,
  FloorPlanCorner,
  NavigationBackend,
  ResolveNavigationIntentRequest,
  ResolveNavigationIntentResult,
  SearchDestinationCandidatesRequest,
  SearchDestinationCandidatesResult,
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

const mockDestinationCatalog = [
  {
    title: '卫生间',
    subtitle: '公共区域东侧，靠近电梯厅',
    keywords: ['卫生间', '厕所', '洗手间', 'wc'],
  },
  {
    title: '安全出口',
    subtitle: '楼层边缘的疏散通道',
    keywords: ['出口', '安全出口', '疏散', 'escape'],
  },
  {
    title: '电梯厅',
    subtitle: '主通道交汇处',
    keywords: ['电梯', '升降梯', '梯厅'],
  },
  {
    title: '服务台',
    subtitle: '入口附近的咨询点',
    keywords: ['服务台', '前台', '咨询', '问询'],
  },
  {
    title: '楼梯间',
    subtitle: '靠近安全出口的垂直通道',
    keywords: ['楼梯', '楼梯间', '扶梯'],
  },
  {
    title: '停车场入口',
    subtitle: '连接室内区域和停车区',
    keywords: ['停车', '停车场', '车库'],
  },
];

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

  async analyzeFloorPlan(request) {
    if (backendConfig.floorPlanAnalysisMode === 'vision-model') {
      return analyzeFloorPlanWithVisionModel(request);
    }

    void request.imageDataUrl;
    await delay(850);

    return {
      message: '已识别平面图。请描述你想去的位置。',
    };
  },

  async searchDestinationCandidates(request) {
    if (backendConfig.destinationSearchMode === 'vision-model') {
      return searchDestinationCandidatesWithVisionModel(request);
    }

    await delay(750);
    return searchDestinationCandidatesLocally(request);
  },

  async resolveNavigationIntent(request) {
    if (backendConfig.intentRecognitionMode === 'text-model') {
      return resolveNavigationIntentWithTextModel(request);
    }

    await delay(950);
    return resolveIntentLocally(request);
  },
};

function searchDestinationCandidatesLocally({
  query,
  limit = 5,
}: SearchDestinationCandidatesRequest): SearchDestinationCandidatesResult {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return {
      candidates: [],
      message: '请输入你想去的位置。',
    };
  }

  if (unsupportedIntentPattern.test(normalizedQuery)) {
    return {
      candidates: [],
      message: '搜索只支持平面图里的目的地，请输入房间、设施或店铺名称。',
    };
  }

  const scoredCandidates = mockDestinationCatalog
    .map((item, index) => ({
      item,
      index,
      score: scoreDestinationCandidate(normalizedQuery, item.title, item.keywords),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map<DestinationCandidate>(({ item, score, index }) => ({
      id: `mock-${index}`,
      title: item.title,
      subtitle: item.subtitle,
      confidence: Math.min(0.96, score),
    }));

  const candidates = scoredCandidates.length
    ? scoredCandidates
    : [
        {
          id: `query-${hashText(normalizedQuery)}`,
          title: normalizedQuery,
          subtitle: '识图候选：请确认图中是否存在这个目的地',
          confidence: 0.56,
        },
      ];

  return {
    candidates,
    message: '已找到可能匹配的目的地，请选择最准确的一项。',
  };
}

function scoreDestinationCandidate(query: string, title: string, keywords: string[]) {
  const normalizedQuery = query.toLowerCase();
  const normalizedTitle = title.toLowerCase();

  if (normalizedQuery === normalizedTitle) return 0.96;
  if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
    return 0.88;
  }

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (
      normalizedKeyword === normalizedQuery ||
      normalizedKeyword.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedKeyword)
    ) {
      return 0.82;
    }
  }

  return 0;
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

function resolveIntentLocally({
  imageDataUrl,
  prompt,
  previousPrompt,
  destinationCandidate,
}: ResolveNavigationIntentRequest): ResolveNavigationIntentResult {
  if (destinationCandidate) {
    return {
      type: 'route-found',
      destinationText: destinationCandidate.title,
      resultImageUrl: imageDataUrl,
      path: createDemoPath(),
      message: '已根据候选目的地生成路径。',
    };
  }

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
