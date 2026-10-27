/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Car, MapPin, Navigation as NavIcon, Star, ArrowRight, PoundSterling, Clock, Check, X, Shield, Sparkles, Phone, MessageSquare, AlertCircle, Map as MapIcon, Train, Ticket, Activity, TrendingDown, Info, Download, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { QuickSOS } from './QuickSOS';
import { haptics } from '../utils/haptics';
import { CalendarSyncManager } from '../services/calendarService';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logSyncEvent } from '../services/dbSyncService';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const DRIVER_COORDINATES: Record<string, { lat: number, lng: number }> = {
  '1': { lat: 51.5265, lng: -0.0785 },
  '2': { lat: 51.5290, lng: -0.0750 },
  '3': { lat: 51.5235, lng: -0.0810 }
};

export function RidesView() {
  const { user, profile } = useAuth();
  const [offlineProgress, setOfflineProgress] = useState<number | null>(null);
  const [isOfflineMapCached, setIsOfflineMapCached] = useState(() => {
    return localStorage.getItem('konnect_map_precached') === 'true';
  });

  const handleDownloadMap = () => {
    if (offlineProgress !== null || isOfflineMapCached) return;
    haptics.beacon();
    setOfflineProgress(0);
    const interval = setInterval(() => {
      setOfflineProgress((prev) => {
        if (prev === null) {
          clearInterval(interval);
          return null;
        }
        if (prev >= 100) {
          clearInterval(interval);
          haptics.success();
          setIsOfflineMapCached(true);
          localStorage.setItem('konnect_map_precached', 'true');
          
          // Trigger custom notification log event
          const event = new CustomEvent('urbanNet_new_notification', {
            detail: {
              id: 'offline-map-' + Date.now(),
              type: 'service',
              title: '🗺️ Map Area Offline Saved',
              message: 'Successfully offline-cached Hoxton, Shoreditch & Old Street sectors (14.5MB). Route guidance will function fully without 4G.',
              timestamp: new Date().toLocaleTimeString(),
              isRead: false
            }
          });
          window.dispatchEvent(event);
          return null;
        }
        haptics.light();
        return prev + 20;
      });
    }, 400);
  };

  const [step, setStep] = useState(1); // 1 = Booking Form, 2 = Searching Radar, 3 = Driver Found / Active Ride
  const [pickup, setPickup] = useState('Current Location (Shoreditch)');
  const [destination, setDestination] = useState('');
  const [fare, setFare] = useState('12.50');
  const [searchError, setSearchError] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [simulationTimer, setSimulationTimer] = useState<number>(0);
  const [isMapView, setIsMapView] = useState(false);
  const [hoveredDriver, setHoveredDriver] = useState<any>(null);
  const [mapLoadError, setMapLoadError] = useState(Boolean((window as any).gmapsHasFailed) || !GOOGLE_MAPS_API_KEY);
  const [loading, setLoading] = useState(true);
  const [mapLayers, setMapLayers] = useState({ workers: true, hubs: false, bookings: false });
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [showCompletionAnim, setShowCompletionAnim] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [lastCompletedDriver, setLastCompletedDriver] = useState<any>(null);

  // TfL & National Rail real-time peak congestion suggestions state
  const [selectedTransitMode, setSelectedTransitMode] = useState<'cab' | 'hybrid'>('cab');
  const [showTflTicketModal, setShowTflTicketModal] = useState(false);
  const [isTrafficPeak, setIsTrafficPeak] = useState(true); // Active standard PM peak congestion
  const [tflSuggestion, setTflSuggestion] = useState<any>(null);
  const [recurringSuggestions, setRecurringSuggestions] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'price' | 'time' | 'rating'>('price');

  useEffect(() => {
    // Initialize global_voice_command_history if empty to seed realistic suggestions
    const seedHistory = [
      { text: "book a cab to Camden Market at 8:30 am", timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
      { text: "need a ride to Heathrow Airport on Wednesday at 14:00", timestamp: new Date(Date.now() - 3600000 * 24).toISOString() },
      { text: "book a ride to Camden Market at 8:30 am on Monday", timestamp: new Date(Date.now() - 3600000 * 48).toISOString() },
      { text: "cab to London Bridge at 6:15 pm", timestamp: new Date(Date.now() - 3600000 * 5).toISOString() },
      { text: "get me a car to Camden Market at 8:30 am", timestamp: new Date(Date.now() - 3600000 * 72).toISOString() }
    ];

    try {
      if (!localStorage.getItem('global_voice_command_history')) {
        localStorage.setItem('global_voice_command_history', JSON.stringify(seedHistory));
      }
    } catch (e) {
      console.error(e);
    }

    const loadHistoryAndAnalyze = () => {
      try {
        const historyRaw = localStorage.getItem('global_voice_command_history');
        const history = historyRaw ? JSON.parse(historyRaw) : [];
        if (!Array.isArray(history) || history.length === 0) return;

        // Group suggestions based on destination keywords and frequency
        const patternMap: Record<string, { count: number, times: string[], text: string, fare: string }> = {};
        
        history.forEach((cmd: any) => {
          const text = (cmd.text || '').toLowerCase();
          let matchedDest = '';
          let estFare = '12.50';

          if (text.includes('camden')) {
            matchedDest = 'Camden Market';
            estFare = '14.20';
          } else if (text.includes('heathrow')) {
            matchedDest = 'Heathrow Airport';
            estFare = '42.00';
          } else if (text.includes('piccadilly')) {
            matchedDest = 'Piccadilly Circus';
            estFare = '9.80';
          } else if (text.includes('london bridge')) {
            matchedDest = 'London Bridge';
            estFare = '8.50';
          } else if (text.includes('old street') || text.includes('shoreditch')) {
            matchedDest = 'Shoreditch Office';
            estFare = '6.50';
          }

          if (matchedDest) {
            let timeFound = '09:00';
            const timeMatch = cmd.text.match(/(\d{1,2}:\d{2})\s*(am|pm)?/i) || cmd.text.match(/at\s*(\d{1,2}(:\d{2})?\s*(am|pm)?)/i);
            if (timeMatch) {
              timeFound = timeMatch[0].replace(/^at\s+/i, '').trim();
            }

            if (!patternMap[matchedDest]) {
              patternMap[matchedDest] = {
                count: 0,
                times: [],
                text: cmd.text,
                fare: estFare
              };
            }
            patternMap[matchedDest].count += 1;
            if (!patternMap[matchedDest].times.includes(timeFound)) {
              patternMap[matchedDest].times.push(timeFound);
            }
          }
        });

        const list = Object.keys(patternMap).map(dest => {
          const item = patternMap[dest];
          let frequency = 'Occasional';
          if (item.count >= 3) frequency = 'Daily Commute';
          else if (item.count >= 2) frequency = 'Highly Recurring';

          return {
            destination: dest,
            frequency,
            times: item.times.join(', '),
            count: item.count,
            fare: item.fare,
            commandText: item.text
          };
        }).sort((a, b) => b.count - a.count);

        setRecurringSuggestions(list);
      } catch (e) {
        console.error(e);
      }
    };

    loadHistoryAndAnalyze();

    window.addEventListener('global_voice_command_logged', loadHistoryAndAnalyze);
    return () => window.removeEventListener('global_voice_command_logged', loadHistoryAndAnalyze);
  }, []);

  useEffect(() => {
    let active = true;
    if (!destination) {
      Promise.resolve().then(() => {
        if (active) setTflSuggestion(null);
      });
      return;
    }
    const destLower = destination.toLowerCase();
    if (destLower.includes('camden')) {
      Promise.resolve().then(() => {
        if (active) setTflSuggestion({
          from: 'Shoreditch / Old Street',
          to: 'Camden Market',
          stations: 'Moorgate Station Loop ➜ Northern Line ➜ Camden Town',
          routeType: 'Underground Tube Connection',
          duration: '11 mins (Save 24 mins vs Cab)',
          costOnOyster: '2.80',
          congestionLevel: 'CRITICAL SEVERE CONGESTION',
          carbonSaved: '1.4kg CO2',
          tubeLine: 'Northern Line',
          lineColor: 'bg-slate-900 border-slate-750 text-white'
        });
      });
    } else if (destLower.includes('heathrow')) {
      Promise.resolve().then(() => {
        if (active) setTflSuggestion({
          from: 'Liverpool Street Station Lobby',
          to: 'Heathrow Airport',
          stations: 'Elizabeth Line (Platform B) ➜ Heathrow Express Terminal',
          routeType: 'National Rail & Express Integration',
          duration: '35 mins (Save 45 mins vs Cab)',
          costOnOyster: '12.20',
          congestionLevel: 'HIGHWAY A40 GRIDLOCK DELAYS',
          carbonSaved: '5.2kg CO2',
          tubeLine: 'Elizabeth Line',
          lineColor: 'bg-purple-900 border-purple-800 text-white'
        });
      });
    } else if (destLower.includes('piccadilly')) {
      Promise.resolve().then(() => {
        if (active) setTflSuggestion({
          from: 'Old Street Tube',
          to: 'Piccadilly Circus',
          stations: 'Northern Line ➜ King\'s Cross St. Pancras ➜ Piccadilly Line',
          routeType: 'Double-Tube Rapid Transit',
          duration: '14 mins (Save 18 mins vs Cab)',
          costOnOyster: '2.80',
          congestionLevel: 'WEST END GRIDLOCK',
          carbonSaved: '1.8kg CO2',
          tubeLine: 'Northern / Piccadilly',
          lineColor: 'bg-blue-900 border-blue-900 text-white'
        });
      });
    } else if (destLower.includes('bridge') || destLower.includes('london')) {
      Promise.resolve().then(() => {
        if (active) setTflSuggestion({
          from: 'Shoreditch High St',
          to: 'London Bridge Station',
          stations: 'London Overground ➜ Canada Water ➜ Jubilee Line',
          routeType: 'Overground & Tube Rapid',
          duration: '12 mins (Save 15 mins vs Cab)',
          costOnOyster: '2.80',
          congestionLevel: 'BRIDGE CONGESTION CHARGE DEVIATION',
          carbonSaved: '1.1kg CO2',
          tubeLine: 'London Overground',
          lineColor: 'bg-orange-600 border-orange-500 text-white'
        });
      });
    } else {
      Promise.resolve().then(() => {
        if (active) setTflSuggestion({
          from: 'Old Street Transit Hub',
          to: destination,
          stations: `Moorgate Station ➜ TfL Rail Loop ➜ ${destination} Terminal`,
          routeType: 'London Transit Multi-Modal Route',
          duration: '15 mins (Estimated bypass routing)',
          costOnOyster: '3.40',
          congestionLevel: 'ROUTE CONGESTION WARNING',
          carbonSaved: '1.2kg CO2',
          tubeLine: 'TfL Rail Network',
          lineColor: 'bg-sky-600 border-sky-500 text-white'
        });
      });
    }
    return () => {
      active = false;
    };
  }, [destination]);

  const MOCK_HUBS = [
    { id: 'h1', title: 'Shoreditch High St Overground (Transit Hub)', lat: 51.5234, lng: -0.0763, x: '25%', top: '45%' },
    { id: 'h2', title: 'Old Street Tube Station (Transit Hub)', lat: 51.5257, lng: -0.0877, x: '75%', top: '25%' },
    { id: 'h3', title: 'Liverpool Street Station (Transit Hub)', lat: 51.5178, lng: -0.0814, x: '45%', top: '85%' },
  ];

  const MOCK_ACTIVE_BOOKINGS = [
    { id: 'ab1', title: 'Active Ride #4521 - En Route', lat: 51.5245, lng: -0.0750, x: '55%', top: '55%' },
    { id: 'ab2', title: 'Active Service Booking #1240 - cleaning service', lat: 51.5295, lng: -0.0790, x: '80%', top: '70%' },
  ];

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    const timer = setTimeout(() => {
      if (active) setLoading(false);
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  // Setup Global auth failure and console error interception to catch ApiProjectMapError
  useEffect(() => {
    const originalAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps Auth Failure intercepted in RidesView. Enabling Vector Map Failsafe Mode.");
      (window as any).gmapsHasFailed = true;
      setMapLoadError(true);
      if (originalAuthFailure) {
        try { originalAuthFailure(); } catch (e) {}
      }
    };

    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const msg = args.map(arg => String(arg)).join(' ');
      if (msg.includes('ApiProjectMapError') || msg.includes('Google Maps') || msg.includes('google.maps')) {
        (window as any).gmapsHasFailed = true;
        Promise.resolve().then(() => {
          setMapLoadError(true);
        });
      }
      originalConsoleError.apply(console, args);
    };

    if (!GOOGLE_MAPS_API_KEY) {
      (window as any).gmapsHasFailed = true;
      Promise.resolve().then(() => {
        setMapLoadError(true);
      });
    }

    return () => {
      (window as any).gm_authFailure = originalAuthFailure;
      console.error = originalConsoleError;
    };
  }, []);

  const mockDrivers = [
    { id: '1', driver: 'Alex M.', car: 'Tesla Model 3', rating: 4.9, price: 12.50, time: '2 min', phone: '+44 7700 900077', color: 'text-indigo-600', isVerifiedSafe: true },
    { id: '2', driver: 'Sarah K.', car: 'Toyota Prius (Hybrid)', rating: 4.8, price: 9.50, time: '5 min', phone: '+44 7700 900088', color: 'text-teal-600', isVerifiedSafe: true },
    { id: '3', driver: 'James L.', car: 'Mercedes EQE (EV)', rating: 5.0, price: 18.00, time: '3 min', phone: '+44 7700 900099', color: 'text-rose-600', isVerifiedSafe: true }
  ];

  const sortedDrivers = [...mockDrivers].sort((a, b) => {
    if (sortBy === 'price') {
      return a.price - b.price;
    } else if (sortBy === 'time') {
      const timeA = parseInt(a.time) || 0;
      const timeB = parseInt(b.time) || 0;
      return timeA - timeB;
    } else if (sortBy === 'rating') {
      return b.rating - a.rating;
    }
    return 0;
  });

  // Synchronize active ride state with local storage
  useEffect(() => {
    if (step === 2 || step === 3) {
      const activeRide = {
        pickup,
        destination,
        fare,
        driverName: selectedDriver?.driver || null,
        car: selectedDriver?.car || null,
        step,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('urbanNet_activeRide', JSON.stringify(activeRide));
    } else {
      localStorage.removeItem('urbanNet_activeRide');
    }
  }, [step, pickup, destination, fare, selectedDriver]);

  // Calculate fare dynamically based on destination length
  useEffect(() => {
    let active = true;
    if (!destination) {
      Promise.resolve().then(() => {
        if (active) setFare('12.50');
      });
      return;
    }
    const len = destination.length;
    const baseFare = 6.20 + (len * 0.45);
    Promise.resolve().then(() => {
      if (active) setFare(baseFare.toFixed(2));
    });
    return () => {
      active = false;
    };
  }, [destination]);

  // Handle Finding Nearby Drivers simulation
  const handleFindDrivers = () => {
    if (!destination.trim()) {
      setSearchError('Please specify a destination to find matching drivers.');
      return;
    }
    setSearchError('');
    setStep(2); // Transition to searching radar
    haptics.beacon();

    // Pick a driver randomly from mock drivers to display after searching
    const randomDriver = mockDrivers[Math.floor(Math.random() * mockDrivers.length)];
    setSelectedDriver({
      ...randomDriver,
      price: parseFloat(fare)
    });

    // Simulated network match search countdown
    const timeout = setTimeout(() => {
      setStep(3);
      haptics.success();

      // Automatically sync ride to calendar
      CalendarSyncManager.autoSyncEvent({
        title: `Ride to ${destination}`,
        description: `Carpool journey with ${randomDriver?.driver || 'Local Driver'} (£${fare})`,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 mins journey
        location: pickup || 'Current Location',
        sourceType: 'ride'
      });
    }, 3000);

    return () => clearTimeout(timeout);
  };

  // Mock Active journey timeline simulation
  useEffect(() => {
    let interval: any;
    let active = true;
    if (step === 3) {
      Promise.resolve().then(() => {
        if (active) setSimulationTimer(120); // 2 minutes countdown
      });
      localStorage.setItem('active_ride_active', 'true');
      localStorage.setItem('active_ride_driver', selectedDriver?.driver || 'Cab Driver');
      localStorage.setItem('active_ride_destination', destination || 'Shoreditch High St');
      localStorage.setItem('active_ride_timer', '120');
      
      // Dispatch custom event to trigger voice update if enabled
      window.dispatchEvent(new CustomEvent('active_ride_changed', { detail: { timer: 120 } }));

      interval = setInterval(() => {
        setSimulationTimer((prev) => {
          const nextVal = prev <= 1 ? 0 : prev - 1;
          if (nextVal === 0) {
            clearInterval(interval);
          }
          localStorage.setItem('active_ride_timer', String(nextVal));
          // Dispatch custom event periodic update
          window.dispatchEvent(new CustomEvent('active_ride_changed', { detail: { timer: nextVal } }));
          return nextVal;
        });
      }, 1000);
    } else {
      localStorage.removeItem('active_ride_active');
      localStorage.removeItem('active_ride_driver');
      localStorage.removeItem('active_ride_destination');
      localStorage.removeItem('active_ride_timer');
    }
    return () => {
      active = false;
      clearInterval(interval);
      localStorage.removeItem('active_ride_active');
      localStorage.removeItem('active_ride_driver');
      localStorage.removeItem('active_ride_destination');
      localStorage.removeItem('active_ride_timer');
    };
  }, [step, selectedDriver, destination]);

  const handleScheduleRide = () => {
    if (!pickup.trim() || !destination.trim()) {
      setSearchError('Define pickup and destination first.');
      return;
    }
    const timerInMs = Date.parse(scheduledTime);
    if (isNaN(timerInMs) || timerInMs < Date.now()) {
      setSearchError('Select a valid future date and time.');
      return;
    }
    
    const newRide = {
      id: 'ride_' + Math.random().toString(36).substr(2, 9),
      pickup: pickup.trim(),
      destination: destination.trim(),
      scheduledTime: timerInMs,
      notified: false
    };
    
    const existingRaw = localStorage.getItem('konnects_scheduled_rides');
    let existingRides = [];
    try {
      existingRides = existingRaw ? JSON.parse(existingRaw) : [];
      if (!Array.isArray(existingRides)) {
        existingRides = [];
      }
    } catch {
      existingRides = [];
    }
    localStorage.setItem('konnects_scheduled_rides', JSON.stringify([...existingRides, newRide]));
    
    alert(`Success: Ride scheduled! Our Google Maps proactive monitoring will inspect live traffic & forecast delays to alert you of the perfect departure time.`);
    setScheduledTime('');
    setIsScheduling(false);
  };

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
      <header className="mb-8">
        <div className="flex justify-between items-center bg-transparent border-none">
          <div>
            <h1 className="text-2xl font-black tracking-tight mb-1 text-slate-900">London Rides</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">Find Nearby Drivers Instantly</p>
          </div>
          <div className="flex flex-col items-end space-y-1.5 border-none">
            <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full uppercase tracking-wider border border-indigo-100 flex items-center space-x-1 shrink-0">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping mr-1" />
              <span>London Active</span>
            </span>
            <QuickSOS compact />
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="booking-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Map Toggle Bar */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
              <div className="flex items-center space-x-2">
                <MapIcon size={14} className="text-indigo-500" />
                <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-350 tracking-wider">Nearby Active Drivers</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMapView(!isMapView)}
                className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                  isMapView
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isMapView ? 'Show Radar Concept' : 'Show Live Map'}
              </button>
            </div>

            {/* Offline Map Pre-Caching Alert Banner */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3 text-left">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <MapIcon size={16} />
                </div>
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">Offline Navigation Reliability</h4>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wide">
                    {isOfflineMapCached 
                      ? "✓ Hoxton Area Cached (14.5 MB)" 
                      : offlineProgress !== null 
                        ? `Downloading Map Asset: ${offlineProgress}%` 
                        : "Low-Signal Area Backup Available"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadMap}
                disabled={isOfflineMapCached || offlineProgress !== null}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border-none cursor-pointer ${
                  isOfflineMapCached 
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-450 cursor-default"
                    : offlineProgress !== null
                      ? "bg-amber-100 text-amber-700 animate-pulse cursor-wait"
                      : "bg-[#111827] dark:bg-indigo-650 text-white hover:bg-slate-850 active:scale-95"
                }`}
              >
                <Download size={11} />
                <span>{isOfflineMapCached ? "Pre-cached" : offlineProgress !== null ? "Saving..." : "Download Map Area"}</span>
              </button>
            </div>

            {isMapView ? (
              <div className="w-full h-44 bg-slate-950 rounded-[32px] relative overflow-hidden border border-slate-800 shadow-md">
                {/* Embedded Map Layer Controls */}
                <div className="absolute top-2 left-2 z-30 flex flex-col space-y-1 bg-slate-950/85 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-xl min-w-[110px]">
                  <span className="text-[7px] font-black uppercase tracking-wider text-slate-500 mb-0.5 px-1">Layers</span>
                  <button
                    type="button"
                    onClick={() => { haptics.light(); setMapLayers(prev => ({ ...prev, workers: !prev.workers })); }}
                    className={`px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase text-left flex items-center space-x-1 border transition-all ${
                      mapLayers.workers 
                        ? 'bg-indigo-600 border-indigo-400 text-white' 
                        : 'bg-transparent border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    <span>Drivers</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { haptics.light(); setMapLayers(prev => ({ ...prev, hubs: !prev.hubs })); }}
                    className={`px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase text-left flex items-center space-x-1 border transition-all ${
                      mapLayers.hubs 
                        ? 'bg-red-600 border-red-400 text-white' 
                        : 'bg-transparent border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
                    <span>Transit Hubs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { haptics.light(); setMapLayers(prev => ({ ...prev, bookings: !prev.bookings })); }}
                    className={`px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase text-left flex items-center space-x-1 border transition-all ${
                      mapLayers.bookings 
                        ? 'bg-emerald-600 border-emerald-400 text-white' 
                        : 'bg-transparent border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-full bg-teal-400 animate-ping" />
                    <span>Active Jobs</span>
                  </button>
                </div>

                {mapLoadError ? (
                  /* High fidelity tactical driver map overlay failsafe */
                  <div className="absolute inset-0 bg-slate-950 flex flex-col justify-between p-4 select-none">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,24,48,0.6)_0%,rgba(2,6,23,1)_100%)] opacity-95"></div>
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-[80px] h-[80px] border border-white/5 rounded-full"></div>
                      <div className="w-[160px] h-[160px] border border-white/5 rounded-full"></div>
                    </div>
                    
                    {/* Simulated driver dots */}
                    {mapLayers.workers && mockDrivers.map((drv, idx) => {
                      const offsets = [
                        { x: '35%', top: '30%' },
                        { x: '65%', top: '40%' },
                        { x: '50%', top: '75%' }
                      ];
                      const pos = offsets[idx % offsets.length];
                      return (
                        <button
                          key={drv.id}
                          type="button"
                          onClick={() => setHoveredDriver(drv)}
                          style={{ left: pos.x, top: pos.top }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none group bg-transparent border-none cursor-pointer z-10"
                        >
                          <span className="absolute w-6 h-6 rounded-full bg-indigo-500/20 group-hover:scale-125 transition-transform duration-200"></span>
                          <span className="absolute w-3 h-3 rounded-full bg-indigo-500/40"></span>
                          <div className="w-5 h-5 bg-indigo-600 rounded-full border-2 border-slate-950 flex items-center justify-center font-bold text-[7px] text-white">🚖</div>
                        </button>
                      );
                    })}

                    {/* Transit Hubs */}
                    {mapLayers.hubs && MOCK_HUBS.map((hub) => (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => setHoveredDriver({ driver: hub.title, car: 'London Public Transport Connector Hub', time: '1', id: hub.id })}
                        style={{ left: hub.x, top: hub.top }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none group bg-transparent border-none cursor-pointer z-10 animate-pulse"
                      >
                        <span className="absolute w-6 h-6 rounded-full bg-red-400/20"></span>
                        <div className="w-5 h-5 bg-red-600 rounded-lg border border-slate-950 flex items-center justify-center font-black text-[8px] text-white">🚇</div>
                      </button>
                    ))}

                    {/* Active Bookings */}
                    {mapLayers.bookings && MOCK_ACTIVE_BOOKINGS.map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setHoveredDriver({ driver: booking.title, car: 'Active Task Dispatch Coordination', time: '0', id: booking.id })}
                        style={{ left: booking.x, top: booking.top }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none group bg-transparent border-none cursor-pointer z-10"
                      >
                        <span className="absolute w-6 h-6 rounded-full bg-emerald-500/20 animate-ping"></span>
                        <div className="w-5 h-5 bg-emerald-500 rounded-full border border-slate-950 flex items-center justify-center font-black text-[8px] text-white">📦</div>
                      </button>
                    ))}

                    <div className="relative z-10 flex justify-between items-start self-end">
                      <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[7px] font-mono tracking-widest leading-none font-black animate-pulse">
                        MAP FAILSAFE ACTIVE
                      </span>
                    </div>

                    <div className="relative z-10 flex justify-between items-end">
                      <span className="text-[7.5px] font-mono text-slate-500 font-bold">Taxi GPS Beacons Active</span>
                      <span className="text-[7.5px] font-mono text-indigo-400 font-black uppercase tracking-wider">Click Blips</span>
                    </div>
                  </div>
                ) : (
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                    <Map
                      defaultCenter={{ lat: 51.5260, lng: -0.0780 }}
                      defaultZoom={14}
                      gestureHandling={'cooperative'}
                      disableDefaultUI={true}
                    >
                      {mapLayers.workers && mockDrivers.map((drv) => (
                        <Marker
                          key={drv.id}
                          position={DRIVER_COORDINATES[drv.id]}
                          onClick={() => setHoveredDriver(drv)}
                        />
                      ))}

                      {mapLayers.hubs && MOCK_HUBS.map((hub) => (
                        <Marker
                          key={hub.id}
                          position={{ lat: hub.lat, lng: hub.lng }}
                          onClick={() => setHoveredDriver({ driver: hub.title, car: 'London Public Transport Connector Hub', time: '1', id: hub.id })}
                        />
                      ))}

                      {mapLayers.bookings && MOCK_ACTIVE_BOOKINGS.map((booking) => (
                        <Marker
                          key={booking.id}
                          position={{ lat: booking.lat, lng: booking.lng }}
                          onClick={() => setHoveredDriver({ driver: booking.title, car: 'Active Task Dispatch Coordination', time: '0', id: booking.id })}
                        />
                      ))}
                    </Map>
                  </APIProvider>
                )}

                {hoveredDriver && (
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-950/90 text-white p-2.5 rounded-xl border border-slate-800 flex justify-between items-center z-20 backdrop-blur-xs">
                    <div>
                      <h5 className="text-[10px] font-bold text-white leading-none">{hoveredDriver.driver}</h5>
                      <p className="text-[8.5px] text-indigo-400 font-bold">{hoveredDriver.car}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-rose-455">min {hoveredDriver.time} away</p>
                      <button 
                        type="button"
                        onClick={() => setHoveredDriver(null)}
                        className="text-[8px] uppercase text-rose-400 hover:text-white font-black bg-transparent border-none cursor-pointer"
                      >
                        [x] Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Interactive Vector Map Track Overlay */
              <div className="w-full h-44 bg-slate-950 rounded-[32px] relative flex items-center justify-center overflow-hidden border border-slate-800 shadow-xl shadow-slate-950/20">
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-35"></div>
                {/* Animated Map Grids */}
                <div className="absolute w-24 h-24 border border-indigo-500/20 rounded-full flex items-center justify-center animate-ping opacity-35" />
                <div className="absolute w-44 h-44 border border-cyan-500/10 rounded-full flex items-center justify-center animate-pulse opacity-25" />
                
                <div className="relative z-10 flex flex-col items-center space-y-1.5">
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                    <NavIcon className="animate-pulse" size={20} />
                  </div>
                  <span className="text-[8px] font-mono font-black text-indigo-400 tracking-widest uppercase">GPS Live Tracking Ready</span>
                  <span className="text-[10px] text-slate-400 font-bold">Shoreditch Borough coordinates active</span>
                </div>
              </div>
            )}

            {/* Booking fields Card */}
            <div className="bg-white rounded-[36px] border border-slate-100 shadow-xl shadow-slate-200/25 p-7 space-y-5 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-brand/5 rounded-full -translate-y-12 translate-x-12" />
              
              <div className="space-y-4">
                <div className="relative pl-10 border-b border-slate-100 pb-5">
                  <div className="absolute left-0 top-2 w-4 h-4 rounded-full border-4 border-indigo-600 bg-white z-10"></div>
                  <div className="absolute left-[7px] top-[24px] bottom-0 w-0.5 bg-slate-100"></div>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em] mb-1.5">Pickup point</p>
                  <input 
                    type="text" 
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    className="w-full text-sm font-extrabold text-slate-800 placeholder:text-slate-300 focus:outline-none bg-transparent"
                    placeholder="Where are you now?"
                  />
                </div>
                
                <div className="relative pl-10 pt-2 pb-1">
                  <div className="absolute left-0 top-[28px] w-4 h-4 bg-slate-900 rounded-lg z-10 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                  </div>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em] mb-1.5">Dropoff destination</p>
                  <input 
                    type="text" 
                    placeholder="Enter destination borough or street..."
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      if (searchError) setSearchError('');
                    }}
                    className="w-full text-sm font-extrabold text-slate-800 placeholder:text-slate-300 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* AI Predictive Pricing & Historic Patterns Card */}
              {destination && (
                <div className="p-4 bg-slate-50 dark:bg-slate-905 rounded-3xl border border-slate-100 dark:border-slate-805 space-y-3 text-left">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-md text-[8px] font-black uppercase tracking-wider inline-block mb-1.5 font-mono">
                        📊 AI Historical Prediction
                      </span>
                      <h4 className="text-[11px] font-extrabold text-[#111827] dark:text-white tracking-tight flex items-center gap-1">
                        Historical Smart Fare Analyzer
                      </h4>
                    </div>
                    <span className="text-[14px] animate-pulse">🔮</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-50 dark:border-slate-800">
                      <span className="text-[8px] text-slate-400 dark:text-slate-400 font-extrabold uppercase tracking-wider block">Historic Fare Range</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 font-mono">£11.40 - £13.80</span>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-50 dark:border-slate-800">
                      <span className="text-[8px] text-slate-400 dark:text-slate-400 font-extrabold uppercase tracking-wider block">Demand Trend index</span>
                      <span className="text-xs font-black text-emerald-600 font-mono">📉 -5.4% Lower</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-50 dark:border-slate-800">
                      <span className="text-[8px] text-slate-400 dark:text-slate-400 font-extrabold uppercase tracking-wider block">Predicted Cab Dispatch</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 font-mono">4.5 mins arrival</span>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-50 dark:border-slate-800">
                      <span className="text-[8px] text-slate-400 dark:text-slate-400 font-extrabold uppercase tracking-wider block">Route Traffic Log</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">Moderate Level</span>
                    </div>
                  </div>

                  <p className="text-[8.5px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed bg-transparent">
                    *Estimates auto-calculated by cross-referencing Shoreditch historic GPS latency records & average weekday transit patterns stored in database.
                  </p>
                </div>
              )}

              {searchError && (
                <div className="p-3 bg-rose-50 border border-rose-100/60 rounded-xl flex items-center space-x-2 text-[10px] text-rose-600 font-bold">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Scheduling Trigger Toggle Component */}
              <div className="space-y-2 border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={() => setIsScheduling(!isScheduling)}
                  className="w-full flex items-center justify-between text-left p-1 text-[10px] font-black uppercase tracking-wider text-indigo-650 hover:text-indigo-800 bg-transparent border-none cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">📅 {isScheduling ? 'Cancel Scheduling' : 'Schedule Cab Transit for Later'}</span>
                  <span className="text-[8px]">{isScheduling ? 'COLLAPSE' : 'EXPAND'}</span>
                </button>

                <AnimatePresence>
                  {isScheduling && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200/60 overflow-hidden text-left"
                    >
                      <div>
                        <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Target Departure Date and Time</label>
                        <input
                          type="datetime-local"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleScheduleRide}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none"
                      >
                        Confirm Scheduled Ride Booking
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Real-time London Transit Peak Traffic routing intelligence block */}
              {destination && tflSuggestion && (
                <div className="space-y-4 border-t border-slate-100 pt-4 text-left">
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/70 flex items-start space-x-3">
                    <Activity className="text-amber-600 shrink-0 mt-0.5 animate-pulse" size={16} />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-800 border border-amber-200/50 px-2 py-0.5 rounded">PM Peak Congestion Warning</span>
                        <span className="text-[8px] font-mono font-black text-slate-500">BST 18:18</span>
                      </div>
                      <p className="text-[10.5px] text-amber-900 leading-tight font-semibold">
                        London Highways & Bridge routes are suffering severe gridlocks. Cab eta would be delayed by <strong className="font-extrabold text-amber-955">+15-20 mins</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-100 flex space-x-1.5 font-bold">
                    <button
                      type="button"
                      onClick={() => { haptics.light(); setSelectedTransitMode('cab'); }}
                      className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 border-none cursor-pointer ${
                        selectedTransitMode === 'cab'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'bg-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Car size={13} />
                      <span>🚖 Cab Ride (Slow)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { haptics.light(); setSelectedTransitMode('hybrid'); }}
                      className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 border-none cursor-pointer ${
                        selectedTransitMode === 'hybrid'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'bg-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Train size={13} />
                      <span className="text-emerald-700 font-extrabold text-xs">🚇 Tube & Rail (Fast)</span>
                    </button>
                  </div>
                </div>
              )}

              {selectedTransitMode === 'cab' ? (
                <>
                  <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm border border-slate-100">
                        <PoundSterling size={14} />
                      </div>
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Estimated fare</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xl font-black text-slate-900">£{fare}</span>
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={handleFindDrivers}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4.5 rounded-[22px] font-black uppercase tracking-[0.15em] shadow-lg shadow-slate-900/10 active:scale-95 transition-all text-[11px] flex items-center justify-center space-x-2"
                  >
                    <span>Find Nearby Drivers</span>
                    <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                /* Hybrid transit route card */
                <div className="bg-slate-950 p-5 rounded-[24px] border border-slate-800 text-left text-white space-y-4 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-5 opacity-10 pointer-events-none scale-150">
                    <Train size={80} />
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-mono font-black uppercase tracking-widest text-indigo-400">OPTIMAL PEAK BYPASS ROUTING</span>
                      <h4 className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                        TfL Smart Rail Express
                      </h4>
                    </div>
                    <span className="text-[11px] font-black text-indigo-350 tracking-wider font-mono">
                      SAVE £{(parseFloat(fare) - parseFloat(tflSuggestion.costOnOyster)).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-3.5 text-xs text-slate-350 font-medium">
                    <div className="flex items-center space-x-2.5">
                      <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${tflSuggestion.lineColor}`}>
                        {tflSuggestion.tubeLine}
                      </span>
                      <span className="text-[10.5px] font-black text-white">{tflSuggestion.routeType}</span>
                    </div>
                    <p className="text-[9.5px] font-semibold font-mono text-slate-300 leading-normal pl-0.5">
                      Trajectory: {tflSuggestion.stations}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-805">
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                        ⏱️ Duration: {tflSuggestion.duration}
                      </p>
                      <p className="text-[9px] font-black text-slate-400 text-right uppercase tracking-widest">
                        🌱 Avoids: {tflSuggestion.carbonSaved}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900 rounded-2xl flex items-center justify-between border border-slate-800">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Oyster / Contactless Fare</span>
                      <p className="text-xl font-bold font-mono tracking-tight text-white">£{tflSuggestion.costOnOyster}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { haptics.success(); setShowTflTicketModal(true); }}
                      className="py-3 px-4.5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider border-none transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Ticket size={12} />
                      <span>Configure Boarding Card</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Voice Command Recurring Ride Patterns Summary */}
            {recurringSuggestions.length > 0 && (
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-[32px] p-6 text-white text-left space-y-4 shadow-xl border border-indigo-900/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Mic size={100} />
                </div>
                
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="bg-indigo-500/10 text-indigo-300 text-[7px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-indigo-500/20 inline-flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Voice Engine Insights</span>
                    </span>
                    <h3 className="text-xs font-black uppercase tracking-tight text-white leading-tight">
                      Suggested Recurring Cab Patterns
                    </h3>
                  </div>
                  <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                    <Clock size={14} className="animate-pulse" />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                  We detected recurring transit commands in your voice log history. Tap to instantly fill and configure your cab selection.
                </p>

                <div className="space-y-2.5">
                  {recurringSuggestions.map((pattern, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        haptics.success();
                        setDestination(pattern.destination);
                        setFare(pattern.fare);
                      }}
                      className="w-full p-3 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-2xl text-left transition-all active:scale-98 flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 bg-indigo-900/30 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white rounded-xl border border-indigo-800/30 transition-all">
                          <Mic size={12} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[11px] font-extrabold text-white truncate">{pattern.destination}</h4>
                          <p className="text-[8px] text-indigo-300 font-bold uppercase tracking-wide mt-0.5">
                            {pattern.frequency} • {pattern.times}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11.5px] font-black text-white font-mono block">£{pattern.fare}</span>
                        <span className="text-[7.5px] text-slate-500 font-bold uppercase block">{pattern.count}x used</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Suggestions */}
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Popular Quick Estimates</p>
                <span className="text-[9px] text-indigo-500 font-bold">Camden District</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { to: 'Camden Market', fare: '14.20' },
                  { to: 'Heathrow Airport', fare: '42.00' },
                  { to: 'Piccadilly Circus', fare: '9.80' },
                  { to: 'London Bridge', fare: '8.50' }
                ].map((item, id) => (
                  <button 
                    key={id}
                    onClick={() => setDestination(item.to)}
                    className="p-3.5 bg-white hover:bg-indigo-50/20 rounded-2xl border border-slate-100 text-left transition-all active:scale-95 flex flex-col justify-between h-20"
                  >
                    <span className="text-[10px] font-black text-slate-800 truncate block w-full">{item.to}</span>
                    <div className="flex justify-between items-center w-full mt-2">
                      <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider">ESTIMATE</span>
                      <span className="text-[11px] font-mono font-black text-slate-800">£{item.fare}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Available Verified Operators */}
            <div className="space-y-3.5 pt-2">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available Verified Operators</p>
                <div className="flex items-center space-x-1">
                  <Shield size={10} className="text-emerald-500 fill-emerald-100/60" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">Active DBS Insured</span>
                </div>
              </div>

              {/* Sorting Filter Selector */}
              <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 pl-1.5">Sort Drivers:</span>
                <div className="flex space-x-1">
                  {[
                    { id: 'price', label: 'Price' },
                    { id: 'time', label: 'Departure' },
                    { id: 'rating', label: 'Rating' }
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => { haptics.light(); setSortBy(option.id as any); }}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                        sortBy === option.id 
                          ? 'bg-slate-900 text-white shadow-sm font-extrabold' 
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {loading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((val) => (
                      <div key={val} className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between animate-pulse">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-11 h-11 bg-slate-100 rounded-2xl shrink-0" />
                          <div className="space-y-2">
                            <div className="h-3 bg-slate-100 rounded-full w-24" />
                            <div className="h-2.5 bg-slate-50 rounded-full w-14" />
                          </div>
                        </div>
                        <div className="h-6 bg-slate-100 rounded-lg w-10 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  sortedDrivers.map((driver) => (
                    <div 
                      key={driver.id}
                      className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between transition-all hover:border-slate-200"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="w-11 h-11 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
                          <Car size={18} className="text-slate-700" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-black text-slate-800">{driver.driver}</span>
                            <span className="text-[9px] font-mono font-black text-indigo-500">({driver.time})</span>
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 leading-none">{driver.car}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <div className="flex items-center space-x-1 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-100/50">
                          <Star size={9} className="text-amber-500 fill-amber-500" />
                          <span className="text-[8.5px] font-black text-amber-700">{driver.rating}</span>
                        </div>
                        {driver.isVerifiedSafe && (
                          <div className="flex items-center space-x-1 bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5 border border-emerald-100/40 text-[7.5px] font-black uppercase tracking-widest">
                            <Shield size={9} className="text-emerald-500 fill-emerald-50/60 shrink-0" />
                            <span>Safe Ride</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Safety & Trust banner */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-100/50 rounded-3xl flex items-start space-x-3.5">
              <div className="p-2.2 bg-white text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                <Shield size={16} />
              </div>
              <div>
                <h4 className="font-extrabold text-[10px] text-slate-800 uppercase tracking-wider mb-0.5">Licensed TFL Operators</h4>
                <p className="text-[9px] text-slate-500 leading-relaxed font-semibold">Every driver is UK background checked, licensed, and drives a hybrid or zero-emissions vehicle.</p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="searching-drivers"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex flex-col items-center justify-center text-center space-y-8 py-10"
          >
            {/* Pulsing Radar Ring Animation */}
            <div className="relative w-48 h-48 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.2px,transparent_1.2px)] [background-size:12px_12px] opacity-40"></div>
              
              {/* Radar sweeps */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-indigo-500/20 rounded-full origin-center"
              />
              {/* Outer pulsing ring */}
              <span className="absolute w-36 h-36 border border-indigo-500/30 rounded-full animate-ping opacity-45" />
              <span className="absolute w-24 h-24 border border-cyan-400/20 rounded-full animate-pulse" />

              <div className="relative z-10 flex flex-col items-center">
                <Car className="text-white animate-bounce mb-1.5" size={28} />
                <span className="text-[9px] text-indigo-400 font-mono font-black tracking-widest uppercase">PINGING DRIVERS</span>
              </div>
            </div>

            <div className="space-y-2 max-w-sm">
              <h3 className="font-extrabold text-slate-800 uppercase tracking-wider text-xs">Finding Nearby Drivers</h3>
              <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase font-black">Connecting to Shoreditch fleet ({mockDrivers.length} matched nearby)</p>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold max-w-xs mx-auto pt-2">
                Drafting best ride fare proposal representing <span className="font-extrabold text-slate-800">£{fare}</span> to local background-checked operators.
              </p>
            </div>

            <div className="w-full max-w-xs bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3 }}
                className="bg-indigo-600 h-full rounded-full"
              />
            </div>

            <button
              onClick={() => {
                setStep(1);
                setSelectedDriver(null);
              }}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors font-black text-[10px] uppercase tracking-wider rounded-xl border-none outline-none"
            >
              Cancel Request
            </button>
          </motion.div>
        )}

        {step === 3 && selectedDriver && (
          <motion.div
            key="driver-active"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Live active dispatch card */}
            <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[32px] text-white flex items-center justify-between shadow-xl shadow-emerald-600/15 border border-emerald-500/10">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 bg-white/15 rounded-2xl">
                  <Check size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider">Driver Dispatch Dispatched</h4>
                  <p className="text-[8px] text-emerald-100 font-mono tracking-widest uppercase font-bold animate-pulse">Confirmed • On the Way</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono block opacity-85 uppercase">Fare</span>
                <span className="text-lg font-black font-mono">£{selectedDriver.price.toFixed(2)}</span>
              </div>
            </div>

            {/* Live map tracker / mock directions */}
            <div className="relative w-full h-44 bg-slate-950 rounded-[36px] overflow-hidden border border-slate-800 flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-35"></div>
              {/* Route lines */}
              <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-dashed border-t border-indigo-500/50"></div>
              
              {/* Pickup point */}
              <div className="absolute left-10 top-1/2 -mt-2 flex flex-col items-center">
                <span className="w-4 h-4 bg-white border-4 border-indigo-600 rounded-full relative z-10" />
                <span className="text-[7.5px] font-mono text-slate-400 uppercase tracking-wider mt-1.5">{pickup.split(' ')[0]}</span>
              </div>

              {/* Destination */}
              <div className="absolute right-10 top-1/2 -mt-2 flex flex-col items-center">
                <span className="w-4 h-4 bg-slate-800 border-4 border-emerald-400 rounded-full relative z-10 animate-pulse" />
                <span className="text-[7.5px] font-mono text-slate-400 uppercase tracking-wider mt-1.5 truncate max-w-[80px]">{destination}</span>
              </div>

              {/* Moving Car pin */}
              <motion.div 
                animate={{ x: [-80, 80] }}
                transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                className="absolute top-1/2 -mt-4 z-20 flex items-center justify-center"
              >
                <div className="p-1 px-1.5 bg-indigo-600 text-white rounded-lg shadow-lg flex items-center space-x-1 border border-indigo-400/40">
                  <Car size={10} />
                  <span className="text-[7px] font-mono font-bold">{selectedDriver.driver}</span>
                </div>
              </motion.div>

              <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 text-[8px] font-mono text-indigo-300">
                ETA: {selectedDriver.time} • GPS Live Active
              </div>
            </div>

            {/* Selected Driver detail file */}
            <div className="bg-white rounded-[36px] border border-slate-100 shadow-xl shadow-slate-200/20 p-6 space-y-5">
              <div className="flex justify-between items-start">
                <div className="flex space-x-3">
                  <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
                    <Car className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{selectedDriver.driver}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{selectedDriver.car}</p>
                    <div className="flex items-center space-x-1.5 flex-wrap gap-1 mt-1.5">
                      <div className="flex items-center space-x-1 bg-amber-50 rounded-md px-2 py-0.5 border border-amber-100/60">
                        <Star size={10} className="text-amber-500 fill-amber-500" />
                        <span className="text-[9px] font-black text-amber-700">{selectedDriver.rating} rating</span>
                      </div>
                      
                      {selectedDriver.isVerifiedSafe && (
                        <div className="flex items-center space-x-1 bg-emerald-50 text-emerald-700 rounded-md px-1.5 py-0.5 border border-emerald-100 text-[8.5px] font-black uppercase tracking-wider">
                          <Shield size={10} className="text-emerald-600 fill-emerald-150 animate-pulse shrink-0" />
                          <span>Safe Ride Vetted</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-1.5">
                  <a 
                    href={`tel:${selectedDriver.phone}`}
                    className="p-3 bg-slate-50 border border-slate-100 hover:bg-slate-100 active:scale-95 transition-all text-slate-600 rounded-2xl flex items-center justify-center cursor-pointer"
                    title="Call driver"
                  >
                    <Phone size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if ((window as any).__openAssistantWithMessage) {
                        (window as any).__openAssistantWithMessage(
                          `Can you help me send a message to my driver ${selectedDriver.driver}?`
                        );
                      }
                    }}
                    className="p-3 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 active:scale-95 transition-all rounded-2xl flex items-center justify-center cursor-pointer border-none"
                    title="Send chat helper"
                  >
                    <MessageSquare size={14} />
                  </button>
                </div>
              </div>

              {/* Dynamic stats tracker row */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100/70 text-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Time Remaining</span>
                  <span className="text-sm font-black text-slate-800 font-mono uppercase">{simulationTimer > 0 ? `${Math.floor(simulationTimer / 60)}m ${simulationTimer % 60}s` : 'Arrived!'}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100/70 text-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Safety Status</span>
                  <span className="text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center justify-center">
                    <Shield size={10} className="mr-1 fill-emerald-50" /> Secure
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setSelectedDriver(null);
                  }}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 border-none outline-none"
                >
                  Cancel Ride
                </button>
                
                <button
                  type="button"
                  onClick={async () => {
                    haptics.success();
                    // Trigger custom immersive Framer Motion animation instead of standard dialog alert
                    setShowCompletionAnim(true);
                    
                    // Trigger haptic beacon pulse midway for feeling tactile milestones
                    setTimeout(() => {
                      haptics.beacon();
                    }, 1500);

                    if (user && profile) {
                      try {
                        const currentPoints = profile.rewardsPoints || 0;
                        const currentCarbon = profile.carbonSavingsKg || 17.5;
                        const nextPoints = currentPoints + 120;
                        const nextCarbon = Number((currentCarbon + 15.5).toFixed(1));
                        
                        // Compute dynamic badges array
                        const earned = [...(profile.earnedBadges || ['pioneer'])];
                        if (nextCarbon >= 10 && !earned.includes('green_pioneer')) {
                          earned.push('green_pioneer');
                        }
                        if (nextCarbon >= 50 && !earned.includes('green_climber')) {
                          earned.push('green_climber');
                        }
                        if (nextCarbon >= 100 && !earned.includes('green_hero')) {
                          earned.push('green_hero');
                        }
                        if (nextCarbon >= 250 && !earned.includes('green_master')) {
                          earned.push('green_master');
                        }

                        await updateDoc(doc(db, 'users', user.uid), {
                          rewardsPoints: nextPoints,
                          carbonSavingsKg: nextCarbon,
                          earnedBadges: earned,
                          updatedAt: serverTimestamp()
                        });
                      } catch (err) {
                        console.error('Failed to update carbon and points:', err);
                      }
                    }

                    // Leave it visible for 4.2s so user can view the progress visualizer bar animate to the end
                    setTimeout(() => {
                      haptics.success();
                      setShowCompletionAnim(false);
                      setStep(1);
                      setLastCompletedDriver(selectedDriver);
                      setSelectedDriver(null);
                      setFeedbackRating(5);
                      setFeedbackComment('');
                      setShowFeedbackModal(true);
                    }, 4200);
                  }}
                  className="py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-lg border-none cursor-pointer"
                >
                  Mark Arrived
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TfL & National Rail Boarding Card modal overlay */}
      <AnimatePresence>
        {showTflTicketModal && tflSuggestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-slate-800"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 15 }}
              className="bg-white rounded-[36px] w-full max-w-sm overflow-hidden border border-slate-101 shadow-2xl relative"
            >
              <div className="absolute top-4 right-4 z-10">
                <button
                  type="button"
                  onClick={() => setShowTflTicketModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all border-none cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              {/* TfL Top Header decor */}
              <div className="bg-red-700 text-white px-6 py-5 text-left flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full border-4 border-white flex items-center justify-center font-black text-xs shrink-0 select-none">
                  tfl
                </div>
                <div>
                  <span className="text-[8px] font-black tracking-widest block uppercase text-white/70">TRANSPORT FOR LONDON</span>
                  <h4 className="text-xs font-black tracking-tight block uppercase">{tflSuggestion.tubeLine} Boarding Card</h4>
                </div>
              </div>

              <div className="p-6 space-y-5 text-left">
                {/* Dynamic QR block */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50/80 rounded-3xl border border-slate-100 shadow-inner relative">
                  <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[7.5px] font-black text-rose-500 font-mono tracking-widest uppercase mb-2">LIVE DYNAMIC BOARDING CODE</span>
                  
                  {/* Simulated Vector QR Design */}
                  <div className="w-32 h-32 bg-white rounded-2xl border-4 border-slate-950 flex flex-wrap p-2 shadow relative">
                    <div className="w-6 h-6 border-4 border-slate-950 rounded bg-transparent absolute top-2 left-2" />
                    <div className="w-6 h-6 border-4 border-slate-950 rounded bg-transparent absolute top-2 right-2" />
                    <div className="w-6 h-6 border-4 border-slate-950 rounded bg-transparent absolute bottom-2 left-2" />
                    <div className="absolute inset-8 border-2 border-slate-400 border-dashed rounded animate-pulse" />
                    <div className="w-full h-full flex flex-wrap content-center justify-center opacity-85 select-none font-mono text-[7px] text-slate-800 tracking-tight leading-tight pt-5 pl-7">
                      ■ ■ □ ■ □ ■ □<br />■ □ ■ ■ □ ■ ■<br />■ ■ □ ■ □ ■ □<br />□ ■ ■ □ ■ □ ■
                    </div>
                  </div>
                  
                  <span className="text-[8px] text-slate-450 font-bold uppercase mt-2.5">UK Contactless / Oyster Gateways Reader</span>
                </div>

                <div className="space-y-3 divide-y divide-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Selected Routing</p>
                    <p className="text-[11px] font-extrabold text-slate-800">{tflSuggestion.stations}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Price Charged</p>
                      <p className="text-sm font-black font-mono text-emerald-700">£{tflSuggestion.costOnOyster} (Oyster PayG)</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estimated Duration</p>
                      <p className="text-sm font-black font-mono text-indigo-750 uppercase">{tflSuggestion.duration}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">User Registered</p>
                      <p className="text-xs font-black text-slate-800">{profile?.username || 'Oyster Account Holder'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Environment Savings</p>
                      <p className="text-xs font-black text-emerald-600 uppercase">Save {tflSuggestion.carbonSaved} Carbon</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    haptics.success();
                    setShowTflTicketModal(false);
                    alert(`Oyster Boarding Ticket deployed to Google Wallet! Slashed contactless rate UK-DBS-CAP applied. Added carbon metrics (+${tflSuggestion.carbonSaved}) successfully.`);
                    
                    if (user && profile) {
                      try {
                        const currentPoints = profile.rewardsPoints || 0;
                        const currentCarbon = profile.carbonSavingsKg || 17.5;
                        const addition = parseFloat(tflSuggestion.carbonSaved.replace(/[^\d.-]/g, '')) || 1.2;
                        
                        await updateDoc(doc(db, 'users', user.uid), {
                          rewardsPoints: currentPoints + 45, // Bonus reward for choosing train!
                          carbonSavingsKg: Number((currentCarbon + addition).toFixed(1)),
                          updatedAt: serverTimestamp()
                        });
                      } catch (err) {
                        console.error('Failed to sync ticket rewards:', err);
                      }
                    }
                  }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[20px] font-black uppercase tracking-[0.15em] text-[10px] border-none shadow-md transition-all active:scale-95 cursor-pointer text-center"
                >
                  Confirm Dynamic Gate Entry (£{tflSuggestion.costOnOyster})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immersive Ride Completion Framer Motion Overlay */}
      <AnimatePresence>
        {showCompletionAnim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0, transition: { type: "spring", damping: 15 } }}
              exit={{ scale: 0.9, y: -20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-8 shadow-2xl border border-slate-100 dark:border-slate-850 space-y-6 flex flex-col items-center justify-center relative overflow-hidden text-slate-900 dark:text-white"
            >
              {/* Background Glows */}
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-400/10 dark:bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-400/10 dark:bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

              {/* Success Badge */}
              <div className="relative flex items-center justify-center w-24 h-24">
                {/* Glowing ring */}
                <motion.div
                  initial={{ rotate: 0, scale: 0.8 }}
                  animate={{ rotate: 360, scale: 1 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border border-dashed border-emerald-500/40"
                />
                <motion.div
                  initial={{ rotate: 360, scale: 0.9 }}
                  animate={{ rotate: 0, scale: 1.05 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-2 rounded-full border border-double border-indigo-500/40"
                />
                
                {/* Check Circle */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
                  className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-250 dark:shadow-none"
                >
                  <Check size={32} strokeWidth={3} className="animate-pulse" />
                </motion.div>
              </div>

              {/* Copy */}
              <div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
                  className="text-xl font-black tracking-tight text-slate-900 dark:text-white"
                >
                  Ride Completed!
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.6 } }}
                  className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1"
                >
                  Arrived safely at {destination || "London Hub"}
                </motion.p>
              </div>

              {/* Progress Steps Simulation to show real-time process */}
              <div className="w-full bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-100 dark:border-slate-850 text-left space-y-2.5">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-2 h-2 bg-emerald-500 rounded-full"
                  />
                  <span className="text-[10px] font-bold text-slate-705 dark:text-slate-300">
                    Slashed congestion route confirmed.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                    className="w-2 h-2 bg-indigo-550 rounded-full"
                  />
                  <span className="text-[10px] font-bold text-slate-705 dark:text-slate-300">
                    Crediting ecosystem rewards...
                  </span>
                </div>
              </div>

              {/* Statistics Staggered Entrance */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0, transition: { delay: 0.8 } }}
                  className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/40 text-center"
                >
                  <Sparkles size={16} className="text-amber-500 mx-auto mb-1" />
                  <span className="text-xs font-black text-amber-600 block">+120 RP</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#a16207]">Konnect Points</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0, transition: { delay: 1.0 } }}
                  className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-center"
                >
                  <Activity size={16} className="text-emerald-500 mx-auto mb-1" />
                  <span className="text-xs font-black text-emerald-600 block">+15.5 kg</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#047857]">CO₂ Prevented</span>
                </motion.div>
              </div>

              {/* Progress visualizer fill bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4.2 }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-Ride Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 text-slate-800"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-[36px] w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 shadow-2xl p-6 relative flex flex-col space-y-5"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-3 font-sans">
                  <Star size={24} className="fill-current" />
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">How was your ride?</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                  Rate your trip with {lastCompletedDriver?.driver || "your driver"}
                </p>
              </div>

              {/* Star Selector */}
              <div className="flex justify-center items-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      haptics.light();
                      setFeedbackRating(star);
                    }}
                    className="p-1 transition-transform active:scale-95 bg-transparent border-none cursor-pointer"
                  >
                    <Star
                      size={28}
                      className={`transition-colors ${
                        star <= feedbackRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-200 dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Written comment input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Write a comment (optional)
                </label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Tell us about the driver, route, or climate savings..."
                  rows={3}
                  className="w-full text-xs font-semibold p-3.5 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-150 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Feedback submit buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setShowFeedbackModal(false);
                  }}
                  className="py-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  Skip Feedback
                </button>
                <button
                  type="button"
                  disabled={isSubmittingFeedback}
                  onClick={async () => {
                    setIsSubmittingFeedback(true);
                    haptics.success();
                    
                    const feedbackPayload = {
                      rating: feedbackRating,
                      comment: feedbackComment || 'No written comments left.',
                      driver_name: lastCompletedDriver?.driver || 'General Driver',
                      car: lastCompletedDriver?.car || 'N/A',
                      customer_id: user?.uid || 'anonymous-user',
                      created_at: new Date().toISOString()
                    };

                    try {
                      if (isSupabaseConfigured() && supabase) {
                        const { error } = await (supabase.from('feedback') as any).insert([feedbackPayload]);
                        if (error) throw error;
                        logSyncEvent('feedback', 'feedback-' + Date.now(), 'ADDED', `Star rating: ${feedbackRating}/5`, 'success', 'success');
                      } else {
                        // Simulate Supabase feedback write
                        console.log('[Simulation] Post feedback written to Supabase feedback table:', feedbackPayload);
                        logSyncEvent('feedback', 'feedback-' + Date.now(), 'ADDED', `Star rating: ${feedbackRating}/5`, 'success', 'simulated');
                      }
                    } catch (submitErr: any) {
                      console.error('Failed feedback write:', submitErr);
                      logSyncEvent('feedback', 'feedback-' + Date.now(), 'ADDED', `Star rating: ${feedbackRating}/5`, 'success', 'failed', submitErr.message);
                    } finally {
                      setIsSubmittingFeedback(false);
                      setShowFeedbackModal(false);
                    }
                  }}
                  className="py-3.5 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-lg border-none hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingFeedback ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
