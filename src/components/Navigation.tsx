/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, ShoppingBag, Briefcase, Car, User } from 'lucide-react';
import { motion } from 'framer-motion';

type Tab = 'home' | 'marketplace' | 'services' | 'rides' | 'profile';

interface NavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'marketplace', icon: ShoppingBag, label: 'Shop' },
    { id: 'services', icon: Briefcase, label: 'Work' },
    { id: 'rides', icon: Car, label: 'Rides' },
    { id: 'profile', icon: User, label: 'Me' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
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
              <div className={`p-1 rounded-xl transition-colors ${isActive ? 'text-brand' : 'text-slate-400'}`}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium tracking-tight ${isActive ? 'text-brand' : 'text-slate-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute bottom-1 w-1 h-1 rounded-full bg-brand"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
