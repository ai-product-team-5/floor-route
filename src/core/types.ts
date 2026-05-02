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
  path?: NormalizedPoint[];
  mode: RouteMode;
};
