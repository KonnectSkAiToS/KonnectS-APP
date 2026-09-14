/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Package, MapPin, ArrowRight, Clock, ShieldCheck, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export function FetchView({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    itemDescription: '',
    pickup: 'Current Location',
    dropoff: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !formData.itemDescription || !formData.dropoff) return;
    
    setStatus('loading');
    try {
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
      await addDoc(collection(db, 'bookings'), {
        customerId: user.uid,
        serviceType: 'fetch',
        description: `Fetch: ${formData.itemDescription}`,
        location: {
          lat: 51.5074,
          lng: -0.1278,
          address: formData.dropoff
        },
        pickupAddress: formData.pickup,
        status: 'pending',
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: serverTimestamp()
      });
      setStatus('success');
      setTimeout(onBack, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
      setStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 bg-bg z-[110] flex flex-col p-6 max-w-md mx-auto overflow-y-auto">
      <header className="mb-8 flex items-center space-x-4">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
           <ArrowRight size={20} className="rotate-180" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Fetch It</h1>
      </header>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/20 mb-8">
        <div className="flex items-start space-x-4 mb-6">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Package size={24} />
          </div>
          <div>
            <h3 className="font-bold">Forgotten something?</h3>
            <p className="text-xs text-slate-500 italic">We'll fetch it and drop it to you in minutes.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">What did you forget?</label>
            <input 
              required
              value={formData.itemDescription}
              onChange={(e) => setFormData({...formData, itemDescription: e.target.value})}
              placeholder="e.g. Keys, Wallet, Charger"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl focus:ring-2 focus:ring-brand outline-none text-sm"
            />
          </div>

          <div>
             <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Pickup Location</label>
             <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  required
                  value={formData.pickup}
                  onChange={(e) => setFormData({...formData, pickup: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl focus:ring-2 focus:ring-brand outline-none text-sm"
                />
             </div>
          </div>

          <div>
             <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Dropoff (Your Location)</label>
             <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  required
                  value={formData.dropoff}
                  onChange={(e) => setFormData({...formData, dropoff: e.target.value})}
                  placeholder="Where are you now?"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl focus:ring-2 focus:ring-brand outline-none text-sm"
                />
             </div>
          </div>

          <div className="flex items-center justify-between py-4 border-t border-slate-50">
             <div className="flex items-center space-x-2 text-slate-500">
                <Clock size={16} />
                <span className="text-xs font-medium">Estimated: 12-18 mins</span>
             </div>
             <span className="font-bold text-slate-900">£8.50</span>
          </div>

          <button 
            type="submit"
            disabled={status !== 'idle'}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-all ${
              status === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white shadow-slate-900/10'
            }`}
          >
            {status === 'loading' ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : status === 'success' ? (
              <>
                <Check size={18} />
                <span>Request Sent</span>
              </>
            ) : (
              <>
                <span>Request Fetcher</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start space-x-3">
         <ShieldCheck size={18} className="text-indigo-600 mt-0.5" />
         <div>
            <p className="text-xs font-bold text-indigo-900">Safety First</p>
            <p className="text-[10px] text-indigo-700">All our fetchers are background-checked and Right to Work verified.</p>
         </div>
      </div>
    </div>
  );
}
