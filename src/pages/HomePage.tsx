import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppShellContext } from '../app/AppShell';
import { HistoryCard } from '../features/history/HistoryCard';
import { useHistoryStore } from '../store/historyStore';

export function HomePage() {
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
    <div className="home-page">
      <section className="home-hero">
        <div className="home-brand-mark">方</div>
        <div>
          <span>FloorRoute</span>
          <h2>方寸识途</h2>
        </div>
      </section>

      <section className="home-history-section">
        <div className="home-section-header">
          <h2>最近记录</h2>
          <span>{items.length ? `${items.length} 条` : '暂无'}</span>
        </div>

        {items.length ? (
          <div className="history-list">
            {items.slice(0, 8).map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onOpen={() => openHistoryRoute(item)}
              />
            ))}
          </div>
        ) : (
          <div className="home-empty-records">
            <h2>暂无导航记录</h2>
            <p>点击底部中间按钮拍摄平面图，完成后会显示在这里。</p>
          </div>
        )}
      </section>
    </div>
  );
}
