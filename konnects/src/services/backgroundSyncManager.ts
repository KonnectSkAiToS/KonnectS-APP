/**
 * Background Sync Manager
 * Monitors connectivity and reconciles IndexedDB queued actions with Firebase / Supabase.
 */

import { db } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { getSyncQueue, removeFromSyncQueue } from '../utils/indexedDB';
import { logSyncEvent } from './dbSyncService';
import { batteryManager } from './batteryManager';

let isSyncing = false;
let syncTimeoutId: any = null;

function scheduleNextSync() {
  if (syncTimeoutId) clearTimeout(syncTimeoutId);
  const interval = batteryManager.getSyncIntervalMs();
  syncTimeoutId = setTimeout(async () => {
    await processBackgroundSyncQueue();
    scheduleNextSync();
  }, interval);
}

export async function processBackgroundSyncQueue() {
  if (isSyncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[BackgroundSync] System is offline. Sync postponed.');
    return;
  }

  // Check manual sync strategy override
  const syncStrategy = localStorage.getItem('konnects_sync_strategy') || 'auto';
  if (syncStrategy === 'manual_low_power_roaming') {
    const isLow = localStorage.getItem('is_low_battery') === 'true' || batteryManager.isBatteryLow();
    const isRoaming = localStorage.getItem('konnects_is_roaming') === 'true';
    if (isLow || isRoaming) {
      console.log('[BackgroundSync] Sync Strategy Override active: Manual Sync Only is forced during low-battery or roaming. Auto sync postponed.');
      return;
    }
  }

  isSyncing = true;
  console.log('[BackgroundSync] Starting synchronization process...');

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      console.log('[BackgroundSync] Queue is empty. No reconciliation needed.');
      isSyncing = false;
      return;
    }

    console.log(`[BackgroundSync] Reconciling ${queue.length} pending offline operations...`);

    for (const action of queue) {
      const { id, store, type, payload } = action;
      try {
        if (type === 'create' || type === 'update') {
          // Put the item in firestore (which will trigger real-time dbSyncService to Supabase)
          const collectionRef = collection(db, store);
          let docRef;
          
          if (payload.id && !payload.id.startsWith('temp-')) {
            docRef = doc(collectionRef, payload.id);
            await setDoc(docRef, {
              ...payload,
              syncedAt: new Date().toISOString()
            }, { merge: true });
          } else {
            // New doc
            const cleanPayload = { ...payload };
            if (cleanPayload.id) delete cleanPayload.id; // Let firestore auto-assign or use setDoc
            
            const newDoc = await addDoc(collectionRef, {
              ...cleanPayload,
              createdAt: new Date().toISOString(),
              syncedAt: new Date().toISOString()
            });
            console.log(`[BackgroundSync] Created new document in ${store} with ID ${newDoc.id}`);
          }
          
          logSyncEvent(store, id, 'ADDED', `Reconciled: ${payload.title || store}`, 'success', 'success');
        } else if (type === 'delete') {
          const docRef = doc(db, store, payload.id);
          await deleteDoc(docRef);
          logSyncEvent(store, id, 'DELETED', `Reconciled delete: ${payload.id}`, 'success', 'success');
        }

        // Successfully reconciled, remove from offline queue
        await removeFromSyncQueue(id);
      } catch (err: any) {
        console.error(`[BackgroundSync] Error syncing item ${id} for store ${store}:`, err);
        logSyncEvent(store, id, 'MODIFIED', `Sync failed: ${err.message}`, 'failed', 'failed');
      }
    }

    console.log('[BackgroundSync] Offline reconciliation complete.');
  } catch (error) {
    console.error('[BackgroundSync] Error in processBackgroundSyncQueue:', error);
  } finally {
    isSyncing = false;
  }
}

// Set up connectivity listeners
export function initBackgroundSync() {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('[BackgroundSync] Network connected! Triggering auto-sync...');
      processBackgroundSyncQueue();
    });

    // Run periodically with battery-aware interval scheduling
    scheduleNextSync();

    // Re-schedule immediately if battery saver is toggled
    window.addEventListener('battery-saver-changed', () => {
      console.log('[BackgroundSync] Battery state change. Rescheduling queue processing...');
      scheduleNextSync();
    });
  }
}
