import { App as CapacitorApp } from '@capacitor/app';
import { Heart, Home, UserRound } from 'lucide-react';
import { LazyMotion, domAnimation, m } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { RouteHistoryItem } from '../core/types';
import {
  NavigationSession,
  type NavigationSessionHandle,
} from '../features/navigation-session/NavigationSession';

const pageTitles: Record<string, string> = {
  '/home': '首页',
  '/history': '历史',
  '/account': '我的',
};

export type AppShellContext = {
  openCapture: () => void;
  openHistoryRoute: (item: RouteHistoryItem) => void;
};

type NavigationSessionState = {
  id: string;
  initialRoute?: RouteHistoryItem;
};

const tabItems = [
  {
    path: '/home',
    label: '首页',
    Icon: Home,
    className: 'tab-link-left',
  },
  {
    path: '/history',
    label: '历史',
    Icon: Heart,
    className: 'tab-link-center',
  },
  {
    path: '/account',
    label: '我的',
    Icon: UserRound,
    className: 'tab-link-right',
  },
];

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
  const tabBarRef = useRef<HTMLElement>(null);
  const sessionHistoryIdRef = useRef<string | null>(null);
  const navigationSessionRef = useRef<NavigationSessionState | null>(null);
  const navigationSessionHandleRef = useRef<NavigationSessionHandle | null>(null);
  const pathnameRef = useRef(pathname);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [navigationSession, setNavigationSession] =
    useState<NavigationSessionState | null>(null);
  const title = pageTitles[pathname] ?? '方寸识途';
  const isImmersivePage = pathname === '/home' || pathname === '/history' || pathname === '/account';
  const activeTabIndex = Math.max(tabItems.findIndex((item) => item.path === pathname), 0);
  const tabBarPaddingX = 26;
  const activeBubbleSize = 72;
  const activeBubbleX = tabBarWidth
    ? tabBarPaddingX
      + ((tabBarWidth - tabBarPaddingX * 2) / tabItems.length) * (activeTabIndex + 0.5)
      - activeBubbleSize / 2
    : 0;

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
      const activeSessionId = sessionHistoryIdRef.current;
      if (!activeSessionId) {
        return;
      }

      if (navigationSessionHandleRef.current?.handleBack()) {
        pushSessionHistoryEntry(activeSessionId);
        sessionHistoryIdRef.current = activeSessionId;
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
    if (!tabBarRef.current) {
      return undefined;
    }
    const tabBarElement = tabBarRef.current;

    function updateTabBarWidth() {
      setTabBarWidth(tabBarElement.clientWidth);
    }

    updateTabBarWidth();
    const observer = new ResizeObserver(updateTabBarWidth);
    observer.observe(tabBarElement);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let removeBackButtonListener: (() => void) | undefined;

    void CapacitorApp.addListener('backButton', () => {
      if (navigationSessionRef.current) {
        if (navigationSessionHandleRef.current?.handleBack()) {
          return;
        }

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
    <div
      className={[
        'app-shell',
        isImmersivePage ? 'app-shell-immersive' : '',
        pathname === '/home' ? 'app-shell-home' : '',
        pathname === '/history' ? 'app-shell-history' : '',
        pathname === '/account' ? 'app-shell-account' : '',
      ].filter(Boolean).join(' ')}
    >
      {!isImmersivePage && (
        <header className="app-header">
          <div>
            <span className="app-eyebrow">FloorRoute</span>
            <h1>{title}</h1>
          </div>
        </header>
      )}

      <main className="app-content">
        <Outlet context={{ openCapture, openHistoryRoute } satisfies AppShellContext} />
      </main>

      <nav ref={tabBarRef} className="tab-bar" aria-label="主导航">
        <LazyMotion features={domAnimation}>
          {tabBarWidth > 0 && (
            <m.span
              className="tab-active-bubble"
              animate={{ x: activeBubbleX, scale: 1 }}
              initial={false}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          {tabItems.map(({ path, label, Icon, className }) => {
            const isActive = pathname === path;

            return (
              <Link
                key={path}
                to={path}
                className={`tab-link ${className}${isActive ? ' active' : ''}`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <m.span
                  className="tab-icon-motion"
                  animate={{
                    y: isActive ? -17 : 0,
                    scale: isActive ? 1.06 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                >
                  <Icon aria-hidden="true" size={29} strokeWidth={2.4} />
                </m.span>
                <m.span
                  className="tab-label"
                  animate={{
                    opacity: isActive ? 0 : 1,
                    y: isActive ? 8 : 0,
                  }}
                  transition={{ duration: 0.16 }}
                >
                  {label}
                </m.span>
              </Link>
            );
          })}
        </LazyMotion>
      </nav>

      {navigationSession && (
        <NavigationSession
          ref={navigationSessionHandleRef}
          key={navigationSession.id}
          initialRoute={navigationSession.initialRoute}
          onClose={closeNavigationSession}
        />
      )}
    </div>
  );
}
