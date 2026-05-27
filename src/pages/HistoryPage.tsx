import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppShellContext } from '../app/AppShell';
import { HistoryCard } from '../features/history/HistoryCard';
import { useHistoryStore } from '../store/historyStore';

export function HistoryPage() {
  const { openHistoryRoute } = useOutletContext<AppShellContext>();
  const items = useHistoryStore((state) => state.items);
  const isHydrated = useHistoryStore((state) => state.isHydrated);
  const loadHistory = useHistoryStore((state) => state.loadHistory);

  useEffect(() => {
    if (!isHydrated) {
      void loadHistory();
    }
  }, [isHydrated, loadHistory]);

  return (
    <div className="history-page">
      {items.length ? (
        <section className="history-list" aria-label="历史路线列表">
          {items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              onOpen={() => openHistoryRoute(item)}
            />
          ))}
        </section>
      ) : (
        <section className="history-empty-state">
          <h2>暂无导航记录</h2>
          <p>完成一次导航后，路线会以卡片形式保存在这里。</p>
        </section>
      )}
    </div>
  );
}
