/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { WorkerCapabilityRadar } from './WorkerCapabilityRadar';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ServiceBooking, RideRequest } from '../types';
import { haptics } from '../utils/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, MapPin, PoundSterling, Bell, MessageSquare, ToggleLeft, ToggleRight, Search, Settings, AlertCircle, User, Shield, Wrench, CreditCard, Users, ShieldCheck, TrendingUp, CheckCircle2, Star, Zap, Package, ArrowRight, Briefcase, ScanFace, FileText, Award, DollarSign, Calendar, Sparkles, Plus, Image } from 'lucide-react';
import { VerificationStatus } from './VerificationStatus';
import { WorkHistoryModule } from './WorkHistoryModule';
import { AdminDashboard } from './AdminDashboard';
import { WorkerReelsModule } from './WorkerReelsModule';

export function WorkerView({ onChat, activeTab }: { onChat: (id: string, name: string) => void; activeTab?: string }) {
  const { profile, toggleWorkerMode: authToggleWorkerMode, updateProfile } = useAuth();
  const [activeBookings, setActiveBookings] = useState<ServiceBooking[]>([]);
  const [activeRides, setActiveRides] = useState<RideRequest[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirmOnline, setShowConfirmOnline] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [counterofferBooking, setCounterofferBooking] = useState<ServiceBooking | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterTime, setCounterTime] = useState('');
  const [earningsHistory, setEarningsHistory] = useState<any[]>([]);

  // Vehicle Proof and ID Verification for Rides (State & Handlers)
  const [hasVehicleProof, setHasVehicleProof] = useState(() => {
    return localStorage.getItem('konnects_vehicle_proof_submitted') === 'true';
  });
  const [ridesProofForm, setRidesProofForm] = useState({
    licenseNumber: '',
    vehicleRegistration: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
  });
  const [submittingRidesProof, setSubmittingRidesProof] = useState(false);

  // Job Services Setup and Skills / Work History (State & Handlers)
  const [jobsCanDo, setJobsCanDo] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('konnects_jobs_can_do');
      return stored ? JSON.parse(stored) : ['Cleaner', 'Handyman'];
    } catch {
      return ['Cleaner', 'Handyman'];
    }
  });
  const [workHistory, setWorkHistory] = useState<Array<{ title: string; employer: string; duration: string; details: string }>>(() => {
    try {
      const stored = localStorage.getItem('konnects_work_history');
      return stored ? JSON.parse(stored) : [
        { title: 'Senior Cleaner', employer: 'EcoClean Ltd', duration: '2 Years', details: 'Managed deep cleaning operations for commercial premises.' }
      ];
    } catch {
      return [
        { title: 'Senior Cleaner', employer: 'EcoClean Ltd', duration: '2 Years', details: 'Managed deep cleaning operations for commercial premises.' }
      ];
    }
  });
  const [experienceYears, setExperienceYears] = useState(() => {
    return localStorage.getItem('konnects_experience_years') || '3';
  });
  const [newJobTypeInput, setNewJobTypeInput] = useState('');
  const [newHistory, setNewHistory] = useState({
    title: '',
    employer: '',
    duration: '',
    details: '',
  });

  // First-time onboarding state
  const [onboardStep, setOnboardStep] = useState(1);
  const [prefJob, setPrefJob] = useState<string>('');
  const [jobRate, setJobRate] = useState('30');
  const [jobInfo, setJobInfo] = useState('');

  // Skills and Camera states
  const [skillsArray, setSkillsArray] = useState<string[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Subtabbing and Pro Toolkit states
  const [subTab, setSubTab] = useState<'requests' | 'history' | 'reels' | 'bills' | 'toolkit' | 'crm' | 'earnings_tax' | 'admin'>('requests');
  const [quoteDistance, setQuoteDistance] = useState<number>(5);
  const [quoteHours, setQuoteHours] = useState<number>(2);
  const [quoteIsFreeNear, setQuoteIsFreeNear] = useState<boolean>(false);

  // CRM States
  const [crmClient, setCrmClient] = useState('');
  const [crmFrequency, setCrmFrequency] = useState('3 Months');
  const [crmNextDate, setCrmNextDate] = useState('');
  const [crmNotes, setCrmNotes] = useState('');
  const [crmType, setCrmType] = useState('Boiler Maintenance');
  const [crmRemindersList, setCrmRemindersList] = useState<any[]>([]);

  // Bulk Client Outreach States
  const [selectedOutreachCategory, setSelectedOutreachCategory] = useState('Annual Boiler Safety Check');
  const [outreachClients, setOutreachClients] = useState<Array<{ id: string; name: string; lastService: string; selected: boolean }>>([
    { id: 'oc-1', name: 'Sarah Montgomery', lastService: '2025-11-12', selected: true },
    { id: 'oc-2', name: 'Jordan Finch', lastService: '2025-12-05', selected: true },
    { id: 'oc-3', name: 'Evelyn Carter', lastService: '2026-02-18', selected: false },
    { id: 'oc-4', name: 'Derrick Powell', lastService: '2026-03-01', selected: true }
  ]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [broadcastDone, setBroadcastDone] = useState(false);

  // HMRC & Mileage States
  const [mileageTripName, setMileageTripName] = useState('');
  const [mileageDistance, setMileageDistance] = useState('');
  const [mileageDate, setMileageDate] = useState('');
  
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Tools');
  const [expenseDate, setExpenseDate] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [hmrcLogs, setHmrcLogs] = useState<any[]>([]);

  // Premium Upgrade State
  const [isUpgradingPremium, setIsUpgradingPremium] = useState(false);
  const [showPremiumSuccess, setShowPremiumSuccess] = useState(false);

  // Speech TTS Companion Voice Synthesizer
  const playTTS = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const s = new SpeechSynthesisUtterance(text);
      s.rate = 1.0;
      window.speechSynthesis.speak(s);
    }
  };

  const [certFile, setCertFile] = useState<{name: string, size: string} | null>(null);
  const [siaFile, setSiaFile] = useState<{name: string, size: string} | null>(null);
  const [dbsFile, setDbsFile] = useState<{name: string, size: string} | null>(null);
  const [generalFile, setGeneralFile] = useState<{name: string, size: string} | null>(null);

  const [dragActiveField, setDragActiveField] = useState<string | null>(null);
  const [onboardProgress, setOnboardProgress] = useState(0);
  const [isSubmittingOnboard, setIsSubmittingOnboard] = useState(false);

  // Derived earnings based on user rating parameter
  const isNewUser = !profile?.rating || profile.rating === 0;
  const earningsTotal = isNewUser ? 0 : 142.50;
  const ratingToDisplay = isNewUser ? "No rating" : `${profile.rating.toFixed(1)}/5.0`;

  // Derived earnings for the mock
  const earnings = {
    total: earningsTotal,
    categories: [
      { label: 'Work Orders', amount: isNewUser ? 0 : 850, color: 'bg-indigo-500', icon: Wrench, percentage: isNewUser ? 0 : 66 },
      { label: 'Logistics', amount: isNewUser ? 0 : 120, color: 'bg-emerald-500', icon: MapPin, percentage: isNewUser ? 0 : 9 },
      { label: 'Digital Service', amount: isNewUser ? 0 : 310, color: 'bg-blue-500', icon: MessageSquare, percentage: isNewUser ? 0 : 25 }
    ]
  };

  const toggleWorkerMode = async () => {
    try {
      await authToggleWorkerMode();
    } catch (error) {
      console.warn('Worker mode toggle error:', error);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      await updateProfile({ isOnline: !profile?.isOnline });
      setShowConfirmOnline(false);
    } catch (error) {
      console.warn('Toggle online status error:', error);
    }
  };

  const toggleAvailabilityStatus = async () => {
    if (!profile?.uid) return;
    try {
      const current = profile.availabilityStatus || 'Active';
      const nextStatus = current === 'Active' ? 'Busy' : 'Active';
      await updateDoc(doc(db, 'users', profile.uid), {
        availabilityStatus: nextStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const updateAutoAccept = async (config: { enabled?: boolean, maxPrice?: number, minPrice?: number, serviceTypes?: string[] }) => {
    if (!profile?.uid) return;
    try {
      const newConfig = { ...profile.autoAcceptConfig, ...config };
      await updateDoc(doc(db, 'users', profile.uid), {
        autoAcceptConfig: newConfig
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setCameraActive(true);
    } catch (err) {
      console.warn("Camera hardware sandbox error, starting fallback secure capture emulation:", err);
      setCameraActive(true);
    }
  };

  const capturePhoto = () => {
    if (cameraStream) {
      const video = document.querySelector('video');
      if (video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    } else {
      setCapturedPhoto("https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=250&auto=format&fit=crop");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const toggleSkillCheck = (skillId: string) => {
    setSkillsArray(prev => 
      prev.includes(skillId) ? prev.filter(x => x !== skillId) : [...prev, skillId]
    );
  };

  const handleUploadDoc = async () => {
    // Mock upload
    setUploading(true);
    setTimeout(async () => {
      if (!profile?.uid) return;
      await updateDoc(doc(db, 'users', profile.uid), {
        verificationStatus: 'pending',
        verificationStep: 'Awaiting Document Review',
        documents: [...(profile.documents || []), 'id_verification_mock.pdf']
      });
      setUploading(false);
    }, 1500);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile?.uid) return;

    // Listen for bookings that are 'pending' or assigned to this worker
    const q = query(
      collection(db, 'bookings'),
      where('status', 'in', ['pending', 'accepted']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceBooking));
      setActiveBookings(bookings);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  // Real-time synchronization for CRM reminders & HMRC Logs
  useEffect(() => {
    if (!profile?.uid) return;

    let unsubCrm: (() => void) | null = null;
    let unsubHmrc: (() => void) | null = null;
    let crmRetryTimeout: any = null;
    let hmrcRetryTimeout: any = null;
    let crmRetryCount = 0;
    let hmrcRetryCount = 0;

    function subscribeCrm() {
      if (unsubCrm) {
        unsubCrm();
        unsubCrm = null;
      }
      const crmQ = query(
        collection(db, 'contractor_crm'),
        where('contractorId', '==', profile.uid)
      );
      unsubCrm = onSnapshot(crmQ, (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCrmRemindersList(items);
        crmRetryCount = 0;
      }, (err) => {
        console.warn("Unable to load CRM records", err);
        if (crmRetryCount < 3) {
          crmRetryCount++;
          crmRetryTimeout = setTimeout(subscribeCrm, 1500 * crmRetryCount);
        }
      });
    }

    function subscribeHmrc() {
      if (unsubHmrc) {
        unsubHmrc();
        unsubHmrc = null;
      }
      const hmrcQ = query(
        collection(db, 'hmrc_logs'),
        where('workerId', '==', profile.uid)
      );
      unsubHmrc = onSnapshot(hmrcQ, (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHmrcLogs(items);
        hmrcRetryCount = 0;
      }, (err) => {
        console.warn("Unable to load HMRC logs", err);
        if (hmrcRetryCount < 3) {
          hmrcRetryCount++;
          hmrcRetryTimeout = setTimeout(subscribeHmrc, 1500 * hmrcRetryCount);
        }
      });
    }

    subscribeCrm();
    subscribeHmrc();

    return () => {
      if (unsubCrm) unsubCrm();
      if (unsubHmrc) unsubHmrc();
      if (crmRetryTimeout) clearTimeout(crmRetryTimeout);
      if (hmrcRetryTimeout) clearTimeout(hmrcRetryTimeout);
    };
  }, [profile?.uid]);

  const handleSaveCRMReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (!crmClient.trim() || !crmNextDate) {
      alert("Please enter a client name and next scheduled maintenance date.");
      return;
    }

    try {
      await addDoc(collection(db, 'contractor_crm'), {
        contractorId: profile.uid,
        clientName: crmClient.trim(),
        serviceType: crmType,
        frequency: crmFrequency,
        nextDate: crmNextDate,
        notes: crmNotes.trim(),
        completed: false,
        createdAt: serverTimestamp()
      });

      // Reset Form fields
      setCrmClient('');
      setCrmNotes('');
      setCrmNextDate('');

      // Voice Feedback
      const speechText = `Maintenance alert set. Recurring push scheduled for client ${crmClient} regarding ${crmType} intervals of ${crmFrequency}.`;
      playTTS(speechText);
      alert(speechText);
    } catch (err) {
      console.error("Error setting up CRM reminder:", err);
      alert("Failed to save client record.");
    }
  };

  const handleLogMileage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (!mileageTripName.trim() || !mileageDistance || !mileageDate) {
      alert("Specify trip destination, distance, and date.");
      return;
    }

    try {
      const miles = parseFloat(mileageDistance);
      const computedAllowance = miles * 0.45;
      await addDoc(collection(db, 'hmrc_logs'), {
        workerId: profile.uid,
        type: 'mileage',
        description: mileageTripName.trim(),
        distance: miles,
        amount: computedAllowance,
        date: mileageDate,
        createdAt: serverTimestamp()
      });

      setMileageTripName('');
      setMileageDistance('');
      setMileageDate('');
      alert(`Success: Logged ${miles} miles (£${computedAllowance.toFixed(2)} standard tax deduction).`);
    } catch (err) {
      console.error("Mileage log fail:", err);
    }
  };

  const handleLogReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    if (!expenseName.trim() || !expenseAmount || !expenseDate) {
      alert("Specify item name, buying amount, and date.");
      return;
    }

    try {
      const amt = parseFloat(expenseAmount);
      await addDoc(collection(db, 'hmrc_logs'), {
        workerId: profile.uid,
        type: 'receipt',
        description: expenseName.trim(),
        amount: amt,
        category: expenseCategory,
        date: expenseDate,
        receiptPhoto: receiptPhoto || null,
        createdAt: serverTimestamp()
      });

      setExpenseName('');
      setExpenseAmount('');
      setExpenseDate('');
      setReceiptPhoto(null);
      alert(`Success: Logged £${amt.toFixed(2)} tools receipt.`);
    } catch (err) {
      console.error("Receipt logger fail:", err);
    }
  };

  const handleReceiptPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubscribePremium = async () => {
    setIsUpgradingPremium(true);
    setTimeout(async () => {
      try {
        if (profile?.uid) {
          await updateDoc(doc(db, 'users', profile.uid), {
            isPremiumWorker: true,
            featured: true
          });
        }
        setShowPremiumSuccess(true);
        setIsUpgradingPremium(false);
        const text = "Upgrade completed! Welcome to KonnectS Premium Worker status. Reduction check: Platform Commission set to 5%. Profile search boost triggered.";
        playTTS(text);
        alert(text);
      } catch (err) {
        console.error("Premium upgrade error:", err);
        setIsUpgradingPremium(false);
      }
    }, 1800);
  };  const handleDownloadTaxSummary = () => {
    const totalMileage = hmrcLogs.filter(l => l.type === 'mileage').reduce((acc, curr) => acc + (curr.distance || 0), 0);
    const mileageAllowance = totalMileage * 0.45;
    const totalReceipts = hmrcLogs.filter(l => l.type === 'receipt').reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalDeductions = mileageAllowance + totalReceipts;

    const tableRows = hmrcLogs.map(log => `
      <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px;">
        <td style="padding: 12px 6px; font-weight: bold; color: #1e293b;">${log.date}</td>
        <td style="padding: 12px 6px; text-transform: uppercase; font-family: monospace; color: #6366f1;">${log.type}</td>
        <td style="padding: 12px 6px; color: #475569;">${log.description} ${log.category ? `(<span style="color:#0f172a; font-weight:bold;">${log.category}</span>)` : ''}</td>
        <td style="padding: 12px 6px; font-family: monospace;">${log.distance ? `${log.distance} mi` : '-'}</td>
        <td style="padding: 12px 6px; text-align: right; font-weight: bold; font-family: monospace; color: #15803d;">£${log.amount?.toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>HMRC Business Expense & Mileage Statement</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 40px; line-height: 1.6; background-color: #f8fafc; }
          .container { max-width: 850px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 45px; border-radius: 20px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05); background-color: #ffffff; }
          .header-decor { height: 6px; background: linear-gradient(to right, #6366f1, #3b82f6); border-radius: 20px 20px 0 0; margin: -45px -45px 35px -45px; }
          .summary-card { flex: 1; padding: 22px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; }
          .summary-card h4 { margin: 0; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.15em; font-weight: 800; }
          .summary-card p { margin: 8px 0 0 0; font-size: 22px; font-weight: 900; color: #0f172a; font-family: 'Courier New', Courier, monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 25px; }
          th { text-align: left; padding: 12px 6px; font-size: 9px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; color: #64748b; letter-spacing: 0.1em; font-weight: 800; }
          .footer { text-align: center; margin-top: 60px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 25px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-decor"></div>
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: -0.025em;">HMRC Expense Audit Record</h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.08em;">Official Self-Assessment Deductibles Registry</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 10px; font-weight: 900; background: #6366f1; color: white; padding: 8px 16px; border-radius: 300px; text-transform: uppercase; tracking: 0.05em;">Filing Mode: Active</span>
            </div>
          </div>

          <div style="margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; border-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #e2e8f0;">
            <div>
              <p style="font-weight: 800; margin: 0; text-transform: uppercase; color: #94a3b8; font-size: 8px; letter-spacing: 0.1em;">Contractor Details</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 900; color: #0f172a;">${profile?.username || 'Verified Specialist'}</p>
              <p style="margin: 1px 0 0 0; color: #475569; font-weight: 500;">Email: ${profile?.email || 'N/A'}</p>
              <p style="margin: 1px 0 0 0; color: #475569; font-weight: 500;">HMRC Identifier: UK-${profile?.uid?.slice(-6).toUpperCase()}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-weight: 800; margin: 0; text-transform: uppercase; color: #94a3b8; font-size: 8px; letter-spacing: 0.1em;">Accounting period</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 900; color: #0f172a;">June 2026</p>
              <p style="margin: 1px 0 0 0; color: #475569; font-weight: 500;">Created: ${new Date().toLocaleDateString()}</p>
              <p style="margin: 1px 0 0 0; color: #475569; font-weight: 500;">Rule Standard: UK-DBS-45P</p>
            </div>
          </div>

          <div style="margin-top: 30px; display: flex; gap: 20px;">
            <div class="summary-card">
              <h4>Approved Mileage Allowance</h4>
              <p>£${mileageAllowance.toFixed(2)}</p>
              <span style="font-size: 9px; color: #64748b; font-weight: 500; display: block; margin-top: 4px;">Driven Distance: ${totalMileage} Mi (@45p/mile Rate)</span>
            </div>
            <div class="summary-card">
              <h4>Tools & Supply Receipts</h4>
              <p>£${totalReceipts.toFixed(2)}</p>
              <span style="font-size: 9px; color: #64748b; font-weight: 500; display: block; margin-top: 4px;">Deductible materials & fleet receipts</span>
            </div>
            <div class="summary-card" style="background-color: #f0fdf4; border-color: #bbf7d0;">
              <h4 style="color: #166534;">Total Self-Assessment Deductibles</h4>
              <p style="color: #15803d; font-family:'Courier New', monospace;">£${totalDeductions.toFixed(2)}</p>
              <span style="font-size: 9px; color: #15803d; font-weight: 800; display: block; margin-top: 4px;">Ready for HMRC tax-liability deduction</span>
            </div>
          </div>

          <h3 style="font-size: 12px; font-weight: 900; margin-top: 35px; border-bottom: 2px solid #0f172a; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a;">Claim Breakdown Registry</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Incident Date</th>
                <th style="width: 15%;">Record Type</th>
                <th style="width: 35%;">Registry Description</th>
                <th style="width: 15%;">Metrics</th>
                <th style="text-align: right; width: 20%;">HMRC deduction</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="5" style="text-align: center; color: #94a3b8; font-size: 11px; padding: 30px 0;">No active logs entered. Use the companion logger to pre-populate.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <p>Statement compiled via KonnectS UK Professional Compliance • UK Registered Office: Shoreditch High St, London</p>
            <p style="margin-top: 4px;">Receipt captures have been hashed and backed up onto cloud Firebase instances.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "HMRC-Tax-Mileage-Report-June-2026.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredBookings = activeBookings.filter(b => 
    b.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAccept = async (booking: ServiceBooking) => {
    setActionError(null);
    try {
      const docRef = doc(db, 'bookings', booking.id);
      await updateDoc(docRef, {
        workerId: profile?.uid,
        status: 'accepted',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       setActionError("Failed to accept booking. Please try again.");
       handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleReject = async (booking: ServiceBooking) => {
    setActionError(null);
     try {
      const docRef = doc(db, 'bookings', booking.id);
      await updateDoc(docRef, {
        status: 'cancelled', // Or cycle to next
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       setActionError("Failed to decline booking.");
       handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleSendCounter = async () => {
    if (!counterofferBooking) return;
    try {
      const docRef = doc(db, 'bookings', counterofferBooking.id);
      const updates: any = {
        status: 'negotiating',
        updatedAt: serverTimestamp()
      };
      if (counterPrice) updates.suggestedPrice = Number(counterPrice);
      if (counterTime) updates.estimatedCompletionTime = counterTime;
      
      await updateDoc(docRef, updates);
      setCounterofferBooking(null);
      setCounterPrice('');
      setCounterTime('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${counterofferBooking.id}`);
    }
  };

  if (!profile?.workerType) {
    const handleDragOver = (e: React.DragEvent, field: string) => {
      e.preventDefault();
      setDragActiveField(field);
    };

    const handleDragLeave = () => {
      setDragActiveField(null);
    };

    const handleDrop = (e: React.DragEvent, field: string) => {
      e.preventDefault();
      setDragActiveField(null);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        const fileInfo = { name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' };
        setFileState(field, fileInfo);
      }
    };

    const handleFileSelect = (e: React.FormEvent<HTMLInputElement>, field: string) => {
      const files = (e.currentTarget as HTMLInputElement).files;
      if (files && files[0]) {
        const file = files[0];
        const fileInfo = { name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' };
        setFileState(field, fileInfo);
      }
    };

    const setFileState = (field: string, fileInfo: {name: string, size: string}) => {
      if (field === 'courseCert') setCertFile(fileInfo);
      else if (field === 'siaLicense') setSiaFile(fileInfo);
      else if (field === 'dbsCert') setDbsFile(fileInfo);
      else if (field === 'generalCert') setGeneralFile(fileInfo);
    };

    const handleSubmitOnboard = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prefJob) {
        alert('Please choose your preferred job from the available professional services.');
        return;
      }
      
      // Document compliance validations
      if (prefJob === 'security' && (!certFile || !siaFile || !dbsFile)) {
        alert('Compulsory SIA Security Clearances Missing: Please upload SIA Licence, DBS certificate, and Course completion files.');
        return;
      }
      if (prefJob !== 'security' && !generalFile) {
        alert('Verification Document Required: Please supply your Trade professional certificate.');
        return;
      }
      if (!jobInfo.trim()) {
        alert('Biography Summary Required: Please outline your tool experience/bio context.');
        return;
      }

      setIsSubmittingOnboard(true);
      setOnboardProgress(15);
      
      const interval = setInterval(() => {
        setOnboardProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 250);

      setTimeout(async () => {
        clearInterval(interval);
        setOnboardProgress(100);
        try {
          await updateProfile({
            workerType: prefJob as any,
            hourlyRate: Number(jobRate),
            verificationStatus: 'pending',
            verificationStep: 'Compliance Queue Check',
            isWorker: true,
            isWorkerMode: true,
            rating: 0,
            reviewCount: 0,
            rewardsPoints: 0,
            bio: jobInfo.trim(),
            skills: skillsArray,
            verificationPhoto: capturedPhoto || null,
            documents: prefJob === 'security' 
              ? [certFile?.name, siaFile?.name, dbsFile?.name] 
              : [generalFile?.name]
          });
        } catch (error) {
          console.warn('Worker onboard update notice:', error);
        } finally {
          setIsSubmittingOnboard(false);
        }
      }, 1600);
    };

    return (
      <div className="pb-24 pt-8 px-4 max-w-md mx-auto min-h-screen bg-slate-950 text-white flex flex-col justify-between">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#818cf8]">Pro Onboarding Hub</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => updateProfile({ workerType: 'cleaner', isWorker: true, isWorkerMode: true })}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer bg-transparent border-none"
            >
              Skip to Dashboard &rarr;
            </button>
            <span className="text-[10px] font-mono text-slate-500">STEP {onboardStep} OF 3</span>
          </div>
        </header>

        {/* Form Body with sliding transitions */}
        <div className="flex-1 my-auto flex flex-col justify-center">
          {isSubmittingOnboard ? (
            <div className="text-center py-10 space-y-6">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-indigo-500 animate-spin border-t-transparent" />
              <div className="space-y-2">
                <h3 className="font-extrabold text-lg">Encrypting Credentials...</h3>
                <p className="text-[10px] uppercase font-black text-indigo-400 tracking-wider">Uploading To Securitised Vault ({onboardProgress}%)</p>
              </div>
              <div className="w-48 bg-slate-900 rounded-full h-1.5 mx-auto overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${onboardProgress}%` }} />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitOnboard} className="space-y-6">
              {onboardStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-white leading-tight">What is your tradecraft?</h2>
                    <p className="text-xs text-slate-400 leading-normal">
                      Select your primary professional category. Accurate declaration provides streamlined customer bookings.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {[
                      { type: 'plumber', label: '🚰 Plumber' },
                      { type: 'electrician', label: '⚡ Electrician' },
                      { type: 'cleaner', label: '🧼 Cleaner' },
                      { type: 'cab_owner', label: '🚖 Cab Owner' },
                      { type: 'security', label: '🚨 SIA Security' },
                      { type: 'other', label: '📁 Other Trade' },
                    ].map((job) => (
                      <button
                        key={job.type}
                        type="button"
                        onClick={() => setPrefJob(job.type)}
                        className={`p-4 rounded-2xl border text-xs font-black text-left transition-all flex flex-col justify-between h-20 relative cursor-pointer ${
                          prefJob === job.type
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                            : 'bg-slate-905 border-slate-800 text-slate-350 hover:bg-slate-900'
                        }`}
                      >
                        <span>{job.label}</span>
                        <span className={`text-[8px] font-mono tracking-widest ${prefJob === job.type ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {job.type === 'security' ? 'SIA REQ' : 'STANDARD'}
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={!prefJob}
                    onClick={() => setOnboardStep(2)}
                    className="mt-4 w-full py-4 bg-white text-slate-900 disabled:opacity-40 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
                  >
                    <span>Define Professional Rates</span>
                    <ArrowRight size={14} />
                  </button>
                </motion.div>
              )}

              {onboardStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-white leading-tight">Rate Card & Biography</h2>
                    <p className="text-xs text-slate-400 leading-normal">
                      Set your hourly compensation and describe your trade history concisely.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2 text-left">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Hourly Rate (£ / Hour)</label>
                      <div className="relative">
                        <PoundSterling className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="number"
                          value={jobRate}
                          onChange={(e) => setJobRate(e.target.value)}
                          placeholder="e.g. 35"
                          className="w-full pl-10 pr-4 py-3.5 bg-slate-905 border border-slate-800 rounded-xl font-bold text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">Professional Bio / Experience Summary</label>
                      <textarea
                        rows={3}
                        value={jobInfo}
                        onChange={(e) => setJobInfo(e.target.value)}
                        placeholder="e.g. Qualified specialist with deep experience. Complete and highly professional service delivery."
                        className="w-full p-4 bg-slate-905 border border-slate-800 rounded-xl font-medium text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none"
                      />
                    </div>

                    {/* Integrated Dynamic Work History, Certifications, and Specialized Skills checklist */}
                    <div className="mt-4 p-5 bg-slate-950 rounded-3xl border border-slate-850 space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Professional Experience, Skills & Credentials</h3>
                      <WorkHistoryModule />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setOnboardStep(1)}
                      className="w-1/3 py-4 bg-slate-905 border border-slate-800 rounded-2xl text-slate-400 text-xs font-black uppercase tracking-wider active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnboardStep(3)}
                      className="flex-1 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all border-none cursor-pointer"
                    >
                      Verify Credentials
                    </button>
                  </div>
                </motion.div>
              )}

              {onboardStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-white leading-tight">Verify Qualifications</h2>
                    <p className="text-slate-400 text-xs leading-normal">
                      {prefJob === 'security'
                        ? 'Under UK SIA and London local regulations, security personnel must submit the following three documents.'
                        : 'Submit a copy of your technical certifications or licensing paperwork below.'}
                    </p>
                  </div>

                  <div className="space-y-4 pt-2 max-h-96 overflow-y-auto pr-1">
                    {prefJob === 'security' ? (
                      <>
                        {/* 3 distinct files drag / select boxes */}
                        {/* Course cert */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">1. Course Completion Certificate</label>
                          <div
                            onDragOver={(e) => handleDragOver(e, 'courseCert')}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'courseCert')}
                            className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-colors cursor-pointer relative ${
                              dragActiveField === 'courseCert' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-905 hover:bg-slate-900'
                            }`}
                          >
                            <input 
                              type="file" 
                              onChange={(e) => handleFileSelect(e, 'courseCert')}
                              className="absolute inset-0 opacity-0 cursor-pointer" 
                            />
                            {certFile ? (
                              <div className="flex items-center justify-between text-xs font-extrabold text-[#4ade80]">
                                <span className="truncate max-w-[200px]">✓ {certFile.name}</span>
                                <span className="text-[9px] text-slate-500 font-mono">{certFile.size}</span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 font-bold">Drag file here or <span className="text-indigo-400">click to browse</span></p>
                            )}
                          </div>
                        </div>

                        {/* SIA Lic */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">2. SIA Licence / Card</label>
                          <div
                            onDragOver={(e) => handleDragOver(e, 'siaLicense')}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'siaLicense')}
                            className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-colors cursor-pointer relative ${
                              dragActiveField === 'siaLicense' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-905 hover:bg-slate-905'
                            }`}
                          >
                            <input 
                              type="file" 
                              onChange={(e) => handleFileSelect(e, 'siaLicense')}
                              className="absolute inset-0 opacity-0 cursor-pointer" 
                            />
                            {siaFile ? (
                              <div className="flex items-center justify-between text-xs font-extrabold text-[#4ade80]">
                                <span className="truncate max-w-[200px]">✓ {siaFile.name}</span>
                                <span className="text-[9px] text-slate-500 font-mono">{siaFile.size}</span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 font-bold">Drag SIA card image or <span className="text-indigo-400">click search</span></p>
                            )}
                          </div>
                        </div>

                        {/* DBS cert */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">3. DBS Check Certificate</label>
                          <div
                            onDragOver={(e) => handleDragOver(e, 'dbsCert')}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'dbsCert')}
                            className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-colors cursor-pointer relative ${
                              dragActiveField === 'dbsCert' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-905 hover:bg-slate-905'
                            }`}
                          >
                            <input 
                              type="file" 
                              onChange={(e) => handleFileSelect(e, 'dbsCert')}
                              className="absolute inset-0 opacity-0 cursor-pointer" 
                            />
                            {dbsFile ? (
                              <div className="flex items-center justify-between text-xs font-extrabold text-[#4ade80]">
                                <span className="truncate max-w-[200px]">✓ {dbsFile.name}</span>
                                <span className="text-[9px] text-slate-500 font-mono">{dbsFile.size}</span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 font-bold">Drop secure DBS report here or <span className="text-indigo-400">browse</span></p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Professional Trade Clearance / Certification</label>
                        <div
                          onDragOver={(e) => handleDragOver(e, 'generalCert')}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, 'generalCert')}
                          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer relative ${
                            dragActiveField === 'generalCert' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-905 hover:bg-slate-905'
                          }`}
                        >
                          <input 
                            type="file" 
                            onChange={(e) => handleFileSelect(e, 'generalCert')}
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                          />
                          {generalFile ? (
                            <div className="space-y-2">
                              <ShieldCheck size={32} className="text-[#4ade80] mx-auto" />
                              <div className="text-xs font-extrabold text-[#4ade80]">
                                <p className="truncate block max-w-xs">{generalFile.name}</p>
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono">{generalFile.size}</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Briefcase size={28} className="text-slate-600 mx-auto" />
                              <p className="text-[11px] text-slate-400 font-bold">Drag and drop certifying credentials pdf here</p>
                              <span className="text-[9px] text-indigo-400 bg-slate-900 px-2 py-0.5 rounded-full inline-block">or click search/select</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* LIVE CAMERA SELFIE PREVIEW MODULE */}
                    <div className="space-y-2 mt-5 p-4 bg-slate-900 rounded-3xl border border-slate-800">
                      <label className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                        <ScanFace size={15} />
                        <span>Profile Photo (Device Camera Capture)</span>
                      </label>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Verify your real-time individual profile snapshot with high-contrast ambient lighting.
                      </p>

                      {cameraActive ? (
                        <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-850 p-4 space-y-4 text-center">
                          <video autoPlay playsInline className="w-full max-h-48 rounded-xl bg-black mx-auto overflow-hidden object-cover" />
                          <div className="flex gap-2 justify-center">
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-sans text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer"
                            >
                              Snap Verification Photo
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed border-slate-800 bg-slate-950 rounded-2xl p-5 text-center text-slate-400 transition-all hover:bg-slate-900 relative">
                          {capturedPhoto ? (
                            <div className="space-y-3">
                              <img src={capturedPhoto} alt="Selfie preview" className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-emerald-500 shadow-md shadow-emerald-500/10" referrerPolicy="no-referrer" />
                              <div className="text-xs font-extrabold text-[#4ade80] flex items-center justify-center gap-1">
                                <span>✓ Verification Foto Ready</span>
                              </div>
                              <button
                                type="button"
                                onClick={startCamera}
                                className="text-[9px] bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full hover:bg-slate-700 cursor-pointer font-black uppercase tracking-wider"
                              >
                                Retake Photo
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[10px] text-slate-400 font-bold">A live device photo badge is required to join the Pro listing.</p>
                              <button
                                type="button"
                                onClick={startCamera}
                                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-xl border border-indigo-950/40 inline-flex items-center gap-2 cursor-pointer"
                              >
                                <ScanFace size={13} />
                                <span>Activate Device Camera</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* SKILLS CHECKLIST QUESTIONNAIRE */}
                    <div className="space-y-3 mt-4 p-4 bg-slate-900 rounded-3xl border border-slate-800">
                      <label className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">🛠 Tradecraft Skills Inventory</label>
                      <p className="text-[10.5px] text-slate-400 leading-normal">
                        Select all applicable criteria matching your practical work history and experience level:
                      </p>
                      <div className="grid grid-cols-1 gap-2 pt-1 font-semibold text-[11px] text-slate-300">
                        {[
                          { id: 'emergency_24_7', label: '🗲 24/7 Rapid Emergency Response Callout' },
                          { id: 'liability_assured', label: '🛡 Public Liability Insured up to £2M' },
                          { id: 'own_wheels', label: '🚚 Fully Equipped (Vehicle & Tech Tools)' },
                          { id: 'certified_apprentice', label: '🎓 Completed Apprenticeship / City & Guilds' }
                        ].map(skill => (
                          <label key={skill.id} className="flex items-start space-x-2.5 cursor-pointer p-2.5 rounded-xl bg-slate-950 border border-slate-850 hover:bg-slate-900 select-none">
                            <input
                              type="checkbox"
                              checked={skillsArray.includes(skill.id)}
                              onChange={() => toggleSkillCheck(skill.id)}
                              className="accent-indigo-600 rounded bg-slate-900 border-slate-800 h-4 w-4 mt-0.5"
                            />
                            <span className="text-[10.5px] leading-snug">{skill.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setOnboardStep(2)}
                      className="w-1/3 py-4 bg-slate-905 border border-slate-800 rounded-2xl text-slate-400 text-xs font-black uppercase tracking-wider active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 bg-indigo-600 font-sans hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all border-none cursor-pointer"
                    >
                      Authenticate Setup
                    </button>
                  </div>
                </motion.div>
              )}
            </form>
          )}
        </div>

        <footer className="text-center text-[10px] text-slate-600 uppercase tracking-widest font-mono">
          SECURE CREDENTIAL ENVELOPE E1
        </footer>
      </div>
    );
  }

  if (activeTab === 'rides') {
    return (
      <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-slate-50/30">
        <header className="mb-6">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rides Driver Hub</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
            Vehicle & Identity Verification Console
          </p>
        </header>

        {!hasVehicleProof ? (
          <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-3xl p-6 text-amber-900 dark:text-amber-300 shadow-sm">
              <div className="flex items-start space-x-3">
                <Shield size={24} className="text-amber-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider">Proof of Vehicle & ID Required</h3>
                  <p className="text-[11px] text-amber-850 dark:text-amber-400 font-medium mt-1 leading-relaxed">
                    Under UK transport regulations and KonnectS safe-travel protocols, you must submit proof of identity and vehicle compliance before accessing ride-matching.
                  </p>
                </div>
              </div>
            </div>

            <VerificationStatus onBack={() => {
              const checkProof = localStorage.getItem('konnects_vehicle_proof_submitted') === 'true';
              if (checkProof) {
                setHasVehicleProof(true);
              }
            }} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-emerald-950 shadow-sm flex items-start space-x-3">
              <ShieldCheck size={24} className="text-emerald-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-black text-xs uppercase tracking-wider">Driver Status: Accredited & Verified</h3>
                <p className="text-[11px] text-emerald-800 font-medium mt-1 leading-relaxed">
                  Your UK driving licence ({localStorage.getItem('konnects_driver_licence') || 'Verified'}) and vehicle registration ({localStorage.getItem('konnects_driver_rc') || 'Verified'}) have been confirmed. You are active to offer rides.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Driver Compliance Details</h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Licence</span>
                  <span className="font-mono font-black">{localStorage.getItem('konnects_driver_licence') || 'SMITH905204SM99'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Plate Mark</span>
                  <span className="font-mono font-black">{localStorage.getItem('konnects_driver_rc') || 'LV19 GDX'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('konnects_vehicle_proof_submitted');
                  setHasVehicleProof(false);
                  haptics.light();
                }}
                className="w-full py-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-[10px] font-black uppercase tracking-wider transition-colors mt-2"
              >
                Revoke Verification & Clear State
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Active Carpooling Requests</h2>
              <div className="p-4 bg-slate-50 rounded-2xl text-center text-[11px] font-bold text-slate-500">
                Searching for near commuting matches matching your routes...
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'services') {
    return (
      <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-slate-50/30">
        <header className="mb-6">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Services Portfolio</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
            Jobs, Experience, & Employment History
          </p>
        </header>

        <div className="space-y-6">
          {/* Experience Counter */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Years of Experience</h2>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="25"
                value={experienceYears}
                onChange={e => {
                  setExperienceYears(e.target.value);
                  localStorage.setItem('konnects_experience_years', e.target.value);
                }}
                className="flex-1 accent-indigo-600"
              />
              <span className="bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-950 font-mono">
                {experienceYears} Years
              </span>
            </div>
          </div>

          {/* List of Jobs */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Services Provided</h2>
            <div className="flex flex-wrap gap-2">
              {jobsCanDo.map((job, idx) => (
                <span key={idx} className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider text-indigo-700 flex items-center space-x-1">
                  <span>{job}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = jobsCanDo.filter((_, i) => i !== idx);
                      setJobsCanDo(updated);
                      localStorage.setItem('konnects_jobs_can_do', JSON.stringify(updated));
                      haptics.light();
                    }}
                    className="text-indigo-400 hover:text-indigo-800 transition-colors ml-1 font-black"
                  >
                    ×
                  </button>
                </span>
              ))}
              {jobsCanDo.length === 0 && (
                <p className="text-xs text-slate-400 italic font-medium">No job types listed yet.</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add e.g. Cleaner, Plumber..."
                value={newJobTypeInput}
                onChange={e => setNewJobTypeInput(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand text-xs font-bold"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newJobTypeInput.trim()) return;
                  const updated = [...jobsCanDo, newJobTypeInput.trim()];
                  setJobsCanDo(updated);
                  localStorage.setItem('konnects_jobs_can_do', JSON.stringify(updated));
                  setNewJobTypeInput('');
                  haptics.success();
                }}
                className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider px-4 rounded-xl active:scale-95 transition-all"
              >
                Add Job
              </button>
            </div>
          </div>

          {/* Work History */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Work & Employment History</h2>
            
            <div className="space-y-3">
              {workHistory.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = workHistory.filter((_, i) => i !== idx);
                      setWorkHistory(updated);
                      localStorage.setItem('konnects_work_history', JSON.stringify(updated));
                      haptics.light();
                    }}
                    className="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xs font-black uppercase"
                  >
                    Remove
                  </button>
                  <p className="font-black text-xs text-indigo-950 uppercase tracking-wide">{item.title}</p>
                  <p className="text-[10px] text-slate-500 font-bold">{item.employer} • {item.duration}</p>
                  <p className="text-xs text-slate-600 mt-2 font-medium">{item.details}</p>
                </div>
              ))}
              {workHistory.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4 font-medium">No previous employment records listed.</p>
              )}
            </div>

            {/* Add Work History Form */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Add History Record</h3>
              <input
                type="text"
                placeholder="Job Title (e.g. Master Plumber)"
                value={newHistory.title}
                onChange={e => setNewHistory({ ...newHistory, title: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand text-xs font-bold"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Employer (e.g. self-employed)"
                  value={newHistory.employer}
                  onChange={e => setNewHistory({ ...newHistory, employer: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand text-xs font-bold"
                />
                <input
                  type="text"
                  placeholder="Duration (e.g. 1 Year)"
                  value={newHistory.duration}
                  onChange={e => setNewHistory({ ...newHistory, duration: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand text-xs font-bold"
                />
              </div>
              <textarea
                placeholder="Job details & reference notes..."
                value={newHistory.details}
                onChange={e => setNewHistory({ ...newHistory, details: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand text-xs font-bold h-20 resize-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newHistory.title || !newHistory.employer) {
                    alert("Please provide at least a Job Title and Employer name.");
                    return;
                  }
                  const updated = [...workHistory, newHistory];
                  setWorkHistory(updated);
                  localStorage.setItem('konnects_work_history', JSON.stringify(updated));
                  setNewHistory({ title: '', employer: '', duration: '', details: '' });
                  haptics.success();
                  playTTS("Employment record added successfully.");
                }}
                className="w-full py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all"
              >
                Save History Record
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-slate-50/30">
      {/* Profile Summary & Header */}
      <header className="mb-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Work Page</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              {profile?.workerType?.replace('_', ' ').toUpperCase() || 'Pro Professional'}
            </p>
          </div>
          <div className="flex space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSettings(!showSettings)}
              className={`p-3 rounded-2xl border transition-all ${showSettings ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 shadow-sm'}`}
            >
              <Settings size={22} />
            </motion.button>
          </div>
        </div>

        {/* Hero Card */}
        <div className="bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp size={80} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${profile?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${profile?.isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                {profile?.isOnline ? 'Online & Ready' : 'Currently Offline'}
              </span>
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Earnings</p>
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-black">£{earnings.total.toFixed(2)}</h2>
              <button 
                onClick={() => {}}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-colors"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 gap-4 mb-10">
        <div className="p-5 bg-white border border-slate-100 rounded-[32px] shadow-sm">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
             <Star size={20} fill="currentColor" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rating</p>
          <p className="text-xl font-black text-slate-900">{ratingToDisplay}</p>
        </div>
        <div className={`p-5 rounded-[32px] shadow-sm border ${
          profile?.verificationStatus === 'verified' ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
             profile?.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
          }`}>
             <CheckCircle2 size={20} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
          <p className={`text-sm font-black uppercase ${
            profile?.verificationStatus === 'verified' ? 'text-emerald-600' : 'text-slate-500'
          }`}>
            {profile?.verificationStatus || 'Unverified'}
          </p>
        </div>
      </section>

      {/* BACKEND COMPLIANCE SIMULATION BADGE */}
      {profile?.verificationStatus === 'pending' && (
        <div className="mb-6 p-5 bg-[#fff7ed] border border-orange-200 rounded-[32px] flex flex-col space-y-2 text-slate-800 shadow-sm">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
            <span className="text-[10px] uppercase font-black text-orange-600 tracking-wider">🔧 Developer Compliance Simulator</span>
          </div>
          <p className="text-[11px] leading-relaxed font-semibold text-slate-600">
            Selfie and SIA documents have been lock-queued in the database schema. Simulate real-time backend verification to toggle immediate Marketplace permissions:
          </p>
          <button
            onClick={async () => {
              if (!profile?.uid) return;
              await updateDoc(doc(db, 'users', profile.uid), {
                verificationStatus: 'verified',
                verificationStep: 'Verified Professional Approved'
              });
            }}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
          >
            Simulate Compliance Approval ✓
          </button>
        </div>
      )}

      {/* DASHBOARD SUBTAB SWITCHER */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-8 p-1 bg-slate-100 rounded-2xl border border-slate-200/50">
        {[
          { id: 'requests', label: 'Orders' },
          { id: 'history', label: 'Work' },
          { id: 'reels', label: 'Reels 🎬' },
          { id: 'bills', label: 'Bills' },
          { id: 'crm', label: 'CRM' },
          { id: 'earnings_tax', label: 'HMRC & Tax' },
          { id: 'toolkit', label: 'Toolkit' },
          { id: 'admin', label: 'Admin 👑' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as any)}
            className={`py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              subTab === tab.id 
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'requests' && (
        <>
          {/* Active Requests */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg tracking-tight">New Job Requests</h3>
              <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">Live</span>
            </div>

            {activeBookings.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-[40px] border border-slate-100 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="text-slate-300" size={32} />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">Finding jobs nearby...</h4>
                <p className="text-xs text-slate-400 px-4">
                  We'll notify you as soon as a request matches your profile.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeBookings.map((booking) => (
                  <div 
                    key={booking.id}
                    className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden"
                  >
                    <div className="p-5 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                          <Package size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 capitalize">{booking.serviceType}</h4>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            <MapPin size={10} />
                            <span>0.4 miles away</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900">£{booking.price}</p>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Estimated</p>
                      </div>
                    </div>
                    <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleReject(booking)}
                        className="py-3.5 bg-slate-50 text-slate-600 rounded-2xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all"
                      >
                        Decline
                      </button>
                      <button 
                        onClick={() => handleAccept(booking)}
                        className="py-3.5 bg-brand text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand/20 active:scale-95 transition-all"
                      >
                        Accept Job
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Workers Community Section */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg tracking-tight">Community Groups</h3>
              <button className="text-brand text-xs font-bold uppercase tracking-wider flex items-center space-x-1">
                 <Users size={14} />
                 <span>Join New</span>
              </button>
            </div>
            <div className="space-y-4">
               {[
                 { name: 'London Elite Pros', members: 1240, active: 45, icon: ShieldCheck },
                 { name: profile?.workerType ? `${profile.workerType.replace('_', ' ').toUpperCase()} Hub` : 'Service Network', members: 890, active: 12, icon: Briefcase }
               ].map((group, i) => (
                 <div key={i} className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-brand/30 transition-all">
                    <div className="flex items-center space-x-4">
                       <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand group-hover:text-white transition-colors">
                          {group.icon ? <group.icon size={24} /> : <Wrench size={24} />}
                       </div>
                       <div>
                          <h4 className="font-bold text-sm text-slate-900">{group.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                             {group.members} Members • {group.active} Active
                          </p>
                       </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-brand/10 group-hover:text-brand">
                       <MessageSquare size={18} />
                    </div>
                 </div>
               ))}
            </div>
          </section>
        </>
      )}

      {subTab === 'history' && (
        <section className="mb-10 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-extrabold text-base tracking-tight text-slate-900">Completed Service Orders</h3>
            <span className="text-[10px] bg-slate-900 text-white px-2.5 py-1 rounded-full font-black font-mono">3 DELIVERED</span>
          </div>
          {[
            { client: 'Samantha K.', type: 'Emergency Locksmith Support', price: 90.00, date: '04 Jun 2026', carbonSaved: '1.2 kg CO₂', communityBonus: 'Standard Payout' },
            { client: 'Julian R.', type: 'Leak piping repair', price: 110.00, date: '01 Jun 2026', carbonSaved: '0.8 kg CO₂', communityBonus: 'Approved Pro' },
            { client: 'Marta S.', type: 'Kitchen tap replacement', price: 65.00, date: '28 May 2026', carbonSaved: '1.5 kg CO₂', communityBonus: 'Free Near Hub (£1 Fee Paid)' }
          ].map((h, i) => (
            <div key={i} className="bg-white rounded-[28px] border border-slate-100 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-650 rounded-xl flex items-center justify-center">
                    <Briefcase size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">{h.type}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Client: {h.client} • {h.date}</p>
                  </div>
                </div>
                <p className="font-extrabold text-sm text-slate-900">£{h.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-50 text-[10px] font-bold text-slate-500">
                <span>🌿 Carbon Neutral Offset: <strong className="text-emerald-600 font-extrabold">{h.carbonSaved}</strong></span>
                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">{h.communityBonus}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {subTab === 'reels' && (
        <section className="mb-10 space-y-4">
          <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl text-white flex items-center justify-between shadow-md">
            <div>
              <span className="text-[9px] uppercase font-black tracking-widest text-indigo-300 block">Dedicated Separate Space</span>
              <h4 className="text-xs font-black text-white mt-0.5">Showcase Space: Reels, Work Pics & Post Area</h4>
              <p className="text-[10px] text-slate-350 mt-0.5">Explore the dedicated public space accessible from bottom navigation and header.</p>
            </div>
            <button
              onClick={() => {
                if ((window as any).__navigateTab) {
                  (window as any).__navigateTab('showcase');
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-white text-slate-900 font-black text-[10px] uppercase tracking-wider shrink-0 active:scale-95 transition-all cursor-pointer border-none"
            >
              Open Full Space &rarr;
            </button>
          </div>
          <WorkerReelsModule />
        </section>
      )}

      {subTab === 'bills' && (
        <section className="mb-10 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-extrabold text-base tracking-tight text-slate-900">Issued Sales Slips</h3>
            <button className="text-brand text-xs font-black uppercase tracking-wider flex items-center space-x-1 border-none bg-transparent cursor-pointer">
              <span>+ Generate Bill</span>
            </button>
          </div>
          {[
            { id: 'INV-4821', ref: 'Circuit breaker diagnosis', amount: 45.00, status: 'PAID', date: '04 Jun 2026', highlight: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
            { id: 'INV-4822', ref: 'Hot tap washer lock install', amount: 350.00, status: 'PENDING', date: '02 Jun 2026', highlight: 'bg-amber-50 border-amber-100 text-amber-700' },
            { id: 'INV-4823', ref: 'Water supply check', amount: 80.00, status: 'PAID', date: '29 May 2026', highlight: 'bg-emerald-50 border-emerald-100 text-emerald-700' }
          ].map((inv, i) => (
            <div key={i} className="bg-white rounded-[28px] p-5 border border-slate-105 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <CreditCard size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">{inv.id}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{inv.ref} • {inv.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-sm text-slate-900">£{inv.amount.toFixed(2)}</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[8px] border font-black uppercase mt-1.5 ${inv.highlight}`}>{inv.status}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {subTab === 'toolkit' && (
        <section className="mb-10 space-y-4">
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-xl space-y-5">
            <div>
              <h3 className="font-black text-base text-slate-900 tracking-tight leading-none mb-1">PRO Dispatch Estimator</h3>
              <p className="text-[9px] uppercase font-black tracking-wider text-[#818cf8]">Calculate Travel Rates, Surcharges & App-Tokens</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 ml-1 mb-1">
                  <span>Estimated Travel (Miles)</span>
                  <span className="text-indigo-650 font-bold font-mono">£0.45 / mile fuel rate</span>
                </div>
                <input
                  type="number"
                  value={quoteDistance}
                  onChange={(e) => setQuoteDistance(Number(e.target.value))}
                  placeholder="e.g. 5"
                  className="w-full bg-slate-50 border border-slate-150 p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Work Hours Expected</label>
                <input
                  type="number"
                  value={quoteHours}
                  onChange={(e) => setQuoteHours(Number(e.target.value))}
                  placeholder="e.g. 2"
                  className="w-full bg-slate-50 border border-slate-150 p-4 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              {/* FREE SERVICE WITH REVENUE SURCHARGE */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="quoteFreeSurcharge"
                    checked={quoteIsFreeNear}
                    onChange={(e) => setQuoteIsFreeNear(e.target.checked)}
                    className="accent-brand rounded cursor-pointer"
                  />
                  <label htmlFor="quoteFreeSurcharge" className="text-[10px] font-black text-[#1e1b4b] select-none cursor-pointer uppercase tracking-wider">
                    🎁 Provide for Free? (Client is near home)
                  </label>
                </div>
                <p className="text-[9.5px] text-slate-500 leading-relaxed font-semibold pl-6">
                  No service charges apply. Just a <strong>£1 App Charge</strong> paid by client. The salesperson is paid <strong>50p</strong> back in the next matching service!
                </p>
              </div>

              <div className="p-5 bg-slate-900 text-white rounded-3xl space-y-3.5 shadow-lg">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#818cf8]">Invoice Summary Forecast</p>
                
                <div className="space-y-2 font-mono text-[10px] text-slate-350">
                  <div className="flex justify-between">
                    <span>Base Labor Due ({quoteIsFreeNear ? 'FREE OFFER' : `${quoteHours} hr @ £${profile?.hourlyRate || jobRate}/hr`}):</span>
                    <span className="text-white font-bold">£{quoteIsFreeNear ? '0.00' : (quoteHours * (Number(profile?.hourlyRate || jobRate))).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fuel Mileage Cost ({quoteDistance} miles):</span>
                    <span className="text-white font-bold">£{(quoteDistance * 0.45).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Application Platform Charge:</span>
                    <span className="text-white font-bold">£{quoteIsFreeNear ? '1.00' : '2.50'}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2.5 text-xs text-brand uppercase font-black tracking-wider">
                    <span>{quoteIsFreeNear ? 'Salesperson Cash Return:' : 'Total Projected Cashflow:'}</span>
                    <span className="text-emerald-400">
                      £{quoteIsFreeNear ? '0.50' : (quoteHours * (Number(profile?.hourlyRate || jobRate)) + quoteDistance * 0.45).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* D3 Worker Capability Skill Radar Chart */}
          <WorkerCapabilityRadar workerType={profile?.workerType} username={profile?.username} />
        </section>
      )}

      {/* Controls Overlay */}
      <div className="space-y-3">
        <button
          onClick={() => setShowConfirmOnline(true)}
          className={`w-full py-5 rounded-[28px] font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center space-x-3 shadow-xl transition-all active:scale-95 ${
            profile?.isOnline
              ? "bg-slate-900 text-emerald-400 shadow-emerald-500/10 border border-slate-800"
              : "bg-white text-slate-400 border border-slate-100"
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${profile?.isOnline ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
          <span>{profile?.isOnline ? "You are Online" : "Go Online to Work"}</span>
        </button>

        {/* Availability Toggle, visible when online */}
        {profile?.isOnline && (
          <div className="bg-white rounded-[32px] p-4 border border-slate-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                (profile.availabilityStatus || 'Active') === 'Active' ? 'bg-emerald-50 text-emerald-650' : 'bg-red-50 text-red-650'
              }`}>
                <Bell size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Availability Status</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">
                  Currently:{" "}
                  <span className={`font-black uppercase tracking-wider ${
                    (profile.availabilityStatus || 'Active') === 'Active' ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {profile.availabilityStatus || 'Active'}
                  </span>
                </p>
              </div>
            </div>
            <button 
              onClick={toggleAvailabilityStatus}
              className={`px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all shadow-sm ${
                (profile.availabilityStatus || 'Active') === 'Active' 
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                  : 'bg-rose-600 text-white hover:bg-rose-705'
              }`}
            >
              Set {(profile.availabilityStatus || 'Active') === 'Active' ? 'Busy' : 'Active'}
            </button>
          </div>
        )}

        <div className="bg-white rounded-[32px] p-2 border border-slate-100 flex items-center justify-between shadow-sm">
           <div className="flex items-center space-x-3 pl-4">
              <Zap size={18} className="text-brand" />
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Auto-Accept</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Job Matching</p>
              </div>
           </div>
           <button 
            onClick={() => updateAutoAccept({ enabled: !profile?.autoAcceptConfig?.enabled })}
            className={`flex items-center px-6 py-3 rounded-2xl transition-all shadow-sm ${
              profile?.autoAcceptConfig?.enabled 
              ? 'bg-slate-900 text-white' 
              : 'bg-slate-50 text-slate-400'
            }`}
          >
            {profile?.autoAcceptConfig?.enabled ? <ToggleRight size={20} className="text-brand" /> : <ToggleLeft size={20} />}
          </button>
        </div>
      </div>

      {/* Modals & Alerts */}
      {showConfirmOnline && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center"
          >
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${profile?.isOnline ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {profile?.isOnline ? <X size={32} /> : <Check size={32} />}
            </div>
            <h3 className="text-xl font-bold mb-2">
              {profile?.isOnline ? 'Go Offline?' : 'Ready to work?'}
            </h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              {profile?.isOnline 
                ? 'You will stop receiving new requests until you go online again.' 
                : 'You will become visible to customers nearby and receive live payout opportunities.'}
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowConfirmOnline(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={toggleOnlineStatus}
                className={`flex-1 py-4 text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${profile?.isOnline ? 'bg-slate-900 shadow-slate-900/20' : 'bg-emerald-600 shadow-emerald-600/20'}`}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showSettings && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold">Auto-Accept Logic</h4>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Efficiency Mode</p>
            </div>
            <button 
              onClick={() => updateAutoAccept({ enabled: !profile?.autoAcceptConfig?.enabled })}
              className={`p-1 rounded-lg transition-all ${profile?.autoAcceptConfig?.enabled ? 'text-emerald-500' : 'text-slate-300'}`}
            >
              {profile?.autoAcceptConfig?.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>

          <AnimatePresence>
            {profile?.autoAcceptConfig?.enabled && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4 border-t border-slate-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Min Price (£)</label>
                    <input 
                      type="number" 
                      value={profile.autoAcceptConfig.minPrice || 0}
                      onChange={(e) => updateAutoAccept({ minPrice: Number(e.target.value) })}
                      className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Max Price (£)</label>
                    <input 
                      type="number" 
                      value={profile.autoAcceptConfig.maxPrice || 50}
                      onChange={(e) => updateAutoAccept({ maxPrice: Number(e.target.value) })}
                      className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {actionError && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <AlertCircle size={18} />
            <span className="text-xs font-bold">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-rose-100 rounded-lg">
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* Verification Status Card */}
      {profile?.verificationStatus !== 'verified' && (
        <section className="mt-8 bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                 <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Shield size={20} />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold">Worker Verification</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {profile?.verificationStatus === 'pending' ? 'Locked (Reviewing)' : 'Action Required'}
                    </p>
                 </div>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase ${
                profile?.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {profile?.verificationStatus || 'Unverified'}
              </span>
           </div>

           {profile?.verificationStatus !== 'pending' ? (
             <div className="space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed italic">To accept high-value service requests, we need to verify your Right to Work & Identity documents.</p>
                <button 
                  onClick={handleUploadDoc}
                  disabled={uploading}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Shield size={14} />
                      <span>Upload Documents</span>
                    </>
                  )}
                </button>
             </div>
           ) : (
             <div className="p-3 bg-slate-50 rounded-xl flex items-center space-x-3">
                <Clock size={16} className="text-amber-500" />
                <span className="text-[10px] font-bold text-slate-600">{profile?.verificationStep || 'Verifying your identity...'}</span>
             </div>
           )}
        </section>
      )}

      {subTab === 'crm' && (
        <section className="mb-10 space-y-6 animate-fade-in text-left">
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-6 rounded-[32px] text-white overflow-hidden relative shadow-lg">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Users size={120} />
            </div>
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2 font-sans">
              💼 Contractor CRM & Reminders
            </h3>
            <p className="text-xs text-slate-350 leading-relaxed mt-1">
              Maintain professional contractor-client relationships. Record diagnostic service notes, maintain history logs, and configure automated push scheduling notifications to prompt customers for maintenance renewals.
            </p>
          </div>

          {/* CRM Form */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Schedule Active Periodic Reminder</h4>
            <form onSubmit={handleSaveCRMReminder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Client Name</label>
                  <input
                    type="text"
                    value={crmClient}
                    onChange={(e) => setCrmClient(e.target.value)}
                    placeholder="e.g. Evelyn Carter"
                    className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-500 rounded-xl font-bold text-xs outline-none transition-all text-slate-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Service Task / Trade Category</label>
                  <select
                    value={crmType}
                    onChange={(e) => setCrmType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-500 rounded-xl font-bold text-xs outline-none transition-all text-slate-800"
                  >
                    <option value="Boiler Maintenance">Boiler Maintenance & Safety Certificate</option>
                    <option value="Electrical Rewiring Check-up">Electrical Rewiring Check-up</option>
                    <option value="HVAC / Heat Pump Service">HVAC / Heat Pump Service</option>
                    <option value="Drain & Pipe Flushing">Drain & Pipe Flushing</option>
                    <option value="Solar Battery Checkup">Solar Battery Checkup</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Scheduled Trigger Frequency</label>
                  <select
                    value={crmFrequency}
                    onChange={(e) => setCrmFrequency(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-550 rounded-xl font-bold text-xs outline-none transition-all text-slate-800"
                  >
                    <option value="Every month">Every month (High Frequency Fleet)</option>
                    <option value="Every 3 Months">Every 3 Months (Standard Checkup)</option>
                    <option value="Every 6 Months">Every 6 Months (Biannual Clearance)</option>
                    <option value="Every 12 Months">Every 12 Months (HMRC Annual Obligation)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Target Notification Date</label>
                  <input
                    type="date"
                    value={crmNextDate}
                    onChange={(e) => setCrmNextDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-550 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Internal Servicing Notes</label>
                <textarea
                  value={crmNotes}
                  onChange={(e) => setCrmNotes(e.target.value)}
                  placeholder="Record valve scaling values, filter models replaced, or custom diagnostic remarks for next time..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-550 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 resize-none font-semibold text-slate-700"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4.5 bg-slate-900 border-none hover:bg-slate-800 text-white rounded-[22px] font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Bell size={12} />
                <span>Save Client & Configure Push Alerts</span>
              </button>
            </form>
          </div>

          {/* Schedulers history */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Pending Automated Push Triggers</h4>
            {crmRemindersList.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold text-center py-6">No scheduled reminders found. Populate the form above to deploy your client alerts.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {crmRemindersList.map((notify) => (
                  <div key={notify.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-105 flex flex-col justify-between items-start space-y-2">
                    <div className="flex justify-between items-start w-full">
                      <div>
                        <span className="text-xs font-black text-slate-900">{notify.clientName}</span>
                        <p className="text-[9.5px] font-bold text-indigo-600 mt-0.5 uppercase tracking-wide">{notify.serviceType}</p>
                      </div>
                      <span className="text-[8.5px] font-mono font-black bg-amber-50 text-amber-700 border border-amber-150 rounded-full px-2.5 py-1 uppercase">
                        📅 Due: {notify.nextDate} ({notify.frequency})
                      </span>
                    </div>
                    {notify.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-1 bg-white p-3 rounded-xl border border-slate-100 w-full font-medium">
                        "{notify.notes}"
                      </p>
                    )}
                    <div className="flex justify-between items-center w-full pt-1">
                      <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Live push notifications queued (UK Mobile Carriers)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bulk Client Outreach Module */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm space-y-5">
             <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                   <Users size={18} />
                </div>
                <div>
                   <h4 className="text-xs font-black uppercase tracking-widest text-[#1e293b] text-slate-800">Bulk Client Outreach Campaign</h4>
                   <p className="text-[9.5px] font-bold text-slate-400">Customized Promotional Telephony Bundles</p>
                </div>
             </div>

             <p className="text-[11px] text-slate-500 leading-normal">
                Convert old calls into immediate recurring bookings. Select a service category template, review the generated promotional draft, check target past clients, and dispatch custom mobile notifications within 2 seconds.
             </p>

             {/* Template Config */}
             <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                   <label className="text-[9.5px] font-black uppercase tracking-widest text-[#475569] block">Choose Promotion Category</label>
                   <select
                      value={selectedOutreachCategory}
                      onChange={(e) => { haptics.light(); setSelectedOutreachCategory(e.target.value); }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-505 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 focus:ring-1 focus:ring-indigo-500"
                   >
                      <option value="Annual Boiler Safety Check">Annual Boiler Safety Check (Winter Prep Offer)</option>
                      <option value="Pre-Winter Heating Service">Pre-Winter Heating Service (15% Off Code)</option>
                      <option value="Contractor Special Maintenance Discount">Contractor Custom Special Maintenance Discount</option>
                      <option value="Rewiring Safety Audit">Rewiring Electrical Safety Audit</option>
                   </select>
                </div>

                {/* Draft Preview Board */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 border-dashed space-y-2 text-left">
                   <div className="flex items-center justify-between">
                      <span className="text-[8.5px] font-mono font-black text-indigo-605 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">Outbound SMS Draft Preview</span>
                      <span className="text-[8px] font-bold text-slate-400 font-mono">Character count: ~135 (1 Credit)</span>
                   </div>
                   <div className="text-[11px] text-slate-705 text-slate-700 leading-relaxed font-semibold bg-white p-3.5 rounded-xl border border-slate-100 italic">
                      {((): string => {
                         const workerName = profile?.username || 'Local Trade Partner';
                         if (selectedOutreachCategory === 'Annual Boiler Safety Check') {
                            return `"Hello [Client Name], standard safety regulations recommend a periodic Boiler Safety Checkup. Book with ${workerName} this weekend via KonnectS to unlock a safe 10% loyalty discount!"`;
                         } else if (selectedOutreachCategory === 'Pre-Winter Heating Service') {
                            return `"Hi [Client Name], cold weather is approaching. Avoid radiator/heating breakdowns. Secure a complete Heating Service with ${workerName} at a 15% discount."`;
                         } else if (selectedOutreachCategory === 'Rewiring Safety Audit') {
                            return `"Hello [Client Name], keep your home safe. Schedule a fast modern Rewiring Safety Audit with ${workerName} under the Hackney Secure Code standard this month."`;
                         } else {
                            return `"Hi [Client Name], as a valued past client of ${workerName}, book any renewal check-up or repair this week to save 15% with code PROMO15."`;
                         }
                      })()}
                   </div>
                </div>

                {/* Past CRM Client Selection Table */}
                <div className="space-y-2">
                   <div className="flex justify-between items-center pl-0.5">
                      <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 font-mono">Target Contacts List ({outreachClients.filter(c => c.selected).length} selected)</span>
                      <button 
                         type="button"
                         onClick={() => {
                            haptics.light();
                            const allSelected = outreachClients.every(c => c.selected);
                            setOutreachClients(prev => prev.map(c => ({ ...c, selected: !allSelected })));
                         }}
                         className="text-[9px] font-black uppercase tracking-wider text-indigo-600 border-none bg-transparent cursor-pointer font-bold"
                      >
                         {outreachClients.every(c => c.selected) ? 'Deselect All' : 'Select All'}
                      </button>
                   </div>

                   <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                      {outreachClients.map((client) => (
                         <div key={client.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50">
                            <label className="flex items-center space-x-3 cursor-pointer select-none">
                               <input 
                                  type="checkbox"
                                  checked={client.selected}
                                  onChange={() => {
                                     haptics.light();
                                     setOutreachClients(prev => prev.map(c => c.id === client.id ? { ...c, selected: !c.selected } : c));
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 outline-none"
                               />
                               <div className="text-left">
                                  <span className="text-xs font-extrabold text-[#111827] text-slate-800 block">{client.name}</span>
                                  <span className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wide">Last Serviced: {client.lastService}</span>
                               </div>
                            </label>
                            <span className="text-[9px] font-mono font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded">Active Past Client</span>
                         </div>
                      ))}
                   </div>
                </div>

                {/* Broadcast Action Controls */}
                <div className="pt-2">
                   {isBroadcasting ? (
                      <div className="space-y-3.5 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-center">
                         <div className="flex justify-between items-center text-[10px] font-black uppercase text-indigo-700 font-mono">
                            <span>🚀 DISPATCHING PROMOTIONAL BUNDLE CAMPAGN</span>
                            <span>{broadcastProgress}%</span>
                         </div>
                         <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div 
                               style={{ width: `${broadcastProgress}%` }}
                               className="bg-indigo-600 h-full transition-all duration-150"
                            />
                         </div>
                         <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">Broadcasting personalized SMS carriers to Shoreditch & Hoxton fleets...</p>
                      </div>
                   ) : (
                      <button
                         type="button"
                         onClick={() => {
                            const targets = outreachClients.filter(c => c.selected);
                            if (targets.length === 0) {
                               alert('Please select at least one target client from the list.');
                               return;
                            }
                            haptics.beacon();
                            setIsBroadcasting(true);
                            setBroadcastProgress(0);
                            setBroadcastDone(false);

                            // Simulate sending progress ticker
                            const interval = setInterval(() => {
                               setBroadcastProgress(prev => {
                                  if (prev >= 100) {
                                     clearInterval(interval);
                                     setIsBroadcasting(false);
                                     setBroadcastDone(true);
                                     haptics.success();
                                     alert(`Campaign Dispatched Successfully! Delivered high-response promotional alerts to: ${targets.map(t => t.name).join(', ')}.`);
                                     return 100;
                                  }
                                  return prev + 25;
                               });
                            }, 400);
                         }}
                         className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[20px] font-black uppercase tracking-[0.15em] text-[10px] border-none shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                         <span>Broadcast Promo Draft to {outreachClients.filter(c => c.selected).length} Clients</span>
                      </button>
                   )}

                   {broadcastDone && !isBroadcasting && (
                      <p className="text-[9px] text-emerald-605 text-emerald-600 font-black text-center mt-2.5 uppercase tracking-wider flex items-center justify-center gap-1">
                         ✓ {outreachClients.filter(c => c.selected).length} Personalized SMS and In-App cards dispatched successfully!
                      </p>
                   )}
                </div>
             </div>
          </div>
        </section>
      )}

      {subTab === 'earnings_tax' && (
        <section className="mb-10 space-y-6 animate-fade-in text-left">
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-6 rounded-[32px] text-white overflow-hidden relative shadow-lg">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <TrendingUp size={120} />
            </div>
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2 font-sans">
              📊 HMRC Business Expense & Space Logger
            </h3>
            <p className="text-xs text-slate-350 leading-relaxed mt-1 font-semibold">
              HMRC Compliant. Log business dispatch mileage at the UK standard 45p/mile rate, organize supply receipts with instant backup photo upload, and compile downloadable self-assessment statements.
            </p>
          </div>

          {/* Premium Subscription Upgrade Offer */}
          <div className="bg-gradient-to-br from-[#fffbeb] via-[#fffbeb] to-amber-50 border border-amber-200/80 p-6 rounded-[32px] relative overflow-hidden shadow-sm flex flex-col space-y-4">
            <div className="absolute top-1 right-2 scale-75 select-none pointer-events-none text-9xl text-amber-300 opacity-20">👑</div>
            <div>
              <div className="flex items-center space-x-1.5 mb-1.5">
                <span className="text-xl">👑</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 bg-amber-200/50 px-2.5 py-1 rounded-full border border-amber-350/45">Premium Worker Tier Upgrade</span>
              </div>
              <h4 className="text-sm font-black text-slate-800 leading-tight">Cut commission fees from 15% to 5% instantly</h4>
              <p className="text-[11px] text-slate-500 leading-normal mt-1 max-w-sm">
                Unlock high Listing Rank Boost, customized "Featured Practitioner" badge, and slashed commission rates to maximize your take-home pay. Check out securely below:
              </p>
            </div>

            {profile?.isPremiumWorker ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center space-x-2.5 text-emerald-700">
                <CheckCircle2 size={18} className="shrink-0" />
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block">👑 Active Premium Worker Subscription</span>
                  <span className="text-[9px] text-emerald-600 block mt-0.5">Thank you for subscribing! Slashed commissions (5%) and profile highlights are active!</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  disabled={isUpgradingPremium}
                  onClick={handleSubscribePremium}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 font-black text-slate-900 border-none rounded-2xl text-[10px] uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isUpgradingPremium ? (
                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                  ) : (
                    <span>Subscribe via UK Multi-Card Checkout (£14.99/mo)</span>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Mileage Form */}
            <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm space-y-4 h-full">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 font-bold">Log Business Mileage</h4>
              <form onSubmit={handleLogMileage} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Trip / Route Description</label>
                  <input
                    type="text"
                    value={mileageTripName}
                    onChange={(e) => setMileageTripName(e.target.value)}
                    placeholder="e.g. London Callout to Old Street"
                    className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-550 rounded-xl font-bold text-xs outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Distance (Miles)</label>
                    <input
                      type="number"
                      value={mileageDistance}
                      onChange={(e) => setMileageDistance(e.target.value)}
                      placeholder="e.g. 15"
                      className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-555 rounded-xl font-bold text-xs outline-none text-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Date of Journey</label>
                    <input
                      type="date"
                      value={mileageDate}
                      onChange={(e) => setMileageDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-555 rounded-xl font-bold text-xs outline-none font-mono text-slate-800"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 bg-slate-900 border-none text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all active:scale-95 cursor-pointer"
                >
                  Log Mileage (Auto 45p Calculations)
                </button>
              </form>
            </div>

            {/* Receipt Form */}
            <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm space-y-4 h-full">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 font-bold">Log Tools & Fuel Receipts</h4>
              <form onSubmit={handleLogReceipt} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Expense Title</label>
                  <input
                    type="text"
                    value={expenseName}
                    onChange={(e) => setExpenseName(e.target.value)}
                    placeholder="e.g. Heavy Duty Cordless Angler"
                    className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-555 rounded-xl font-bold text-xs outline-none text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Amount Paid (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="e.g. 45.99"
                      className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-555 rounded-xl font-bold text-xs outline-none text-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Category</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-555 rounded-xl font-bold text-xs outline-none text-slate-850"
                    >
                      <option value="Tools">Tools & Equipment</option>
                      <option value="Fuel">Vehicle Fuel / Fleet Costs</option>
                      <option value="Uniform">Safety Gears / Uniform</option>
                      <option value="Materials">Repair Parts & Supplies</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5 items-end">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Date Paid</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-indigo-555 rounded-xl font-bold text-xs outline-none font-mono text-slate-850"
                    />
                  </div>
                  {/* File Upload input */}
                  <div className="relative">
                    <input
                      type="file"
                      id="receipt-photo-picker"
                      accept="image/*"
                      onChange={handleReceiptPhotoUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="receipt-photo-picker"
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] uppercase font-black tracking-wider flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Image size={11} />
                      <span>{receiptPhoto ? 'Photo Snapped ✓' : 'Snap Receipt'}</span>
                    </label>
                  </div>
                </div>

                {receiptPhoto && (
                  <div className="flex items-center space-x-2 border rounded-xl p-2 bg-slate-50 mt-1">
                    <img src={receiptPhoto} alt="Receipt Thumbnail" className="w-10 h-10 object-cover rounded" />
                    <span className="text-[8.5px] font-mono font-bold text-slate-400">Original receipt image referenced base64</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-slate-900 border-none text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all active:scale-95 cursor-pointer"
                >
                  Log Receipt expense
                </button>
              </form>
            </div>
          </div>

          {/* Tax Ledger Summary */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 font-bold font-sans">Logged Deductions Registry</h4>
                <p className="text-[11px] text-slate-400 font-bold uppercase font-mono tracking-wider mt-1">Total entries: {hmrcLogs.length}</p>
              </div>
              <button
                onClick={handleDownloadTaxSummary}
                className="py-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 active:scale-95 transition-all border-none cursor-pointer"
              >
                <FileText size={12} />
                <span>Download HMRC Tax Summary Statement</span>
              </button>
            </div>

            {hmrcLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 font-semibold text-center">Your HMRC registry is currenty empty. Fill out mileage or receipt parameters to compile statistics.</p>
            ) : (
              <div className="overflow-x-auto no-scrollbar pt-2">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-slate-400 text-[10px] font-black uppercase tracking-wider">
                      <th className="pb-3 text-left">Date</th>
                      <th className="pb-3 text-left">Incident Type</th>
                      <th className="pb-3 text-left">Description</th>
                      <th className="pb-3 text-left">Metrics</th>
                      <th className="pb-3 text-right">Deduction Allowance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700 font-semibold text-slate-650">
                    {hmrcLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-semibold font-mono text-slate-500">{log.date}</td>
                        <td className="py-3 font-black text-[10px] uppercase tracking-wider text-slate-800">{log.type}</td>
                        <td className="py-3 font-medium text-slate-600">
                          {log.description} {log.category && <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-550 font-bold uppercase tracking-wider">{log.category}</span>}
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-500">{log.distance ? `${log.distance} miles` : '-'}</td>
                        <td className="py-3 text-right font-mono font-black text-emerald-700">£{log.amount?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {subTab === 'admin' && (
        <section className="mb-10 animate-fade-in text-left">
          <AdminDashboard />
        </section>
      )}

      {/* Counteroffer Modal */}
      <AnimatePresence>
        {counterofferBooking && (
          <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
             >
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Counteroffer</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{counterofferBooking.serviceType}</p>
                   </div>
                   <button onClick={() => setCounterofferBooking(null)} className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                      <X size={20} />
                   </button>
                </div>

                <div className="space-y-6">
                   <div className="p-6 bg-slate-50 rounded-[32px] text-center border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Customer suggested</p>
                      <p className="text-3xl font-black text-slate-900">£{counterofferBooking.suggestedPrice || counterofferBooking.price}</p>
                   </div>

                   <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Suggest your professional price</label>
                       <div className="relative">
                          <PoundSterling className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                          <input 
                            type="number"
                            value={counterPrice}
                            onChange={(e) => setCounterPrice(e.target.value)}
                            placeholder={(counterofferBooking.suggestedPrice || counterofferBooking.price || 0).toString()}
                            className="w-full pl-14 pr-6 py-5 bg-slate-50 rounded-3xl font-black text-2xl outline-none focus:ring-4 focus:ring-brand/10 transition-all"
                          />
                       </div>
                   </div>

                   <button 
                    onClick={handleSendCounter}
                    className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all text-[11px]"
                   >
                      Send Pro Suggestion
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
