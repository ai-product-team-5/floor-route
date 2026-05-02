import localforage from 'localforage';
import { create } from 'zustand';
import type { RouteHistoryItem } from '../core/types';

const HISTORY_KEY = 'floor-route-history';
let pendingHistoryLoad: Promise<RouteHistoryItem[]> | null = null;

localforage.config({
  name: 'FloorRoute',
  storeName: 'route_history',
});

type HistoryState = {
  items: RouteHistoryItem[];
  isHydrated: boolean;
  loadHistory: () => Promise<void>;
  addItem: (item: RouteHistoryItem) => Promise<void>;
};

async function persistHistory(items: RouteHistoryItem[]) {
  await localforage.setItem(HISTORY_KEY, items);
}

async function readPersistedHistory() {
  if (!pendingHistoryLoad) {
    pendingHistoryLoad = localforage
      .getItem<RouteHistoryItem[]>(HISTORY_KEY)
      .then((stored) => (Array.isArray(stored) ? stored : []))
      .finally(() => {
        pendingHistoryLoad = null;
      });
  }

  return pendingHistoryLoad;
}

export const useHistoryStore = create<HistoryState>((set, get) => {
  async function ensureHydrated() {
    if (get().isHydrated) {
      return get().items;
    }

    const items = await readPersistedHistory();
    if (!get().isHydrated) {
      set({ items, isHydrated: true });
      return items;
    }

    return get().items;
  }

  return {
    items: [],
    isHydrated: false,
    loadHistory: async () => {
      await ensureHydrated();
    },
    addItem: async (item) => {
      const currentItems = await ensureHydrated();
      const items = [item, ...currentItems].slice(0, 50);
      set({ items, isHydrated: true });
      await persistHistory(items);
    },
  };
});
