import { App as CapacitorApp } from '@capacitor/app';
import { Camera, Home, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { RouteHistoryItem } from '../core/types';
import { NavigationSession } from '../features/navigation-session/NavigationSession';

const pageTitles: Record<string, string> = {
  '/home': '首页',
  '/account': '我的',
};

export type AppShellContext = {
  openHistoryRoute: (item: RouteHistoryItem) => void;
};

type NavigationSessionState = {
  id: string;
  initialRoute?: RouteHistoryItem;
};

function createSessionId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pushSessionHistoryEntry(id: string) {
  const currentState = typeof window.history.state === 'object' && window.history.state !== null
    ? window.history.state
    : {};

  window.history.pushState(
    { ...currentState, floorRouteNavigationSession: id },
    '',
    window.location.href,
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const sessionHistoryIdRef = useRef<string | null>(null);
  const navigationSessionRef = useRef<NavigationSessionState | null>(null);
  const pathnameRef = useRef(pathname);
  const [navigationSession, setNavigationSession] =
    useState<NavigationSessionState | null>(null);
  const title = pageTitles[pathname] ?? '方寸识途';

  const closeNavigationSession = useCallback(() => {
    if (sessionHistoryIdRef.current) {
      sessionHistoryIdRef.current = null;
      setNavigationSession(null);
      window.history.back();
      return;
    }

    setNavigationSession(null);
  }, []);

  useEffect(() => {
    function handlePopState() {
      if (!sessionHistoryIdRef.current) {
        return;
      }

      sessionHistoryIdRef.current = null;
      setNavigationSession(null);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    navigationSessionRef.current = navigationSession;
  }, [navigationSession]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let removeBackButtonListener: (() => void) | undefined;

    void CapacitorApp.addListener('backButton', () => {
      if (navigationSessionRef.current) {
        closeNavigationSession();
        return;
      }

      if (pathnameRef.current !== '/home') {
        navigate('/home');
        return;
      }

      void CapacitorApp.exitApp();
    }).then((listener) => {
      removeBackButtonListener = () => {
        void listener.remove();
      };
    });

    return () => removeBackButtonListener?.();
  }, [closeNavigationSession, navigate]);

  function openNavigationSession(nextSession: NavigationSessionState) {
    sessionHistoryIdRef.current = nextSession.id;
    pushSessionHistoryEntry(nextSession.id);
    setNavigationSession(nextSession);
  }

  function openCapture() {
    openNavigationSession({ id: createSessionId() });
  }

  function openHistoryRoute(item: RouteHistoryItem) {
    openNavigationSession({ id: createSessionId(), initialRoute: item });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="app-eyebrow">FloorRoute</span>
          <h1>{title}</h1>
        </div>
      </header>

      <main className="app-content">
        <Outlet context={{ openHistoryRoute } satisfies AppShellContext} />
      </main>

      <nav className="tab-bar" aria-label="主导航">
        <NavLink to="/home" className="tab-link tab-link-left">
          <Home aria-hidden="true" size={21} strokeWidth={2.2} />
          <span>首页</span>
        </NavLink>

        <button
          type="button"
          className="tab-capture-action"
          onClick={openCapture}
          aria-label="开始导航拍摄"
        >
          <span className="tab-capture-icon">
            <Camera aria-hidden="true" size={31} />
          </span>
        </button>

        <NavLink to="/account" className="tab-link tab-link-right">
          <UserRound aria-hidden="true" size={21} strokeWidth={2.2} />
          <span>我的</span>
        </NavLink>
      </nav>

      {navigationSession && (
        <NavigationSession
          key={navigationSession.id}
          initialRoute={navigationSession.initialRoute}
          onClose={closeNavigationSession}
        />
      )}
    </div>
  );
}
