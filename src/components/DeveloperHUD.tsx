import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { devHudTracker } from '../utils/devHudTracker';
import { Terminal, Database, Activity, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { haptics } from '../utils/haptics';

export function DeveloperHUD() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('dev_hud_active') === 'true');
  const [stats, setStats] = useState(() => devHudTracker.getStats());
  const [showDriftModal, setShowDriftModal] = useState(false);
  const [selectedResolutions, setSelectedResolutions] = useState<Record<string, 'firebase' | 'supabase'>>({});
  const [isResolving, setIsResolving] = useState(false);

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

        {/* Rendering Metrics */}
        <div className="space-y-1 mb-3">
          <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Rendering Performance</div>
          <div className="flex justify-between items-center text-[11px]">
            <span>Framerate (FPS):</span>
            <span className={`font-bold ${stats.fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>{stats.fps} FPS</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span>Render Overhead:</span>
            <span className="text-indigo-300">{stats.renderTimeMs} ms</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span>Dynamic Memory:</span>
            <span className="text-[#38bdf8]">{stats.memoryLoadMb} MB</span>
          </div>
        </div>

        {/* Hybrid Operations Block */}
        <div className="space-y-1 mb-3">
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

        {/* Conflicts Alert Area */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleManualResolveConflict}
          className="w-full mt-2 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-[9px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-500/30 transition-all font-sans"
        >
          <ShieldAlert size={12} className="shrink-0" />
          <span>Simulate Conflict Drift</span>
        </motion.button>
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
    </>
  );
}
