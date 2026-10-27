/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, Image as ImageIcon, MessageSquareText, Plus, Search, 
  Sparkles, Filter, Heart, MessageSquare, Share2, Bookmark, 
  Eye, CheckCircle2, Star, Wrench, Clock, MapPin, DollarSign, 
  Play, Camera, Video, Upload, ChevronRight, X, ArrowUpDown, 
  ShieldCheck, Send, ThumbsUp, HelpCircle, Lightbulb, Compass,
  Sliders, Trash2, ArrowRight
} from 'lucide-react';
import { WorkerReel, ReelTradeCategory, WorkerPost, WorkPhotoItem, PostType } from '../types/reels';
import { getStoredLocalReels, saveStoredLocalReels, addLocalReel } from '../utils/reelsData';
import { 
  getStoredLocalPosts, saveStoredLocalPosts, addLocalPost,
  getStoredLocalPhotos, saveStoredLocalPhotos, addLocalPhoto 
} from '../utils/postsAndPhotosData';
import { ReelViewerModal } from './ReelViewerModal';
import { haptics } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';

interface ShowcaseSpaceViewProps {
  onChat?: (workerId: string, workerName: string) => void;
  initialSpace?: 'reels' | 'pics' | 'posts';
}

const generateUniqueId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
};

const getCurrentIsoString = (): string => new Date().toISOString();

export function ShowcaseSpaceView({ onChat, initialSpace = 'reels' }: ShowcaseSpaceViewProps) {
  const { profile } = useAuth();
  
  // The primary 3 spaces requested by user
  const [activeSpace, setActiveSpace] = useState<'reels' | 'pics' | 'posts'>(initialSpace);
  
  // Data states
  const [reels, setReels] = useState<WorkerReel[]>(() => getStoredLocalReels());
  const [posts, setPosts] = useState<WorkerPost[]>(() => getStoredLocalPosts());
  const [photos, setPhotos] = useState<WorkPhotoItem[]>(() => getStoredLocalPhotos());
  
  // Search and Trade Category Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [postTypeFilter, setPostTypeFilter] = useState<string>('all');
  
  // Viewer and Lightbox Modals
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  const [activePhotoLightbox, setActivePhotoLightbox] = useState<WorkPhotoItem | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  
  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'reel' | 'photo' | 'post'>('reel');

  // Form Inputs for Create Reel/Photo/Post
  const [titleInput, setTitleInput] = useState('');
  const [tradeInput, setTradeInput] = useState<ReelTradeCategory>('plumbing');
  const [contentInput, setContentInput] = useState('');
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [beforeImgInput, setBeforeImgInput] = useState('');
  const [afterImgInput, setAfterImgInput] = useState('');
  const [locationInput, setLocationInput] = useState(profile?.location?.address || 'London • Shoreditch E1');
  const [tagsInput, setTagsInput] = useState('#plumber, #leakrepair, #craftsman');
  const [toolsInput, setToolsInput] = useState('Rothenberger Cutter, MAPP Torch');
  const [projectCostInput, setProjectCostInput] = useState('£160');
  const [timeTakenInput, setTimeTakenInput] = useState('1 hr');
  const [postTypeInput, setPostTypeInput] = useState<PostType>('tip');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Camera / File state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Interactive Likes and Comments on Posts
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('konnects_liked_posts');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Sync with Firestore if available
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // Sync Reels
        const reelsSnap = await getDocs(query(collection(db, 'worker_reels'), orderBy('createdAt', 'desc')));
        if (isMounted && !reelsSnap.empty) {
          const fsReels: WorkerReel[] = [];
          reelsSnap.forEach(d => {
            const data = d.data();
            fsReels.push({ id: d.id, ...data } as WorkerReel);
          });
          const local = getStoredLocalReels();
          const merged = [...fsReels];
          local.forEach(l => {
            if (!merged.some(m => m.id === l.id)) merged.push(l);
          });
          setReels(merged);
        }

        // Sync Posts
        const postsSnap = await getDocs(query(collection(db, 'worker_posts'), orderBy('createdAt', 'desc')));
        if (isMounted && !postsSnap.empty) {
          const fsPosts: WorkerPost[] = [];
          postsSnap.forEach(d => {
            const data = d.data();
            fsPosts.push({ id: d.id, ...data } as WorkerPost);
          });
          const local = getStoredLocalPosts();
          const merged = [...fsPosts];
          local.forEach(l => {
            if (!merged.some(m => m.id === l.id)) merged.push(l);
          });
          setPosts(merged);
        }
      } catch (e) {
        console.warn('Firestore space sync:', e);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Filtered lists
  const filteredReels = reels.filter(reel => {
    const matchesTrade = selectedTrade === 'all' || reel.tradeCategory === selectedTrade;
    const matchesSearch = !searchQuery || 
      reel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reel.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reel.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTrade && matchesSearch;
  });

  const filteredPhotos = photos.filter(photo => {
    const matchesTrade = selectedTrade === 'all' || photo.tradeCategory === selectedTrade;
    const matchesSearch = !searchQuery || 
      photo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      photo.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      photo.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTrade && matchesSearch;
  });

  const filteredPosts = posts.filter(post => {
    const matchesTrade = selectedTrade === 'all' || post.tradeCategory === selectedTrade;
    const matchesType = postTypeFilter === 'all' || post.postType === postTypeFilter;
    const matchesSearch = !searchQuery || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTrade && matchesType && matchesSearch;
  });

  // Handle Likes for Posts
  const handleToggleLikePost = (postId: string) => {
    haptics.light();
    const isLiked = !likedPostIds[postId];
    setLikedPostIds(prev => {
      const next = { ...prev, [postId]: isLiked };
      localStorage.setItem('konnects_liked_posts', JSON.stringify(next));
      return next;
    });

    setPosts(prev => {
      const next = prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likesCount: isLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
          };
        }
        return p;
      });
      saveStoredLocalPosts(next);
      return next;
    });
  };

  // Handle adding comments
  const handleAddComment = (postId: string) => {
    if (!newCommentText.trim()) return;
    haptics.success();
    const commentItem = {
      id: generateUniqueId('c'),
      authorId: profile?.uid || 'user_guest',
      authorName: profile?.fullName || profile?.username || 'Neighbor',
      authorRole: profile?.isWorkerMode ? 'Verified Pro' : 'Resident',
      authorAvatar: profile?.avatarUrl,
      authorBadge: profile?.isWorkerMode ? 'Pro Badge' : undefined,
      comment: newCommentText.trim(),
      createdAt: getCurrentIsoString()
    };

    setPosts(prev => {
      const next = prev.map(p => {
        if (p.id === postId) {
          const updatedComments = [...(p.comments || []), commentItem];
          return {
            ...p,
            commentsCount: (p.commentsCount || 0) + 1,
            comments: updatedComments
          };
        }
        return p;
      });
      saveStoredLocalPosts(next);
      return next;
    });

    setNewCommentText('');
  };

  // Live Camera Functions
  const startCamera = async () => {
    try {
      haptics.light();
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true
      });
      cameraStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      setIsCameraActive(false);
      setErrorMsg('Camera access unavailable. Please use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
    setIsRecording(false);
  };

  const startRecording = () => {
    if (!cameraStreamRef.current) return;
    haptics.heavy();
    recordedChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const recordedUrl = URL.createObjectURL(blob);
        setMediaUrlInput(recordedUrl);
        stopCamera();
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordSeconds(0);
    } catch (e) {
      console.warn('MediaRecorder init failed:', e);
      setErrorMsg('Recording not supported on this device. Upload a file instead.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      haptics.success();
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCapturePhoto = () => {
    if (!videoPreviewRef.current) return;
    haptics.success();
    const video = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setMediaUrlInput(dataUrl);
      if (!beforeImgInput) {
        setAfterImgInput(dataUrl);
      }
    }
    stopCamera();
  };

  // Submit Handler
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) {
      setErrorMsg('Please enter a title');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const workerName = profile?.fullName || profile?.username || 'Craft Specialist';
    const workerRole = profile?.workerType ? `${profile.workerType.charAt(0).toUpperCase() + profile.workerType.slice(1)} Specialist` : `${tradeInput.charAt(0).toUpperCase() + tradeInput.slice(1)} Pro`;
    const avatar = profile?.avatarUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop';
    const tags = tagsInput.split(',').map(t => t.trim().startsWith('#') ? t.trim() : '#' + t.trim()).filter(Boolean);

    try {
      if (createType === 'reel') {
        const fallbackVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
        const newReel: WorkerReel = {
          id: generateUniqueId('reel'),
          workerId: profile?.uid || 'worker_me',
          workerName,
          workerRole,
          workerAvatar: avatar,
          workerRating: 4.98,
          workerBadge: 'Verified Trade Pro',
          workerHourlyRate: 55,
          title: titleInput.trim(),
          tradeCategory: tradeInput,
          mediaType: beforeImgInput && afterImgInput ? 'before_after' : 'video',
          mediaUrl: mediaUrlInput || fallbackVideo,
          thumbnailUrl: afterImgInput || beforeImgInput || 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=800&auto=format&fit=crop',
          beforeImageUrl: beforeImgInput || undefined,
          afterImageUrl: afterImgInput || undefined,
          description: contentInput.trim() || 'Work evidence showcase demonstrating professional craftsmanship.',
          location: locationInput.trim(),
          durationMinutes: parseInt(timeTakenInput) || 60,
          clientSavings: projectCostInput ? `Priced at ${projectCostInput}` : 'Saved client costly replacements',
          toolsUsed: toolsInput.split(',').map(s => s.trim()).filter(Boolean),
          tags,
          viewsCount: 1,
          likesCount: 0,
          bookmarksCount: 0,
          createdAt: getCurrentIsoString()
        };

        const updated = addLocalReel(newReel);
        setReels(updated);
        try {
          await addDoc(collection(db, 'worker_reels'), { ...newReel, createdAt: serverTimestamp() });
        } catch (e) { console.warn(e); }
      } 
      else if (createType === 'photo') {
        const newPhoto: WorkPhotoItem = {
          id: generateUniqueId('photo'),
          workerId: profile?.uid || 'worker_me',
          workerName,
          workerRole,
          workerAvatar: avatar,
          workerRating: 4.95,
          workerBadge: 'Verified Pro',
          title: titleInput.trim(),
          tradeCategory: tradeInput,
          imageUrl: afterImgInput || mediaUrlInput || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1200&auto=format&fit=crop',
          beforeImageUrl: beforeImgInput || undefined,
          afterImageUrl: afterImgInput || undefined,
          description: contentInput.trim() || 'Physical evidence of completed trade installation.',
          location: locationInput.trim(),
          projectCost: projectCostInput.trim(),
          completionTime: timeTakenInput.trim(),
          toolsUsed: toolsInput.split(',').map(s => s.trim()).filter(Boolean),
          tags,
          likesCount: 0,
          viewsCount: 1,
          createdAt: getCurrentIsoString()
        };

        const updated = addLocalPhoto(newPhoto);
        setPhotos(updated);
        try {
          await addDoc(collection(db, 'work_photos'), { ...newPhoto, createdAt: serverTimestamp() });
        } catch (e) { console.warn(e); }
      } 
      else {
        // Create Post
        const newPost: WorkerPost = {
          id: generateUniqueId('post'),
          authorId: profile?.uid || 'author_me',
          authorName: workerName,
          authorRole: workerRole,
          authorAvatar: avatar,
          authorBadge: profile?.isWorkerMode ? 'Verified Pro' : undefined,
          authorRating: 4.96,
          tradeCategory: tradeInput,
          postType: postTypeInput,
          title: titleInput.trim(),
          content: contentInput.trim(),
          images: mediaUrlInput ? [mediaUrlInput] : (afterImgInput ? [afterImgInput] : undefined),
          beforeImage: beforeImgInput || undefined,
          afterImage: afterImgInput || undefined,
          location: locationInput.trim(),
          likesCount: 0,
          commentsCount: 0,
          tags,
          createdAt: getCurrentIsoString(),
          comments: []
        };

        const updated = addLocalPost(newPost);
        setPosts(updated);
        try {
          await addDoc(collection(db, 'worker_posts'), { ...newPost, createdAt: serverTimestamp() });
        } catch (e) { console.warn(e); }
      }

      haptics.success();
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitleInput('');
    setContentInput('');
    setMediaUrlInput('');
    setBeforeImgInput('');
    setAfterImgInput('');
    setErrorMsg(null);
  };

  const tradeCategories: { id: ReelTradeCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All Trades', icon: '⚡' },
    { id: 'plumbing', label: 'Plumbing', icon: '🔧' },
    { id: 'electrical', label: 'Electrical', icon: '⚡' },
    { id: 'carpentry', label: 'Carpentry', icon: '🪚' },
    { id: 'painting', label: 'Painting', icon: '🎨' },
    { id: 'cleaning', label: 'Cleaning', icon: '✨' },
    { id: 'handyman', label: 'Handyman', icon: '🛠️' },
    { id: 'hvac', label: 'HVAC / Heat', icon: '🔥' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 pt-3 text-slate-800 dark:text-slate-100">
      {/* Top Space Header */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                Craft & Community Hub
              </span>
              <span aria-hidden="true">·</span>
              <span>London E1</span>
              <span aria-hidden="true">·</span>
              <span>Shoreditch</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
              Showcase Space
            </h1>
          </div>

          {/* Action to Post/Upload */}
          <button
            onClick={() => {
              haptics.light();
              setCreateType(activeSpace === 'reels' ? 'reel' : activeSpace === 'pics' ? 'photo' : 'post');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer border-none"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>+ Create</span>
          </button>
        </div>

        {/* The 3 Dedicated Primary Spaces Switcher (Reels / Pics / Post Area) with Fluid Motion Pill */}
        <div className="relative bg-slate-200/70 dark:bg-slate-900/90 p-1 rounded-2xl flex items-center shadow-inner border border-slate-300/50 dark:border-slate-800 mb-4 select-none">
          {[
            { id: 'reels', label: 'Reels', icon: Film, count: filteredReels.length },
            { id: 'pics', label: 'Work Pics', icon: ImageIcon, count: filteredPhotos.length },
            { id: 'posts', label: 'Post Area', icon: MessageSquareText, count: filteredPosts.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSpace === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { haptics.light(); setActiveSpace(tab.id as any); }}
                className={`relative flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 font-black text-xs transition-colors z-10 cursor-pointer ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-showcase-space-pill"
                    className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700/60"
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon size={15} className={isActive ? 'animate-pulse' : ''} />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-mono ml-0.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400'}`}>
                    ({tab.count})
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Global Search and Category Bar */}
        <div className="space-y-3 mb-5">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeSpace === 'reels' ? 'reels by plumber, tool or tag' : activeSpace === 'pics' ? 'work photos or before/after jobs' : 'posts, trade tips & questions'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Trade Filter Pills Horizontal Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {tradeCategories.map((t) => (
              <button
                key={t.id}
                onClick={() => { haptics.light(); setSelectedTrade(t.id); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  selectedTrade === t.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* If on Post Area, show Post Type filters: All, Pro Tips, Q&A, Experience, Showcase */}
          {activeSpace === 'posts' && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              {[
                { id: 'all', label: 'All Feeds' },
                { id: 'tip', label: '💡 Pro Tips' },
                { id: 'experience', label: '🛠 Job Stories' },
                { id: 'question', label: '❓ Ask a Pro (Q&A)' },
                { id: 'showcase', label: '✨ Completed Works' },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => { haptics.light(); setPostTypeFilter(sub.id); }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                    postTypeFilter === sub.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-850 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* =========================================================================
            SPACE 1: REELS (Short Videos & Live Demonstrations)
            ========================================================================= */}
        {activeSpace === 'reels' && (
          <div className="space-y-4">
            {/* Top Prompt Banner */}
            <div className="p-3.5 bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-blue-600/10 border border-indigo-500/20 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
                  <Film size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    Trades in Motion (Reels)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    Watch plumbers, electricians & joiners solve real emergencies.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  haptics.light();
                  setCreateType('reel');
                  setShowCreateModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-black shrink-0 hover:bg-indigo-500 shadow-sm transition-all"
              >
                + Add Reel
              </button>
            </div>

            {filteredReels.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
                <Film size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No reels found for this trade</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Be the first tradesperson to put a reel about your recent work!</p>
                <button
                  onClick={() => { setCreateType('reel'); setShowCreateModal(true); }}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  Post First Reel
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredReels.map((reel, index) => (
                  <motion.div
                    key={reel.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      haptics.light();
                      setActiveViewerIndex(index);
                    }}
                    className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 group cursor-pointer shadow-md hover:shadow-xl transition-all"
                  >
                    {/* Thumbnail / Video */}
                    <img 
                      src={reel.thumbnailUrl || reel.afterImageUrl || 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?q=80&w=800&auto=format&fit=crop'} 
                      alt={reel.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 pointer-events-none" />

                    {/* Top Unboxed Metadata */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none drop-shadow-md">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                        {reel.tradeCategory}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-white/90 font-mono font-bold bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-md">
                        <Eye size={11} />
                        {reel.viewsCount}
                      </span>
                    </div>

                    {/* Center Play Button Overlay on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center text-white border border-white/40 shadow-lg group-hover:scale-110 transition-transform">
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      </div>
                    </div>

                    {/* Bottom Metadata */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none">
                      <div className="flex items-center gap-1.5 mb-1">
                        <img 
                          src={reel.workerAvatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop'} 
                          alt={reel.workerName}
                          className="w-4 h-4 rounded-full object-cover border border-white/40"
                        />
                        <span className="text-[10px] font-bold text-white truncate">
                          {reel.workerName}
                        </span>
                      </div>

                      <h4 className="text-[11px] font-extrabold text-white leading-tight line-clamp-2">
                        {reel.title}
                      </h4>

                      {reel.clientSavings && (
                        <p className="text-[9px] text-emerald-400 font-black mt-0.5 truncate">
                          ✓ {reel.clientSavings}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SPACE 2: PICS (Work Gallery, Before/After Slider & Craft Evidence)
            ========================================================================= */}
        {activeSpace === 'pics' && (
          <div className="space-y-4">
            {/* Top Prompt Banner */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-indigo-600/10 border border-emerald-500/20 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    Work Evidence Photo Gallery
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    Inspect physical before & after transformations, pipework & joinery.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  haptics.light();
                  setCreateType('photo');
                  setShowCreateModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-black shrink-0 hover:bg-emerald-500 shadow-sm transition-all"
              >
                + Add Photos
              </button>
            </div>

            {filteredPhotos.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
                <ImageIcon size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No project photos yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Upload before & after photos of your craft!</p>
                <button
                  onClick={() => { setCreateType('photo'); setShowCreateModal(true); }}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  Upload First Photo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPhotos.map((photo) => (
                  <div 
                    key={photo.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all"
                  >
                    {/* Card Header */}
                    <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <img 
                          src={photo.workerAvatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop'} 
                          alt={photo.workerName}
                          className="w-10 h-10 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              {photo.workerName}
                            </h4>
                            {photo.workerBadge && (
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black border border-emerald-500/20">
                                {photo.workerBadge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-2 mt-0.5">
                            <span>{photo.workerRole}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <MapPin size={10} /> {photo.location}
                            </span>
                          </p>
                        </div>
                      </div>

                      {onChat && (
                        <button
                          onClick={() => {
                            haptics.light();
                            onChat(photo.workerId, photo.workerName);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-black transition-colors"
                        >
                          Chat Pro
                        </button>
                      )}
                    </div>

                    {/* Image / Before & After Interactive View */}
                    <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden group">
                      {photo.beforeImageUrl && photo.afterImageUrl ? (
                        <div 
                          className="relative w-full h-full cursor-ew-resize select-none"
                          onClick={() => setActivePhotoLightbox(photo)}
                        >
                          {/* After Image (Background) */}
                          <img 
                            src={photo.afterImageUrl} 
                            alt="After repair" 
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[9px] font-black uppercase tracking-wider backdrop-blur-sm z-10">
                            AFTER
                          </span>

                          {/* Before Image (Clipped Left Layer) */}
                          <div 
                            className="absolute inset-0 overflow-hidden"
                            style={{ width: `${sliderPosition}%` }}
                          >
                            <img 
                              src={photo.beforeImageUrl} 
                              alt="Before repair" 
                              className="absolute inset-0 w-full h-full object-cover max-w-none"
                              style={{ width: '100%', minWidth: '100%' }}
                            />
                            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-[9px] font-black uppercase tracking-wider backdrop-blur-sm z-10">
                              BEFORE
                            </span>
                          </div>

                          {/* Split Divider Handle */}
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)] z-20 pointer-events-none flex items-center justify-center"
                            style={{ left: `${sliderPosition}%` }}
                          >
                            <div className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-md text-slate-800 shadow-xl border border-white flex items-center justify-center text-[11px] font-black select-none">
                              ↔
                            </div>
                          </div>

                          {/* Range Slider for drag control */}
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={sliderPosition}
                            onChange={(e) => setSliderPosition(Number(e.target.value))}
                            className="absolute inset-0 opacity-0 cursor-ew-resize z-30 w-full h-full"
                          />
                        </div>
                      ) : (
                        <img 
                          src={photo.imageUrl} 
                          alt={photo.title}
                          onClick={() => setActivePhotoLightbox(photo)}
                          className="w-full h-full object-cover cursor-pointer group-hover:scale-102 transition-transform duration-300"
                        />
                      )}
                    </div>

                    {/* Card Content & Details */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {photo.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed mt-1">
                          {photo.description}
                        </p>
                      </div>

                      {/* Project Specs Row with Unboxed Typography */}
                      <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-350 font-semibold py-1">
                        <span className="font-black text-slate-900 dark:text-white">{photo.projectCost || '£150'}</span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span>{photo.completionTime || '45m'} completion</span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="capitalize font-bold text-indigo-600 dark:text-indigo-400">{photo.tradeCategory}</span>
                      </div>

                      {/* Tools & Tags as clean typography */}
                      {photo.toolsUsed && photo.toolsUsed.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-bold flex items-center gap-1 text-slate-400">
                            <Wrench size={11} />
                            Tools:
                          </span>
                          <span>{photo.toolsUsed.join(', ')}</span>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              haptics.light();
                              setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, likesCount: p.likesCount + 1 } : p));
                            }}
                            className="flex items-center gap-1 text-slate-500 hover:text-rose-500 text-xs font-bold transition-colors"
                          >
                            <Heart size={14} className="hover:scale-125 transition-transform" />
                            <span>{photo.likesCount}</span>
                          </button>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Eye size={12} /> {photo.viewsCount} views
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            haptics.light();
                            setActivePhotoLightbox(photo);
                          }}
                          className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                        >
                          <span>Full Inspection</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SPACE 3: POST AREA (Trade Experience Feed, Pro Tips & Ask a Pro Q&A)
            ========================================================================= */}
        {activeSpace === 'posts' && (
          <div className="space-y-4">
            {/* Post Creator Prompt Card */}
            <div 
              onClick={() => {
                haptics.light();
                setCreateType('post');
                setShowCreateModal(true);
              }}
              className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-400 transition-all flex items-center gap-3"
            >
              <img 
                src={profile?.avatarUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop'} 
                alt="Me" 
                className="w-10 h-10 rounded-2xl object-cover shrink-0"
              />
              <div className="flex-1 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-xs text-slate-400 font-semibold border border-slate-200/60 dark:border-slate-700/60">
                {profile?.isWorkerMode 
                  ? 'Share a trade pro tip, emergency fix, or advice...' 
                  : 'Ask a verified plumber, electrician or handyman a question...'}
              </div>
              <button className="p-2.5 rounded-2xl bg-indigo-600 text-white shrink-0 hover:bg-indigo-500 shadow-md shadow-indigo-600/20">
                <Plus size={16} />
              </button>
            </div>

            {/* Posts Feed */}
            {filteredPosts.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
                <MessageSquareText size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No posts in this category</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Publish a pro tip or ask a local trade specialist a question.</p>
                <button
                  onClick={() => { setCreateType('post'); setShowCreateModal(true); }}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  Write Post
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => {
                  const isLiked = !!likedPostIds[post.id];
                  const isCommenting = activeCommentPostId === post.id;

                  return (
                    <article 
                      key={post.id}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all"
                    >
                      {/* Post Header */}
                      <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <img 
                            src={post.authorAvatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop'} 
                            alt={post.authorName}
                            className="w-10 h-10 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                                {post.authorName}
                              </h4>
                              {post.authorBadge && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                  ✓ Verified
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                              <span>{post.authorRole}</span>
                              {post.location && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{post.location}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Clean Editorial Post Type Indicator */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-extrabold text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {post.postType === 'tip' ? '💡 Pro Tip' : post.postType === 'question' ? '❓ Community Q&A' : post.postType === 'experience' ? '🛠 Job Story' : '✨ Completed Job'}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="capitalize font-bold">{post.tradeCategory}</span>
                        </div>
                      </div>

                      {/* Post Body */}
                      <div className="p-4 space-y-3">
                        {post.title && (
                          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                            {post.title}
                          </h3>
                        )}

                        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-normal">
                          {post.content}
                        </p>

                        {/* Attached Images */}
                        {post.images && post.images.length > 0 && (
                          <div className={`grid gap-2 rounded-2xl overflow-hidden mt-3 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {post.images.map((img, i) => (
                              <img 
                                key={i}
                                src={img} 
                                alt="Post attachment" 
                                className="w-full h-56 object-cover rounded-2xl hover:brightness-95 transition-all"
                              />
                            ))}
                          </div>
                        )}

                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {post.tags.map((tag, i) => (
                              <span key={i} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Interactive Engagement Row */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => handleToggleLikePost(post.id)}
                              className={`flex items-center gap-1.5 text-xs font-bold transition-all ${
                                isLiked 
                                  ? 'text-rose-500 scale-105' 
                                  : 'text-slate-500 hover:text-rose-500'
                              }`}
                            >
                              <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                              <span>{post.likesCount}</span>
                            </button>

                            <button
                              onClick={() => {
                                haptics.light();
                                setActiveCommentPostId(isCommenting ? null : post.id);
                              }}
                              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-500 transition-colors"
                            >
                              <MessageSquare size={16} />
                              <span>{post.commentsCount || (post.comments ? post.comments.length : 0)} Comments</span>
                            </button>
                          </div>

                          {onChat && post.authorBadge && (
                            <button
                              onClick={() => {
                                haptics.light();
                                onChat(post.authorId, post.authorName);
                              }}
                              className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              <span>Ask Direct</span>
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>

                        {/* Expandable Comments Drawer */}
                        <AnimatePresence>
                          {isCommenting && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3"
                            >
                              {/* Existing comments list */}
                              {post.comments && post.comments.length > 0 ? (
                                <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                                  {post.comments.map(c => (
                                    <div key={c.id} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-black text-slate-900 dark:text-white">
                                            {c.authorName}
                                          </span>
                                          {c.authorBadge && (
                                            <span className="px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black">
                                              {c.authorBadge}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                          {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <p className="text-slate-600 dark:text-slate-350 leading-relaxed font-normal">
                                        {c.comment}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No comments yet. Start the conversation!</p>
                              )}

                              {/* Add comment input */}
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="text"
                                  placeholder="Write a helpful reply or follow-up question..."
                                  value={newCommentText}
                                  onChange={(e) => setNewCommentText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddComment(post.id);
                                  }}
                                  className="flex-1 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-white"
                                />
                                <button
                                  onClick={() => handleAddComment(post.id)}
                                  disabled={!newCommentText.trim()}
                                  className="p-2 rounded-xl bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 transition-all cursor-pointer"
                                >
                                  <Send size={14} />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          FULLSCREEN REEL VIEWER MODAL
          ========================================================================= */}
      {activeViewerIndex !== null && (
        <ReelViewerModal
          isOpen={activeViewerIndex !== null}
          onClose={() => setActiveViewerIndex(null)}
          reels={filteredReels}
          initialReelIndex={activeViewerIndex}
          onChatWorker={(id, name) => onChat && onChat(id, name)}
        />
      )}

      {/* =========================================================================
          PHOTO LIGHTBOX MODAL
          ========================================================================= */}
      <AnimatePresence>
        {activePhotoLightbox && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 text-white">
            <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
              <div>
                <h3 className="text-sm font-black">{activePhotoLightbox.title}</h3>
                <p className="text-[11px] text-slate-400">{activePhotoLightbox.workerName} • {activePhotoLightbox.location}</p>
              </div>
              <button 
                onClick={() => setActivePhotoLightbox(null)}
                className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center max-w-2xl mx-auto w-full my-4">
              <img 
                src={activePhotoLightbox.afterImageUrl || activePhotoLightbox.imageUrl} 
                alt={activePhotoLightbox.title}
                className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
              />
            </div>

            <div className="max-w-2xl mx-auto w-full bg-white/10 p-4 rounded-2xl backdrop-blur-md flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-200">{activePhotoLightbox.description}</p>
                <p className="text-[11px] text-emerald-400 font-bold mt-1">Project Cost: {activePhotoLightbox.projectCost || '£150'}</p>
              </div>
              {onChat && (
                <button
                  onClick={() => {
                    setActivePhotoLightbox(null);
                    onChat(activePhotoLightbox.workerId, activePhotoLightbox.workerName);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shrink-0 ml-3"
                >
                  Hire Worker
                </button>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          CREATE MODAL (+ Post Reel, Share Pictures, Write Post)
          ========================================================================= */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto no-scrollbar p-6 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Publish to Showcase Space
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Share video reels, before/after photos, or community trade tips
                  </p>
                </div>
                <button 
                  onClick={() => { stopCamera(); setShowCreateModal(false); }}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Selector for Type: Reel | Photo | Post */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
                <button
                  type="button"
                  onClick={() => { haptics.light(); setCreateType('reel'); }}
                  className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    createType === 'reel' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Film size={14} /> Reel
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.light(); setCreateType('photo'); }}
                  className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    createType === 'photo' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <ImageIcon size={14} /> Pictures
                </button>
                <button
                  type="button"
                  onClick={() => { haptics.light(); setCreateType('post'); }}
                  className={`py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    createType === 'post' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <MessageSquareText size={14} /> Post
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handlePublish} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                    {createType === 'reel' ? 'Reel Title' : createType === 'photo' ? 'Project / Installation Title' : 'Post Title'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      createType === 'reel' 
                        ? 'e.g. Emergency 22mm Copper Pipe Leak Fixed in 45 Mins' 
                        : createType === 'photo'
                        ? 'e.g. Victorian Bathroom Anti-Syphon Bottle Trap Transformation'
                        : 'e.g. Pro Tip: How to bleed radiators without airlocks'
                    }
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>

                {/* Trade Category Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Trade Category</label>
                    <select
                      value={tradeInput}
                      onChange={(e) => setTradeInput(e.target.value as ReelTradeCategory)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                    >
                      <option value="plumbing">🔧 Plumbing</option>
                      <option value="electrical">⚡ Electrical</option>
                      <option value="carpentry">🪚 Carpentry</option>
                      <option value="painting">🎨 Painting</option>
                      <option value="cleaning">✨ Cleaning</option>
                      <option value="handyman">🛠️ Handyman</option>
                      <option value="hvac">🔥 HVAC / Gas</option>
                      <option value="other">📦 Other Craft</option>
                    </select>
                  </div>

                  {createType === 'post' ? (
                    <div>
                      <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Post Type</label>
                      <select
                        value={postTypeInput}
                        onChange={(e) => setPostTypeInput(e.target.value as PostType)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none"
                      >
                        <option value="tip">💡 Pro Tip / Advice</option>
                        <option value="experience">🛠️ Job Experience</option>
                        <option value="question">❓ Ask a Pro (Q&A)</option>
                        <option value="showcase">✨ Craft Showcase</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Estimated Cost</label>
                      <input
                        type="text"
                        placeholder="e.g. £150"
                        value={projectCostInput}
                        onChange={(e) => setProjectCostInput(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Camera / Recording / Upload Actions */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                      {createType === 'reel' ? 'Video Evidence' : 'Photo Evidence'}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isCameraActive ? (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold flex items-center gap-1"
                        >
                          <Camera size={12} /> Open Device Camera
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold"
                        >
                          Close Camera
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Camera Viewport */}
                  {isCameraActive && (
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
                      <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                        {createType === 'reel' ? (
                          !isRecording ? (
                            <button
                              type="button"
                              onClick={startRecording}
                              className="px-4 py-2 rounded-full bg-red-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg animate-pulse"
                            >
                              <Video size={14} /> Start Recording
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="px-4 py-2 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg border border-red-500"
                            >
                              Stop Recording
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={handleCapturePhoto}
                            className="px-4 py-2 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg"
                          >
                            <Camera size={14} /> Snap Photo
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Media URL / Fallbacks */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      {createType === 'reel' ? 'Video URL / Demo Asset' : 'Photo URL'}
                    </label>
                    <input
                      type="url"
                      placeholder="https://... or auto-filled from camera capture"
                      value={mediaUrlInput}
                      onChange={(e) => setMediaUrlInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white outline-none"
                    />
                  </div>

                  {/* Before & After Image Inputs for Craft Proofs */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-black uppercase text-rose-500 block mb-1">Before Photo (Optional)</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={beforeImgInput}
                        onChange={(e) => setBeforeImgInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-emerald-500 block mb-1">After Photo (Optional)</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={afterImgInput}
                        onChange={(e) => setAfterImgInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Description / Post Content */}
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                    {createType === 'post' ? 'Post Content' : 'Job Details & Experience Description'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe the problem, the tools used, and the craft technique applied..."
                    value={contentInput}
                    onChange={(e) => setContentInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>

                {/* Tools & Tags */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Tools Used</label>
                    <input
                      type="text"
                      placeholder="e.g. Pipe cutter, MAPP torch"
                      value={toolsInput}
                      onChange={(e) => setToolsInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Tags</label>
                    <input
                      type="text"
                      placeholder="#plumbing, #leakrepair"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer border-none disabled:opacity-50"
                  >
                    {submitting ? 'Publishing...' : `Publish ${createType === 'reel' ? 'Reel' : createType === 'photo' ? 'Pictures' : 'Post'}`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
