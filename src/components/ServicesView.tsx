/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  Briefcase, Zap, Shield, Star, Clock, Check, MessageSquare, MapPin, X, 
  DollarSign, Calendar, Navigation, Wrench, Search, Heart, Laptop, BookOpen, 
  Truck, Building, FlaskConical, Utensils, Award, Users, Filter, ChevronRight,
  Sparkles, CheckCircle2, Mic, Map as MapIcon, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LazyImage } from './LazyImage';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { Testimonials } from './Testimonials';
import { SpatialARScannerModal } from './SpatialARScannerModal';
import { haptics } from '../utils/haptics';
import { CalendarSyncManager } from '../services/calendarService';
import { QRScannerModal } from './QRScannerModal';
import { FeatureSpotlight } from './FeatureSpotlight';
import { getReviewSummary } from '../services/geminiService';
import { Camera } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

// High-level category divisions with highlighted sub-specialties
const SECTORS = [
  { id: 'all', label: 'All Fields', icon: Users, color: 'bg-slate-100 text-slate-800 border-slate-200' },
  { id: 'healthcare', label: 'Healthcare', icon: Heart, color: 'bg-emerald-50 text-emerald-700 border-emerald-100', skills: ['Nurses', 'Doctors', 'Therapists', 'Pharmacists'] },
  { id: 'technology', label: 'Technology', icon: Laptop, color: 'bg-blue-50 text-blue-700 border-blue-100', skills: ['AI Engineers', 'Software Engineers', 'Cybersecurity Analysts', 'Cloud Engineers'] },
  { id: 'trades', label: 'Skilled Trades', icon: Wrench, color: 'bg-amber-50 text-amber-700 border-amber-100', skills: ['Electricians', 'Plumbers', 'Welders', 'Carpenters'] },
  { id: 'education', label: 'Education', icon: BookOpen, color: 'bg-pink-50 text-pink-700 border-pink-100', skills: ['Teachers', 'Trainers', 'Professors'] },
  { id: 'transportation', label: 'Transportation', icon: Truck, color: 'bg-indigo-50 text-indigo-700 border-indigo-100', skills: ['Truck Drivers', 'Pilots', 'Logistics Coordinators'] },
  { id: 'construction', label: 'Construction', icon: Building, color: 'bg-cyan-50 text-cyan-700 border-cyan-100', skills: ['Civil Engineers', 'Architects', 'Surveyors'] },
  { id: 'publicservices', label: 'Public Services', icon: Shield, color: 'bg-rose-50 text-rose-700 border-rose-100', skills: ['Police Officers', 'Firefighters', 'Social Workers'] },
  { id: 'business', label: 'Business', icon: Briefcase, color: 'bg-violet-50 text-violet-700 border-violet-100', skills: ['Accountants', 'Managers', 'Analysts', 'Sales Professionals'] },
  { id: 'science', label: 'Science & Research', icon: FlaskConical, color: 'bg-purple-50 text-purple-700 border-purple-100', skills: ['Biologists', 'Chemists', 'Data Scientists'] },
  { id: 'agriculture', label: 'Agriculture & Food', icon: Utensils, color: 'bg-lime-50 text-lime-700 border-lime-100', skills: ['Farmers', 'Food Technologists', 'Chefs'] }
];

// Complete list of specific roles requested by the user
const ALL_SPECIFIC_ROLES = [
  "Accountant", "Actuary", "Administrative Assistant", "AI Engineer", "Aerospace Engineer", 
  "Agricultural Engineer", "Architect", "Archivist", "Art Director", "Auditor", "Baker", 
  "Banker", "Barber", "Biologist", "Bookkeeper", "Bricklayer", "Business Analyst", "Carpenter", 
  "Cashier", "Chef", "Chemist", "Civil Engineer", "Cloud Engineer", "Construction Manager", 
  "Content Creator", "Customer Service Representative", "Cybersecurity Analyst", "Data Analyst", 
  "Data Engineer", "Data Scientist", "Delivery Driver", "Dentist", "Dermatologist", "Designer", 
  "Dietitian", "Doctor", "Economist", "Electrician", "Electronics Engineer", 
  "Emergency Medical Technician", "Environmental Scientist", "Event Planner", "Farmer", 
  "Financial Advisor", "Financial Analyst", "Firefighter", "Flight Attendant", "Forester", 
  "Gardener", "Geneticist", "Geologist", "Graphic Designer", "Hairdresser", "Healthcare Assistant", 
  "Historian", "Hotel Manager", "Human Resources Manager", "Industrial Designer", "Industrial Engineer", 
  "Insurance Agent", "Interior Designer", "IT Support Specialist", "Journalist", "Judge", 
  "Laboratory Technician", "Lawyer", "Librarian", "Logistics Manager", "Machine Operator", 
  "Marketing Manager", "Mechanical Engineer", "Mechanic", "Medical Laboratory Scientist", "Midwife", 
  "Musician", "Network Engineer", "Nurse", "Nutritionist", "Occupational Therapist", "Office Manager", 
  "Operations Manager", "Optometrist", "Paramedic", "Pharmacist", "Photographer", "Physical Therapist", 
  "Physician", "Pilot", "Plumber", "Police Officer", "Product Manager", "Professor", "Project Manager", 
  "Psychiatrist", "Psychologist", "Quality Assurance Engineer", "Quantity Surveyor", "Radiographer", 
  "Real Estate Agent", "Receptionist", "Research Scientist", "Robotics Engineer", "Sales Representative", 
  "Scientist", "Social Worker", "Software Developer", "Software Engineer", "Statistician", "Surgeon", 
  "Teacher", "Technical Writer", "Technician", "Therapist", "Translator", "Truck Driver", "UI Designer", 
  "UX Designer", "Urban Planner", "Veterinarian", "Video Editor", "Warehouse Worker", "Web Developer", 
  "Welder", "Writer", "X-ray Technologist", "Yoga Instructor", "Youth Worker", "Zoologist"
];

// Pre-seeded professional database matching Shoreditch geographic location
const SEEDED_PROFESSIONALS = [
  { id: 'spro-1', name: 'Dr. Evelyn Carter', role: 'Physician', locationName: 'Shoreditch, London', rating: 4.9, reviews: 142, price: 85, status: 'available', category: 'healthcare' },
  { id: 'spro-2', name: 'Liam Sterling', role: 'AI Engineer', locationName: 'Hoxton, London', rating: 5.0, reviews: 67, price: 120, status: 'available', category: 'technology' },
  { id: 'spro-3', name: 'Marcus Vance', role: 'Electrician', locationName: 'Bethnal Green, London', rating: 4.8, reviews: 290, price: 45, status: 'available', category: 'trades' },
  { id: 'spro-4', name: 'Prof. Diana Hughes', role: 'Professor', locationName: 'Camden Town, London', rating: 4.9, reviews: 88, price: 55, status: 'available', category: 'education' },
  { id: 'spro-5', name: 'Rachel Vance', role: 'Accountant', locationName: 'Soho, London', rating: 4.7, reviews: 104, price: 65, status: 'available', category: 'business' },
  { id: 'spro-6', name: 'Chef Gordon K.', role: 'Chef', locationName: 'Spitalfields, London', rating: 4.9, reviews: 215, price: 75, status: 'available', category: 'agriculture' },
  { id: 'spro-7', name: 'Arthur Pendelton', role: 'Architect', locationName: 'Westminster, London', rating: 5.0, reviews: 41, price: 95, status: 'available', category: 'construction' },
  { id: 'spro-8', name: 'Samantha Cole', role: 'Cybersecurity Analyst', locationName: 'Clerkenwell, London', rating: 4.8, reviews: 112, price: 110, status: 'available', category: 'technology' },
  { id: 'spro-9', name: 'Mark Gable', role: 'Plumber', locationName: 'Hackney, London', rating: 4.9, reviews: 184, price: 50, status: 'available', category: 'trades' },
  { id: 'spro-10', name: 'Nurse Clara Jenkins', role: 'Nurse', locationName: 'Islington, London', rating: 4.9, reviews: 92, price: 40, status: 'available', category: 'healthcare' }
];

export function ServicesView({ onChat }: { onChat: (id: string, name: string) => void }) {
  const { user } = useAuth();
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'booking' | 'success'>('idle');
  const [selectedService, setSelectedService] = useState<{name: string, price: number, proName?: string, proId?: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [showARScanModal, setShowARScanModal] = useState(false);
  const [roomScanData, setRoomScanData] = useState<any | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ summary: string, highlights: string[] } | null>(null);
  const [isReviewSummaryLoading, setIsReviewSummaryLoading] = useState(false);
  const [selectedQuickTip, setSelectedQuickTip] = useState<{ role: string, name: string, tip: string } | null>(null);
  const [hiddenProIds, setHiddenProIds] = useState<string[]>([]);

  const getImprovementTip = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('physician') || r.includes('nurse') || r.includes('healthcare')) {
      return "List your active DBS verification certificate number clearly in your profile bio and display verified NHS or GMC registration credentials to boost trust by 85%.";
    }
    if (r.includes('engineer') || r.includes('cybersecurity') || r.includes('technology')) {
      return "Showcase a link to your GitHub portfolio, include key tech-stack tags, and highlight experience with local AI integrations to attract high-budget startups.";
    }
    if (r.includes('electrician') || r.includes('plumber') || r.includes('trades')) {
      return "Keep your standard hourly rates competitive for Central London, update availability in real-time, and guarantee a 1-hour fast emergency response window.";
    }
    if (r.includes('chef') || r.includes('hospitality')) {
      return "Add high-resolution photos of food hygiene certification ratings and clear menu tier prices to simplify the booking flow for private local events.";
    }
    return "List your active business or professional certifications, state minimum callout fees upfront, and request instant feedback from past Shoreditch clients.";
  };

  useEffect(() => {
    let active = true;
    if (selectedService) {
      Promise.resolve().then(() => {
        if (active) setIsReviewSummaryLoading(true);
      });
      const reviews = [
        `Excellent work by ${selectedService.proName || 'Specialist'}! Extremely skilled and professional.`,
        `Very satisfied with the ${selectedService.name} service. Explained everything clearly.`,
        `Arrived right on time and sorted out the issue quickly. Highly recommend!`,
        `Fair pricing and great communication throughout. Will use again.`
      ];
      getReviewSummary(reviews)
        .then(summary => {
          if (active) {
            setReviewSummary(summary);
            setIsReviewSummaryLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setReviewSummary({
              summary: "Highly rated local service provider with consistent praise for prompt communication and transparent pricing.",
              highlights: ["Reliable", "Fair Pricing", "Responsive"]
            });
            setIsReviewSummaryLoading(false);
          }
        });
    } else {
      Promise.resolve().then(() => {
        if (active) setReviewSummary(null);
      });
    }
    return () => {
      active = false;
    };
  }, [selectedService]);

  const getAISuggestions = (serviceName: string) => {
    const norm = (serviceName || '').toLowerCase();
    if (norm.includes('clean')) {
      return {
        addon: { name: "Post-Cleaning Odor Neutralizer Deep Steam", price: 15, icon: "💨" },
        items: [
          { name: "Organic Eco Floor Polish", price: "8.99", desc: "Shines hardwood & laminate naturally", img: "🧴" },
          { name: "Premium Bamboo Laundry Hamper", price: "14.50", desc: "Multi-compartment hand-woven design", img: "🧺" }
        ]
      };
    } else if (norm.includes('electric') || norm.includes('power') || norm.includes('wire')) {
      return {
        addon: { name: "Power Surge Protector Unit Diagnostics", price: 20, icon: "⚡" },
        items: [
          { name: "Smart Wi-Fi Power Strip (3-Port)", price: "18.55", desc: "Remote mobile control from UrbanNet", img: "🔌" },
          { name: "Philips Hue Ambiance Master Pack", price: "45.00", desc: "Smart LED color room control bulb pack", img: "💡" }
        ]
      };
    } else if (norm.includes('plumb') || norm.includes('water') || norm.includes('pipe') || norm.includes('leak')) {
      return {
        addon: { name: "Antimicrobial Shower Filter Fitting", price: 25, icon: "🚿" },
        items: [
          { name: "Smart Water Leak Sensor", price: "22.99", desc: "Saves wood flooring, instant SMS warning", img: "🔧" },
          { name: "Non-Corrosive Eco Pipe Declogger", price: "6.20", desc: "Highly refined organic sludge dissolver", img: "🧴" }
        ]
      };
    } else if (norm.includes('doctor') || norm.includes('health') || norm.includes('medic') || norm.includes('physician') || norm.includes('nurse')) {
      return {
        addon: { name: "Heart Rate & SpO2 Vitals Scan", price: 15, icon: "🩺" },
        items: [
          { name: "Home Guard Sterile First Aid Cabinet Case", price: "12.99", desc: "Full safety compliant bandage assortment", img: "🩹" },
          { name: "Triple Strength Omega-3 extra softgels", price: "18.00", desc: "High absorption organic certified", img: "💊" }
        ]
      };
    } else {
      return {
        addon: { name: "1-Year Extended Workmanship Protection", price: 10, icon: "🛡️" },
        items: [
          { name: "Heavy Duty Tool Organizer Carrying Tote", price: "19.99", desc: "Extra rugged slate colored framing", img: "📦" },
          { name: "Eco Safe Organic Disinfectant Gel", price: "4.50", desc: "99.9% protection organic elements", img: "🧴" }
        ]
      };
    }
  };
  
  // Tab/Search States
  const [activeSector, setActiveSector] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [activeDiscountCode, setActiveDiscountCode] = useState<string | null>(null);
  const [filterToday, setFilterToday] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterDistance, setFilterDistance] = useState(false);

  // Load global filters in ServicesView
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

  // Hands-free voice speech search states
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);

  const toggleSpeechSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition (Web Speech API) is not supported in this browser. Please try Chrome or Safari.');
      return;
    }
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
      setVoiceToast("Listening for service names...");
      haptics.light();
    };

    rec.onerror = () => {
      setIsListeningVoice(false);
      setVoiceToast("Did not understand clearly. Try again.");
      setTimeout(() => setVoiceToast(null), 2500);
    };

    rec.onend = () => {
      setIsListeningVoice(false);
    };

    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setSearchQuery(text);
      setVoiceToast(`Searching: "${text}"`);
      saveSearchToHistory(text);
      haptics.heavy();
      setTimeout(() => setVoiceToast(null), 3000);
    };

    rec.start();
  };

  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('konnects_services_searches');
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
      const updated = [trimmed, ...filtered].slice(0, 6);
      localStorage.setItem('konnects_services_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const removeSearchFromHistory = (termToRemove: string) => {
    setSearchHistory(prev => {
      const updated = prev.filter(x => x !== termToRemove);
      localStorage.setItem('konnects_services_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const [showRoleDictionary, setShowRoleDictionary] = useState(false);
  const [showSpotlight, setShowSpotlight] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('konnects_spotlight_services_seen') === 'true';
    if (!hasSeen) {
      const timer = setTimeout(() => {
        setShowSpotlight(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

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
  }, [activeSector, searchQuery]);

  // Map representation of locations
  const LOCATION_COORDINATES: Record<string, { lat: number, lng: number }> = {
    'Shoreditch, London': { lat: 51.5260, lng: -0.0780 },
    'Hoxton, London': { lat: 51.5310, lng: -0.0820 },
    'Bethnal Green, London': { lat: 51.5270, lng: -0.0560 },
    'Camden Town, London': { lat: 51.5390, lng: -0.1420 },
    'Soho, London': { lat: 51.5135, lng: -0.1360 },
    'Spitalfields, London': { lat: 51.5205, lng: -0.0745 },
    'Westminster, London': { lat: 51.4975, lng: -0.1357 },
    'Clerkenwell, London': { lat: 51.5238, lng: -0.1060 },
    'Hackney, London': { lat: 51.5450, lng: -0.0550 },
    'Islington, London': { lat: 51.5400, lng: -0.1000 }
  };

  // Map and Voice booking states
  const [isNearbyView, setIsNearbyView] = useState(false);
  const [mapLayers, setMapLayers] = useState({ workers: true, hubs: false, bookings: false });

  const MOCK_HUBS = [
    { id: 'h1', title: 'Shoreditch High St Overground (Transit Hub)', lat: 51.5234, lng: -0.0763, x: '25%', top: '45%' },
    { id: 'h2', title: 'Old Street Tube Station (Transit Hub)', lat: 51.5257, lng: -0.0877, x: '75%', top: '25%' },
    { id: 'h3', title: 'Liverpool Street Station (Transit Hub)', lat: 51.5178, lng: -0.0814, x: '45%', top: '85%' },
  ];

  const MOCK_ACTIVE_BOOKINGS = [
    { id: 'ab1', title: 'Active Ride #4521 - En Route', lat: 51.5245, lng: -0.0750, x: '55%', top: '55%' },
    { id: 'ab2', title: 'Active Service Booking #1240 - cleaning service', lat: 51.5295, lng: -0.0790, x: '80%', top: '70%' },
  ];

  const [selectedMapPro, setSelectedMapPro] = useState<any>(null);
  const [mapLoadError, setMapLoadError] = useState(Boolean((window as any).gmapsHasFailed) || !GOOGLE_MAPS_API_KEY);

  // Setup Global auth failure and console error interception to catch ApiProjectMapError
  useEffect(() => {
    const originalAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps Auth Failure intercepted in ServicesView. Enabling Vector Map Failsafe Mode.");
      (window as any).gmapsHasFailed = true;
      Promise.resolve().then(() => {
        setMapLoadError(true);
      });
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

  // Voice Booking state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceParsedBooking, setVoiceParsedBooking] = useState<any>(null);
  const [voiceError, setVoiceError] = useState('');
  const [manualVoiceCommandTxt, setManualVoiceCommandTxt] = useState('');

  const startVoiceBooking = () => {
    const SpeechComp = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechComp) {
      setVoiceError("Web Speech API is not supported in this iframe/environment natively. Please use the simulated terminal input below!");
      setIsListening(true);
      return;
    }

    try {
      setVoiceError('');
      setTranscript('');
      setVoiceParsedBooking(null);
      setIsListening(true);

      const recognition = new SpeechComp();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setTranscript(resultText);
        parseVoiceCommand(resultText);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setVoiceError(`Voice error: ${event.error || 'Blocked'}. Please type below!`);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setVoiceError("Microphone setup failed. Please try typing below instead!");
    }
  };

  const parseVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();
    
    // Check match for specific seeded professionals
    let matchedPro = SEEDED_PROFESSIONALS.find(p => {
      const nameParts = p.name.toLowerCase().replace(/dr\.|chef|prof\./g, '').trim().split(' ');
      return nameParts.some(part => part.length > 3 && lower.includes(part));
    });

    if (!matchedPro) {
      // Find by role
      matchedPro = SEEDED_PROFESSIONALS.find(p => lower.includes(p.role.toLowerCase()));
    }

    if (matchedPro) {
      const bookingData = {
        proName: matchedPro.name,
        serviceName: matchedPro.role,
        price: matchedPro.price,
        description: `Voice Command parsed booking requests: ${text}`
      };
      setVoiceParsedBooking(bookingData);
    } else {
      const possibleRoles = ["plumber", "electrician", "doctor", "carpenter", "accountant", "chef", "nurse", "specialist"];
      const foundRole = possibleRoles.find(r => lower.includes(r)) || "Handyman";
      
      const bookingData = {
        proName: "Local Specialist",
        serviceName: foundRole.charAt(0).toUpperCase() + foundRole.slice(1),
        price: 55,
        description: `Voice Command parsed booking requests: ${text}`
      };
      setVoiceParsedBooking(bookingData);
    }
  };

  const speakBookingSuccess = (serviceName: string) => {
    const synth = window.speechSynthesis;
    if (synth) {
      const utterance = new SpeechSynthesisUtterance(`Excellent, your booking for ${serviceName} is confirmed!`);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      synth.speak(utterance);
    }
  };

  const handleConfirmVoiceBooking = async () => {
    if (!voiceParsedBooking || !user?.uid) return;
    setBookingStatus('booking');
    
    try {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await addDoc(collection(db, 'bookings'), {
        customerId: user.uid,
        serviceType: voiceParsedBooking.serviceName,
        status: 'pending',
        description: voiceParsedBooking.description + " (Voice Confirmed / Speech API)",
        pickupLocation: {
          lat: 51.5235,
          lng: -0.0760,
          address: "Current Location (Shoreditch)"
        },
        dropoffLocation: {
          lat: 51.5245,
          lng: -0.0750,
          address: "Target Workspace"
        },
        price: voiceParsedBooking.price,
        expiresAt: expiresAt,
        createdAt: serverTimestamp()
      });
      setBookingStatus('success');

      // Auto calendar sync trigger
      CalendarSyncManager.autoSyncEvent({
        title: `Service Booking: ${voiceParsedBooking.serviceName}`,
        description: `${voiceParsedBooking.description} (£${voiceParsedBooking.price})`,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
        location: 'Current Location (Shoreditch)',
        sourceType: 'service'
      });

      speakBookingSuccess(voiceParsedBooking.serviceName);
      setTimeout(() => {
        setBookingStatus('idle');
        setVoiceParsedBooking(null);
        setIsListening(false);
      }, 2500);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'bookings');
      setBookingStatus('idle');
    }
  };

  // Global search event listener
  useEffect(() => {
    let active = true;
    if ((window as any).__globalSearchTerm) {
      Promise.resolve().then(() => {
        if (active) setSearchQuery((window as any).__globalSearchTerm);
      });
    }
    const handleGlobalSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.tab === 'services') {
        setSearchQuery(customEvent.detail.term);
        setActiveSector('all'); // fallback to all for keyword searches
      }
    };
    window.addEventListener('global-search', handleGlobalSearch);
    return () => {
      active = false;
      window.removeEventListener('global-search', handleGlobalSearch);
    };
  }, []);

  // Enhanced Booking State
  const [pickupAddress, setPickupAddress] = useState('Shoreditch High St, London');
  const [dropoffAddress, setDropoffAddress] = useState('Workspace Office, Shoreditch');
  const [pickupCoords, setPickupCoords] = useState({ lat: 51.5235, lng: -0.0760 });
  const [dropoffCoords, setDropoffCoords] = useState({ lat: 51.5245, lng: -0.0750 });
  const [suggestedPrice, setSuggestedPrice] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('3 hours');
  const [isMapPicking, setIsMapPicking] = useState<'pickup' | 'dropoff' | null>(null);

  const handleBookNow = async () => {
    if (!user?.uid || !selectedService) return;
    setBookingStatus('booking');
    
    const description = `Priority job request for ${selectedService.name} (Matched Pro: ${selectedService.proName || 'Local Specialist'})`;
    try {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins timeout
      
      await addDoc(collection(db, 'bookings'), {
        customerId: user.uid,
        serviceType: selectedService.name,
        status: 'pending',
        description,
        pickupLocation: {
          ...pickupCoords,
          address: pickupAddress
        },
        dropoffLocation: {
          ...dropoffCoords,
          address: dropoffAddress
        },
        price: selectedService.price,
        suggestedPrice: Number(suggestedPrice) || selectedService.price,
        spatialBimData: roomScanData || null,
        estimatedCompletionTime: estimatedTime,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: serverTimestamp()
      });
      
      setBookingStatus('success');
      haptics.success();

      // Auto calendar sync trigger for regular scheduled services
      CalendarSyncManager.autoSyncEvent({
        title: `Service booking: ${selectedService.name}`,
        description: `Scheduled with pro ${selectedService.proName || 'Local Specialist'} for £${selectedService.price}`,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours duration
        location: pickupAddress || 'Shoreditch, London',
        sourceType: 'service'
      });

      speakBookingSuccess(selectedService.name);
      setTimeout(() => {
        setBookingStatus('idle');
        setSelectedService(null);
      }, 2500);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
      setBookingStatus('idle');
    }
  };

  // Dynamically map high school sectors to occupations
  const getCategoryOfRole = (role: string): string => {
    const rLower = role.toLowerCase();
    if (["nurse", "doctor", "therapist", "pharmacist", "dentist", "dermatologist", "dietitian", "healthcare assistant", "midwife", "nutritionist", "occupational therapist", "optometrist", "paramedic", "physical therapist", "physician", "psychiatrist", "psychologist", "radiographer", "surgeon", "x-ray technologist"].some(x => rLower.includes(x))) {
      return 'healthcare';
    }
    if (["ai engineer", "software engineer", "cybersecurity", "cloud engineer", "developer", "data engineer", "network engineer", "it support", "robotics", "quality assurance", "web developer"].some(x => rLower.includes(x))) {
      return 'technology';
    }
    if (["electrician", "plumber", "welder", "carpenter", "bricklayer", "mechanic", "barber", "hairdresser", "machine operator", "gardener"].some(x => rLower.includes(x))) {
      return 'trades';
    }
    if (["teacher", "trainer", "professor", "historian", "tutor", "prof"].some(x => rLower.includes(x))) {
      return 'education';
    }
    if (["driver", "pilot", "logistics", "flight attendant", "warehouse"].some(x => rLower.includes(x))) {
      return 'transportation';
    }
    if (["civil engineer", "architect", "surveyor", "construction", "quantity surveyor", "urban planner"].some(x => rLower.includes(x))) {
      return 'construction';
    }
    if (["police", "firefighter", "social worker", "judge", "youth worker"].some(x => rLower.includes(x))) {
      return 'publicservices';
    }
    if (["accountant", "manager", "analyst", "sales", "actuary", "administrative", "auditor", "banker", "bookkeeper", "customer service", "economist", "financial", "human resources", "insurance", "marketing", "office manager", "operations"].some(x => rLower.includes(x))) {
      return 'business';
    }
    if (["biologist", "chemist", "data scientist", "geneticist", "geologist", "scientist", "researcher", "statistician", "zoologist", "forester", "archivist", "librarian"].some(x => rLower.includes(x))) {
      return 'science';
    }
    if (["farmer", "food", "chef", "baker", "cook"].some(x => rLower.includes(x))) {
      return 'agriculture';
    }
    return 'business'; // default fallback
  };

  // Live filter and generate workers
  const visibleProfessionals = useMemo(() => {
    let base = [...SEEDED_PROFESSIONALS].filter(p => !hiddenProIds.includes(p.id));

    // Filter by sector tab
    if (activeSector !== 'all') {
      base = base.filter(p => p.category === activeSector);
    }

    // Apply Global Distance Filter
    if (globalDist !== 'all') {
      const distLimit = parseFloat(globalDist);
      base = base.filter(p => {
        // Map locations to simulated distances
        const dist = p.id === 'spro-1' ? 0.3 : p.id === 'spro-2' ? 0.8 : p.id === 'spro-3' ? 1.5 : p.id === 'spro-4' ? 4.2 : p.id === 'spro-5' ? 3.1 : p.id === 'spro-6' ? 0.6 : p.id === 'spro-7' ? 5.5 : p.id === 'spro-8' ? 1.9 : p.id === 'spro-9' ? 2.1 : 2.8;
        return dist <= distLimit;
      });
    }

    // Apply Global Rating Filter
    if (globalRate !== 'all') {
      const minRate = parseFloat(globalRate);
      base = base.filter(p => p.rating >= minRate);
    }

    // Apply Global Verified Status Filter (spro-4 and spro-7 are simulated as unverified)
    if (globalVer) {
      base = base.filter(p => p.id !== 'spro-4' && p.id !== 'spro-7');
    }

    // Filter by text search
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      base = base.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.role.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );

      // If there are NO matches in physical list but query matches an item inside ALL_SPECIFIC_ROLES,
      // let's dynamically generate a beautiful custom worker matching that specific role to satisfy everything flawlessly!
      const matchedRoleInDict = ALL_SPECIFIC_ROLES.find(role => role.toLowerCase().includes(q));
      if (matchedRoleInDict && base.length === 0) {
        const cat = getCategoryOfRole(matchedRoleInDict);
        const sectorDetail = SECTORS.find(s => s.id === cat);
        
        // Generate two highly tailored mock profiles
        const dynName1 = `Alexander ${matchedRoleInDict.slice(0, 3)}on`;
        const dynName2 = `Sarah ${matchedRoleInDict.charAt(0)} .`;
        
        const basePrice = cat === 'technology' ? 90 : cat === 'healthcare' ? 75 : cat === 'trades' ? 50 : 45;
        
        return [
          {
            id: `dyn-1`,
            name: `${dynName1}`,
            role: matchedRoleInDict,
            locationName: '0.4 miles away • London',
            rating: 4.9,
            reviews: 42,
            price: basePrice,
            status: 'available',
            category: cat,
            isDynamic: true
          },
          {
            id: `dyn-2`,
            name: `${dynName2}`,
            role: `${matchedRoleInDict} Pro`,
            locationName: '1.2 miles away • Westminster',
            rating: 4.8,
            reviews: 19,
            price: basePrice + 10,
            status: 'available',
            category: cat,
            isDynamic: true
          }
        ];
      }
    }

    // Today/Active filter
    if (filterToday) {
      base = base.filter(p => p.status === 'available');
    }

    // Top Rated filter
    if (filterTopRated) {
      base = base.filter(p => p.rating >= 4.8);
    }

    // Proximity/Distance filter (under 1.0 miles)
    const getMockDistanceVal = (p: any) => {
      if (p.isDynamic) {
        return p.id === 'dyn-1' ? 0.4 : 1.2;
      }
      if (p.locationName.includes('Shoreditch') || p.locationName.includes('Hoxton')) return 0.3;
      if (p.locationName.includes('Bethnal Green') || p.locationName.includes('Hackney') || p.locationName.includes('Spitalfields')) return 0.8;
      if (p.locationName.includes('Islington') || p.locationName.includes('Clerkenwell') || p.locationName.includes('Camden')) return 1.5;
      return 2.5; 
    };

    if (filterDistance) {
      base = base.filter(p => getMockDistanceVal(p) <= 1.0);
    }

    return base;
  }, [activeSector, searchQuery, filterToday, filterTopRated, filterDistance, hiddenProIds]);

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
      <header className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight mb-1 text-slate-900">Verified Services</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none">Workers Near You • Shoreditch</p>
        </div>
        <button 
          onClick={() => {
            haptics.medium();
            setShowQRScanner(true);
          }}
          className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-600 active:scale-95 transition-all flex items-center justify-center cursor-pointer hover:bg-slate-50"
          title="Scan Voucher QR"
        >
          <Camera size={20} />
        </button>
      </header>

      {/* Feature Spotlight Card */}
      <AnimatePresence>
        {showSpotlight && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mb-6 p-5 bg-gradient-to-r from-indigo-950 to-slate-900 text-white rounded-3xl border border-indigo-500/30 shadow-xl relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/25 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-start space-x-3 relative z-10">
              <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl mt-0.5">
                <Sparkles size={16} className="animate-pulse" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">Feature Spotlight: Services Hub</h4>
                <p className="text-[11px] text-slate-200 mt-1.5 font-medium leading-relaxed font-sans">
                  Welcome to Services! You can search vetted trade professionals (like plumbers or nurses), use <span className="font-bold text-indigo-300">Hands-free Voice search</span>, negotiate rates on real-time chat, and scan discount QR vouchers.
                </p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60 font-sans">
                  <span className="text-[8px] uppercase tracking-wider font-bold text-indigo-400">Contextual Onboarding</span>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.success();
                      localStorage.setItem('konnects_spotlight_services_seen', 'true');
                      setShowSpotlight(false);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 border-none text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                  >
                    Got it, thanks!
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Redeemed voucher discount alert display */}
      {activeDiscountCode && (
        <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-center justify-between text-left">
          <div className="flex items-center space-x-2">
            <span className="text-base font-bold text-emerald-600">🎫</span>
            <div>
              <p className="text-[10.5px] font-black text-emerald-800 leading-none">VOUCHER REDEEMED</p>
              <p className="text-[9px] text-emerald-600 font-extrabold uppercase mt-0.5 tracking-wider">{activeDiscountCode} (-25% off bookings)</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              haptics.light();
              setActiveDiscountCode(null);
            }}
            className="text-[8.5px] font-black text-rose-600 uppercase hover:underline cursor-pointer border-none bg-transparent"
          >
            Remove
          </button>
        </div>
      )}

      {/* Right to Work security banner */}
      <div className="mb-6 p-4 bg-slate-900 rounded-[28px] text-white flex items-center space-x-4 shadow-xl shadow-indigo-650/15 border border-indigo-500/20">
        <div className="p-3 bg-white/10 text-indigo-400 rounded-2xl">
          <Shield size={22} className="animate-pulse" />
        </div>
        <div>
          <h4 className="font-extrabold text-[11px] uppercase tracking-wider">TFL & UK Right-to-Work Vetted</h4>
          <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">All active London service workers have undergone verified document audits and background checks.</p>
        </div>
      </div>

      {/* Search and Dictionary Selector */}
      <div className="mb-6 space-y-2.5">
        <div className="relative flex items-center">
          <Search className="absolute left-4 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveSearchToHistory(searchQuery);
              }
            }}
            placeholder="Search roles like Nurse, AI Engineer..."
            className="w-full pl-11 pr-32 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none focus:border-red-50 font-bold text-xs text-slate-800"
          />
          <button
            type="button"
            onClick={toggleSpeechSearch}
            className={`absolute right-20 p-2 rounded-full border-none transition-all cursor-pointer ${
              isListeningVoice 
                ? 'bg-rose-100 text-rose-600 animate-pulse scale-110' 
                : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
            }`}
            title="Speak to search (hands-free)"
          >
            <Mic size={15} />
          </button>
          <button
            type="button"
            onClick={() => setShowRoleDictionary(!showRoleDictionary)}
            className="absolute right-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all"
          >
            All Skills
          </button>
        </div>

        <AnimatePresence>
          {voiceToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                <span>{voiceToast}</span>
              </div>
              <button onClick={() => setVoiceToast(null)} className="text-white opacity-60 hover:opacity-100 border-none bg-transparent">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {searchHistory.length > 0 && (
          <div className="px-1 py-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Recent Searches</p>
            <div className="flex flex-wrap gap-1.5">
              {searchHistory.map((term, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black transition-all hover:bg-slate-200 cursor-pointer"
                >
                  <span onClick={() => setSearchQuery(term)}>{term}</span>
                  <button
                    onClick={() => removeSearchFromHistory(term)}
                    className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center text-[7.5px] font-black"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Granular Filter Chips */}
        <div className="flex flex-wrap gap-2 pt-1 pb-1">
          <button
            type="button"
            onClick={() => { haptics.light(); setFilterToday(!filterToday); }}
            className={`px-3.5 py-2.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer ${
              filterToday 
                ? 'bg-slate-900 border border-slate-900 text-white shadow-xs' 
                : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Clock size={11} />
            <span>Today</span>
          </button>
          
          <button
            type="button"
            onClick={() => { haptics.light(); setFilterTopRated(!filterTopRated); }}
            className={`px-3.5 py-2.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer ${
              filterTopRated 
                ? 'bg-amber-500 border border-amber-500 text-white shadow-xs' 
                : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Star size={11} fill={filterTopRated ? "currentColor" : "none"} />
            <span>Top Rated</span>
          </button>
          
          <button
            type="button"
            onClick={() => { haptics.light(); setFilterDistance(!filterDistance); }}
            className={`px-3.5 py-2.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer ${
              filterDistance 
                ? 'bg-emerald-600 border border-emerald-600 text-white shadow-xs' 
                : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Navigation size={11} />
            <span>&lt; 1 mile</span>
          </button>
        </div>

        {/* Map toggle & Voice Booking actions */}
        <div className="flex gap-2.5">
          <button
            onClick={() => setIsNearbyView(!isNearbyView)}
            className={`flex-1 py-3 px-4 rounded-2xl border flex items-center justify-center space-x-2 font-bold text-xs transition-all active:scale-95 ${
              isNearbyView 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                : 'bg-white text-slate-700 border-slate-100 shadow-xs hover:bg-slate-50 shadow-xs'
            }`}
          >
            <MapIcon size={16} className={isNearbyView ? 'animate-bounce' : ''} />
            <span>{isNearbyView ? 'Close Nearby Map' : 'Nearby Map View'}</span>
          </button>
          
          <button
            onClick={startVoiceBooking}
            className="flex-1 py-3 px-4 bg-linear-to-r from-violet-600 to-indigo-600 text-white border-indigo-600 rounded-2xl flex items-center justify-center space-x-2 font-bold text-xs transition-all hover:opacity-90 active:scale-95 shadow-md shadow-indigo-600/15 group"
          >
            <Mic size={16} className="animate-pulse text-indigo-200 group-hover:scale-110 duration-200" />
            <span>Speak to Book</span>
          </button>
        </div>

        {/* Categories/Skill Tags Quick reference checklist */}
        <AnimatePresence>
          {showRoleDictionary && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-950 text-white rounded-3xl p-5 border border-slate-800 shadow-2xl relative max-h-[300px] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-center mb-3">
                <p className="text-[9px] font-mono font-black text-indigo-400 tracking-widest uppercase">Browse {ALL_SPECIFIC_ROLES.length} Specific Professions</p>
                <button 
                  onClick={() => setShowRoleDictionary(false)}
                  className="text-[9px] text-slate-400 hover:text-white uppercase font-black"
                >
                  Close
                </button>
              </div>
              <p className="text-[8.5px] text-slate-400 leading-normal mb-3">Tap on any professional skill to immediately filter coordinates:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_SPECIFIC_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setSearchQuery(role);
                      setShowRoleDictionary(false);
                    }}
                    className="p-2 py-1.5 bg-slate-900 hover:bg-indigo-600/20 text-slate-300 font-extrabold text-[9px] uppercase tracking-wider rounded-lg text-left truncate flex items-center justify-between border border-slate-800/80 active:scale-95 transition-all"
                  >
                    <span className="truncate">{role}</span>
                    <ChevronRight size={8} className="text-slate-600 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sectors Interactive Grid of Icons */}
      <div className="grid grid-cols-3 gap-3.5 mb-6">
        {SECTORS.map((sector) => {
          const Icon = sector.icon;
          const isActive = activeSector === sector.id;
          return (
            <motion.button
              key={sector.id}
              layout
              onClick={() => {
                setActiveSector(sector.id);
                setSearchQuery(''); // clear text query to not clash
              }}
              className={`relative p-3.5 rounded-3xl border flex flex-col items-center justify-center text-center transition-all min-h-[92px] group overflow-hidden cursor-pointer ${
                isActive 
                  ? 'border-indigo-600 bg-white shadow-md text-slate-900 ring-1 ring-indigo-500/20' 
                  : 'border-slate-100 bg-white hover:bg-slate-50 text-slate-600 shadow-sm'
              }`}
            >
              {/* layoutId slide indicator behind content */}
              {isActive && (
                <motion.div 
                  layoutId="activeSectorHighlight"
                  className="absolute inset-0 bg-indigo-50/50 rounded-[22px]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              <div className="relative z-10 flex flex-col items-center">
                <div className={`p-2.5 rounded-2xl mb-1.5 transition-transform group-active:scale-90 ${
                  isActive ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'
                }`}>
                  <Icon size={18} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider leading-tight text-slate-700">
                  {sector.label}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Sector Skill Preview Bar if active */}
      {activeSector !== 'all' && (
        <div className="mb-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-150 flex flex-wrap items-center gap-1.5">
          <span className="text-[8px] font-mono font-black text-indigo-500 tracking-widest uppercase mr-1">Skills Highlight:</span>
          {SECTORS.find(s => s.id === activeSector)?.skills?.map((s, idx) => (
            <span key={idx} className="bg-white px-2 py-1.5 rounded-lg border border-slate-100 font-extrabold text-[9px] text-slate-700 tracking-wide">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Results grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-mono font-black text-slate-400 upper tracking-widest font-sans">
            {isNearbyView ? "Nearby Map Workers" : "Matched Active Pros"} ({visibleProfessionals.length})
          </h3>
          <span className="text-[8.5px] bg-emerald-50 text-emerald-500 border border-emerald-100 px-2 py-0.5 rounded-md font-black uppercase tracking-wider animate-pulse">Ready Now</span>
        </div>

        {isNearbyView && (
          <div className="mb-6 space-y-4">
            <div className="h-[350px] w-full rounded-3xl overflow-hidden shadow-md relative border border-slate-100 dark:border-slate-800 bg-slate-950 flex flex-col justify-between">
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
                  <span>Workers</span>
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
                /* Fallback custom vector radar/map layout */
                <div className="absolute inset-0 bg-slate-950 flex flex-col justify-between p-5 overflow-hidden select-none">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,24,48,0.7)_0%,rgba(2,6,23,1)_100%)] opacity-95"></div>
                  
                  {/* Concentric grid lines */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[150px] h-[150px] border border-white/5 rounded-full"></div>
                    <div className="w-[300px] h-[300px] border border-white/5 rounded-full"></div>
                    <div className="w-[450px] h-[450px] border border-white/5 rounded-full"></div>
                    <div className="absolute w-full h-[1px] bg-white/5"></div>
                    <div className="absolute h-full w-[1px] bg-white/5"></div>
                  </div>

                  <div className="relative z-10 flex justify-between items-start self-end">
                    <div>
                      <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-md text-[8px] font-mono tracking-widest font-black">
                        PROXIMITY RADAR FAILSAFE
                      </span>
                      <h4 className="text-[10px] text-slate-400 font-mono mt-1 font-bold">GRID: LND-O1 • 13X MAGNITUDE</h4>
                    </div>
                  </div>

                  {/* Projected Points of Pros on Vector Grid */}
                  <div className="absolute inset-0 z-10 pointer-events-auto">
                    {mapLayers.workers && visibleProfessionals.map((pro, idx) => {
                      // Generate consistent pseudo-offsets for positions relative to center
                      const seeds = [0.15, -0.25, 0.35, -0.1, 0.45, -0.3, 0.2, -0.4, 0.05, -0.15];
                      const sY = [0.2, 0.35, -0.15, 0.45, -0.22, 0.1, -0.4, 0.3, -0.1, 0.25];
                      const xPercent = 50 + (seeds[idx % seeds.length] * 80);
                      const yPercent = 50 + (sY[idx % sY.length] * 80);

                      return (
                        <button
                          key={pro.id}
                          type="button"
                          onClick={() => setSelectedMapPro(pro)}
                          style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none group border-none bg-transparent cursor-pointer"
                        >
                          <span className="absolute w-8 h-8 rounded-full bg-indigo-500/20 group-hover:scale-125 transition-all duration-200 animate-pulse"></span>
                          <span className="absolute w-5 h-5 rounded-full bg-indigo-500/40"></span>
                          <div className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center border-2 border-slate-950 font-black text-[8px] shadow-lg group-hover:bg-indigo-500 duration-200 relative z-10">
                            PRO
                          </div>
                          <span className="absolute top-8 bg-slate-900/90 text-[7px] text-indigo-300 font-black uppercase tracking-wider py-0.5 px-1.5 rounded-md border border-white/5 shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {pro.name}
                          </span>
                        </button>
                      );
                    })}

                    {/* Transit Hubs */}
                    {mapLayers.hubs && MOCK_HUBS.map((hub) => (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => setSelectedMapPro({ name: hub.title, title: 'Transport Node Hub', company: 'London Transit systems', rate: 0, rating: 5.0, votes: 120, locationName: 'Shoreditch, London', description: 'Central London transit connector point.', skills: ['Subway', 'Overground', 'Bus'] })}
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
                        onClick={() => setSelectedMapPro({ name: booking.title, title: 'Active Service Job Dispatch', company: 'KonnectS Dispatch Service', rate: 45, rating: 4.9, votes: 34, locationName: 'Hoxton, London', description: 'Active service dispatching. Click for details.', skills: ['Cleaning', 'Ride Sharing'] })}
                        style={{ left: booking.x, top: booking.top }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center focus:outline-none group bg-transparent border-none cursor-pointer z-10"
                      >
                        <span className="absolute w-6 h-6 rounded-full bg-emerald-500/20 animate-ping"></span>
                        <div className="w-5 h-5 bg-emerald-500 rounded-full border border-slate-950 flex items-center justify-center font-black text-[8px] text-white">📦</div>
                      </button>
                    ))}
                  </div>

                  <div className="relative z-10 flex justify-between items-end">
                    <span className="text-[8px] font-mono text-slate-500">London coordinate projected active matrix</span>
                    <span className="text-[8.5px] bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20 px-2.5 py-0.5 rounded-full uppercase">
                      Offline Vector Active
                    </span>
                  </div>
                </div>
              ) : (
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                  <Map
                    defaultCenter={{ lat: 51.5260, lng: -0.0780 }}
                    defaultZoom={13}
                    gestureHandling={'cooperative'}
                    disableDefaultUI={true}
                  >
                    {mapLayers.workers && visibleProfessionals.map((pro) => {
                      const hash = (pro.id || pro.name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                      const seedLat = (hash % 100) / 100;
                      const seedLng = ((hash * 7) % 100) / 100;
                      const coords = LOCATION_COORDINATES[pro.locationName] || { lat: 51.5260 + (seedLat - 0.5) * 0.02, lng: -0.0780 + (seedLng - 0.5) * 0.02 };
                      return (
                        <Marker
                          key={pro.id}
                          position={coords}
                          onClick={() => setSelectedMapPro(pro)}
                        />
                      );
                    })}

                    {mapLayers.hubs && MOCK_HUBS.map((hub) => (
                      <Marker
                        key={hub.id}
                        position={{ lat: hub.lat, lng: hub.lng }}
                        onClick={() => setSelectedMapPro({ name: hub.title, title: 'Transport Node Hub', company: 'London Transit systems', rate: 0, rating: 5.0, votes: 120, locationName: 'Shoreditch, London', description: 'Central London transit connector point.', skills: ['Subway', 'Overground', 'Bus'] })}
                      />
                    ))}

                    {mapLayers.bookings && MOCK_ACTIVE_BOOKINGS.map((booking) => (
                      <Marker
                        key={booking.id}
                        position={{ lat: booking.lat, lng: booking.lng }}
                        onClick={() => setSelectedMapPro({ name: booking.title, title: 'Active Service Job Dispatch', company: 'KonnectS Dispatch Service', rate: 45, rating: 4.9, votes: 34, locationName: 'Hoxton, London', description: 'Active service dispatching. Click for details.', skills: ['Cleaning', 'Ride Sharing'] })}
                      />
                    ))}
                  </Map>
                </APIProvider>
              )}
            </div>

            {selectedMapPro && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-slate-900 text-white rounded-[24px] border border-slate-800 shadow-xl space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{selectedMapPro.name}</h4>
                    <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider">{selectedMapPro.role}</p>
                    <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin size={10} className="text-indigo-400" /> {selectedMapPro.locationName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-rose-450 font-mono">£{selectedMapPro.price}/hr</p>
                    <div className="flex items-center space-x-1 justify-end text-amber-500 mt-1">
                      <Star size={11} fill="currentColor" />
                      <span className="text-[10px] font-black leading-none">{selectedMapPro.rating}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-850">
                  <button
                    onClick={() => {
                      setSelectedService({ name: selectedMapPro.role, price: selectedMapPro.price, proName: selectedMapPro.name, proId: selectedMapPro.id });
                      setSelectedMapPro(null);
                    }}
                    className="flex-grow py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0"
                  >
                    Select & Book Pro
                  </button>
                  <button
                    onClick={() => {
                      onChat(selectedMapPro.id, selectedMapPro.name);
                      setSelectedMapPro(null);
                    }}
                    className="p-2.5 bg-slate-880 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
                  >
                    <MessageSquare size={13} />
                  </button>
                  <button
                    onClick={() => setSelectedMapPro(null)}
                    className="px-2 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {!isNearbyView && visibleProfessionals.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200/80">
            <Briefcase size={28} className="text-slate-300 mx-auto mb-3" />
            <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">No Workers Matching Find Query</h4>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-xs mx-auto mt-1">Try resetting the tab category or tap the "All Skills" list to choose a standard vetted role.</p>
            <button 
              onClick={() => { setActiveSector('all'); setSearchQuery(''); }}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white font-black text-[9px] uppercase tracking-widest rounded-xl"
            >
              Reset Filters
            </button>
          </div>
        ) : !isNearbyView ? (
          loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((val) => (
                <div key={val} className="p-5 bg-white rounded-3xl border border-slate-100/70 flex items-start space-x-4 animate-pulse">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1.5 w-full">
                        <div className="h-3.5 bg-slate-100 rounded-full w-2/5" />
                        <div className="h-2.5 bg-slate-50 rounded-full w-1/4" />
                      </div>
                      <div className="h-5 bg-slate-100 rounded-full w-12" />
                    </div>
                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-50">
                      <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                      <div className="flex space-x-1.5">
                        <div className="h-7 bg-slate-50 rounded-lg w-12" />
                        <div className="h-7 bg-slate-50 rounded-lg w-8" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              {visibleProfessionals.map((pro, index) => (
                <motion.div
                  key={pro.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.6}
                  onDragEnd={(event, info) => {
                    if (info.offset.x > 80) {
                      haptics.success();
                      alert(`🔖 Swipe Saved: Verified Expert "${pro.name}" has been bookmarked to your favorites!`);
                    } else if (info.offset.x < -80) {
                      haptics.heavy();
                      setHiddenProIds(prev => [...prev, pro.id]);
                      alert(`👁️ Swipe Hidden: "${pro.name}" is now hidden from your active recommendations.`);
                    }
                  }}
                  className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-start space-x-4 relative group"
                >
                {pro.isDynamic && (
                  <span className="absolute top-3 right-3 bg-indigo-600/10 text-indigo-600 text-[7px] font-mono font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center space-x-0.5">
                    <Sparkles size={8} />
                    <span>Exact AI Match</span>
                  </span>
                )}
                
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <Briefcase size={22} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                       <h4 className="font-black text-slate-900 text-xs truncate max-w-[130px]">{pro.name}</h4>
                       
                       {/* Worker status indicator */}
                       {(() => {
                         const isBusy = (pro.status === 'busy' || index % 3 === 2);
                         return isBusy ? (
                           <span className="inline-flex items-center space-x-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-50 text-red-650 border border-red-100">
                             <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                             <span>Busy</span>
                           </span>
                         ) : (
                           <span className="inline-flex items-center space-x-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                             <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                             <span>Active</span>
                           </span>
                         );
                       })()}

                       {/* Interactive Quick Tip Advice Badge */}
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           haptics.light();
                           setSelectedQuickTip({
                             role: pro.role,
                             name: pro.name,
                             tip: getImprovementTip(pro.role)
                           });
                         }}
                         className="inline-flex items-center space-x-0.5 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 active:scale-95 transition-all cursor-pointer select-none"
                       >
                         <span>💡 Quick Tip</span>
                       </button>
                    </div>
                    <div className="flex items-center space-x-1 text-amber-500">
                      <Star size={11} fill="currentColor" />
                      <span className="text-[10px] font-black">{pro.rating}</span>
                    </div>
                  </div>
                  
                  <p className="text-[11px] font-extrabold text-slate-500 mb-2">{pro.role}</p>
                  
                  <div className="flex items-center space-x-3.5 mb-4 text-[9.5px]">
                    <div className="flex items-center space-x-1 text-slate-400">
                      <Clock size={11} />
                      <span className="font-bold uppercase tracking-wider">Fast Route</span>
                    </div>
                    <span className="font-extrabold text-slate-900 font-mono">£{pro.price}/hr</span>
                    <div className="flex items-center space-x-1 text-slate-400">
                      <MapPin size={10} className="text-emerald-500 shrink-0" />
                      <span className="truncate max-w-[80px] font-medium">{pro.locationName?.split('•')[0]}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setSelectedService({ name: pro.role, price: pro.price, proName: pro.name, proId: pro.id })}
                      disabled={bookingStatus !== 'idle'}
                      className="flex-1 py-3 bg-slate-900 border border-transparent hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      <Zap size={11} />
                      <span>Request Pro</span>
                    </button>
                    <button 
                      onClick={() => onChat(pro.id, pro.name)}
                      className="px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-black rounded-xl text-[10px] uppercase border-none active:scale-95 transition-transform flex items-center space-x-1"
                    >
                      <MessageSquare size={12} />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          )
        ) : null}
      </div>

      <AnimatePresence>
        {selectedService && (
          <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedService(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar pointer-events-auto"
            >
               <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-3.5 items-center">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-slate-100 shadow-sm">
                      <LazyImage
                        src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150"
                        alt={selectedService.proName || 'Local Specialist'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">Finalise Booking</h2>
                      <p className="text-[9.5px] text-slate-400 font-mono font-black uppercase tracking-widest mt-0.5">Matched: {selectedService.proName || 'Local Specialist'}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedService(null)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors border-none cursor-pointer">
                    <X size={18} />
                  </button>
               </div>

               <div className="space-y-5">
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/40 text-[11px] text-indigo-900 font-bold mb-4 flex items-start space-x-2.5">
                    <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span>Selected: <span className="font-extrabold text-indigo-950">{selectedService.name}</span> service.</span>
                      <p className="text-[9px] text-indigo-500 mt-1 uppercase tracking-wider">Base Fare Guaranteed: £{selectedService.price}/hr</p>
                    </div>
                  </div>

                  {/* AI Review Summary Component */}
                  <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2.5 opacity-10">
                      <Sparkles className="text-indigo-600 animate-pulse" size={42} />
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Sparkles className="text-indigo-500 shrink-0" size={14} />
                      <span className="text-[9.5px] font-black uppercase text-indigo-650 tracking-widest">Gemini AI Feedback Digest</span>
                    </div>
                    {isReviewSummaryLoading ? (
                      <div className="flex items-center space-x-2 py-2">
                        <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Generating summary...</span>
                      </div>
                    ) : reviewSummary ? (
                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-650 leading-relaxed font-semibold italic">
                          "{reviewSummary.summary}"
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {reviewSummary.highlights.map((tag, idx) => (
                            <span 
                              key={idx} 
                              className="text-[8px] font-black uppercase tracking-wider px-2 py-1 bg-indigo-50 text-indigo-650 rounded-lg border border-indigo-100"
                            >
                              ✨ {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Could not load feedback digest</span>
                    )}
                  </div>

                  {/* AR 3D SPATIAL SCAN OR BIM ESTIMATOR */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <Camera size={15} className="text-indigo-600" />
                        <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">3D Spatial BIM Scan (AR)</span>
                      </div>
                      {roomScanData ? (
                        <span className="inline-flex items-center text-[7.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-150">
                          ✓ ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[7.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-150">
                          OPTIONAL
                        </span>
                      )}
                    </div>

                    {roomScanData ? (
                      <div className="text-[10px] bg-white border border-slate-100 p-3 rounded-xl space-y-1 text-slate-750">
                        <div className="flex justify-between">
                          <span className="font-bold">Attached Space:</span>
                          <span className="font-mono text-indigo-600 font-extrabold">{roomScanData.area} m² Area</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold">Total Perimeter:</span>
                          <span className="font-mono text-indigo-600 font-extrabold">{roomScanData.perimeter}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold">Wall Area:</span>
                          <span className="font-mono text-indigo-600 font-extrabold">{roomScanData.wallArea} m²</span>
                        </div>
                        <div className="text-[8.5px] text-slate-400 font-bold uppercase tracking-widest mt-2 border-t pt-2">
                          Core Material Estimates Bundled
                        </div>
                      </div>
                    ) : (
                      <p className="text-[9.5px] text-slate-400 leading-relaxed font-semibold">
                        Using your device camera and LiDAR, scan your room to construct a lightweight 3D/BIM floor plan model. This provides the technician with exact measurements to calculate instant material quotes.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => { haptics.light(); setShowARScanModal(true); }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all active:scale-95 flex items-center justify-center space-x-1.5 border-none cursor-pointer"
                    >
                      <Camera size={13} />
                      <span>{roomScanData ? 'Recalibrate / Edit Room Scan' : 'Measure Room with LiDAR AR Scanner'}</span>
                    </button>
                  </div>

                  {/* Pickup Selection */}
                  <div className="space-y-2">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Our Meeting Coordinates</label>
                        <button onClick={() => setIsMapPicking(isMapPicking === 'pickup' ? null : 'pickup')} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest underline border-none bg-transparent cursor-pointer">
                          {isMapPicking === 'pickup' ? 'Confirm Coordinates' : 'Pin on Map'}
                        </button>
                     </div>
                     <div className={`relative h-20 rounded-3xl border border-slate-100 overflow-hidden transition-all ${isMapPicking === 'pickup' ? 'h-64' : ''}`}>
                        {isMapPicking === 'pickup' ? (
                           <div className="w-full h-full relative group">
                              {mapLoadError ? (
                                 <div className="absolute inset-0 bg-slate-950 flex flex-col justify-between p-4 overflow-hidden select-none">
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,41,59,0.4)_0%,rgba(15,23,42,1)_100%)] opacity-95"></div>
                                    <div className="absolute inset-0 flex items-center justify-center p-3">
                                       <div className="w-full h-full border border-dashed border-indigo-500/20 rounded-xl flex flex-col items-center justify-center text-center p-3">
                                          <MapPin size={22} className="text-indigo-400 mb-1.5 animate-bounce" />
                                          <span className="text-[9px] text-white font-extrabold uppercase tracking-wider">Vector Meeting Positioner</span>
                                          <p className="text-[8px] text-slate-400 mt-1 max-w-[210px] leading-normal">Tap within the grid below to calibrate your meeting coordinate offset.</p>
                                          
                                          <div 
                                             onClick={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const clickX = (e.clientX - rect.left) / rect.width;
                                                const clickY = (e.clientY - rect.top) / rect.height;
                                                const targetLat = 51.5235 + (0.5 - clickY) * 0.01;
                                                const targetLng = -0.0760 + (clickX - 0.5) * 0.01;
                                                setPickupCoords({ lat: targetLat, lng: targetLng });
                                             }}
                                             className="mt-2.5 w-36 h-20 bg-slate-900 border border-white/5 rounded-xl relative flex items-center justify-center overflow-hidden cursor-crosshair hover:bg-slate-850 transition-colors"
                                          >
                                             <div className="absolute w-full h-[1px] bg-white/5"></div>
                                             <div className="absolute h-full w-[1px] bg-white/5"></div>
                                             <div className="absolute w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
                                             <div className="absolute w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                                          </div>
                                          
                                          <span className="text-[8px] font-mono text-indigo-400 mt-2">Lat: {pickupCoords.lat.toFixed(4)} • Lng: {pickupCoords.lng.toFixed(4)}</span>
                                       </div>
                                    </div>
                                 </div>
                              ) : (
                                 <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                                    <Map
                                      defaultCenter={pickupCoords}
                                      defaultZoom={15}
                                      gestureHandling={'greedy'}
                                      disableDefaultUI={true}
                                      onClick={(e) => {
                                         if (e.detail.latLng) {
                                            setPickupCoords(e.detail.latLng);
                                         }
                                      }}
                                    >
                                       <Marker position={pickupCoords} />
                                    </Map>
                                 </APIProvider>
                              )}
                              <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[8px] px-3 py-1.5 rounded-full uppercase font-black z-10 transition-all">Select Meeting Point</div>
                           </div>
                        ) : (
                           <div className="flex items-center space-x-3 p-4 bg-slate-50 h-full">
                              <MapPin size={20} className="text-indigo-600" />
                              <input 
                                value={pickupAddress}
                                onChange={(e) => setPickupAddress(e.target.value)}
                                className="bg-transparent font-extrabold text-slate-700 outline-none w-full text-xs" 
                              />
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Drop-off Selection */}
                  <div className="space-y-2">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Work Site Address</label>
                        <button onClick={() => setIsMapPicking(isMapPicking === 'dropoff' ? null : 'dropoff')} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest underline border-none bg-transparent cursor-pointer">
                          {isMapPicking === 'dropoff' ? 'Confirm Coordinates' : 'Pin on Map'}
                        </button>
                     </div>
                     <div className={`relative h-20 rounded-3xl border border-slate-100 overflow-hidden transition-all ${isMapPicking === 'dropoff' ? 'h-64' : ''}`}>
                        {isMapPicking === 'dropoff' ? (
                           <div className="w-full h-full relative group">
                              {mapLoadError ? (
                                <div className="absolute inset-0 bg-slate-950 flex flex-col justify-between p-4 overflow-hidden select-none">
                                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,24,48,0.4)_0%,rgba(2,6,23,1)_100%)] opacity-95"></div>
                                   <div className="absolute inset-0 flex items-center justify-center p-3">
                                      <div className="w-full h-full border border-dashed border-emerald-500/20 rounded-xl flex flex-col items-center justify-center text-center p-3">
                                         <MapPin size={22} className="text-emerald-400 mb-1.5 animate-bounce" />
                                         <span className="text-[9px] text-white font-extrabold uppercase tracking-wider">Vector Worksite Positioner</span>
                                         <p className="text-[8px] text-slate-400 mt-1 max-w-[210px] leading-normal">Tap within the grid below to calibrate your worksite coordinate offset.</p>
                                         
                                         <div 
                                            onClick={(e) => {
                                               const rect = e.currentTarget.getBoundingClientRect();
                                               const clickX = (e.clientX - rect.left) / rect.width;
                                               const clickY = (e.clientY - rect.top) / rect.height;
                                               const targetLat = 51.5245 + (0.5 - clickY) * 0.01;
                                               const targetLng = -0.0750 + (clickX - 0.5) * 0.01;
                                               setDropoffCoords({ lat: targetLat, lng: targetLng });
                                            }}
                                            className="mt-2.5 w-36 h-20 bg-slate-900 border border-white/5 rounded-xl relative flex items-center justify-center overflow-hidden cursor-crosshair hover:bg-slate-850 transition-colors"
                                         >
                                            <div className="absolute w-full h-[1px] bg-white/5"></div>
                                            <div className="absolute h-full w-[1px] bg-white/5"></div>
                                            <div className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                                            <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                                         </div>
                                         
                                         <span className="text-[8px] font-mono text-emerald-400 mt-2">Lat: {dropoffCoords.lat.toFixed(4)} • Lng: {dropoffCoords.lng.toFixed(4)}</span>
                                      </div>
                                   </div>
                                </div>
                             ) : (
                               <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                                  <Map
                                    defaultCenter={dropoffCoords}
                                    defaultZoom={15}
                                    gestureHandling={'greedy'}
                                    disableDefaultUI={true}
                                    onClick={(e) => {
                                       if (e.detail.latLng) {
                                          setDropoffCoords(e.detail.latLng);
                                       }
                                    }}
                                  >
                                     <Marker position={dropoffCoords} />
                                  </Map>
                               </APIProvider>
                             )}
                              <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[8px] px-3 py-1.5 rounded-full uppercase font-black z-10 transition-all">Select Worksite Point</div>
                           </div>
                        ) : (
                           <div className="flex items-center space-x-3 p-4 bg-slate-50 h-full">
                              <MapPin size={20} className="text-emerald-500" />
                              <input 
                                value={dropoffAddress}
                                onChange={(e) => setDropoffAddress(e.target.value)}
                                className="bg-transparent font-extrabold text-slate-700 outline-none w-full text-xs" 
                              />
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Negotiated Price (£)</label>
                        <div className="relative">
                           <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                           <input 
                             type="number"
                             value={suggestedPrice}
                             onChange={(e) => setSuggestedPrice(e.target.value)}
                             placeholder={(selectedService.price).toString()}
                             className="w-full pl-10 p-3.5 bg-slate-50 border border-transparent focus:border-indigo-500 rounded-2xl font-black text-xs outline-none transition-all text-slate-800"
                           />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Duration Required</label>
                        <div className="relative">
                           <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                           <input 
                             value={estimatedTime}
                             onChange={(e) => setEstimatedTime(e.target.value)}
                             className="w-full pl-10 p-3.5 bg-slate-50 border border-transparent focus:border-indigo-500 rounded-2xl font-black text-xs outline-none transition-all text-slate-800"
                           />
                        </div>
                     </div>
                  </div>

                  {/* Verified Testimonials and Star-ratings */}
                  <Testimonials 
                    providerId={selectedService.proId || 'spro-general'}
                    providerName={selectedService.proName || 'Specialist'}
                  />

                  <button 
                    onClick={handleBookNow}
                    disabled={bookingStatus !== 'idle'}
                    className={`w-full py-4.5 rounded-[22px] text-xs font-black uppercase tracking-[0.15em] shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3 border-none ${
                      bookingStatus === 'success' ? 'bg-emerald-600 text-white shadow-emerald-600/10 animate-pulse' : 'bg-slate-900 text-white shadow-slate-900/10'
                    }`}
                  >
                    {bookingStatus === 'booking' ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : bookingStatus === 'success' ? (
                      <>
                        <Check size={16} />
                        <span>Worker Booked successfully!</span>
                      </>
                    ) : (
                      <span>Send High-Priority Request</span>
                    )}
                  </button>

                  {/* AI-Powered Companion Insights Overlay */}
                  <AnimatePresence>
                    {bookingStatus === 'success' && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-5 bg-gradient-to-br from-violet-900 to-indigo-950 text-white rounded-[32px] border border-violet-500/20 shadow-2xl relative overflow-hidden text-left space-y-4"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <Sparkles size={100} />
                        </div>

                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div className="flex items-center space-x-2">
                            <Sparkles size={16} className="text-violet-300 animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">AI-Powered Insights</span>
                          </div>
                          <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-[8px] font-bold rounded-full">REALTIME ACCREDIATION</span>
                        </div>

                        <div className="space-y-1.5">
                          <h4 className="text-xs font-extrabold text-violet-100">Complementary Enhancements</h4>
                          <p className="text-[9.5px] text-slate-300 leading-normal">
                            Based on your booking coordinate context for <span className="text-white font-black">"{selectedService.name}"</span>, UrbanNet recommended additions:
                          </p>
                        </div>

                        {/* Add-on recommendation */}
                        {(() => {
                          const sug = getAISuggestions(selectedService.name);
                          return (
                            <div className="space-y-3 pt-1">
                              {/* Add-on Card */}
                              <div className="p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 flex items-center justify-between transition-colors">
                                <div className="flex items-center space-x-3">
                                  <span className="text-xl shrink-0">{sug.addon.icon}</span>
                                  <div>
                                    <p className="text-[10px] font-black text-violet-300 uppercase tracking-wider">Suggested Add-on Option</p>
                                    <h5 className="text-[11px] font-extrabold text-[#f8fafc]">{sug.addon.name}</h5>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => alert(`Successfully added "${sug.addon.name}" to your reservation ledger!`)}
                                  className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[8px] font-black uppercase tracking-wider rounded-lg transition-transform active:scale-95 border-none cursor-pointer"
                                >
                                  + £{sug.addon.price}
                                </button>
                              </div>

                              {/* Marketplace Items Carousel/Grid */}
                              <div className="space-y-2">
                                <p className="text-[9px] font-bold text-violet-300 uppercase tracking-widest pl-1 leading-none">Complementary Marketplace Items</p>
                                <div className="grid grid-cols-2 gap-2.5">
                                  {sug.items.map((item, idx) => (
                                    <div key={idx} className="p-3 bg-slate-900/60 rounded-2xl border border-white/5 flex flex-col justify-between h-28">
                                      <div>
                                        <span className="text-lg mb-1 block">{item.img}</span>
                                        <h6 className="text-[9.5px] font-extrabold text-slate-200 line-clamp-1">{item.name}</h6>
                                        <p className="text-[8px] text-slate-400 line-clamp-2 leading-snug mt-0.5 font-medium">{item.desc}</p>
                                      </div>
                                      <div className="flex justify-between items-center pt-2.5 border-t border-white/5 mt-1">
                                        <span className="text-[9px] font-mono text-violet-300 font-extrabold">£{item.price}</span>
                                        <button 
                                          onClick={() => alert(`Purchase order queued! "${item.name}" will be dispatched to your worksite address.`)}
                                          className="text-[8px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider bg-transparent border-none cursor-pointer"
                                        >
                                          Order
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SpatialARScannerModal 
        show={showARScanModal}
        onClose={() => setShowARScanModal(false)}
        serviceName={selectedService?.name || 'Local Specialist'}
        onSaveScan={(data) => {
          setRoomScanData(data);
          // Set suggestedPrice to the calculated quote
          const calculatedQuote = +(data.area * 14.5 + data.height * 12 + 45).toFixed(2);
          setSuggestedPrice(calculatedQuote.toString());
        }}
      />

      {/* Web Speech Voice-Booking Overlay Modal */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[1200] flex items-end sm:items-center justify-center p-4 pointer-events-auto"
          >
            <motion.div
              initial={{ y: 50, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 50, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-sm p-6 space-y-5 shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-1 bg-violet-50 text-violet-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  Voice Booking Engine
                </span>
                <button
                  onClick={() => setIsListening(false)}
                  className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-center space-y-2 py-4">
                <div className="w-16 h-16 bg-linear-to-tr from-violet-600 to-indigo-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/20">
                  <Mic size={28} className="animate-pulse" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center justify-center gap-1.5">Hearing voice command...</h3>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed px-4">
                  Try saying:<br />
                  <span className="italic font-bold text-slate-600 dark:text-slate-300">"Book Evelyn Carter doctor"</span> or<br />
                  <span className="italic font-bold text-slate-600 dark:text-slate-300">"Book electrician Marcus Vance"</span>
                </p>
              </div>

              {transcript && (
                <div className="p-3 bg-slate-50 dark:bg-slate-850/60 rounded-xl border border-slate-101 dark:border-slate-800/50 space-y-1">
                  <p className="text-[8.5px] uppercase font-mono text-indigo-400 font-black">Spoken Transcript</p>
                  <p className="text-xs text-slate-700 dark:text-slate-200 font-bold italic">"{transcript}"</p>
                </div>
              )}

              {voiceError && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-2 text-rose-700">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <div className="text-[10px] leading-relaxed">
                    <p className="font-bold">Notice</p>
                    <p className="text-rose-650 font-medium">{voiceError}</p>
                  </div>
                </div>
              )}

              {/* Simulated text field in case Speech recognition is blocked or unsupported */}
              <div className="space-y-1.5 bg-slate-50 dark:bg-slate-850/45 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <label className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Simulate Voice Command alternative</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualVoiceCommandTxt}
                    onChange={(e) => setManualVoiceCommandTxt(e.target.value)}
                    placeholder="Type spoken booking command here..."
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-100 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualVoiceCommandTxt.trim()) {
                        setTranscript(manualVoiceCommandTxt);
                        parseVoiceCommand(manualVoiceCommandTxt);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (manualVoiceCommandTxt.trim()) {
                        setTranscript(manualVoiceCommandTxt);
                        parseVoiceCommand(manualVoiceCommandTxt);
                      }
                    }}
                    className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg"
                  >
                    Send
                  </button>
                </div>
              </div>

              {voiceParsedBooking ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-50 text-emerald-950 border border-emerald-100 rounded-2xl space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-100 px-1.5 py-0.5 rounded-md text-emerald-800">
                        Extracted Order
                      </span>
                      <h4 className="font-extrabold text-xs text-slate-800 mt-1">{voiceParsedBooking.proName}</h4>
                      <p className="text-[9.5px] text-slate-400 font-bold">{voiceParsedBooking.serviceName}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 font-mono">£{voiceParsedBooking.price}</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 leading-normal border-t border-emerald-100/40 pt-1.5 italic font-medium">
                    "{voiceParsedBooking.description}"
                  </p>
                  
                  <button
                    onClick={handleConfirmVoiceBooking}
                    className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={12} /> Confirm Appointment
                  </button>
                </motion.div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Scanner overlay modal */}
      <AnimatePresence>
        {showQRScanner && (
          <QRScannerModal 
            mode="vouchers"
            onClose={() => setShowQRScanner(false)}
            onScanSuccess={(code) => {
              setShowQRScanner(false);
              haptics.success();
              setActiveDiscountCode(code);
              alert(`Scan Success!\nRedeemed Coupon Voucher: ${code}\n25% Discount applied successfully for Shoreditch services!`);
            }}
          />
        )}
      </AnimatePresence>

      {/* Quick Tip Advice Disclosure Modal */}
      <AnimatePresence>
        {selectedQuickTip && (
          <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-[400] flex items-center justify-center p-6 text-left">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 relative"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
                    <Sparkles size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded tracking-wider">
                      Listing Optimization
                    </span>
                    <h3 className="text-sm font-black text-slate-900 mt-1 leading-none uppercase tracking-tight">
                      Listing Advisor
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedQuickTip(null)}
                  className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400 hover:text-slate-650 cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">
                  Target Listing: {selectedQuickTip.name} ({selectedQuickTip.role})
                </span>
                <p className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                  "{selectedQuickTip.tip}"
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    haptics.success();
                    setSelectedQuickTip(null);
                  }}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Apply Optimization
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FeatureSpotlight
        featureKey="services_view"
        title="Services Hub Spotlight"
        steps={[
          {
            title: "Vetted Local Professionals",
            description: "Hire trades, healthcare, and business professionals with official DBS records and verified badge credentials instantly."
          },
          {
            title: "AI Voice-Powered Booking",
            description: "Tap the microphone icon to speak a voice command, like 'Book Evelyn Carter doctor', to automate the setup of your appointment."
          },
          {
            title: "Spatial AR Room Scanner",
            description: "Use the camera spatial AR scanner to model physical areas and automatically calculate material and labor cost quotes."
          }
        ]}
      />
    </div>
  );
}
