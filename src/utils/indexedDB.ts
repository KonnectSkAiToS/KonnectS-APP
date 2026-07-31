/**
 * Local-First IndexedDB Persistence Utility (Mocked/Standardised with LocalStorage/In-Memory)
 * Caches marketplace and service listings offline, and queues sync actions safely.
 */

const memoryStore: Record<string, any[]> = {
  marketplace: [],
  services: [],
  syncQueue: [],
  cached_images: [],
  offlineSyncQueue: [],
  criticalUserData: []
};

// Ensure window is defined
const isBrowser = typeof window !== 'undefined';

export function initDB(): Promise<any> {
  return Promise.resolve({
    transaction: () => ({
      objectStore: () => ({
        put: () => ({}),
        get: () => ({}),
        delete: () => ({}),
      })
    })
  });
}

export async function cacheImage(url: string, data: string): Promise<void> {
  try {
    const list = memoryStore.cached_images;
    const existing = list.findIndex((x) => x.url === url);
    const item = { url, data, timestamp: Date.now() };
    if (existing >= 0) {
      list[existing] = item;
    } else {
      list.push(item);
    }
  } catch (err) {
    console.error('Error writing cached image:', err);
  }
}

export async function getCachedImage(url: string): Promise<string | null> {
  try {
    const list = memoryStore.cached_images;
    const found = list.find((x) => x.url === url);
    return found ? found.data : null;
  } catch (err) {
    return null;
  }
}

export async function clearCachedImages(): Promise<void> {
  memoryStore.cached_images = [];
}

export async function getCachedItems(storeName: string): Promise<any[]> {
  try {
    if (isBrowser) {
      const data = localStorage.getItem(`konnects_cache_${storeName}`);
      if (data) {
        return JSON.parse(data);
      }
    }
    return memoryStore[storeName] || [];
  } catch (err) {
    return memoryStore[storeName] || [];
  }
}

export async function setCachedItems(storeName: string, items: any[]): Promise<void> {
  try {
    if (isBrowser) {
      localStorage.setItem(`konnects_cache_${storeName}`, JSON.stringify(items));
    }
    memoryStore[storeName] = items;
  } catch (err) {
    memoryStore[storeName] = items;
  }
}

export async function addToSyncQueue(storeName: string, actionType: 'create' | 'update' | 'delete', payload: any): Promise<void> {
  try {
    const queue = await getCachedItems('syncQueue');
    const id = payload.id || `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const action = { id, store: storeName, type: actionType, payload, timestamp: Date.now() };
    queue.push(action);
    await setCachedItems('syncQueue', queue);
  } catch (err) {
    console.error('Failed to add to sync queue:', err);
  }
}

export async function getSyncQueue(): Promise<any[]> {
  return getCachedItems('syncQueue');
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  try {
    const queue = await getCachedItems('syncQueue');
    const filtered = queue.filter((x: any) => x.id !== id);
    await setCachedItems('syncQueue', filtered);
  } catch (err) {
    console.error('Failed to remove from sync queue:', err);
  }
}

export async function searchOfflineCache(queryText: string): Promise<{ marketplace: any[]; services: any[] }> {
  try {
    const market = await getCachedItems('marketplace');
    const services = await getCachedItems('services');
    const queryLower = queryText.toLowerCase();

    const mFiltered = market.filter((x: any) =>
      (x.title || '').toLowerCase().includes(queryLower) ||
      (x.description || '').toLowerCase().includes(queryLower)
    );

    const sFiltered = services.filter((x: any) =>
      (x.name || '').toLowerCase().includes(queryLower) ||
      (x.role || '').toLowerCase().includes(queryLower)
    );

    return { marketplace: mFiltered, services: sFiltered };
  } catch (err) {
    return { marketplace: [], services: [] };
  }
}

export async function getOfflineSyncQueue(): Promise<any[]> {
  return getCachedItems('offlineSyncQueue');
}

export async function saveOfflineSyncItem(item: any): Promise<void> {
  try {
    const queue = await getCachedItems('offlineSyncQueue');
    const existing = queue.findIndex((x: any) => x.id === item.id);
    if (existing >= 0) {
      queue[existing] = item;
    } else {
      queue.push(item);
    }
    await setCachedItems('offlineSyncQueue', queue);
  } catch (err) {
    console.error('Failed to save offline sync item:', err);
  }
}

export async function removeOfflineSyncItem(id: string): Promise<void> {
  try {
    const queue = await getCachedItems('offlineSyncQueue');
    const filtered = queue.filter((x: any) => x.id !== id);
    await setCachedItems('offlineSyncQueue', filtered);
  } catch (err) {
    console.error('Failed to remove offline sync item:', err);
  }
}

export async function clearOfflineSyncQueue(): Promise<void> {
  await setCachedItems('offlineSyncQueue', []);
}

export async function saveCriticalData(collectionName: string, docId: string, data: any): Promise<void> {
  try {
    const collKey = `critical_${collectionName}`;
    const items = await getCachedItems(collKey);
    const existing = items.findIndex((x: any) => x.id === docId);
    const entry = { id: docId, ...data, timestamp: Date.now() };
    if (existing >= 0) {
      items[existing] = entry;
    } else {
      items.push(entry);
    }
    await setCachedItems(collKey, items);
  } catch (err) {
    console.error('Failed to save critical data:', err);
  }
}

export async function removeCriticalData(collectionName: string, docId: string): Promise<void> {
  try {
    const collKey = `critical_${collectionName}`;
    const items = await getCachedItems(collKey);
    const filtered = items.filter((x: any) => x.id !== docId);
    await setCachedItems(collKey, filtered);
  } catch (err) {
    console.error('Failed to remove critical data:', err);
  }
}

export async function getCriticalCollection(collectionName: string): Promise<any[]> {
  return getCachedItems(`critical_${collectionName}`);
}
