import { Camera } from 'lucide-react';
import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppShellContext } from '../app/AppShell';
import homeMapBackground from '../assets/home-map-background.png';
import { useHistoryStore } from '../store/historyStore';

export function HomePage() {
  const { openCapture } = useOutletContext<AppShellContext>();
  const isHydrated = useHistoryStore((state) => state.isHydrated);
  const loadHistory = useHistoryStore((state) => state.loadHistory);

  useEffect(() => {
    if (!isHydrated) {
      void loadHistory();
    }
  }, [isHydrated, loadHistory]);

  return (
    <div className="home-page">
      <section
        className="home-map-hero"
        style={{ backgroundImage: `url(${homeMapBackground})` }}
        aria-label="地图导航首页"
      >
        <div className="home-hero-copy">
          <h1>
            你好，
            <br />
            想<span>去哪</span>？
          </h1>
          <p>今天你迷路了吗今天你迷路了吗今天你迷路了吗</p>
        </div>

        <button
          type="button"
          className="home-capture-button"
          onClick={openCapture}
          aria-label="拍摄平面图开始导航"
        >
          <Camera aria-hidden="true" size={58} strokeWidth={2.4} />
        </button>
      </section>
    </div>
  );
}
