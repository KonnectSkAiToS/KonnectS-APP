/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, Camera, Plus, Trash2, Eye, Heart, Sparkles, Upload, 
  Play, CheckCircle2, AlertCircle, Wrench, Clock, DollarSign, 
  Tag, MapPin, X, RefreshCw, Star, Layers, Film, ArrowRight
} from 'lucide-react';
import { WorkerReel, ReelTradeCategory, ReelMediaType } from '../types/reels';
import { INITIAL_WORKER_REELS, getStoredLocalReels, addLocalReel, saveStoredLocalReels } from '../utils/reelsData';
import { ReelViewerModal } from './ReelViewerModal';
import { haptics } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';

export function WorkerReelsModule() {
  const { profile } = useAuth();
  
  // All active reels state
  const [reels, setReels] = useState<WorkerReel[]>(() => getStoredLocalReels());
  const [loading, setLoading] = useState(false);
  
  // Viewer state
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  
  // Create Reel Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [tradeCategory, setTradeCategory] = useState<ReelTradeCategory>('plumbing');
  const [mediaType, setMediaType] = useState<ReelMediaType>('video');
  const [mediaUrl, setMediaUrl] = useState('');
  const [beforeImageUrl, setBeforeImageUrl] = useState('');
  const [afterImageUrl, setAfterImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(profile?.location?.address || 'London • Shoreditch E1');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [clientSavings, setClientSavings] = useState('Saved client £350 vs replacement');
  const [toolsInput, setToolsInput] = useState('Pipe cutter, Blowlamp, Flux');
  const [tagsInput, setTagsInput] = useState('#plumber, #leakfix, #copperpipe');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Camera Video Recording / Snapshot state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const beforeFileInputRef = useRef<HTMLInputElement | null>(null);
  const afterFileInputRef = useRef<HTMLInputElement | null>(null);

  // Load reels from Firestore and merge with stored local reels
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const reelsCol = collection(db, 'worker_reels');
        const snap = await getDocs(query(reelsCol, orderBy('createdAt', 'desc')));
        if (!isMounted) return;
        const firestoreReels: WorkerReel[] = [];
        snap.forEach(d => {
          const data = d.data();
          firestoreReels.push({
            id: d.id,
            workerId: data.workerId || 'worker_anon',
            workerName: data.workerName || 'Trade Specialist',
            workerRole: data.workerRole || 'Trade Pro',
            workerAvatar: data.workerAvatar,
            workerRating: data.workerRating || 4.95,
            workerBadge: data.workerBadge || 'Verified Pro',
            workerHourlyRate: data.workerHourlyRate || 55,
            title: data.title || 'Work Showcase',
            tradeCategory: data.tradeCategory || 'plumbing',
            mediaType: data.mediaType || 'video',
            mediaUrl: data.mediaUrl || '',
            thumbnailUrl: data.thumbnailUrl,
            beforeImageUrl: data.beforeImageUrl,
            afterImageUrl: data.afterImageUrl,
            description: data.description || '',
            location: data.location || 'London',
            durationMinutes: data.durationMinutes,
            clientSavings: data.clientSavings,
            toolsUsed: data.toolsUsed || [],
            tags: data.tags || [],
            viewsCount: data.viewsCount || 1,
            likesCount: data.likesCount || 0,
            bookmarksCount: data.bookmarksCount || 0,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
          });
        });

        const local = getStoredLocalReels();
        const combined = [...firestoreReels];
        local.forEach(loc => {
          if (!combined.some(r => r.id === loc.id)) {
            combined.push(loc);
          }
        });

        if (isMounted && combined.length > 0) {
          setReels(combined);
        }
      } catch (err) {
        console.warn('Could not fetch firestore reels, using local storage:', err);
      }
    })();

    return () => { isMounted = false; };
  }, []);

  // Filter reels posted by current user
  const myReels = reels.filter(r => r.workerId === profile?.uid || r.workerName === profile?.username || r.workerName === profile?.fullName);

  // Stop camera tracks helper
  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      cameraStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsRecording(false);
    setRecordSeconds(0);
  };

  // Start device camera for live recording / snapping
  const startCamera = async () => {
    haptics.light();
    setIsCameraActive(true);
    setFormError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mediaType === 'video'
      });
      cameraStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Camera failed:', err);
      setFormError('Camera access unavailable. You can upload a video or photo file directly.');
      setIsCameraActive(false);
    }
  };

  // Video recording timer
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Start MediaRecorder
  const startRecording = () => {
    if (!cameraStreamRef.current) return;
    haptics.heavy();
    setRecordSeconds(0);
    recordedChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(cameraStreamRef.current);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaUrl(reader.result as string);
          stopCameraStream();
          haptics.success();
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('MediaRecorder start failed:', err);
    }
  };

  const stopRecording = () => {
    haptics.success();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Take photo snapshot from camera
  const capturePhotoSnapshot = (target: 'media' | 'before' | 'after') => {
    if (!videoPreviewRef.current) return;
    haptics.success();
    const video = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(video.videoWidth || 800, 1000);
    canvas.height = Math.min(video.videoHeight || 600, 800);
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

    if (target === 'before') {
      setBeforeImageUrl(dataUrl);
    } else if (target === 'after') {
      setAfterImageUrl(dataUrl);
    } else {
      setMediaUrl(dataUrl);
    }
    stopCameraStream();
  };

  // Handle direct file upload (video or photo)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'media' | 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;
    haptics.light();
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (target === 'before') setBeforeImageUrl(result);
      else if (target === 'after') setAfterImageUrl(result);
      else setMediaUrl(result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Preset quick templates (helps workers quickly try plumber or electrician reels)
  const applyPresetTemplate = (trade: 'plumbing' | 'electrical' | 'carpentry') => {
    haptics.medium();
    if (trade === 'plumbing') {
      setTitle('Emergency Boiler Radiator Leak & Valve Replacement');
      setTradeCategory('plumbing');
      setMediaType('video');
      setMediaUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
      setBeforeImageUrl('https://images.unsplash.com/photo-1542013936693-884638332954?q=80&w=800&auto=format&fit=crop');
      setAfterImageUrl('https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=800&auto=format&fit=crop');
      setDescription('High pressure water leak coming from 15mm copper compression elbow beneath living room floorboards. Isolated system, drained radiator, replaced faulty olive with PTFE tape & soldered new copper section. Tested at 3.5 bar.');
      setDurationMinutes('45');
      setClientSavings('Saved £650 flooring damage');
      setToolsInput('Rothenberger pipe cutter, MAPP gas torch, compression spanners, pressure gauge');
      setTagsInput('#plumber, #boilerleak, #emergencyfix, #shoreditch');
    } else if (trade === 'electrical') {
      setTitle('18th Edition Fuse Board Replacement & Surge Protection');
      setTradeCategory('electrical');
      setMediaType('video');
      setMediaUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4');
      setDescription('Replaced outdated fuse wire board with modern metal consumer unit featuring individual Type A RCBOs and SPD protection. Tested and signed off under Part P regulations.');
      setDurationMinutes('180');
      setClientSavings('Prevented fire hazard & lower insurance');
      setToolsInput('Megger multi-tester, VDE insulated screwdrivers, label maker');
      setTagsInput('#electrician, #fuseboard, #surgeprotection, #sparky');
    } else {
      setTitle('Custom Oak Alcove Shelving with Hidden Warm LED Strip');
      setTradeCategory('carpentry');
      setMediaType('before_after');
      setBeforeImageUrl('https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop');
      setAfterImageUrl('https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=800&auto=format&fit=crop');
      setMediaUrl('https://images.unsplash.com/photo-1538688525198-9b88f6f53126?q=80&w=800&auto=format&fit=crop');
      setDescription('Precision crafted 4 solid European oak shelves tailored into an irregular chimney alcove. Concealed underside aluminium profiles for 2700K warm LED lighting with touch dimming.');
      setDurationMinutes('240');
      setClientSavings('Bespoke joinery for 40% less than bespoke studio');
      setToolsInput('Plunge saw, guide rail, router, laser level');
      setTagsInput('#carpentry, #bespokejoinery, #woodworking, #alcoveshelves');
    }
  };

  // Submit new Reel
  const handleCreateReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a clear title for your work reel.');
      haptics.heavy();
      return;
    }
    if (mediaType === 'before_after' && (!beforeImageUrl || !afterImageUrl)) {
      setFormError('Please provide both Before and After photos for comparison.');
      haptics.heavy();
      return;
    }
    if (mediaType !== 'before_after' && !mediaUrl) {
      setFormError('Please upload, record, or choose a video or picture for this reel.');
      haptics.heavy();
      return;
    }

    setSubmitting(true);
    setFormError(null);
    haptics.medium();

    const tools = toolsInput.split(',').map(t => t.trim()).filter(Boolean);
    const tags = tagsInput.split(',').map(t => {
      const clean = t.trim();
      return clean.startsWith('#') ? clean : `#${clean}`;
    }).filter(Boolean);

    const newReel: WorkerReel = {
      id: `reel_${Date.now()}`,
      workerId: profile?.uid || 'worker_me',
      workerName: profile?.fullName || profile?.username || 'Pro Tradesperson',
      workerRole: profile?.workerType ? `${profile.workerType.toUpperCase()} Pro` : `${tradeCategory.toUpperCase()} Specialist`,
      workerAvatar: profile?.avatarUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop',
      workerRating: profile?.rating || 4.96,
      workerBadge: profile?.verificationStatus === 'verified' ? 'Verified Trade Pro' : 'Gas Safe / Trade Certified',
      workerHourlyRate: profile?.hourlyRate || 55,
      title: title.trim(),
      tradeCategory,
      mediaType,
      mediaUrl: mediaType === 'before_after' ? afterImageUrl : mediaUrl,
      thumbnailUrl: mediaType === 'before_after' ? afterImageUrl : mediaUrl,
      beforeImageUrl: beforeImageUrl || undefined,
      afterImageUrl: afterImageUrl || undefined,
      description: description.trim(),
      location: location.trim(),
      durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
      clientSavings: clientSavings.trim() || undefined,
      toolsUsed: tools,
      tags: tags.length > 0 ? tags : [`#${tradeCategory}`, '#tradesman', '#konnectspro'],
      viewsCount: 1,
      likesCount: 0,
      bookmarksCount: 0,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save to Firestore
      try {
        await addDoc(collection(db, 'worker_reels'), {
          ...newReel,
          createdAt: serverTimestamp()
        });

        // Activity log
        await addDoc(collection(db, 'activity_logs'), {
          action: `🎬 WORK REEL PUBLISHED [${tradeCategory.toUpperCase()}]: "${title.trim()}"`,
          targetUser: profile?.email || profile?.username || 'Worker Pro',
          adminEmail: 'admin@konnects.co.uk',
          timestamp: serverTimestamp(),
          status: 'reel_active',
          type: 'worker_reel'
        });
      } catch (fErr) {
        console.warn('Firestore write warning:', fErr);
      }

      // 2. Save locally for instant reactivity
      const updated = addLocalReel(newReel);
      setReels(updated);

      haptics.success();
      setSubmitting(false);
      setShowCreateModal(false);
      // Reset form
      setTitle('');
      setMediaUrl('');
      setBeforeImageUrl('');
      setAfterImageUrl('');
      setDescription('');
      stopCameraStream();
      alert(`🎉 Reel published! Clients across London can now watch your "${title}" showcase.`);
    } catch (err: any) {
      console.error(err);
      setFormError('Failed to publish reel. Please try again.');
      setSubmitting(false);
    }
  };

  // Delete reel
  const handleDeleteReel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this reel?')) return;
    haptics.heavy();
    
    // Remove locally
    const filtered = reels.filter(r => r.id !== id);
    setReels(filtered);
    saveStoredLocalReels(filtered);

    // Remove from Firestore if exists
    try {
      await deleteDoc(doc(db, 'worker_reels', id));
    } catch {}
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* HEADER HERO BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-850 to-rose-950 p-6 sm:p-8 rounded-[36px] text-white border border-white/10 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Film size={12} />
                Trade Experience Reels
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-slate-300 text-[10px] font-bold">
                Videos & Photos
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Showcase Your Past Work & Wins
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Upload videos and before/after photos of your plumbing, electrical, carpentry, and repair projects. Clients who watch your reels book you <b className="text-rose-400">3.4x faster</b> with zero price haggling!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => { haptics.light(); setActiveViewerIndex(0); }}
              className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors border border-white/15 backdrop-blur-md"
            >
              <Play size={14} className="fill-white" />
              Watch Reels Feed
            </button>
            <button
              onClick={() => { haptics.success(); setShowCreateModal(true); }}
              className="px-6 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border-none shadow-lg shadow-rose-500/30 transition-transform active:scale-95"
            >
              <Plus size={16} />
              Post New Reel
            </button>
          </div>
        </div>

        {/* STATS OVERVIEW BAR */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-xs">
            <span className="text-[9px] uppercase font-mono text-slate-400 block">Total Reels Live</span>
            <p className="text-lg font-black text-white mt-0.5">{reels.length} Reels</p>
          </div>
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-xs">
            <span className="text-[9px] uppercase font-mono text-slate-400 block">Community Views</span>
            <p className="text-lg font-black text-rose-400 mt-0.5">
              {reels.reduce((acc, r) => acc + (r.viewsCount || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-xs">
            <span className="text-[9px] uppercase font-mono text-slate-400 block">Client Likes</span>
            <p className="text-lg font-black text-emerald-400 mt-0.5">
              {reels.reduce((acc, r) => acc + (r.likesCount || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-xs">
            <span className="text-[9px] uppercase font-mono text-slate-400 block">Direct Bookings</span>
            <p className="text-lg font-black text-amber-400 mt-0.5">
              {reels.reduce((acc, r) => acc + (r.bookmarksCount || 0), 0)} Saved
            </p>
          </div>
        </div>
      </div>

      {/* REELS GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Verified Trade Reels Feed ({reels.length})
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase">
              Live
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { haptics.light(); applyPresetTemplate('plumbing'); setShowCreateModal(true); }}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 cursor-pointer"
            >
              + Quick Plumber Reel
            </button>
            <button
              onClick={() => { haptics.light(); applyPresetTemplate('electrical'); setShowCreateModal(true); }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40 cursor-pointer"
            >
              + Quick Electrician Reel
            </button>
          </div>
        </div>

        {/* Reels Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {reels.map((reel, index) => (
            <motion.div
              key={reel.id}
              whileHover={{ y: -4 }}
              onClick={() => { haptics.light(); setActiveViewerIndex(index); }}
              className="group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
            >
              {/* Media Thumbnail */}
              <div className="relative aspect-[4/5] w-full bg-slate-950 overflow-hidden">
                <img
                  src={reel.thumbnailUrl || reel.mediaUrl || reel.afterImageUrl}
                  alt={reel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Top Overlay Badge */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                  <span className="px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md text-[9px] font-black uppercase tracking-wider border border-white/10 flex items-center gap-1">
                    {reel.mediaType === 'video' ? <Video size={10} className="text-rose-400" /> : <Layers size={10} className="text-amber-400" />}
                    {reel.mediaType === 'before_after' ? 'Before & After' : reel.tradeCategory}
                  </span>
                  
                  {/* Delete button if owner */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteReel(reel.id, e)}
                    className="p-1 rounded-full bg-black/60 text-white/70 hover:text-rose-400 hover:bg-black/80 backdrop-blur-md cursor-pointer border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Reel"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Play Icon Indicator Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-rose-500/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play size={16} className="fill-white ml-0.5" />
                  </div>
                </div>

                {/* Bottom Stats Overlay */}
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white text-[9.5px] font-mono font-bold bg-black/60 backdrop-blur-md px-2 py-1 rounded-xl border border-white/10">
                  <span className="flex items-center gap-1">
                    <Eye size={11} className="text-slate-300" />
                    {reel.viewsCount}
                  </span>
                  <span className="flex items-center gap-1 text-rose-300">
                    <Heart size={11} className="fill-rose-400 text-rose-400" />
                    {reel.likesCount}
                  </span>
                </div>
              </div>

              {/* Card Footer Info */}
              <div className="p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={reel.workerAvatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop'}
                    alt={reel.workerName}
                    className="w-6 h-6 rounded-full object-cover border border-rose-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-extrabold text-slate-800 dark:text-white truncate">
                      {reel.workerName}
                    </p>
                    <p className="text-[9px] text-slate-400 truncate">
                      {reel.workerRole}
                    </p>
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                  {reel.title}
                </h4>

                {reel.clientSavings && (
                  <p className="text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                    💰 {reel.clientSavings}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CREATE NEW WORK REEL MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[10020] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-2xl">
                    <Film size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      Publish Work Reel
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Showcase past jobs, emergency fixes, and before/after proof
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { haptics.light(); stopCameraStream(); setShowCreateModal(false); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer border-none bg-transparent"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleCreateReel} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                {/* 1. Trade Category & Media Type Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Trade Specialty
                    </label>
                    <select
                      value={tradeCategory}
                      onChange={(e) => setTradeCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs font-bold focus:outline-none focus:border-rose-500"
                    >
                      <option value="plumbing">🚰 Plumbing & Heating</option>
                      <option value="electrical">⚡ Electrical & Rewire</option>
                      <option value="carpentry">🪵 Carpentry & Joinery</option>
                      <option value="handyman">🔧 Handyman & Repairs</option>
                      <option value="painting">🎨 Painting & Decorating</option>
                      <option value="cleaning">🧼 Deep Cleaning</option>
                      <option value="hvac">🔥 Boilers & HVAC</option>
                      <option value="other">🛠️ General Trade</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Reel Media Type
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => { haptics.light(); setMediaType('video'); }}
                        className={`py-2 text-[10.5px] font-bold rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1 ${
                          mediaType === 'video'
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 bg-transparent'
                        }`}
                      >
                        <Video size={13} />
                        Video
                      </button>
                      <button
                        type="button"
                        onClick={() => { haptics.light(); setMediaType('before_after'); }}
                        className={`py-2 text-[10.5px] font-bold rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1 ${
                          mediaType === 'before_after'
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 bg-transparent'
                        }`}
                      >
                        <Layers size={13} />
                        Before/After
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Media Capture / Upload Section */}
                <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-850/50 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Camera size={13} className="text-rose-500" />
                      {mediaType === 'video' ? 'Video Media (Upload or Record)' : 'Before & After Pictures'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">Real Work Proof</span>
                  </div>

                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={mediaType === 'video' ? 'video/*' : 'image/*'}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'media')}
                  />
                  <input
                    ref={beforeFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'before')}
                  />
                  <input
                    ref={afterFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'after')}
                  />

                  {/* CAMERA STREAM VIEWPORT IF ACTIVE */}
                  {isCameraActive ? (
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800">
                      <video
                        ref={videoPreviewRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* HUD info */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded-full text-[9px] font-mono text-white">
                          <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-rose-500'}`} />
                          <span>{isRecording ? `RECORDING ${recordSeconds}s` : 'CAMERA READY'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={stopCameraStream}
                          className="p-1 rounded-full bg-black/60 text-white pointer-events-auto border-none cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Bottom Controls */}
                      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-3">
                        {mediaType === 'video' ? (
                          !isRecording ? (
                            <button
                              type="button"
                              onClick={startRecording}
                              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border-none shadow-lg"
                            >
                              <Video size={14} />
                              Start Recording
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border-none shadow-lg animate-pulse"
                            >
                              Stop & Use Video ({recordSeconds}s)
                            </button>
                          )
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => capturePhotoSnapshot('before')}
                              className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer border-none"
                            >
                              Snap "Before"
                            </button>
                            <button
                              type="button"
                              onClick={() => capturePhotoSnapshot('after')}
                              className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer border-none"
                            >
                              Snap "After"
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : mediaType === 'before_after' ? (
                    /* Before & After Dual Inputs */
                    <div className="grid grid-cols-2 gap-3">
                      {/* Before Picture */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-amber-500 block">
                          1. Before Photo (Problem)
                        </label>
                        {beforeImageUrl ? (
                          <div className="relative aspect-video rounded-xl overflow-hidden border border-amber-300 dark:border-amber-900/60 bg-black">
                            <img src={beforeImageUrl} alt="Before" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setBeforeImageUrl('')}
                              className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md cursor-pointer border-none"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => beforeFileInputRef.current?.click()}
                            className="w-full py-6 rounded-xl border border-dashed border-amber-300 dark:border-amber-900/60 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex flex-col items-center justify-center gap-1 cursor-pointer bg-transparent"
                          >
                            <Upload size={16} />
                            <span className="text-[9.5px] font-bold">Upload "Before"</span>
                          </button>
                        )}
                      </div>

                      {/* After Picture */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-emerald-500 block">
                          2. After Photo (Fixed Work)
                        </label>
                        {afterImageUrl ? (
                          <div className="relative aspect-video rounded-xl overflow-hidden border border-emerald-300 dark:border-emerald-900/60 bg-black">
                            <img src={afterImageUrl} alt="After" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setAfterImageUrl('')}
                              className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md cursor-pointer border-none"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => afterFileInputRef.current?.click()}
                            className="w-full py-6 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-900/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex flex-col items-center justify-center gap-1 cursor-pointer bg-transparent"
                          >
                            <Upload size={16} />
                            <span className="text-[9.5px] font-bold">Upload "After"</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Video File Input or Live Camera Trigger */
                    <div>
                      {mediaUrl ? (
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black aspect-video flex items-center justify-center">
                          <video src={mediaUrl} controls className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setMediaUrl('')}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black cursor-pointer border-none"
                            title="Remove Video"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="py-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
                          >
                            <Camera size={20} className="text-rose-500" />
                            <span className="text-xs font-bold">Record with Camera</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="py-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 transition-colors shadow-xs"
                          >
                            <Upload size={20} className="text-indigo-500" />
                            <span className="text-xs font-bold">Upload Video File</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-slate-400">Quick test presets:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPresetTemplate('plumbing')}
                        className="text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/40 cursor-pointer"
                      >
                        🚰 Plumber Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetTemplate('electrical')}
                        className="text-[9px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/40 cursor-pointer"
                      >
                        ⚡ Sparky Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetTemplate('carpentry')}
                        className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/40 cursor-pointer"
                      >
                        🪵 Carpentry Preset
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Reel Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Reel Title & Job Summary
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Emergency Boiler Radiator Leak Repair & Copper Pipe Soldering"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* 4. Description & Steps */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Job Diagnosis & Work Carried Out
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explain what the initial defect was, how you diagnosed it, and the professional method used to fix it permanently..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* 5. Metrics & Value Delivered (Duration, Savings, Location) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Clock size={11} />
                      Job Duration
                    </label>
                    <input
                      type="text"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="e.g. 45 mins"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <DollarSign size={11} />
                      Client Savings
                    </label>
                    <input
                      type="text"
                      value={clientSavings}
                      onChange={(e) => setClientSavings(e.target.value)}
                      placeholder="e.g. Saved £450 vs replacement"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MapPin size={11} />
                      Neighborhood
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Shoreditch, London"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* 6. Professional Tools Used */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Wrench size={12} />
                    Tools & Equipment Used (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={toolsInput}
                    onChange={(e) => setToolsInput(e.target.value)}
                    placeholder="e.g. Pipe cutter, MAPP gas blowtorch, flux, Yorkshire joints, pressure gauge"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold"
                  />
                </div>

                {/* 7. Hashtags */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Tag size={12} />
                    Hashtags
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="#plumbing, #leakrepair, #tradesman, #shoreditch"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold"
                  />
                </div>

                {formError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Submit button bar */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { haptics.light(); stopCameraStream(); setShowCreateModal(false); }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer bg-transparent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border-none shadow-md shadow-rose-500/20 flex items-center gap-2"
                  >
                    {submitting ? 'Publishing...' : 'Publish Experience Reel 🚀'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REEL VIEWER MODAL */}
      {activeViewerIndex !== null && (
        <ReelViewerModal
          isOpen={true}
          onClose={() => setActiveViewerIndex(null)}
          reels={reels}
          initialReelIndex={activeViewerIndex}
          onBookWorker={(reel) => {
            alert(`Booking requested for ${reel.workerName} (${reel.tradeCategory})! A dispatch alert has been sent.`);
          }}
          onChatWorker={(workerId, workerName) => {
            alert(`Opening chat session with ${workerName}...`);
          }}
        />
      )}
    </div>
  );
}
