/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Briefcase, Zap, Shield, Star, Clock, Check, MessageSquare, MapPin, X, DollarSign, Calendar, Navigation, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export function ServicesView({ onChat }: { onChat: (id: string, name: string) => void }) {
  const { user } = useAuth();
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'booking' | 'success'>('idle');
  const [selectedService, setSelectedService] = useState<{name: string, price: number} | null>(null);
  
  // Enhanced Booking State
  const [pickupAddress, setPickupAddress] = useState('Shoreditch, London');
  const [dropoffAddress, setDropoffAddress] = useState('Canary Wharf, London');
  const [pickupCoords, setPickupCoords] = useState({ lat: 51.5235, lng: -0.0760 });
  const [dropoffCoords, setDropoffCoords] = useState({ lat: 51.5054, lng: -0.0235 });
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('2 hours');
  const [isMapPicking, setIsMapPicking] = useState<'pickup' | 'dropoff' | null>(null);

  const handleBookNow = async () => {
    if (!user?.uid || !selectedService) return;
    setBookingStatus('booking');
    
    const description = `Urgent request for ${selectedService.name}`;
    try {
      // 10 minute timeout for professional requests
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      await addDoc(collection(db, 'bookings'), {
        customerId: user.uid,
        serviceType: selectedService.name,
        status: 'pending',
        description,
        pickupLocation: {
          ...pickupCoords,
          address: pickupAddress
        },
        dropoffLocation: {
          ...dropoffCoords,
          address: dropoffAddress
        },
        price: selectedService.price,
        suggestedPrice: Number(suggestedPrice) || selectedService.price,
        estimatedCompletionTime: estimatedTime,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: serverTimestamp()
      });
      
      setBookingStatus('success');
      setTimeout(() => {
        setBookingStatus('idle');
        setSelectedService(null);
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
      setBookingStatus('idle');
    }
  };

  const professionals = [
    { id: 'pro1', name: 'John S.', role: 'Master Plumber', rating: 4.9, reviews: 124, price: 45, status: 'available' },
    { id: 'pro2', name: 'Sarah L.', role: 'Electrician', rating: 4.8, reviews: 89, price: 40, status: 'available' },
    { id: 'pro3', name: 'David W.', role: 'Emergency Mechanic', rating: 5.0, reviews: 52, price: 60, status: 'on-job' },
  ];

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Service Booking</h1>
        <p className="text-slate-500 text-sm italic">Verified professionals for your home & car.</p>
      </header>

      {/* Verification Banner */}
      <div className="mb-8 p-4 bg-indigo-600 rounded-3xl text-white flex items-center space-x-4 shadow-xl shadow-indigo-600/20">
        <div className="p-3 bg-white/20 rounded-2xl">
          <Shield size={24} />
        </div>
        <div>
          <h4 className="font-bold text-sm">Right to Work Verified</h4>
          <p className="text-[10px] text-indigo-100 opacity-80 uppercase tracking-widest font-bold">Safe & Trusted in the UK</p>
        </div>
      </div>

      <div className="mb-8 overflow-hidden">
         <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Live Activity Near London</h3>
         <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
            {[
              { type: 'Service', icon: Wrench, title: 'Emergency Pipe Fix', location: 'Hackney', time: '2m ago' },
              { type: 'Ride', icon: Navigation, title: 'Ride to Heathrow', location: 'Chelsea', time: '5m ago' },
              { type: 'Market', icon: Zap, title: 'Power Tools Sold', location: 'Brixton', time: '12m ago' }
            ].map((feed, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="flex-shrink-0 w-48 bg-white border border-slate-100 rounded-3xl p-4 shadow-sm snap-start"
              >
                 <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg">
                       <feed.icon size={12} />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">{feed.type}</span>
                 </div>
                 <h5 className="text-[11px] font-black leading-tight mb-1">{feed.title}</h5>
                 <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 italic">
                    <span>{feed.location}</span>
                    <span className="text-brand opacity-60">{feed.time}</span>
                 </div>
              </motion.div>
            ))}
         </div>
      </div>

      <div className="space-y-4">
        {professionals.map((pro, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-start space-x-4"
          >
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400">
              <Briefcase size={24} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center space-x-2">
                   <h4 className="font-bold">{pro.name}</h4>
                   <div className="flex items-center space-x-1">
                     <Shield size={12} className={
                       pro.status === 'available' ? 'text-emerald-500 fill-emerald-500/10' :
                       pro.status === 'pending' ? 'text-amber-500' : 'text-slate-300'
                     } />
                     <span className={`text-[8px] font-black uppercase tracking-tighter ${
                       pro.status === 'available' ? 'text-emerald-600' : 'text-slate-400'
                     }`}>
                       {pro.status === 'available' ? 'Verified Pro' : 'Pending'}
                     </span>
                   </div>
                </div>
                <div className="flex items-center space-x-1 text-amber-500">
                  <Star size={14} fill="currentColor" />
                  <span className="text-xs font-bold">{pro.rating}</span>
                </div>
              </div>
              <p className="text-xs font-medium text-slate-500 mb-2">{pro.role}</p>
              
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-1 text-slate-400">
                  <Clock size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Fast Response</span>
                </div>
                <span className="text-[10px] font-bold text-slate-900">£{pro.price}/hr</span>
                <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                  pro.status === 'available' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${pro.status === 'available' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <span>{pro.status === 'available' ? 'Online' : 'Away'}</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <button 
                  onClick={() => setSelectedService({ name: pro.role, price: pro.price })}
                  disabled={bookingStatus !== 'idle'}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center space-x-2 bg-slate-900 text-white`}
                >
                  <span>Request Job</span>
                </button>
                <button 
                  onClick={() => onChat(pro.id, pro.name)}
                  className="px-4 py-2 bg-slate-100 text-slate-900 rounded-xl text-xs font-bold active:scale-95 transition-transform flex items-center space-x-1"
                >
                  <MessageSquare size={14} />
                  <span>Chat</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Industry Section */}
      <div className="mt-10 p-6 bg-slate-900 rounded-3xl text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Zap size={100} />
        </div>
        <h4 className="text-lg font-bold mb-2">Want to list your Service?</h4>
        <p className="text-slate-400 text-sm mb-6">Create a profile, upload your Right to Work docs and start earning today.</p>
        <button className="w-full bg-white text-slate-900 py-3 rounded-2xl font-bold">Register as Worker</button>
      </div>
      <AnimatePresence>
        {selectedService && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedService(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl overflow-hidden"
            >
               <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Finalise Booking</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{selectedService.name}</p>
                  </div>
                  <button onClick={() => setSelectedService(null)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors">
                    <X size={20} />
                  </button>
               </div>

               <div className="space-y-6">
                  {/* Pickup Selection */}
                  <div className="space-y-2">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pickup Location</label>
                        <button onClick={() => setIsMapPicking(isMapPicking === 'pickup' ? null : 'pickup')} className="text-[10px] font-black text-brand uppercase tracking-widest underline">
                          {isMapPicking === 'pickup' ? 'Confirm' : 'Pin on Map'}
                        </button>
                     </div>
                     <div className={`relative h-20 rounded-3xl border border-slate-100 overflow-hidden transition-all ${isMapPicking === 'pickup' ? 'h-40' : ''}`}>
                        {isMapPicking === 'pickup' ? (
                           <div className="w-full h-full bg-slate-100 relative group cursor-crosshair">
                              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                 <Navigation size={48} className="animate-pulse" />
                              </div>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                 <MapPin className="text-emerald-500 drop-shadow-xl" size={32} />
                                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-2 py-0.5 rounded uppercase font-black">Pickup</div>
                              </div>
                           </div>
                        ) : (
                           <div className="flex items-center space-x-3 p-4 bg-slate-50 h-full">
                              <MapPin size={20} className="text-emerald-500" />
                              <input 
                                value={pickupAddress}
                                onChange={(e) => setPickupAddress(e.target.value)}
                                className="bg-transparent font-black text-slate-700 outline-none w-full text-xs" 
                              />
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Drop-off Selection */}
                  <div className="space-y-2">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Drop-off / Work Site</label>
                        <button onClick={() => setIsMapPicking(isMapPicking === 'dropoff' ? null : 'dropoff')} className="text-[10px] font-black text-brand uppercase tracking-widest underline">
                          {isMapPicking === 'dropoff' ? 'Confirm' : 'Pin on Map'}
                        </button>
                     </div>
                     <div className={`relative h-20 rounded-3xl border border-slate-100 overflow-hidden transition-all ${isMapPicking === 'dropoff' ? 'h-40' : ''}`}>
                        {isMapPicking === 'dropoff' ? (
                           <div className="w-full h-full bg-slate-100 relative group cursor-crosshair">
                              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                 <Navigation size={48} className="animate-pulse" />
                              </div>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                 <MapPin className="text-rose-500 drop-shadow-xl" size={32} />
                                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-2 py-0.5 rounded uppercase font-black">Dropoff</div>
                              </div>
                           </div>
                        ) : (
                           <div className="flex items-center space-x-3 p-4 bg-slate-50 h-full">
                              <MapPin size={20} className="text-rose-500" />
                              <input 
                                value={dropoffAddress}
                                onChange={(e) => setDropoffAddress(e.target.value)}
                                className="bg-transparent font-black text-slate-700 outline-none w-full text-xs" 
                              />
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Negotiate Price</label>
                        <div className="relative">
                           <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                           <input 
                             type="number"
                             value={suggestedPrice}
                             onChange={(e) => setSuggestedPrice(e.target.value)}
                             placeholder={selectedService.price.toString()}
                             className="w-full pl-10 p-4 bg-slate-50 border border-transparent focus:border-brand rounded-2xl font-black text-sm outline-none transition-all"
                           />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Est. Time</label>
                        <div className="relative">
                           <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                           <input 
                             value={estimatedTime}
                             onChange={(e) => setEstimatedTime(e.target.value)}
                             className="w-full pl-10 p-4 bg-slate-50 border border-transparent focus:border-brand rounded-2xl font-black text-sm outline-none transition-all"
                           />
                        </div>
                     </div>
                  </div>

                  <button 
                    onClick={handleBookNow}
                    disabled={bookingStatus !== 'idle'}
                    className={`w-full py-5 rounded-[24px] text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center space-x-3 ${
                      bookingStatus === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-900 text-white shadow-slate-900/20'
                    }`}
                  >
                    {bookingStatus === 'booking' ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : bookingStatus === 'success' ? (
                      <>
                        <Check size={20} />
                        <span>Success</span>
                      </>
                    ) : (
                      <span>Send High-Priority Request</span>
                    )}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
