/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Navigation, MapPin, Briefcase, Zap, Info, ShieldAlert, Sliders, AlertTriangle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ServiceBooking } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

export function MapView({ onBack }: { onBack: () => void }) {
  const { profile } = useAuth();
  const [center, setCenter] = useState({ lat: 51.5074, lng: -0.1278 }); // London
  const [activeBookings, setActiveBookings] = useState<ServiceBooking[]>([]);
  const [workerLocations, setWorkerLocations] = useState<Record<string, { lat: number; lng: number; eta: number; speed: number }>>({});
  const [simulateDemo, setSimulateDemo] = useState(true);
  
  // Custom Map Error & Fallback state
  const [mapLoadError, setMapLoadError] = useState(Boolean((window as any).gmapsHasFailed) || !GOOGLE_MAPS_API_KEY);
  const [zoomLevel, setZoomLevel] = useState(13); // Zoom multiplier for fallback map
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, lat: 51.5074, lng: -0.1278 });

  // Load real active bookings
  useEffect(() => {
    if (!profile?.uid) return;
    
    // Query active accepted bookings for customer
    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', profile.uid),
      where('status', '==', 'accepted')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceBooking));
      setActiveBookings(bookings);
    }, () => {
      // Fail silently
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  // Combined real/simulated bookings list
  const mockBooking: ServiceBooking = {
    id: 'sim-booking-plumber',
    customerId: profile?.uid || 'user-123',
    serviceType: 'Urgent Plumber',
    description: 'Resolving bathroom pipe leakage',
    status: 'accepted',
    price: 38,
    pickupLocation: {
      lat: 51.5134,
      lng: -0.1128,
      address: 'Holborn, London'
    },
    expiresAt: null,
    createdAt: null
  };

  const bookingsToDisplay = simulateDemo 
    ? [...activeBookings, mockBooking]
    : activeBookings;

  // Real-time worker position simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkerLocations(prev => {
        const next = { ...prev };
        bookingsToDisplay.forEach(booking => {
          const destLat = booking.pickupLocation?.lat || booking.location?.lat || 51.5074;
          const destLng = booking.pickupLocation?.lng || booking.location?.lng || -0.1278;
          
          if (!next[booking.id]) {
            // Start worker about ~0.01 degree offset (approx 1.2km)
            next[booking.id] = {
              lat: destLat + 0.007,
              lng: destLng - 0.006,
              eta: 10,
              speed: 28
            };
          } else {
            const curr = next[booking.id];
            const latDiff = destLat - curr.lat;
            const lngDiff = destLng - curr.lng;
            const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
            
            if (dist > 0.0003) {
              const step = 0.06 + Math.random() * 0.04; // Smooth interpolation steps
              next[booking.id] = {
                lat: curr.lat + latDiff * step,
                lng: curr.lng + lngDiff * step,
                eta: Math.max(1, curr.eta - 1),
                speed: Math.floor(Math.random() * 12) + 18
              };
            } else {
              // Stay closely near the service location
              next[booking.id] = {
                lat: destLat,
                lng: destLng,
                eta: 0,
                speed: 0
              };
            }
          }
        });
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [bookingsToDisplay]);

  // Setup Global auth failure and console error interception to catch ApiProjectMapError
  useEffect(() => {
    const originalAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps Auth Failure intercepted. Enabling Vector Radar Failsafe Mode.");
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
        setMapLoadError(true);
      }
      originalConsoleError.apply(console, args);
    };

    // If key is empty string, we can trigger fallback immediately to provide optimal initial load feel
    if (!GOOGLE_MAPS_API_KEY) {
      (window as any).gmapsHasFailed = true;
      setMapLoadError(true);
    }

    return () => {
      (window as any).gm_authFailure = originalAuthFailure;
      console.error = originalConsoleError;
    };
  }, []);

  // Center on worker if requested
  const handleRecenter = () => {
    if (bookingsToDisplay.length > 0) {
      const firstId = bookingsToDisplay[0].id;
      const loc = workerLocations[firstId];
      if (loc) {
        setCenter({ lat: loc.lat, lng: loc.lng });
      }
    } else {
      setCenter({ lat: 51.5074, lng: -0.1278 });
    }
  };

  // Convert GPS Coordinates to Local 2D Vector positions around 'center' viewport
  const getProjectedCoords = (lat: number, lng: number) => {
    const latDiff = lat - center.lat;
    const lngDiff = lng - center.lng;

    // Zoom factor scaling
    const scaleFactor = (zoomLevel - 8) * 450;
    
    const x = 50 + (lngDiff * scaleFactor);
    const y = 50 - (latDiff * scaleFactor); // Invert Y because lat goes up to North
    
    return { x: `${x}%`, y: `${y}%`, rawX: x, rawY: y };
  };

  // Drag interaction for our custom interactive map fallback
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      lat: center.lat,
      lng: center.lng
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    // Convert pixel deltas to GPS approximate degrees delta
    const scaleFactor = (zoomLevel - 8) * 450;
    const dLng = -(dx / scaleFactor) * 0.1;
    const dLat = (dy / scaleFactor) * 0.1;

    setCenter({
      lat: dragStart.current.lat + dLat,
      lng: dragStart.current.lng + dLng
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile viewport
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      lat: center.lat,
      lng: center.lng
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;

    const scaleFactor = (zoomLevel - 8) * 450;
    const dLng = -(dx / scaleFactor) * 0.1;
    const dLat = (dy / scaleFactor) * 0.1;

    setCenter({
      lat: dragStart.current.lat + dLat,
      lng: dragStart.current.lng + dLng
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-[120] flex flex-col max-w-md mx-auto">
      <header className="p-4 bg-white border-b border-slate-100 flex items-center justify-between absolute top-0 left-0 right-0 z-50">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-all w-10 h-10 flex items-center justify-center">
             <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-sm text-slate-900 leading-tight">Live Service Map</h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tracking active worker pros</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {mapLoadError && (
            <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center space-x-1 animate-pulse border border-amber-100">
               <Zap size={10} className="text-amber-500 fill-amber-500" />
               <span>RADAR FALLBACK</span>
            </span>
          )}
          <button 
            onClick={handleRecenter}
            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all"
            title="Center on Worker"
          >
            <Navigation size={16} className="text-slate-600" />
          </button>
        </div>
      </header>

      {/* Map Content Viewport */}
      <div className="flex-1 w-full h-full relative overflow-hidden select-none">
        {mapLoadError ? (
          /* High-Fidelity Interactive Vector Radar Failsafe Map */
          <div 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUpOrLeave}
            className={`w-full h-full bg-slate-950 relative overflow-hidden flex items-center justify-center cursor-grab ${
              isDragging ? "cursor-grabbing" : ""
            }`}
          >
            {/* Dark radar background layers */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,24,48,1)_0%,rgba(2,6,23,1)_100%)] opacity-95"></div>
            
            {/* Concentric grid lines */}
            <div className="absolute w-[800px] h-[800px] pointer-events-none flex items-center justify-center">
              <div className="absolute w-[200px] h-[200px] border border-white/5 rounded-full"></div>
              <div className="absolute w-[400px] h-[400px] border border-white/5 rounded-full"></div>
              <div className="absolute w-[600px] h-[600px] border border-white/5 rounded-full"></div>
              <div className="absolute w-[800px] h-[800px] border border-white/5 rounded-full"></div>
              
              {/* Radial axis lines */}
              <div className="absolute w-full h-[1px] bg-white/5"></div>
              <div className="absolute h-full w-[1px] bg-white/5"></div>
              <div className="absolute w-full h-[1px] bg-white/5 rotate-45"></div>
              <div className="absolute w-full h-[1px] bg-white/5 -rotate-45"></div>
            </div>

            {/* Simulated Street Outlines (Subtle aesthetic grid) */}
            <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none select-none">
              <pattern id="street-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#street-grid)" />
            </svg>

            {/* GPS Horizon boundary guides */}
            <div className="absolute bottom-16 left-6 text-[9px] text-white/20 font-mono tracking-widest pointer-events-none">
              GRID: LND-O1 • ZOOM {zoomLevel}X • CLat: {center.lat.toFixed(4)} • CLng: {center.lng.toFixed(4)}
            </div>

            {/* Authorization Warning Indicator */}
            <div className="absolute top-20 left-4 right-4 bg-amber-950/80 border border-amber-500/30 backdrop-blur-sm p-3 rounded-2xl flex items-start space-x-2.5 shadow-xl pointer-events-none shrink-0 z-40 max-w-[380px] mx-auto">
              <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <p className="font-bold text-[10px] text-amber-200 leading-snug">Google Maps Auth Intercepted (ApiProjectMapError)</p>
                <p className="text-[9px] text-amber-300/80 leading-relaxed mt-0.5">Continuing safely with high-fidelity coordinate-projected active radar tracking.</p>
              </div>
            </div>

            {/* Map Markers Overlay */}
            {bookingsToDisplay.map(booking => {
              const destLat = booking.pickupLocation?.lat || booking.location?.lat || 51.5074;
              const destLng = booking.pickupLocation?.lng || booking.location?.lng || -0.1278;
              const destPos = getProjectedCoords(destLat, destLng);
              
              const workerPos = workerLocations[booking.id];
              const workerProj = workerPos ? getProjectedCoords(workerPos.lat, workerPos.lng) : null;

              return (
                <div key={booking.id} className="absolute inset-0 pointer-events-none">
                  {/* Destination Marker */}
                  <div 
                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                    style={{ left: destPos.x, top: destPos.y }}
                  >
                    <div className="relative flex items-center justify-center">
                      <span className="absolute w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 animate-pulse"></span>
                      <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg relative z-10 flex items-center justify-center">
                        <MapPin size={14} strokeWidth={2.5} />
                      </div>
                      <span className="absolute left-10 bg-slate-900/90 text-[8px] text-emerald-300 font-black uppercase tracking-widest py-1 px-2.5 rounded-lg border border-white/5 shadow-xl whitespace-nowrap">
                        Job Site
                      </span>
                    </div>
                  </div>

                  {/* SVG Route Connection Line */}
                  {workerProj && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <line 
                        x1={workerProj.rawX + "%"} 
                        y1={workerProj.rawY + "%"} 
                        x2={destPos.x} 
                        y2={destPos.y} 
                        stroke="rgba(99, 102, 241, 0.3)" 
                        strokeWidth="2" 
                        strokeDasharray="6,4"
                      />
                    </svg>
                  )}

                  {/* Worker Live GPS Dot */}
                  {workerProj && (
                    <div 
                      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000"
                      style={{ left: workerProj.x, top: workerProj.y }}
                    >
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-12 h-12 rounded-full bg-indigo-500/20 animate-ping"></span>
                        <span className="absolute w-6 h-6 rounded-full bg-indigo-500/40 animate-pulse"></span>
                        <div className="p-2.5 bg-indigo-600 text-white rounded-full shadow-lg relative z-10 border-2 border-slate-950 flex items-center justify-center">
                          <Navigation size={12} className="rotate-45" strokeWidth={3} />
                        </div>
                        <span className="absolute bottom-9 bg-indigo-600 text-[8px] text-white font-black uppercase tracking-widest py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap">
                           Worker Active
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Standard Google Maps Canvas */
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <Map
              center={center}
              onCenterChanged={(ev) => setCenter(ev.detail.center)}
              defaultZoom={13}
              gestureHandling={'greedy'}
              disableDefaultUI={true}
            >
              {/* Draw service destinations */}
              {bookingsToDisplay.map(booking => {
                const destLat = booking.pickupLocation?.lat || booking.location?.lat || 51.5074;
                const destLng = booking.pickupLocation?.lng || booking.location?.lng || -0.1278;
                return (
                  <Marker 
                    key={`dest-${booking.id}`}
                    position={{ lat: destLat, lng: destLng }} 
                    title={`${booking.serviceType} Site`}
                  />
                );
              })}
              
              {/* Draw real-time worker location */}
              {bookingsToDisplay.map(booking => {
                const workerPos = workerLocations[booking.id];
                if (!workerPos) return null;
                return (
                  <Marker 
                    key={`worker-${booking.id}`}
                    position={{ lat: workerPos.lat, lng: workerPos.lng }} 
                    title={`${booking.serviceType} Worker - Moving`}
                  />
                );
              })}
            </Map>
          </APIProvider>
        )}

        {/* Floating Controls with Adaptive Map Toggle & Layer settings */}
        <div className="absolute bottom-8 right-4 space-y-3 z-40">
           {mapLoadError && (
             <div className="flex flex-col space-y-2 bg-slate-900/90 backdrop-blur-md rounded-2xl p-1.5 border border-white/5 shadow-xl">
               <button 
                 onClick={() => setZoomLevel(prev => Math.min(18, prev + 1))}
                 className="w-9 h-9 text-xs font-black bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors"
                 title="Zoom In"
               >
                 +
               </button>
               <button 
                 onClick={() => setZoomLevel(prev => Math.max(9, prev - 1))}
                 className="w-9 h-9 text-xs font-black bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors"
                 title="Zoom Out"
               >
                 -
               </button>
             </div>
           )}

           <button 
             onClick={() => setCenter({ lat: 51.5074, lng: -0.1278 })} 
             className={`w-11 h-11 rounded-xl shadow-lg flex items-center justify-center transition-all ${
               mapLoadError ? "bg-slate-900 text-white border border-white/10 hover:bg-slate-800" : "bg-white text-slate-600 hover:bg-slate-50"
             }`}
           >
              <Navigation size={18} />
           </button>
           <button 
             onClick={handleRecenter}
             className="w-11 h-11 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-all"
           >
              <MapPin size={18} />
           </button>
        </div>
      </div>

      {/* Drawer and job tracking panel */}
      <div className="p-6 bg-white rounded-t-[40px] shadow-[0_-10px_25px_rgba(0,0,0,0.05)] -mt-10 relative z-50 max-h-[42vh] overflow-y-auto no-scrollbar">
         <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-4"></div>
         
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">
              {bookingsToDisplay.length > 0 ? "Live Job Tracker" : "Recommended for you"}
            </h3>
            <button 
              onClick={() => setSimulateDemo(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                simulateDemo ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-slate-150 text-slate-500 hover:bg-slate-200"
              }`}
            >
              Demo Simulation: {simulateDemo ? "ACTIVE" : "OFF"}
            </button>
         </div>

         <div className="space-y-4">
            {bookingsToDisplay.length === 0 ? (
               <div className="p-5 bg-slate-50 rounded-3xl text-center">
                  <p className="text-xs text-slate-500 font-bold">No active service jobs.</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Enable "Demo Simulation" at the top to preview live physical worker tracking on the map immediately.</p>
               </div>
            ) : (
              bookingsToDisplay.map(booking => {
                const loc = workerLocations[booking.id] || { lat: 51.5074, lng: -0.1278, eta: 10, speed: 28 };
                return (
                  <div key={booking.id} className="p-5 bg-slate-900 text-white rounded-[32px] border border-slate-800 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 animate-pulse">
                      <Briefcase size={48} />
                    </div>
                    
                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <div>
                        <span className="px-2.5 py-1 bg-indigo-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest inline-block mb-2 animate-pulse">
                          Worker On The Way
                        </span>
                        <h4 className="font-bold text-sm capitalize">{booking.serviceType}</h4>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{booking.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">ETA</p>
                        <p className="text-lg font-black">{loc.eta} min</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5 relative z-10">
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Estimated Speed</p>
                        <p className="font-bold text-xs text-white">{loc.speed} mph</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">GPS Position Status</p>
                        <p className="font-bold text-xs text-indigo-400">
                          {loc.eta > 0 ? `${(loc.eta * 0.15).toFixed(2)} miles away` : "Arrived at location"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-4">
                      <motion.div 
                        className="h-full bg-indigo-500"
                        animate={{ width: `${Math.min(100, Math.max(10, 100 - (loc.eta * 10)))}%` }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            {bookingsToDisplay.length === 0 && (
               <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                  <div>
                     <p className="font-bold text-sm">Best Rated Mechanic</p>
                     <p className="text-xs text-slate-500">0.8 miles away • London Central</p>
                  </div>
                  <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">Details</button>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
