/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Navigation } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { MarketplaceView } from './components/MarketplaceView';
import { ServicesView } from './components/ServicesView';
import { RidesView } from './components/RidesView';
import { ProfileView } from './components/ProfileView';
import { WorkspaceHub } from './components/WorkspaceHub';
import { LoginView } from './components/LoginView';
import { WorkerView } from './components/WorkerView';
import { GeminiAssistant } from './components/GeminiAssistant';
import { ChatView } from './components/ChatView';
import { GlobalVoiceCommand } from './components/GlobalVoiceCommand';
import { DeveloperHUD } from './components/DeveloperHUD';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { motion, AnimatePresence } from 'framer-motion';
import { startBookingNotificationListener, listenToRideLocalChanges, NotificationItem, startScheduledRideNotificationChecker, snoozeNotifications } from './services/notificationService';
import { Bell, AlertCircle, Check, Bug } from 'lucide-react';
import { GuidedTour } from './components/GuidedTour';
import { startRealtimeDbSync } from './services/dbSyncService';
import { ReportIssueModal } from './components/ReportIssueModal';
import { haptics } from './utils/haptics';
import { initBackgroundSync } from './services/backgroundSyncManager';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShowcaseSpaceView } from './components/ShowcaseSpaceView';

type Tab = 'home' | 'showcase' | 'marketplace' | 'services' | 'rides' | 'profile' | 'workspace';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem('user_default_home_tab') || localStorage.getItem('urbanNet_default_tab');
      if (saved && ['home', 'showcase', 'marketplace', 'services', 'rides', 'profile', 'workspace'].includes(saved)) {
        return saved as Tab;
      }
    } catch (e) {
      console.warn(e);
    }
    return 'home';
  });

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('user_default_home_tab', tab);
    } catch (e) {
      console.warn(e);
    }
  };

  const [chattingWith, setChattingWith] = useState<{ id: string; name: string } | null>(null);
  const [toastNotification, setToastNotification] = useState<NotificationItem | null>(null);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [forceLoaded, setForceLoaded] = useState(false);
  const [showBypass, setShowBypass] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBypass(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    (window as any).__activeTab = activeTab;
    (window as any).__navigateTab = (tab: Tab) => {
      setActiveTab(tab);
    };
    (window as any).__setDefaultHomeTab = (tab: Tab) => {
      setActiveTab(tab);
    };
  }, [activeTab]);

  // Sync and apply layout parameters
  useEffect(() => {
    const applyAllThemes = () => {
      const selectedTheme = localStorage.getItem('appearance_theme') || 'light';
      
      // Temporarily inject a CSS style block to force a smooth transition on body, backgrounds, and text
      let style = document.getElementById('theme-transition-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'theme-transition-style';
        document.head.appendChild(style);
      }
      style.innerHTML = `
        *, *::before, *::after {
          transition: background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important,
                      border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important,
                      color 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important,
                      box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
      `;

      // Clean previous classes
      document.documentElement.classList.remove('dark', 'high-contrast', 'eye-protection');
      
      if (selectedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (selectedTheme === 'high-contrast') {
        document.documentElement.classList.add('high-contrast');
      } else if (selectedTheme === 'eye-protection') {
        document.documentElement.classList.add('eye-protection');
      } else if (selectedTheme === 'system') {
        const prefdark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefdark) {
          document.documentElement.classList.add('dark');
        }
      }

      // Remove the transition style block after the animation completes to prevent layout transition lag on hover
      setTimeout(() => {
        const styleToRemove = document.getElementById('theme-transition-style');
        if (styleToRemove) {
          styleToRemove.remove();
        }
      }, 500);
    };

    applyAllThemes();

    // Listen to theme changes from SettingsEditor
    const handleThemeChange = () => {
      applyAllThemes();
    };

    window.addEventListener('appearance_theme_updated', handleThemeChange);
    return () => window.removeEventListener('appearance_theme_updated', handleThemeChange);
  }, []);

  useEffect(() => {
    const scale = profile?.accessibilityFontScale || localStorage.getItem('accessibilityFontScale') || 'normal';
    let size = '16px';
    if (scale === 'large') size = '18.5px';
    else if (scale === 'xlarge') size = '21px';
    document.documentElement.style.fontSize = size;
  }, [profile?.accessibilityFontScale]);

  // Global custom event listener to re-launch tour from Settings or Profile
  useEffect(() => {
    const handleLaunchTour = () => setShowGuidedTour(true);
    window.addEventListener('launch-guided-tour', handleLaunchTour);
    return () => window.removeEventListener('launch-guided-tour', handleLaunchTour);
  }, []);

  // Handle tour popup trigger for first-time logged in OR guest users
  useEffect(() => {
    const tourUserId = user?.uid || 'guest_user';
    const isCompleted = localStorage.getItem(`urbanNet_tour_completed_${tourUserId}`) === 'true';
    const forceAlways = localStorage.getItem('konnects_auto_tour_on_start') === 'true';
    if (!isCompleted || forceAlways) {
      // Delay slightly for smooth modal entrance trigger
      const handle = setTimeout(() => setShowGuidedTour(true), 1200);
      return () => clearTimeout(handle);
    }
  }, [user]);

  const [isLowBattery, setIsLowBattery] = useState(false);

  // Initialize offline background sync manager
  useEffect(() => {
    initBackgroundSync();
  }, []);

  // Monitor battery status and toggle battery saver (disabled)
  useEffect(() => {
    localStorage.setItem('is_low_battery', 'false');
  }, []);

  // Hook up booking & ride status update listeners and 15m schedule checker in background
  useEffect(() => {
    if (!user?.uid) return;
    
    // In battery saver mode, we disable non-critical background polling / real-time updates
    if (isLowBattery) {
      console.log('[Battery Saver] Background polling suspended.');
      return;
    }

    const unsubBookings = startBookingNotificationListener(user.uid);
    const unsubRides = listenToRideLocalChanges();
    const unsubScheduledChecker = startScheduledRideNotificationChecker();
    const unsubDbSync = startRealtimeDbSync();

    return () => {
      unsubBookings();
      unsubRides();
      unsubScheduledChecker();
      unsubDbSync();
    };
  }, [user, isLowBattery]);

  // Setup toast notifier handler
  useEffect(() => {
    let timer: any;
    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationItem>;
      if (customEvent.detail) {
        setToastNotification(customEvent.detail);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setToastNotification(null);
        }, 5000);
      }
    };
    window.addEventListener('urbanNet_new_notification', handleNewNotification);
    return () => {
      window.removeEventListener('urbanNet_new_notification', handleNewNotification);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Setup online/offline transition listeners
  useEffect(() => {
    const handleOnline = () => {
      setToastNotification({
        id: 'online-toast-' + Date.now(),
        type: 'info',
        title: '✓ Connection Restored',
        message: 'Back online! Real-time synchronization is fully restored.',
        timestamp: new Date().toLocaleTimeString(),
        isRead: false
      });
    };
    const handleOffline = () => {
      setToastNotification({
        id: 'offline-toast-' + Date.now(),
        type: 'info',
        title: '⚠ Network Offline',
        message: 'You have transitioned to offline mode. Interactive offline capabilities are now active.',
        timestamp: new Date().toLocaleTimeString(),
        isRead: false
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    (window as any).__navigateTab = (tab: Tab) => {
      setActiveTab(tab);
    };
    (window as any).__setGlobalSearchTerm = (tab: Tab, term: string) => {
      (window as any).__globalSearchTerm = term;
      setActiveTab(tab);
      window.dispatchEvent(new CustomEvent('global-search', { detail: { tab, term } }));
    };
    (window as any).__openSupportChat = () => {
      setChattingWith({ id: 'support_moderator_1', name: 'Support Moderator' });
    };
  }, []);


  if (loading && !forceLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 transition-colors duration-200 p-6 select-none font-sans">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
        {showBypass && (
          <div className="mt-6 flex flex-col items-center space-y-3 animate-pulse text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bypassing network sync / auth loading...</p>
            <button
              onClick={() => setForceLoaded(true)}
              className="px-4 py-2 bg-brand text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 border-none cursor-pointer"
            >
              Enter Application
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderView = () => {
    if (profile?.isWorkerMode && (activeTab === 'home' || activeTab === 'services')) {
      return <WorkerView onChat={(id, name) => setChattingWith({ id, name })} activeTab={activeTab} />;
    }

    switch (activeTab) {
      case 'home': return <HomeView onNavigateReferral={() => setActiveTab('profile')} />;
      case 'showcase': return <ShowcaseSpaceView onChat={(id, name) => setChattingWith({ id, name })} />;
      case 'marketplace': return <MarketplaceView />;
      case 'services': return <ServicesView onChat={(id, name) => setChattingWith({ id, name })} />;
      case 'rides': return <RidesView />;
      case 'profile': return <ProfileView />;
      case 'workspace': return <WorkspaceHub />;
      default: return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-bg selection:bg-brand/10">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + (profile?.isWorkerMode ? '-worker' : '-customer')}
          layoutId="active-view-container"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
      
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <GeminiAssistant />
      <GlobalVoiceCommand />
      <DeveloperHUD />
      <ConflictResolutionModal />

      {/* Floating Report Issue Trigger */}
      <div className="fixed right-6 bottom-40 z-45">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { haptics.light(); setShowReportModal(true); }}
          className="w-12 h-12 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-2xl border-none cursor-pointer transition-all shadow-rose-500/30"
          title="Report an Issue"
        >
          <Bug size={20} />
        </motion.button>
      </div>

      <ReportIssueModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} activeTab={activeTab} />

      {/* Real-time Global Toast Alert Overlay */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            id="global-toast-overlay"
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-4 left-4 right-4 z-[9999] max-w-md mx-auto p-4 bg-slate-900 border border-indigo-500/30 text-white rounded-3xl shadow-2xl flex flex-col space-y-3 cursor-pointer select-none"
            onClick={() => setToastNotification(null)}
          >
            <div className="flex items-start space-x-3 w-full">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-2xl shrink-0 mt-0.5">
                {toastNotification.type === 'booking' ? <Check size={18} /> : <Bell size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                  {toastNotification.title}
                </h4>
                <p className="text-[11px] text-slate-350 leading-relaxed font-bold mt-0.5">
                  {toastNotification.message}
                </p>
              </div>
            </div>

            {/* Snooze action shortcuts */}
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 w-full flex-row" onClick={(e) => e.stopPropagation()}>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Snooze alerts:</span>
              <div className="flex items-center space-x-1.5 flex-row">
                {[15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    id={`snooze-btn-${mins}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      snoozeNotifications(mins);
                      setToastNotification(null);
                      // Trigger tactile vibration
                      if (navigator.vibrate) {
                        navigator.vibrate([35]);
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border-none rounded-lg text-[9px] font-extrabold uppercase cursor-pointer transition-colors"
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chattingWith && (
          <ChatView 
            recipientId={chattingWith.id} 
            recipientName={chattingWith.name} 
            onBack={() => setChattingWith(null)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGuidedTour && (
          <GuidedTour 
            userId={user?.uid || 'guest_user'} 
            onClose={() => setShowGuidedTour(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
