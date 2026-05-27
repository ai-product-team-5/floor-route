import { Check, ChevronRight, Clock3, HelpCircle, ImagePlus, KeyRound, Package, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getFloorRouteApiKey,
  setFloorRouteApiKey,
} from '../backend/auth/floorRouteApiKey';
import { backendConfig } from '../backend/backendConfig';
import { createBackendAuthHeaders } from '../backend/auth/authHeaders';
import {
  captureErrorMessage,
  chooseFromGallery,
  isCaptureCancelled,
} from '../features/navigation-session/capture/captureImage';

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

function getProfileName() {
  return window.localStorage.getItem('floor-route-profile-name') || '游客用户';
}

function getProfileAvatar() {
  return window.localStorage.getItem('floor-route-profile-avatar') || '';
}

export function AccountPage() {
  const navigate = useNavigate();
  const [deviceId] = useState(getDeviceId);
  const [profileName, setProfileName] = useState(getProfileName);
  const [avatarUrl, setAvatarUrl] = useState(getProfileAvatar);
  const [draftName, setDraftName] = useState(profileName);
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(avatarUrl);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getFloorRouteApiKey);
  const [hasApiKey, setHasApiKey] = useState(() => Boolean(getFloorRouteApiKey()));
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [updateToast, setUpdateToast] = useState('');

  function saveApiKey() {
    setFloorRouteApiKey(apiKeyInput);
    setHasApiKey(Boolean(apiKeyInput.trim()));
    setIsApiKeySaved(true);
  }

  useEffect(() => {
    if (!hasApiKey || !backendConfig.apiBaseUrl) {
      setCreditBalance(null);
      return;
    }

    let isCurrent = true;

    async function fetchCredits() {
      try {
        const response = await fetch(`${backendConfig.apiBaseUrl}/api/credits`, {
          headers: createBackendAuthHeaders(),
        });

        if (!response.ok || !isCurrent) return;

        const data = (await response.json()) as { balance?: number };
        if (isCurrent && typeof data.balance === 'number') {
          setCreditBalance(data.balance);
        }
      } catch {
        // Silently fail — quota display is non-critical
      }
    }

    void fetchCredits();

    return () => { isCurrent = false; };
  }, [hasApiKey, isApiKeySaved]);

  function handleUpdate() {
    setUpdateToast('已是最新版本 (v0.1.0)');
    setTimeout(() => setUpdateToast(''), 2500);
  }

  function openProfileEditor() {
    setDraftName(profileName);
    setDraftAvatarUrl(avatarUrl);
    setAvatarError('');
    setIsEditingProfile(true);
  }

  async function pickAvatarFromGallery() {
    if (isPickingAvatar) {
      return;
    }

    setIsPickingAvatar(true);
    setAvatarError('');

    try {
      const dataUrl = await chooseFromGallery();
      setDraftAvatarUrl(dataUrl);
    } catch (error) {
      if (!isCaptureCancelled(error)) {
        setAvatarError(captureErrorMessage(error));
      }
    } finally {
      setIsPickingAvatar(false);
    }
  }

  function saveProfile() {
    const nextName = draftName.trim() || '游客用户';
    const nextAvatarUrl = draftAvatarUrl.trim();
    window.localStorage.setItem('floor-route-profile-name', nextName);

    if (nextAvatarUrl) {
      window.localStorage.setItem('floor-route-profile-avatar', nextAvatarUrl);
    } else {
      window.localStorage.removeItem('floor-route-profile-avatar');
    }

    setProfileName(nextName);
    setAvatarUrl(nextAvatarUrl);
    setIsEditingProfile(false);
  }

  if (isEditingProfile) {
    return (
      <div className="account-page profile-editor-page">
        <header className="profile-editor-header">
          <button type="button" onClick={() => setIsEditingProfile(false)}>
            取消
          </button>
          <h1>编辑资料</h1>
          <button type="button" onClick={saveProfile}>
            保存
          </button>
        </header>

        <section className="profile-editor-card">
          <button
            type="button"
            className="profile-editor-avatar-button"
            onClick={pickAvatarFromGallery}
            disabled={isPickingAvatar}
            aria-label="从图库中选择头像"
          >
            <span
              className="profile-editor-avatar"
              style={draftAvatarUrl ? { backgroundImage: `url(${draftAvatarUrl})` } : undefined}
              aria-hidden="true"
            />
            <span className="profile-editor-avatar-overlay" aria-hidden="true">
              <ImagePlus size={22} strokeWidth={2.4} />
            </span>
          </button>
          <p className="profile-editor-avatar-hint">
            {isPickingAvatar ? '正在打开图库…' : '点击头像从图库中选择'}
          </p>
          {avatarError ? (
            <p className="profile-editor-avatar-error" role="alert">
              {avatarError}
            </p>
          ) : null}
          <label className="profile-editor-field">
            昵称
            <input
              value={draftName}
              placeholder="游客用户"
              onChange={(event) => setDraftName(event.target.value)}
            />
          </label>
        </section>
      </div>
    );
  }

  return (
    <div className="account-page">
      <button type="button" className="account-profile" onClick={openProfileEditor}>
        <div
          className="account-avatar"
          style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
          aria-hidden="true"
        />
        <div className="account-profile-main">
          <h2>{profileName}</h2>
          <p>ID:{deviceId.slice(0, 10)}</p>
        </div>
        <ChevronRight aria-hidden="true" size={32} strokeWidth={2.4} />
      </button>

      <section className="account-api-card">
        <label className="account-key-field">
          <KeyRound aria-hidden="true" size={17} />
          <input
            type="password"
            value={apiKeyInput}
            placeholder="输入 API key"
            autoComplete="off"
            onChange={(event) => {
              setApiKeyInput(event.target.value);
              setIsApiKeySaved(false);
            }}
          />
          <button
            type="button"
            onClick={saveApiKey}
            disabled={isApiKeySaved}
            aria-label={isApiKeySaved ? 'API key 已保存' : '保存 API key'}
          >
            <Check aria-hidden="true" size={21} strokeWidth={2.6} />
          </button>
        </label>

        <div className="account-quota-row">
          <span>剩余算力</span>
          <strong>{creditBalance !== null ? creditBalance : (hasApiKey ? '...' : 0)}</strong>
        </div>
        <div className="account-quota-track" aria-hidden="true">
          <span style={{ width: creditBalance !== null ? `${Math.min(100, creditBalance)}%` : '0%' }} />
        </div>
      </section>

      <section className="account-menu-section">
        <h2>其他</h2>
        <div className="account-menu-card">
          <button type="button">
            <Package aria-hidden="true" size={27} />
            <span>购买 API</span>
            <ChevronRight aria-hidden="true" size={27} />
          </button>
          <button type="button" onClick={() => setShowPurchaseHistory(true)}>
            <Clock3 aria-hidden="true" size={27} />
            <span>购买记录</span>
            <ChevronRight aria-hidden="true" size={27} />
          </button>
          <button type="button" onClick={() => navigate('/help')}>
            <HelpCircle aria-hidden="true" size={27} />
            <span>帮助与反馈</span>
            <ChevronRight aria-hidden="true" size={27} />
          </button>
          <button type="button" onClick={handleUpdate}>
            <Upload aria-hidden="true" size={27} />
            <span>更新</span>
            <ChevronRight aria-hidden="true" size={27} />
          </button>
        </div>
      </section>

      {showPurchaseHistory && (
        <div className="account-overlay" onClick={() => setShowPurchaseHistory(false)}>
          <div className="account-overlay-content" onClick={(e) => e.stopPropagation()}>
            <h3>购买记录</h3>
            <p className="account-empty-state">暂无记录</p>
            <button type="button" className="account-overlay-close" onClick={() => setShowPurchaseHistory(false)}>
              关闭
            </button>
          </div>
        </div>
      )}

      {updateToast && (
        <div className="account-toast" role="status">{updateToast}</div>
      )}
    </div>
  );
}
