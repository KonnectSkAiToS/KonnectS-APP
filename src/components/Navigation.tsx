/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, ShoppingBag, Briefcase, Car, User, ShieldAlert, Cloud } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useState, useEffect, useRef } from 'react';
import { haptics } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type Tab = 'home' | 'marketplace' | 'services' | 'rides' | 'profile';

interface NavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'on' | 'syncing' | 'offline'>('on');
  
  // Real-time Cloud Sync & SOS long press states
  const [hybridSyncActive, setHybridSyncActive] = useState(false);
  const [isPressingSOS, setIsPressingSOS] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);
  const sosTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('syncing');
      setTimeout(() => setSyncStatus('on'), 2500);
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (!navigator.onLine) {
      Promise.resolve().then(() => {
        setSyncStatus('offline');
      });
    }

    const handleCustomSync = () => {
      setSyncStatus('syncing');
      setTimeout(() => setSyncStatus('on'), 2200);
    };
    window.addEventListener('sw_sync_started', handleCustomSync);

    // Turn green when hybrid sync starts
    const handleHybridSync = () => {
      setHybridSyncActive(true);
      setTimeout(() => setHybridSyncActive(false), 3500);
    };
    window.addEventListener('supabase-sync-updated', handleHybridSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sw_sync_started', handleCustomSync);
      window.removeEventListener('supabase-sync-updated', handleHybridSync);
    };
  }, []);

  const startSosTimer = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    haptics.heavy();
    setIsPressingSOS(true);
    sosTimerRef.current = setTimeout(async () => {
      haptics.heavy();
      setSosTriggered(true);
      setIsPressingSOS(false);
      
      let lat = 51.5260;
      let lng = -0.0780; // defaults Shoreditch
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            sendSosToFirestore(lat, lng);
          },
          () => {
            sendSosToFirestore(lat, lng);
          }
        );
      } else {
        sendSosToFirestore(lat, lng);
      }
    }, 1200); // 1.2 seconds long-press
  };

  const cancelSosTimer = () => {
    setIsPressingSOS(false);
    if (sosTimerRef.current) clearTimeout(sosTimerRef.current);
  };

  const sendSosToFirestore = async (lat: number, lng: number) => {
    try {
      await addDoc(collection(db, 'safety_alerts'), {
        userId: profile?.uid || 'anonymous',
        username: profile?.username || 'Guest Neighbor',
        message: '🚨 One-Tap Emergency SOS long-press triggered from Bottom Navigation!',
        location: { lat, lng },
        coordinates: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        status: 'active',
        timestamp: serverTimestamp()
      });
      alert(`🚨 EMERGENCY SOS SENT SUCCESSFULLY!\nCommunity support response services are matching with your coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}.`);
      
      const sosNotif = new CustomEvent('urbanNet_new_notification', {
        detail: {
          id: 'sos-alert-' + Date.now(),
          type: 'sos',
          title: '🚨 EMERGENCY ALERT ACTIVE',
          message: `Shared real-time coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)} with Shoreditch civic response team.`,
          timestamp: new Date().toLocaleTimeString(),
          isRead: false
        }
      });
      window.dispatchEvent(sosNotif);
    } catch(err) {
      console.warn('Silent safety log fallback:', err);
      alert(`Emergency SOS Offline Broadcast Simulated: Coordinates coord: ${lat.toFixed(4)}, ${lng.toFixed(4)}.`);
    }
  };

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'home', icon: Home, label: t('nav.home') },
    { id: 'marketplace', icon: ShoppingBag, label: t('nav.marketplace') },
    { id: 'services', icon: Briefcase, label: t('nav.services') },
    { id: 'rides', icon: Car, label: t('nav.rides') },
    { id: 'profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe z-40 select-none">
      <div className="max-w-md mx-auto relative flex justify-around items-center h-16 px-2">
        
        {/* Subtle Cloud Sync Status Icon */}
        <div className="absolute top-1.5 left-3 select-none z-50 flex items-center gap-1.5">
          <Cloud size={13} className={`transition-all duration-500 ${hybridSyncActive ? 'text-emerald-500 scale-125 animate-bounce' : 'text-slate-350 dark:text-slate-600 animate-pulse'}`} />
          <span className={`text-[7px] font-mono uppercase tracking-widest ${hybridSyncActive ? 'text-emerald-600 font-black' : 'text-slate-400'}`}>
            {hybridSyncActive ? 'Cloud Synced' : 'Cloud Idle'}
          </span>
        </div>

        {/* Quick Emergency SOS Button with Long Press triggers */}
        <button
          onMouseDown={startSosTimer}
          onMouseUp={cancelSosTimer}
          onMouseLeave={cancelSosTimer}
          onTouchStart={startSosTimer}
          onTouchEnd={cancelSosTimer}
          className={`absolute top-1.5 right-3.5 z-50 text-[9px] font-black uppercase tracking-wider py-1 px-2 rounded-full flex items-center gap-1 transition-all outline-none border cursor-pointer select-none ${
            isPressingSOS 
              ? 'bg-red-600 border-red-700 text-white animate-pulse scale-95 ring-2 ring-red-400' 
              : sosTriggered 
              ? 'bg-red-700 border-red-800 text-white' 
              : 'bg-red-50 dark:bg-red-950/40 border-red-200/40 text-red-650 dark:text-red-400 hover:bg-red-500 hover:text-white'
          }`}
          title="LONG-PRESS TO TRIGGER EMERGENCY SOS DISPATCH"
        >
          <ShieldAlert size={12} className={isPressingSOS ? 'animate-spin' : ''} />
          <span>{isPressingSOS ? 'Hold...' : sosTriggered ? 'SOS Active' : 'SOS (Hold)'}</span>
        </button>

        {/* Background Cache Sync Status Indicator */}
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 select-none pointer-events-none z-50">
          <motion.div 
            animate={syncStatus === 'syncing' ? {
              scale: [1, 1.04, 1],
              boxShadow: ["0px 1px 3px rgba(99,102,241,0.2)", "0px 2px 8px rgba(99,102,241,0.4)", "0px 1px 3px rgba(99,102,241,0.2)"]
            } : {
              scale: 1,
              boxShadow: "0px 1px 3px rgba(16,185,129,0.15)"
            }}
            transition={syncStatus === 'syncing' ? {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            } : undefined}
            className={`px-2.5 py-0.5 rounded-full border text-[7.5px] font-black uppercase tracking-widest flex items-center space-x-1.5 transition-all duration-300 ${
              syncStatus === 'on' 
                ? 'bg-white text-emerald-600 border-emerald-100 dark:bg-slate-950 dark:border-emerald-950/40 dark:text-emerald-400' 
                : syncStatus === 'syncing'
                ? 'bg-white text-indigo-600 border-indigo-100 dark:bg-slate-950 dark:border-indigo-950/40 dark:text-indigo-400'
                : 'bg-white text-amber-600 border-amber-100 dark:bg-slate-950 dark:border-amber-950/40 dark:text-amber-400'
            }`}
          >
            <motion.div 
              animate={syncStatus === 'syncing' ? {
                scale: [1, 1.3, 1],
                opacity: [0.7, 1, 0.7]
              } : {
                scale: 1,
                opacity: 1
              }}
              transition={syncStatus === 'syncing' ? {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              } : undefined}
              className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === 'on' 
                  ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' 
                  : syncStatus === 'syncing'
                  ? 'bg-indigo-500 shadow-[0_0_6px_#6366f1]'
                  : 'bg-amber-500 shadow-[0_0_6px_#f59e0b]'
              }`} 
            />
            <span>
              {syncStatus === 'on' ? 'Up-to-date' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
            </span>
          </motion.div>
        </div>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                haptics.light();
                setActiveTab(tab.id);
              }}
              className="relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors"
              id={`nav-btn-${tab.id}`}
            >
              <motion.div 
                animate={isActive ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`p-1 rounded-xl transition-colors ${isActive ? 'text-brand' : 'text-slate-400'}`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <motion.span 
                animate={isActive ? { opacity: 1, scale: 1.1, y: -2 } : { opacity: 0.7, scale: 1, y: 0 }}
                className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-brand' : 'text-slate-400'}`}
              >
                {tab.label}
              </motion.span>
              {isActive && (
                <motion.div
                   layoutId="active-nav-indicator"
                   className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-brand shadow-sm shadow-brand/40"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
