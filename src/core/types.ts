export type RouteMode = 'ai-image' | 'manual' | 'astar';

export type RouteHistoryItem = {
  id: string;
  createdAt: number;
  startText: string;
  endText: string;
  originalImageUrl: string;
  resultImageUrl?: string;
  mode: RouteMode;
};
