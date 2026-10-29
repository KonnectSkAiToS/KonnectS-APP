/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Heart, Gift, Package, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { VolunteerHoursCard } from '../features/community';

export function CharityView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  
  const charities = [
    { name: 'London Food Bank', desc: 'Providing meals to those in need.', color: 'text-orange-500' },
    { name: 'Stay Warm UK', desc: 'Heating assistance for vulnerable homes.', color: 'text-indigo-500' },
    { name: 'Reuse London', desc: 'Textile and furniture recycling.', color: 'text-emerald-500' },
  ];

  return (
    <div className="fixed inset-0 bg-bg z-[110] flex flex-col p-6 max-w-md mx-auto overflow-y-auto">
      <header className="mb-8 flex items-center space-x-4">
        <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
           <ArrowRight size={20} className="rotate-180" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Kindness Hub</h1>
      </header>

      <div className="bg-rose-50 rounded-3xl p-6 border border-rose-100 flex items-center space-x-4 mb-8">
        <div className="p-4 bg-white rounded-2xl text-rose-500 shadow-sm">
          <Heart size={32} fill="currentColor" />
        </div>
        <div>
          <h3 className="font-bold text-rose-900">Make an Impact</h3>
          <p className="text-[10px] text-rose-700 font-bold uppercase tracking-widest">Community Support</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg px-2">How would you like to help?</h3>
        
        {/* Donation Types */}
        <div className="grid grid-cols-2 gap-4">
          <button className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm text-center group active:scale-95 transition-all">
             <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Gift size={24} />
             </div>
             <p className="font-bold text-sm">Donate Item</p>
             <p className="text-[10px] text-slate-400">Furniture, Clothes</p>
          </button>
          
          <button className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm text-center group active:scale-95 transition-all">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Package size={24} />
             </div>
             <p className="font-bold text-sm">Donate Food</p>
             <p className="text-[10px] text-slate-400">Leftovers, Dry goods</p>
          </button>
        </div>

        {/* Charities list */}
        <div className="pt-6">
           <h3 className="font-bold text-lg px-2 mb-4">Partner Organizations</h3>
           <div className="space-y-3">
             {charities.map((ch, i) => (
               <div key={i} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className={`font-bold text-sm ${ch.color}`}>{ch.name}</h4>
                    <p className="text-xs text-slate-500">{ch.desc}</p>
                  </div>
                  <button className="p-2 bg-slate-50 rounded-xl text-slate-400">
                    <ArrowRight size={16} />
                  </button>
               </div>
             ))}
           </div>
        </div>
      </div>

      <VolunteerHoursCard charities={charities.map(c => c.name)} />

      <div className="mt-10 p-4 bg-slate-900 rounded-2xl text-white flex items-center justify-between">
         <div className="flex items-center space-x-3">
            <ShieldCheck size={20} className="text-emerald-500" />
            <span className="text-xs font-bold">100% Secure Donations</span>
         </div>
         <button className="text-xs font-bold underline">Read Impact Report</button>
      </div>
    </div>
  );
}
