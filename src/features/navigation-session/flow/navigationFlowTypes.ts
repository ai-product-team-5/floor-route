import type {
  DestinationCandidate,
  EndpointPoint,
} from '../../../backend/navigation/navigationBackend';
import type { NormalizedPoint, RouteMode } from '../../../core/types';

export type NavigationStage =
  | 'generating-walls'
  | 'showing-walls'
  | 'awaiting-intent'
  | 'searching-destinations'
  | 'destination-candidates'
  | 'locating-endpoints'
  | 'planning-path'
  | 'show-result';

export type NavigationFlowState = {
  stage: NavigationStage;
  /** 校正后的原始平面图 */
  imageDataUrl?: string;
  /** AI 生成的墙体掩码（整个会话复用） */
  wallMaskDataUrl?: string;
  /** 用户当前输入的搜索词 */
  promptText: string;
  /** 搜索结果候选 */
  destinationCandidates: DestinationCandidate[];
  /** 已选目的地名称（用于结果页和历史） */
  destinationText: string;
  /** 给用户的提示文案 */
  agentMessage: string;
  /** 模式（A* 模式下保存路径点；从历史进入仍可能是 ai-image） */
  mode: RouteMode;
  /** snap 后的起终点（归一化），结果页用 */
  startPoint?: NormalizedPoint;
  endPoint?: NormalizedPoint;
  /** 路径关键点（归一化） */
  pathPoints?: NormalizedPoint[];
  /** 来自历史记录的 ai-image 结果图（不会在新流程产生） */
  resultImageUrl?: string;
};

export type NavigationFlowAction =
  | { type: 'walls-generation-started' }
  | { type: 'walls-generation-finished'; wallMaskDataUrl: string }
  | { type: 'walls-generation-failed'; message: string }
  | { type: 'walls-acknowledged' }
  | { type: 'intent-text-changed'; value: string }
  | { type: 'destination-search-reset'; message?: string }
  | { type: 'destination-search-started' }
  | {
      type: 'destination-search-finished';
      candidates: DestinationCandidate[];
      message: string;
    }
  | { type: 'destination-search-failed'; message: string }
  | { type: 'endpoints-location-started'; destinationText: string }
  | {
      type: 'endpoints-location-finished';
      start: EndpointPoint;
      end: EndpointPoint;
      message: string;
    }
  | { type: 'endpoints-location-failed'; message: string }
  | { type: 'path-planning-started' }
  | {
      type: 'path-planned';
      destinationText: string;
      pathPoints: NormalizedPoint[];
      startPoint: NormalizedPoint;
      endPoint: NormalizedPoint;
    }
  | { type: 'path-planning-failed'; message: string };
