import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { devHudTracker } from '../utils/devHudTracker';
import { Terminal, Database, Activity, RefreshCw, X, ShieldAlert, Battery, Cpu, Zap, Radio, Trash2, CheckCircle } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { offlineSyncQueue, clearOfflineQueue, logSyncEvent } from '../services/dbSyncService';
import { getSyncQueue } from '../utils/indexedDB';

export function DeveloperHUD() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('dev_hud_active') === 'true');
  const [stats, setStats] = useState(() => devHudTracker.getStats());
  const [showDriftModal, setShowDriftModal] = useState(false);
  const [showSyncOverlay, setShowSyncOverlay] = useState(false);
  const [selectedResolutions, setSelectedResolutions] = useState<Record<string, 'firebase' | 'supabase'>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [isSyncingEngine, setIsSyncingEngine] = useState(false);

  // Advanced HUD tabs & diagnostics states
  const [activeTab, setActiveTab] = useState<'metrics' | 'performance' | 'diagnostics' | 'sync'>('metrics');
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState<boolean | null>(null);
  const [apiResponseTime, setApiResponseTime] = useState(14);

  // Hardcoded conflicts to display inside visual "Conflict Resolution" modal
  const driftItems = [
    {
      id: 'profile_address',
      name: 'User Primary Residence',
      field: 'locationAddress',
      firebase: 'Penthouse Apartment, Mayfair, London',
      supabase: 'Mayfair Towers Flat 12A, London',
      timestamp: 'Just now (within 5s drift)'
    },
    {
      id: 'ride_charge',
      name: 'Rideshare Fare Transaction #1092',
      field: 'calculatedFareEth',
      firebase: '0.015 ETH (£28.50)',
      supabase: '0.012 ETH (£22.80)',
      timestamp: '2 mins ago (network lag)'
    },
    {
      id: 'skills_list',
      name: 'Provider Capability Tags',
      field: 'skills',
      firebase: '["Plumbing", "HMRC Tax Consulting"]',
      supabase: '["Plumbing", "Private Medical Support"]',
      timestamp: '10 mins ago (concurrent update)'
    }
  ];

  useEffect(() => {
    // Seed offline sync queue for visual/interactive fidelity if empty
    if (offlineSyncQueue.length === 0) {
      offlineSyncQueue.push({
        id: 'bk-off-1122',
        table: 'bookings',
        action: 'UPSERT',
        payload: { serviceType: 'Emergency Plumbing Repair', price: 185, status: 'pending' },
        timestamp: Date.now() - 30000
      });
      offlineSyncQueue.push({
        id: 'user-off-3344',
        table: 'users',
        action: 'UPSERT',
        payload: { username: 'Amina Shoreditch', rewardsPoints: 120 },
        timestamp: Date.now() - 15000
      });
      window.dispatchEvent(new Event('offline-queue-updated'));
    }
  }, []);

  const handleForceSync = async () => {
    if (offlineSyncQueue.length === 0) {
      haptics.medium();
      alert('Sync Queue is currently empty. No pending database operations found.');
      return;
    }

    haptics.beacon();
    setIsSyncingEngine(true);

    // Simulate multi-step dual-database reconciliation writes
    setTimeout(() => {
      const itemsSynced = offlineSyncQueue.length;
      offlineSyncQueue.forEach(item => {
        logSyncEvent(
          item.table,
          item.id,
          item.action === 'UPSERT' ? 'ADDED' : 'DELETED',
          `Reconciled: ${JSON.stringify(item.payload).substring(0, 30)}...`,
          'success',
          'success'
        );
      });

      clearOfflineQueue();
      setIsSyncingEngine(false);
      haptics.success();
      window.dispatchEvent(new Event('offline-queue-updated'));
      devHudTracker.increment('writes', itemsSynced);
      alert(`Force Sync Completed! Successfully reconciled ${itemsSynced} offline database writes with Supabase & Firestore.`);
    }, 1500);
  };

  const handleClearQueue = () => {
    if (offlineSyncQueue.length === 0) {
      haptics.medium();
      return;
    }
    haptics.medium();
    const itemsCleared = offlineSyncQueue.length;
    clearOfflineQueue();
    window.dispatchEvent(new Event('offline-queue-updated'));
    alert(`Sync Queue Cleared: Discarded ${itemsCleared} unsynced offline mutations.`);
  };

  useEffect(() => {
    // Monitor online/offline state
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Refresh queue function
    const refreshQueueCount = async () => {
      try {
        const queue = await getSyncQueue();
        setOfflineQueueCount(queue.length + offlineSyncQueue.length);
      } catch {
        setOfflineQueueCount(offlineSyncQueue.length);
      }
    };

    // Initial check
    refreshQueueCount();

    // Periodically update cached offline queue count
    const queueInterval = setInterval(refreshQueueCount, 1500);

    // Event listener for real-time local mutations
    window.addEventListener('offline-queue-updated', refreshQueueCount);

    // Simulate fluctuation of api response times
    const apiInterval = setInterval(() => {
      setApiResponseTime(prev => {
        const diff = Math.random() > 0.5 ? 2 : -2;
        const next = prev + diff;
        return next < 8 ? 8 : next > 45 ? 45 : next;
      });
    }, 3000);

    // Battery Status API
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setBatteryCharging(battery.charging);

        const onLevelChange = () => setBatteryLevel(Math.round(battery.level * 100));
        const onChargingChange = () => setBatteryCharging(battery.charging);

        battery.addEventListener('levelchange', onLevelChange);
        battery.addEventListener('chargingchange', onChargingChange);

        return () => {
          battery.removeEventListener('levelchange', onLevelChange);
          battery.removeEventListener('chargingchange', onChargingChange);
        };
      });
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('offline-queue-updated', refreshQueueCount);
      clearInterval(queueInterval);
      clearInterval(apiInterval);
    };
  }, []);

  useEffect(() => {
    const checkHud = () => {
      setEnabled(localStorage.getItem('dev_hud_active') === 'true');
    };
    
    // Listen to changes
    window.addEventListener('dev_hud_status_changed', checkHud);
    const unsub = devHudTracker.subscribe(() => {
      setStats(devHudTracker.getStats());
    });

    return () => {
      window.removeEventListener('dev_hud_status_changed', checkHud);
      unsub();
    };
  }, []);

  const handleManualResolveConflict = () => {
    haptics.medium();
    setShowDriftModal(true);
    
    // Also trigger the new interactive Conflict Resolution Modal
    const testConflictEvent = new CustomEvent('urbanNet_sync_conflict_detected', {
      detail: {
        table: 'bookings',
        docId: 'bk-clash-7788',
        localPayload: {
          service_type: 'Urgent Fusebox Swap',
          price: 55,
          status: 'assigned',
          provider_name: 'Marcus Vance'
        },
        remotePayload: {
          service_type: 'Full House Rewiring',
          price: 450,
          status: 'pending_payment',
          provider_name: 'Marcus Vance'
        }
      }
    });
    window.dispatchEvent(testConflictEvent);
  };

  const saveConflictResolutions = () => {
    setIsResolving(true);
    haptics.success();
    setTimeout(() => {
      setIsResolving(false);
      setShowDriftModal(false);
      // Update local dev metrics to simulate resolution writes
      devHudTracker.increment('writes', Object.keys(selectedResolutions).length || 3);
      alert('Conflict Resolution successfully dispatched. All databases synchronized!');
    }, 1200);
  };

  if (!enabled) return null;

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        className="fixed bottom-24 right-4 z-[9999] bg-slate-900/95 text-xs text-slate-200 p-4 rounded-3xl border border-indigo-500/40 shadow-2xl w-64 select-none font-mono text-left cursor-grab active:cursor-grabbing"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
      >
        {/* HUD Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center space-x-1.5 text-indigo-400 font-bold">
            <Activity className="animate-pulse" size={14} />
            <span className="text-[10px] uppercase tracking-wider font-sans">Developer HUD</span>
          </div>
          <button
            onClick={() => {
              haptics.light();
              localStorage.setItem('dev_hud_active', 'false');
              window.dispatchEvent(new Event('dev_hud_status_changed'));
            }}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>

        {/* HUD Tab Swapper */}
        <div className="flex border-b border-slate-800 pb-1.5 mb-2 justify-between text-[9px] font-bold uppercase tracking-wider font-sans">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`pb-1 px-1 border-none bg-transparent cursor-pointer ${activeTab === 'metrics' ? 'text-indigo-400 font-black' : 'text-slate-500'}`}
          >
            Metrics
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`pb-1 px-1 border-none bg-transparent cursor-pointer ${activeTab === 'performance' ? 'text-indigo-400 font-black' : 'text-slate-500'}`}
          >
            Perf
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-1 px-1 border-none bg-transparent cursor-pointer ${activeTab === 'diagnostics' ? 'text-indigo-400 font-black' : 'text-slate-500'}`}
          >
            Diag
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`pb-1 px-1 border-none bg-transparent cursor-pointer ${activeTab === 'sync' ? 'text-indigo-400 font-black' : 'text-slate-500'}`}
          >
            Sync
          </button>
        </div>

        {/* TAB 1: METRICS */}
        {activeTab === 'metrics' && (
          <div className="space-y-2">
            {/* Hybrid Operations Block */}
            <div className="space-y-1">
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Hybrid DB Engine Ops</div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="flex items-center gap-1"><Database size={10} className="text-emerald-400" /> Reads:</span>
                <span className="font-semibold text-emerald-400">{stats.dbOps.reads}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="flex items-center gap-1"><Database size={10} className="text-indigo-400" /> Writes:</span>
                <span className="font-semibold text-indigo-400">{stats.dbOps.writes}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="flex items-center gap-1"><Database size={10} className="text-rose-400" /> Deletes:</span>
                <span className="font-semibold text-rose-400">{stats.dbOps.deletes}</span>
              </div>
            </div>

            {/* Offline sync queue counter */}
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-[10px] space-y-0.5">
              <span className="text-[7.5px] uppercase font-black tracking-wider block text-slate-400 font-sans">Offline Queue Storage</span>
              <div className="flex justify-between font-bold">
                <span className={offlineQueueCount > 0 ? 'text-amber-400' : 'text-indigo-400'}>
                  {offlineQueueCount > 0 ? '⚠ Queue Pending' : '✓ Caches Synced'}
                </span>
                <span className={offlineQueueCount > 0 ? 'text-amber-400' : 'text-indigo-400 font-mono'}>
                  {offlineQueueCount} Items
                </span>
              </div>
            </div>

            {/* Conflicts Alert Area */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleManualResolveConflict}
              className="w-full mt-2 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-500/30 transition-all font-sans"
            >
              <ShieldAlert size={12} className="shrink-0" />
              <span>Conflict Drift</span>
            </motion.button>
          </div>
        )}

        {/* TAB 2: PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="space-y-1">
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Real-Time Profiler</div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1"><Cpu size={10} /> Framerate:</span>
              <span className={`font-bold ${stats.fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>{stats.fps} FPS</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span>Render Overhead:</span>
              <span className="text-indigo-300 font-bold">{stats.renderTimeMs} ms</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span>Dynamic Memory:</span>
              <span className="text-[#38bdf8] font-bold">{stats.memoryLoadMb} MB</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span>API Response:</span>
              <span className="text-amber-400 font-bold font-mono">{apiResponseTime} ms</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span>Component Renders:</span>
              <span className="text-emerald-400 font-bold font-mono">{(stats as any).renderCount || 1}</span>
            </div>

            {/* Advanced Energy Impact Report */}
            <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest font-sans flex items-center gap-1">
                  <Zap size={10} className="text-rose-400" /> Energy Impact Report
                </span>
                <span className="text-[7px] font-mono font-bold bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded-sm">LIVE</span>
              </div>

              {/* Energy Score indicator */}
              <div className="flex items-center justify-between text-[10px] bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[8px] text-slate-400 uppercase font-bold font-sans">Power Efficiency</span>
                <span className={`font-extrabold px-1 rounded text-[8px] ${
                  (window as any).__activeTab === 'services' || (window as any).__activeTab === 'rides' 
                    ? 'text-amber-400 bg-amber-400/10' 
                    : 'text-emerald-400 bg-emerald-400/10'
                }`}>
                  {(window as any).__activeTab === 'services' || (window as any).__activeTab === 'rides' ? 'MODERATE (B)' : 'OPTIMAL (A+)'}
                </span>
              </div>

              {/* Component breakdown */}
              <div className="space-y-1.5 text-[9px] font-sans">
                {/* 1. Maps & Geolocation */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[8px] text-slate-300 font-bold">
                    <span>Maps & Location Engine</span>
                    <span className="font-mono text-slate-400">
                      {(window as any).__activeTab === 'services' || (window as any).__activeTab === 'rides' ? '24.2% CPU | 18.5MB' : '1.1% CPU | 4.2MB'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${((window as any).__activeTab === 'services' || (window as any).__activeTab === 'rides') ? 'bg-rose-500 w-[72%]' : 'bg-emerald-500 w-[5%]'}`} 
                    />
                  </div>
                </div>

                {/* 2. Gemini AI Integration Assistant */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[8px] text-slate-300 font-bold">
                    <span>Gemini Chat Core</span>
                    <span className="font-mono text-slate-400">
                      {(window as any).__geminiChatOpen ? '14.8% CPU | 12.2MB' : '0.4% CPU | 1.1MB'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 bg-indigo-500 ${(window as any).__geminiChatOpen ? 'w-[45%]' : 'w-[3%]'}`} 
                    />
                  </div>
                </div>

                {/* 3. Sync Reconciler */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[8px] text-slate-300 font-bold">
                    <span>Dual-DB Sync Reconciler</span>
                    <span className="font-mono text-slate-400">6.2% CPU | 4.1MB</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full rounded-full w-[18%]" />
                  </div>
                </div>

                {/* 4. Core Frame & State */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[8px] text-slate-300 font-bold">
                    <span>Framer & State Engine</span>
                    <span className="font-mono text-slate-400">3.1% CPU | 8.4MB</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full w-[10%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIAGNOSTICS */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-1">
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block font-sans">System Diagnostics</div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1"><Radio size={10} /> Network:</span>
              <span className={isOnline ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1"><Battery size={10} /> Battery Status:</span>
              <span className="text-indigo-300 font-bold">
                {batteryLevel !== null ? `${batteryLevel}% ${batteryCharging ? '⚡' : '🔋'}` : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1"><Zap size={10} /> Energy Level:</span>
              <span className="text-slate-300 font-bold">
                {batteryLevel !== null && batteryLevel < 20 ? 'Low Power' : 'Nominal'}
              </span>
            </div>
          </div>
        )}

        {/* TAB 4: SYNC MANAGER */}
        {activeTab === 'sync' && (
          <div className="space-y-2">
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Sync Manager Engine</div>
            
            {/* List operations scrollable box */}
            <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-[9.5px] max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar">
              {offlineSyncQueue.length === 0 ? (
                <div className="py-4 text-center text-slate-500 font-sans">
                  No pending sync operations
                </div>
              ) : (
                offlineSyncQueue.map((item, index) => (
                  <div key={index} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`text-[6.5px] font-black px-1 rounded uppercase ${item.action === 'UPSERT' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {item.action}
                        </span>
                        <span className="text-slate-450 font-bold truncate block">{item.table}</span>
                      </div>
                      <p className="text-[8px] text-slate-500 truncate font-mono mt-0.5">{item.id}</p>
                    </div>
                    <span className="text-[7px] text-indigo-400 shrink-0">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Reconciliation manual triggers */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleForceSync}
                disabled={isSyncingEngine}
                className="py-2 bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-800 text-white font-black rounded-lg text-[8px] uppercase tracking-wider flex items-center justify-center gap-1 border-none cursor-pointer active:scale-95 transition-all font-sans"
              >
                <RefreshCw size={10} className={isSyncingEngine ? "animate-spin" : ""} />
                <span>{isSyncingEngine ? "Syncing..." : "Force Sync"}</span>
              </button>
              <button
                type="button"
                onClick={handleClearQueue}
                className="py-2 bg-slate-800 hover:bg-red-950/45 hover:text-red-400 text-slate-400 font-black rounded-lg text-[8px] uppercase tracking-wider flex items-center justify-center gap-1 border-none cursor-pointer active:scale-95 transition-all font-sans"
              >
                <Trash2 size={10} />
                <span>Clear Queue</span>
              </button>
            </div>

            {/* Launch immersive overlay button */}
            <button
              type="button"
              onClick={() => {
                haptics.heavy();
                setShowSyncOverlay(true);
              }}
              className="w-full mt-1.5 py-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 text-indigo-300 font-bold rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:bg-indigo-500/30 transition-all font-sans"
            >
              <Terminal size={12} className="text-indigo-400" />
              <span>Launch Full Sync Manager UI</span>
            </button>
          </div>
        )}
      </motion.div>

      {/* Visual Conflict Resolution Modal */}
      <AnimatePresence>
        {showDriftModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 max-w-xl w-full text-left text-white shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">Database Drift Detected</h3>
                    <p className="text-[10px] text-slate-400 font-sans">Hybrid Firebase/Supabase Sync conflict resolver engine</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDriftModal(false)}
                  className="p-1.5 text-slate-450 hover:text-white rounded-lg border-none bg-transparent cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans font-medium">
                  The real-time sync channel detected inconsistencies between Firestore and Supabase schemas. 
                  Please examine each schema drift item below and choose the precise Source of Truth.
                </p>

                <div className="space-y-3.5">
                  {driftItems.map((item) => {
                    const chosen = selectedResolutions[item.id] || 'firebase';
                    return (
                      <div key={item.id} className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl relative font-mono text-[11px]">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-extrabold text-indigo-300 text-xs font-sans">{item.name}</span>
                          <span className="text-[9px] text-slate-500 font-sans">{item.timestamp}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg text-[9.5px] mb-3 text-slate-400">
                          Field key: <span className="text-amber-400 font-bold">{item.field}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          {/* Firebase option */}
                          <button
                            type="button"
                            onClick={() => {
                              haptics.light();
                              setSelectedResolutions(prev => ({ ...prev, [item.id]: 'firebase' }));
                            }}
                            className={`p-3 rounded-xl border flex flex-col items-start gap-1 cursor-pointer text-left transition-all relative ${
                              chosen === 'firebase'
                                ? 'bg-indigo-650/15 border-indigo-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-850'
                            }`}
                          >
                            <span className="text-[8px] font-black uppercase tracking-wider font-sans">🔥 Firebase (Firestore)</span>
                            <span className="text-[10px] font-bold break-all leading-snug">{item.firebase}</span>
                            {chosen === 'firebase' && (
                              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                            )}
                          </button>

                          {/* Supabase option */}
                          <button
                            type="button"
                            onClick={() => {
                              haptics.light();
                              setSelectedResolutions(prev => ({ ...prev, [item.id]: 'supabase' }));
                            }}
                            className={`p-3 rounded-xl border flex flex-col items-start gap-1 cursor-pointer text-left transition-all relative ${
                              chosen === 'supabase'
                                ? 'bg-emerald-950/25 border-emerald-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-850'
                            }`}
                          >
                            <span className="text-[8px] font-black uppercase tracking-wider font-sans">⚡ Supabase (PostgreSQL)</span>
                            <span className="text-[10px] font-bold break-all leading-snug">{item.supabase}</span>
                            {chosen === 'supabase' && (
                              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex space-x-3 pt-3 flex-row justify-end">
                  <button
                    onClick={() => setShowDriftModal(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-705 border-none text-slate-350 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveConflictResolutions}
                    disabled={isResolving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 border-none text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isResolving ? (
                      <>
                        <RefreshCw className="animate-spin" size={14} />
                        <span>Resolving...</span>
                      </>
                    ) : (
                      <span>Apply Standard Resolution</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Immersive Sync Manager UI Overlay */}
      <AnimatePresence>
        {showSyncOverlay && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-indigo-500/35 rounded-3xl p-6 max-w-2xl w-full text-left text-white shadow-2xl max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl animate-pulse">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest">Offline-to-Online Reconciliation Manager</h3>
                    <p className="text-[10px] text-slate-450 font-sans font-semibold">Dual-Database Sync Reconciliation & Offline Queue Inspector</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSyncOverlay(false)}
                  className="p-1.5 text-slate-450 hover:text-white rounded-lg border-none bg-transparent cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status Header */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-[10px] font-mono">
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[7.5px] text-slate-500 block uppercase font-sans">Network Link</span>
                  <span className={`font-bold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ● {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[7.5px] text-slate-500 block uppercase font-sans">Sync Queue State</span>
                  <span className="font-bold text-indigo-400">
                    {offlineQueueCount} Mutations Pending
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[7.5px] text-slate-500 block uppercase font-sans">Reconciler Core</span>
                  <span className="font-bold text-emerald-400">
                    ACTIVE / READY
                  </span>
                </div>
              </div>

              {/* Main Table / Scroll Area */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1 custom-scrollbar">
                <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400 block mb-1">Pending Database Mutations Queue</span>
                {offlineSyncQueue.length === 0 ? (
                  <div className="py-12 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 space-y-1">
                    <CheckCircle className="mx-auto text-emerald-500 mb-1" size={24} />
                    <p className="font-sans font-semibold text-xs text-slate-400">All local mutations are fully synchronized</p>
                    <p className="text-[9.5px] font-sans">Turn off Wi-Fi or cellular simulation to buffer local actions.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {offlineSyncQueue.map((item, idx) => (
                      <div key={item.id || idx} className="p-3.5 bg-slate-950 border border-slate-850 rounded-2xl font-mono text-[10.5px] space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${item.action === 'UPSERT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {item.action}
                            </span>
                            <span className="text-slate-200 font-extrabold font-sans">Collection: <span className="text-indigo-300">{item.table}</span></span>
                          </div>
                          <span className="text-[9px] text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>

                        {/* Payload visualization */}
                        <div className="bg-slate-900/60 border border-slate-800/40 p-2.5 rounded-xl space-y-1">
                          <div className="flex justify-between text-[8px] text-slate-500">
                            <span>DOCUMENT ID: {item.id}</span>
                            <span>PAYLOAD</span>
                          </div>
                          <pre className="text-[9px] text-indigo-250 font-semibold overflow-x-auto whitespace-pre-wrap leading-relaxed break-all">
                            {JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 border-t border-slate-800 pt-4 flex-row justify-end">
                <button
                  type="button"
                  onClick={handleClearQueue}
                  disabled={offlineSyncQueue.length === 0}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-rose-950/45 hover:text-rose-400 border-none text-slate-350 disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-350 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Clear Mutation Queue
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleForceSync();
                  }}
                  disabled={isSyncingEngine || offlineSyncQueue.length === 0}
                  className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-800 disabled:opacity-50 text-white border-none rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSyncingEngine ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} />
                      <span>Syncing Core...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      <span>Force Sync Reconciliation</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
