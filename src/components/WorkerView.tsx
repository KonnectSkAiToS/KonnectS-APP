/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ServiceBooking, RideRequest } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, MapPin, PoundSterling, Bell, MessageSquare, ToggleLeft, ToggleRight, Search, Settings, AlertCircle, User, Shield, Wrench, CreditCard } from 'lucide-react';

export function WorkerView({ onChat }: { onChat: (id: string, name: string) => void }) {
  const { profile } = useAuth();
  const [activeBookings, setActiveBookings] = useState<ServiceBooking[]>([]);
  const [activeRides, setActiveRides] = useState<RideRequest[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirmOnline, setShowConfirmOnline] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [counterofferBooking, setCounterofferBooking] = useState<ServiceBooking | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterTime, setCounterTime] = useState('');
  const [earningsHistory, setEarningsHistory] = useState<any[]>([]);

  const toggleWorkerMode = async () => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isWorkerMode: !profile.isWorkerMode
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const toggleOnlineStatus = async () => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isOnline: !profile.isOnline
      });
      setShowConfirmOnline(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const updateAutoAccept = async (config: { enabled?: boolean, maxPrice?: number, minPrice?: number, serviceTypes?: string[] }) => {
    if (!profile?.uid) return;
    try {
      const newConfig = { ...profile.autoAcceptConfig, ...config };
      await updateDoc(doc(db, 'users', profile.uid), {
        autoAcceptConfig: newConfig
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleUploadDoc = async () => {
    // Mock upload
    setUploading(true);
    setTimeout(async () => {
      if (!profile?.uid) return;
      await updateDoc(doc(db, 'users', profile.uid), {
        verificationStatus: 'pending',
        verificationStep: 'Awaiting Document Review',
        documents: [...(profile.documents || []), 'id_verification_mock.pdf']
      });
      setUploading(false);
    }, 1500);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile?.uid) return;

    // Listen for bookings that are 'pending' or assigned to this worker
    const q = query(
      collection(db, 'bookings'),
      where('status', 'in', ['pending', 'accepted']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceBooking));
      setActiveBookings(bookings);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const filteredBookings = activeBookings.filter(b => 
    b.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAccept = async (booking: ServiceBooking) => {
    setActionError(null);
    try {
      const docRef = doc(db, 'bookings', booking.id);
      await updateDoc(docRef, {
        workerId: profile?.uid,
        status: 'accepted',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       setActionError("Failed to accept booking. Please try again.");
       handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleReject = async (booking: ServiceBooking) => {
    setActionError(null);
     try {
      const docRef = doc(db, 'bookings', booking.id);
      await updateDoc(docRef, {
        status: 'cancelled', // Or cycle to next
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       setActionError("Failed to decline booking.");
       handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleSendCounter = async () => {
    if (!counterofferBooking) return;
    try {
      const docRef = doc(db, 'bookings', counterofferBooking.id);
      const updates: any = {
        status: 'negotiating',
        updatedAt: serverTimestamp()
      };
      if (counterPrice) updates.suggestedPrice = Number(counterPrice);
      if (counterTime) updates.estimatedCompletionTime = counterTime;
      
      await updateDoc(docRef, updates);
      setCounterofferBooking(null);
      setCounterPrice('');
      setCounterTime('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${counterofferBooking.id}`);
    }
  };

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight mb-1 text-slate-900">Worker Dashboard</h1>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowConfirmOnline(true)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${
                profile?.isOnline ? 'bg-emerald-600 text-white shadow-emerald-600/20' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${profile?.isOnline ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
              <span>{profile?.isOnline ? 'Online & Visible' : 'Set Offline'}</span>
            </button>
            <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest italic opacity-50 px-2">London, UK</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-3 rounded-2xl border transition-all ${showSettings ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 shadow-sm'}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900 rounded-[32px] p-5 text-white shadow-xl shadow-slate-900/10 group cursor-pointer relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-colors" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Today</p>
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-black">£142</span>
            <span className="text-xs text-emerald-400 font-bold">.50</span>
          </div>
          <div className="mt-3 flex items-center space-x-2">
             <div className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md text-[8px] font-black uppercase">+12%</div>
             <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">vs Average</p>
          </div>
        </div>
        <div className={`rounded-[32px] p-5 shadow-xl transition-all border ${
          profile?.verificationStatus === 'verified' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
          profile?.verificationStatus === 'pending' ? 'bg-amber-50 border-amber-100 text-amber-700' : 
          profile?.verificationStatus === 'rejected' ? 'bg-rose-50 border-rose-100 text-rose-700' :
          'bg-indigo-50 border-indigo-100 text-indigo-700'
        }`}>
          <div className="flex items-center space-x-2 mb-1">
             <Shield size={14} className={
               profile?.verificationStatus === 'verified' ? 'text-emerald-500' : 
               profile?.verificationStatus === 'rejected' ? 'text-rose-500' : 'text-current'
             } />
             <p className="text-[10px] font-black uppercase tracking-widest">Identity</p>
          </div>
          <p className="text-sm font-black capitalize tracking-tight line-clamp-1">
            {profile?.verificationStatus || 'Unverified'}
          </p>
          <div className="mt-2 w-full h-1 bg-black/5 rounded-full overflow-hidden">
             <div className="h-full bg-current transition-all" style={{ width: profile?.verificationStatus === 'verified' ? '100%' : profile?.verificationStatus === 'pending' ? '60%' : '20%' }} />
          </div>
        </div>
      </div>

      <div className="mb-8 space-y-4">
        <div className="p-6 bg-white rounded-[40px] border border-slate-100 shadow-sm">
           <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
              <span>Earnings Breakdown</span>
              <PoundSterling size={14} />
           </h3>
           <div className="space-y-4">
              {[
                { label: 'Work Orders', amount: 850, color: 'bg-indigo-500', icon: Wrench, percentage: 66 },
                { label: 'Logistics', amount: 120, color: 'bg-emerald-500', icon: MapPin, percentage: 9 },
                { label: 'Digital Service', amount: 310, color: 'bg-blue-500', icon: MessageSquare, percentage: 25 }
              ].map(cat => (
                <div key={cat.label} className="flex items-center space-x-4">
                   <div className={`p-2 rounded-xl bg-slate-50 text-slate-600`}>
                      <cat.icon size={16} />
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                         <span className="text-xs font-bold text-slate-700">{cat.label}</span>
                         <span className="text-xs font-black">£{cat.amount}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                         <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.percentage}%` }}
                          className={`h-full ${cat.color}`} 
                         />
                      </div>
                   </div>
                </div>
              ))}
           </div>
           
           <div className="mt-8 pt-6 border-t border-slate-50">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Payment History</h4>
              <div className="space-y-3">
                 {[
                   { id: '1', date: 'May 04', type: 'Payout', amount: 420.50, status: 'completed' },
                   { id: '2', date: 'Apr 28', type: 'Wallet Top-up', amount: 35.00, status: 'completed' },
                   { id: '3', date: 'Apr 25', type: 'Payout', amount: 590.20, status: 'completed' }
                 ].map(pay => (
                   <div key={pay.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
                      <div className="flex items-center space-x-3">
                         <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm">
                            <CreditCard size={14} />
                         </div>
                         <div>
                            <p className="text-[11px] font-bold text-slate-900">{pay.type}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{pay.date}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[11px] font-black">£{pay.amount.toFixed(2)}</p>
                         <p className="text-[8px] font-black text-emerald-500 uppercase">Success</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {showConfirmOnline && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center"
          >
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${profile?.isOnline ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {profile?.isOnline ? <X size={32} /> : <Check size={32} />}
            </div>
            <h3 className="text-xl font-bold mb-2">
              {profile?.isOnline ? 'Go Offline?' : 'Ready to work?'}
            </h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              {profile?.isOnline 
                ? 'You will stop receiving new requests until you go online again.' 
                : 'You will become visible to customers nearby and receive live payout opportunities.'}
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowConfirmOnline(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={toggleOnlineStatus}
                className={`flex-1 py-4 text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${profile?.isOnline ? 'bg-slate-900 shadow-slate-900/20' : 'bg-emerald-600 shadow-emerald-600/20'}`}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showSettings && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold">Auto-Accept Logic</h4>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Efficiency Mode</p>
            </div>
            <button 
              onClick={() => updateAutoAccept({ enabled: !profile?.autoAcceptConfig?.enabled })}
              className={`p-1 rounded-lg transition-all ${profile?.autoAcceptConfig?.enabled ? 'text-emerald-500' : 'text-slate-300'}`}
            >
              {profile?.autoAcceptConfig?.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>

          <AnimatePresence>
            {profile?.autoAcceptConfig?.enabled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4 border-t border-slate-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Min Price (£)</label>
                    <input 
                      type="number" 
                      value={profile.autoAcceptConfig.minPrice || 0}
                      onChange={(e) => updateAutoAccept({ minPrice: Number(e.target.value) })}
                      className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Max Price (£)</label>
                    <input 
                      type="number" 
                      value={profile.autoAcceptConfig.maxPrice || 50}
                      onChange={(e) => updateAutoAccept({ maxPrice: Number(e.target.value) })}
                      className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand"
                    />
                  </div>
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Service Types</label>
                   <div className="flex flex-wrap gap-2">
                     {['fetch', 'plumber', 'mechanic'].map(type => (
                       <button
                         key={type}
                         onClick={() => {
                            const types = profile.autoAcceptConfig?.serviceTypes || [];
                            const newTypes = types.includes(type) ? types.filter(t => t !== type) : [...types, type];
                            updateAutoAccept({ serviceTypes: newTypes });
                         }}
                         className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                           profile.autoAcceptConfig?.serviceTypes?.includes(type) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-400'
                         }`}
                       >
                         {type}
                       </button>
                     ))}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {actionError && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <AlertCircle size={18} />
            <span className="text-xs font-bold">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-rose-100 rounded-lg">
            <X size={16} />
          </button>
        </motion.div>
      )}

      <div className="space-y-6">
        {/* Verification Status Card */}
        {profile?.verificationStatus !== 'verified' && (
          <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                   <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Shield size={20} />
                   </div>
                   <div>
                      <h4 className="text-sm font-bold">Worker Verification</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {profile?.verificationStatus === 'pending' ? 'Locked (Reviewing)' : 'Action Required'}
                      </p>
                   </div>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase ${
                  profile?.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  {profile?.verificationStatus || 'Unverified'}
                </span>
             </div>

             {profile?.verificationStatus !== 'pending' ? (
               <div className="space-y-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed italic">To accept high-value service requests, we need to verify your Right to Work & Identity documents.</p>
                  <button 
                    onClick={handleUploadDoc}
                    disabled={uploading}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Shield size={14} />
                        <span>Upload Documents</span>
                      </>
                    )}
                  </button>
               </div>
             ) : (
               <div className="p-3 bg-slate-50 rounded-xl flex items-center space-x-3">
                  <Clock size={16} className="text-amber-500" />
                  <span className="text-[10px] font-bold text-slate-600">{profile?.verificationStep || 'Verifying your identity...'}</span>
               </div>
             )}
          </section>
        )}

        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Active Requests</h3>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-50 border-none rounded-full text-[10px] focus:ring-2 focus:ring-brand outline-none"
              />
            </div>
          </div>

          <AnimatePresence>
            {filteredBookings.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <Bell size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">
                  {searchTerm ? `No results for "${searchTerm}"` : 'Waiting for requests in London...'}
                </p>
              </div>
            ) : (
              filteredBookings.map((booking) => {
                const timeLeft = booking.expiresAt ? Math.max(0, Math.floor((booking.expiresAt.toMillis() - currentTime) / 1000)) : 0;
                const isTimedOut = timeLeft <= 0 && booking.status === 'pending';
                const isAccepted = booking.status === 'accepted';

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-5 mb-4 bg-white rounded-3xl border ${
                      isAccepted ? 'border-emerald-100 bg-emerald-50/10' : 
                      isTimedOut ? 'border-rose-200 bg-rose-50' : 
                      'border-slate-100'
                    } shadow-sm transition-all`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-bold text-sm tracking-tight capitalize">{booking.serviceType}</h4>
                          {isAccepted && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-bold uppercase rounded-md">Accepted</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 text-slate-400">
                           <MapPin size={10} />
                           <p className="text-[10px] lowercase truncate max-w-[150px]">{booking.pickupLocation?.address || 'London'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {!isAccepted && (
                          <div className={`flex flex-col items-end space-y-1`}>
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg ${timeLeft < 30 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                              <Clock size={12} />
                              <span className="text-[10px] font-bold">{timeLeft}s</span>
                            </div>
                            {booking.status === 'negotiating' && (
                              <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest bg-amber-50 px-1.5 py-0.5 rounded">Negotiating</span>
                            )}
                          </div>
                        )}
                         {isAccepted && (
                           <div className="flex flex-col space-y-1">
                              <div className="text-[10px] font-bold text-slate-900 flex items-center space-x-1 bg-white px-2 py-1 rounded-lg border border-slate-100">
                                 <User size={10} className="text-slate-400" />
                                 <span>Customer #{booking.customerId.slice(-4)}</span>
                              </div>
                              <div className="flex items-center space-x-1 justify-end">
                                 <span className="text-amber-500 font-bold text-[10px]">4.9 ★</span>
                                 <span className="text-[8px] text-slate-400 uppercase font-bold">(12)</span>
                              </div>
                           </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mb-4 line-clamp-2 italic">"{booking.description}"</p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                       <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer Offer</p>
                          <p className="text-sm font-black text-slate-900">£{booking.suggestedPrice || booking.price}</p>
                       </div>
                       <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Service Fee</p>
                          <p className="text-sm font-black text-rose-500">12%</p>
                       </div>
                    </div>

                    {isAccepted && (
                      <div className="mb-4 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                          <span>Job Details</span>
                          <span className="text-emerald-500">Active</span>
                        </div>
                        <div className="space-y-1.5">
                           <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Pickup</span>
                              <span className="text-xs font-bold text-slate-900">{booking.pickupLocation?.address}</span>
                           </div>
                           <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">Dropoff</span>
                              <span className="text-xs font-bold text-slate-900">{booking.dropoffLocation?.address}</span>
                           </div>
                        </div>
                      </div>
                    )}

                    {!isAccepted ? (
                      <div className="flex space-x-2">
                         <button 
                          disabled={isTimedOut}
                          onClick={() => handleAccept(booking)}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1 disabled:opacity-50 active:scale-95 transition-transform"
                        >
                           <Check size={14} />
                           <span>Accept</span>
                         </button>
                         <button 
                          disabled={isTimedOut}
                          onClick={() => setCounterofferBooking(booking)}
                          className="px-3 py-3 bg-brand/10 text-brand rounded-xl text-xs font-bold active:scale-95 transition-transform"
                         >
                            Counter
                         </button>
                         <button 
                           onClick={() => handleReject(booking)}
                           className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 active:scale-95 transition-transform"
                         >
                           <X size={14} />
                           <span>Decline</span>
                         </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => onChat(booking.customerId, 'Customer')}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-transform"
                      >
                        <MessageSquare size={14} />
                        <span>Open Safe Chat</span>
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}

          </AnimatePresence>
        </section>
      </div>

      <AnimatePresence>
        {counterofferBooking && (
          <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
             >
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Counteroffer</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{counterofferBooking.serviceType}</p>
                   </div>
                   <button onClick={() => setCounterofferBooking(null)} className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                      <X size={20} />
                   </button>
                </div>

                <div className="space-y-6">
                   <div className="p-6 bg-slate-50 rounded-[32px] text-center border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Customer suggested</p>
                      <p className="text-3xl font-black text-slate-900">£{counterofferBooking.suggestedPrice || counterofferBooking.price}</p>
                   </div>

                   <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Suggest your professional price</label>
                       <div className="relative">
                          <PoundSterling className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                          <input 
                            type="number"
                            value={counterPrice}
                            onChange={(e) => setCounterPrice(e.target.value)}
                            placeholder={(counterofferBooking.suggestedPrice || counterofferBooking.price || 0).toString()}
                            className="w-full pl-14 pr-6 py-5 bg-slate-50 rounded-3xl font-black text-2xl outline-none focus:ring-4 focus:ring-brand/10 transition-all"
                          />
                       </div>
                   </div>

                   <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Estimated Completion Time</label>
                       <div className="relative">
                          <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                          <input 
                            value={counterTime}
                            onChange={(e) => setCounterTime(e.target.value)}
                            placeholder={counterofferBooking.estimatedCompletionTime || "2 hours"}
                            className="w-full pl-14 pr-6 py-5 bg-slate-50 rounded-3xl font-black text-lg outline-none focus:ring-4 focus:ring-brand/10 transition-all"
                          />
                       </div>
                   </div>

                   <button 
                    onClick={handleSendCounter}
                    className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all text-[11px]"
                   >
                      Send Pro Suggestion
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
