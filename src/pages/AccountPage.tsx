import { Check, Database, KeyRound, Trash2, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { backendConfig } from '../backend/backendConfig';
import {
  clearFloorRouteApiKey,
  getFloorRouteApiKey,
  setFloorRouteApiKey,
} from '../backend/auth/floorRouteApiKey';

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
  const [apiKeyInput, setApiKeyInput] = useState(getFloorRouteApiKey);
  const [hasApiKey, setHasApiKey] = useState(() => Boolean(getFloorRouteApiKey()));
  const [saveMessage, setSaveMessage] = useState('');

  function saveApiKey() {
    setFloorRouteApiKey(apiKeyInput);
    setHasApiKey(Boolean(apiKeyInput.trim()));
    setSaveMessage(apiKeyInput.trim() ? '已保存 API key。' : '已清除 API key。');
  }

  function clearApiKey() {
    clearFloorRouteApiKey();
    setApiKeyInput('');
    setHasApiKey(false);
    setSaveMessage('已清除 API key。');
  }

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

      <section className="panel api-key-panel">
        <div className="api-key-header">
          <div>
            <p className="section-kicker">API Key</p>
            <h2>远程服务额度</h2>
          </div>
          <span className={hasApiKey ? 'api-key-state saved' : 'api-key-state'}>
            {hasApiKey ? '已设置' : '未设置'}
          </span>
        </div>
        <label className="field-label">
          FloorRoute API key
          <input
            type="password"
            value={apiKeyInput}
            placeholder="fr_live_xxx"
            autoComplete="off"
            onChange={(event) => {
              setApiKeyInput(event.target.value);
              setSaveMessage('');
            }}
          />
        </label>
        <div className="api-key-actions">
          <button type="button" className="primary-button" onClick={saveApiKey}>
            <Check aria-hidden="true" size={18} />
            保存
          </button>
          <button type="button" className="secondary-button" onClick={clearApiKey}>
            <Trash2 aria-hidden="true" size={18} />
            清除
          </button>
        </div>
        {saveMessage && <p className="inline-status">{saveMessage}</p>}
      </section>

      <section className="panel metric-panel">
        <div className="metric-row">
          <Database aria-hidden="true" size={20} />
          <span>服务模式</span>
          <strong>{backendConfig.mode === 'remote' ? '远程' : '本地'}</strong>
        </div>
        <div className="metric-row">
          <WifiOff aria-hidden="true" size={20} />
          <span>后端状态</span>
          <strong>{backendConfig.mode === 'remote' && hasApiKey ? '已配置' : '未连接'}</strong>
        </div>
        <div className="metric-row">
          <KeyRound aria-hidden="true" size={20} />
          <span>额度凭证</span>
          <strong>{hasApiKey ? '本机保存' : '未保存'}</strong>
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
