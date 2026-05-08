import { useState, useEffect } from 'react';
import { ShoppingBag, Search, Filter, Plus, Tag, MapPin, Star, Clock, ChevronRight, X, DollarSign, Package, Image as ImageIcon, Navigation, User, Heart, ChevronLeft, ShoppingCart, ShieldCheck, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MarketplaceItem, ItemStatus, UserProfile, ItemCondition } from '../types';

export function MarketplaceView() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [selectedCondition, setSelectedCondition] = useState<ItemCondition | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [tab, setTab] = useState<'browse' | 'my-listings' | 'saved' | 'cart'>('browse');
  const [loading, setLoading] = useState(true);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, UserProfile>>({});
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  
  // Shopping Cart
  const [cart, setCart] = useState<MarketplaceItem[]>([]);
  
  // Make Offer State
  const [offerModalItem, setOfferModalItem] = useState<MarketplaceItem | null>(null);
  const [offerPrice, setOfferPrice] = useState<string>('');
  
  // Image Upload State
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

  const filters = ['all', 'food', 'clothing', 'electronics', 'furniture'];
  const conditions: {val: ItemCondition | 'all', label: string}[] = [
    { val: 'all', label: 'All Conditions' },
    { val: 'new', label: 'New' },
    { val: 'used_good', label: 'Used - Good' },
    { val: 'used_fair', label: 'Used - Fair' },
    { val: 'parts', label: 'For Parts' }
  ];

  // Helper to initialize the requested demo users
  useEffect(() => {
    const initDemoUsers = async () => {
      const demoUsers = [
        { uid: 'demo_user_1', username: 'plumber_pro', workerType: 'plumber', verificationStatus: 'verified', isWorker: true, rewardsPoints: 450 },
        { uid: 'demo_user_2', username: 'dr_john', workerType: 'doctor', verificationStatus: 'in_progress', isWorker: true, rewardsPoints: 120 },
        { uid: 'demo_user_3', username: 'london_cabs', workerType: 'cab_owner', verificationStatus: 'verified', isWorker: true, rewardsPoints: 890 }
      ];

      for (const u of demoUsers) {
        const uRef = doc(db, 'users', u.uid);
        try {
          const uSnap = await getDoc(uRef);
          if (!uSnap.exists()) {
            await setDoc(uRef, {
              ...u,
              email: `${u.username}@example.com`,
              referralCode: u.uid.toUpperCase(),
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error("Demo user init failed", e);
        }
      }
    };
    initDemoUsers();
  }, []);

  useEffect(() => {
    if (sortByDistance && !userLocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (err) => {
        console.error("Geolocation error", err);
        setSortByDistance(false);
      });
    }
  }, [sortByDistance]);

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
    let q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));

    if (tab === 'browse' || tab === 'cart') {
      q = query(collection(db, 'items'), where('status', '==', 'available'), orderBy('createdAt', 'desc'));
    } else if (tab === 'my-listings' && user) {
      q = query(collection(db, 'items'), where('sellerId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, async (snap) => {
      let fetchedItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceItem));
      
      if (tab === 'saved' && profile?.savedItems) {
        fetchedItems = fetchedItems.filter(item => profile.savedItems?.includes(item.id));
      }

      setItems(fetchedItems);
      setLoading(false);

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
      setSellerProfiles(newProfiles);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'items');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tab, user, profile?.savedItems]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeFilter === 'all' || item.category.toLowerCase() === activeFilter.toLowerCase();
    const matchesLocation = !locationSearch || (item.location?.address.toLowerCase().includes(locationSearch.toLowerCase()));
    const matchesPrice = item.price >= minPrice && item.price <= maxPrice;
    const matchesCondition = selectedCondition === 'all' || item.condition === selectedCondition;
    
    const seller = sellerProfiles[item.sellerId];
    const matchesSeller = !sellerSearch || 
      item.sellerId.toLowerCase().includes(sellerSearch.toLowerCase()) ||
      seller?.username.toLowerCase().includes(sellerSearch.toLowerCase());

    return matchesSearch && matchesCategory && matchesLocation && matchesPrice && matchesCondition && matchesSeller;
  }).sort((a, b) => {
    if (sortByDistance && userLocation && a.location && b.location) {
      const distA = calculateDistance(userLocation.lat, userLocation.lng, a.location.lat, a.location.lng);
      const distB = calculateDistance(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng);
      return distA - distB;
    }
    return 0;
  });

  const handleUpdateImages = async (itemId: string) => {
    setUploadingItem(itemId);
    try {
      const mockImageUrl = `https://picsum.photos/seed/${Math.random()}/600/400`;
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
    try {
      await addDoc(collection(db, 'offers'), {
        itemId: offerModalItem.id,
        sellerId: offerModalItem.sellerId,
        buyerId: user.uid,
        offerPrice: Number(offerPrice),
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
        savedItems: isSaved ? arrayRemove(itemId) : arrayUnion(itemId)
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

  const renderRating = (sellerId: string) => {
    const profile = sellerProfiles[sellerId];
    if (!profile) return null;
    return (
      <div className="flex flex-col space-y-1 mt-1">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-black text-slate-900 uppercase">@{profile.username}</span>
          {profile.verificationStatus === 'verified' && (
             <ShieldCheck size={12} className="text-brand fill-brand/10" />
          )}
          {profile.verificationStatus === 'in_progress' && (
             <Clock size={10} className="text-amber-500" />
          )}
        </div>
        <div className="flex items-center space-x-1">
          <Star size={10} className="text-amber-400 fill-amber-400" />
          <span className="text-[10px] font-bold text-slate-700">{profile.rating?.toFixed(1) || '5.0'}</span>
          <span className="text-[10px] text-slate-400">({profile.reviewCount || 0})</span>
        </div>
      </div>
    );
  };

  const AccordionSection = ({ id, title, icon: Icon, children }: { id: string, title: string, icon: any, children: React.ReactNode }) => (
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

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
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
          <button className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-95 transition-all">
            <Plus size={20} />
          </button>
        </div>
      </header>

      {tab !== 'cart' && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search unique finds..."
              className="w-full pl-11 pr-4 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand font-medium"
            />
          </div>

          <div className="flex space-x-2 mb-6">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 py-3 px-5 rounded-2xl border flex items-center justify-between text-[11px] font-black uppercase tracking-widest transition-all ${showFilters ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 shadow-sm text-slate-600'}`}
            >
              <div className="flex items-center space-x-2">
                <Filter size={16} />
                <span>Filters</span>
              </div>
              <ChevronRight size={16} className={`transition-transform ${showFilters ? 'rotate-90' : ''}`} />
            </button>
            <button 
              onClick={() => setSortByDistance(!sortByDistance)}
              className={`px-5 rounded-2xl border flex items-center space-x-2 text-[11px] font-black uppercase tracking-widest transition-all ${sortByDistance ? 'bg-brand border-brand text-white shadow-xl shadow-brand/20' : 'bg-white border-slate-100 shadow-sm text-slate-600'}`}
            >
              <Navigation size={16} />
              <span>{sortByDistance ? 'Nearest' : 'Distance'}</span>
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
                  <AccordionSection id="location" title="Location & Seller" icon={MapPin}>
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

                  <AccordionSection id="price" title="Price Range" icon={DollarSign}>
                    <div className="grid grid-cols-2 gap-4 p-1">
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
                  </AccordionSection>

                  <AccordionSection id="condition" title="Condition" icon={ShieldCheck}>
                    <div className="flex flex-wrap gap-2 p-1">
                      {conditions.map(c => (
                        <button
                          key={c.val}
                          onClick={() => setSelectedCondition(c.val)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            selectedCondition === c.val ? 'bg-brand border-brand text-white' : 'bg-slate-50 border-transparent text-slate-400'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </AccordionSection>

                  <AccordionSection id="category" title="Category" icon={Tag}>
                    <div className="flex flex-wrap gap-2 p-1">
                      {filters.map((f) => (
                        <button
                          key={f}
                          onClick={() => setActiveFilter(f)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeFilter === f ? 'bg-brand text-white' : 'bg-slate-50 text-slate-400'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </AccordionSection>
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
        <div className="flex justify-center p-12">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-brand rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {(tab === 'cart' ? cart : filteredItems).length === 0 ? (
            tab !== 'cart' && (
              <div className="col-span-2 text-center p-16 bg-slate-50 rounded-[60px] border-2 border-dashed border-slate-100">
                <ShoppingBag size={64} className="mx-auto mb-6 text-slate-100" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No listings found</p>
              </div>
            )
          ) : (
            (tab === 'cart' ? cart : filteredItems).map((item, i) => (
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
                isUploading={uploadingItem === item.id}
                renderRating={renderRating}
              />
            ))
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
    </div>
  );
}

function MarketplaceItemCard({ item, index, tab, isSaved, onSave, onAddToCart, onMakeOffer, onUpdateStatus, onAddPhoto, isUploading, renderRating }: any) {
  const [currentImg, setCurrentImg] = useState(0);
  const images = item.images && item.images.length > 0 ? item.images : [null];

  const nextImg = (e: any) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev + 1) % images.length);
  };
  
  const prevImg = (e: any) => {
    e.stopPropagation();
    setCurrentImg((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-[40px] overflow-hidden border border-slate-100 shadow-sm flex flex-col group relative"
    >
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
              <img src={images[currentImg]} className="w-full h-full object-cover" alt={item.title} />
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
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={nextImg}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5">
              {images.map((_: any, idx: number) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentImg ? 'bg-white w-4' : 'bg-white/40'}`} />
              ))}
            </div>
          </>
        )}

        <div className="absolute top-4 left-4">
          <span className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-tighter shadow-lg ${
            item.isFree ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 border border-slate-100'
          }`}>
            {item.isFree ? 'Free' : `£${item.price}`}
          </span>
        </div>

        {tab !== 'my-listings' && (
          <button 
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className={`absolute top-4 right-4 p-2.5 rounded-2xl backdrop-blur-md transition-all active:scale-90 ${isSaved ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-white/80 text-slate-400'}`}
          >
            <Heart size={16} fill={isSaved ? 'white' : 'none'} />
          </button>
        )}
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <p className="text-[9px] text-brand font-black uppercase tracking-widest">
            {item.category} • {item.condition?.replace('_', ' ') || 'Good'}
          </p>
          {item.status !== 'available' && (
            <span className="text-[8px] font-bold uppercase px-2 py-0.5 bg-amber-50 text-amber-600 rounded-lg">{item.status.replace('_', ' ')}</span>
          )}
        </div>
        <h4 className="font-bold text-sm mb-1 line-clamp-1 text-slate-900 tracking-tight">{item.title}</h4>
        
        {renderRating(item.sellerId)}

        <div className="flex items-center space-x-1.5 text-slate-400 mt-3 mb-6">
          <MapPin size={12} />
          <span className="text-[10px] font-bold truncate">
            {item.location?.address.split(',')[0] || 'Local'}
          </span>
        </div>
        
        <div className="mt-auto space-y-2">
          {tab === 'browse' || tab === 'saved' || tab === 'cart' ? (
            <div className="flex flex-col space-y-2">
              <button 
                onClick={onAddToCart}
                className="w-full py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                Add to Bag
              </button>
              {!item.isFree && (
                <button 
                  onClick={onMakeOffer}
                  className="w-full py-3 bg-brand/10 text-brand rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                   Make Offer
                </button>
              )}
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
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 active:scale-95 disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <ImageIcon size={14} />
                    <span>Post Photo</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MakeOfferModal({ item, price, setPrice, onClose, onSubmit }: any) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[300] flex items-center justify-center p-6">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-[50px] p-8 max-w-sm w-full shadow-2xl border border-white"
      >
        <div className="flex justify-between items-start mb-8">
           <div>
             <h3 className="text-2xl font-black text-slate-900 mb-1">Price Offer</h3>
             <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{item.title}</p>
           </div>
           <button onClick={onClose} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
             <X size={20} />
           </button>
        </div>

        <div className="space-y-6">
           <div className="p-8 bg-slate-50 rounded-[40px] text-center border border-slate-100/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Asking Price</p>
              <p className="text-4xl font-black text-slate-900">£{item.price}</p>
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Suggest your price</label>
              <div className="relative">
                 <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                 <input 
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="25.00"
                  className="w-full pl-14 pr-6 py-5 bg-slate-50 rounded-3xl outline-none focus:ring-4 focus:ring-brand/10 font-black text-2xl transition-all"
                 />
              </div>
           </div>

           <button 
            onClick={onSubmit}
            disabled={!price || Number(price) <= 0}
            className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-400 active:scale-95 transition-all disabled:opacity-50 text-[11px]"
           >
             Send Suggestion
           </button>
        </div>
      </motion.div>
    </div>
  );
}
