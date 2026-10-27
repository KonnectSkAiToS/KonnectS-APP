/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Heart, Share2, Bookmark, MessageSquare, Calendar, 
  Volume2, VolumeX, Play, Pause, ChevronLeft, ChevronRight, 
  MapPin, Clock, DollarSign, Wrench, ShieldCheck, Sparkles, 
  Star, Eye, CheckCircle2, SplitSquareVertical
} from 'lucide-react';
import { WorkerReel } from '../types/reels';
import { haptics } from '../utils/haptics';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

interface ReelViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reels: WorkerReel[];
  initialReelIndex?: number;
  onBookWorker?: (reel: WorkerReel) => void;
  onChatWorker?: (workerId: string, workerName: string) => void;
}

export function ReelViewerModal({
  isOpen,
  onClose,
  reels,
  initialReelIndex = 0,
  onBookWorker,
  onChatWorker
}: ReelViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialReelIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [beforeAfterMode, setBeforeAfterMode] = useState<'after' | 'before'>('after');
  const [sliderPosition, setSliderPosition] = useState(50); // percentage 0-100 for split comparison
  
  // Like and bookmark state
  const [likedReelIds, setLikedReelIds] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('konnects_liked_reels');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [bookmarkedReelIds, setBookmarkedReelIds] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('konnects_bookmarked_reels');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeReel = reels[currentIndex] || reels[0];

  // Video progress and auto-loop / timeupdate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleEnded = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentIndex, activeReel?.mediaType]);

  // Handle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    haptics.light();
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    haptics.light();
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleNext = () => {
    if (currentIndex < reels.length - 1) {
      haptics.medium();
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
      setProgress(0);
      setBeforeAfterMode('after');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      haptics.medium();
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
      setProgress(0);
      setBeforeAfterMode('after');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') handleNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') handlePrev();
      if (e.key === ' ' && activeReel?.mediaType === 'video') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'm') toggleMute();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, reels.length, activeReel]);

  const handleLike = async () => {
    if (!activeReel) return;
    haptics.success();
    const isCurrentlyLiked = !!likedReelIds[activeReel.id];
    const newLikedState = !isCurrentlyLiked;
    
    // Update local like states
    const updatedLiked = { ...likedReelIds, [activeReel.id]: newLikedState };
    setLikedReelIds(updatedLiked);
    localStorage.setItem('konnects_liked_reels', JSON.stringify(updatedLiked));

    const currentCount = likeCounts[activeReel.id] || activeReel.likesCount;
    const newCount = newLikedState ? currentCount + 1 : Math.max(0, currentCount - 1);
    setLikeCounts(prev => ({ ...prev, [activeReel.id]: newCount }));

    if (newLikedState) {
      // Add floating heart effect
      const newHeart = { id: Date.now(), x: 50 + (Math.random() * 20 - 10), y: 50 + (Math.random() * 20 - 10) };
      setFloatingHearts(prev => [...prev, newHeart]);
      setTimeout(() => {
        setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
      }, 1000);
    }

    // Try updating Firestore if reel document exists in collection
    try {
      const reelRef = doc(db, 'worker_reels', activeReel.id);
      await updateDoc(reelRef, {
        likesCount: increment(newLikedState ? 1 : -1)
      });
    } catch {
      // local fallback handles it seamlessly
    }
  };

  const handleBookmark = () => {
    if (!activeReel) return;
    haptics.light();
    const isCurrentlyBookmarked = !!bookmarkedReelIds[activeReel.id];
    const newBookmarked = { ...bookmarkedReelIds, [activeReel.id]: !isCurrentlyBookmarked };
    setBookmarkedReelIds(newBookmarked);
    localStorage.setItem('konnects_bookmarked_reels', JSON.stringify(newBookmarked));
  };

  const handleShare = () => {
    if (!activeReel) return;
    haptics.light();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/#reel-${activeReel.id}`);
      alert(`Reel link copied! Share ${activeReel.workerName}'s ${activeReel.tradeCategory} showcase.`);
    }
  };

  if (!isOpen || !activeReel) return null;

  const isLiked = !!likedReelIds[activeReel.id];
  const isBookmarked = !!bookmarkedReelIds[activeReel.id];
  const displayLikes = likeCounts[activeReel.id] !== undefined ? likeCounts[activeReel.id] : activeReel.likesCount;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10015] bg-black/95 backdrop-blur-xl flex items-center justify-center p-0 sm:p-4 select-none">
        {/* Close Button Top Right */}
        <button
          onClick={() => { haptics.light(); onClose(); }}
          className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/60 text-white/90 hover:text-white hover:bg-black/80 transition-colors cursor-pointer border border-white/10 shadow-lg backdrop-blur-md"
          title="Close Reel Viewer (Esc)"
        >
          <X size={20} />
        </button>

        {/* Previous Reel Navigation Button (Desktop) */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/15 backdrop-blur-md"
            title="Previous Reel"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Next Reel Navigation Button (Desktop) */}
        {currentIndex < reels.length - 1 && (
          <button
            onClick={handleNext}
            className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/15 backdrop-blur-md"
            title="Next Reel"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* MAIN REEL CARD CONTAINER */}
        <motion.div
          key={activeReel.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="relative w-full max-w-[460px] h-full sm:h-[92vh] max-h-[850px] bg-slate-950 sm:rounded-[36px] overflow-hidden flex flex-col justify-between border-0 sm:border border-white/15 shadow-2xl"
        >
          {/* Top Progress Bar */}
          <div className="absolute top-2 left-3 right-3 z-30 flex items-center gap-1.5">
            {reels.map((r, i) => (
              <div 
                key={r.id} 
                className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden backdrop-blur-xs cursor-pointer"
                onClick={() => { haptics.light(); setCurrentIndex(i); }}
              >
                <div 
                  className={`h-full bg-white transition-all duration-100 ${
                    i < currentIndex ? 'w-full' : i === currentIndex ? '' : 'w-0'
                  }`}
                  style={{ width: i === currentIndex ? `${progress}%` : undefined }}
                />
              </div>
            ))}
          </div>

          {/* Top Header Overlay: Trade & Location */}
          <div className="absolute top-6 left-4 right-16 z-30 flex items-center justify-between text-white pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-rose-500/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md border border-rose-400/30 flex items-center gap-1 shadow-sm">
                <Sparkles size={11} />
                {activeReel.tradeCategory}
              </span>
              <span className="px-2 py-1 rounded-full bg-black/60 text-slate-200 text-[10px] font-bold backdrop-blur-md border border-white/10 flex items-center gap-1">
                <MapPin size={10} className="text-rose-400" />
                {activeReel.location.split(',')[0]}
              </span>
            </div>
          </div>

          {/* MEDIA DISPLAY AREA */}
          <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden">
            {activeReel.mediaType === 'video' ? (
              <div className="relative w-full h-full cursor-pointer" onClick={togglePlay}>
                <video
                  ref={videoRef}
                  src={activeReel.mediaUrl}
                  poster={activeReel.thumbnailUrl}
                  playsInline
                  autoPlay
                  muted={isMuted}
                  className="w-full h-full object-cover"
                />

                {/* Play/Pause Overlay Indicator on click */}
                {!isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                    <div className="p-4 rounded-full bg-black/60 text-white backdrop-blur-md animate-pulse">
                      <Play size={36} className="fill-white" />
                    </div>
                  </div>
                )}

                {/* Mute/Unmute Quick Toggle */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  className="absolute top-16 right-4 z-20 p-2 rounded-full bg-black/60 text-white/90 hover:text-white border border-white/10 backdrop-blur-md cursor-pointer transition-transform active:scale-90"
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            ) : activeReel.mediaType === 'before_after' && activeReel.beforeImageUrl && activeReel.afterImageUrl ? (
              /* Before / After Dual Picture Interactive Showcase */
              <div className="relative w-full h-full">
                {/* Images Layer */}
                <img
                  src={beforeAfterMode === 'after' ? activeReel.afterImageUrl : activeReel.beforeImageUrl}
                  alt={beforeAfterMode === 'after' ? 'After work' : 'Before work'}
                  className="w-full h-full object-cover transition-opacity duration-300"
                />

                {/* Before / After Toggle Buttons */}
                <div className="absolute top-16 right-4 z-20 flex flex-col gap-2">
                  <div className="bg-black/70 p-1 rounded-2xl border border-white/15 backdrop-blur-md flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => { haptics.light(); setBeforeAfterMode('before'); }}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        beforeAfterMode === 'before'
                          ? 'bg-rose-500 text-white shadow-md'
                          : 'text-slate-300 hover:text-white bg-transparent'
                      }`}
                    >
                      Before
                    </button>
                    <button
                      type="button"
                      onClick={() => { haptics.light(); setBeforeAfterMode('after'); }}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        beforeAfterMode === 'after'
                          ? 'bg-emerald-500 text-white shadow-md'
                          : 'text-slate-300 hover:text-white bg-transparent'
                      }`}
                    >
                      After ✓
                    </button>
                  </div>
                </div>

                {/* Active Mode Banner */}
                <div className="absolute top-16 left-4 z-20">
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider backdrop-blur-md border ${
                    beforeAfterMode === 'before'
                      ? 'bg-amber-500/90 text-white border-amber-400/40'
                      : 'bg-emerald-600/90 text-white border-emerald-400/40'
                  }`}>
                    {beforeAfterMode === 'before' ? '⚠️ INITIAL PROBLEM (BEFORE)' : '✅ RESOLVED WORK (AFTER)'}
                  </span>
                </div>
              </div>
            ) : (
              /* Standard Single Photo Showcase */
              <img
                src={activeReel.mediaUrl || activeReel.thumbnailUrl}
                alt={activeReel.title}
                className="w-full h-full object-cover"
              />
            )}

            {/* Floating Hearts Animation */}
            {floatingHearts.map((heart) => (
              <motion.div
                key={heart.id}
                initial={{ opacity: 1, scale: 0.5, y: 0 }}
                animate={{ opacity: 0, scale: 2.2, y: -120 }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                className="absolute z-40 pointer-events-none text-rose-500"
                style={{ left: `${heart.x}%`, top: `${heart.y}%` }}
              >
                <Heart size={44} className="fill-rose-500 stroke-white stroke-2 drop-shadow-xl" />
              </motion.div>
            ))}

            {/* Subtle Gradient Shadow Overlays for text legibility */}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

            {/* RIGHT ACTION SIDEBAR */}
            <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4 text-white">
              {/* Like Button */}
              <button
                type="button"
                onClick={handleLike}
                className="flex flex-col items-center gap-1 group cursor-pointer border-none bg-transparent"
                title="Like this work"
              >
                <div className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-75 ${
                  isLiked 
                    ? 'bg-rose-500/90 text-white shadow-lg shadow-rose-500/40' 
                    : 'bg-black/50 text-white hover:bg-black/70 border border-white/10'
                }`}>
                  <Heart size={20} className={isLiked ? 'fill-white' : ''} />
                </div>
                <span className="text-[10px] font-mono font-bold text-white drop-shadow">
                  {displayLikes}
                </span>
              </button>

              {/* Bookmark Button */}
              <button
                type="button"
                onClick={handleBookmark}
                className="flex flex-col items-center gap-1 group cursor-pointer border-none bg-transparent"
                title="Bookmark for future reference"
              >
                <div className={`p-3 rounded-full backdrop-blur-md transition-all active:scale-75 ${
                  isBookmarked
                    ? 'bg-indigo-600/90 text-white shadow-lg'
                    : 'bg-black/50 text-white hover:bg-black/70 border border-white/10'
                }`}>
                  <Bookmark size={18} className={isBookmarked ? 'fill-white' : ''} />
                </div>
                <span className="text-[10px] font-mono font-bold text-white drop-shadow">
                  Save
                </span>
              </button>

              {/* Direct Message Worker */}
              {onChatWorker && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    onChatWorker(activeReel.workerId, activeReel.workerName);
                  }}
                  className="flex flex-col items-center gap-1 group cursor-pointer border-none bg-transparent"
                  title={`Chat with ${activeReel.workerName}`}
                >
                  <div className="p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/10 transition-all active:scale-75">
                    <MessageSquare size={18} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-white drop-shadow">
                    Chat
                  </span>
                </button>
              )}

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShare}
                className="flex flex-col items-center gap-1 group cursor-pointer border-none bg-transparent"
                title="Share Reel"
              >
                <div className="p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md border border-white/10 transition-all active:scale-75">
                  <Share2 size={18} />
                </div>
                <span className="text-[10px] font-mono font-bold text-white drop-shadow">
                  Share
                </span>
              </button>
            </div>

            {/* BOTTOM INFO & WORKER CARD */}
            <div className="absolute left-0 right-16 bottom-0 z-20 p-4 text-white space-y-2 pointer-events-auto">
              {/* Worker Profile Header */}
              <div className="flex items-center gap-2.5">
                <img
                  src={activeReel.workerAvatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop'}
                  alt={activeReel.workerName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-rose-500 shadow-md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-black text-white truncate">{activeReel.workerName}</h4>
                    <span className="inline-flex items-center text-blue-400">
                      <ShieldCheck size={13} className="fill-blue-500 text-white" />
                    </span>
                    {activeReel.workerRating && (
                      <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
                        <Star size={10} className="fill-amber-400" />
                        {activeReel.workerRating}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-300 font-medium truncate">
                    {activeReel.workerRole} {activeReel.workerHourlyRate ? `• £${activeReel.workerHourlyRate}/hr` : ''}
                  </p>
                </div>
              </div>

              {/* Reel Title & Description */}
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-white leading-snug drop-shadow-md">
                  {activeReel.title}
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2 font-normal">
                  {activeReel.description}
                </p>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeReel.tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="text-[9px] font-mono text-rose-300">
                    {tag}
                  </span>
                ))}
                {/* Details toggle */}
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-[9.5px] font-bold text-white underline underline-offset-2 ml-1 cursor-pointer bg-transparent border-none"
                >
                  {showDetails ? 'Hide Details' : 'More Details...'}
                </button>
              </div>

              {/* ACTION: Direct Book Button */}
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptics.success();
                    if (onBookWorker) {
                      onBookWorker(activeReel);
                    } else if (onChatWorker) {
                      onChatWorker(activeReel.workerId, activeReel.workerName);
                    } else {
                      alert(`Booking request initiated for ${activeReel.workerName} (${activeReel.tradeCategory})!`);
                    }
                  }}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border-none shadow-lg shadow-rose-500/30 transition-all active:scale-95"
                >
                  <Calendar size={13} />
                  Book {activeReel.workerName.split(' ')[0]} Now
                </button>
              </div>
            </div>

            {/* EXPANDABLE CASE STUDY DETAILS DRAWER */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="absolute inset-x-0 bottom-0 z-40 p-5 bg-slate-900/95 backdrop-blur-xl border-t border-slate-850 rounded-t-3xl text-white space-y-3.5 max-h-[60%] overflow-y-auto custom-scrollbar"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <Wrench size={12} />
                      Job Experience & Case Study Details
                    </span>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer border-none bg-transparent"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {activeReel.durationMinutes && (
                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-2">
                        <Clock size={16} className="text-amber-400 shrink-0" />
                        <div>
                          <p className="text-[8px] uppercase font-mono text-slate-400">Completion Time</p>
                          <p className="font-bold text-white text-[11px]">{activeReel.durationMinutes} minutes</p>
                        </div>
                      </div>
                    )}
                    {activeReel.clientSavings && (
                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center gap-2">
                        <DollarSign size={16} className="text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-[8px] uppercase font-mono text-slate-400">Client Cost Saved</p>
                          <p className="font-bold text-emerald-400 text-[11px] truncate">{activeReel.clientSavings}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Full problem & diagnosis */}
                  <div className="space-y-1">
                    <h5 className="text-[10px] font-black uppercase text-slate-400">Diagnosis & Work Carried Out</h5>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      {activeReel.description}
                    </p>
                  </div>

                  {/* Tools used */}
                  {activeReel.toolsUsed && activeReel.toolsUsed.length > 0 && (
                    <div className="space-y-1.5">
                      <h5 className="text-[10px] font-black uppercase text-slate-400">Professional Tools Used</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {activeReel.toolsUsed.map((tool, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                            🔧 {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verification & License info */}
                  {activeReel.workerBadge && (
                    <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-900/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-blue-400" />
                        <span className="font-bold text-blue-200 text-[11px]">{activeReel.workerBadge}</span>
                      </div>
                      <span className="text-[9px] uppercase font-bold text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded">Verified</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
