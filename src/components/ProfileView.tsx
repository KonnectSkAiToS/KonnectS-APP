/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User, Settings, Shield, Award, CreditCard, Wrench, FileText, Share2, LogOut, Camera, ChevronRight, Copy, Check, MessageCircle, Mail, MapPin, MessageSquare, Heart, Trash2, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayRemove, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ServiceBooking, MarketplaceItem, WorkerType } from '../types';

type SubView = 'main' | 'history' | 'receipts' | 'rewards' | 'verification' | 'settings' | 'invite' | 'edit' | 'saved' | 'worker_setup';

export function ProfileView() {
  const { user, profile, logout } = useAuth();
  const [view, setView] = useState<SubView>('main');
  const [history, setHistory] = useState<ServiceBooking[]>([]);
  const [savedItems, setSavedItems] = useState<MarketplaceItem[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Edit Profile State
  const [editingName, setEditingName] = useState(profile?.username || '');
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [mobileNumber, setMobileNumber] = useState(profile?.mobileNumber || '');
  const [isOnline, setIsOnline] = useState(profile?.isOnline || false);
  const [editingWorkerType, setEditingWorkerType] = useState<WorkerType>(profile?.workerType || 'other');

  useEffect(() => {
    if (profile) {
      setIsOnline(profile.isOnline || false);
      setEditingWorkerType(profile.workerType || 'other');
    }
  }, [profile]);

  useEffect(() => {
    if (view === 'history' || view === 'receipts') {
      fetchHistory();
    } else if (view === 'saved') {
      fetchSavedItems();
    }
  }, [view, profile?.savedItems]);

  const fetchHistory = async () => {
    if (!profile?.uid) return;
    try {
      const q = query(
        collection(db, 'bookings'),
        where('customerId', '==', profile.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceBooking)));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'bookings');
    }
  };

  const fetchSavedItems = async () => {
    if (!profile?.savedItems?.length) {
      setSavedItems([]);
      return;
    }
    try {
      const q = query(collection(db, 'items'));
      const snap = await getDocs(q);
      const allItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceItem));
      setSavedItems(allItems.filter(i => profile.savedItems?.includes(i.id)));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'items');
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        username: editingName,
        firstName,
        lastName,
        mobileNumber,
        workerType: editingWorkerType,
        updatedAt: serverTimestamp()
      });
      setView('main');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const removeSavedItem = async (itemId: string) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        savedItems: arrayRemove(itemId)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpdateWorkerType = async (type: WorkerType) => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        workerType: type,
        isWorker: true,
        verificationStatus: 'in_progress',
        verificationStep: 'Upload Identity Documents'
      });
      setView('verification');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleToggleOnline = async () => {
    if (!profile?.uid) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isOnline: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
      setIsOnline(!newStatus); // Revert on error
    }
  };

  const menuItems = [
    { icon:Award, label: 'Rewards & Referrals', value: 'rewards', color: 'bg-amber-50 text-amber-600' },
    { icon: Heart, label: 'Saved Marketplace Items', value: 'saved', color: 'bg-rose-50 text-rose-600' },
    { icon: Wrench, label: 'Worker Configuration', value: 'worker_setup', color: 'bg-indigo-50 text-indigo-600' },
    { icon: FileText, label: 'Maintenance & Service History', value: 'history', color: 'bg-indigo-50 text-slate-600' },
    { icon: CreditCard, label: 'Receipts & Invoices', value: 'receipts', color: 'bg-emerald-50 text-emerald-600' },
    { icon: Shield, label: 'Worker Verification', value: 'verification', color: 'bg-blue-50 text-blue-600' },
    { icon: Settings, label: 'App Settings', value: 'settings', color: 'bg-slate-50 text-slate-600' },
    { icon: Share2, label: 'Invite Friends', value: 'invite', color: 'bg-emerald-50 text-emerald-600' },
  ];

  const renderHistory = (isReceipts = false) => (
    <div className="space-y-4">
      {history.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 text-slate-400">
           No {isReceipts ? 'receipts' : 'history'} found.
        </div>
      ) : (
        history.map(h => (
          <div key={h.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-slate-50 rounded-xl text-slate-400">
                {isReceipts ? <CreditCard size={18} /> : <Wrench size={18} />}
              </div>
              <div>
                <p className="font-bold text-sm tracking-tight capitalize">{h.serviceType}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(h.createdAt?.toMillis()).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-sm text-slate-900">£{h.price || '25.00'}</p>
              <button className="text-[10px] font-bold text-brand uppercase tracking-widest">View PDF</button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen relative">
      <AnimatePresence mode="wait">
        {view === 'main' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Header */}
               <header className="mb-10 text-center relative">
               <div className="relative inline-block mb-4">
                 <div className="w-24 h-24 bg-slate-100 rounded-[40px] flex items-center justify-center text-slate-300 shadow-xl shadow-slate-200/50">
                   {profile?.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full object-cover rounded-[40px]" alt="Avatar" /> : <User size={48} />}
                 </div>
                 {profile?.verificationStatus === 'verified' && (
                    <div className="absolute top-0 -right-2 bg-white rounded-full p-1 shadow-lg">
                       <Shield size={20} className="text-emerald-500 fill-emerald-500/10" />
                    </div>
                 )}
                 <button 
                   onClick={() => setView('edit')}
                   className="absolute -bottom-1 -right-1 p-2.5 bg-slate-900 text-white rounded-2xl border-4 border-slate-50 shadow-lg active:scale-90 transition-all"
                 >
                   <Camera size={16} />
                 </button>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center space-x-2">
                   <h1 className="text-2xl font-bold tracking-tight mb-1">{profile?.username}</h1>
                   {profile?.isWorker && (
                      <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                        profile?.isOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                         {profile?.isOnline ? 'Online' : 'Offline'}
                      </div>
                   )}
                </div>
                <p className="text-slate-400 text-xs font-medium">{profile?.email}</p>
              </div>
              <div className="mt-4 flex items-center justify-center space-x-3">
                 <div className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-bold flex items-center space-x-2">
                    <Award size={14} />
                    <span>{profile?.rewardsPoints} Points</span>
                 </div>
                 <div className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                    ID: {profile?.uid.slice(-6).toUpperCase()}
                 </div>
              </div>
            </header>

            {/* Menu */}
            <div className="space-y-3">
              {menuItems.map((item, i) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView(item.value as SubView)}
                  className="w-full p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group h-16"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-2xl ${item.color}`}>
                      <item.icon size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{item.label}</span>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                </motion.button>
              ))}
              
              <button 
                onClick={logout}
                className="w-full p-5 bg-rose-50 text-rose-600 rounded-3xl border border-rose-100 flex items-center justify-center space-x-3 font-black text-xs uppercase tracking-widest mt-8 h-18 active:scale-95 transition-all"
              >
                <LogOut size={20} />
                <span>Log Out of KonnectS</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="min-h-[80vh]">
             <div className="flex items-center space-x-4 mb-8">
                <button onClick={() => setView('main')} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-90 transition-all">
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold capitalize">
                  {view.replace('-', ' ')}
                </h2>
             </div>

             {/* Dynamic Content based on view */}
             {view === 'edit' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">First Name</label>
                        <input 
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Last Name</label>
                        <input 
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Display Name</label>
                      <input 
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mobile Number</label>
                      <input 
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="+44 7700 900XXX"
                        className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                      />
                   </div>
                   {profile?.isWorker && (
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Worker Speciality</label>
                         <select 
                           value={editingWorkerType}
                           onChange={(e) => setEditingWorkerType(e.target.value as WorkerType)}
                           className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm appearance-none"
                         >
                            {['plumber', 'mechanic', 'doctor', 'electrician', 'cleaner', 'cab_owner', 'other'].map(t => (
                              <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
                            ))}
                         </select>
                      </div>
                   )}
                   <button 
                    onClick={handleUpdateProfile}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/10 active:scale-95 transition-all text-xs uppercase tracking-widest"
                   >
                     Update Profile
                   </button>
                </div>
             )}

             {(view === 'history' || view === 'receipts') && renderHistory(view === 'receipts')}

             {view === 'saved' && (
               <div className="space-y-4">
                 {savedItems.length === 0 ? (
                   <div className="text-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 text-slate-400">
                      No saved items yet.
                   </div>
                 ) : (
                   savedItems.map(item => (
                     <div key={item.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between group">
                       <div className="flex items-center space-x-3">
                         <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden">
                           {item.images?.[0] ? <img src={item.images[0]} className="w-full h-full object-cover" /> : <ShoppingBag className="w-full h-full p-3 text-slate-200" />}
                         </div>
                         <div>
                            <p className="font-bold text-sm tracking-tight">{item.title}</p>
                            <p className="text-[10px] font-black text-brand uppercase tracking-widest">£{item.price}</p>
                         </div>
                       </div>
                       <button 
                        onClick={() => removeSavedItem(item.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                       >
                         <Trash2 size={18} />
                       </button>
                     </div>
                   ))
                 )}
               </div>
             )}

             {view === 'rewards' && (
                <div className="space-y-6">
                   <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[40px] p-8 text-white text-center shadow-xl shadow-amber-500/20">
                      <Award size={48} className="mx-auto mb-4" />
                      <h4 className="text-4xl font-black mb-1">{profile?.rewardsPoints}</h4>
                      <p className="text-sm font-bold uppercase tracking-widest opacity-80">Lifetime Points</p>
                   </div>
                   <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                      <h4 className="font-bold mb-4">Referral Bonus</h4>
                      <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border-2 border-dashed border-slate-200">
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your Unique Code</p>
                            <p className="text-xl font-black tracking-tighter">{profile?.referralCode}</p>
                         </div>
                         <button 
                          onClick={() => copyToClipboard(profile?.referralCode || '')}
                          className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-brand active:scale-90 transition-all"
                         >
                           {copySuccess ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                         </button>
                      </div>
                   </div>
                </div>
             )}

             {view === 'invite' && (
                <div className="space-y-8 text-center pt-10">
                   <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full mx-auto flex items-center justify-center">
                      <Share2 size={42} />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black mb-2 tracking-tight">Earn together</h3>
                      <p className="text-sm text-slate-500 px-6">Invite friends to KonnectS and you both get £10 credit when they complete their first service.</p>
                   </div>
                   <div className="space-y-4">
                      <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl font-mono text-sm break-all">
                        <span className="flex-1 opacity-60">konnects.co/ref/{profile?.referralCode}</span>
                        <button onClick={() => copyToClipboard(`https://konnects.co/ref/${profile?.referralCode}`)} className="p-2 bg-white rounded-lg shadow-sm">
                           <Copy size={16} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4">
                        {[
                          { icon: MessageCircle, label: 'WhatsApp' },
                          { icon: Mail, label: 'Email' },
                          { icon: MessageSquare, label: 'SMS' },
                          { icon: Share2, label: 'Social' }
                        ].map((s, i) => (
                           <button key={i} className="flex flex-col items-center space-y-2 group">
                              <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center group-active:scale-90 transition-all">
                                 <s.icon size={20} className="text-slate-600" />
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</span>
                           </button>
                        ))}
                      </div>
                   </div>
                </div>
             )}

             {view === 'worker_setup' && (
               <div className="space-y-6">
                 <div className="p-6 bg-slate-900 border border-slate-800 rounded-[40px] text-white overflow-hidden relative">
                    <Wrench className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32" />
                    <h3 className="text-xl font-black mb-1">Set Worker Identity</h3>
                    <p className="text-xs text-slate-400">Choose your primary skill to start receiving relevant jobs.</p>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-3">
                   {['plumber', 'mechanic', 'doctor', 'electrician', 'cleaner', 'cab_owner', 'other'].map((type) => (
                     <button
                      key={type}
                      onClick={() => handleUpdateWorkerType(type as WorkerType)}
                      className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${
                        profile?.workerType === type 
                        ? 'bg-brand border-brand text-white shadow-xl shadow-brand/20' 
                        : 'bg-white border-slate-100 text-slate-700 hover:border-slate-300'
                       }`}
                     >
                       <span className="font-black uppercase tracking-widest text-[10px]">{type.replace('_', ' ')}</span>
                       {profile?.workerType === type && <Check size={18} />}
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {view === 'verification' && (
                <div className="space-y-8">
                   <div className="text-center">
                     <div className={`w-20 h-20 rounded-[30px] mx-auto flex items-center justify-center mb-6 shadow-lg ${
                       profile?.verificationStatus === 'verified' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 
                       profile?.verificationStatus === 'pending' ? 'bg-amber-500 text-white shadow-amber-500/20' : 
                       profile?.verificationStatus === 'rejected' ? 'bg-rose-500 text-white shadow-rose-500/20' :
                       'bg-slate-200 text-white shadow-slate-200/20'
                     }`}>
                       <Shield size={32} />
                     </div>
                     <h3 className="text-xl font-black">{
                       profile?.verificationStatus === 'verified' ? 'You are Verified' : 
                       profile?.verificationStatus === 'pending' ? 'Verification Pending' : 
                       profile?.verificationStatus === 'rejected' ? 'Verification Rejected' :
                       'Process in Progress'
                     }</h3>
                     <p className="text-sm text-slate-500 mt-2 px-10 leading-relaxed italic">
                        {profile?.verificationStep || 'Upload your documents to unlock premium service requests and higher payouts.'}
                     </p>
                   </div>
                   
                   <div className="p-5 bg-white rounded-[32px] border border-slate-100 shadow-sm text-center">
                      <div className="w-full h-2 bg-slate-50 rounded-full mb-6 overflow-hidden">
                         <div className={`h-full transition-all duration-1000 ${
                           profile?.verificationStatus === 'verified' ? 'w-full bg-emerald-500' : 
                           profile?.verificationStatus === 'pending' ? 'w-2/3 bg-amber-500' : 'w-1/3 bg-indigo-500'
                         }`} />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profile Completion: {
                        profile?.verificationStatus === 'verified' ? '100' : 
                        profile?.verificationStatus === 'pending' ? '65' : '30'
                      }%</p>
                   </div>

                   {profile?.verificationStatus !== 'verified' && profile?.verificationStatus !== 'pending' && (
                     <div className="p-6 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 space-y-4">
                        <div className="flex items-center space-x-4 mb-4">
                           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400">
                             <FileText size={20} />
                           </div>
                           <div className="text-left">
                              <p className="font-bold text-xs">Identity Document</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Passport / ID Card / Utility</p>
                           </div>
                        </div>
                        <button 
                          onClick={async () => {
                            if (!profile?.uid) return;
                            await updateDoc(doc(db, 'users', profile.uid), {
                              verificationStatus: 'pending',
                              verificationStep: 'Awaiting Document Review',
                              documents: ['mock_doc_1.pdf'],
                              updatedAt: serverTimestamp()
                            });
                          }}
                          className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                        >
                          Submit Documents for Review
                        </button>
                     </div>
                   )}
                </div>
             )}

             {view === 'settings' && (
                <div className="space-y-6 pb-12">
                   <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Display Mode</h4>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                         <span className="text-sm font-bold">Dark Theme</span>
                         <div className="w-10 h-5 bg-slate-200 rounded-full relative p-1 cursor-pointer">
                            <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                         </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                         <span className="text-sm font-bold">Enable Notifications</span>
                         <div className="w-10 h-5 bg-emerald-500 rounded-full relative p-1 cursor-pointer flex justify-end">
                            <div className="w-3 h-3 bg-white rounded-full shadow-sm" />
                         </div>
                      </div>
                   </div>

                   {profile?.isWorker && (
                      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Worker Status</h4>
                         <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                            <div>
                               <p className="text-sm font-bold">Online Capability</p>
                               <p className="text-[10px] text-slate-400">Visibility to customers</p>
                            </div>
                            <button
                              onClick={handleToggleOnline}
                              className={`w-12 h-6 rounded-full relative p-1 transition-colors ${isOnline ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            >
                               <motion.div 
                                 animate={{ x: isOnline ? 24 : 0 }}
                                 className="w-4 h-4 bg-white rounded-full shadow-sm" 
                               />
                            </button>
                         </div>
                         
                         <div className="mt-4 p-4 bg-slate-900 rounded-2xl text-white">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Pro Account type</p>
                            <p className="text-sm font-black capitalize tracking-tight">{profile?.workerType || 'Generic Pro'}</p>
                         </div>
                      </div>
                   )}
                </div>
             )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[10px] text-slate-300 uppercase tracking-widest mt-12 font-bold italic">
        KonnectS v1.0.0 • Verified in the UK
      </p>
    </div>
  );
}
