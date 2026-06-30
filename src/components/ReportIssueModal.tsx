import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bug, AlertCircle, Sparkles, CheckCircle2, ShieldAlert, Monitor, Wifi, Clock, User, HardDrive } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { haptics } from '../utils/haptics';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
}

export function ReportIssueModal({ isOpen, onClose, activeTab }: ReportIssueModalProps) {
  const [category, setCategory] = useState<'ui_ux' | 'database_sync' | 'performance' | 'other'>('ui_ux');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Capture session diagnostics
  const [diagnostics, setDiagnostics] = useState({
    activeTab,
    uid: auth.currentUser?.uid || 'anonymous',
    email: auth.currentUser?.email || 'N/A',
    emailVerified: auth.currentUser?.emailVerified ? 'Verified' : 'Unverified',
    networkStatus: navigator.onLine ? 'Online' : 'Offline',
    localTime: new Date().toLocaleString(),
    userAgent: navigator.userAgent,
    screenResolution: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
  });

  // Update diagnostics if modal opens or state changes
  useEffect(() => {
    if (isOpen) {
      setDiagnostics({
        activeTab,
        uid: auth.currentUser?.uid || 'anonymous',
        email: auth.currentUser?.email || 'N/A',
        emailVerified: auth.currentUser?.emailVerified ? 'Verified' : 'Unverified',
        networkStatus: navigator.onLine ? 'Online' : 'Offline',
        localTime: new Date().toLocaleString(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio,
      });
      setSuccess(false);
      setDescription('');
      setErrorMsg(null);
    }
  }, [isOpen, activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      haptics.heavy();
      setErrorMsg('Please specify a description of the issue.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    haptics.medium();

    try {
      const issuePayload = {
        userId: auth.currentUser?.uid || 'guest',
        username: auth.currentUser?.displayName || 'Resident',
        email: auth.currentUser?.email || '',
        type: 'bug',
        category,
        subject: `Issue Report: ${category.toUpperCase()} on ${activeTab}`,
        description: description.trim(),
        severity: 'medium',
        createdAt: serverTimestamp(),
        diagnostics: {
          ...diagnostics,
          timestamp: new Date().toISOString()
        },
        status: 'open'
      };

      // Submit directly to 'feedback' collection which has signedIn write allowance
      await addDoc(collection(db, 'feedback'), issuePayload);

      haptics.success();
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err) {
      haptics.heavy();
      console.error(err);
      setErrorMsg('Failed to submit report. Please check connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-2xl">
                <Bug size={20} />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-white">Report an Issue</h3>
                <p className="text-[10px] text-slate-450 dark:text-slate-400 font-medium">Capture system telemetry & send feedback</p>
              </div>
            </div>
            <button
              onClick={() => { haptics.light(); onClose(); }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer transition-colors border-none bg-transparent"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center flex flex-col items-center justify-center space-y-4"
              >
                <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-full animate-bounce">
                  <CheckCircle2 size={44} />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Report Received!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thank you. Your feedback and telemetry details have been logged in Firestore under references for our developer team.
                  </p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Issue Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'ui_ux', label: 'UI / Layout Glitch' },
                      { id: 'database_sync', label: 'Database & Sync' },
                      { id: 'performance', label: 'Performance / Lag' },
                      { id: 'other', label: 'Other Issue' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { haptics.light(); setCategory(cat.id as any); }}
                        className={`py-3 px-4 rounded-2xl text-xs font-bold text-left border cursor-pointer transition-all flex items-center justify-between ${
                          category === cat.id
                            ? 'bg-rose-500/5 border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-850/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {category === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Description & Steps to Reproduce</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us what went wrong, what you expected, and how to trigger it..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-400 dark:placeholder:text-slate-550"
                  />
                </div>

                {/* Diagnostics telemetries overlay */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/80 pb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <Monitor size={10} /> Auto-Captured Session Diagnostics
                    </span>
                    <span className="text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md font-mono">
                      JSON Telemetry Payload
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[9px] font-mono leading-relaxed text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Monitor size={10} className="text-slate-400" />
                      <span>Screen View: <b className="text-indigo-500 dark:text-indigo-400">{diagnostics.activeTab}</b></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wifi size={10} className="text-slate-400" />
                      <span>Network: <b className={diagnostics.networkStatus === 'Online' ? 'text-emerald-500' : 'text-rose-500'}>{diagnostics.networkStatus}</b></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User size={10} className="text-slate-400" />
                      <span className="truncate">UID: <b>{diagnostics.uid.substring(0, 8)}...</b></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={10} className="text-slate-400" />
                      <span className="truncate">Time: <b>{diagnostics.localTime}</b></span>
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl text-[10px] font-bold flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex space-x-3 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { haptics.light(); onClose(); }}
                    className="px-5 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-2xl text-xs font-semibold uppercase tracking-wider cursor-pointer bg-transparent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-sm transition-all shadow-rose-500/10"
                  >
                    {submitting ? 'Submitting...' : 'Submit Issue'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
