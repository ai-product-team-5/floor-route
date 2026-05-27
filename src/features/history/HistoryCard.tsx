import { Send } from 'lucide-react';
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

const fallbackThumbnail =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 112"><rect width="160" height="112" fill="%238b8b8b"/><path d="M18 78h124M18 56h124M38 20v74M78 20v74M120 20v74" stroke="%23bdbdbd" stroke-width="5"/><path d="M30 70h32l18-24 22 15 26-30" fill="none" stroke="%23f5f5f5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
      <img
        src={(item.resultImageUrl ?? item.originalImageUrl) || fallbackThumbnail}
        alt="历史路线缩略图"
      />
      <span className="history-card-body">
        <strong>{item.endText}</strong>
        <span>
          {item.startText} · {modeLabels[item.mode]} · {formatCreatedAt(item.createdAt)}
        </span>
      </span>
      <span className="history-card-action" aria-hidden="true">
        <Send size={30} strokeWidth={2.5} />
      </span>
    </button>
  );
}
