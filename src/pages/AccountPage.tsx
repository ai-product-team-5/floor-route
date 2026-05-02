import { Database, WifiOff } from 'lucide-react';
import { useState } from 'react';

function getDeviceId() {
  const key = 'floor-route-device-id';
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const next = `device-${crypto.randomUUID?.() ?? Date.now()}`;
  window.localStorage.setItem(key, next);
  return next;
}

export function AccountPage() {
  const [deviceId] = useState(getDeviceId);

  return (
    <div className="page-stack">
      <section className="panel account-hero">
        <div className="avatar" aria-hidden="true">
          方
        </div>
        <div>
          <p className="section-kicker">FloorRoute</p>
          <h2>游客用户</h2>
          <p className="muted">本机设备 ID：{deviceId.slice(0, 18)}</p>
        </div>
      </section>

      <section className="panel metric-panel">
        <div className="metric-row">
          <Database aria-hidden="true" size={20} />
          <span>今日 AI 调用</span>
          <strong>0 / 5</strong>
        </div>
        <div className="metric-row">
          <WifiOff aria-hidden="true" size={20} />
          <span>后端状态</span>
          <strong>未连接</strong>
        </div>
      </section>

      <section className="about-block">
        <h2>关于 方寸识途</h2>
        <p>
          FloorRoute 是一个 mobile-first 的室内平面图路径标注 App。第一阶段先完成本地流程闭环，
          后续再接 AI API 和手动路径标注。
        </p>
        <span>FloorRoute 0.1.0</span>
      </section>
    </div>
  );
}
