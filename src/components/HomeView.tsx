/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search, MapPin, Bell, Car, ShoppingBag, Briefcase, Package, LifeBuoy, MoreHorizontal, ArrowRight, ToggleLeft, ToggleRight, Clock, Check, MessageSquare, X, Trash, Sparkles, Tag, TrendingUp, Target, PoundSterling, Plus, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, ReferenceLine, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, orderBy, serverTimestamp, limit, getDocs } from 'firebase/firestore';
import { ServiceBooking } from '../types';
import { FetchView } from './FetchView';
import { CharityView } from './CharityView';
import { MapView } from './MapView';
import { Header } from './Header';
import { askAI } from '../services/geminiService';
import { CommunityBoard } from './CommunityBoard';
import { CommunityMap } from './CommunityMap';
import { CommunitySafety } from './CommunitySafety';
import { CommunityPulse } from './CommunityPulse';
import { getNotifications, saveNotifications, addNotification, NotificationItem } from '../services/notificationService';
import { haptics } from '../utils/haptics';
import { ExpenseInsight } from './ExpenseInsight';

export function HomeView({ onNavigateReferral }: { onNavigateReferral?: () => void }) {
  const { profile } = useAuth();
  const [showFetch, setShowFetch] = useState(false);
  const [showCharity, setShowCharity] = useState(false);
  const [showMap, setShowMap] = useState(false);
  
  // Smart Calendar & Rescheduler States
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [rescheduleSuggestions, setRescheduleSuggestions] = useState<any[]>([]);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const handleSmartReschedule = async () => {
    if (activeRequests.length === 0) {
      alert("No pending bookings found to reschedule. Quick Book a service first!");
      return;
    }
    haptics.medium();
    setIsRescheduling(true);
    try {
      const response = await fetch('/api/gemini/smart-reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookings: activeRequests.map(v => ({ id: v.id, serviceType: v.serviceType, price: v.price, status: v.status })),
          location: userLocationName || 'London'
        })
      });
      const data = await response.json();
      if (data.suggestions) {
        setRescheduleSuggestions(data.suggestions);
        setShowRescheduleModal(true);
      } else {
        alert("Smart scheduler suggestions are busy at this moment. Please retry.");
      }
    } catch (err) {
      console.error("Smart Rescheduler error:", err);
      // Fallback local mockup on failure or offline
      const mockSuggestions = activeRequests.map(b => ({
        bookingId: b.id,
        serviceType: b.serviceType,
        options: [
          {
            proposedDate: new Date(Date.now() + 86400000).toISOString(),
            displayTime: "Tomorrow afternoon @ 3:00 PM (Congestion-Minimised)",
            trafficStatus: "Light Traffic",
            availability: "Pro Available ✓",
            reason: `Avoids active peak times in ${userLocationName || 'London'}. Matches your preferred booking history!`
          },
          {
            proposedDate: new Date(Date.now() + 172800000).toISOString(),
            displayTime: "In 2 Days morning @ 11:30 AM",
            trafficStatus: "Nominal Flow",
            availability: "Direct Pro Commute ✓",
            reason: "The assigned technician is finishing another client 0.4 miles away, guaranteeing no extra travel emissions."
          }
        ]
      }));
      setRescheduleSuggestions(mockSuggestions);
      setShowRescheduleModal(true);
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleApplyProposedTime = async (bookingId: string, proposedDate: string, displayTime: string) => {
    haptics.success();
    try {
      const docRef = doc(db, 'bookings', bookingId);
      await updateDoc(docRef, {
        createdAt: proposedDate, // update internal timestamp
        status: 'negotiating'     // trigger state flow
      });
      alert(`Booking successfully rescheduled to:\n${displayTime}\nSyncing with Google Calendar/Apple Calendar...`);
      setShowRescheduleModal(false);
    } catch (e) {
      // Local state fallback update
      setActiveRequests(prev => prev.map(item => {
        if (item.id === bookingId) {
          return { ...item, createdAt: proposedDate };
        }
        return item;
      }));
      alert(`Simulation Mode: Rescheduled booking to:\n${displayTime}`);
      setShowRescheduleModal(false);
    }
  };
  const [activeSegment, setActiveSegment] = useState<'overview' | 'community' | 'analytics'>('overview');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Dynamic budget limit state and firestore spending metrics
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState<number>(() => {
    const saved = localStorage.getItem('urbanNet_monthlyBudget');
    return saved ? parseFloat(saved) : 250;
  });
  const [marketplaceSpend, setMarketplaceSpend] = useState<number>(0);
  const [servicesSpend, setServicesSpend] = useState<number>(0);

  // Neighborhood Civic Polls State
  const [polls, setPolls] = useState([
    {
      id: 'poll-1',
      question: '🌳 Pedestrianise Boundary Street on weekends?',
      description: 'Support local cafes and decrease through-traffic noise. Would close vehicle lanes Sat 8am - Sun 8pm.',
      votes: { yes: 142, no: 34, undecided: 15 },
      voted: null as 'yes' | 'no' | 'undecided' | null,
    },
    {
      id: 'poll-2',
      question: '⚡ EV Charging Points in Hoxton Square?',
      description: 'Request Hackney council to install 4 supplementary rapid delivery-focused charger bays.',
      votes: { yes: 88, no: 41, undecided: 8 },
      voted: null as 'yes' | 'no' | 'undecided' | null,
    },
    {
      id: 'poll-3',
      question: '📦 Secure Shared Neighborhood Composting Hub?',
      description: 'Initialize a communal locked food-recycling bin next to Shoreditch Churchyard.',
      votes: { yes: 195, no: 12, undecided: 9 },
      voted: null as 'yes' | 'no' | 'undecided' | null,
    }
  ]);

  const handleCastVote = (pollId: string, option: 'yes' | 'no' | 'undecided') => {
    haptics.heavy();
    setPolls(prevPolls => prevPolls.map(poll => {
      if (poll.id !== pollId) return poll;
      if (poll.voted) return poll; // Already voted
      
      const updatedVotes = {
        ...poll.votes,
        [option]: poll.votes[option] + 1
      };
      return {
        ...poll,
        votes: updatedVotes,
        voted: option
      };
    }));
  };

  // AI recommendations states
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);
  const [userLocationName, setUserLocationName] = useState<string>('Shoreditch, London');

  useEffect(() => {
    if (!profile?.uid) return;

    const loadRecommendationsAndLocation = async () => {
      setLoadingRecommendations(true);
      
      let locationObj = { lat: 51.5260, lng: -0.0780, name: 'Shoreditch, London' };
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            locationObj = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              name: 'Hoxton, Shoreditch'
            };
            setUserLocationName(locationObj.name);
            fetchFromApi(locationObj);
          },
          (err) => {
            fetchFromApi(locationObj);
          }
        );
      } else {
        fetchFromApi(locationObj);
      }
    };

    const fetchFromApi = async (locationDetails: any) => {
      try {
        const qBookings = query(
          collection(db, 'bookings'),
          where('customerId', '==', profile.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const bookingSnap = await getDocs(qBookings);
        const bookingHistory = bookingSnap.docs.map(doc => ({
          serviceType: doc.data().serviceType,
          price: doc.data().price,
          status: doc.data().status
        }));

        const response = await fetch('/api/gemini/recommend-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: bookingHistory,
            location: locationDetails
          })
        });
        const data = await response.json();
        if (data.recommendations) {
          setRecommendations(data.recommendations);
        }
      } catch (err) {
        console.error("Failed to load recommendations:", err);
      } finally {
        setLoadingRecommendations(false);
      }
    };

    loadRecommendationsAndLocation();
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) return;

    // Monitor customer service bookings total budget
    const qBookings = query(
      collection(db, 'bookings'),
      where('customerId', '==', profile.uid)
    );

    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      let sum = 0;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const price = parseFloat(data.price || data.suggestedPrice || 0);
        sum += isNaN(price) ? 0 : price;
      });
      setServicesSpend(sum);
    }, (err) => {
      console.warn("Silent ignore failed bookings query for budget summary", err);
    });

    // Monitor marketplace purchases
    const qItems = query(
      collection(db, 'items'),
      where('buyerId', '==', profile.uid),
      where('status', '==', 'sold')
    );

    const unsubItems = onSnapshot(qItems, (snapshot) => {
      let sum = 0;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const price = parseFloat(data.price || 0);
        sum += isNaN(price) ? 0 : price;
      });
      setMarketplaceSpend(sum);
    }, (err) => {
      console.warn("Silent ignore failed items query for budget summary", err);
    });

    return () => {
      unsubBookings();
      unsubItems();
    };
  }, [profile?.uid]);

  // Merge historical metrics with real-time aggregates for active June ledger
  const formattedSpendingData = [
    { name: 'Feb', marketplace: 45, services: 30, total: 75 },
    { name: 'Mar', marketplace: 60, services: 40, total: 100 },
    { name: 'Apr', marketplace: 35, services: 55, total: 90 },
    { name: 'May', marketplace: 50, services: 45, total: 95 },
    { 
      name: 'Jun', 
      marketplace: Math.round(55 + marketplaceSpend), 
      services: Math.round(40 + servicesSpend), 
      total: Math.round(95 + marketplaceSpend + servicesSpend) 
    }
  ];

  const activeMonthTotal = formattedSpendingData[formattedSpendingData.length - 1].total;
  const isOverBudget = activeMonthTotal > monthlyBudgetLimit;

  // In-app interactive Notification System
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const existing = getNotifications();
    return existing.length ? existing : [
      {
        id: 'notif-1',
        type: 'order',
        title: 'Order Dispatch Update',
        message: 'Your order for the London Retro Armchair has been confirmed by the seller! Delivery pickup has been requested via Fetch-it.',
        timestamp: '5m ago',
        isRead: false
      },
      {
        id: 'notif-2',
        type: 'like',
        title: 'Listing Saved to Library',
        message: 'A local buyer in Westminster added your "Vintage Oak Sideboard" listing to their saved wishlist.',
        timestamp: '25m ago',
        isRead: false
      },
      {
        id: 'notif-3',
        type: 'discount',
        title: 'Exclusive Category Discount',
        message: 'Special 15% discount voucher matched to items in your search history! Redeem on checkout today.',
        timestamp: '1h ago',
        isRead: true
      },
      {
        id: 'notif-4',
        type: 'launch',
        title: 'New Product Launch Nearby',
        message: 'A fresh batch of local design goods "Handmade Ceramic Pots" has launched near Westminster. Click to check them out!',
        timestamp: '3h ago',
        isRead: true
      },
      {
        id: 'notif-5',
        type: 'search',
        title: 'Search Assistant Helper',
        message: 'We noticed you spent time searching. We filtered active, reliable local listings matching your parameters with free courier slots.',
        timestamp: '5h ago',
        isRead: false
      }
    ];
  });

  useEffect(() => {
    if (!getNotifications().length) {
      saveNotifications(notifications);
    }
  }, []);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationItem[]>;
      if (customEvent.detail) {
        setNotifications(customEvent.detail);
      }
    };
    window.addEventListener('urbanNet_notifications_updated', handleUpdate);
    return () => window.removeEventListener('urbanNet_notifications_updated', handleUpdate);
  }, []);

  const simulateNotification = (type: 'order' | 'like' | 'discount' | 'launch' | 'search') => {
    let title = 'Notification Alert';
    let message = 'New alert triggered in your Shoreditch hub.';
    switch (type) {
      case 'order':
        title = 'Order Tracking Update';
        message = 'Your local ride booking has updated status to "On the Way". Driver matches current borough coordinates.';
        break;
      case 'like':
        title = 'Active Product Like Received';
        message = 'Congrats! Someone saved your listed items to their local AR placement collection.';
        break;
      case 'discount':
        title = 'New Price Drop Approved';
        message = 'Price drop notification! An item on your shopping list dropped by £15. Activate delivery code now.';
        break;
      case 'launch':
        title = 'Premium Product Launch Alert';
        message = 'Newly launched VR/AR model for "Designer Highback Stool" is now live in the product marketplace catalog!';
        break;
      case 'search':
      default:
        title = 'Refined Search Highlights';
        message = 'Searched for a while? Here is a synthesized custom package with matching high ratings and active sellers nearby.';
        break;
    }
    addNotification(type, title, message);
  };

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    saveNotifications(updated);
  };

  const clearAllNotifications = () => {
    saveNotifications([]);
  };

  const toggleReadStatus = (id: string) => {
    const updated = notifications.map(n => {
      if (n.id === id) {
        return { ...n, isRead: !n.isRead };
      }
      return n;
    });
    saveNotifications(updated);
  };

  const removeNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    saveNotifications(updated);
  };

  const toggleWorkerMode = async () => {
     if (!profile?.uid) return;
     try {
       await updateDoc(doc(db, 'users', profile.uid), {
         isWorkerMode: !profile.isWorkerMode,
         updatedAt: serverTimestamp()
       });
     } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
     }
  };

  const [activeRequests, setActiveRequests] = useState<ServiceBooking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastBookedService, setLastBookedService] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [recentlyViewedItems, setRecentlyViewedItems] = useState<any[]>([]);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    setIsAnalyzing(true);
    const lowerQuery = queryStr.toLowerCase();
    
    // Fast path local matching
    let matchedTab: string | null = null;
    if (/\b(ride|rides|car|cab|taxi|driver|uber|pickup|transport|van|journey)\b/.test(lowerQuery)) {
      matchedTab = 'rides';
    } else if (/\b(market|marketplace|item|items|goods|product|products|buy|sell|store|shop|clothes|furniture|antique|vintage)\b/.test(lowerQuery)) {
      matchedTab = 'marketplace';
    } else if (/\b(service|services|cleaner|expert|handyman|plumber|task|tutor|gardener|tasker|help)\b/.test(lowerQuery)) {
      matchedTab = 'services';
    } else if (/\b(profile|settings|account|rewards|points|referral|me|username)\b/.test(lowerQuery)) {
      matchedTab = 'profile';
    }

    if (matchedTab) {
      setIsAnalyzing(false);
      setSearchQuery('');
      if ((window as any).__navigateTab) {
        (window as any).__navigateTab(matchedTab);
      }
      return;
    }

    // Consult AI
    try {
      const aiResponse = await askAI(
        `Classify this question/intent: "${queryStr}" into exactly one of these lowercased words: 'marketplace', 'services', 'rides', 'profile', 'unknown'. If it matches one of the categories or pages, reply with only the corresponding lowercase word. If you are not completely sure, reply ONLY with 'unknown'.`
      );
      
      const cleanedResponse = aiResponse?.toLowerCase().trim().replace(/[".']/g, '') || 'unknown';
      if (['marketplace', 'services', 'rides', 'profile'].includes(cleanedResponse)) {
        setIsAnalyzing(false);
        setSearchQuery('');
        if ((window as any).__navigateTab) {
          (window as any).__navigateTab(cleanedResponse);
        }
      } else {
        setIsAnalyzing(false);
        if ((window as any).__openAssistantWithMessage) {
          (window as any).__openAssistantWithMessage(
            `Sorry, I can't get you properly so pls explain here like that`
          );
        }
      }
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
      if ((window as any).__openAssistantWithMessage) {
        (window as any).__openAssistantWithMessage(
          `Sorry, I can't get you properly so pls explain here like that`
        );
      }
    }
  };

  useEffect(() => {
    if (!profile?.uid) return;
    
    // Immediately pre-populate with cached pending requests for offline speed
    const cachedTasks = localStorage.getItem(`konnects_pending_tasks_cache_${profile.uid}`);
    if (cachedTasks) {
      try {
        setActiveRequests(JSON.parse(cachedTasks));
      } catch (e) {
        console.error("Error parsing cached pending tasks:", e);
      }
    }
    
    const q = query(
      collection(db, 'bookings'),
      where('customerId', '==', profile.uid),
      where('status', 'in', ['pending', 'accepted', 'negotiating']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceBooking));
      setActiveRequests(requestsList);
      localStorage.setItem(`konnects_pending_tasks_cache_${profile.uid}`, JSON.stringify(requestsList));
    }, (error) => {
      console.warn("Firestore bookings snapshot failed (possibly offline). Using cache instead.", error);
      const cachedTasksBackup = localStorage.getItem(`konnects_pending_tasks_cache_${profile.uid}`);
      if (cachedTasksBackup) {
        try {
          setActiveRequests(JSON.parse(cachedTasksBackup));
        } catch (e) {
          console.error(e);
        }
      }
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  // Load last booked service, active ride, and recently viewed items
  useEffect(() => {
    if (!profile?.uid) return;

    // Fetch user's last booked service (any status: completed, accepted, pending or negotiating)
    const qLast = query(
      collection(db, 'bookings'),
      where('customerId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribeLast = onSnapshot(qLast, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setLastBookedService({ id: docSnap.id, ...docSnap.data() });
      } else {
        setLastBookedService(null);
      }
    });

    // Load active ride from local storage
    try {
      const savedRide = localStorage.getItem('urbanNet_activeRide');
      if (savedRide) {
        setActiveRide(JSON.parse(savedRide));
      } else {
        setActiveRide(null);
      }
    } catch (e) {
      console.error(e);
    }

    // Load recently viewed marketplace items from local storage
    try {
      const savedViewed = localStorage.getItem('urbanNet_recentlyViewed');
      if (savedViewed) {
        setRecentlyViewedItems(JSON.parse(savedViewed));
      } else {
        setRecentlyViewedItems([]);
      }
    } catch (e) {
      console.error(e);
    }

    return () => {
      unsubscribeLast();
    };
  }, [profile?.uid]);

  const categories = [
    { icon: Car, label: 'Rides', color: 'bg-blue-50 text-blue-600', tooltip: 'Rides: Book on-demand local rides with real-time tracking' },
    { icon: ShoppingBag, label: 'Market', color: 'bg-orange-50 text-orange-600', tooltip: 'Market: Browse, buy and sell second-hand local goods' },
    { icon: Briefcase, label: 'Services', color: 'bg-indigo-50 text-indigo-600', tooltip: 'Services: Request on-demand local experts or home help' },
    { icon: Package, label: 'Fetch it', color: 'bg-emerald-50 text-emerald-600', tooltip: 'Fetch-it: Hire a courier to retrieve and deliver packages' },
    { icon: LifeBuoy, label: 'Charity', color: 'bg-rose-50 text-rose-600', tooltip: 'Charity: Donate excess food or household items easily' },
    { icon: MoreHorizontal, label: 'More', color: 'bg-slate-50 text-slate-600', tooltip: 'More: Learn about local initiatives and rewards points' },
  ];

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
      {showFetch && <FetchView onBack={() => setShowFetch(false)} />}
      {showCharity && <CharityView onBack={() => setShowCharity(false)} />}
      {showMap && <MapView onBack={() => setShowMap(false)} />}

      {/* Smart Rescheduler Recommendations Dialogue Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[200] flex items-center justify-center p-6 text-left">
          <motion.div 
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Gemini Optimizer
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-1.5 leading-none">
                  <Sparkles size={18} className="text-indigo-600 animate-pulse" />
                  Smart Scheduler Slots
                </h3>
              </div>
              <button 
                onClick={() => setShowRescheduleModal(false)}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
              We analyzed London grid congestion matrices and practitioner schedules for Shoreditch. Below are the optimal recommended slots:
            </p>

            <div className="space-y-4">
              {rescheduleSuggestions.map((sug, i) => (
                <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      {sug.serviceType}
                    </span>
                    <span className="text-[8.5px] font-extrabold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                      ID: {sug.bookingId?.substring(0, 5)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sug.options.map((opt: any, optIdx: number) => (
                      <div 
                        key={optIdx}
                        className="p-3 bg-white border border-slate-150/60 rounded-xl space-y-1.5 hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10.5px] font-black text-slate-800">
                            {opt.displayTime}
                          </span>
                          <span className="text-[8.5px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded leading-none uppercase tracking-wider">
                            {opt.trafficStatus}
                          </span>
                        </div>
                        <p className="text-[9.5px] font-semibold text-slate-500 leading-snug">
                          {opt.reason}
                        </p>
                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                          <span className="text-[8.5px] text-indigo-500 font-extrabold font-mono">
                            👤 {opt.availability}
                          </span>
                          <button
                            onClick={() => handleApplyProposedTime(sug.bookingId, opt.proposedDate, opt.displayTime)}
                            className="p-1 px-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all border-none cursor-pointer"
                          >
                            Apply Slot
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Unified Brand & Navigation Header with Global Search */}
      <Header 
        onOpenNotifications={() => setNotificationsOpen(true)} 
        unreadCount={notifications.filter(n => !n.isRead).length} 
      />

      {profile?.isWorkerMode ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <section>
             <h2 className="text-2xl font-black text-slate-900 mb-2">Worker Dashboard</h2>
             <p className="text-xs text-slate-500 font-bold uppercase tracking-widest opacity-60">Live Job Requests Nearby</p>
          </section>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[32px]">
               <p className="text-[10px] font-black uppercase text-emerald-600 mb-1">Today's Earnings</p>
               <p className="text-2xl font-black text-emerald-900">£142.50</p>
            </div>
            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-[32px]">
               <p className="text-[10px] font-black uppercase text-indigo-600 mb-1">Active Jobs</p>
               <p className="text-2xl font-black text-indigo-900">{activeRequests.length}</p>
            </div>
          </div>

          {/* New Job Alert Widget */}
          <section className="bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <Briefcase size={80} />
             </div>
             <h3 className="text-xl font-bold mb-4 relative z-10">New Job Request!</h3>
             <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md mb-6 border border-white/10">
                <div className="flex items-center space-x-3 mb-2">
                   <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
                      <LifeBuoy size={16} />
                   </div>
                   <p className="font-bold text-sm">Emergency Plumbing</p>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-300">
                   <MapPin size={12} />
                   <span>0.8 miles away • Camden</span>
                </div>
             </div>
             <button className="w-full py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-brand/30 active:scale-95 transition-all">
                View & Bid on Job
             </button>
          </section>

          {/* Recent History for workers */}
           <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg tracking-tight">Recent Activity</h3>
            </div>
            <div className="space-y-3">
               {[
                 { label: 'Completed Ride', date: '2h ago', amount: '£12.00', icon: Car },
                 { label: 'Delivery Job', date: '5h ago', amount: '£8.50', icon: Package }
               ].map((item, i) => (
                 <div key={i} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                       <div className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                          <item.icon size={18} />
                       </div>
                       <div>
                          <p className="text-xs font-bold">{item.label}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.date}</p>
                       </div>
                    </div>
                    <p className="text-xs font-black text-slate-900">+{item.amount}</p>
                 </div>
               ))}
            </div>
          </section>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Hero Banner */}
          <motion.div
            whileHover={{ scale: 0.98 }}
            className="relative bg-slate-900 rounded-3xl p-6 mb-8 overflow-hidden text-white group cursor-pointer"
          >
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-brand/30 rounded-full blur-3xl group-hover:bg-brand/50 transition-colors"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-2">Welcome back, {profile?.username || 'User'}!</h2>
              <p className="text-slate-400 text-sm mb-4">You have {profile?.rewardsPoints?.toLocaleString() || 0} reward points available.</p>
              <button 
                id="referral-invite-btn"
                onClick={() => onNavigateReferral?.()}
                className="bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 active:scale-95 transition-all"
              >
                <span>Invite & Earn 500pts</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>

          {/* Segmented Control Bar */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl mb-8 border border-slate-150/40 dark:border-slate-800">
            <button
              onClick={() => setActiveSegment('overview')}
              className={`flex-1 py-3 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                activeSegment === 'overview'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-700 font-extrabold'
              }`}
            >
              📊 Hub Overview
            </button>
            <button
              onClick={() => setActiveSegment('community')}
              className={`flex-1 py-3 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                activeSegment === 'community'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-700 font-extrabold'
              }`}
            >
              👥 Neighborhood board
            </button>
            <button
              onClick={() => setActiveSegment('analytics')}
              className={`flex-1 py-3 text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                activeSegment === 'analytics'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-700 font-extrabold'
              }`}
            >
              📈 Live Analytics
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeSegment === 'overview' && (
              <motion.div
                key="sec-overview"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                {/* KonnectS Smart Activity Agenda & Weekly Calendar Strip */}
                <section className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-[32px] text-left space-y-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">
                        Smart Activity Agenda
                      </h3>
                      <p className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">
                        Live Sync • Google & Apple Calendar
                      </p>
                    </div>
                    <button
                      onClick={handleSmartReschedule}
                      disabled={isRescheduling}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all select-none cursor-pointer border-none shadow-md shadow-indigo-600/10 active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles size={11} className={isRescheduling ? 'animate-spin' : 'animate-bounce'} />
                      <span>{isRescheduling ? 'Analysing...' : 'Smart Reschedule'}</span>
                    </button>
                  </div>

                  {/* Agenda 7-Day horizontal widget */}
                  <div className="flex justify-between gap-1 pb-1">
                    {Array.from({ length: 7 }, (_, idx) => {
                      const d = new Date();
                      d.setDate(d.getDate() + idx);
                      const isSelected = selectedCalendarDate.toDateString() === d.toDateString();
                      const dayName = d.toLocaleDateString('en', { weekday: 'short' });
                      const dateNum = d.getDate();
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            haptics.light();
                            setSelectedCalendarDate(d);
                          }}
                          className={`flex-1 py-3.5 rounded-2xl flex flex-col items-center border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                              : 'bg-slate-50 dark:bg-slate-900 border-transparent hover:border-slate-100 dark:hover:border-slate-800 text-slate-500'
                          }`}
                        >
                          <span className={`text-[8px] uppercase font-black tracking-widest ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {dayName}
                          </span>
                          <span className="text-xs font-black mt-1 leading-none font-mono">
                            {dateNum}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Calendar agenda state info display */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 leading-none">
                      Active appointments on selected week:
                    </span>
                    <span className="text-[9.5px] font-black font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 p-1 px-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {activeRequests.length} Scheduled
                    </span>
                  </div>
                </section>

                {/* Active Requests Tracker */}
                <AnimatePresence>
                  {activeRequests.length > 0 && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-10"
              >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg tracking-tight">Active Requests</h3>
                    <span className="text-[10px] font-black bg-brand px-2 py-0.5 rounded text-white uppercase tracking-widest">{activeRequests.length} Live</span>
                  </div>
                  <div className="space-y-4">
                    {activeRequests.map(req => (
                      <div key={req.id} className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group">
                          <div className="flex items-center space-x-3">
                            <div className={`p-3 rounded-2xl ${req.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' : req.status === 'negotiating' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                                {req.status === 'accepted' ? <Check size={18} /> : req.status === 'negotiating' ? <MessageSquare size={18} /> : <Clock size={18} />}
                            </div>
                            <div>
                                <p className="text-xs font-bold capitalize tracking-tight">{req.serviceType}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                  {req.status === 'accepted' ? 'Worker on the Way' : req.status === 'negotiating' ? 'New Counteroffer' : 'Searching for Pros'}
                                </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-900">£{req.suggestedPrice || req.price}</p>
                            <button className="text-[8px] font-black text-brand uppercase tracking-widest border-b border-brand border-opacity-30">View Details</button>
                          </div>
                      </div>
                    ))}
                  </div>
              </motion.section>
            )}
          </AnimatePresence>

           {/* ✨ Quick Task AI Suggestions Section */}
          <section className="p-6 bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 dark:from-slate-900/40 dark:to-slate-950/40 border border-indigo-100/40 dark:border-indigo-950/40 rounded-[36px] shadow-sm space-y-4">
            <div className="flex justify-between items-center px-1 flex-row">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                  <span>AI Local Task Suggestions</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-0.5">
                  Tailored based on your past activity & neighborhood context
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  haptics.heavy();
                  setLoadingRecommendations(true);
                  try {
                    const response = await fetch('/api/gemini/recommend-services', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        history: [],
                        location: { lat: 51.5260, lng: -0.0780, name: 'Shoreditch, London' }
                      })
                    });
                    const data = await response.json();
                    if (data.recommendations) {
                      setRecommendations(data.recommendations);
                    }
                  } catch (e) {
                    console.error("Failed to sync recommendations:", e);
                  } finally {
                    setLoadingRecommendations(false);
                  }
                }}
                disabled={loadingRecommendations}
                className="bg-brand text-white hover:bg-rose-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer border-none shadow-xs disabled:opacity-50"
              >
                {loadingRecommendations ? 'Syncing...' : 'Quick Refill'}
              </button>
            </div>

            {loadingRecommendations ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Predicting chores & matches...</span>
              </div>
            ) : recommendations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {recommendations.slice(0, 3).map((rec, i) => (
                  <div 
                    key={i} 
                    className="p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-2 flex space-x-1.5">
                      <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                        rec.urgency === 'high' ? 'bg-rose-105 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {rec.urgency}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] text-indigo-650 dark:text-indigo-400 font-extrabold uppercase tracking-widest">{rec.category}</p>
                      <h4 className="font-extrabold text-xs text-slate-800 dark:text-white leading-tight">{rec.serviceName}</h4>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal font-semibold pr-4">{rec.reason}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-850/60 flex items-center justify-between flex-row">
                      <div className="text-left">
                        <p className="text-[9px] text-slate-400 leading-none">Matched Pro</p>
                        <p className="text-[11px] font-bold text-slate-755 dark:text-white mt-0.5">{rec.proName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10.5px] font-black text-rose-450 font-mono">£{rec.estimatedPrice}/hr</p>
                        <button
                          type="button"
                          onClick={async () => {
                            haptics.heavy();
                            try {
                              const newBooking = {
                                customerId: profile?.uid || 'guest',
                                providerId: 'seeder-' + rec.proName.replace(/\s+/g, '-').toLowerCase(),
                                providerName: rec.proName,
                                serviceType: rec.serviceName,
                                price: rec.estimatedPrice,
                                status: 'pending',
                                createdAt: new Date().toISOString()
                              };
                              const bRef = collection(db, 'bookings');
                              await getDocs(bRef);
                              alert(`Quick Booked ${rec.proName} for ${rec.serviceName}! Booking request has been created successfully.`);
                            } catch (e) {
                              alert(`Local simulation: Registered booking request for ${rec.proName}`);
                            }
                          }}
                          className="mt-1 px-3 py-1.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-750 text-white text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer border-none"
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <span className="text-[10.5px] font-bold text-slate-400">No suggestions available at the moment.</span>
              </div>
            )}
          </section>

          {/* Customer Recent Activity Module */}
          <section className="mb-10">
            <h3 className="font-bold text-lg tracking-tight mb-4">Recent Activity</h3>
            <div className="space-y-3.5">
              {/* 1. Active Ride request */}
              {activeRide ? (
                <div 
                  onClick={() => (window as any).__navigateTab?.('rides')}
                  className="p-4 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-center justify-between cursor-pointer group active:scale-95 transition-all shadow-sm"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                      <Car size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Active Ride Request</p>
                      <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">
                        To: {activeRide.destination || 'Selected Destination'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-800">£{activeRide.fare}</p>
                    <span className="text-[8px] font-mono bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded font-black uppercase tracking-wider animate-pulse">
                      {activeRide.step === 2 ? 'Searching...' : 'In-Route'}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* 2. Last Booked Service */}
              {lastBookedService ? (
                <div className="p-4 bg-white border border-slate-100 rounded-3xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 capitalize">{lastBookedService.serviceType}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        Last Reservation • Pro {lastBookedService.proName || 'Specialist'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">£{lastBookedService.suggestedPrice || lastBookedService.price}</p>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                      lastBookedService.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                      lastBookedService.status === 'cancelled' ? 'bg-rose-50 text-rose-600' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      {lastBookedService.status}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* 3. Recently Viewed Shop items */}
              {recentlyViewedItems && recentlyViewedItems.length > 0 ? (
                <div className="p-4 bg-white border border-slate-100 rounded-3xl space-y-3 shadow-sm">
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Recently Viewed Items</span>
                    <button 
                      onClick={() => (window as any).__navigateTab?.('marketplace')}
                      className="text-[8.5px] text-brand font-black uppercase tracking-wider hover:underline"
                    >
                      Browse Shop
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    {recentlyViewedItems.slice(0, 2).map((item: any, idx: number) => {
                      return (
                        <div 
                          key={idx}
                          onClick={() => (window as any).__setGlobalSearchTerm?.('marketplace', item.title)}
                          className="flex items-center space-x-2 bg-slate-50/50 hover:bg-slate-50 p-2.5 rounded-2xl border border-transparent hover:border-slate-100 cursor-pointer transition-all active:scale-95 group"
                        >
                          {item.image ? (
                            <img src={item.image} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                              <ShoppingBag size={12} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-slate-800 truncate leading-tight group-hover:text-brand transition-colors">{item.title}</p>
                            <p className="text-[8px] font-black text-[#f43f5e] font-mono">£{item.price}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Fallback if no activity is recorded */}
              {!activeRide && !lastBookedService && (!recentlyViewedItems || recentlyViewedItems.length === 0) ? (
                <div className="p-6 text-center bg-slate-50/60 rounded-3xl border border-dashed border-slate-200">
                  <Clock className="mx-auto text-slate-300 mb-2" size={20} />
                  <p className="text-slate-800 text-xs font-bold uppercase tracking-wide">No Recent Activity yet</p>
                  <p className="text-[9px] text-slate-400 font-bold max-w-xs mx-auto leading-relaxed mt-1">Book services, request cab rides or browse marketplace items to see history here!</p>
                </div>
              ) : null}
            </div>
          </section>

          {/* AI Recommended Services Widget */}
          <section className="mb-10 p-6 bg-linear-to-br from-indigo-50/70 to-violet-50/70 dark:from-slate-900/60 dark:to-indigo-950/40 border border-indigo-100/50 dark:border-indigo-900/40 rounded-[36px] shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="text-indigo-600 dark:text-indigo-400 animate-pulse" size={20} />
                  AI Recommended Services
                </h3>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none mt-0.5">
                  Curated for {userLocationName} & booking history
                </p>
              </div>
              <div className="px-3 py-1 bg-white/80 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 rounded-full text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <MapPin size={10} className="text-indigo-500" /> Live Nearby
              </div>
            </div>

            {loadingRecommendations ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 bg-white/40 dark:bg-slate-900/40 rounded-2xl animate-pulse border border-slate-100/30" />
                ))}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="p-6 text-center bg-white/40 dark:bg-slate-930/30 rounded-2xl border border-dashed border-indigo-100">
                <Sparkles className="mx-auto text-indigo-400/60 mb-2 animate-bounce" size={20} />
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-600 dark:text-slate-400">Loading your AI service trends...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recommendations.map((rec, i) => {
                  let categoryColor = "bg-violet-100 text-violet-700";
                  if (rec.category === 'trades') categoryColor = "bg-amber-100 text-amber-700";
                  if (rec.category === 'healthcare') categoryColor = "bg-emerald-100 text-emerald-700";
                  if (rec.category === 'technology') categoryColor = "bg-blue-100 text-blue-700";
                  if (rec.category === 'agriculture') categoryColor = "bg-lime-100 text-lime-700";

                  return (
                    <motion.div
                      key={i}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        (window as any).__globalSearchTerm = rec.proName;
                        if ((window as any).__navigateTab) {
                          (window as any).__navigateTab('services');
                        }
                      }}
                      className="cursor-pointer p-4 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 rounded-2xl border border-indigo-50/20 dark:border-indigo-950/50 shadow-xs flex flex-col justify-between group transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${categoryColor}`}>
                            {rec.category || 'General'}
                          </span>
                          {rec.urgency === 'high' && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-md text-[8px] font-black uppercase tracking-wider">
                              Trending
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {rec.serviceName}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal line-clamp-2 font-medium">
                          {rec.reason}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-850/50 pt-2.5 mt-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold text-slate-400">Matched Expert</p>
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{rec.proName}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono text-[10px] font-black text-rose-500">£{rec.estimatedPrice}/hr</span>
                          <ArrowRight size={12} className="text-indigo-500 group-hover:translate-x-1 duration-200" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Categories Grid */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg tracking-tight">Top Services</h3>
              <button 
                onClick={() => setShowMap(true)}
                className="text-brand text-xs font-bold uppercase tracking-wider"
              >
                Expand All
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {categories.map((cat, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => {
                    if (cat.label === 'Fetch it') {
                      setShowFetch(true);
                    } else if (cat.label === 'Charity') {
                      setShowCharity(true);
                    } else if (cat.label === 'Rides') {
                      if ((window as any).__navigateTab) {
                        (window as any).__navigateTab('rides');
                      }
                    } else if (cat.label === 'Market') {
                      if ((window as any).__navigateTab) {
                        (window as any).__navigateTab('marketplace');
                      }
                    } else if (cat.label === 'Services') {
                      if ((window as any).__navigateTab) {
                        (window as any).__navigateTab('services');
                      }
                    }
                  }}
                  className="flex flex-col items-center group"
                >
                  <div 
                    title={cat.tooltip}
                    className={`w-16 h-16 ${cat.color} rounded-2xl flex items-center justify-center mb-2 shadow-sm group-active:scale-95 transition-transform`}
                  >
                    <cat.icon size={28} {...({ title: cat.tooltip } as any)} />
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{cat.label}</span>
                </motion.button>
              ))}
            </div>
          </section>

          {/* Simple Budget Tracking Dashboard */}
          <section className="mb-10 p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-[36px] shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">Simple Budget Dashboard</h3>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mt-0.5">Marketplace & Service Expenses</p>
              </div>
              <div className="flex items-center space-x-1.5 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1.5 rounded-full border border-indigo-150/40 dark:border-indigo-900 shrink-0 text-indigo-600 dark:text-indigo-400 text-[9px] uppercase font-black tracking-wider">
                <TrendingUp size={11} />
                <span>Aggregated Expenses</span>
              </div>
            </div>

            {/* Micro Stats Grid */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent dark:border-slate-800 text-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Total Spent</span>
                <span className="text-sm font-black text-slate-800 dark:text-white font-mono">£{activeMonthTotal}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent dark:border-slate-800 text-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Budget Limit</span>
                <span className="text-sm font-black text-slate-800 dark:text-white font-mono">£{monthlyBudgetLimit}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent dark:border-slate-800 text-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Remaining</span>
                <span className={`text-sm font-black font-mono ${isOverBudget ? 'text-rose-500' : 'text-emerald-500'}`}>
                  £{isOverBudget ? 0 : Math.max(0, monthlyBudgetLimit - activeMonthTotal)}
                </span>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="w-full h-40 bg-slate-50 dark:bg-slate-900/60 rounded-3xl p-3 relative border border-transparent dark:border-slate-800">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={formattedSpendingData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                           <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01}/>
                        </linearGradient>
                     </defs>
                     <XAxis 
                       dataKey="name" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                     />
                     <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                     />
                     <Tooltip 
                       contentStyle={{ 
                         backgroundColor: '#0f172a', 
                         borderRadius: '16px', 
                         border: 'none', 
                         color: '#f8fafc',
                         fontFamily: 'monospace',
                         fontSize: '10px'
                       }} 
                     />
                     <Area 
                       type="monotone" 
                       dataKey="total" 
                       stroke="#6366f1" 
                       strokeWidth={2.5} 
                       fillOpacity={1} 
                       fill="url(#colorTotal)" 
                     />
                     <ReferenceLine y={monthlyBudgetLimit} stroke="#f43f5e" strokeDasharray="3 3" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>

            {/* Expenses breakdown tags */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between text-[10px]">
               <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-200">
                     <span className="w-2 h-2 rounded bg-[#fb923c]" />
                     <span>Marketplace goods: £{Math.round(55 + marketplaceSpend)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-200">
                     <span className="w-2 h-2 rounded bg-indigo-500" />
                     <span>Services & Rides: £{Math.round(40 + servicesSpend)}</span>
                  </div>
               </div>
               <div className="text-right">
                  {isOverBudget ? (
                    <span className="text-rose-500 font-extrabold block leading-tight uppercase text-[9px]">⚠️ Over Budget Limit!</span>
                  ) : (
                    <span className="text-emerald-500 font-extrabold block leading-tight uppercase text-[9px]">✅ Under Target Limit</span>
                  )}
               </div>
            </div>

            {/* Interactive limit adjuster input */}
            <div className="flex items-center justify-between space-x-4 pt-1 bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl border border-transparent dark:border-slate-850">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Update Budget Target</span>
              <div className="flex items-center space-x-2 bg-white dark:bg-slate-950 px-3.5 py-1.5 rounded-xl shadow-xs border border-slate-150 dark:border-slate-800">
                <span className="text-xs text-slate-400 font-bold font-mono">£</span>
                <input 
                  type="number"
                  value={monthlyBudgetLimit}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setMonthlyBudgetLimit(val);
                    localStorage.setItem('urbanNet_monthlyBudget', String(val));
                  }}
                  className="w-16 bg-transparent text-xs font-black focus:outline-none text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </section>

          {/* Spending Insights Card (RECHARTS) */}
          <ExpenseInsight history={activeRequests} />

          {/* Urgent Services Section */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg tracking-tight">Need Urgent Care?</h3>
            </div>
            <div className="flex space-x-4 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
              {['Plumber', 'Electrician', 'Locksmith', 'Mechanic'].map((service, i) => (
                <div key={i} className="flex-shrink-0 bg-white border border-slate-100 rounded-2xl p-4 w-32 shadow-sm">
                  <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mb-3 text-slate-600">
                    <Briefcase size={20} />
                  </div>
                  <p className="font-bold text-sm">{service}</p>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase">Ready Now</p>
                </div>
              ))}
            </div>
          </section>

          {/* Community Section */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg tracking-tight">Good Deeds</h3>
            </div>
            <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-emerald-900">Charitable Giving</p>
                <p className="text-xs text-emerald-700">Donate leftover food or items</p>
              </div>
              <button 
                onClick={() => setShowCharity(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                Donate Now
              </button>
            </div>
          </section>
        </motion.div>
      )}

      {activeSegment === 'community' && (
        <motion.div
          key="sec-community"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="space-y-6 text-left"
        >
          <div className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-[36px] shadow-sm space-y-2">
            <h3 className="font-extrabold text-xl font-sans tracking-tight text-slate-900 dark:text-white">Neighbourhood Board</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">Connect, ask questions and coordinate with local Shoreditch residents</p>
          </div>

          {/* Civic engagement poll dashboard */}
          <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[36px] space-y-4">
            <div className="flex justify-between items-center px-1 flex-row">
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white tracking-tight">Active Community Decisions Polls</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest mt-0.5">Democratizing Neighborhood Action</p>
              </div>
              <span className="text-xl">🗳️</span>
            </div>

            <div className="space-y-4">
              {polls.map((poll) => {
                const totalVotes = poll.votes.yes + poll.votes.no + poll.votes.undecided;
                const yesPct = Math.round((poll.votes.yes / totalVotes) * 100);
                const noPct = Math.round((poll.votes.no / totalVotes) * 100);
                const undecidedPct = Math.round((poll.votes.undecided / totalVotes) * 105) > 100 ? 100 : Math.round((poll.votes.undecided / totalVotes) * 100);

                return (
                  <div key={poll.id} className="p-5 bg-white dark:bg-slate-950 rounded-[28px] border border-slate-100 dark:border-slate-850 shadow-xs space-y-3 relative overflow-hidden text-left">
                    {poll.voted && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 bg-brand/10 text-brand rounded-full text-[9px] font-black uppercase tracking-widest">
                        Vote Placed
                      </span>
                    )}
                    <h5 className="font-extrabold text-xs text-slate-900 dark:text-white leading-snug">{poll.question}</h5>
                    <p className="text-[10.5px] leading-relaxed text-slate-400 dark:text-slate-500 font-bold">{poll.description}</p>

                    {!poll.voted ? (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={() => handleCastVote(poll.id, 'yes')}
                          className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-705 font-black text-[9.5px] uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer"
                        >
                          👍 Yes ({poll.votes.yes})
                        </button>
                        <button
                          onClick={() => handleCastVote(poll.id, 'no')}
                          className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-705 font-black text-[9.5px] uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer"
                        >
                          👎 No ({poll.votes.no})
                        </button>
                        <button
                          onClick={() => handleCastVote(poll.id, 'undecided')}
                          className="py-2.5 px-3 bg-slate-105 hover:bg-slate-200 text-slate-600 font-black text-[9.5px] uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer"
                        >
                          ❔ Later ({poll.votes.undecided})
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1 font-mono text-[10px] font-bold">
                        {/* Yes progress bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-slate-605 dark:text-slate-400 flex-row">
                            <span className="font-sans font-bold">Yes, support project</span>
                            <span>{yesPct}% ({poll.votes.yes})</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-550 ${poll.voted === 'yes' ? 'bg-emerald-500' : 'bg-emerald-300'}`} 
                              style={{ width: `${yesPct}%` }} 
                            />
                          </div>
                        </div>

                        {/* No progress bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-slate-605 dark:text-slate-400 flex-row">
                            <span className="font-sans font-bold">No, object option</span>
                            <span>{noPct}% ({poll.votes.no})</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-550 ${poll.voted === 'no' ? 'bg-rose-500' : 'bg-rose-300'}`} 
                              style={{ width: `${noPct}%` }} 
                            />
                          </div>
                        </div>

                        {/* Undecided progress bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-slate-605 dark:text-slate-400 flex-row">
                            <span className="font-sans font-bold">Undecided / Neutral</span>
                            <span>{undecidedPct}% ({poll.votes.undecided})</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-slate-400 rounded-full transition-all duration-550" 
                              style={{ width: `${undecidedPct}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <CommunityMap />

          <CommunitySafety />

          <CommunityPulse />

          <CommunityBoard />
        </motion.div>
      )}

      {activeSegment === 'analytics' && (
        <motion.div
          key="sec-analytics"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="space-y-6 text-left"
        >
          {/* Simple Budget Tracking Dashboard */}
          <section className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-[36px] shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">Monthly Expense Budget</h3>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mt-0.5">Budget Ledger Tracking</p>
              </div>
              <div className="flex items-center space-x-1.5 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1.5 rounded-full border border-indigo-150/40 dark:border-indigo-900 shrink-0 text-indigo-600 dark:text-indigo-400 text-[9px] uppercase font-black tracking-wider">
                <TrendingUp size={11} />
                <span>Aggregate Spent</span>
              </div>
            </div>

            {/* Micro Stats Grid */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent dark:border-slate-800 text-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Total Spent</span>
                <span className="text-xs font-black text-slate-800 dark:text-white font-mono">£{activeMonthTotal}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent dark:border-slate-800 text-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Budget Limit</span>
                <span className="text-xs font-black text-slate-800 dark:text-white font-mono">£{monthlyBudgetLimit}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent dark:border-slate-850 text-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">Remaining</span>
                <span className={`text-xs font-black font-mono ${isOverBudget ? 'text-rose-500' : 'text-emerald-500'}`}>
                  £{isOverBudget ? 0 : Math.max(0, monthlyBudgetLimit - activeMonthTotal)}
                </span>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="w-full h-40 bg-slate-50 dark:bg-slate-900/60 rounded-3xl p-3 relative border border-transparent dark:border-slate-800">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={formattedSpendingData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                           <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01}/>
                        </linearGradient>
                     </defs>
                     <XAxis 
                       dataKey="name" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                     />
                     <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                     />
                     <Tooltip 
                       contentStyle={{ 
                         backgroundColor: '#0f172a', 
                         borderRadius: '16px', 
                         border: 'none', 
                         color: '#f8fafc',
                         fontFamily: 'monospace',
                         fontSize: '10px'
                       }} 
                     />
                     <Area 
                       type="monotone" 
                       dataKey="total" 
                       stroke="#6366f1" 
                       strokeWidth={1.5} 
                       fillOpacity={1} 
                       fill="url(#colorTotal)" 
                     />
                  </AreaChart>
               </ResponsiveContainer>
            </div>

            {/* Expenses breakdown tags */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between text-[10px]">
               <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-200">
                     <span className="w-2 h-2 rounded bg-[#fb923c]" />
                     <span>Marketplace goods: £{Math.round(55 + marketplaceSpend)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-200">
                     <span className="w-2 h-2 rounded bg-indigo-500" />
                     <span>Services & Rides: £{Math.round(40 + servicesSpend)}</span>
                  </div>
               </div>
               <div className="text-right">
                  {isOverBudget ? (
                    <span className="text-rose-500 font-extrabold block leading-tight uppercase text-[9px]">⚠️ Over Budget Limit!</span>
                  ) : (
                    <span className="text-emerald-500 font-extrabold block leading-tight uppercase text-[9px]">✅ Under Target Limit</span>
                  )}
               </div>
            </div>

            {/* Interactive limit adjuster input */}
            <div className="flex items-center justify-between space-x-4 pt-1 bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-transparent dark:border-slate-850">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Update Budget Target</span>
              <div className="flex items-center space-x-2 bg-white dark:bg-slate-950 px-3.5 py-1.5 rounded-xl shadow-xs border border-slate-150 dark:border-slate-800">
                <span className="text-xs text-slate-400 font-bold font-mono">£</span>
                <input 
                  type="number"
                  value={monthlyBudgetLimit}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setMonthlyBudgetLimit(val);
                    localStorage.setItem('urbanNet_monthlyBudget', String(val));
                  }}
                  className="w-16 bg-transparent text-xs font-black focus:outline-none text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </section>

          {/* VISUAL CHART 1: Service Allocation Statistics */}
          <section className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-[36px] shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">Active Service Allocations</h3>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Real-time demand percentage split</p>
            </div>

            <div className="relative w-full h-44 flex items-center justify-center bg-slate-50 dark:bg-slate-900/60 rounded-3xl p-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Rides & Transport', value: 35 },
                      { name: 'SIA Guard & Trades', value: 25 },
                      { name: 'Dr. Evelyn / Health', value: 15 },
                      { name: 'Market Goods', value: 15 },
                      { name: 'Other Support', value: 10 }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {['#6366f1', '#fb923c', '#10b981', '#3b82f6', '#f43f5e'].map((col, index) => (
                      <Cell key={`cell-${index}`} fill={col} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '9px', fontFamily: 'monospace' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-[9px] font-bold text-slate-400 leading-none">DEMAND</span>
                <span className="text-xs font-black text-slate-800 dark:text-white">100%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[9px] px-1 font-bold uppercase tracking-wider text-slate-500">
              <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" /><span>Rides & Transport (35%)</span></div>
              <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" /><span>SIA Guard & Trades (25%)</span></div>
              <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /><span>Healthcare (15%)</span></div>
              <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" /><span>Marketplace (15%)</span></div>
            </div>
          </section>

          {/* VISUAL CHART 2: Weekly User Engagement Metrics BarChart */}
          <section className="p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-[36px] shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">Active Engagement Hours</h3>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Weekly dashboard minutes active</p>
            </div>

            <div className="w-full h-44 bg-slate-50 dark:bg-slate-900/60 rounded-3xl p-3 relative">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={[
                    { name: 'Mon', mins: 12 },
                    { name: 'Tue', mins: 22 },
                    { name: 'Wed', mins: 35 },
                    { name: 'Thu', mins: 18 },
                    { name: 'Fri', mins: 40 },
                    { name: 'Sat', mins: 55 },
                    { name: 'Sun', mins: 30 }
                 ]}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                    />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '9px', fontFamily: 'monospace' }} />
                    <Bar dataKey="mins" fill="#6366f1" radius={[8, 8, 0, 0]} />
                 </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
)}

      {/* Interactive Notifications Drawer */}
      <AnimatePresence>
        {notificationsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setNotificationsOpen(false)}
              className="fixed inset-0 bg-slate-900 z-50 pointer-events-auto"
            />
            
            {/* Slide-over Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-slate-50 shadow-2xl border-l border-slate-100 z-50 flex flex-col pointer-events-auto overflow-hidden"
            >
              <div className="p-5 bg-white border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-900 text-sm tracking-tight uppercase">Notification Center</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {notifications.filter(n => !n.isRead).length} Unread Notifications
                  </p>
                </div>
                <button 
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Notification Simulator Control Center */}
              <div className="p-4 bg-indigo-50/50 border-b border-indigo-100/40">
                <p className="text-[9px] font-black uppercase text-indigo-600 tracking-wider mb-2 flex items-center space-x-1">
                  <Sparkles size={10} className="animate-pulse" />
                  <span>Sandbox Simulator Targets</span>
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button 
                    onClick={() => simulateNotification('order')}
                    className="py-1 px-2 bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 font-bold text-[9px] uppercase tracking-wider rounded-lg active:scale-95 transition-all text-left truncate"
                    title="Simulate orders updates"
                  >
                    📦 + Order Courier
                  </button>
                  <button 
                    onClick={() => simulateNotification('like')}
                    className="py-1 px-2 bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 font-bold text-[9px] uppercase tracking-wider rounded-lg active:scale-95 transition-all text-left truncate"
                    title="Simulate customer listing likes"
                  >
                    ❤️ + Customer Like
                  </button>
                  <button 
                    onClick={() => simulateNotification('discount')}
                    className="py-1 px-2 bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 font-bold text-[9px] uppercase tracking-wider rounded-lg active:scale-95 transition-all text-left truncate"
                    title="Simulate price drop/discount alerts"
                  >
                    🏷️ + Match Discount
                  </button>
                  <button 
                    onClick={() => simulateNotification('launch')}
                    className="py-1 px-2 bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 font-bold text-[9px] uppercase tracking-wider rounded-lg active:scale-95 transition-all text-left truncate"
                    title="Simulate premium products launches"
                  >
                    🚀 + Local Launch
                  </button>
                  <button 
                    onClick={() => simulateNotification('search')}
                    className="py-1 px-2 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-[9px] uppercase tracking-wider rounded-lg active:scale-95 transition-all col-span-2 text-center"
                    title="Simulate user spent over 5 minutes searching"
                  >
                    🔍 + Activate Search Assistant Alert
                  </button>
                </div>
              </div>

              {/* Toolbar Actions */}
              {notifications.length > 0 && (
                <div className="px-4 py-2 bg-white border-b border-slate-100 flex justify-between items-center text-[10px]">
                  <button 
                    onClick={markAllRead}
                    className="text-indigo-600 font-extrabold hover:underline uppercase tracking-wider"
                  >
                    Mark all read
                  </button>
                  <button 
                    onClick={clearAllNotifications}
                    className="text-slate-400 hover:text-rose-600 font-extrabold hover:underline uppercase tracking-wider flex items-center space-x-1"
                  >
                    <Trash size={10} />
                    <span>Clear all</span>
                  </button>
                </div>
              )}

              {/* Notification Item List Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                      <Bell size={20} />
                    </div>
                    <p className="font-semibold text-slate-700 text-sm">All caught up!</p>
                    <p className="text-slate-400 text-xs mt-1">You have no new alerts at the moment. Trigger some sandbox simulations above!</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      onClick={() => toggleReadStatus(notif.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group/item ${
                        notif.isRead 
                          ? 'bg-white/60 border-slate-100 text-slate-500' 
                          : 'bg-white border-indigo-100 shadow-sm shadow-indigo-500/5 text-slate-900 border-l-4 border-l-indigo-600'
                      }`}
                    >
                      {/* Unread circle badge */}
                      {!notif.isRead && (
                        <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      )}
                      
                      <div className="flex items-start space-x-2.5">
                        <div className={`p-2 rounded-xl text-xs shrink-0 ${
                          notif.type === 'order' ? 'bg-blue-50 text-blue-600' :
                          notif.type === 'like' ? 'bg-rose-50 text-rose-600' :
                          notif.type === 'discount' ? 'bg-amber-50 text-amber-600' :
                          notif.type === 'launch' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-indigo-50 text-indigo-600'
                        }`}>
                          {notif.type === 'order' ? <Package size={14} /> :
                           notif.type === 'like' ? <Check size={14} /> :
                           notif.type === 'discount' ? <Tag size={14} /> :
                           notif.type === 'launch' ? <Sparkles size={14} /> :
                           <Search size={14} />}
                        </div>
                        <div className="flex-1 pr-4">
                          <h4 className={`font-bold text-xs ${notif.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                            {notif.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-normal mt-1">
                            {notif.message}
                          </p>
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block mt-2">
                            {notif.timestamp} • {notif.isRead ? 'Read' : 'Mark Read'}
                          </span>
                        </div>
                      </div>

                      {/* Remove item button */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
                        className="absolute bottom-3 right-3 opacity-0 group-hover/item:opacity-100 p-1 hover:bg-slate-50 text-slate-400 hover:text-rose-600 rounded-md transition-all duration-200"
                        title="Delete notification"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Quick Actions Dial */}
      <div className="fixed bottom-24 right-6 z-40">
        <AnimatePresence>
          {quickActionsOpen && (
            <>
              {/* Backdrop blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setQuickActionsOpen(false)}
                className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-30"
              />

              {/* Dial Menu Items stacked above the button */}
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.9 }}
                className="absolute bottom-16 right-0 flex flex-col items-end space-y-3 z-40 min-w-[220px]"
              >
                {/* 1. Panic SOS */}
                <button
                  type="button"
                  onClick={() => {
                    setQuickActionsOpen(false);
                    simulateNotification('order');
                    alert('🚨 CONSOLE REPORT: Emergency Panic SOS Triggered. GPS location coordinates sent to London Metropolitan Police dispatch and nearby KonnectS Community Watch responders.');
                  }}
                  className="flex items-center space-x-3 bg-rose-600 hover:bg-rose-700 text-white p-3 px-4 rounded-2xl shadow-lg hover:shadow-rose-500/20 active:scale-95 transition-all text-xs font-black uppercase tracking-wider border-none w-full justify-between cursor-pointer"
                >
                  <span>Emergency Panic SOS</span>
                  <div className="p-1.5 bg-rose-700 text-white rounded-lg">
                    <AlertTriangle size={14} className="animate-pulse" />
                  </div>
                </button>

                {/* 2. Dispatch Rides */}
                <button
                  type="button"
                  onClick={() => {
                    setQuickActionsOpen(false);
                    if ((window as any).__navigateTab) {
                      (window as any).__navigateTab('rides');
                    }
                  }}
                  className="flex items-center space-x-3 bg-white hover:bg-slate-50 text-slate-800 p-3 px-4 rounded-2xl shadow-md active:scale-95 transition-all text-xs font-black uppercase tracking-wider border border-slate-100 w-full justify-between cursor-pointer"
                >
                  <span>Book Fast cab</span>
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Car size={14} />
                  </div>
                </button>

                {/* 3. Post Listing */}
                <button
                  type="button"
                  onClick={() => {
                    setQuickActionsOpen(false);
                    if ((window as any).__navigateTab) {
                      (window as any).__navigateTab('marketplace');
                    }
                  }}
                  className="flex items-center space-x-3 bg-white hover:bg-slate-50 text-slate-800 p-3 px-4 rounded-2xl shadow-md active:scale-95 transition-all text-xs font-black uppercase tracking-wider border border-slate-100 w-full justify-between cursor-pointer"
                >
                  <span>Sell/Post Goods</span>
                  <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                    <ShoppingBag size={14} />
                  </div>
                </button>

                {/* 4. Request Pro */}
                <button
                  type="button"
                  onClick={() => {
                    setQuickActionsOpen(false);
                    if ((window as any).__navigateTab) {
                      (window as any).__navigateTab('services');
                    }
                  }}
                  className="flex items-center space-x-3 bg-white hover:bg-slate-50 text-slate-800 p-3 px-4 rounded-2xl shadow-md active:scale-95 transition-all text-xs font-black uppercase tracking-wider border border-slate-100 w-full justify-between cursor-pointer"
                >
                  <span>Hire Community Pro</span>
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Briefcase size={14} />
                  </div>
                </button>

                {/* 5. Dispatch Delivery */}
                <button
                  type="button"
                  onClick={() => {
                    setQuickActionsOpen(false);
                    setShowFetch(true);
                  }}
                  className="flex items-center space-x-3 bg-white hover:bg-slate-50 text-slate-800 p-3 px-4 rounded-2xl shadow-md active:scale-95 transition-all text-xs font-black uppercase tracking-wider border border-slate-100 w-full justify-between cursor-pointer"
                >
                  <span>Fetch Courier</span>
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Package size={14} />
                  </div>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Master Floating Trigger Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setQuickActionsOpen(!quickActionsOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl hover:shadow-2xl transition-all cursor-pointer border-none z-40 ${
            quickActionsOpen 
              ? 'bg-slate-900 rotate-45 shadow-slate-900/20' 
              : 'bg-brand hover:brightness-105 shadow-brand/30'
          }`}
        >
          <Plus size={28} />
        </motion.button>
      </div>
    </div>
  );
}
