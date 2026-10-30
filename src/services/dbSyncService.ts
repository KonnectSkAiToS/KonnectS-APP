import { collection, onSnapshot, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  saveOfflineSyncItem, 
  removeOfflineSyncItem, 
  clearOfflineSyncQueue, 
  getOfflineSyncQueue,
  saveCriticalData,
  removeCriticalData,
  getCriticalCollection
} from '../utils/indexedDB';

export interface SyncLog {
  id: string;
  timestamp: string;
  collection: string;
  docId: string;
  action: 'ADDED' | 'MODIFIED' | 'DELETED' | 'MIGRATED';
  payloadSummary: string;
  firebaseStatus: 'success' | 'failed' | 'idle';
  supabaseStatus: 'success' | 'failed' | 'simulated';
  errorMessage?: string;
}

// In-Memory Synchronizer Log Queue
export const syncLogsQueue: SyncLog[] = [];
const MAX_LOGS = 120;

// Subscribers for real-time log updates in the UI
const logSubscribers = new Set<() => void>();

export function subscribeToSyncLogs(callback: () => void) {
  logSubscribers.add(callback);
  return () => {
    logSubscribers.delete(callback);
  };
}

function notifySubscribers() {
  logSubscribers.forEach(cb => cb());
  window.dispatchEvent(new CustomEvent('supabase-sync-updated'));
}

export function logSyncEvent(
  collectionName: string,
  docId: string,
  action: 'ADDED' | 'MODIFIED' | 'DELETED' | 'MIGRATED',
  payloadSummary: string,
  fbStatus: 'success' | 'failed' | 'idle',
  sbStatus: 'success' | 'failed' | 'simulated',
  error?: string
) {
  const newLog: SyncLog = {
    id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(4),
    timestamp: new Date().toLocaleTimeString(),
    collection: collectionName,
    docId,
    action,
    payloadSummary,
    firebaseStatus: fbStatus,
    supabaseStatus: sbStatus,
    errorMessage: error
  };

  syncLogsQueue.unshift(newLog);
  if (syncLogsQueue.length > MAX_LOGS) {
    syncLogsQueue.pop();
  }
  notifySubscribers();
}

// Map Firestore dates/Timestamps cleanly into PostgreSQL ISO strings
function getISOValue(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (val.seconds) {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  try {
    return new Date(val).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Helper to formulate high-level schema SQL commands that users can copy to create tables in Supabase.
// NOTE: Row Level Security is OWNER-SCOPED. It expects Supabase "Third-Party Auth" to be enabled for
// Firebase (Dashboard > Authentication > Sign In / Providers > Third-Party Auth), so that the Firebase
// user id is available as auth.jwt()->>'sub'. Shared tables (community_pulse) are read-only for clients.
export const SUPABASE_SQL_CREATOR_SCRIPT = `-- SUPABASE POSTGRESQL MERGED SCHEMA CREATION SCRIPT (owner-scoped RLS)
-- Prerequisite: enable Firebase under Authentication > Third-Party Auth in your Supabase project.
-- Copy-paste this script into your Supabase SQL Editor (https://supabase.com).

CREATE TABLE IF NOT EXISTS public.users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  rewards_points INTEGER DEFAULT 0,
  carbon_savings_kg NUMERIC DEFAULT 0.0,
  is_worker BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  worker_id TEXT,
  service_type TEXT,
  status TEXT,
  price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

CREATE TABLE IF NOT EXISTS public.discussions (
  id TEXT PRIMARY KEY,
  title TEXT,
  author_id TEXT,
  category TEXT,
  reactions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

CREATE TABLE IF NOT EXISTS public.items (
  id TEXT PRIMARY KEY,
  title TEXT,
  seller_id TEXT,
  price NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

CREATE TABLE IF NOT EXISTS public.community_pulse (
  id TEXT PRIMARY KEY,
  title TEXT,
  category TEXT,
  supporters_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_pulse ENABLE ROW LEVEL SECURITY;

-- users: a person can only read and write their own row
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (uid = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (uid = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (uid = (SELECT auth.jwt()->>'sub')) WITH CHECK (uid = (SELECT auth.jwt()->>'sub'));

-- bookings: visible/editable only to the customer or assigned worker
CREATE POLICY "bookings_select_party" ON public.bookings FOR SELECT USING (customer_id = (SELECT auth.jwt()->>'sub') OR worker_id = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "bookings_insert_party" ON public.bookings FOR INSERT WITH CHECK (customer_id = (SELECT auth.jwt()->>'sub') OR worker_id = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "bookings_update_party" ON public.bookings FOR UPDATE USING (customer_id = (SELECT auth.jwt()->>'sub') OR worker_id = (SELECT auth.jwt()->>'sub')) WITH CHECK (customer_id = (SELECT auth.jwt()->>'sub') OR worker_id = (SELECT auth.jwt()->>'sub'));

-- items (marketplace): any signed-in user can browse; only the seller can write
CREATE POLICY "items_select_signed_in" ON public.items FOR SELECT USING ((SELECT auth.jwt()->>'sub') IS NOT NULL);
CREATE POLICY "items_insert_seller" ON public.items FOR INSERT WITH CHECK (seller_id = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "items_update_seller" ON public.items FOR UPDATE USING (seller_id = (SELECT auth.jwt()->>'sub')) WITH CHECK (seller_id = (SELECT auth.jwt()->>'sub'));

-- discussions: signed-in users can read; only the author can write
CREATE POLICY "discussions_select_signed_in" ON public.discussions FOR SELECT USING ((SELECT auth.jwt()->>'sub') IS NOT NULL);
CREATE POLICY "discussions_insert_author" ON public.discussions FOR INSERT WITH CHECK (author_id = (SELECT auth.jwt()->>'sub'));
CREATE POLICY "discussions_update_author" ON public.discussions FOR UPDATE USING (author_id = (SELECT auth.jwt()->>'sub')) WITH CHECK (author_id = (SELECT auth.jwt()->>'sub'));

-- community_pulse: shared content, read-only for clients (write with the service role from a server)
CREATE POLICY "pulse_select_signed_in" ON public.community_pulse FOR SELECT USING ((SELECT auth.jwt()->>'sub') IS NOT NULL);
`;

// Tables that recently failed a Supabase write. They are retried after a cool-down instead of being
// disabled for the rest of the session, so one transient network error cannot silently stop syncing.
export const unreadyTables = new Set<string>();
const TABLE_RETRY_COOLDOWN_MS = 60_000;

function markTableFailed(table: string) {
  unreadyTables.add(table);
  if (typeof setTimeout !== 'undefined') {
    setTimeout(() => unreadyTables.delete(table), TABLE_RETRY_COOLDOWN_MS);
  }
}

// Fields that are sensitive and are never mirrored to the secondary database.
const MIRROR_STRIP_KEYS = ['documents', 'verificationPhoto', 'dateOfBirth', 'mobileNumber'];

function sanitizeForMirror(data: any) {
  const copy = { ...(data || {}) };
  for (const key of MIRROR_STRIP_KEYS) delete copy[key];
  return copy;
}

interface SyncTarget {
  collection: 'users' | 'bookings' | 'discussions' | 'items';
  table: string;
  keyColumn: 'uid' | 'id';
  summaryField: string;
  mapper: (id: string, docData: any) => Record<string, any>;
}

// One definition shared by the live listener and the batch migration.
const SYNC_TARGETS: SyncTarget[] = [
  {
    collection: 'users',
    table: 'users',
    keyColumn: 'uid',
    summaryField: 'username',
    mapper: (id, docData) => ({
      uid: id,
      email: docData.email || '',
      username: docData.username || 'User',
      rewards_points: Number(docData.rewardsPoints || 0),
      carbon_savings_kg: Number(docData.carbonSavingsKg || 0),
      is_worker: Boolean(docData.isWorker),
      created_at: getISOValue(docData.createdAt),
      raw_data: sanitizeForMirror(docData)
    })
  },
  {
    collection: 'bookings',
    table: 'bookings',
    keyColumn: 'id',
    summaryField: 'serviceType',
    mapper: (id, docData) => ({
      id,
      customer_id: docData.customerId || '',
      worker_id: docData.workerId || null,
      service_type: docData.serviceType || 'Not Specified',
      status: docData.status || 'pending',
      price: Number(docData.price || 0),
      created_at: getISOValue(docData.createdAt),
      raw_data: docData
    })
  },
  {
    collection: 'discussions',
    table: 'discussions',
    keyColumn: 'id',
    summaryField: 'title',
    mapper: (id, docData) => ({
      id,
      title: docData.title || '',
      author_id: docData.authorId || '',
      category: docData.category || 'general',
      reactions: Number(docData.reactions || 0),
      created_at: getISOValue(docData.createdAt),
      raw_data: docData
    })
  },
  {
    collection: 'items',
    table: 'items',
    keyColumn: 'id',
    summaryField: 'title',
    mapper: (id, docData) => ({
      id,
      title: docData.title || '',
      seller_id: docData.sellerId || '',
      price: Number(docData.price || 0),
      status: docData.status || 'available',
      created_at: getISOValue(docData.createdAt),
      raw_data: docData
    })
  }
];

// Only the signed-in user's OWN documents are mirrored. (Previously every browser listened to the
// whole collections and re-uploaded everyone's data, which was costly and a privacy/security risk.)
function getOwnedSources(uid: string): { target: SyncTarget; kind: 'doc' | 'query'; ref: any }[] {
  const byName = (name: SyncTarget['collection']) => SYNC_TARGETS.find(t => t.collection === name)!;
  return [
    { target: byName('users'), kind: 'doc', ref: doc(db, 'users', uid) },
    { target: byName('bookings'), kind: 'query', ref: query(collection(db, 'bookings'), where('customerId', '==', uid)) },
    { target: byName('bookings'), kind: 'query', ref: query(collection(db, 'bookings'), where('workerId', '==', uid)) },
    { target: byName('items'), kind: 'query', ref: query(collection(db, 'items'), where('sellerId', '==', uid)) },
    { target: byName('discussions'), kind: 'query', ref: query(collection(db, 'discussions'), where('authorId', '==', uid)) }
  ];
}

async function pushDocToSupabase(
  target: SyncTarget,
  docId: string,
  docData: any,
  actionType: 'ADDED' | 'MODIFIED'
) {
  const pSummary = String(docData?.[target.summaryField] ?? 'N/A');

  // Local offline cache of the user's own critical docs
  saveCriticalData(target.collection, docId, target.collection === 'users' ? sanitizeForMirror(docData) : docData);

  if (!isSupabaseConfigured() || !supabase) {
    logSyncEvent(target.collection, docId, actionType, `${pSummary} [Simulation/Pushed Mode]`, 'success', 'simulated');
    return;
  }
  if (unreadyTables.has(target.table)) {
    logSyncEvent(target.collection, docId, actionType, `${pSummary} (paused, retrying shortly)`, 'success', 'failed', 'Recent Supabase error; will retry after cool-down');
    return;
  }

  try {
    const { error } = await supabase.from(target.table).upsert(target.mapper(docId, docData) as any);
    if (error) {
      markTableFailed(target.table);
      console.warn(`[SyncEngine] Supabase table '${target.table}' rejected a write; pausing it for ${TABLE_RETRY_COOLDOWN_MS / 1000}s:`, error.message);
      logSyncEvent(target.collection, docId, actionType, pSummary, 'success', 'failed', error.message);
    } else {
      logSyncEvent(target.collection, docId, actionType, pSummary, 'success', 'success');
    }
  } catch (e: any) {
    markTableFailed(target.table);
    logSyncEvent(target.collection, docId, actionType, pSummary, 'success', 'failed', e?.message || 'Network error');
  }
}

// CORE BACKGROUND ENGINE: mirror the signed-in user's own Firestore documents to Supabase in real time
export function startRealtimeDbSync(uid?: string) {
  if (!uid) {
    console.warn('[SyncEngine] No signed-in user; real-time sync not started.');
    return () => {};
  }
  console.log('[SyncEngine] Initializing real-time dual-database bridge listener (own data only)...');

  const unsubscribers: (() => void)[] = [];

  getOwnedSources(uid).forEach(({ target, kind, ref }) => {
    try {
      if (kind === 'doc') {
        let seen = false;
        const unsub = onSnapshot(ref, (snap: any) => {
          if (!snap.exists()) return;
          const action = seen ? 'MODIFIED' : 'ADDED';
          seen = true;
          pushDocToSupabase(target, snap.id, snap.data(), action);
        }, (error: any) => {
          console.warn(`[SyncEngine] Listening on '${target.collection}' failed:`, error);
        });
        unsubscribers.push(unsub);
      } else {
        const unsub = onSnapshot(ref, (snapshot: any) => {
          snapshot.docChanges().forEach((change: any) => {
            const docId = change.doc.id;
            if (change.type === 'removed') {
              // A scoped listener cannot tell "deleted" from "no longer matches", so remote deletes
              // are not propagated from here. Only the local cache entry is dropped.
              removeCriticalData(target.collection, docId);
              logSyncEvent(target.collection, docId, 'DELETED', String(change.doc.data()?.[target.summaryField] ?? 'N/A'), 'success', 'simulated', 'Remote delete skipped (scoped listener)');
              return;
            }
            pushDocToSupabase(target, docId, change.doc.data(), change.type === 'added' ? 'ADDED' : 'MODIFIED');
          });
        }, (error: any) => {
          console.warn(`[SyncEngine] Listening on '${target.collection}' failed:`, error);
        });
        unsubscribers.push(unsub);
      }
    } catch (e) {
      console.warn(`[SyncEngine] Failed listening setup on '${target.collection}':`, e);
    }
  });

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

// BATCH MIGRATION: push all of the signed-in user's own documents from Firestore into Supabase
export async function runFullBatchMigration() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase Client is not yet configured. Please supply VITE_SUPABASE_ANON_KEY in settings first.');
  }
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Please sign in before running a migration.');
  }

  const resultStats = {
    users: { success: 0, failed: 0 },
    bookings: { success: 0, failed: 0 },
    discussions: { success: 0, failed: 0 },
    items: { success: 0, failed: 0 },
    community_pulse: { success: 0, failed: 0 }
  };

  const seen = new Set<string>();

  for (const { target, kind, ref } of getOwnedSources(uid)) {
    const keyName = target.collection as keyof typeof resultStats;
    try {
      const docs: { id: string; data: any }[] = [];
      if (kind === 'doc') {
        const snap = await getDoc(ref);
        if (snap.exists()) docs.push({ id: snap.id, data: snap.data() });
      } else {
        const snap = await getDocs(ref);
        snap.docs.forEach((d: any) => docs.push({ id: d.id, data: d.data() }));
      }

      for (const { id, data } of docs) {
        const dedupeKey = `${target.collection}/${id}`;
        if (seen.has(dedupeKey)) continue; // a booking can match both the customer and worker query
        seen.add(dedupeKey);

        try {
          const { error } = await supabase.from(target.table).upsert(target.mapper(id, data) as any);
          if (error) {
            resultStats[keyName].failed++;
            logSyncEvent(target.collection, id, 'MIGRATED', `Batch: ${id}`, 'success', 'failed', error.message);
          } else {
            resultStats[keyName].success++;
            logSyncEvent(target.collection, id, 'MIGRATED', `Batch: ${id}`, 'success', 'success');
          }
        } catch (e: any) {
          resultStats[keyName].failed++;
          logSyncEvent(target.collection, id, 'MIGRATED', `Batch: ${id}`, 'success', 'failed', e?.message || 'Network error');
        }
      }
    } catch (e: any) {
      console.warn(`Migration notice on ${target.collection}:`, e?.message || e);
    }
  }

  return resultStats;
}

// -------------------------------------------------------------
// OFFLINE QUEUING & CONFLICT RESOLUTION SUPPORT FOR INTEGRATIONS
// -------------------------------------------------------------

export interface OfflineSyncItem {
  id: string;
  table: string;
  action: 'UPSERT' | 'DELETE';
  payload: any;
  timestamp: number;
}

// Global In-Memory Offline Queue
export const offlineSyncQueue: OfflineSyncItem[] = [];

// Initialize the in-memory queue from IndexedDB on startup
if (typeof window !== 'undefined') {
  getOfflineSyncQueue().then((items) => {
    if (items && items.length > 0) {
      items.forEach(item => {
        if (!offlineSyncQueue.some(existing => existing.id === item.id)) {
          offlineSyncQueue.push(item);
        }
      });
      window.dispatchEvent(new Event('offline-queue-updated'));
    }
  }).catch(err => {
    console.error('[dbSyncService] Failed to initialize offlineSyncQueue from IndexedDB:', err);
  });
}

/**
 * Queues an item for synchronization when connection is re-established
 */
export function queueOfflineSync(id: string, table: string, action: 'UPSERT' | 'DELETE', payload: any) {
  const newItem: OfflineSyncItem = {
    id,
    table,
    action,
    payload,
    timestamp: Date.now()
  };
  offlineSyncQueue.push(newItem);
  saveOfflineSyncItem(newItem); // Persistent IndexedDB write
  logSyncEvent(table, id, action === 'UPSERT' ? 'ADDED' : 'DELETED', `Queued offline: ${id}`, 'idle', 'simulated');
  window.dispatchEvent(new Event('offline-queue-updated'));
  return newItem;
}

/**
 * Clears the offline queue
 */
export function clearOfflineQueue() {
  offlineSyncQueue.length = 0;
  clearOfflineSyncQueue(); // Persistent IndexedDB clear
  window.dispatchEvent(new Event('offline-queue-updated'));
}

/**
 * Conflict Resolution Engine (Last-Write-Wins based on timestamps)
 */
export function resolveConflict(localRecord: any, remoteRecord: any): { resolved: any; source: 'local' | 'remote' } {
  const localTime = localRecord?.updated_at || localRecord?.created_at || 0;
  const remoteTime = remoteRecord?.updated_at || remoteRecord?.created_at || 0;

  const localMs = typeof localTime === 'string' ? new Date(localTime).getTime() : Number(localTime || 0);
  const remoteMs = typeof remoteTime === 'string' ? new Date(remoteTime).getTime() : Number(remoteTime || 0);

  if (localMs >= remoteMs) {
    return { resolved: localRecord, source: 'local' };
  } else {
    return { resolved: remoteRecord, source: 'remote' };
  }
}

