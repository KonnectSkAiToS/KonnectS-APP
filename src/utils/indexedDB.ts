/**
 * Local-First IndexedDB Persistence Utility
 * Caches marketplace and service listings offline, and queues sync actions.
 */

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = indexedDB.open('KonnectSLocalDB', 2);
    
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('marketplace')) {
        db.createObjectStore('marketplace', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('services')) {
        db.createObjectStore('services', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cached_images')) {
        db.createObjectStore('cached_images', { keyPath: 'url' });
      }
    };
    
    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e: any) => reject(e.target.error);
  });
}

export async function cacheImage(url: string, data: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      const battery = await (navigator as any).getBattery();
      if (battery.level * 100 < 15 && !battery.charging) {
        console.warn('Battery low (<15%), skipping image cache save.');
        return;
      }
    }
    const db = await initDB();
    const transaction = db.transaction('cached_images', 'readwrite');
    const store = transaction.objectStore('cached_images');
    store.put({ url, data, timestamp: Date.now() });
  } catch (err) {
    console.error('Error writing cached image:', err);
  }
}

export async function getCachedImage(url: string): Promise<string | null> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('cached_images', 'readonly');
      const store = transaction.objectStore('cached_images');
      const request = store.get(url);
      request.onsuccess = () => {
        resolve(request.result ? request.result.data : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearCachedImages(): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction('cached_images', 'readwrite');
    const store = transaction.objectStore('cached_images');
    store.clear();
    console.log('Successfully cleared all cached images from IndexedDB due to low battery optimization.');
    window.dispatchEvent(new CustomEvent('cached-images-cleared'));
  } catch (err) {
    console.error('Error clearing cached images:', err);
  }
}

// Automatically clear non-essential cached images when battery level drops below 15%
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'getBattery' in navigator) {
  (navigator as any).getBattery().then((battery: any) => {
    const checkBattery = () => {
      if (battery.level * 100 < 15 && !battery.charging) {
        clearCachedImages();
      }
    };
    battery.addEventListener('levelchange', checkBattery);
    battery.addEventListener('chargingchange', checkBattery);
    checkBattery();
  }).catch(e => console.error('Battery API access failed:', e));
}

export async function getCachedItems(storeName: string): Promise<any[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`Error reading cached items from store ${storeName}:`, err);
    // Fallback to localStorage if any
    try {
      const cached = localStorage.getItem('konnects_offline_indexeddb_fallback_' + storeName);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
}

export async function setCachedItems(storeName: string, items: any[]): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Clear and re-populate
    store.clear();
    for (const item of items) {
      if (item && item.id) {
        store.put(item);
      }
    }
    // Also save to localStorage fallback
    localStorage.setItem('konnects_offline_indexeddb_fallback_' + storeName, JSON.stringify(items));
  } catch (err) {
    console.error(`Error writing cached items to store ${storeName}:`, err);
    try {
      localStorage.setItem('konnects_offline_indexeddb_fallback_' + storeName, JSON.stringify(items));
    } catch {}
  }
}

export async function addToSyncQueue(storeName: string, actionType: 'create' | 'update' | 'delete', payload: any): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const id = payload.id || 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(4);
    
    store.put({
      id,
      store: storeName,
      type: actionType,
      payload,
      timestamp: Date.now()
    });
    
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));
  } catch (err) {
    console.error('Error adding to sync queue:', err);
    // LocalStorage fallback sync queue
    try {
      const fallbackQueue = JSON.parse(localStorage.getItem('konnects_fallback_sync_queue') || '[]');
      fallbackQueue.push({
        id: payload.id || 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(4),
        store: storeName,
        type: actionType,
        payload,
        timestamp: Date.now()
      });
      localStorage.setItem('konnects_fallback_sync_queue', JSON.stringify(fallbackQueue));
      window.dispatchEvent(new CustomEvent('offline-queue-updated'));
    } catch {}
  }
}

export async function getSyncQueue(): Promise<any[]> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncQueue', 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error fetching sync queue:', err);
    try {
      return JSON.parse(localStorage.getItem('konnects_fallback_sync_queue') || '[]');
    } catch {
      return [];
    }
  }
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    store.delete(id);
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));
  } catch (err) {
    console.error('Error removing from sync queue:', err);
    try {
      const fallbackQueue = JSON.parse(localStorage.getItem('konnects_fallback_sync_queue') || '[]');
      const filtered = fallbackQueue.filter((x: any) => x.id !== id);
      localStorage.setItem('konnects_fallback_sync_queue', JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('offline-queue-updated'));
    } catch {}
  }
}

/**
 * Performs local, high-speed full-text indexing and filtering on cached items while offline.
 */
export async function searchOfflineCache(queryText: string): Promise<{ marketplace: any[]; services: any[] }> {
  const query = queryText.toLowerCase().trim();
  if (!query) {
    const marketplace = await getCachedItems('marketplace');
    const services = await getCachedItems('services');
    return { marketplace, services };
  }

  const marketplace = await getCachedItems('marketplace');
  const services = await getCachedItems('services');

  // Full-text local index multi-field filtering
  const filteredMarketplace = marketplace.filter((item: any) => {
    return (
      (item.title && item.title.toLowerCase().includes(query)) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query)) ||
      (item.condition && item.condition.toLowerCase().includes(query)) ||
      (Array.isArray(item.tags) && item.tags.some((t: string) => t.toLowerCase().includes(query)))
    );
  });

  const filteredServices = services.filter((pro: any) => {
    return (
      (pro.name && pro.name.toLowerCase().includes(query)) ||
      (pro.specialty && pro.specialty.toLowerCase().includes(query)) ||
      (pro.bio && pro.bio.toLowerCase().includes(query)) ||
      (pro.category && pro.category.toLowerCase().includes(query)) ||
      (pro.workerType && pro.workerType.toLowerCase().includes(query)) ||
      (Array.isArray(pro.skills) && pro.skills.some((s: string) => s.toLowerCase().includes(query)))
    );
  });

  return {
    marketplace: filteredMarketplace,
    services: filteredServices
  };
}
