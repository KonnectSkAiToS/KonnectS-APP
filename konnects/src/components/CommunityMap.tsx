import { useState } from 'react';
import { MapPin, Info, Users, Tag, Award, Zap, Heart, MessageSquare, ShieldCheck, X, Navigation, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { haptics } from '../utils/haptics';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

interface CommunityPin {
  id: string;
  title: string;
  type: 'request' | 'help';
  category: 'delivery' | 'trades' | 'care' | 'food' | 'environment';
  description: string;
  address: string;
  rewardPoints: number;
  providerName: string;
  latOffset: number; // For custom vector grid offset [-0.5 to 0.5]
  lngOffset: number; // For custom vector grid offset [-0.5 to 0.5]
  latitude: number;
  longitude: number;
  icon: string;
  status: 'pending' | 'accepted' | 'completed';
}

const SEEDED_PINS: CommunityPin[] = [
  {
    id: 'cpin-1',
    title: 'Elderly Garden Tidy Assistance',
    type: 'request',
    category: 'care',
    description: 'Help clearing fallen branches and mowing the lawn for Mrs. Gable at Hoxton Close. Tools are provided.',
    address: 'Hoxton Close, Shoreditch',
    rewardPoints: 250,
    providerName: 'Resident Association',
    latOffset: -0.15,
    lngOffset: 0.22,
    latitude: 51.5272,
    longitude: -0.0765,
    icon: '🌿',
    status: 'pending'
  },
  {
    id: 'cpin-2',
    title: 'Surplus Food Distribution Point',
    type: 'help',
    category: 'food',
    description: 'Fresh organic vegetables and bakery excess donated by local supermarkets. Open to all who need it.',
    address: 'St. Leonard’s Crypt Hall, Shoreditch',
    rewardPoints: 50,
    providerName: 'KonnectS Food Hub',
    latOffset: 0.35,
    lngOffset: -0.1,
    latitude: 51.5285,
    longitude: -0.0795,
    icon: '🍲',
    status: 'pending'
  },
  {
    id: 'cpin-3',
    title: 'Wheelchair Ramp Setup Help',
    type: 'request',
    category: 'trades',
    description: 'Need a handy helper to assemble an aluminum threshold fold-out ramp onto a local cafe door step.',
    address: 'Boundary Street, London',
    rewardPoints: 300,
    providerName: 'Hackney Accessibility',
    latOffset: -0.25,
    lngOffset: -0.3,
    latitude: 51.5242,
    longitude: -0.0810,
    icon: '♿',
    status: 'pending'
  },
  {
    id: 'cpin-4',
    title: 'Free Digital Literacy Class',
    type: 'help',
    category: 'care',
    description: 'Volunteer teaching mobile basics, online banking safeguards, and digital security for neighborhood seniors.',
    address: 'Hackney Community Library',
    rewardPoints: 100,
    providerName: 'TechPioneers UK',
    latOffset: 0.1,
    lngOffset: 0.45,
    latitude: 51.5268,
    longitude: -0.0720,
    icon: '💻',
    status: 'pending'
  },
  {
    id: 'cpin-5',
    title: 'Prescription Pickup for Isolating Neighbor',
    type: 'request',
    category: 'delivery',
    description: 'Pick up medical dispatch from Hoxton Pharmacy and drop off safely on front porch. Completely hands-free delivery.',
    address: 'Pitfield Street, London',
    rewardPoints: 150,
    providerName: 'Neighbourhood Mutual Aid',
    latOffset: 0.05,
    lngOffset: -0.22,
    latitude: 51.5262,
    longitude: -0.0805,
    icon: '💊',
    status: 'pending'
  }
];

export function CommunityMap({ onJoinDiscussion }: { onJoinDiscussion?: (target: string) => void }) {
  const [pins, setPins] = useState<CommunityPin[]>(SEEDED_PINS);
  const [activeFilter, setActiveFilter] = useState<'all' | 'request' | 'help'>('all');
  const [selectedPin, setSelectedPin] = useState<CommunityPin | null>(null);
  const [mapFailsafe, setMapFailsafe] = useState(Boolean((window as any).gmapsHasFailed) || !GOOGLE_MAPS_API_KEY);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filter coordinates based on type
  const visiblePins = pins.filter(p => activeFilter === 'all' || p.type === activeFilter);

  const handleSupportPin = (pin: CommunityPin) => {
    haptics.heavy();
    
    // Perform virtual sign-up or engagement action
    setPins(prev => prev.map(p => {
      if (p.id === pin.id) {
        return { ...p, status: 'accepted' };
      }
      return p;
    }));

    if (selectedPin && selectedPin.id === pin.id) {
      setSelectedPin(prev => prev ? { ...prev, status: 'accepted' } : null);
    }

    setActionSuccess(`You successfully pledged to support: ${pin.title}! Your help is pending review.`);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[36px] space-y-4 text-left">
      <div className="flex justify-between items-center px-1 flex-row">
        <div>
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
            <span className="text-rose-500">📍</span>
            <span>Interactive Community Map</span>
          </h4>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest mt-0.5">
            Coordinating local help and mutual aid bookings
          </p>
        </div>
        <div className="flex items-center space-x-1">
          {['all', 'request', 'help'].map((f) => (
            <button
              key={f}
              onClick={() => { haptics.light(); setActiveFilter(f as any); }}
              className={`px-3 py-1.5 font-black text-[8.5px] uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                activeFilter === f
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-850 text-slate-400 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? 'All Pins' : f === 'request' ? 'Requests' : 'Offers'}
            </button>
          ))}
        </div>
      </div>

      {actionSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-emerald-800 text-[11px] font-bold"
        >
          <span className="text-emerald-500">✅</span>
          <span>{actionSuccess}</span>
        </motion.div>
      )}

      {/* Map Board */}
      <div className="relative h-[320px] w-full bg-slate-950 rounded-[30px] overflow-hidden border border-slate-150 shadow-inner flex flex-col justify-end">
        {mapFailsafe ? (
          /* Futuristic vector failsafe radar layout */
          <div className="absolute inset-0 bg-slate-950 flex flex-col justify-between p-5 overflow-hidden select-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,30,60,0.85)_0%,rgba(2,6,23,1)_100%)] opacity-95"></div>
            
            {/* Concentric grid lines */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[140px] h-[140px] border border-indigo-500/10 rounded-full animate-pulse"></div>
              <div className="w-[280px] h-[280px] border border-indigo-500/5 rounded-full"></div>
              <div className="w-[420px] h-[420px] border border-indigo-500/5 rounded-full"></div>
              <div className="absolute w-full h-[1px] bg-slate-900/40"></div>
              <div className="absolute h-full w-[1px] bg-slate-900/40"></div>
            </div>

            {/* Simulated sweep line */}
            <div className="absolute top-1/2 left-1/2 w-[350px] h-[350px] border-l border-indigo-505/20 rounded-full origin-top-left -translate-y-1/2 -translate-x-1/2 rotate-45 transform pointer-events-none animate-[spin_12s_linear_infinite]" 
                 style={{ background: 'linear-gradient(45deg, rgba(79,70,229,0.06) 0%, transparent 50%)' }} />

            {/* Radar Coordinates Info Overlay */}
            <div className="absolute top-3 left-3 flex flex-row items-center space-x-2 bg-slate-900/90 border border-slate-800 p-1.5 px-3 rounded-full text-[8.5px] font-mono text-slate-400 font-bold">
              <div className="w-1.5 h-1.5 bg-brand rounded-full animate-ping" />
              <span>RADAR GRID • LONDON SHOREDITCH</span>
            </div>

            {/* Custom Interactive Marker Pins on Vector Grid */}
            <div className="absolute inset-0 pointer-events-auto">
              {visiblePins.map((pin) => {
                const xPercent = 50 + (pin.lngOffset * 75);
                const yPercent = 50 + (pin.latOffset * 75);

                return (
                  <button
                    key={pin.id}
                    onClick={() => { haptics.light(); setSelectedPin(pin); }}
                    className="absolute p-0 border-none bg-transparent -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none transition-all hover:scale-125 z-40"
                    style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                  >
                    <div className="relative flex flex-col items-center">
                      <div className={`p-2.5 rounded-full shadow-lg border-2 ${
                        pin.type === 'request'
                          ? 'bg-rose-500 border-rose-300 text-white'
                          : 'bg-emerald-500 border-emerald-300 text-white'
                      }`}>
                        <span className="text-xs leading-none">{pin.icon}</span>
                      </div>
                      <div className="w-1.5 h-1.5 transform rotate-45 -mt-1 border-r border-b border-inherit shadow-md bg-inherit" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Immersive Interactive Google Map implementation */
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <Map
              className="absolute inset-0 w-full h-full"
              defaultCenter={{ lat: 51.5260, lng: -0.0780 }}
              defaultZoom={15}
              gestureHandling={'cooperative'}
              disableDefaultUI={true}
            >
              {visiblePins.map((pin) => (
                <Marker
                  key={pin.id}
                  position={{ lat: pin.latitude, lng: pin.longitude }}
                  onClick={() => { haptics.light(); setSelectedPin(pin); }}
                />
              ))}
            </Map>
          </APIProvider>
        )}

        {/* Selected Pin Details Overlay Card */}
        <AnimatePresence>
          {selectedPin && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="absolute bottom-3 left-3 right-3 bg-slate-950/95 border border-slate-850 p-4 rounded-2xl flex flex-col space-y-2 z-50 text-left backdrop-blur-md"
            >
              <div className="flex justify-between items-start flex-row">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <span className="text-sm">{selectedPin.icon}</span>
                    <h5 className="font-extrabold text-xs text-white truncate max-w-[190px]">{selectedPin.title}</h5>
                    <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      selectedPin.type === 'request' ? 'bg-rose-500/20 text-rose-450 border border-rose-550/30' : 'bg-emerald-500/20 text-emerald-405 border border-emerald-550/30'
                    }`}>
                      {selectedPin.type === 'request' ? 'Help Request' : 'Help Offer'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1">
                    <MapPin size={9} className="text-emerald-500 shrink-0" />
                    <span>{selectedPin.address}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPin(null)}
                  className="p-1 bg-slate-900 hover:bg-slate-800 text-white/50 hover:text-white rounded-full border-none cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                {selectedPin.description}
              </p>

              <div className="flex justify-between items-center pt-2 border-t border-slate-900/60 flex-row">
                <div className="flex items-center space-x-1 bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-lg">
                  <Award size={10} />
                  <span className="text-[9px] font-black uppercase tracking-wider font-mono">
                    +{selectedPin.rewardPoints} Points
                  </span>
                </div>
                
                <div className="flex items-center space-x-1.5">
                  <span className="text-[9px] font-bold text-slate-400">By {selectedPin.providerName}</span>
                  {selectedPin.status === 'accepted' ? (
                    <span className="px-2.5 py-1.5 bg-emerald-550 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 leading-none shadow-sm selection:bg-transparent">
                      <ShieldCheck size={10} /> Saved Pledging
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSupportPin(selectedPin)}
                      className="px-2.5 py-1.5 bg-brand hover:bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none shadow-sm flex items-center space-x-1"
                    >
                      <Zap size={9} />
                      <span>{selectedPin.type === 'request' ? 'Offer Support' : 'Join Program'}</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mini Legend / Banner */}
      <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl flex justify-between items-center flex-row">
        <div className="flex space-x-3 items-center text-[10px] font-bold text-slate-500 flex-row">
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Service Requests</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Help Postings</span>
          </div>
        </div>
        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
          <Info size={10} className="shrink-0" />
          <span>Real-time GPS tracking</span>
        </span>
      </div>
    </div>
  );
}
