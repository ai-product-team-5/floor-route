export type RouteMode = 'ai-image' | 'manual' | 'astar';

export type NormalizedPoint = {
  x: number;
  y: number;
};

export type RouteHistoryItem = {
  id: string;
  createdAt: number;
  startText: string;
  endText: string;
  originalImageUrl: string;
  resultImageUrl?: string;
  mode: RouteMode;
  /** 墙体二值掩码 data URL（A* 模式下保存，用于历史里"换个目的地"复用） */
  wallMaskDataUrl?: string;
  /** 起点归一化坐标 (0~1) */
  startPoint?: NormalizedPoint;
  /** 终点归一化坐标 (0~1) */
  endPoint?: NormalizedPoint;
  /** A* 规划出的路径关键点（归一化坐标，按顺序连成线） */
  pathPoints?: NormalizedPoint[];
};
