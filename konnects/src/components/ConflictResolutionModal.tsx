import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Database, Cloud, ArrowRight, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { haptics } from '../utils/haptics';

export interface SyncConflict {
  id: string; // unique conflict ID
  table: string;
  docId: string;
  localPayload: any;
  remotePayload: any;
  resolve: (choice: 'local' | 'remote') => void;
}

export function ConflictResolutionModal() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  useEffect(() => {
    const handleConflict = (e: CustomEvent<Omit<SyncConflict, 'resolve'>>) => {
      const { table, docId, localPayload, remotePayload } = e.detail;
      
      haptics.heavy();
      
      const newConflict: SyncConflict = {
        id: 'conflict-' + Date.now() + '-' + Math.random().toString(36).substring(4),
        table,
        docId,
        localPayload,
        remotePayload,
        resolve: (choice: 'local' | 'remote') => {
          // Dispatch back resolving event
          const resolveEvent = new CustomEvent('urbanNet_sync_conflict_resolved', {
            detail: {
              table,
              docId,
              choice,
              resolvedPayload: choice === 'local' ? localPayload : remotePayload
            }
          });
          window.dispatchEvent(resolveEvent);
          
          haptics.success();
          
          // Remove from conflicts list
          setConflicts(prev => {
            const next = prev.filter(c => c.docId !== docId || c.table !== table);
            return next;
          });
        }
      };

      setConflicts(prev => {
        // Prevent duplicate conflicts for the same document
        if (prev.some(c => c.docId === docId && c.table === table)) {
          return prev;
        }
        return [...prev, newConflict];
      });
    };

    window.addEventListener('urbanNet_sync_conflict_detected' as any, handleConflict);
    return () => {
      window.removeEventListener('urbanNet_sync_conflict_detected' as any, handleConflict);
    };
  }, []);

  const activeConflict = conflicts[0] || null;

  if (!activeConflict) return null;

  const { table, docId, localPayload, remotePayload, resolve } = activeConflict;

  // Find clashing keys
  const allKeys = Array.from(new Set([
    ...Object.keys(localPayload || {}),
    ...Object.keys(remotePayload || {})
  ])).filter(key => {
    // Skip internal fields that aren't human readable
    return !['raw_data', 'id', 'uid', 'userId', 'updated_at', 'created_at', 'timestamp'].includes(key);
  });

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-300 italic">None</span>;
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
      {/* Overlay Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
      />

      {/* Dialog Frame */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        {/* Urgent Warning Header */}
        <div className="bg-amber-500/10 dark:bg-amber-500/5 px-6 py-4.5 border-b border-amber-500/15 flex items-center gap-3">
          <div className="p-2 bg-amber-500 text-white rounded-xl">
            <AlertTriangle size={18} className="animate-bounce" />
          </div>
          <div>
            <h3 className="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">
              Offline Conflict Detected
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              Collection: {table} • ID: {docId.substring(0, 10)}...
            </p>
          </div>
        </div>

        {/* Comparison Dashboard */}
        <div className="p-6 space-y-5 max-h-[50vh] overflow-y-auto no-scrollbar">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
            Your offline modifications to this item clash with edits made elsewhere in the cloud network. Please select which revision to authorize as the truth.
          </p>

          <div className="space-y-3">
            {allKeys.map(key => {
              const localVal = localPayload[key];
              const remoteVal = remotePayload[key];
              const hasClash = JSON.stringify(localVal) !== JSON.stringify(remoteVal);

              return (
                <div 
                  key={key} 
                  className={`p-3.5 rounded-2xl transition-all border ${
                    hasClash 
                      ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-100 dark:border-amber-950/40 shadow-sm' 
                      : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-900'
                  }`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${hasClash ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400'}`}>
                    {key.replace(/_/g, ' ')} {hasClash && '⚠️ Clash'}
                  </span>
                  
                  <div className="grid grid-cols-2 gap-4 items-center">
                    {/* Local Value */}
                    <div className="text-left">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Local (Client)</span>
                      <span className={`text-xs font-bold block truncate ${hasClash ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-450'}`}>
                        {formatValue(localVal)}
                      </span>
                    </div>

                    {/* Remote Value */}
                    <div className="text-left border-l border-slate-150/50 dark:border-slate-800/50 pl-4">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Cloud (Server)</span>
                      <span className={`text-xs font-bold block truncate ${hasClash ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-450'}`}>
                        {formatValue(remoteVal)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Choice Controls */}
        <div className="p-6 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-850 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Keep Local Option */}
            <button
              onClick={() => resolve('local')}
              className="py-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <Database size={16} className="text-indigo-500" />
              <span>Keep Local</span>
            </button>

            {/* Keep Cloud Option */}
            <button
              onClick={() => resolve('remote')}
              className="py-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-800 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <Cloud size={16} className="text-emerald-500 animate-pulse" />
              <span>Keep Cloud</span>
            </button>
          </div>

          <p className="text-center text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest italic pt-1">
            Reconciliation merges the selected payload with the IndexedDB sync queue
          </p>
        </div>
      </motion.div>
    </div>
  );
}
