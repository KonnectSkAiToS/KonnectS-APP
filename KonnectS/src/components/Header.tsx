/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search, Sparkles, MapPin, ToggleLeft, ToggleRight, Bell, SlidersHorizontal, Star, ShieldCheck, User, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserAvatar } from './UserAvatar';

interface HeaderProps {
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

const TRADES_AND_SERVICES_KEYWORDS = [
  "Accountant", "Actuary", "Administrative Assistant", "AI Engineer", "Aerospace Engineer", 
  "Agricultural Engineer", "Architect", "Archivist", "Art Director", "Auditor", "Baker", 
  "Banker", "Barber", "Biologist", "Bookkeeper", "Bricklayer", "Business Analyst", "Carpenter", 
  "Cashier", "Chef", "Chemist", "Civil Engineer", "Cloud Engineer", "Construction Manager", 
  "Content Creator", "Customer Service Representative", "Cybersecurity Analyst", "Data Analyst", 
  "Data Engineer", "Data Scientist", "Delivery Driver", "Dentist", "Dermatologist", "Designer", 
  "Dietitian", "Doctor", "Economist", "Electrician", "Electronics Engineer", 
  "Emergency Medical Technician", "Environmental Scientist", "Event Planner", "Farmer", 
  "Financial Advisor", "Financial Analyst", "Firefighter", "Flight Attendant", "Forester", 
  "Gardener", "Geneticist", "Geologist", "Graphic Designer", "Hairdresser", "Healthcare Assistant", 
  "Historian", "Hotel Manager", "Human Resources Manager", "Industrial Designer", "Industrial Engineer", 
  "Insurance Agent", "Interior Designer", "IT Support Specialist", "Journalist", "Judge", 
  "Laboratory Technician", "Lawyer", "Librarian", "Logistics Manager", "Machine Operator", 
  "Marketing Manager", "Mechanical Engineer", "Mechanic", "Medical Laboratory Scientist", "Midwife", 
  "Musician", "Network Engineer", "Nurse", "Nutritionist", "Occupational Therapist", "Office Manager", 
  "Operations Manager", "Optometrist", "Paramedic", "Pharmacist", "Photographer", "Physical Therapist", 
  "Physician", "Pilot", "Plumber", "Police Officer", "Product Manager", "Professor", "Project Manager", 
  "Psychiatrist", "Psychologist", "Quality Assurance Engineer", "Quantity Surveyor", "Radiographer", 
  "Real Estate Agent", "Receptionist", "Research Scientist", "Robotics Engineer", "Sales Representative", 
  "Scientist", "Social Worker", "Software Developer", "Software Engineer", "Statistician", "Surgeon", 
  "Teacher", "Technical Writer", "Technician", "Therapist", "Translator", "Truck Driver", "UI Designer", 
  "UX Designer", "Urban Planner", "Veterinarian", "Video Editor", "Warehouse Worker", "Web Developer", 
  "Welder", "Writer", "X-ray Technologist", "Yoga Instructor", "Youth Worker", "Zoologist",
  "plumber", "electrician", "handyman", "cleaner", "tutor", "gardener", "expert", "specialist", "service"
];

const MARKETPLACE_KEYWORDS = [
  "chair", "sofa", "armchair", "table", "desks", "lamp", "mirror", "vintage", "retro", "antique",
  "furniture", "clothes", "shirt", "shoe", "bag", "electronics", "phone", "laptop", "guitar", "plant",
  "book", "bicycle", "seller", "items", "goods", "shop", "buy", "deal", "discount", "thrift"
];

const RIDE_KEYWORDS = [
  "ride", "cab", "taxi", "driver", "car", "uber", "transport", "pickup", "dropoff", "commute", "journey"
];

export function Header({ onOpenNotifications, unreadCount = 0 }: HeaderProps) {
  const { profile, toggleWorkerMode: authToggleWorkerMode } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchFeedback, setShowSearchFeedback] = useState(false);
  const [searchCategoryFeedback, setSearchCategoryFeedback] = useState('');

  // User details & unique ID
  const displayName = profile?.fullName || 
    (profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : profile?.username || 'Kamal Sri');
  
  const formattedUserId = profile?.uid 
    ? `ID: #${profile.uid.slice(0, 8).toUpperCase()}` 
    : 'ID: #KS-892401';

  // Smart Search Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState(() => localStorage.getItem('global_filter_distance') || 'all');
  const [ratingFilter, setRatingFilter] = useState(() => localStorage.getItem('global_filter_rating') || 'all');
  const [verifiedFilter, setVerifiedFilter] = useState(() => localStorage.getItem('global_filter_verified') === 'true');

  const updateDistanceFilter = (val: string) => {
    setDistanceFilter(val);
    localStorage.setItem('global_filter_distance', val);
    window.dispatchEvent(new CustomEvent('urbanNet_filters_updated'));
  };

  const updateRatingFilter = (val: string) => {
    setRatingFilter(val);
    localStorage.setItem('global_filter_rating', val);
    window.dispatchEvent(new CustomEvent('urbanNet_filters_updated'));
  };

  const updateVerifiedFilter = (val: boolean) => {
    setVerifiedFilter(val);
    localStorage.setItem('global_filter_verified', val ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('urbanNet_filters_updated'));
  };

  // Trending & Recent Search State
  const [isDropdownFocused, setIsDropdownFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('konnects_recent_searches');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });
  const trendingSearches = ["Plumber", "Taxi ride", "Vintage Sofa", "Eco Cleaner", "Electrician"];

  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter(q => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('konnects_recent_searches', JSON.stringify(updated));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('konnects_recent_searches');
  };

  const handleSuggestionSelect = (term: string) => {
    setSearchQuery(term);
    setIsDropdownFocused(false);
    saveRecentSearch(term);
    triggerSearchAction(term);
  };

  const toggleWorkerMode = async () => {
    try {
      await authToggleWorkerMode();
    } catch (error) {
      console.warn('Worker mode toggle error:', error);
    }
  };

  const triggerSearchAction = (queryStr: string) => {
    setIsSearching(true);
    const lowerQuery = queryStr.toLowerCase();

    // Deduce which tab/view fits best
    let targetTab: 'home' | 'marketplace' | 'services' | 'rides' = 'services';
    let label = 'Services';

    const matchesRides = RIDE_KEYWORDS.some(k => lowerQuery.includes(k));
    const matchesMarket = MARKETPLACE_KEYWORDS.some(k => lowerQuery.includes(k));
    const matchesServices = TRADES_AND_SERVICES_KEYWORDS.some(k => lowerQuery.includes(k.toLowerCase()));

    if (matchesRides) {
      targetTab = 'rides';
      label = 'Rides & Cabs';
    } else if (matchesMarket) {
      targetTab = 'marketplace';
      label = 'Marketplace Shop';
    } else if (matchesServices) {
      targetTab = 'services';
      label = 'Verified Trades & Services';
    } else {
      targetTab = 'services';
      label = 'Verified Trade Fields';
    }

    setSearchCategoryFeedback(`Navigating to ${label}...`);
    setShowSearchFeedback(true);

    setTimeout(() => {
      setIsSearching(false);
      setShowSearchFeedback(false);
      setSearchQuery('');

      if ((window as any).__setGlobalSearchTerm) {
        (window as any).__setGlobalSearchTerm(targetTab, queryStr);
      } else if ((window as any).__navigateTab) {
        (window as any).__navigateTab(targetTab);
        window.dispatchEvent(new CustomEvent('global-search', { detail: { tab: targetTab, term: queryStr } }));
      }
    }, 850);
  };

  const handleGlobalSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    saveRecentSearch(queryStr);
    setIsDropdownFocused(false);
    triggerSearchAction(queryStr);
  };

  return (
    <div className="w-full mb-6">
      {/* Upper Status Bar with Location and Unique User ID */}
      <div className="flex justify-between items-center mb-3 bg-slate-900 text-white py-2 px-4 rounded-full text-[9px] font-mono tracking-widest uppercase shadow-sm">
        <div className="flex items-center space-x-1.5 text-indigo-400">
          <MapPin size={10} className="text-indigo-400 animate-pulse" />
          <span className="text-slate-300 font-bold">{profile?.location?.address || 'London • Shoreditch E1'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md font-mono font-black border border-indigo-400/30">
            {formattedUserId}
          </span>
          <span className="text-slate-400 font-extrabold hidden sm:inline">
            {profile?.isWorkerMode ? 'Worker Mode Active' : 'Client Mode'}
          </span>
        </div>
      </div>

      {/* Main Header Row */}
      <header className="flex justify-between items-center mb-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2.5 pl-3 pr-3 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xs relative z-50">
        {/* User Profile Card & Picture Badge */}
        <button
          type="button"
          onClick={() => {
            if ((window as any).__navigateTab) {
              (window as any).__navigateTab('profile');
            }
          }}
          className="flex items-center space-x-3 p-1 pr-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl transition-all text-left group cursor-pointer border border-transparent hover:border-slate-200/50 active:scale-97"
          title="View & Edit Profile"
        >
          <div className="relative shrink-0">
            <UserAvatar
              avatarUrl={profile?.avatarUrl}
              firstName={profile?.firstName}
              lastName={profile?.lastName}
              fullName={displayName}
              username={profile?.username}
              className="w-10 h-10 rounded-2xl border border-indigo-500/30 shadow-xs group-hover:scale-105 transition-transform"
              badgeClassName="text-xs font-black"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11.5px] font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
              {displayName}
            </span>
            <span className="text-[8.5px] font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
              {formattedUserId}
            </span>
          </div>
        </button>

        {/* Center Title or Mode Badge */}
        <div className="hidden md:flex items-center space-x-2 select-none pointer-events-none">
          <span className="text-[10px] font-black tracking-[0.2em] text-slate-800 dark:text-slate-200 uppercase">UrbanNet</span>
        </div>

        {/* Action Controls: Mode Switch & Notifications */}
        <div className="flex items-center space-x-2">
          {/* Worker / Client Mode Toggle */}
          <button 
            type="button"
            onClick={toggleWorkerMode}
            className={`flex items-center space-x-2 px-3 py-2 rounded-2xl border transition-all duration-300 shadow-2xs active:scale-95 cursor-pointer ${
              profile?.isWorkerMode 
                ? 'bg-slate-900 border-slate-900 text-white ring-2 ring-indigo-500/20' 
                : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
            title="Toggle Worker/Guest Mode"
          >
            {profile?.isWorkerMode ? (
              <ToggleRight size={18} className="text-indigo-400" />
            ) : (
              <ToggleLeft size={18} className="text-slate-400" />
            )}
            <span className="text-[9.5px] font-black uppercase tracking-wider hidden sm:inline">
              {profile?.isWorkerMode ? 'Worker' : 'Guest'}
            </span>
          </button>

          {/* Notifications Icon Button */}
          <button 
            type="button"
            onClick={onOpenNotifications}
            className="relative p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-2xl shadow-2xs border border-slate-200/60 dark:border-slate-700 active:scale-95 transition-all text-slate-700 dark:text-slate-200 font-extrabold cursor-pointer"
            title="Open Notifications Center"
          >
            <Bell size={18} className={unreadCount > 0 ? 'text-indigo-600 fill-indigo-50 dark:text-indigo-400 dark:fill-indigo-950' : 'text-slate-500 dark:text-slate-400'} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white font-black text-[8px] w-4.5 h-4.5 flex items-center justify-center rounded-full border border-white dark:border-slate-900">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Global Interactive Search Input */}
      <form onSubmit={handleGlobalSearchSubmit} className="relative w-full">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsDropdownFocused(true)}
            onBlur={() => setTimeout(() => setIsDropdownFocused(false), 200)}
            placeholder="Search anything... e.g. Electrician, Chair, Taxi"
            className="w-full pl-11 pr-24 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all font-bold text-xs text-slate-800"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[9px] uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center space-x-1"
          >
            {isSearching ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Sparkles size={11} className="text-brand shrink-0" />
                <span>Search</span>
              </>
            )}
          </button>
        </div>

        {/* Global Recent & Trending Searches Dropdown Overlay */}
        <AnimatePresence>
          {isDropdownFocused && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute left-0 right-0 top-14 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden text-left p-4.5 space-y-4"
            >
              {recentSearches.length > 0 && (
                <div className="space-y-2 border-none">
                  <div className="flex justify-between items-center bg-transparent border-none">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Recent Searches</span>
                    <button 
                      type="button" 
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        clearRecentSearches();
                      }}
                      className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline bg-transparent border-none cursor-pointer p-0"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSuggestionSelect(term);
                        }}
                        className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border-none rounded-xl text-[10px] text-slate-700 dark:text-slate-350 font-bold transition-all cursor-pointer"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 border-none">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block">Trending Near London E1</span>
                <div className="flex flex-wrap gap-1.5">
                  {trendingSearches.map((term, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionSelect(term);
                      }}
                      className="px-3 py-1.5 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-100/10 hover:border-indigo-100 text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold rounded-xl transition-all cursor-pointer"
                    >
                      🔥 {term}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search status overlay dropdown */}
        <AnimatePresence>
          {showSearchFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute left-0 right-0 top-14 bg-slate-950 text-white rounded-2xl p-3.5 text-center font-bold text-[10px] tracking-wider uppercase border border-slate-800 shadow-xl z-50 flex items-center justify-center space-x-2"
            >
              <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce"></div>
              <span>{searchCategoryFeedback}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Dynamic Smart Filters Toolbar */}
      <div className="mt-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-slate-800 p-3.5 space-y-3 shadow-sm text-left">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center justify-between w-full font-black text-[9px] uppercase tracking-wider text-slate-500 bg-transparent border-none cursor-pointer"
        >
          <div className="flex items-center space-x-1.5">
            <SlidersHorizontal size={11} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-700 dark:text-slate-300">Search Smart Filters</span>
            {(distanceFilter !== 'all' || ratingFilter !== 'all' || verifiedFilter) && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </div>
          <span className="text-indigo-650 dark:text-indigo-400 font-extrabold">{showFilters ? 'Hide Panel' : 'Refine Search'}</span>
        </button>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-3 pt-2.5 border-t border-slate-50 dark:border-slate-800"
            >
              {/* Distance Filter */}
              <div className="space-y-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Maximum Distance</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'All Distances', value: 'all' },
                    { label: '< 1 mi', value: '1' },
                    { label: '< 3 mi', value: '3' },
                    { label: '< 5 mi', value: '5' }
                  ].map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => updateDistanceFilter(d.value)}
                      className={`px-2.5 py-1.5 rounded-xl text-[9px] font-extrabold transition-all border border-transparent cursor-pointer ${
                        distanceFilter === d.value
                          ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating Filter */}
              <div className="space-y-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">Minimum Rating</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'All Ratings', value: 'all' },
                    { label: '4.5+ ★', value: '4.5' },
                    { label: '4.8+ ★', value: '4.8' }
                  ].map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => updateRatingFilter(r.value)}
                      className={`px-2.5 py-1.5 rounded-xl text-[9px] font-extrabold transition-all border border-transparent cursor-pointer flex items-center space-x-1 ${
                        ratingFilter === r.value
                          ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350'
                      }`}
                    >
                      {r.value !== 'all' && <Star size={9} className="text-amber-400 fill-amber-400" />}
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Verified Status Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Verified Traders Only</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateVerifiedFilter(!verifiedFilter)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                    verifiedFilter
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-850 dark:text-emerald-400 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-350'
                  }`}
                >
                  {verifiedFilter ? '✓ Enabled' : 'Disabled'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
