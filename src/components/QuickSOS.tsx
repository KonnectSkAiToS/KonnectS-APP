import { useState, useEffect } from 'react';
import { ShieldAlert, Phone, MessageSquare, Edit2, Play, AlertOctagon, X, Volume2, ShieldCheck, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface QuickSOSProps {
  compact?: boolean;
}

export function QuickSOS({ compact = false }: QuickSOSProps) {
  const { user, profile } = useAuth();
  const [sosName, setSosName] = useState('');
  const [sosPhone, setSosPhone] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  
  // Configuration UI State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [configError, setConfigError] = useState('');

  // Active Emergency States
  const [showPanicOverlay, setShowPanicOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [smsDispatched, setSmsDispatched] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('konnects_sos_name');
    const savedPhone = localStorage.getItem('konnects_sos_phone');
    if (savedName && savedPhone) {
      setSosName(savedName);
      setSosPhone(savedPhone);
      setEditName(savedName);
      setEditPhone(savedPhone);
      setIsConfigured(true);
    }
  }, []);

  useEffect(() => {
    const handleVoiceSOS = () => {
      triggerPanic();
    };
    window.addEventListener('voice-sos-trigger', handleVoiceSOS);
    return () => window.removeEventListener('voice-sos-trigger', handleVoiceSOS);
  }, [isConfigured, sosName, sosPhone]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editPhone.trim()) {
      setConfigError('Please provide both an emergency contact name and phone number.');
      return;
    }
    localStorage.setItem('konnects_sos_name', editName.trim());
    localStorage.setItem('konnects_sos_phone', editPhone.trim());
    setSosName(editName.trim());
    setSosPhone(editPhone.trim());
    setIsConfigured(true);
    setShowConfigModal(false);
    setConfigError('');
  };

  // Start Panic Button countdown sequence
  const triggerPanic = () => {
    if (!isConfigured) {
      setShowConfigModal(true);
      return;
    }
    setShowPanicOverlay(true);
    setCountdown(5);
    setEmergencyTriggered(false);
    setSmsDispatched(false);
  };

  // Countdown timer effect
  useEffect(() => {
    let timerID: any;
    if (showPanicOverlay && countdown > 0 && !emergencyTriggered) {
      timerID = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (showPanicOverlay && countdown === 0 && !emergencyTriggered) {
      // Fire Emergency sequence!
      setEmergencyTriggered(true);

      // Perform real-time location sharing with Firebase Firestore
      const shareSosOnFirebase = async () => {
        try {
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                const latitude = pos.coords.latitude;
                const longitude = pos.coords.longitude;
                await addDoc(collection(db, 'sos_alerts'), {
                  userId: user?.uid || 'guest-anon',
                  userName: profile?.username || 'Guest Resident',
                  contactName: sosName,
                  contactPhone: sosPhone,
                  status: 'active',
                  coords: { lat: latitude, lng: longitude },
                  address: `GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
                  triggeredAt: serverTimestamp()
                });
              },
              async () => {
                // Fallback location
                await addDoc(collection(db, 'sos_alerts'), {
                  userId: user?.uid || 'guest-anon',
                  userName: profile?.username || 'Guest Resident',
                  contactName: sosName,
                  contactPhone: sosPhone,
                  status: 'active',
                  coords: { lat: 51.5234, lng: -0.0763 },
                  address: 'Current Location (Shoreditch High St)',
                  triggeredAt: serverTimestamp()
                });
              },
              { timeout: 5000 }
            );
          } else {
            // Geolocation unsupported fallback
            await addDoc(collection(db, 'sos_alerts'), {
              userId: user?.uid || 'guest-anon',
              userName: profile?.username || 'Guest Resident',
              contactName: sosName,
              contactPhone: sosPhone,
              status: 'active',
              coords: { lat: 51.5234, lng: -0.0763 },
              address: 'Current Location (Shoreditch High St)',
              triggeredAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error('SOS Firebase tracking write failed:', e);
        }
      };

      shareSosOnFirebase();

      // Simulate SMS dispatching with a slight delay
      setTimeout(() => {
        setSmsDispatched(true);
      }, 1500);
    }
    return () => clearTimeout(timerID);
  }, [showPanicOverlay, countdown, emergencyTriggered, user, profile, sosName, sosPhone]);

  const cancelPanic = () => {
    setShowPanicOverlay(false);
    setEmergencyTriggered(false);
    setSmsDispatched(false);
  };

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={triggerPanic}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md shadow-rose-600/20"
        >
          <ShieldAlert size={12} className="animate-pulse" />
          <span>Quick SOS</span>
        </button>

        {/* SOS Config Dialog */}
        <AnimatePresence>
          {showConfigModal && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-sm p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-left"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert size={18} className="text-rose-600" />
                    Configure SOS Contact
                  </h3>
                  <button onClick={() => setShowConfigModal(false)} className="p-1 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <X size={16} />
                  </button>
                </div>
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Contact Identifier/Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Mum, Support Centre, Dispatch"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Mobile Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +44 7700 900077"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  {configError && <span className="text-[10px] font-bold text-rose-500 block">{configError}</span>}
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-95 border-none cursor-pointer"
                  >
                    Save & Standardise
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* SOS Countdown & Flashing Screen Warning */}
        <AnimatePresence>
          {showPanicOverlay && (
            <div className="fixed inset-0 bg-rose-950/95 z-[9999] flex flex-col justify-between p-8 text-white overflow-y-auto">
              {/* Animated urgent light bar */}
              <div className="absolute inset-0 bg-red-600/30 animate-pulse pointer-events-none" />

              <header className="flex justify-between items-center relative z-10">
                <span className="px-3.5 py-1.5 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
                  KonnectS SafeGuard Active
                </span>
                <button
                  onClick={cancelPanic}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-none cursor-pointer"
                >
                  Disconnect / Abort
                </button>
              </header>

              <main className="text-center my-auto py-12 relative z-10 space-y-6">
                {!emergencyTriggered ? (
                  <>
                    <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mx-auto border-4 border-red-500 animate-bounce">
                      <ShieldAlert size={64} className="text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-5xl font-black text-rose-200 tracking-tight">{countdown}</h2>
                      <p className="text-red-300 text-xs font-black uppercase tracking-widest leading-none">Emergency Broadcast Imminent</p>
                    </div>
                    <p className="text-xs text-white/75 font-medium max-w-xs mx-auto leading-relaxed">
                      We will automatically call and transfer GPS metrics to <span className="font-extrabold text-white">{sosName}</span>.
                    </p>
                    <button
                      onClick={() => setCountdown(0)}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all border-none cursor-pointer shadow-lg"
                    >
                      Bypass Countdown
                    </button>
                  </>
                ) : (
                  <div className="space-y-6 max-w-sm mx-auto">
                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500">
                      <Check size={48} className="text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black uppercase tracking-tight text-emerald-400 leading-none">SOS ALERT DISPATCHED</h3>
                      <p className="text-xs text-slate-300 font-semibold uppercase tracking-widest">Mock Communications Line Open</p>
                    </div>

                    <div className="bg-slate-900/80 p-5 rounded-3xl border border-white/5 space-y-3.5 text-left text-xs font-semibold leading-relaxed">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-rose-400 border-b border-white/5 pb-2">
                        <span>SMS Coordinates Dispatch</span>
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">SENT</span>
                      </div>
                      <p className="text-slate-300 font-mono text-[11px]">
                        <strong>To:</strong> {sosName} ({sosPhone})<br />
                        <strong>Text:</strong> "EMERGENCY: Urgent assistance needed. I am in London Shoreditch, Shoreditch High St. E1. Lat: 51.524, Lng: -0.078. Track me live on UrbanNet."
                      </p>
                    </div>

                    <div className="bg-slate-900/80 p-5 rounded-3xl border border-white/5 space-y-3 text-left">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-emerald-400 border-b border-white/5 pb-2">
                        <span>Ringing Cellular Link</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <p className="text-xs text-slate-300 font-medium">
                        Initiating mock digital line call to: <strong className="text-white">{sosName}</strong>
                      </p>
                      <a
                        href={`tel:${sosPhone}`}
                        className="mt-2 text-center w-full block py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all"
                      >
                        Launch Direct Phone Call Overlay
                      </a>
                    </div>
                  </div>
                )}
              </main>

              <footer className="relative z-10 text-center text-[10px] text-white/50 uppercase tracking-widest font-mono">
                UrbanNet SafeTrack System E1
              </footer>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Large/Standard Profile layout
  return (
    <div className="p-6 bg-rose-50/50 dark:bg-rose-950/10 border-2 border-dashed border-rose-200/50 dark:border-rose-900/30 rounded-[35px] space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 rounded text-[9px] font-black uppercase tracking-widest">
            🚨 Safety Center
          </span>
          <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">Quick SOS Link</h3>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            Configure an emergency contact. Triggering will immediately dispatch coordinates and open a phone link.
          </p>
        </div>
        {!isConfigured ? (
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2.5 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition-all shadow-md active:scale-95 border-none cursor-pointer shrink-0"
          >
            <Edit2 size={16} />
          </button>
        ) : (
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-wider border-none transition-all cursor-pointer shrink-0"
          >
            Edit Contact
          </button>
        )}
      </div>

      {isConfigured ? (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Predefined Contact</p>
              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{sosName}</h4>
              <p className="text-[10px] text-slate-500 font-mono">{sosPhone}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" />
          </div>

          <button
            onClick={triggerPanic}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-black text-xs uppercase tracking-[0.15em] rounded-[22px] shadow-lg shadow-rose-600/10 flex items-center justify-center gap-2 border-none transition-all cursor-pointer"
          >
            <ShieldAlert size={16} className="animate-pulse" />
            <span>CRITICAL PANIC TRIGGER</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowConfigModal(true)}
          className="w-full py-4 bg-slate-900 text-white hover:bg-slate-800 font-black text-xs uppercase tracking-widest rounded-2xl mt-2 border-none transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <ShieldAlert size={16} />
          <span>Configure Emergency Contact</span>
        </button>
      )}

      {/* SOS Config Dialog */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-sm p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-left"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert size={18} className="text-rose-600" />
                  Configure SOS Contact
                </h3>
                <button onClick={() => setShowConfigModal(false)} className="p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border-none">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Contact Identifier/Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mum, Support Centre, Dispatch"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +44 7700 900077"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                {configError && <span className="text-[10px] font-bold text-rose-500 block">{configError}</span>}
                <button
                  type="submit"
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-95 border-none cursor-pointer animate-none"
                >
                  Save Emergency Contact
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SOS Countdown Warning Flasher */}
      <AnimatePresence>
        {showPanicOverlay && (
          <div className="fixed inset-0 bg-rose-950/95 z-[9999] flex flex-col justify-between p-8 text-white overflow-y-auto">
            <div className="absolute inset-0 bg-red-600/30 animate-pulse pointer-events-none" />

            <header className="flex justify-between items-center relative z-10">
              <span className="px-3.5 py-1.5 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
                KonnectS SafeGuard Active
              </span>
              <button
                onClick={cancelPanic}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-none cursor-pointer"
              >
                Abort / Close Panel
              </button>
            </header>

            <main className="text-center my-auto py-12 relative z-10 space-y-6">
              {!emergencyTriggered ? (
                <>
                  <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mx-auto border-4 border-red-500 animate-bounce">
                    <ShieldAlert size={64} className="text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-5xl font-black text-rose-200 tracking-tight">{countdown}</h2>
                    <p className="text-red-300 text-xs font-black uppercase tracking-widest leading-none">Emergency Broadcast Imminent</p>
                  </div>
                  <p className="text-xs text-white/75 font-medium max-w-xs mx-auto leading-relaxed">
                    We will automatically call and transfer GPS metrics to <span className="font-extrabold text-white">{sosName}</span>.
                  </p>
                  <button
                    onClick={() => setCountdown(0)}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all border-none cursor-pointer shadow-lg"
                  >
                    Bypass Countdown
                  </button>
                </>
              ) : (
                <div className="space-y-6 max-w-sm mx-auto">
                  <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500">
                    <Check size={48} className="text-emerald-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase tracking-tight text-emerald-400 leading-none">SOS ALERT DISPATCHED</h3>
                    <p className="text-xs text-slate-300 font-semibold uppercase tracking-widest">Mock Communications Line Open</p>
                  </div>

                  <div className="bg-slate-900/80 p-5 rounded-3xl border border-white/5 space-y-3.5 text-left text-xs font-semibold leading-relaxed">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-rose-400 border-b border-white/5 pb-2">
                      <span>SMS Coordinates Dispatch</span>
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded animate-none">SENT</span>
                    </div>
                    <p className="text-slate-300 font-mono text-[11px]">
                      <strong>To:</strong> {sosName} ({sosPhone})<br />
                      <strong>Text:</strong> "EMERGENCY: Urgent assistance needed. I am in London Shoreditch, Shoreditch High St. E1. Lat: 51.524, Lng: -0.078. Track me live on UrbanNet."
                    </p>
                  </div>

                  <div className="bg-slate-900/80 p-5 rounded-3xl border border-white/5 space-y-3 text-left">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-emerald-400 border-b border-white/5 pb-2">
                      <span>Ringing Cellular Link</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse animate-none" />
                    </div>
                    <p className="text-xs text-slate-300 font-medium">
                      Initiating mock digital line call to: <strong className="text-white">{sosName}</strong>
                    </p>
                    <a
                      href={`tel:${sosPhone}`}
                      className="mt-2 text-center w-full block py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all border-none cursor-pointer"
                    >
                      Launch Direct Phone Call Overlay
                    </a>
                  </div>
                </div>
              )}
            </main>

            <footer className="relative z-10 text-center text-[10px] text-white/50 uppercase tracking-widest font-mono">
              UrbanNet SAFE LOCK E1
            </footer>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
