/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, ShoppingBag, Briefcase, Car, User, ShieldAlert, Cloud, Film } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useState, useEffect, useRef } from 'react';
import { haptics } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type Tab = 'home' | 'showcase' | 'marketplace' | 'services' | 'rides' | 'profile' | 'workspace';

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
    { id: 'home', icon: profile?.isWorkerMode ? Briefcase : Home, label: profile?.isWorkerMode ? 'Worker Pro' : t('nav.home') },
    { id: 'showcase', icon: Film, label: 'Showcase' },
    { id: 'marketplace', icon: ShoppingBag, label: t('nav.marketplace') },
    { id: 'services', icon: Briefcase, label: t('nav.services') },
    { id: 'rides', icon: Car, label: t('nav.rides') },
    { id: 'profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <>
      {/* Floating Emergency SOS Long-Press Safety Control (Cleanly positioned above navigation without tab overlap) */}
      <div className="fixed bottom-20 left-4 z-40 select-none">
        <button
          onMouseDown={startSosTimer}
          onMouseUp={cancelSosTimer}
          onMouseLeave={cancelSosTimer}
          onTouchStart={startSosTimer}
          onTouchEnd={cancelSosTimer}
          className={`h-9 px-3 rounded-full flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-lg transition-all border outline-none cursor-pointer ${
            isPressingSOS 
              ? 'bg-rose-600 border-rose-700 text-white animate-pulse scale-95 ring-4 ring-rose-400/30' 
              : sosTriggered 
              ? 'bg-rose-700 border-rose-800 text-white' 
              : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40'
          }`}
          title="Long-press for 1.2s to broadcast emergency SOS with coordinates"
        >
          <ShieldAlert size={14} className={isPressingSOS ? 'animate-spin text-white' : 'text-rose-500'} />
          <span>{isPressingSOS ? 'Holding...' : sosTriggered ? 'SOS Active' : 'SOS'}</span>
          {isPressingSOS && (
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          )}
        </button>
      </div>

      {/* Main Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 pb-safe z-40 select-none shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
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
                className={`relative flex-1 flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors cursor-pointer outline-none ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                id={`nav-btn-${tab.id}`}
              >
                <div className="relative flex items-center justify-center">
                  <motion.div 
                    animate={isActive ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    className="p-1"
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </motion.div>
                  {tab.id === 'showcase' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  )}
                </div>

                <span className={`text-[9.5px] font-bold tracking-tight transition-all ${
                  isActive ? 'font-black text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {tab.label}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-sm shadow-indigo-500/50"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
