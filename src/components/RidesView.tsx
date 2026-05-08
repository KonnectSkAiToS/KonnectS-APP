/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Car, MapPin, Navigation as NavIcon, Star, ArrowRight, PoundSterling, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export function RidesView() {
  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState('Current Location');
  const [destination, setDestination] = useState('');

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Ride Share</h1>
        <p className="text-slate-500 text-sm italic">Get where you need to go, for less.</p>
      </header>

      {/* Map Placeholder */}
      <div className="w-full h-48 bg-slate-100 rounded-3xl mb-8 relative flex items-center justify-center overflow-hidden border border-slate-200">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-50"></div>
        <NavIcon className="text-slate-300 animate-pulse" size={48} />
      </div>

      {/* Booking Form */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/20 p-8 space-y-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-brand/5 rounded-full -translate-y-12 translate-x-12" />
        
        <div className="space-y-4">
          <div className="relative pl-10 border-b border-slate-50 pb-6">
            <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-4 border-brand bg-white z-10"></div>
            <div className="absolute left-[7px] top-6 bottom-4 w-0.5 bg-slate-100"></div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Safe Pickup</p>
            <input 
              type="text" 
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              className="w-full text-lg font-black tracking-tight placeholder:text-slate-200 focus:outline-none"
              placeholder="Pick me up at..."
            />
          </div>
          
          <div className="relative pl-10 pb-2">
            <div className="absolute left-0 bottom-3 w-4 h-4 bg-slate-900 rounded-sm z-10"></div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Dropoff Point</p>
            <input 
              type="text" 
              placeholder="Where are we going?"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full text-lg font-black tracking-tight placeholder:text-slate-200 focus:outline-none"
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100">
           <div className="flex items-center space-x-3">
              <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm">
                 <PoundSterling size={16} />
              </div>
              <span className="text-xs font-black text-slate-900">Suggested Fair</span>
           </div>
           <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400">£</span>
              <span className="text-lg font-black text-slate-900">12.50</span>
           </div>
        </div>
        
        <button className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/40 active:scale-95 transition-all text-xs flex items-center justify-center space-x-3">
          <span>Search Drivers</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Available Rides (Related Content) */}
      <div className="mt-12 space-y-6">
         <div className="flex justify-between items-center px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Live Traffic Near You</h3>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center space-x-1">
               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
               <span>42 Active</span>
            </span>
         </div>

         <div className="space-y-4">
            {[
              { id: '1', driver: 'Alex M.', car: 'Tesla Model 3', rating: 4.9, price: 12, time: '2 min' },
              { id: '2', driver: 'Sarah K.', car: 'Toyota Prius', rating: 4.8, price: 9, time: '5 min' },
              { id: '3', driver: 'James L.', car: 'Black Cab', rating: 5.0, price: 18, time: '3 min' }
            ].map(ride => (
              <motion.div 
                key={ride.id}
                whileHover={{ scale: 1.02 }}
                className="p-5 bg-white rounded-[32px] border border-slate-100 shadow-sm flex items-center space-x-4 cursor-pointer active:scale-95 transition-all"
              >
                 <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center relative">
                    <Car className="text-slate-400" size={24} />
                    <div className="absolute -right-1 -top-1 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest">Live</div>
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between items-start mb-0.5">
                       <h4 className="font-black text-slate-900">{ride.driver}</h4>
                       <span className="text-sm font-black">£{ride.price}</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{ride.car}</p>
                    <div className="flex items-center space-x-2">
                       <div className="flex items-center space-x-1 bg-amber-50 px-2 py-0.5 rounded-md">
                          <Star size={10} className="text-amber-500 fill-amber-500" />
                          <span className="text-[10px] font-black text-amber-600">{ride.rating}</span>
                       </div>
                       <div className="flex items-center space-x-1 bg-slate-50 px-2 py-0.5 rounded-md">
                          <Clock size={10} className="text-slate-400" />
                          <span className="text-[10px] font-black text-slate-500">{ride.time} away</span>
                       </div>
                    </div>
                 </div>
              </motion.div>
            ))}
         </div>
      </div>

      {/* Driver Promo */}
      <div className="mt-10 p-6 bg-blue-50 rounded-3xl border border-blue-100">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
            <Car size={24} />
          </div>
          <div>
            <h4 className="font-bold text-blue-900">Own a vehicle?</h4>
            <div className="flex items-center space-x-1 text-blue-700">
              <Star size={12} fill="currentColor" />
              <span className="text-xs font-bold italic underline">Become a driver</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-blue-700">Earn up to £150/day helping people get around London.</p>
      </div>
    </div>
  );
}
