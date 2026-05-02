import type { RouteHistoryItem } from '../../core/types';

type HistoryCardProps = {
  item: RouteHistoryItem;
  onOpen: () => void;
};

const modeLabels: Record<RouteHistoryItem['mode'], string> = {
  'ai-image': 'AI 生成',
  manual: '手动',
  astar: 'A*',
};

function formatCreatedAt(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function HistoryCard({ item, onOpen }: HistoryCardProps) {
  return (
    <button type="button" className="history-card" onClick={onOpen}>
      <img src={item.resultImageUrl ?? item.originalImageUrl} alt="历史路线缩略图" />
      <span className="history-card-body">
        <strong>
          {item.startText} 到 {item.endText}
        </strong>
        <span>
          {modeLabels[item.mode]} · {formatCreatedAt(item.createdAt)}
        </span>
      </span>
    </button>
  );
}
