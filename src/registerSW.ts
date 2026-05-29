import { Capacitor } from '@capacitor/core';

/**
 * 注册 Service Worker（仅 Web 平台）。
 * Capacitor 原生 WebView 不支持 SW，跳过注册避免缓存问题。
 */
export function registerServiceWorker() {
  if (Capacitor.isNativePlatform()) {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              // 新版本已激活，静默刷新
              window.location.reload();
            }
          });
        });
      })
      .catch((error) => {
        console.warn('SW registration failed:', error);
      });
  });
}
