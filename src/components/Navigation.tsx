/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, ShoppingBag, Briefcase, Car, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useState, useEffect } from 'react';

type Tab = 'home' | 'marketplace' | 'services' | 'rides' | 'profile';

interface NavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  const { t } = useLanguage();
  const [syncStatus, setSyncStatus] = useState<'on' | 'syncing' | 'offline'>('on');

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
      setSyncStatus('offline');
    }

    const handleCustomSync = () => {
      setSyncStatus('syncing');
      setTimeout(() => setSyncStatus('on'), 2200);
    };
    window.addEventListener('sw_sync_started', handleCustomSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sw_sync_started', handleCustomSync);
    };
  }, []);

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'home', icon: Home, label: t('nav.home') },
    { id: 'marketplace', icon: ShoppingBag, label: t('nav.marketplace') },
    { id: 'services', icon: Briefcase, label: t('nav.services') },
    { id: 'rides', icon: Car, label: t('nav.rides') },
    { id: 'profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe z-40">
      <div className="max-w-md mx-auto relative flex justify-around items-center h-16 px-2">
        
        {/* Background Cache Sync Status Indicator */}
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 select-none pointer-events-none z-50">
          <div className={`px-2 py-0.5 rounded-full border text-[7.5px] font-black uppercase tracking-widest flex items-center space-x-1.5 shadow-sm transition-all duration-300 ${
            syncStatus === 'on' 
              ? 'bg-white text-emerald-600 border-emerald-100 shadow-emerald-150/30 dark:bg-slate-950 dark:border-emerald-950/40 dark:text-emerald-400' 
              : syncStatus === 'syncing'
              ? 'bg-white text-indigo-600 border-indigo-100 shadow-indigo-150/30 animate-pulse dark:bg-slate-950 dark:border-indigo-950/40 dark:text-indigo-400'
              : 'bg-white text-amber-600 border-amber-100 shadow-amber-150/30 dark:bg-slate-950 dark:border-amber-950/40 dark:text-amber-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              syncStatus === 'on' 
                ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' 
                : syncStatus === 'syncing'
                ? 'bg-indigo-500 shadow-[0_0_6px_#6366f1] animate-ping'
                : 'bg-amber-500 shadow-[0_0_6px_#f59e0b]'
            }`} />
            <span>
              {syncStatus === 'on' ? 'SW Cache Saved' : syncStatus === 'syncing' ? 'Syncing...' : 'Local Enclave'}
            </span>
          </div>
        </div>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
