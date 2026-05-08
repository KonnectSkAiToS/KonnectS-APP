/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navigation } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { MarketplaceView } from './components/MarketplaceView';
import { ServicesView } from './components/ServicesView';
import { RidesView } from './components/RidesView';
import { ProfileView } from './components/ProfileView';
import { LoginView } from './components/LoginView';
import { WorkerView } from './components/WorkerView';
import { GeminiAssistant } from './components/GeminiAssistant';
import { ChatView } from './components/ChatView';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'home' | 'marketplace' | 'services' | 'rides' | 'profile';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [chattingWith, setChattingWith] = useState<{ id: string; name: string } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderView = () => {
    // If worker mode is ON, show worker dashboard instead of home/services/rides
    if (profile?.isWorkerMode && (activeTab === 'home' || activeTab === 'services' || activeTab === 'rides')) {
       return <WorkerView onChat={(id, name) => setChattingWith({ id, name })} />;
    }

    switch (activeTab) {
      case 'home': return <HomeView onNavigateReferral={() => setActiveTab('profile')} />;
      case 'marketplace': return <MarketplaceView />;
      case 'services': return <ServicesView onChat={(id, name) => setChattingWith({ id, name })} />;
      case 'rides': return <RidesView />;
      case 'profile': return <ProfileView />;
      default: return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-bg selection:bg-brand/10">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + (profile?.isWorkerMode ? '-worker' : '-customer')}
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

      <AnimatePresence>
        {chattingWith && (
          <ChatView 
            recipientId={chattingWith.id} 
            recipientName={chattingWith.name} 
            onBack={() => setChattingWith(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
