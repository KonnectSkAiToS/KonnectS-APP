/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ShoppingBag, ChevronLeft, ChevronRight, Heart, Share2, MapPin, Tag, Star, Clock, ShieldCheck, Image as ImageIcon, Camera, RotateCw, Move, Check, Sparkles, Sliders, Play, Pause, CameraOff, AlertCircle, Maximize2, Minimize2, Trash, X, Bookmark, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { LazyImage } from './LazyImage';
import { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { haptics } from '../utils/haptics';

function generateFluctuations(basePrice: number, seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const points = [];
  const days = ['5d ago', '4d ago', '3d ago', '2d ago', '1d ago', 'Current'];
  
  // Create a pseudo-random walk that stabilizes around the basePrice
  let currentVal = basePrice * (0.88 + (Math.abs(hash % 15) / 100));
  for (let i = 0; i < 6; i++) {
    const changeFactor = ((Math.abs((hash + i * 17) % 11) - 5) / 100) * basePrice;
    currentVal = Math.max(1, currentVal + changeFactor);
    points.push({
      day: days[i],
      price: Math.round(currentVal * 100) / 100
    });
  }
  points[points.length - 1].price = basePrice; // current price matches
  return points;
}

export function MarketplaceItemCard({ 
  item, 
  index, 
  tab, 
  isSaved, 
  onSave, 
  onAddToCart, 
  onMakeOffer, 
  onUpdateStatus, 
  onAddPhoto, 
  onShare, 
  isUploading, 
  renderRating, 
  distance,
  isSelected,
  onToggleSelect
}: any) {
  const [currentImg, setCurrentImg] = useState(0);
  const images = item.images && item.images.length > 0 ? item.images : [null];

  const { user, profile } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Synchronize recently viewed items in local storage on hover
  useEffect(() => {
    if (isHovered) {
      try {
        const key = 'urbanNet_recentlyViewed';
        let items = JSON.parse(localStorage.getItem(key) || '[]');
        items = items.filter((x: any) => x.id !== item.id);
        items.unshift({
          id: item.id,
          title: item.title,
          price: item.price,
          category: item.category,
          condition: item.condition,
          image: item.images?.[0] || null,
          timestamp: new Date().toISOString()
        });
        if (items.length > 4) items.length = 4;
        localStorage.setItem(key, JSON.stringify(items));
      } catch (err) {
        console.error(err);
      }
    }
  }, [isHovered, item]);

  // AR Overlay States
  const [arOpen, setArOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [arScale, setArScale] = useState(1);
  const [arRotate, setArRotate] = useState(0);
  const [placed, setPlaced] = useState(false);
  const [arDragOffset, setArDragOffset] = useState({ x: 0, y: 0 });
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);
  const [shortcutEnabled, setShortcutEnabled] = useState(false);
  const [isSavedToArLibrary, setIsSavedToArLibrary] = useState(false);
  
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const mapDragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const [showShutterFlash, setShowShutterFlash] = useState(false);
  const [savedSnapshots, setSavedSnapshots] = useState<any[]>([]);
  const [showCoachMark, setShowCoachMark] = useState(true);
  const [isSnapshotGalleryOpen, setIsSnapshotGalleryOpen] = useState(false);

  // Load subscriptions from local device cache on init
  useEffect(() => {
    let active = true;
    try {
      const subs = JSON.parse(localStorage.getItem('price_drop_subscriptions') || '[]');
      Promise.resolve().then(() => {
        if (active) setIsSubscribed(subs.includes(item.id));
      });
    } catch (e) {
      console.error(e);
    }
    return () => {
      active = false;
    };
  }, [item.id]);

  const toggleSubscription = () => {
    try {
      let subs = JSON.parse(localStorage.getItem('price_drop_subscriptions') || '[]');
      if (subs.includes(item.id)) {
        subs = subs.filter((id: string) => id !== item.id);
        setIsSubscribed(false);
      } else {
        subs.push(item.id);
        setIsSubscribed(true);
      }
      localStorage.setItem('price_drop_subscriptions', JSON.stringify(subs));
    } catch (e) {
      console.error(e);
    }
  };

  // Load snapshots from Firestore in real-time
  useEffect(() => {
    if (!arOpen || !user?.uid) return;
    const pathForOnSnapshot = 'ar_snapshots';
    const q = query(
      collection(db, pathForOnSnapshot),
      where('userId', '==', user.uid),
      where('itemId', '==', item.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const snaps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp || new Date().toISOString()
      }));
      setSavedSnapshots(snaps);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
    });
    return () => unsubscribe();
  }, [arOpen, user?.uid, item.id]);

  const captureARScene = async () => {
    if (!user?.uid) return;
    setShowShutterFlash(true);
    setTimeout(() => setShowShutterFlash(false), 300);

    const pathForWrite = 'ar_snapshots';
    try {
      const docRef = doc(collection(db, pathForWrite));
      const newSnapshot = {
        userId: user.uid,
        itemId: item.id,
        itemTitle: item.title,
        itemCategory: item.category || 'other',
        itemImage: item.images?.[0] || '',
        scale: arScale,
        rotate: arRotate,
        offset: { x: arDragOffset.x, y: arDragOffset.y },
        timestamp: serverTimestamp()
      };
      await setDoc(docRef, newSnapshot);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    }
  };

  const deleteSnapshot = async (snapId: string) => {
    if (!user?.uid) return;
    const pathForDelete = `ar_snapshots/${snapId}`;
    try {
      await deleteDoc(doc(db, 'ar_snapshots', snapId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, pathForDelete);
    }
  };

  // Map panning drag event handlers
  const handleMapMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingMap(true);
    mapDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: mapOffset.x,
      offsetY: mapOffset.y
    };
  };

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMap) return;
    e.stopPropagation();
    const dx = e.clientX - mapDragStart.current.x;
    const dy = e.clientY - mapDragStart.current.y;
    setMapOffset({
      x: mapDragStart.current.offsetX + dx,
      y: mapDragStart.current.offsetY + dy
    });
  };

  const handleMapMouseUp = (e: React.MouseEvent) => {
    if (isDraggingMap) {
      e.stopPropagation();
      setIsDraggingMap(false);
    }
  };
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync the current item AR placement from Firestore on load & when user changes
  useEffect(() => {
    if (!user?.uid) return;
    const pathForOnSnapshot = 'ar_library';
    const q = query(
      collection(db, pathForOnSnapshot),
      where('userId', '==', user.uid),
      where('itemId', '==', item.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setIsSavedToArLibrary(true);
        const data = snapshot.docs[0].data();
        if (data.arScale !== undefined) setArScale(data.arScale);
        if (data.arRotate !== undefined) setArRotate(data.arRotate);
        if (data.arDragOffset) setArDragOffset(data.arDragOffset);
      } else {
        setIsSavedToArLibrary(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
    });
    return () => unsubscribe();
  }, [user?.uid, item.id]);

  const saveCurrentArPlacement = async (customScale = arScale, customRotate = arRotate, customOffset = arDragOffset) => {
    if (!user?.uid) return;
    const docId = `${user.uid}_${item.id}`;
    const pathForWrite = 'ar_library';
    try {
      await setDoc(doc(db, 'ar_library', docId), {
        userId: user.uid,
        itemId: item.id,
        arScale: customScale,
        arRotate: customRotate,
        arDragOffset: { x: customOffset.x, y: customOffset.y },
        savedAt: serverTimestamp()
      });
      setIsSavedToArLibrary(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    }
  };

  const toggleSaveToArLibrary = async () => {
    if (!user?.uid) return;
    const docId = `${user.uid}_${item.id}`;
    const pathForWrite = 'ar_library';
    try {
      if (isSavedToArLibrary) {
        await deleteDoc(doc(db, 'ar_library', docId));
        setIsSavedToArLibrary(false);
      } else {
        await setDoc(doc(db, 'ar_library', docId), {
          userId: user.uid,
          itemId: item.id,
          arScale,
          arRotate,
          arDragOffset: { x: arDragOffset.x, y: arDragOffset.y },
          savedAt: serverTimestamp()
        });
        setIsSavedToArLibrary(true);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    }
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.warn("Camera could not be accessed. Activating AR simulation workspace.", err);
      setCameraActive(false);
      setCameraPermissionError(true);
    }
  }, []);

  // AR Camera stream management
  const openARViewer = useCallback(() => {
    setArOpen(true);
    setPlaced(false);
    
    // Load persisted local product placement if present
    try {
      const saved = JSON.parse(localStorage.getItem('ar_library_placements') || '{}');
      if (saved[item.id]) {
        setArScale(saved[item.id].arScale ?? 1);
        setArRotate(saved[item.id].arRotate ?? 0);
        setArDragOffset(saved[item.id].arDragOffset ?? { x: 0, y: 0 });
      } else {
        setArScale(1);
        setArRotate(0);
        setArDragOffset({ x: 0, y: 0 });
      }
    } catch (e) {
      console.error(e);
      setArScale(1);
      setArRotate(0);
      setArDragOffset({ x: 0, y: 0 });
    }

    setCameraPermissionError(false);
    
    // Slow delay load to allow video element mounting
    setTimeout(() => {
      startCamera();
    }, 200);
  }, [item.id, startCamera]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'a') {
        if (isHovered || shortcutEnabled) {
          e.preventDefault();
          openARViewer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcutEnabled, isHovered, openARViewer]);

  const nextImg = (e: any) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev + 1) % images.length);
  };
  
  const prevImg = (e: any) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev - 1 + images.length) % images.length);
  };

  // Pre-calculate deterministic price fluctuations for this item based on price and ID
  const fluctuations = generateFluctuations(item.price || 25, item.id);
  const startPrice = fluctuations[0].price;
  const endPrice = item.price || 25;
  const pctDiff = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;

  const closeARViewer = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setArOpen(false);
    setCameraActive(false);
  };

  // Category specific interactive AR model renderer
  const renderARModel = () => {
    const rotationStyle = {
      transform: `rotate(${arRotate}deg) scale(${arScale})`,
    };

    if (item.category === 'electronics') {
      return (
        <div style={rotationStyle} className="relative flex flex-col items-center justify-center transition-transform">
          <svg width="220" height="220" viewBox="0 0 100 100" className="drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]">
            {/* Holographic screen view */}
            <rect x="15" y="20" width="70" height="42" rx="3" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4,2" />
            <rect x="18" y="23" width="64" height="36" fill="none" stroke="#06b6d4" strokeWidth="1" />
            
            {/* Inner coordinate grid wireframe */}
            <line x1="18" y1="41" x2="82" y2="41" stroke="#0891b2" strokeWidth="0.5" strokeOpacity="0.5" />
            <line x1="50" y1="23" x2="50" y2="59" stroke="#0891b2" strokeWidth="0.5" strokeOpacity="0.5" />
            
            {/* Keyboard perspective Base */}
            <polygon points="10,62 90,62 82,78 18,78" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
            <line x1="28" y1="70" x2="72" y2="70" stroke="#06b6d4" strokeWidth="1" />
            
            {/* Live blinking sensor center */}
            <circle cx="50" cy="41" r="3" fill="#22d3ee" className="animate-ping" />
            <circle cx="50" cy="41" r="2" fill="#22d3ee" />
          </svg>
          <span className="text-[9px] font-mono text-cyan-400 mt-2 bg-slate-950/90 px-2 py-0.5 rounded border border-cyan-500/30 font-bold uppercase tracking-widest">
            ELECTRONIC_HOLO_VOLUME
          </span>
        </div>
      );
    } else if (item.category === 'furniture') {
      return (
        <div style={rotationStyle} className="relative flex flex-col items-center justify-center transition-transform">
          <svg width="240" height="240" viewBox="0 0 120 120" className="drop-shadow-[0_0_12px_rgba(16,185,129,0.7)]">
            {/* Perspective Volumetric Cuboid */}
            <rect x="30" y="45" width="45" height="45" fill="none" stroke="#10b981" strokeWidth="1.5" />
            <rect x="45" y="30" width="45" height="45" fill="none" stroke="#059669" strokeWidth="1" strokeDasharray="2,2" />
            
            {/* Vertices/depth projections */}
            <line x1="30" y1="45" x2="45" y2="30" stroke="#10b981" strokeWidth="1" />
            <line x1="75" y1="45" x2="90" y2="30" stroke="#10b981" strokeWidth="1" />
            <line x1="30" y1="90" x2="45" y2="75" stroke="#10b981" strokeWidth="1" />
            <line x1="75" y1="90" x2="90" y2="75" stroke="#10b981" strokeWidth="1" />
            
            {/* Base table/chair leg extensions */}
            <line x1="30" y1="90" x2="30" y2="105" stroke="#10b981" strokeWidth="2" />
            <line x1="75" y1="90" x2="75" y2="105" stroke="#10b981" strokeWidth="2" />
            <line x1="45" y1="75" x2="45" y2="92" stroke="#059669" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="90" y1="75" x2="90" y2="92" stroke="#059669" strokeWidth="1" strokeDasharray="2,2" />
          </svg>
          <span className="text-[9px] font-mono text-emerald-400 mt-2 bg-slate-950/90 px-2 py-0.5 rounded border border-emerald-500/30 font-bold uppercase tracking-widest">
            FURNITURE_WIRE_BOX
          </span>
        </div>
      );
    } else if (item.category === 'clothing') {
      return (
        <div style={rotationStyle} className="relative flex flex-col items-center justify-center transition-transform">
          <svg width="220" height="220" viewBox="0 0 100 100" className="drop-shadow-[0_0_12px_rgba(244,63,94,0.7)]">
            {/* Shoulders and Hanger hanger */}
            <path d="M 50,15 C 32,23 28,30 22,38 C 18,44 22,50 28,50 C 38,50 40,40 50,40 C 60,40 62,50 72,50 C 78,50 82,44 78,38 C 72,30 68,23 50,15 Z" fill="none" stroke="#f43f5e" strokeWidth="1.5" />
            
            {/* Body dressform mesh */}
            <path d="M 28,50 L 33,80 L 67,80 L 72,50 Z" fill="none" stroke="#f43f5e" strokeWidth="1.5" />
            <line x1="50" y1="15" x2="50" y2="80" stroke="#f43f5e" strokeWidth="1" strokeDasharray="3,2" />
            
            {/* Structural wire bounds */}
            <path d="M 26,58 C 40,63 60,63 74,58" fill="none" stroke="#fda4af" strokeWidth="0.8" />
            <path d="M 30,69 C 40,73 60,73 70,69" fill="none" stroke="#fda4af" strokeWidth="0.8" />
          </svg>
          <span className="text-[9px] font-mono text-rose-400 mt-2 bg-slate-950/90 px-2 py-0.5 rounded border border-rose-500/30 font-bold uppercase tracking-widest">
            CLOTHING_PERSPECTIVE_FIT
          </span>
        </div>
      );
    } else {
      // General item OR food: Rotating orbit ring
      return (
        <div style={rotationStyle} className="relative flex flex-col items-center justify-center transition-transform">
          <svg width="220" height="220" viewBox="0 0 100 100" className="drop-shadow-[0_0_12px_rgba(168,85,247,0.7)]">
            {/* Orbit paths */}
            <ellipse cx="50" cy="50" rx="42" ry="18" fill="none" stroke="#a855f7" strokeWidth="1.5" transform="rotate(25, 50, 50)" />
            <ellipse cx="50" cy="50" rx="42" ry="18" fill="none" stroke="#d946ef" strokeWidth="1" transform="rotate(-35, 50, 50)" />
            
            {/* Target bounds */}
            <circle cx="50" cy="50" r="26" fill="none" stroke="#eab308" strokeWidth="1" strokeDasharray="2,2" />
            
            {/* Tech Reticle Lines */}
            <line x1="50" y1="10" x2="50" y2="90" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.4" strokeDasharray="4,4" />
            <line x1="10" y1="50" x2="90" y2="50" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.4" strokeDasharray="4,4" />
          </svg>
          <span className="text-[9px] font-mono text-purple-400 mt-2 bg-slate-950/90 px-2 py-0.5 rounded border border-purple-500/30 font-bold uppercase tracking-widest">
            VOLUMETRIC_ITEM_SCAN
          </span>
        </div>
      );
    }
  };

  if (isHidden) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.015, boxShadow: "0 25px 30px -5px rgba(0, 0, 0, 0.06)" }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(event, info) => {
        if (info.offset.x > 80) {
          haptics.success();
          if (!isSaved) {
            onSave();
          }
          alert(`🔖 Swipe Saved: "${item.title}" added to your saved listings!`);
        } else if (info.offset.x < -80) {
          haptics.heavy();
          setIsHidden(true);
          alert(`👁️ Swipe Hidden: "${item.title}" has been hidden from your active view.`);
        }
      }}
      transition={{ 
        layout: { type: "spring", stiffness: 350, damping: 25 },
        default: { ease: "easeOut", duration: 0.3 }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`MarketplaceItemCard bg-white rounded-[40px] overflow-hidden border flex flex-col group relative ${
        isSelected ? 'border-indigo-600 ring-2 ring-indigo-600/10 shadow-lg' : 'border-slate-100 shadow-sm'
      }`}
    >
      {/* Checkbox for Bulk Actions (Only visible in 'my-listings' tab) */}
      {tab === 'my-listings' && (
        <div className="absolute top-4 left-4 z-40">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(item.id);
            }}
            className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
              isSelected 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-110' 
                : 'bg-white/80 backdrop-blur-md border-slate-350 hover:border-indigo-500 text-transparent'
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </button>
        </div>
      )}

      {/* Item Image Carousel Container */}
      <div className="h-48 bg-slate-50 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImg}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full"
          >
            {images[currentImg] ? (
              <LazyImage src={images[currentImg]} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-200">
                <ShoppingBag size={48} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {images.length > 1 && (
          <>
            <button 
              onClick={prevImg}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur-xl rounded-full text-slate-900 shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10 hover:scale-110 active:scale-90"
            >
              <ChevronLeft size={16} strokeWidth={3} />
            </button>
            <button 
              onClick={nextImg}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur-xl rounded-full text-slate-900 shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10 hover:scale-110 active:scale-90"
            >
              <ChevronRight size={16} strokeWidth={3} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10 p-1.5 bg-black/10 backdrop-blur-md rounded-full">
              {images.map((_: any, idx: number) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentImg ? 'bg-white w-4' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}

        <div className={`absolute top-4 ${tab === 'my-listings' ? 'right-4' : 'left-4'}`}>
          <span className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-tighter shadow-lg ${
            item.isFree ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 border border-slate-100'
          }`}>
            {item.isFree ? 'Free' : `\u00A3${item.price}`}
          </span>
        </div>

        {tab !== 'my-listings' && (
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onSave(); }}
              className={`p-3 rounded-[20px] backdrop-blur-md transition-all active:scale-90 ${isSaved ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-white/90 text-slate-400 hover:text-rose-500 hover:bg-white'}`}
            >
              <Heart size={18} fill={isSaved ? 'white' : 'none'} strokeWidth={2.5} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); toggleSubscription(); }}
              className={`p-3 rounded-[20px] backdrop-blur-md transition-all active:scale-90 ${isSubscribed ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'bg-white/90 text-slate-400 hover:text-amber-500 hover:bg-white'}`}
              title={isSubscribed ? 'Subscribed to price drops!' : 'Subscribe to price drops'}
            >
              <Bell size={18} fill={isSubscribed ? 'white' : 'none'} strokeWidth={2.5} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); toggleSaveToArLibrary(); }}
              className={`p-3 rounded-[20px] backdrop-blur-md transition-all active:scale-90 ${isSavedToArLibrary ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-300/30' : 'bg-white/90 text-slate-400 hover:text-indigo-600 hover:bg-white'}`}
              title={isSavedToArLibrary ? 'Saved in AR Library!' : 'Save to AR Library'}
            >
              <Bookmark size={18} fill={isSavedToArLibrary ? 'white' : 'none'} strokeWidth={2.5} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="p-3 bg-white/90 backdrop-blur-md text-slate-400 rounded-[20px] active:scale-90 transition-all hover:bg-white hover:text-brand"
            >
              <Share2 size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* KEYBOARD SHORTCUT TOGGLE BUTTON FOR AR */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShortcutEnabled(!shortcutEnabled);
          }}
          className={`absolute bottom-3 left-3 z-30 px-3 py-1.5 rounded-2xl border backdrop-blur-md text-[8px] font-black uppercase tracking-wider flex items-center space-x-1.5 active:scale-95 transition-all duration-300 ${
            shortcutEnabled 
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/30' 
              : 'bg-white/90 text-slate-500 border-slate-100 hover:bg-white hover:text-indigo-600'
          }`}
          title="Toggle 'A' key shortcut for AR view"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${shortcutEnabled ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
          <span>Quick Key [A] {shortcutEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <p className="text-[9px] text-brand font-black uppercase tracking-widest">
            {item.category} • {item.condition?.replace('_', ' ') || 'Good'}
          </p>
          <AnimatePresence mode="popLayout">
            {item.status !== 'available' && (
              <motion.span
                key={item.status}
                initial={{ opacity: 0, scale: 0.6, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6, y: 8 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                className="text-[8px] font-black uppercase px-2 py-1 bg-amber-50 text-amber-600 rounded-lg inline-block border border-amber-100"
              >
                {item.status.replace('_', ' ')}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        
        <h4 className="font-bold text-sm mb-1 line-clamp-1 text-slate-900 tracking-tight">{item.title}</h4>
        
        {renderRating(item.sellerId, item)}

        {/* RECHARTS PRICE FLUCTUATIONS SPARKLINE */}
        <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center space-x-1">
              {isSubscribed && <Bell size={10} className="text-amber-500 fill-amber-500 animate-bounce" />}
              <span>Price Tendency</span>
            </span>
            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
              pctDiff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {pctDiff >= 0 ? '↗' : '↘'} {Math.abs(pctDiff).toFixed(1)}% bid variance
            </span>
          </div>
          <div className="h-10 w-full mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fluctuations}>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 bg-opacity-95 text-white p-1 rounded text-[8px] font-mono border border-slate-850 shadow-xl">
                          £{payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke={pctDiff >= 0 ? '#10b981' : '#f43f5e'} 
                  strokeWidth={2} 
                  dot={{ r: 1.5, strokeWidth: 1 }} 
                  activeDot={{ r: 3 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex items-center justify-between text-slate-400 mt-3 mb-4">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsMapOpen(!isMapOpen); }}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-50 text-slate-600 rounded-xl border transition-all active:scale-95 ${
              isMapOpen 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                : 'border-slate-100 hover:bg-slate-100'
            }`}
            title="Toggle integrated map location inside card"
          >
            <MapPin size={12} className={isMapOpen ? 'text-white' : 'text-indigo-600'} />
            <span className="text-[9px] font-extrabold uppercase tracking-wider">
              {isMapOpen ? 'Hide Map' : (item.location?.address.split(',')[0] || 'Local Map')}
            </span>
          </button>
          {distance !== undefined && (
            <span className="text-[10px] font-black text-brand bg-brand/5 px-2 py-0.5 rounded-lg whitespace-nowrap">
              {distance.toFixed(1)} km
            </span>
          )}
        </div>

        {/* Collapsible Integrated Mini Map */}
        <AnimatePresence>
          {isMapOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 160, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full overflow-hidden bg-slate-900 rounded-[28px] border border-slate-800 relative shadow-inner mb-4 select-none flex flex-col justify-between"
            >
              <div 
                onMouseDown={handleMapMouseDown}
                onMouseMove={handleMapMouseMove}
                onMouseUp={handleMapMouseUp}
                onMouseLeave={handleMapMouseUp}
                onTouchStart={(e) => {
                  if (e.touches.length !== 1) return;
                  e.stopPropagation();
                  setIsDraggingMap(true);
                  mapDragStart.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                    offsetX: mapOffset.x,
                    offsetY: mapOffset.y
                  };
                }}
                onTouchMove={(e) => {
                  if (!isDraggingMap || e.touches.length !== 1) return;
                  e.stopPropagation();
                  const dx = e.touches[0].clientX - mapDragStart.current.x;
                  const dy = e.touches[0].clientY - mapDragStart.current.y;
                  setMapOffset({
                    x: mapDragStart.current.offsetX + dx,
                    y: mapDragStart.current.offsetY + dy
                  });
                }}
                onTouchEnd={() => setIsDraggingMap(false)}
                className={`absolute inset-0 bg-slate-950 flex items-center justify-center ${isDraggingMap ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {/* Streets Grid Simulation */}
                <div 
                  className="absolute w-[400px] h-[400px] pointer-events-none opacity-20 transition-transform duration-100 ease-out"
                  style={{ transform: `translate(${mapOffset.x}px, ${mapOffset.y}px)` }}
                >
                  <svg className="w-full h-full">
                    <pattern id={`map-grid-${item.id}`} width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#a5b4fc" strokeWidth="0.8" />
                    </pattern>
                    <rect width="100%" height="100%" fill={`url(#map-grid-${item.id})`} />
                    
                    {/* Roads Outline Roads / Arteries */}
                    <line x1="0" y1="180" x2="400" y2="180" stroke="#818cf8" strokeWidth="4" opacity="0.6" />
                    <line x1="150" y1="0" x2="150" y2="400" stroke="#818cf8" strokeWidth="3.5" opacity="0.6" />
                    <line x1="0" y1="20" x2="400" y2="350" stroke="#c084fc" strokeWidth="2.5" opacity="0.4" />
                  </svg>
                </div>

                {/* Dynamic Glowing Target Pin at Center, offsetting by drag */}
                <div 
                  className="absolute scale-110 pointer-events-none transition-transform duration-100 ease-out"
                  style={{ transform: `translate(${mapOffset.x}px, ${mapOffset.y}px)` }}
                >
                  <span className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 animate-pulse pointer-events-none"></span>
                  <div className="absolute -translate-x-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl shadow-lg border border-indigo-400/30 flex items-center justify-center">
                    <MapPin size={14} fill="white" stroke="none" />
                  </div>
                  <span className="absolute left-6 -top-2 bg-slate-900 border border-indigo-500/20 text-[7px] font-bold text-indigo-300 uppercase tracking-widest px-2 py-0.5 rounded-md whitespace-nowrap shadow-xl">
                    {item.location?.address.split(',')[0] || 'Local'}
                  </span>
                </div>
                
                {/* Map Controls */}
                <div className="absolute top-2 right-2 flex flex-col space-y-1 pointer-events-auto">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setMapOffset({ x: 0, y: 0 }); }}
                    className="p-1 px-1.5 bg-slate-900/90 text-[7px] font-extrabold uppercase tracking-widest text-indigo-400 rounded-md hover:bg-slate-800 transition-colors border border-white/10 active:scale-95"
                    title="Recenter Map"
                  >
                    Reset Center
                  </button>
                </div>

                <div className="absolute bottom-1.5 left-2.5 text-[6px] font-mono text-slate-500 pointer-events-none uppercase tracking-wider">
                  COORD: {(item.location?.lat || 51.5074).toFixed(3)}N , {(item.location?.lng || -0.1278).toFixed(3)}W
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="mt-auto space-y-3">
          {tab === 'browse' || tab === 'saved' || tab === 'cart' ? (
            <div className="flex flex-col space-y-2.5 pt-3 border-t border-slate-50">
              {profile?.savedItems?.includes(item.id) && (
                <button
                  onClick={(e) => { e.stopPropagation(); openARViewer(); }}
                  className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center space-x-1.5 border-none"
                >
                  <Sparkles size={12} className="text-violet-200 animate-pulse" />
                  <span>Quick Preview</span>
                </button>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                {!item.isFree && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onMakeOffer(); }}
                    className="w-full py-3.5 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-amber-200 flex items-center justify-center space-x-1 border-none"
                  >
                     <Tag size={13} strokeWidth={3} />
                     <span>Make Offer</span>
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); onShare(); }}
                  className={`py-3.5 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center space-x-1.5 ${item.isFree ? 'col-span-2' : ''}`}
                >
                  <Share2 size={13} strokeWidth={3} />
                  <span>Send Item</span>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
                  className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-200 flex items-center justify-center"
                >
                  <ShoppingBag size={14} className="mr-1.5" />
                  Add to Bag
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); openARViewer(); }}
                  className="w-full py-3.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100/50 transition-all active:scale-95 flex items-center justify-center group-hover:animate-pulse group-hover:bg-indigo-100 group-hover:scale-[1.02]"
                  title="View in AR: Simulate item placement in your physical surrounding using live camera overlay"
                >
                  <svg 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    className="mr-1.5 transform transition-transform duration-300 group-hover:scale-125 text-indigo-600" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <title>View in AR: Simulate item placement in your physical surrounding using live camera overlay</title>
                    <path 
                      className="ar-path-draw" 
                      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" 
                    />
                    <circle cx="12" cy="13" r="4" className="ar-path-draw" />
                  </svg>
                  View in AR
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => onUpdateStatus('sold')}
                  className="py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest"
                >
                  Sold
                </button>
                <select 
                  className="bg-slate-50 rounded-xl text-[9px] font-black uppercase tracking-widest px-2 outline-none border-none appearance-none"
                  value={item.status}
                  onChange={(e) => onUpdateStatus(e.target.value as any)}
                >
                  <option value="available">Live</option>
                  <option value="pending_pickup">Pickup</option>
                  <option value="delivered">Done</option>
                  <option value="deleted">Hide</option>
                </select>
              </div>
              <button 
                onClick={onAddPhoto}
                disabled={isUploading}
                className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="w-3 h-3 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin"></div>
                ) : (
                  <>
                    <ImageIcon size={14} />
                    <span>Post Photo</span>
                  </>
                )}
              </button>
               <button 
                onClick={(e) => { e.stopPropagation(); openARViewer(); }}
                className="w-full py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 active:scale-95 group-hover:animate-pulse group-hover:bg-indigo-100 group-hover:scale-[1.02]"
                title="Camera AR Preview: Verify how your listed merchandise model fits inside home spaces"
              >
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  className="transform transition-transform duration-300 group-hover:scale-125 text-indigo-600" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <title>Camera AR Preview: Verify how your listed merchandise model fits inside home spaces</title>
                  <path 
                    className="ar-path-draw" 
                    d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" 
                  />
                  <circle cx="12" cy="13" r="4" className="ar-path-draw" />
                </svg>
                <span>Camera AR Preview</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW IN AR CAM OVERLAY MODAL */}
      <AnimatePresence>
        {arOpen && (
          <div className="fixed inset-0 bg-slate-950 z-[1000] flex flex-col pointer-events-none text-white max-w-md mx-auto">
            {/* White camera visual flash animation effect */}
            <AnimatePresence>
              {showShutterFlash && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="fixed inset-0 bg-white z-[2000] pointer-events-none"
                />
              )}
            </AnimatePresence>

            <div className="absolute inset-0 pointer-events-auto">
              {cameraActive ? (
                /* LIVE REAL CAMERA STREAM */
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover" 
                />
              ) : (
                /* HIGH FIDELITY SIMULATED PHYSICAL AR SPACE */
                <div className="w-full h-full bg-gradient-to-b from-slate-900 via-slate-950 to-indigo-950 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,50,90,0.15)_0%,rgba(5,5,15,0.7)_100%)] opacity-80" />
                  
                  {/* Grid floor projection */}
                  <div className="absolute bottom-0 left-0 right-0 h-1/2 overflow-hidden opacity-25">
                    <svg width="100%" height="100%">
                      <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" strokeWidth="0.8" />
                      </pattern>
                      <rect width="100%" height="100%" fill="url(#floor-grid)" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Top scanning header panel */}
            <div className="p-5 bg-gradient-to-b from-slate-950/90 to-transparent absolute top-0 left-0 right-0 z-50 pointer-events-auto flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-xl flex items-center justify-center">
                  <Camera size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-xs capitalize leading-tight">{item.title} AR</h4>
                  <p className="text-[8px] text-indigo-300 font-mono tracking-widest font-black uppercase">
                    {cameraActive ? 'CAMERA STREAM ACTIVE' : 'AR SIMULATOR ACTIVE'}
                  </p>
                </div>
              </div>
              <button 
                onClick={closeARViewer} 
                className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white rounded-xl border border-white/15"
              >
                <X size={18} />
              </button>
            </div>

            {/* Permissions warning banner if camera is offline */}
            {cameraPermissionError && (
              <div className="absolute top-20 left-4 right-4 bg-amber-950/90 border border-amber-500/30 backdrop-blur-sm p-3.5 rounded-2xl flex items-start space-x-2.5 z-40 pointer-events-auto max-w-[380px] mx-auto shadow-2xl">
                <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <p className="font-bold text-[9px] text-amber-200 leading-snug uppercase tracking-wider">iFrame Camera Access Restricted</p>
                  <p className="text-[9px] text-amber-300/80 leading-relaxed mt-0.5">Running in sandbox device mode. You can fully adjust, rotate and translate this 3D model placeholder in the digital simulator arena below.</p>
                </div>
              </div>
            )}

            {/* FLOATING AR PLACED ITEM INFO PANEL OVERLAY */}
            <AnimatePresence>
              {placed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute top-24 right-4 z-40 bg-slate-900/90 border border-emerald-500/40 backdrop-blur-md p-3 px-4 rounded-[24px] shadow-2xl pointer-events-auto max-w-[200px] flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    <span className="text-[8px] text-emerald-400 font-mono font-black tracking-widest uppercase">MODEL PLACED</span>
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-extrabold text-[10px] text-white tracking-wide truncate">{item.title}</h5>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[7.5px] bg-slate-800 text-indigo-300 font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-indigo-500/20">
                        {item.category || 'listing'}
                      </span>
                      <span className="text-[9px] text-emerald-300 font-black font-mono">
                        {item.price === 0 ? 'FREE' : `£${item.price}`}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SUBTLE ON-SCREEN COACH MARK */}
            <AnimatePresence>
              {showCoachMark && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="absolute bottom-80 left-4 right-4 z-[60] bg-slate-950/95 border border-indigo-500/30 backdrop-blur-md p-3.5 rounded-[22px] shadow-2xl pointer-events-auto flex items-start justify-between max-w-[380px] mx-auto"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                      <Move className="w-4.5 h-4.5 animate-pulse" />
                    </div>
                    <div>
                      <h5 className="font-extrabold text-[10px] text-indigo-200 uppercase tracking-widest leading-none mb-1">AR Gesture Controls</h5>
                      <p className="text-[9px] text-slate-300 leading-relaxed">
                        Drag the 3D model directly to reposition, or use pinch-to-scale gestures (and slider below) to resize the object in your space!
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowCoachMark(false)} 
                    className="p-1 px-1.5 text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg ml-2 shrink-0 border-none cursor-pointer flex items-center justify-center"
                    title="Got it!"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Central scanning HUD bounds indicator */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-72 border border-white/5 rounded-full flex items-center justify-center relative animate-pulse opacity-40">
                <div className="absolute w-56 h-56 border border-white/5 rounded-full" />
                <div className="absolute w-40 h-40 border border-indigo-500/10 rounded-full" />
                
                {/* HUD Corner ticks */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-500" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-500" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-500" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-500" />
              </div>
            </div>

            {/* Draggable AR projection model container */}
            <motion.div 
              drag
              dragMomentum={false}
              className="absolute inset-0 flex items-center justify-center z-30 pointer-events-auto cursor-grab active:cursor-grabbing"
              style={{ x: arDragOffset.x, y: arDragOffset.y }}
              onDrag={(e, info) => {
                setArDragOffset(prev => ({
                  x: prev.x + info.delta.x,
                  y: prev.y + info.delta.y
                }));
              }}
            >
              <div className="relative flex flex-col items-center justify-center">
                {/* Sonar depth coordinate ring */}
                <span className="absolute w-64 h-24 rounded-full border border-indigo-500/20 bg-indigo-500/5 animate-ping opacity-60 pointer-events-none" />
                <span className="absolute w-44 h-16 rounded-full border border-cyan-500/20 bg-cyan-500/5 animate-pulse pointer-events-none" />
                
                {renderARModel()}

                {/* Status locator marker */}
                <span className="absolute -bottom-10 bg-slate-900 border border-indigo-500/20 px-3 py-1 rounded-full text-[9px] font-mono font-bold tracking-widest text-indigo-300 pointer-events-none animate-bounce">
                  {placed ? '✓ POSITION STORED' : '↕ DRAG TO REPOSITION'}
                </span>
              </div>
            </motion.div>

            {/* Bottom controllers */}
            <div className="p-6 bg-slate-950/95 border-t border-white/10 absolute bottom-0 left-0 right-0 z-50 pointer-events-auto flex flex-col space-y-4 rounded-t-[40px] shadow-2xl">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest">AR Scaling ({Math.round(arScale * 100)}%)</span>
                  <span className="text-[9px] text-indigo-400 font-mono">Min 20% • Max 200%</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Minimize2 size={12} className="text-slate-400" />
                  <input 
                    type="range" 
                    min="0.2" 
                    max="2.0" 
                    step="0.05"
                    value={arScale} 
                    onChange={(e) => setArScale(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <Maximize2 size={12} className="text-slate-400" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest">3D Orbit Angle ({arRotate}°)</span>
                  <span className="text-[9px] text-cyan-400 font-mono">0° • 360° Rotate</span>
                </div>
                <div className="flex items-center space-x-3">
                  <RotateCw size={12} className="text-slate-400 animate-spin-slow" />
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    value={arRotate} 
                    onChange={(e) => setArRotate(parseInt(e.target.value))}
                    className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <RotateCw size={12} className="text-slate-400" />
                </div>
              </div>

              <div className="flex space-x-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); captureARScene(); }}
                  className="flex-1 py-4 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:opacity-95 font-black uppercase text-[10px] tracking-wider text-white rounded-2xl flex items-center justify-center space-x-2 shadow-xl shadow-pink-500/20 active:scale-95 transition-all outline-none border-none"
                  title="Capture current physical AR scene snapshot and cache on the device"
                >
                  <Camera size={13} fill="white" />
                  <span>Capture AR Scene</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSnapshotGalleryOpen(true)}
                  className="px-4 bg-slate-800 hover:bg-slate-700 font-black uppercase text-[10px] tracking-wider text-white rounded-2xl flex items-center justify-center space-x-2 border-none active:scale-95 transition-all"
                  title="Open Snapshots Gallery History"
                >
                  <Bookmark size={14} className="text-zinc-300" />
                  <span className="hidden sm:inline">Gallery</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    setPlaced(true);
                    // Save active placement coordinates / zoom/ rotation in local storage favorite placements!
                    saveCurrentArPlacement();
                  }}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-wider text-white rounded-2xl flex items-center justify-center space-x-2"
                >
                  <Check size={14} />
                  <span>{placed ? "Placed & Calibrated!" : "Place on Surface"}</span>
                </button>
                <button 
                  onClick={() => {
                    setArScale(1);
                    setArRotate(0);
                    setArDragOffset({ x: 0, y: 0 });
                    setPlaced(false);
                  }}
                  className="w-full py-4 bg-white/15 hover:bg-white/20 font-black uppercase text-[10px] tracking-wider text-white rounded-2xl"
                >
                  Reset Placement
                </button>
              </div>

              {/* Snapshots Gallery */}
              {savedSnapshots.length > 0 && (
                <div className="pt-2 border-t border-white/5 flex flex-col space-y-1.5 pointer-events-auto">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[8px] font-mono font-bold tracking-widest text-slate-400 uppercase">Captured AR Scenes ({savedSnapshots.length})</p>
                    <button
                      type="button"
                      onClick={() => setIsSnapshotGalleryOpen(true)}
                      className="text-[8px] font-extrabold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider bg-transparent border-none p-0 cursor-pointer flex items-center space-x-1"
                    >
                      <span>Full Gallery</span>
                      <ChevronRight size={10} />
                    </button>
                  </div>
                  <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                    {savedSnapshots.map((snap) => (
                      <div key={snap.id} className="relative shrink-0 w-24 bg-white/5 rounded-xl p-2 border border-white/10 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <span className="text-[7px] font-mono text-slate-400">
                            {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSnapshot(snap.id);
                            }}
                            className="text-slate-450 hover:text-rose-500 transition-colors bg-transparent border-none p-0 cursor-pointer"
                            title="Delete snapshot"
                          >
                            <Trash size={9} />
                          </button>
                        </div>
                        <div className="text-[8px] font-bold text-white truncate mt-1.5">{snap.itemTitle}</div>
                        <div className="text-[7px] text-indigo-300 font-mono mt-0.5">
                          Scale: {Math.round(snap.scale * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status footer banner */}
              <div className="flex justify-between text-[8px] font-mono text-slate-500 pt-2 border-t border-white/5">
                <span>COORD: X:{Math.round(arDragOffset.x)} Y:{Math.round(arDragOffset.y)}</span>
                <span>HUD_SAT_PING: 18ms</span>
                <span>UK_HOLO_INDEX: V8</span>
              </div>
            </div>

            {/* SNAPSHOT GALLERY MODAL */}
            <AnimatePresence>
              {isSnapshotGalleryOpen && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSnapshotGalleryOpen(false)}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-md pointer-events-auto"
                  />
                  
                  {/* Modal Box */}
                  <motion.div 
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    className="relative bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[36px] p-6 shadow-2xl pointer-events-auto flex flex-col h-[70vh] text-white"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
                          <Camera size={16} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-100">AR Scene Snapshots</h4>
                          <p className="text-[8px] text-slate-400 font-mono tracking-widest font-bold uppercase animate-pulse">Captured Device History ({savedSnapshots.length})</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setIsSnapshotGalleryOpen(false)} 
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-lg border-none cursor-pointer flex items-center justify-center text-slate-400 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Snapshots Grid/List Container */}
                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                      {savedSnapshots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-slate-950/50 rounded-2xl border border-slate-800/60">
                          <CameraOff size={24} className="text-slate-600 mb-2.5" />
                          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-relaxed">No captured scenes found yet. Place a model and click "Capture AR Scene" to save.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3.5 pt-1">
                          {savedSnapshots.map((snap) => (
                            <div key={snap.id} className="relative bg-slate-950 rounded-2xl p-2.5 border border-slate-800/60 flex flex-col justify-between group overflow-hidden shadow-lg hover:border-indigo-500/30 transition-all duration-300">
                              {/* Photo area */}
                              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 mb-2 flex items-center justify-center">
                                {snap.itemImage ? (
                                  <LazyImage 
                                    src={snap.itemImage} 
                                    alt={snap.itemTitle} 
                                    className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-500"
                                  />
                                ) : (
                                  <ImageIcon size={20} className="text-slate-700" />
                                )}
                                <span className="absolute top-1 right-1 bg-slate-900/95 backdrop-blur-md text-[7px] text-slate-400 font-mono px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  {snap.itemCategory}
                                </span>
                              </div>

                              <div className="flex justify-between items-start">
                                <div className="truncate flex-1 mr-1">
                                  <div className="text-[9px] font-black text-slate-100 truncate">{snap.itemTitle}</div>
                                  <div className="text-[7.5px] text-indigo-400 font-mono mt-0.5">Scale: {Math.round(snap.scale * 100)}%</div>
                                  <div className="text-[7.5px] text-cyan-400 font-mono">Rotate: {snap.rotate}°</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSnapshot(snap.id);
                                  }}
                                  className="p-1 px-1.5 text-slate-500 bg-slate-900 border border-slate-800 hover:text-rose-500 hover:border-rose-550/20 active:scale-95 transition-all rounded-lg cursor-pointer flex items-center justify-center"
                                  title="Delete Scene snapshot"
                                >
                                  <Trash size={11} />
                                </button>
                              </div>

                              <div className="text-[7px] font-mono text-slate-500 text-right mt-2 border-t border-slate-900 pt-1.5 uppercase">
                                {new Date(snap.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Modal actions / close */}
                    <div className="pt-4 border-t border-slate-800/60 mt-4">
                      <button
                        type="button"
                        onClick={() => setIsSnapshotGalleryOpen(false)}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white font-black text-[10px] uppercase tracking-wider rounded-xl border-none outline-none"
                      >
                        Return to AR Scene
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
