/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search, MapPin, Bell, Car, ShoppingBag, Briefcase, Package, LifeBuoy, MoreHorizontal, ArrowRight, ToggleLeft, ToggleRight, Clock, Check, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { ServiceBooking } from '../types';
import { FetchView } from './FetchView';
import { CharityView } from './CharityView';
import { MapView } from './MapView';

export function HomeView({ onNavigateReferral }: { onNavigateReferral?: () => void }) {
  const { profile } = useAuth();
  const [showFetch, setShowFetch] = useState(false);
  const [showCharity, setShowCharity] = useState(false);
  const [showMap, setShowMap] = useState(false);

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

  const [activeRequests, setActiveRequests] = useState<ServiceBooking[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;
    
    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', profile.uid),
      where('status', 'in', ['pending', 'accepted', 'negotiating']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceBooking)));
    }, (error) => {
      // SILENT fail for home view tracker to not annoy user
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const categories = [
    { icon: Car, label: 'Rides', color: 'bg-blue-50 text-blue-600' },
    { icon: ShoppingBag, label: 'Market', color: 'bg-orange-50 text-orange-600' },
    { icon: Briefcase, label: 'Services', color: 'bg-indigo-50 text-indigo-600' },
    { icon: Package, label: 'Fetch it', color: 'bg-emerald-50 text-emerald-600' },
    { icon: LifeBuoy, label: 'Charity', color: 'bg-rose-50 text-rose-600' },
    { icon: MoreHorizontal, label: 'More', color: 'bg-slate-50 text-slate-600' },
  ];

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
      {showFetch && <FetchView onBack={() => setShowFetch(false)} />}
      {showCharity && <CharityView onBack={() => setShowCharity(false)} />}
      {showMap && <MapView onBack={() => setShowMap(false)} />}
      
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
           <button 
            onClick={toggleWorkerMode}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-all ${
              profile?.isWorkerMode ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-600'
            }`}
          >
            {profile?.isWorkerMode ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            <span className="text-[10px] font-bold uppercase tracking-widest">{profile?.isWorkerMode ? 'Worker' : 'Guest'}</span>
          </button>
        </div>
        <button className="relative p-2 bg-white rounded-full shadow-sm border border-slate-100">
          <Bell size={20} className="text-slate-600" />
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
        </button>
      </header>

      {/* Search Bar */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="What do you need today?"
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm focus:ring-2 focus:ring-brand focus:outline-none transition-all"
        />
      </div>

       {/* Hero Banner */}
       <motion.div
         whileHover={{ scale: 0.98 }}
         className="relative bg-slate-900 rounded-3xl p-6 mb-8 overflow-hidden text-white group cursor-pointer"
       >
         <div className="absolute -right-4 -top-4 w-32 h-32 bg-brand/30 rounded-full blur-3xl group-hover:bg-brand/50 transition-colors"></div>
         <div className="relative z-10">
           <h2 className="text-2xl font-bold mb-2">Welcome back, {profile?.username || 'User'}!</h2>
           <p className="text-slate-400 text-sm mb-4">You have {profile?.rewardsPoints?.toLocaleString() || 0} reward points available.</p>
           <button 
             id="referral-invite-btn"
             onClick={() => onNavigateReferral?.()}
             className="bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 active:scale-95 transition-all"
           >
             <span>Invite & Earn 500pts</span>
             <ArrowRight size={14} />
           </button>
         </div>
       </motion.div>

       {/* Active Requests Tracker */}
       <AnimatePresence>
         {activeRequests.length > 0 && (
           <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-10"
           >
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-lg tracking-tight">Active Requests</h3>
                 <span className="text-[10px] font-black bg-brand px-2 py-0.5 rounded text-white uppercase tracking-widest">{activeRequests.length} Live</span>
              </div>
              <div className="space-y-4">
                 {activeRequests.map(req => (
                   <div key={req.id} className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group">
                      <div className="flex items-center space-x-3">
                         <div className={`p-3 rounded-2xl ${req.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : req.status === 'negotiating' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                            {req.status === 'accepted' ? <Check size={18} /> : req.status === 'negotiating' ? <MessageSquare size={18} /> : <Clock size={18} />}
                         </div>
                         <div>
                            <p className="text-xs font-bold capitalize tracking-tight">{req.serviceType}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                               {req.status === 'accepted' ? 'Worker on the Way' : req.status === 'negotiating' ? 'New Counteroffer' : 'Searching for Pros'}
                            </p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-xs font-black text-slate-900">£{req.suggestedPrice || req.price}</p>
                         <button className="text-[8px] font-black text-brand uppercase tracking-widest border-b border-brand border-opacity-30">View Details</button>
                      </div>
                   </div>
                 ))}
              </div>
           </motion.section>
         )}
       </AnimatePresence>

      {/* Categories Grid */}
      <section className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg tracking-tight">Top Services</h3>
          <button 
            onClick={() => setShowMap(true)}
            className="text-brand text-xs font-bold uppercase tracking-wider"
          >
            Expand All
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {categories.map((cat, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (cat.label === 'Fetch it') setShowFetch(true);
                if (cat.label === 'Charity') setShowCharity(true);
              }}
              className="flex flex-col items-center group"
            >
              <div className={`w-16 h-16 ${cat.color} rounded-2xl flex items-center justify-center mb-2 shadow-sm group-active:scale-95 transition-transform`}>
                <cat.icon size={28} />
              </div>
              <span className="text-xs font-semibold text-slate-600">{cat.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Urgent Services Section */}
      <section className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg tracking-tight">Need Urgent Care?</h3>
        </div>
        <div className="flex space-x-4 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
          {['Plumber', 'Electrician', 'Locksmith', 'Mechanic'].map((service, i) => (
            <div key={i} className="flex-shrink-0 bg-white border border-slate-100 rounded-2xl p-4 w-32 shadow-sm">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mb-3 text-slate-600">
                <Briefcase size={20} />
              </div>
              <p className="font-bold text-sm">{service}</p>
              <p className="text-[10px] text-emerald-600 font-bold uppercase">Ready Now</p>
            </div>
          ))}
        </div>
      </section>

      {/* Community Section */}
      <section className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg tracking-tight">Good Deeds</h3>
        </div>
        <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-100 flex items-center justify-between">
          <div>
            <p className="font-bold text-emerald-900">Charitable Giving</p>
            <p className="text-xs text-emerald-700">Donate leftover food or items</p>
          </div>
          <button 
            onClick={() => setShowCharity(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
          >
            Donate Now
          </button>
        </div>
      </section>
    </div>
  );
}
