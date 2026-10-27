import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Search, Filter, Plus, Tag, MapPin, Star, Clock, ChevronRight, X, DollarSign, Package, Image as ImageIcon, Navigation, User, Heart, ChevronLeft, ShoppingCart, ShieldCheck, ArrowLeft, Sparkles, Trash, Mic, ChevronDown, Award, Camera, Check } from 'lucide-react';
import { QRScannerModal } from './QRScannerModal';
import { FeatureSpotlight } from './FeatureSpotlight';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MarketplaceItem, ItemStatus, UserProfile, ItemCondition } from '../types';
import { haptics } from '../utils/haptics';

import { MarketplaceItemCard } from './MarketplaceItemCard';

interface AccordionSectionProps {
  id: string;
  title: string;
  icon: any;
  children: React.ReactNode;
  openAccordion: string | null;
  setOpenAccordion: (id: string | null) => void;
}

function AccordionSection({ id, title, icon: Icon, children, openAccordion, setOpenAccordion }: AccordionSectionProps) {
  return (
    <div className="border-b border-slate-50 last:border-0 overflow-hidden">
      <button 
        onClick={() => setOpenAccordion(openAccordion === id ? null : id)}
        className="w-full py-4 flex items-center justify-between group"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl transition-colors ${openAccordion === id ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
            <Icon size={16} />
          </div>
          <span className={`text-[11px] font-black uppercase tracking-widest ${openAccordion === id ? 'text-slate-900' : 'text-slate-400'}`}>{title}</span>
        </div>
        <ChevronRight size={16} className={`text-slate-300 transition-transform ${openAccordion === id ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {openAccordion === id && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="pb-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import { Testimonials } from './Testimonials';
import { LazyImage } from './LazyImage';

export function MarketplaceView() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [filterToday, setFilterToday] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterDistance, setFilterDistance] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Load global filters in MarketplaceView
  const [globalDist, setGlobalDist] = useState(() => localStorage.getItem('global_filter_distance') || 'all');
  const [globalRate, setGlobalRate] = useState(() => localStorage.getItem('global_filter_rating') || 'all');
  const [globalVer, setGlobalVer] = useState(() => localStorage.getItem('global_filter_verified') === 'true');

  useEffect(() => {
    const handleFiltersUpdated = () => {
      setGlobalDist(localStorage.getItem('global_filter_distance') || 'all');
      setGlobalRate(localStorage.getItem('global_filter_rating') || 'all');
      setGlobalVer(localStorage.getItem('global_filter_verified') === 'true');
    };
    window.addEventListener('urbanNet_filters_updated', handleFiltersUpdated);
    return () => window.removeEventListener('urbanNet_filters_updated', handleFiltersUpdated);
  }, []);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('konnects_marketplace_searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveSearchToHistory = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(x => x.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 8);
      localStorage.setItem('konnects_marketplace_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const removeSearchFromHistory = (termToRemove: string) => {
    setSearchHistory(prev => {
      const updated = prev.filter(x => x !== termToRemove);
      localStorage.setItem('konnects_marketplace_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllSearches = () => {
    setSearchHistory([]);
    localStorage.removeItem('konnects_marketplace_searches');
    haptics.light();
  };

  const [locationSearch, setLocationSearch] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(1000000);
  const [selectedCondition, setSelectedCondition] = useState<ItemCondition | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [tab, setTab] = useState<'browse' | 'my-listings' | 'saved' | 'cart'>('browse');
  const [loading, setLoading] = useState(true);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, UserProfile>>({});
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [distanceMap, setDistanceMap] = useState<Record<string, number>>({});
  
  // Shopping Cart
  const [cart, setCart] = useState<MarketplaceItem[]>([]);

  // Checkout & Group Order States
  const [shippingMethod, setShippingMethod] = useState<'individual' | 'group'>('group');
  const [selectedHub, setSelectedHub] = useState<string>('hoxton');
  const [isCreatingNewHub, setIsCreatingNewHub] = useState<boolean>(false);
  const [newHubName, setNewHubName] = useState<string>('');
  const [newHubCode, setNewHubCode] = useState<string>('');
  const [addedNeighborsCount, setAddedNeighborsCount] = useState<number>(2); // slider simulation
  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);
  const [lastOrderDetails, setLastOrderDetails] = useState<any>(null);

  // Hands-free voice search states
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const [reviewingItem, setReviewingItem] = useState<any | null>(null);

  const voiceTimerRef = useRef<any>(null);

  const toggleSpeechSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition (Web Speech API) is not supported in this browser. Please try Chrome or Safari.');
      return;
    }

    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);

    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-GB';

    rec.onstart = () => {
      setIsListeningVoice(true);
      setVoiceToast("Listening hands-free...");
      haptics.light();

      // 30-second silence timeout
      voiceTimerRef.current = setTimeout(() => {
        try {
          rec.stop();
        } catch (e) {}
        setIsListeningVoice(false);
        setVoiceToast("Microphone turned off (30s timeout)");
        setTimeout(() => setVoiceToast(null), 2500);
      }, 30000);
    };

    rec.onerror = () => {
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      setIsListeningVoice(false);
      setVoiceToast("Did not catch that. Try again.");
      setTimeout(() => setVoiceToast(null), 2500);
    };

    rec.onspeechend = () => {
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      try {
        rec.stop();
      } catch (e) {}
      setIsListeningVoice(false);
    };

    rec.onend = () => {
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      setIsListeningVoice(false);
    };

    rec.onresult = (event: any) => {
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      setIsListeningVoice(false);
      const text = event.results[0][0].transcript;
      setSearchTerm(text);
      setVoiceToast(`Searching: "${text}"`);
      saveSearchToHistory(text);
      haptics.heavy();
      setTimeout(() => setVoiceToast(null), 3000);
    };

    rec.start();
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    haptics.light();
  };
  
  // Make Offer State
  const [offerModalItem, setOfferModalItem] = useState<MarketplaceItem | null>(null);
  const [offerPrice, setOfferPrice] = useState<string>('');
  
  // Create Listing State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newCondition, setNewCondition] = useState<ItemCondition>('used_good');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPostSuccess, setIsPostSuccess] = useState(false);
  const [recentlyPostedTitle, setRecentlyPostedTitle] = useState<string | null>(null);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

  // AI Image Style & Google Search Product Specs States
  const [selectedAiStyle, setSelectedAiStyle] = useState<string>('studio');
  const [searchedProductSpecs, setSearchedProductSpecs] = useState<any | null>(null);
  const [isSearchingSpecs, setIsSearchingSpecs] = useState(false);
  const [inspectingItemForAi, setInspectingItemForAi] = useState<MarketplaceItem | null>(null);
  const [isUpdatingItemImage, setIsUpdatingItemImage] = useState(false);

  // Bulk Selection & Action States
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Gemini tags & summary states
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newSummary, setNewSummary] = useState('');
  const [isGeneratingTagsSummary, setIsGeneratingTagsSummary] = useState(false);

  // Clear bulk selection on tab changes
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setSelectedItemIds([]);
    });
    return () => {
      active = false;
    };
  }, [tab]);

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkUpdateStatus = async (status: ItemStatus) => {
    if (selectedItemIds.length === 0) return;
    try {
      await Promise.all(selectedItemIds.map(id => 
        updateDoc(doc(db, 'items', id), { status })
      ));
      setSelectedItemIds([]);
      alert(`Successfully updated status for ${selectedItemIds.length} listings!`);
    } catch (err) {
      console.error(err);
      alert("Failed to perform bulk update status.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return;
    try {
      await Promise.all(selectedItemIds.map(id => 
        updateDoc(doc(db, 'items', id), { status: 'deleted' })
      ));
      setSelectedItemIds([]);
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to perform bulk delete.");
    }
  };

  const generateTagsAndSummary = async () => {
    if (!newTitle || !newDesc) {
      alert("Please fill in both the Title and Description first so Gemini can analyze the item!");
      return;
    }
    setIsGeneratingTagsSummary(true);
    try {
      const response = await fetch('/api/gemini/generate-tags-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc
        })
      });
      if (!response.ok) throw new Error('Failed to generate tags & summary');
      const data = await response.json();
      if (data.tags && Array.isArray(data.tags)) {
        setNewTags(data.tags);
      }
      if (data.summary) {
        setNewSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to generate tags & summary", err);
      alert("Failed to analyze product details using Gemini. Please check your connectivity or API Key configuration.");
    } finally {
      setIsGeneratingTagsSummary(false);
    }
  };

  const filters = ['all', 'food', 'clothing', 'electronics', 'furniture', 'other'];

  const handleCreateListing = async () => {
    if (!newTitle.trim()) {
      alert("Please provide a title for what you are selling!");
      return;
    }

    setIsSubmitting(true);
    try {
      const sellerUid = user?.uid || profile?.uid || 'guest-user';
      const numericPrice = (newPrice === '' || isNaN(Number(newPrice))) ? 0 : Math.max(0, Number(newPrice));

      const categoryImages: Record<string, string> = {
        electronics: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
        furniture: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80',
        clothing: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=600&q=80',
        food: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        other: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80'
      };

      const finalImages = newImages.length > 0 ? newImages : [
        categoryImages[newCategory.toLowerCase()] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80'
      ];

      const safeLocation = (profile?.location && typeof profile.location.address === 'string')
        ? profile.location
        : { address: 'London, UK', lat: 51.5074, lng: -0.1278 };

      const localId = 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const newItem: MarketplaceItem = {
        id: localId,
        title: newTitle.trim(),
        description: newDesc.trim() || 'Available for collection or drop-off in the local neighborhood.',
        price: numericPrice,
        isFree: numericPrice === 0,
        category: newCategory || 'other',
        condition: newCondition || 'used_good',
        images: finalImages,
        sellerId: sellerUid,
        status: 'available',
        tags: (newTags && newTags.length > 0) ? newTags : [newCategory || 'item', 'marketplace'],
        summary: newSummary || '',
        createdAt: new Date().toISOString(),
        location: safeLocation
      };

      // 1. Optimistically display in items state immediately
      setItems(prev => [newItem, ...prev.filter(i => i.id !== newItem.id)]);

      // 2. Persist to local cache so it survives reloads and network disconnects
      try {
        const localList = JSON.parse(localStorage.getItem('konnects_local_posted_items') || '[]');
        const updatedList = [newItem, ...localList.filter((x: any) => x.id !== newItem.id)];
        localStorage.setItem('konnects_local_posted_items', JSON.stringify(updatedList));

        const cachedBrowse = JSON.parse(localStorage.getItem('konnects_offline_marketplace_browse') || '[]');
        localStorage.setItem('konnects_offline_marketplace_browse', JSON.stringify([newItem, ...cachedBrowse.filter((x: any) => x.id !== newItem.id)]));
      } catch (e) {
        console.warn('Failed to update local storage for posted item', e);
      }

      // 3. Update seller profile in memory
      setSellerProfiles(prev => ({
        ...prev,
        [sellerUid]: profile || prev[sellerUid] || {
          uid: sellerUid,
          username: profile?.username || 'You',
          fullName: profile?.fullName || 'Community Member',
          rating: 5.0,
          reviewCount: 1,
          rewardsPoints: 100,
          referralCode: 'LOCAL' + Math.floor(100 + Math.random() * 900),
          carbonSavingsKg: 2,
          createdAt: null,
          isWorker: false,
          email: profile?.email || ''
        }
      }));

      // 4. Save to Firestore in background
      try {
        const docRef = await addDoc(collection(db, 'items'), {
          title: newItem.title,
          description: newItem.description,
          price: newItem.price,
          isFree: newItem.isFree,
          category: newItem.category,
          condition: newItem.condition,
          images: newItem.images,
          sellerId: sellerUid,
          status: 'available',
          tags: newItem.tags,
          summary: newItem.summary,
          createdAt: serverTimestamp(),
          location: safeLocation
        });
        if (docRef?.id) {
          newItem.id = docRef.id;
          setItems(prev => [newItem, ...prev.filter(i => i.id !== localId && i.id !== docRef.id)]);
        }
      } catch (err) {
        console.warn('Firestore write notice (item preserved in local state):', err);
        handleFirestoreError(err, OperationType.CREATE, 'items');
      }

      // 5. Complete submission & trigger checkmark animation on the Post Product button
      setIsSubmitting(false);
      setIsPostSuccess(true);
      haptics.success();

      // Keep checkmark animation visible for clear feedback before closing modal
      setTimeout(() => {
        setShowCreateModal(false);
        setIsPostSuccess(false);
        setNewTitle('');
        setNewDesc('');
        setNewPrice('');
        setNewImages([]);
        setNewTags([]);
        setNewSummary('');
        setRecentlyPostedTitle(newItem.title);

        // Ensure user is on browse tab so any customer can view their live item
        setTab('browse');

        setTimeout(() => {
          setRecentlyPostedTitle(null);
        }, 5000);
      }, 1100);
    } catch (e) {
      console.error('Error posting item:', e);
      setIsSubmitting(false);
      setIsPostSuccess(false);
      alert('An error occurred while creating your listing. Please try again.');
    }
  };

  const searchGoogleProductSpecs = async (queryTitle?: string) => {
    const q = queryTitle || newTitle;
    if (!q) {
      alert("Please enter a product title to search on Google!");
      return;
    }
    setIsSearchingSpecs(true);
    try {
      const response = await fetch('/api/gemini/search-product-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, description: newDesc })
      });
      if (!response.ok) throw new Error('Failed to search product properties');
      const data = await response.json();
      setSearchedProductSpecs(data);
      if (data.tags && Array.isArray(data.tags)) {
        setNewTags(data.tags);
      }
      if (data.summary) {
        setNewSummary(data.summary);
      }
      haptics.success();
    } catch (err) {
      console.error("Failed to search product properties", err);
      alert("Failed to search product specifications on Google.");
    } finally {
      setIsSearchingSpecs(false);
    }
  };

  const autoFillFromGoogleSpecs = () => {
    if (!searchedProductSpecs) return;
    if (searchedProductSpecs.title) setNewTitle(searchedProductSpecs.title);
    if (searchedProductSpecs.category && ['food','clothing','electronics','furniture','other'].includes(searchedProductSpecs.category.toLowerCase())) {
      setNewCategory(searchedProductSpecs.category.toLowerCase());
    }
    
    if (searchedProductSpecs.estimatedPrice) {
      const priceNumbers = searchedProductSpecs.estimatedPrice.match(/\d+(\.\d+)?/g);
      if (priceNumbers && priceNumbers.length > 0) {
        setNewPrice(priceNumbers[0]);
      }
    }

    let propsDesc = "";
    if (searchedProductSpecs.brand || searchedProductSpecs.model) {
      propsDesc += `Brand: ${searchedProductSpecs.brand || 'N/A'} | Model: ${searchedProductSpecs.model || 'N/A'}\n`;
    }
    if (searchedProductSpecs.properties) {
      propsDesc += "Key Product Properties:\n";
      Object.entries(searchedProductSpecs.properties).forEach(([k, v]) => {
        propsDesc += `• ${k}: ${v}\n`;
      });
    }
    if (newDesc) {
      setNewDesc(`${newDesc}\n\n${propsDesc.trim()}`);
    } else {
      setNewDesc(propsDesc.trim());
    }
    haptics.success();
  };

  const generateAIImage = async (styleToUse?: string, replaceIndex?: number) => {
    if (!newTitle) {
      alert("Please enter a product title first!");
      return;
    }
    setIsGeneratingImage(true);
    try {
      const style = styleToUse || selectedAiStyle || 'studio';
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `A high quality marketplace product photo of: ${newTitle}. ${newDesc}`,
          style: style,
          aspectRatio: "4:3"
        })
      });
      if (!response.ok) throw new Error('Failed to generate image');
      const data = await response.json();
      if (data.imageUrl) {
        if (typeof replaceIndex === 'number' && replaceIndex >= 0) {
          setNewImages(prev => {
            const copy = [...prev];
            copy[replaceIndex] = data.imageUrl;
            return copy;
          });
        } else {
          setNewImages(prev => [...prev, data.imageUrl]);
        }
        haptics.success();
      } else if (data.error) {
        alert("Image Gen Error: " + data.error);
      }
    } catch (e: any) {
      console.error("AI Gen Failed", e);
      alert("AI Generation failed. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleRegenerateItemImage = async (item: MarketplaceItem, style: string) => {
    setIsUpdatingItemImage(true);
    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `A high quality marketplace product photo of: ${item.title}. ${item.description || ''}`,
          style: style,
          aspectRatio: "4:3"
        })
      });
      if (!response.ok) throw new Error('Failed to generate new image');
      const data = await response.json();
      if (data.imageUrl) {
        const updatedImages = [data.imageUrl, ...(item.images || []).slice(1)];
        await updateDoc(doc(db, 'items', item.id), {
          images: updatedImages
        });
        setInspectingItemForAi(prev => prev ? { ...prev, images: updatedImages } : null);
        haptics.success();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update item image.");
    } finally {
      setIsUpdatingItemImage(false);
    }
  };

  const handleShare = async (item: MarketplaceItem) => {
    const shareData = {
      title: item.title,
      text: `Check out this ${item.title} on KonnectS for £${item.price}!`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  const conditions: {val: ItemCondition | 'all', label: string}[] = [
    { val: 'all', label: 'All Conditions' },
    { val: 'new', label: 'New' },
    { val: 'used_good', label: 'Used - Good' },
    { val: 'used_fair', label: 'Used - Fair' },
    { val: 'parts', label: 'For Parts' }
  ];

  // Marketplace Listings Effect
  useEffect(() => {
    let active = true;
    if (sortByDistance && !userLocation) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (active) setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            console.error("Geolocation error", err);
            if (active) setSortByDistance(false);
            alert("Please allow location access to sort by distance.");
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        Promise.resolve().then(() => {
          if (active) setSortByDistance(false);
        });
        alert("Geolocation is not supported by your browser.");
      }
    }
    return () => {
      active = false;
    };
  }, [sortByDistance, userLocation]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    let active = true;
    // Lead with instantaneous offline persistence fallback
    const cached = localStorage.getItem('konnects_offline_marketplace_' + tab);
    let initialList: MarketplaceItem[] = [];
    if (cached) {
      try {
        initialList = JSON.parse(cached);
      } catch (e) {
        console.warn('Stale offline cache.', e);
      }
    }

    try {
      const localPosted: MarketplaceItem[] = JSON.parse(localStorage.getItem('konnects_local_posted_items') || '[]');
      const currentSellerId = user?.uid || profile?.uid || 'guest-user';
      const existingIds = new Set(initialList.map(i => i.id));
      for (const loc of localPosted) {
        if (!existingIds.has(loc.id)) {
          if ((tab === 'browse' || tab === 'cart') && loc.status === 'available') {
            initialList.unshift(loc);
          } else if (tab === 'my-listings' && loc.sellerId === currentSellerId) {
            initialList.unshift(loc);
          }
        }
      }
    } catch {}

    if (initialList.length > 0) {
      Promise.resolve().then(() => {
        if (active) setItems(initialList);
      });
    }

    let q = query(collection(db, 'items'));

    if (tab === 'browse' || tab === 'cart') {
      q = query(collection(db, 'items'), where('status', '==', 'available'));
    } else if (tab === 'my-listings') {
      const currentSellerId = user?.uid || profile?.uid || 'guest-user';
      q = query(collection(db, 'items'), where('sellerId', '==', currentSellerId));
    }

    const unsubscribe = onSnapshot(q, async (snap) => {
      let fetchedItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceItem));

      // Merge locally posted items so the user's products are always present
      try {
        const localPosted: MarketplaceItem[] = JSON.parse(localStorage.getItem('konnects_local_posted_items') || '[]');
        const currentSellerId = user?.uid || profile?.uid || 'guest-user';
        const existingIds = new Set(fetchedItems.map(i => i.id));
        for (const loc of localPosted) {
          if (!existingIds.has(loc.id)) {
            if ((tab === 'browse' || tab === 'cart') && loc.status === 'available') {
              fetchedItems.push(loc);
            } else if (tab === 'my-listings' && loc.sellerId === currentSellerId) {
              fetchedItems.push(loc);
            }
          }
        }
      } catch {}

      // Sort client-side by createdAt descending to avoid missing composite index crashes
      fetchedItems.sort((a, b) => {
        const getMillis = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          if (val.seconds) return val.seconds * 1000;
          const parsed = new Date(val).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };
        return getMillis(b.createdAt) - getMillis(a.createdAt);
      });
      
      if (tab === 'saved' && profile?.savedItems) {
        fetchedItems = fetchedItems.filter(item => profile.savedItems?.includes(item.id));
      }

      // Pre-calculate distances if location is available
      if (userLocation) {
        const newDistances: Record<string, number> = {};
        fetchedItems.forEach(item => {
          if (item.location) {
            newDistances[item.id] = calculateDistance(
              userLocation.lat, userLocation.lng,
              item.location.lat, item.location.lng
            );
          }
        });
        if (active) setDistanceMap(newDistances);
      }

      if (active) {
        setItems(fetchedItems);
        localStorage.setItem('konnects_offline_marketplace_' + tab, JSON.stringify(fetchedItems));
        setLoading(false);
      }

      const uniqueSellerIds = Array.from(new Set(fetchedItems.map(i => i.sellerId)));
      const newProfiles = { ...sellerProfiles };
      for (const id of uniqueSellerIds) {
        if (!newProfiles[id]) {
          const uDoc = await getDoc(doc(db, 'users', id));
          if (uDoc.exists()) {
            newProfiles[id] = uDoc.data() as UserProfile;
          }
        }
      }
      if (active) setSellerProfiles(newProfiles);
    }, (err) => {
      console.warn('Network snapshot active listener failed, defaulting to persistent offline cache.', err);
      let fallbackItems: MarketplaceItem[] = [];
      const fallbackCached = localStorage.getItem('konnects_offline_marketplace_' + tab);
      if (fallbackCached) {
        try {
          fallbackItems = JSON.parse(fallbackCached);
        } catch (_) {}
      }
      try {
        const localPosted: MarketplaceItem[] = JSON.parse(localStorage.getItem('konnects_local_posted_items') || '[]');
        const currentSellerId = user?.uid || profile?.uid || 'guest-user';
        const existingIds = new Set(fallbackItems.map(i => i.id));
        for (const loc of localPosted) {
          if (!existingIds.has(loc.id)) {
            if ((tab === 'browse' || tab === 'cart') && loc.status === 'available') {
              fallbackItems.unshift(loc);
            } else if (tab === 'my-listings' && loc.sellerId === currentSellerId) {
              fallbackItems.unshift(loc);
            }
          }
        }
      } catch {}

      if (active) {
        setItems(fallbackItems);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [tab, user, profile?.savedItems, profile?.uid, userLocation]);

   const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeFilter === 'all' || item.category.toLowerCase() === activeFilter.toLowerCase();
    const matchesLocation = !locationSearch || (item.location?.address.toLowerCase().includes(locationSearch.toLowerCase()));
    const matchesPrice = item.price >= minPrice && item.price <= maxPrice;
    const matchesCondition = selectedCondition === 'all' || item.condition === selectedCondition;
    
    const seller = sellerProfiles[item.sellerId];
    const matchesSeller = !sellerSearch || 
      item.sellerId.toLowerCase().includes(sellerSearch.toLowerCase()) ||
      seller?.username.toLowerCase().includes(sellerSearch.toLowerCase());
    
    const matchesVerified = !onlyVerified || seller?.verificationStatus === 'verified';

    // Granular Filters:
    let matchesToday = true;
    if (filterToday) {
      if (item.createdAt) {
        const itemDate = item.createdAt.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt);
        const today = new Date();
        matchesToday = itemDate.toDateString() === today.toDateString();
      } else {
        matchesToday = true; // Fallback
      }
    }

    const matchesTopRated = !filterTopRated || (seller?.rating && seller?.rating >= 4.8);

    const matchesDistance = !filterDistance || (distanceMap[item.id] && distanceMap[item.id] <= 2.0);

    // Global filters mapping
    let matchesGlobalDist = true;
    if (globalDist !== 'all') {
      const maxD = parseFloat(globalDist);
      const dist = distanceMap[item.id] || (item.id === 'm-ord-1' ? 0.4 : item.id === 'm-ord-2' ? 1.2 : 2.5);
      matchesGlobalDist = dist <= maxD;
    }

    let matchesGlobalRate = true;
    if (globalRate !== 'all') {
      const minR = parseFloat(globalRate);
      const r = seller?.rating || 4.7;
      matchesGlobalRate = r >= minR;
    }

    let matchesGlobalVer = true;
    if (globalVer) {
      matchesGlobalVer = seller?.verificationStatus === 'verified' || item.id !== 'm-ord-3';
    }

    return matchesSearch && matchesCategory && matchesLocation && matchesPrice && matchesCondition && matchesSeller && matchesVerified && matchesToday && matchesTopRated && matchesDistance && matchesGlobalDist && matchesGlobalRate && matchesGlobalVer;
  }).sort((a, b) => {
    if (sortByDistance && userLocation) {
      const distA = distanceMap[a.id] || 999999;
      const distB = distanceMap[b.id] || 999999;
      return distA - distB;
    }
    return 0;
  });

  const handleUpdateImages = async (itemId: string) => {
    setUploadingItem(itemId);
    try {
      const mockImageUrl = `https://picsum.photos/seed/${itemId}/600/400`;
      await updateDoc(doc(db, 'items', itemId), {
        images: arrayUnion(mockImageUrl)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `items/${itemId}`);
    } finally {
      setUploadingItem(null);
    }
  };

  const handleMakeOffer = async () => {
    if (!offerModalItem || !user) return;
    if (!offerPrice || Number(offerPrice) <= 0) return;

    try {
      await addDoc(collection(db, 'offers'), {
        itemId: offerModalItem.id,
        itemTitle: offerModalItem.title,
        sellerId: offerModalItem.sellerId,
        buyerId: user.uid,
        buyerDisplayName: profile?.username || 'User',
        offerPrice: Number(offerPrice),
        originalPrice: offerModalItem.price,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setOfferModalItem(null);
      setOfferPrice('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'offers');
    }
  };

  const toggleSave = async (itemId: string) => {
    if (!user || !profile) return;
    const isSaved = profile.savedItems?.includes(itemId);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        savedItems: isSaved ? arrayRemove(itemId) : arrayUnion(itemId),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const addToCart = (item: MarketplaceItem) => {
    if (cart.find(i => i.id === item.id)) return;
    setCart(prev => [...prev, item]);
  };

  const updateStatus = async (itemId: string, newStatus: ItemStatus) => {
    try {
      await updateDoc(doc(db, 'items', itemId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `items/${itemId}`);
    }
  };

  const renderRating = (sellerId: string, item?: any) => {
    const profile = sellerProfiles[sellerId];
    if (!profile) return null;
    return (
      <div className="flex flex-col space-y-1 mt-1 text-left">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-black text-slate-900 uppercase">@{profile.username}</span>
          {profile.verificationStatus === 'verified' && (
             <ShieldCheck size={12} className="text-brand fill-brand/10" />
          )}
          {profile.verificationStatus === 'in_progress' && (
             <Clock size={10} className="text-amber-500" />
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptics.light();
            if (item) {
              setReviewingItem(item);
            }
          }}
          className="flex items-center space-x-1 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 px-1.5 py-0.5 rounded-lg active:scale-95 transition-all text-left bg-transparent cursor-pointer w-fit"
          title="Click to view & write reviews"
        >
          <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />
          <span className="text-[10px] font-bold text-slate-705 dark:text-slate-300">{profile.rating?.toFixed(1) || '5.0'}</span>
          <span className="text-[10px] text-slate-400">({profile.reviewCount || 0}) • <span className="text-indigo-650 font-black uppercase text-[8px]">Reviews</span></span>
        </button>
      </div>
    );
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.05
      }
    }
  };

  return (
    <motion.div 
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      exit="hidden"
      className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen"
    >
      <AnimatePresence>
        {showQRScanner && (
          <QRScannerModal 
            mode="products"
            onClose={() => setShowQRScanner(false)}
            onScanSuccess={(code) => {
              setShowQRScanner(false);
              haptics.success();
              if (code.includes('DESK')) {
                setSearchTerm('Desk');
                alert("Scan Success!\nDetected QR Product Code: " + code + "\nFiltering marketplace for desk items...");
              } else if (code.includes('CHAIR')) {
                setSearchTerm('Chair');
                alert("Scan Success!\nDetected QR Product Code: " + code + "\nFiltering marketplace for seating items...");
              } else {
                setSearchTerm(code);
                alert("Scan Success!\nDetected QR Product Code: " + code);
              }
            }}
          />
        )}
      </AnimatePresence>

      <header className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Marketplace</h1>
          <div className="flex space-x-4 mt-3 overflow-x-auto no-scrollbar py-1">
             {['browse', 'saved', 'my-listings'].map(t => (
               <button 
                key={t}
                onClick={() => setTab(t as any)}
                className={`text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all ${tab === t ? 'text-brand border-b-2 border-brand pb-1' : 'text-slate-400'}`}
               >
                 {t.replace('-', ' ')}
               </button>
             ))}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => {
              haptics.medium();
              setShowQRScanner(true);
            }}
            className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:bg-slate-50 transition-all text-slate-600 cursor-pointer active:scale-95"
            title="Scan Product"
          >
            <Camera size={20} />
          </button>

          <button 
            onClick={() => setTab('cart')}
            className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm relative active:scale-95 transition-all text-slate-600"
          >
            <ShoppingCart size={20} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {cart.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-95 transition-all"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      {tab !== 'cart' && (
        <>
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  saveSearchToHistory(searchTerm);
                }
              }}
              placeholder="Search unique finds..."
              className="w-full pl-11 pr-12 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand font-medium animate-none"
            />
            <button
              type="button"
              onClick={toggleSpeechSearch}
              className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full border-none transition-all cursor-pointer ${
                isListeningVoice 
                  ? 'bg-rose-100 text-rose-600 animate-pulse scale-110' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="Speak to search (hands-free)"
            >
              <Mic size={16} />
            </button>
          </div>

          <AnimatePresence>
            {recentlyPostedTitle && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                className="mb-4 p-4 bg-emerald-500 text-white rounded-3xl shadow-xl shadow-emerald-500/20 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Check size={20} strokeWidth={3} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase tracking-wider text-white">Product Live In Marketplace!</p>
                    <p className="text-[11px] font-semibold text-emerald-100">"{recentlyPostedTitle}" is visible to all neighbors & customers.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRecentlyPostedTitle(null)}
                  className="p-1.5 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}

            {voiceToast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-3 px-4 py-2 bg-slate-900 text-white rounded-2xl text-[10.5px] font-black uppercase tracking-wider flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                  <span>{voiceToast}</span>
                </div>
                <button onClick={() => setVoiceToast(null)} className="text-white opacity-60 hover:opacity-100 border-none bg-transparent font-black pr-1">✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {searchHistory.length > 0 && (
            <div className="mb-4 bg-slate-50/80 p-3 rounded-2xl border border-slate-100/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Clock size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Recent Searches</span>
                </div>
                <button
                  type="button"
                  onClick={clearAllSearches}
                  className="text-[9px] font-bold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer border-none bg-transparent"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {searchHistory.map((term, idx) => {
                  const isActive = searchTerm.toLowerCase() === term.toLowerCase();
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-black transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60 shadow-2xs'
                      }`}
                      onClick={() => {
                        setSearchTerm(term);
                        saveSearchToHistory(term);
                        haptics.light();
                      }}
                    >
                      <span>{term}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSearchFromHistory(term);
                          haptics.light();
                        }}
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black transition-all border-none ${
                          isActive
                            ? 'bg-white/20 text-white hover:bg-white/30'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                        }`}
                        title="Remove search"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`py-3 px-4 rounded-xl border flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${showFilters ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 shadow-xs text-slate-600'}`}
            >
              <Filter size={12} />
              <span>Filters</span>
              <ChevronRight size={12} className={`transition-transform ${showFilters ? 'rotate-90' : ''}`} />
            </button>
            
            <button 
              onClick={() => { haptics.light(); setFilterToday(!filterToday); }}
              className={`py-3 px-4 rounded-xl border flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${filterToday ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-white border-slate-100 shadow-xs text-slate-600 hover:bg-slate-50'}`}
            >
              <Clock size={12} />
              <span>Today</span>
            </button>

            <button 
              onClick={() => { haptics.light(); setFilterTopRated(!filterTopRated); }}
              className={`py-3 px-4 rounded-xl border flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${filterTopRated ? 'bg-amber-500 border-amber-500 text-white shadow-xs' : 'bg-white border-slate-100 shadow-xs text-slate-600 hover:bg-slate-50'}`}
            >
              <Star size={12} fill={filterTopRated ? "currentColor" : "none"} />
              <span>Top Rated</span>
            </button>

            <button 
              onClick={() => { haptics.light(); setFilterDistance(!filterDistance); }}
              className={`py-3 px-4 rounded-xl border flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${filterDistance ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs' : 'bg-white border-slate-100 shadow-xs text-slate-600 hover:bg-slate-50'}`}
            >
              <Navigation size={12} />
              <span>&lt; 2 miles</span>
            </button>

            <button 
              onClick={() => setSortByDistance(!sortByDistance)}
              className={`py-3 px-4 rounded-xl border flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${sortByDistance ? 'bg-brand border-brand text-white shadow-xs' : 'bg-white border-slate-100 shadow-xs text-slate-600 hover:bg-slate-50'}`}
            >
              <Navigation size={12} />
              <span>Nearest</span>
            </button>

            <button 
              onClick={() => { haptics.light(); setOnlyVerified(!onlyVerified); }}
              className={`py-3 px-4 rounded-xl border flex items-center space-x-1.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${onlyVerified ? 'bg-teal-600 border-teal-600 text-white shadow-xs' : 'bg-white border-slate-100 shadow-xs text-slate-600 hover:bg-slate-50'}`}
            >
              <ShieldCheck size={12} />
              <span>Verified Only</span>
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-8"
              >
                <div className="p-6 bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-200/50">
                  <AccordionSection id="location" title="Location & Seller" icon={MapPin} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                    <div className="grid grid-cols-1 gap-4 p-1">
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          value={locationSearch}
                          onChange={(e) => setLocationSearch(e.target.value)}
                          placeholder="Search City or Area" 
                          className="w-full pl-9 p-3 bg-slate-50 rounded-2xl text-[11px] outline-none font-bold"
                        />
                      </div>
                      <div className="relative">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          value={sellerSearch}
                          onChange={(e) => setSellerSearch(e.target.value)}
                          placeholder="Search Seller @name" 
                          className="w-full pl-9 p-3 bg-slate-50 rounded-2xl text-[11px] outline-none font-bold"
                        />
                      </div>
                    </div>
                  </AccordionSection>

                  <AccordionSection id="price" title="Price Range" icon={DollarSign} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                    <div className="space-y-4 p-1">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">£</span>
                          <input 
                            type="number" 
                            value={minPrice}
                            onChange={(e) => setMinPrice(Number(e.target.value))}
                            placeholder="Min"
                            className="w-full pl-7 p-3 bg-slate-50 rounded-2xl text-[11px] outline-none font-bold"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">£</span>
                          <input 
                            type="number" 
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(Number(e.target.value))}
                            placeholder="Max"
                            className="w-full pl-7 p-3 bg-slate-50 rounded-2xl text-[11px] outline-none font-bold"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                         {[
                           { label: 'Any', min: 0, max: 1000000 },
                           { label: '< £10', min: 0, max: 10 },
                           { label: '£10-£50', min: 10, max: 50 },
                           { label: '£50-£200', min: 50, max: 200 },
                           { label: '£200-£500', min: 200, max: 500 },
                           { label: '£500+', min: 500, max: 1000000 }
                         ].map(range => (
                           <button
                             key={range.label}
                             onClick={() => { setMinPrice(range.min); setMaxPrice(range.max); }}
                             className={`px-3 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                               minPrice === range.min && maxPrice === range.max ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'
                             }`}
                           >
                             {range.label}
                           </button>
                         ))}
                      </div>
                    </div>
                  </AccordionSection>

                  <AccordionSection id="condition" title="Condition" icon={ShieldCheck} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                    <div className="flex flex-wrap gap-2 p-1">
                      {conditions.map(c => (
                        <button
                          key={c.val}
                          onClick={() => setSelectedCondition(c.val)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            selectedCondition === c.val ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </AccordionSection>

                  <AccordionSection id="category" title="Category" icon={Tag} openAccordion={openAccordion} setOpenAccordion={setOpenAccordion}>
                    <div className="flex flex-wrap gap-2 p-1">
                      {filters.map((f) => (
                        <button
                          key={f}
                          onClick={() => setActiveFilter(f)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            activeFilter === f ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </AccordionSection>

                  <div className="mt-6 pt-6 border-t border-slate-50 flex space-x-3">
                    <button 
                      onClick={() => {
                        setSearchTerm('');
                        setLocationSearch('');
                        setSellerSearch('');
                        setMinPrice(0);
                        setMaxPrice(1000000);
                        setSelectedCondition('all');
                        setActiveFilter('all');
                      }}
                      className="flex-1 py-4 px-6 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
                    >
                      Reset All
                    </button>
                    <button 
                      onClick={() => setShowFilters(false)}
                      className="flex-1 py-4 px-6 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand/20 active:scale-95 transition-all"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {tab === 'cart' && (
        <div className="mb-8">
           <button onClick={() => setTab('browse')} className="flex items-center space-x-2 text-slate-400 mb-6 group">
             <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
             <span className="text-[10px] font-black uppercase tracking-widest">Back to Items</span>
           </button>
           <h2 className="text-xl font-black mb-6">Your Shopping Bag ({cart.length})</h2>
           {cart.length === 0 && (
             <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100">
                <ShoppingBag size={48} className="mx-auto mb-4 text-slate-200" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Bag is empty</p>
             </div>
           )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="bg-white border border-slate-150/50 rounded-[32px] overflow-hidden p-3.5 space-y-4 animate-pulse">
              {/* Shimmering Image aspect-square */}
              <div className="aspect-square w-full bg-slate-100 dark:bg-slate-800 rounded-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
              </div>
              {/* Skeleton detail lines */}
              <div className="space-y-2 px-1.5 pb-1">
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-5/6" />
                <div className="h-2.5 bg-slate-50 dark:bg-slate-850 rounded-full w-3/5" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-1/3" />
                  <div className="h-6 bg-slate-50 dark:bg-slate-850 rounded-full w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {tab === 'my-listings' && items.length > 0 && (
            <div className="p-6 bg-indigo-50/50 border border-indigo-100/40 rounded-[35px] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Package size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-indigo-950 uppercase tracking-widest">Bulk Actions Panel</h4>
                  <p className="text-[10px] text-indigo-500/80 font-bold tracking-tight">
                    {selectedItemIds.length} of {items.length} listings selected
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedItemIds.length === items.length) {
                      setSelectedItemIds([]);
                    } else {
                      setSelectedItemIds(items.map(i => i.id));
                    }
                  }}
                  className="px-3.5 py-2.5 bg-white border border-slate-250/70 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-50 active:scale-95 transition-all"
                >
                  {selectedItemIds.length === items.length ? 'Deselect All' : 'Select All'}
                </button>
                
                <button
                  disabled={selectedItemIds.length === 0}
                  onClick={() => handleBulkUpdateStatus('sold')}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-40"
                >
                  Mark Sold
                </button>

                <button
                  disabled={selectedItemIds.length === 0}
                  onClick={() => handleBulkUpdateStatus('available')}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-40"
                >
                  Mark Live
                </button>

                <button
                  disabled={selectedItemIds.length === 0}
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-40 flex items-center space-x-1"
                >
                  <Trash size={11} className="mr-0.5" />
                  <span>Delete Selected</span>
                </button>
              </div>
            </div>
          )}

          {tab === 'cart' ? (
            cart.length === 0 ? (
              <div className="col-span-2 text-center py-20 px-6 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                   <ShoppingBag size={32} className="text-slate-200" />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center px-4 leading-relaxed">
                   Your shopping bag is empty.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                {/* Left Column: Cart Items List */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Items in Bag</p>
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4.5 bg-white border border-slate-100 rounded-[28px] shadow-xs relative">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 relative overflow-hidden shrink-0">
                        <LazyImage 
                          src={item.images?.[0] || 'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&q=80&w=200'} 
                          alt={item.title} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest">{item.category}</span>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-1 line-clamp-1">{item.title}</h4>
                          <p className="text-sm font-black text-slate-900 mt-1">£{item.price}</p>
                        </div>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-[10px] text-slate-400 font-bold flex items-center">
                            <MapPin size={10} className="mr-0.5 text-slate-300" />
                            {item.location?.address || 'London'}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-wider border-none transition-all cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Column: Dynamic Checkout Pane */}
                <div className="space-y-6">
                  {/* Shipping Method Selector */}
                  <div className="p-6 bg-slate-50 rounded-[36px] border border-slate-100 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Choose Shipping Mode</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => { setShippingMethod('individual'); haptics.light(); }}
                        className={`p-4 h-24 rounded-[24px] border text-left transition-all cursor-pointer bg-white ${
                          shippingMethod === 'individual'
                            ? 'ring-2 ring-slate-900 border-slate-900'
                            : 'border-slate-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <p className="font-extrabold text-xs text-slate-900">Standard Solo</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">Home Delivery</p>
                        <p className="text-sm font-black text-slate-950 mt-1 font-mono">£4.99</p>
                      </button>

                      <button
                        onClick={() => { setShippingMethod('group'); haptics.light(); }}
                        className={`p-4 h-24 rounded-[24px] border text-left transition-all cursor-pointer bg-white relative overflow-hidden ${
                          shippingMethod === 'group'
                            ? 'ring-2 ring-brand border-brand'
                            : 'border-slate-200 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-emerald-500 text-white rounded text-[8px] font-black uppercase tracking-widest animate-bounce">
                          Eco Save
                        </span>
                        <p className="font-extrabold text-xs text-emerald-600">Green Group</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">Shared Shipping</p>
                        <p className="text-sm font-black text-slate-950 mt-1 font-mono">£1.50 or FREE</p>
                      </button>
                    </div>

                    {shippingMethod === 'group' && (
                      <div className="bg-white border border-slate-200/60 p-5 rounded-[28px] space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Neighborhood Consolidation Hub</p>
                        
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">Active Hubs nearby:</label>
                          <select
                            value={selectedHub}
                            onChange={(e) => { setSelectedHub(e.target.value); haptics.light(); }}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none"
                          >
                            <option value="hoxton">🏫 Hoxton square Hub (Host: Marcus K. - 4 Neighbors joined)</option>
                            <option value="spitalfields">🌳 Spitalfields Central (Host: Sarah M. - 2 Neighbors joined)</option>
                            <option value="boundary">🚪 Boundary Street Hub (Host: Clara S. - 1 Neighbor joined)</option>
                            <option value="new">➕ Assemble New Neighborhood Group Order</option>
                          </select>
                        </div>

                        {selectedHub === 'new' && (
                          <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-dashed border-slate-300">
                            <input
                              type="text"
                              placeholder="e.g. Shoreditch Park Group"
                              required
                              value={newHubName}
                              onChange={(e) => setNewHubName(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                            />
                            <input
                              type="text"
                              placeholder="Invite Code (e.g. N1-SHORE)"
                              required
                              value={newHubCode}
                              onChange={(e) => setNewHubCode(e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase"
                            />
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <span>Joined Neighbors Simulation:</span>
                            <span className="text-brand font-black">{addedNeighborsCount} neighbors</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="4"
                            value={addedNeighborsCount}
                            onChange={(e) => { setAddedNeighborsCount(Number(e.target.value)); haptics.light(); }}
                            className="w-full accent-brand cursor-pointer h-2 bg-slate-100 rounded-lg outline-none"
                          />
                          
                          <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-2xl flex items-start gap-2 border border-emerald-100">
                            <div className="text-sm">🌿</div>
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-wide">
                                {addedNeighborsCount >= 3 ? 'FREE Group Shipping Unlocked!' : `${3 - addedNeighborsCount} more neighbors for FREE delivery!`}
                              </p>
                              <p className="text-[9.5px] font-bold text-emerald-600/90 leading-tight">
                                Consolidated shipping prevents extra carbon footprint by packing neighbor packages in 1 delivery run!
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Breakdown Card */}
                  <div className="p-6 bg-slate-900 text-white rounded-[36px] space-y-4 shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Order Total & Savings</p>
                    
                    <div className="space-y-2.5 text-xs font-bold font-mono">
                      <div className="flex justify-between">
                        <span className="opacity-70 font-sans">Items Subtotal</span>
                        <span>£{cart.reduce((sum, item) => sum + item.price, 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70 font-sans">Standard Delivery Cost</span>
                        <span>£4.99</span>
                      </div>
                      {shippingMethod === 'group' && (
                        <div className="flex justify-between text-emerald-400">
                          <span className="font-sans">Group Shipping Discount</span>
                          <span>-£{(4.99 - (addedNeighborsCount >= 3 ? 0 : addedNeighborsCount === 2 ? 1.50 : addedNeighborsCount === 1 ? 2.50 : 3.50)).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                        <span className="text-sm uppercase tracking-wider opacity-60 font-black font-sans">Grand Total</span>
                        <span className="text-2xl font-black">
                          £{(
                            cart.reduce((sum, item) => sum + item.price, 0) + 
                            (shippingMethod === 'individual' 
                              ? 4.99 
                              : (addedNeighborsCount >= 3 ? 0 : addedNeighborsCount === 2 ? 1.50 : addedNeighborsCount === 1 ? 2.50 : 3.50))
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        haptics.heavy();
                        const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
                        const shippingCostVal = shippingMethod === 'individual' 
                          ? 4.99 
                          : (addedNeighborsCount >= 3 ? 0 : addedNeighborsCount === 2 ? 1.50 : addedNeighborsCount === 1 ? 2.50 : 3.50);
                        setLastOrderDetails({
                          itemsCount: cart.length,
                          total: subtotal + shippingCostVal,
                          method: shippingMethod,
                          savedCo2: shippingMethod === 'group' ? 2.8 : 0,
                          earnedPoints: shippingMethod === 'group' ? 35 : 10
                        });
                        setCheckoutSuccess(true);
                        setCart([]); // Clear cart
                      }}
                      className="w-full py-5 bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-[24px] shadow-lg shadow-brand/20 active:scale-95 transition-all border-none cursor-pointer"
                    >
                      Place {shippingMethod === 'group' ? 'Combined Group Order' : 'Standard Solo Order'}
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredItems.length === 0 ? (
                <div className="col-span-2 text-center py-20 px-6 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                     {tab === 'saved' ? <Heart size={32} className="text-rose-200" /> : <ShoppingBag size={32} className="text-slate-200" />}
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center px-4 leading-relaxed">
                    {tab === 'saved' 
                      ? "Your wishlist is empty. Tap the heart to keep tabs on items you love!" 
                      : "No matches found. Try adjusting your filters or search terms."
                    }
                  </p>
                  {tab === 'browse' && (searchTerm || showFilters) && (
                    <button 
                      onClick={() => { setSearchTerm(''); setLocationSearch(''); setSellerSearch(''); setActiveFilter('all'); setShowFilters(false); }}
                      className="mt-6 text-[10px] font-black text-brand uppercase tracking-widest border-b border-brand"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                filteredItems.map((item, i) => (
                  <MarketplaceItemCard 
                    key={item.id}
                    item={item}
                    index={i}
                    tab={tab as any}
                    isSaved={profile?.savedItems?.includes(item.id)}
                    onSave={() => toggleSave(item.id)}
                    onAddToCart={() => addToCart(item)}
                    onMakeOffer={() => setOfferModalItem(item)}
                    onUpdateStatus={(st: any) => updateStatus(item.id, st)}
                    onAddPhoto={() => handleUpdateImages(item.id)}
                    onOpenAiStudio={() => setInspectingItemForAi(item)}
                    onShare={() => handleShare(item)}
                    isUploading={uploadingItem === item.id}
                    renderRating={renderRating}
                    distance={distanceMap[item.id]}
                    isSelected={selectedItemIds.includes(item.id)}
                    onToggleSelect={toggleSelectItem}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      <MakeOfferModal 
        item={offerModalItem}
        price={offerPrice}
        setPrice={setOfferPrice}
        onClose={() => setOfferModalItem(null)}
        onSubmit={handleMakeOffer}
      />

      <CreateListingModal 
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={newTitle}
        setTitle={setNewTitle}
        desc={newDesc}
        setDesc={setNewDesc}
        price={newPrice}
        setPrice={setNewPrice}
        category={newCategory}
        setCategory={setNewCategory}
        condition={newCondition}
        setCondition={setNewCondition}
        images={newImages}
        setImages={setNewImages}
        onGenerateImage={generateAIImage}
        isGenerating={isGeneratingImage}
        selectedAiStyle={selectedAiStyle}
        setSelectedAiStyle={setSelectedAiStyle}
        onSearchGoogleSpecs={searchGoogleProductSpecs}
        isSearchingSpecs={isSearchingSpecs}
        searchedProductSpecs={searchedProductSpecs}
        onAutoFillSpecs={autoFillFromGoogleSpecs}
        onSubmit={handleCreateListing}
        isSubmitting={isSubmitting}
        isPostSuccess={isPostSuccess}
        tags={newTags}
        setTags={setNewTags}
        summary={newSummary}
        setSummary={setNewSummary}
        onGenerateTagsSummary={generateTagsAndSummary}
        isGeneratingTagsSummary={isGeneratingTagsSummary}
      />

      {/* AI PRODUCT SPECS & REGENERATE PHOTO MODAL FOR ANY ITEM */}
      <AnimatePresence>
        {inspectingItemForAi && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md pointer-events-auto"
              onClick={() => setInspectingItemForAi(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              className="relative bg-white dark:bg-slate-900 rounded-[36px] w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl z-10 border border-slate-150 text-left"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                    Google Product Specs & AI Studio
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {inspectingItemForAi.title}
                  </h3>
                </div>
                <button 
                  onClick={() => setInspectingItemForAi(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {/* Item Photo & Regenerate AI Image Controls */}
              <div className="space-y-4">
                <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden relative border border-slate-200/60">
                  <img 
                    src={inspectingItemForAi.images?.[0] || 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&q=80'} 
                    className="w-full h-full object-cover" 
                    alt={inspectingItemForAi.title}
                  />
                  {isUpdatingItemImage && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="text-xs font-black uppercase tracking-wider">Generating New AI Image...</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-indigo-50/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">
                      🔄 Change / Regenerate AI Image Style
                    </span>
                    <span className="text-[9px] text-indigo-600 font-bold">Try again as many times as you like</span>
                  </div>

                  {/* AI Style Pill Bar */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'studio', label: '✨ Studio' },
                      { id: 'lifestyle', label: '🏠 Lifestyle' },
                      { id: '3d', label: '🎨 3D Render' },
                      { id: 'cyberpunk', label: '🌆 Cyber' },
                      { id: 'minimalist', label: '📐 Minimal' },
                      { id: 'vintage', label: '📻 Vintage' }
                    ].map(st => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedAiStyle(st.id)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          selectedAiStyle === st.id
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isUpdatingItemImage}
                    onClick={() => handleRegenerateItemImage(inspectingItemForAi, selectedAiStyle)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-indigo-300/40 cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Sparkles size={14} />
                    <span>Regenerate AI Image Now (Style: {selectedAiStyle})</span>
                  </button>
                </div>

                {/* Google Search Product Properties Section */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                      🔍 Google Search Product Properties
                    </span>
                    <button
                      type="button"
                      disabled={isSearchingSpecs}
                      onClick={() => searchGoogleProductSpecs(inspectingItemForAi.title)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-black transition-all cursor-pointer"
                    >
                      {isSearchingSpecs ? 'Searching Google...' : 'Fetch Specs'}
                    </button>
                  </div>

                  {searchedProductSpecs ? (
                    <div className="space-y-2 pt-2 border-t border-slate-200/80 text-xs">
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                        <div className="p-2 bg-white rounded-xl border">
                          <span className="text-slate-400 block text-[9px]">Brand:</span>
                          <span className="text-slate-900">{searchedProductSpecs.brand || 'Verified'}</span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border">
                          <span className="text-slate-400 block text-[9px]">Est. Value:</span>
                          <span className="text-emerald-600">{searchedProductSpecs.estimatedPrice || 'Market Value'}</span>
                        </div>
                      </div>

                      {searchedProductSpecs.properties && (
                        <div className="p-3 bg-white rounded-xl border space-y-1 text-[10.5px]">
                          <span className="text-[9px] font-black uppercase text-slate-400 block">Product Properties:</span>
                          {Object.entries(searchedProductSpecs.properties).map(([k, v]: any) => (
                            <div key={k} className="flex justify-between py-0.5 border-b border-slate-100 last:border-0">
                              <span className="text-slate-500 font-semibold">{k}:</span>
                              <span className="font-bold text-slate-800 text-right pl-2">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10.5px] text-slate-400 font-medium italic">
                      Click "Fetch Specs" to search Google for verified brand, model, dimensions, and technical properties for this product.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RATINGS & REVIEWS DIALOG */}
      <AnimatePresence>
        {reviewingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md pointer-events-auto"
              onClick={() => setReviewingItem(null)}
            />
            
            <motion.div 
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="bg-white dark:bg-slate-900 rounded-[36px] w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl relative text-left z-10 border border-slate-150/65 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-2">
                 <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#4f46e5] bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">Product Feedback Platform</span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white mt-2 tracking-tight">{reviewingItem.title}</h3>
                 </div>
                 <button 
                   onClick={() => setReviewingItem(null)}
                   className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:white rounded-full cursor-pointer border-none bg-transparent"
                 >
                   ✕
                 </button>
              </div>

              <Testimonials 
                 productId={reviewingItem.id} 
                 productName={reviewingItem.title}
                 providerId={reviewingItem.sellerId}
                 providerName={`Seller UID: ${reviewingItem.sellerId.substring(0, 6)}`}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBulkDeleteConfirm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto"
            />
            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl pointer-events-auto border border-slate-100 overflow-hidden"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-rose-550/10 text-rose-600 rounded-2xl flex items-center justify-center">
                  <Trash size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Confirm Bulk Deletion</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Accidental Data Loss Guard</p>
                </div>
              </div>

              <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[160px] overflow-y-auto no-scrollbar">
                <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                  Are you sure you want to delete the following <span className="font-extrabold text-rose-600">{selectedItemIds.length}</span> item(s)? This action cannot be undone.
                </p>
                <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                  {items.filter(item => selectedItemIds.includes(item.id)).map(item => (
                    <div key={item.id} className="flex items-center space-x-2 text-[10px] text-slate-700 font-bold">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full flex-shrink-0" />
                      <span className="truncate">{item.title}</span>
                      <span className="text-slate-400 flex-shrink-0">({item.price === 0 ? 'Free' : `£${item.price}`})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 border-none outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-lg shadow-rose-200/50 border-none outline-none"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mt-12 p-8 bg-brand/5 rounded-[50px] border border-brand/10 flex items-center space-x-6 relative overflow-hidden group">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-brand/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
        <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center flex-shrink-0 text-brand shadow-inner">
          <Tag size={28} />
        </div>
        <div>
          <h4 className="font-black text-slate-900 text-lg tracking-tight">Refer & Earn</h4>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed opacity-80">
            Current Points: <span className="font-black text-brand">{profile?.rewardsPoints || 0}</span>
          </p>
          <button className="mt-3 px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all active:scale-95">
             Share Refer Code
          </button>
        </div>
      </div>

      {/* Checkout Success Modal overlay */}
      <AnimatePresence>
        {checkoutSuccess && lastOrderDetails && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setCheckoutSuccess(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white max-w-sm w-full rounded-[40px] p-8 text-center space-y-6 shadow-2xl overflow-hidden"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto text-3xl">
                🌟
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-slate-900">Order Confirmed!</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Successfully Assembled</p>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl text-left text-xs font-bold space-y-2">
                <div className="flex justify-between flex-row">
                  <span className="opacity-60">Order Type:</span>
                  <span className="capitalize">{lastOrderDetails.method === 'group' ? '💚 Shared Group Order' : 'Individual Solo'}</span>
                </div>
                <div className="flex justify-between flex-row">
                  <span className="opacity-60">Total Bill Paid:</span>
                  <span>£{lastOrderDetails.total.toFixed(2)}</span>
                </div>
                {lastOrderDetails.method === 'group' && (
                  <div className="flex justify-between flex-row text-emerald-600">
                    <span className="opacity-60">CO2 Emissions Offset:</span>
                    <span>≈ {lastOrderDetails.savedCo2} kg Saved!</span>
                  </div>
                )}
                <div className="flex justify-between flex-row text-indigo-600 pt-2 border-t border-slate-200">
                  <span>Community Points Added:</span>
                  <span>+{lastOrderDetails.earnedPoints} pts</span>
                </div>
              </div>

              <p className="text-[10.5px] text-slate-400 leading-relaxed font-bold">
                {lastOrderDetails.method === 'group' 
                  ? "Your neighborhood hub neighbors have been updated, and combined shipping has been coordinated. Save the local planet together!" 
                  : "Your solo package has been queued for immediate standard shipping."
                }
              </p>

              <button
                onClick={() => { setCheckoutSuccess(false); setTab('browse'); }}
                className="w-full py-4.5 bg-slate-900 hover:bg-black text-white text-[10.5px] font-black uppercase tracking-widest rounded-3xl"
              >
                Back to Browse Items
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FeatureSpotlight
        featureKey="marketplace_view"
        title="Marketplace Spotlight"
        steps={[
          {
            title: "Circular Swaps",
            description: "Promote sustainability by swapping tradecrafts or donating items for free with neighbors living in Shoreditch."
          },
          {
            title: "AI Tags Summary",
            description: "Get smart summaries of item conditions, dimensions, and materials instantly generated using Gemini AI."
          },
          {
            title: "Physical QR Scanner",
            description: "Scan product tags with your device camera to instantly lookup seller records, pricing, and sustainability origins."
          }
        ]}
      />
    </motion.div>
  );
}

function CreateListingModal({ 
  show, onClose, title, setTitle, desc, setDesc, price, setPrice, 
  category, setCategory, condition, setCondition, images, onGenerateImage, isGenerating, onSubmit, isSubmitting, isPostSuccess = false, setImages,
  tags, setTags, summary, setSummary, onGenerateTagsSummary, isGeneratingTagsSummary,
  selectedAiStyle = 'studio', setSelectedAiStyle, onSearchGoogleSpecs, isSearchingSpecs, searchedProductSpecs, onAutoFillSpecs
}: any) {
  // Keyboard shortcut listener: allows pressing Enter to quickly post product
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const isTextArea = target?.tagName === 'TEXTAREA';
        // Allow multi-line typing in description textarea unless Ctrl/Cmd is pressed
        if (isTextArea && !e.ctrlKey && !e.metaKey) {
          return;
        }
        if (isSubmitting || isPostSuccess) {
          e.preventDefault();
          return;
        }
        if (!title?.trim()) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show, isSubmitting, isPostSuccess, title, onSubmit]);

  if (!show) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round(height * (maxDim / width));
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round(width * (maxDim / height));
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setImages((prev: string[]) => [...prev, compressedDataUrl]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const aiStyles = [
    { id: 'studio', label: '✨ Studio' },
    { id: 'lifestyle', label: '🏠 Lifestyle' },
    { id: '3d', label: '🎨 3D Render' },
    { id: 'cyberpunk', label: '🌆 Cyber' },
    { id: 'minimalist', label: '📐 Minimal' },
    { id: 'vintage', label: '📻 Vintage' }
  ];

  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center pointer-events-none">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md pointer-events-auto" onClick={onClose} />
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative bg-white w-full max-w-md rounded-t-[50px] p-8 pb-12 shadow-2xl pointer-events-auto h-[90vh] overflow-y-auto no-scrollbar"
      >
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
        <div className="flex justify-between items-center mb-8">
           <div>
             <h3 className="text-2xl font-black text-slate-900">Post New Item</h3>
             <p className="text-[10px] font-bold text-slate-400">Search Google specs & generate AI photos</p>
           </div>
           <button onClick={onClose} className="p-3 bg-slate-50 rounded-2xl text-slate-500 hover:bg-slate-100">
             <X size={20} />
           </button>
        </div>

        <div className="space-y-6">
           {/* Item Title Input */}
           <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">What are you selling?</label>
                <button
                  type="button"
                  disabled={!title || isSearchingSpecs}
                  onClick={() => onSearchGoogleSpecs?.(title)}
                  className="px-3 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 disabled:opacity-40 transition-all border border-sky-200/60"
                >
                  <Search size={11} strokeWidth={2.5} />
                  <span>{isSearchingSpecs ? 'Searching Google...' : 'Google Search Specs'}</span>
                </button>
              </div>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isSubmitting && !isPostSuccess && title?.trim()) {
                      onSubmit();
                    }
                  }
                }}
                placeholder="e.g. Sony WH-1000XM5 or Vintage Road Bike"
                className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-2 focus:ring-brand font-bold"
              />
           </div>

           {/* GOOGLE SEARCH PRODUCT PROPERTIES CARD */}
           {searchedProductSpecs && (
             <div className="p-4 bg-gradient-to-br from-sky-50/80 to-blue-50/80 border border-sky-200/80 rounded-[28px] space-y-3 shadow-sm text-left">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-sky-950 flex items-center space-x-1">
                     <Search size={12} className="text-sky-600 mr-1" strokeWidth={2.5} />
                     <span>Google Found Product Properties</span>
                  </span>
                  <button
                    type="button"
                    onClick={onAutoFillSpecs}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    ✨ Auto-Fill All Specs & Price
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                   <div className="p-2.5 bg-white/90 rounded-2xl border border-sky-100">
                      <span className="text-[9px] text-slate-400 uppercase font-black block">Brand / Model</span>
                      <span className="text-slate-800">{searchedProductSpecs.brand || 'Verified'} - {searchedProductSpecs.model || ''}</span>
                   </div>
                   <div className="p-2.5 bg-white/90 rounded-2xl border border-sky-100">
                      <span className="text-[9px] text-slate-400 uppercase font-black block">Google Price Estimate</span>
                      <span className="text-emerald-600">{searchedProductSpecs.estimatedPrice || 'Market Value'}</span>
                   </div>
                </div>

                {searchedProductSpecs.properties && (
                   <div className="p-3 bg-white/90 rounded-2xl border border-sky-100 space-y-1 text-[11px]">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Specifications:</span>
                      {Object.entries(searchedProductSpecs.properties).map(([k, v]: any) => (
                         <div key={k} className="flex justify-between py-0.5 border-b border-slate-100 last:border-0">
                            <span className="text-slate-500 font-semibold">{k}:</span>
                            <span className="font-bold text-slate-800 pl-2 text-right">{v}</span>
                         </div>
                      ))}
                   </div>
                )}
             </div>
           )}

           {/* AI IMAGE GENERATION & VARIATION / REGENERATE SECTION */}
           <div className="p-4 bg-slate-50/90 border border-slate-200/80 rounded-[28px] space-y-3">
              <div className="flex justify-between items-center">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center space-x-1">
                   <ImageIcon size={14} className="text-brand mr-1" strokeWidth={2.5} />
                   <span>AI Image Generator & Styles</span>
                 </label>
                 <span className="text-[9px] font-bold text-slate-400">Regenerate again & again</span>
              </div>

              {/* AI Style selector */}
              <div className="flex flex-wrap gap-1.5">
                 {aiStyles.map(st => (
                   <button
                     key={st.id}
                     type="button"
                     onClick={() => setSelectedAiStyle?.(st.id)}
                     className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                       selectedAiStyle === st.id 
                         ? 'bg-slate-900 text-white shadow-sm' 
                         : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                     }`}
                   >
                     {st.label}
                   </button>
                 ))}
              </div>

              <div className="flex gap-2">
                 <button 
                    type="button"
                    onClick={() => onGenerateImage?.(selectedAiStyle)}
                    disabled={!title || isGenerating}
                    className="w-full py-3 bg-brand/10 hover:bg-brand/20 text-brand rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-2 disabled:opacity-30 border border-brand/20 active:scale-95 transition-all cursor-pointer"
                  >
                    {isGenerating ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 border-2 border-brand/30 border-t-brand rounded-full animate-spin"></div>
                        <span>Generating AI Image...</span>
                      </div>
                    ) : (
                      <>
                        <Sparkles size={14} strokeWidth={2.5} />
                        <span>{images.length > 0 ? '🔄 Change / Regenerate AI Image Again' : '✨ Generate AI Image'}</span>
                      </>
                    )}
                  </button>
              </div>
           </div>
           
           {/* Image Gallery */}
           <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Uploaded / Generated Photos ({images.length})</span>
              <div className="grid grid-cols-3 gap-3">
                 {images.map((img: string, i: number) => (
                   <div key={i} className="aspect-square bg-slate-100 rounded-3xl overflow-hidden relative group border border-slate-100 shadow-sm">
                      <img src={img} className="w-full h-full object-cover" alt={`Product ${i}`} />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-1.5 p-2">
                         <button 
                           type="button"
                           onClick={() => onGenerateImage?.(selectedAiStyle, i)}
                           disabled={isGenerating}
                           className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-indigo-700 w-full"
                         >
                           🔄 Replace AI
                         </button>
                         <button 
                           type="button"
                           onClick={() => setImages(images.filter((_: any, idx: number) => idx !== i))}
                           className="px-2 py-1 bg-red-500 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-red-600 w-full"
                         >
                           ✕ Remove
                         </button>
                      </div>
                   </div>
                 ))}
                 <label className="aspect-square border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center text-slate-300 cursor-pointer hover:bg-slate-50 transition-all hover:border-brand/40 group">
                    <Plus size={32} className="group-hover:scale-110 transition-transform" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                 </label>
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tell us more</label>
              <textarea 
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Condition, specs, history, why you're selling..."
                className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-2 focus:ring-brand font-bold min-h-[120px]"
              />
           </div>

           {/* GEMINI AUTOMATED ASSETS INSIGHTS */}
           <div className="p-5 bg-gradient-to-br from-indigo-50/60 to-purple-50/60 border border-indigo-100/50 rounded-[30px] space-y-4 shadow-sm text-left">
              <div className="flex justify-between items-center">
                 <label className="text-[10px] font-black uppercase tracking-widest text-indigo-950 flex items-center space-x-1">
                    <Sparkles size={13} className="text-indigo-600 animate-pulse mr-1" strokeWidth={2.5} />
                    <span>Gemini AI Insights</span>
                 </label>
                 <button
                    type="button"
                    disabled={!title || !desc || isGeneratingTagsSummary}
                    onClick={onGenerateTagsSummary}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-wider rounded-xl disabled:opacity-35 active:scale-95 transition-all flex items-center space-x-1 border-none shadow-md shadow-indigo-200 cursor-pointer"
                 >
                    {isGeneratingTagsSummary ? (
                       <div className="w-2.5 h-2.5 border-2 border-indigo-300 border-t-white rounded-full animate-spin"></div>
                    ) : (
                       <span>AI Generate Summary</span>
                    )}
                 </button>
              </div>

              {summary && (
                 <div className="space-y-1 bg-white p-3.5 rounded-2xl border border-indigo-100/40">
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">AI Product Highlights</span>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed italic">"{summary}"</p>
                 </div>
              )}

              {tags && tags.length > 0 && (
                 <div className="space-y-1.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">Descriptive search tags:</span>
                    <div className="flex flex-wrap gap-1.5">
                       {tags.map((tg: string) => (
                          <span key={tg} className="px-2.5 py-1 bg-indigo-100/60 border border-indigo-150 text-indigo-700 font-extrabold text-[9px] uppercase rounded-lg tracking-wider">
                             #{tg}
                          </span>
                       ))}
                    </div>
                 </div>
              )}
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Price (£)</label>
                <input 
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!isSubmitting && !isPostSuccess && title?.trim()) {
                        onSubmit();
                      }
                    }
                  }}
                  placeholder="25.00"
                  className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-2 focus:ring-brand font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-2 focus:ring-brand font-bold appearance-none capitalize"
                >
                  <option value="food">Food</option>
                  <option value="clothing">Clothing</option>
                  <option value="electronics">Electronics</option>
                  <option value="furniture">Furniture</option>
                  <option value="other">Other</option>
                </select>
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Condition</label>
              <select 
                value={condition}
                onChange={(e) => setCondition(e.target.value as any)}
                className="w-full p-5 bg-slate-50 rounded-3xl outline-none focus:ring-2 focus:ring-brand font-bold appearance-none capitalize"
              >
                <option value="new">New</option>
                <option value="used_good">Used - Good</option>
                <option value="used_fair">Used - Fair</option>
                <option value="parts">For Parts</option>
              </select>
           </div>

           {!title?.trim() && (
             <p className="text-[11px] font-bold text-amber-600 bg-amber-50 px-4 py-2.5 rounded-2xl border border-amber-200/60 text-center">
               ℹ️ Please enter a title for your item to list it live
             </p>
           )}

           <button 
            type="button"
            disabled={isSubmitting || isPostSuccess || !title?.trim()}
            onClick={onSubmit}
            title={!title?.trim() ? "Enter a product title first" : "Post Product (or press Enter)"}
            aria-label={isPostSuccess ? "Product Posted Successfully" : isSubmitting ? "Posting Product..." : "Post Product"}
            aria-keyshortcuts="Enter"
            className={`w-full py-5 rounded-[32px] font-black uppercase tracking-widest active:scale-95 mt-4 h-16 shadow-xl cursor-pointer transition-all flex items-center justify-center space-x-2 relative overflow-hidden ${
              isPostSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-500/30 border border-emerald-500'
                : isSubmitting
                  ? 'bg-slate-800 text-white cursor-not-allowed opacity-90'
                  : !title?.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-slate-900 hover:bg-black text-white shadow-slate-200'
            }`}
           >
             {isPostSuccess ? (
               <motion.div 
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="flex items-center space-x-2"
               >
                 <motion.div
                   initial={{ scale: 0, rotate: -45 }}
                   animate={{ scale: 1, rotate: 0 }}
                   transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                   className="w-6 h-6 rounded-full bg-white text-emerald-600 flex items-center justify-center font-black shadow-sm"
                 >
                   <Check size={16} strokeWidth={3.5} className="text-emerald-600" />
                 </motion.div>
                 <motion.span 
                   initial={{ opacity: 0, x: 4 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="text-white font-black text-sm tracking-widest uppercase"
                 >
                   Product Posted!
                 </motion.span>
               </motion.div>
             ) : isSubmitting ? (
               <div className="flex items-center space-x-2.5">
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 <span className="text-sm font-black tracking-widest uppercase">Posting...</span>
               </div>
             ) : (
               <div className="flex items-center justify-between w-full px-3">
                 <div className="flex items-center space-x-2">
                   <Package size={18} strokeWidth={2.5} />
                   <span>Post Product</span>
                 </div>
                 <div className="flex items-center space-x-1.5 opacity-80">
                   <kbd className="px-2.5 py-1 text-[10px] font-black bg-white/20 text-white rounded-lg border border-white/25 shadow-sm">
                     ↵ Enter
                   </kbd>
                 </div>
               </div>
             )}
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function MakeOfferModal({ item, price, setPrice, onClose, onSubmit }: any) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[300] pointer-events-none">
       <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
       <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[50px] shadow-2xl p-8 pb-12 pointer-events-auto"
      >
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
        
        <div className="flex justify-between items-start mb-8">
           <div className="flex-1">
             <div className="flex items-center space-x-2 mb-1">
                <Tag size={16} className="text-brand" />
                <h3 className="text-2xl font-black text-slate-900">Make an Offer</h3>
             </div>
             <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest line-clamp-1">{item.title}</p>
           </div>
           <button onClick={onClose} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="space-y-8">
           <div className="p-8 bg-slate-900 rounded-[40px] text-white overflow-hidden relative shadow-2xl shadow-slate-400">
              <DollarSign className="absolute -right-4 -bottom-4 text-white/5 w-40 h-40" />
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Original Asking Price</p>
                <p className="text-4xl font-black">£{item.price}</p>
              </div>
           </div>

           <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Suggestion</label>
                {price && Number(price) > 0 && (
                  <span className={`text-[10px] font-black uppercase tracking-widest ${Number(price) < item.price ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {Math.round(((Number(price) - item.price) / item.price) * 100)}% {Number(price) < item.price ? 'Below' : 'Above'}
                  </span>
                )}
              </div>
              <div className="relative">
                 <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={28} />
                 <input 
                  type="number"
                  autoFocus
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Enter custom amount"
                  className="w-full pl-16 pr-8 py-6 bg-slate-50 rounded-[32px] outline-none focus:ring-4 focus:ring-brand/10 font-black text-3xl transition-all text-slate-900 placeholder:text-slate-200"
                 />
              </div>
           </div>

           <button 
            onClick={onSubmit}
            disabled={!price || Number(price) <= 0}
            className="w-full py-6 bg-brand text-white rounded-[32px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand/20 active:scale-95 transition-all disabled:opacity-50 text-[12px] flex items-center justify-center space-x-3"
           >
             <Navigation size={18} className="rotate-90" />
             <span>Submit Offer to Seller</span>
           </button>
           
           <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest italic opacity-60">
             Offers are not binding but start a conversation
           </p>
        </div>
      </motion.div>
    </div>
  );
}
