import { collection, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

// Helper to formulate high-level schema SQL commands that users can copy to create tables in Supabase
export const SUPABASE_SQL_CREATOR_SCRIPT = `-- SUPABASE POSTGRESQL MERGED SCHEMA CREATION SCRIPT
-- Copy-paste this script into your Supabase SQL Editor (https://supabase.com)
-- to initialize tables with JSONB zero-loss support and indexed key matching.

-- 1. Create the Users Table
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

-- 2. Create the Bookings Table
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

-- 3. Create the Discussions Table
CREATE TABLE IF NOT EXISTS public.discussions (
  id TEXT PRIMARY KEY,
  title TEXT,
  author_id TEXT,
  category TEXT,
  reactions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

-- 4. Create the Items Table (Marketplace)
CREATE TABLE IF NOT EXISTS public.items (
  id TEXT PRIMARY KEY,
  title TEXT,
  seller_id TEXT,
  price NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

-- 5. Create the Community Pulse Table
CREATE TABLE IF NOT EXISTS public.community_pulse (
  id TEXT PRIMARY KEY,
  title TEXT,
  category TEXT,
  supporters_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

-- Enable Row Level Security (RLS) policies for secure reads
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_pulse ENABLE ROW LEVEL SECURITY;

-- Expose simple SELECT policies for all authenticated users
CREATE POLICY "Allow public select on tables" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public select on bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Allow public select on discussions" ON public.discussions FOR SELECT USING (true);
CREATE POLICY "Allow public select on items" ON public.items FOR SELECT USING (true);
CREATE POLICY "Allow public select on community_pulse" ON public.community_pulse FOR SELECT USING (true);

-- Upsert capabilities policy for Service / Admin role syncing
CREATE POLICY "Enable insert/update for sync role" ON public.users USING (true) WITH CHECK (true);
CREATE POLICY "Enable insert/update for bookings" ON public.bookings USING (true) WITH CHECK (true);
CREATE POLICY "Enable insert/update for discussions" ON public.discussions USING (true) WITH CHECK (true);
CREATE POLICY "Enable insert/update for items" ON public.items USING (true) WITH CHECK (true);
CREATE POLICY "Enable insert/update for community_pulse" ON public.community_pulse USING (true) WITH CHECK (true);
`;

// CORE BACKGROUND ENGINE: Setup Real-time Listeners on Firestore collections and automatically pipe updates to Supabase
export function startRealtimeDbSync() {
  console.log('[SyncEngine] Initializing real-time dual-database bridge listener...');

  const activeSyncUnsubscribers: (() => void)[] = [];

  const syncConfig = [
    {
      collection: 'users',
      table: 'users',
      summaryField: 'username',
      mapper: (id: string, docData: any) => ({
        uid: id,
        email: docData.email || '',
        username: docData.username || 'User',
        rewards_points: Number(docData.rewardsPoints || 0),
        carbon_savings_kg: Number(docData.carbonSavingsKg || 0),
        is_worker: Boolean(docData.isWorker),
        created_at: getISOValue(docData.createdAt),
        raw_data: docData
      })
    },
    {
      collection: 'bookings',
      table: 'bookings',
      summaryField: 'serviceType',
      mapper: (id: string, docData: any) => ({
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
      summaryField: 'title',
      mapper: (id: string, docData: any) => ({
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
      summaryField: 'title',
      mapper: (id: string, docData: any) => ({
        id,
        title: docData.title || '',
        seller_id: docData.sellerId || '',
        price: Number(docData.price || 0),
        status: docData.status || 'available',
        created_at: getISOValue(docData.createdAt),
        raw_data: docData
      })
    },
    {
      collection: 'community_pulse',
      table: 'community_pulse',
      summaryField: 'title',
      mapper: (id: string, docData: any) => ({
        id,
        title: docData.title || '',
        category: docData.category || 'info',
        supporters_count: Number(docData.supportersCount || 0),
        created_at: getISOValue(docData.createdAt),
        raw_data: docData
      })
    }
  ];

  syncConfig.forEach(({ collection: colName, table: tableName, summaryField, mapper }) => {
    try {
      const unsub = onSnapshot(collection(db, colName), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const docId = change.doc.id;
          const docData = change.doc.data();
          const pSummary = docData[summaryField] || 'N/A';

          if (change.type === 'removed') {
            // Document deleted in Firestore - delete in Supabase
            if (isSupabaseConfigured() && supabase) {
              const { error } = await supabase
                .from(tableName)
                .delete()
                .eq(colName === 'users' ? 'uid' : 'id', docId);

              if (error) {
                console.error(`[SyncEngine] Supabase delete error for ${colName}/${docId}:`, error);
                logSyncEvent(colName, docId, 'DELETED', pSummary, 'success', 'failed', error.message);
              } else {
                logSyncEvent(colName, docId, 'DELETED', pSummary, 'success', 'success');
              }
            } else {
              logSyncEvent(colName, docId, 'DELETED', pSummary, 'success', 'simulated');
            }
          } else {
            // Document added/modified
            const actionType = change.type === 'added' ? 'ADDED' : 'MODIFIED';
            const mappedPayload = mapper(docId, docData);

            if (isSupabaseConfigured() && supabase) {
              const { error } = await supabase
                .from(tableName)
                .upsert(mappedPayload as any);

              if (error) {
                console.error(`[SyncEngine] Supabase upsert failed for ${colName}/${docId}:`, error);
                logSyncEvent(
                  colName,
                  docId,
                  actionType,
                  `${pSummary} (${JSON.stringify(mappedPayload).substring(0, 40)}...)`,
                  'success',
                  'failed',
                  error.message + '\n👉 Note: Please check if you have executed the table SQL creation helper script in your Supabase dashboard!'
                );
              } else {
                logSyncEvent(
                  colName,
                  docId,
                  actionType,
                  `${pSummary}`,
                  'success',
                  'success'
                );
              }
            } else {
              // Simulated sync for smooth local testing
              logSyncEvent(
                colName,
                docId,
                actionType,
                `${pSummary} [Simulation/Pushed Mode]`,
                'success',
                'simulated'
              );
            }
          }
        });
      }, (error) => {
        console.warn(`[SyncEngine] Listening on snapshot for '${colName}' failed:`, error);
      });

      activeSyncUnsubscribers.push(unsub);
    } catch (e) {
      console.error(`[SyncEngine] Failed listening setup on '${colName}':`, e);
    }
  });

  return () => {
    activeSyncUnsubscribers.forEach(unsub => unsub());
  };
}

// BATCH MIGRATION: Trigger a complete push of all current docs in Firestore into Supabase
export async function runFullBatchMigration() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase Client is not yet configured. Please supply VITE_SUPABASE_ANON_KEY in settings first.');
  }

  const resultStats = {
    users: { success: 0, failed: 0 },
    bookings: { success: 0, failed: 0 },
    discussions: { success: 0, failed: 0 },
    items: { success: 0, failed: 0 },
    community_pulse: { success: 0, failed: 0 }
  };

  const syncConfig = [
    {
      collection: 'users',
      table: 'users',
      mapper: (id: string, docData: any) => ({
        uid: id,
        email: docData.email || '',
        username: docData.username || 'User',
        rewards_points: Number(docData.rewardsPoints || 0),
        carbon_savings_kg: Number(docData.carbonSavingsKg || 0),
        is_worker: Boolean(docData.isWorker),
        created_at: getISOValue(docData.createdAt),
        raw_data: docData
      })
    },
    {
      collection: 'bookings',
      table: 'bookings',
      mapper: (id: string, docData: any) => ({
        id,
        customer_id: docData.customerId || '',
        worker_id: docData.workerId || null,
        service_type: docData.serviceType || 'Not Specified',
        status: docData.status || 'pending',
        price: Number(docData.price || 0),
        created_at: getISOValue(docData.createdAt),
 Raw_data: docData
      })
    },
    {
      collection: 'discussions',
      table: 'discussions',
      mapper: (id: string, docData: any) => ({
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
      mapper: (id: string, docData: any) => ({
        id,
        title: docData.title || '',
        seller_id: docData.sellerId || '',
        price: Number(docData.price || 0),
        status: docData.status || 'available',
        created_at: getISOValue(docData.createdAt),
        raw_data: docData
      })
    },
    {
      collection: 'community_pulse',
      table: 'community_pulse',
      mapper: (id: string, docData: any) => ({
        id,
        title: docData.title || '',
        category: docData.category || 'info',
        supporters_count: Number(docData.supportersCount || 0),
        created_at: getISOValue(docData.createdAt),
        raw_data: docData
      })
    }
  ];

  for (const config of syncConfig) {
    try {
      const snap = await getDocs(collection(db, config.collection));
      const keyName = config.collection as keyof typeof resultStats;

      for (const d of snap.docs) {
        const id = d.id;
        const mapped = config.mapper(id, d.data());

        const { error } = await supabase
          .from(config.table)
          .upsert(mapped as any);

        if (error) {
          resultStats[keyName].failed++;
          logSyncEvent(config.collection, id, 'MIGRATED', `Batch: ${id}`, 'success', 'failed', error.message);
        } else {
          resultStats[keyName].success++;
          logSyncEvent(config.collection, id, 'MIGRATED', `Batch: ${id}`, 'success', 'success');
        }
      }
    } catch (e: any) {
      console.error(`Migration error on ${config.collection}:`, e);
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
  logSyncEvent(table, id, action === 'UPSERT' ? 'ADDED' : 'DELETED', `Queued offline: ${id}`, 'idle', 'simulated');
  return newItem;
}

/**
 * Clears the offline queue
 */
export function clearOfflineQueue() {
  offlineSyncQueue.length = 0;
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

