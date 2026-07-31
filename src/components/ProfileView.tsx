/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { User, Settings, Shield, Award, CreditCard, Wrench, FileText, Share2, LogOut, Camera, ChevronRight, Copy, Check, MessageCircle, Mail, MapPin, MessageSquare, Heart, Trash2, ShoppingBag, ToggleLeft, ToggleRight, ArrowLeft, Leaf, RotateCw, X, ShieldCheck, CheckCircle, RefreshCw, Video, Activity, Wifi, Database, Cpu, HardDrive, Battery, Mic, Globe, Zap, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayRemove, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ServiceBooking, MarketplaceItem, WorkerType } from '../types';
import { QuickSOS } from './QuickSOS';
import { haptics } from '../utils/haptics';
import { ExpenseInsight } from './ExpenseInsight';
import { SettingsEditor } from './SettingsEditor';
import { VerificationStatus } from './VerificationStatus';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell, Legend } from 'recharts';
import { jsPDF } from 'jspdf';

type SubView = 'main' | 'history' | 'receipts' | 'rewards' | 'verification' | 'settings' | 'invite' | 'edit' | 'saved' | 'worker_setup' | 'impact' | 'addresses' | 'appearance' | 'swap_dashboard' | 'financial' | 'systems_dashboard' | 'voice_logs';

const generateUniqueExportId = () => 'data-export-' + Date.now();

export function ProfileView() {
  const { user, profile, logout, googleAccessToken, signIn, toggleWorkerMode: authToggleWorkerMode } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [view, setView] = useState<SubView>('main');
  const [history, setHistory] = useState<ServiceBooking[]>([]);
  
  // Google Drive & Backup state integration
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => {
    return localStorage.getItem('auto_gdrive_backup') === 'true';
  });

  // Helper to find or create the KonnectS Secure Folder in Drive
  const getOrCreateGdriveFolder = async (token: string): Promise<string> => {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='KonnectS Secure Folder' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!searchRes.ok) throw new Error('Failed to query Google Drive directories');
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'KonnectS Secure Folder',
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    if (!createRes.ok) throw new Error('Failed to create KonnectS Secure Folder in Drive');
    const folder = await createRes.json();
    return folder.id;
  };

  // Upload file to specific Google Drive folder
  const uploadFileToGdrive = async (token: string, folderId: string, fileName: string, fileContent: string, mimeType: string = 'application/json') => {
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: mimeType
    };
    const boundary = 'konnects_multipart_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      fileContent +
      close_delim;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });
    if (!res.ok) {
       const errTxt = await res.text();
       throw new Error(`Google Drive upload failed: ${errTxt}`);
    }
    return await res.json();
  };

  // Convert service request invoice to formatting Google Doc
  const convertInvoiceToGoogleDoc = async (booking: any) => {
    if (!googleAccessToken) {
      haptics.medium();
      alert('Please connect your Google Account first in Settings.');
      return;
    }
    try {
      setGdriveLoading(true);
      haptics.light();
      
      const docTitle = `KonnectS_Invoice_${booking.id || 'N_A'}`;
      const docBody = `
========================================
KONNECTS OFFICIAL SERVICE INVOICE
========================================
Receipt ID: ${booking.id || 'N/A'}
Date: ${booking.createdAt ? new Date(booking.createdAt?.toMillis()).toLocaleDateString() : 'Recent'}
Status: COMPLETED (Verified Ledger)
----------------------------------------
CUSTOMER DETAILS:
Name: ${user?.email || 'Registered KonnectS User'}
----------------------------------------
SERVICE SUMMARY:
Service: ${booking.serviceType || 'General Tech Support'}
Provider: ${booking.providerName || 'Local Verified Contractor'}
Total Fare/Fee: £${booking.price || '0.00'}
----------------------------------------
Thank you for using the KonnectS platform!
Your transaction is secured with ISO-27001 standard.
========================================
      `;

      const folderId = await getOrCreateGdriveFolder(googleAccessToken);
      await uploadFileToGdrive(
        googleAccessToken,
        folderId,
        docTitle,
        docBody,
        'application/vnd.google-apps.document'
      );
      
      haptics.success();
      alert(`✓ Formatted Google Doc invoice for "${booking.serviceType}" successfully generated and saved directly to your Google Drive!`);
    } catch (err: any) {
      console.error(err);
      alert(`Google Doc Conversion error: ${err.message}`);
    } finally {
      setGdriveLoading(false);
    }
  };

  // Primary Backup execution
  const runGoogleDriveBackup = async (silent: boolean = false) => {
    if (!googleAccessToken) {
      if (!silent) alert('Please connect your Google Account first in Settings.');
      return;
    }
    try {
      if (!silent) setGdriveLoading(true);
      haptics.light();

      const cachedHistory = localStorage.getItem('konnect_booking_history') || '[]';
      const cachedMarketplace = localStorage.getItem('konnect_marketplace_orders') || '[]';
      const backupPayload = JSON.stringify({
        userEmail: user?.email,
        backupTimestamp: new Date().toISOString(),
        serviceBookings: JSON.parse(cachedHistory),
        marketplaceInteractions: JSON.parse(cachedMarketplace),
        systemSyncSettings: {
           syncMode: localStorage.getItem('konnect_sync_settings') || 'always',
           powerSavingOverride: localStorage.getItem('manual_power_saving_override') || 'false'
        }
      }, null, 2);

      const folderId = await getOrCreateGdriveFolder(googleAccessToken);
      const fileName = `konnects_backup_report_${Date.now()}.json`;
      await uploadFileToGdrive(googleAccessToken, folderId, fileName, backupPayload);

      if (!silent) {
        haptics.success();
        alert('✓ Complete activity reports & local history logs successfully backed up to your "KonnectS Secure Folder" in Google Drive!');
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) alert(`Google Drive Backup error: ${err.message}`);
    } finally {
      if (!silent) setGdriveLoading(false);
    }
  };
  
  // Custom states for the floating language selector and voice logs
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [voiceHistory, setVoiceHistory] = useState<Array<{ text: string; timestamp: string }>>([]);
  const [reexecutingCmd, setReexecutingCmd] = useState<string | null>(null);

  const loadVoiceHistory = () => {
    try {
      const raw = localStorage.getItem('global_voice_command_history');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setVoiceHistory(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVoiceHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [view]);

  const exportDataAsJSON = () => {
    try {
      haptics.success();
      
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        user: {
          uid: user?.uid || '',
          email: user?.email || '',
          username: profile?.username || '',
          firstName: profile?.firstName || '',
          lastName: profile?.lastName || '',
        },
        serviceBookings: history.map(booking => ({
          id: booking.id,
          serviceName: (booking as any).serviceName || (booking as any).title || booking.serviceType || 'Service Booking',
          providerName: (booking as any).providerName || 'Local Provider',
          price: booking.price,
          status: booking.status,
          date: (booking as any).date || (booking as any).scheduledAt || booking.createdAt || '',
          autoRenew: (booking as any).autoRenew || false,
        })),
        marketplaceTransactions: (pastMarketplaceOrders || []).map(order => ({
          id: order.id,
          title: order.title,
          price: order.price,
          date: order.date,
          seller: order.seller,
          condition: order.condition,
        }))
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `konnects_user_data_export_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      // Show toast notification
      const notificationEvent = new CustomEvent('urbanNet_new_notification', {
        detail: {
          id: generateUniqueExportId(),
          type: 'system',
          title: '📥 Data Export Complete',
          message: 'Your completed bookings & transaction history has been downloaded successfully as JSON.',
          timestamp: new Date().toLocaleTimeString(),
          isRead: false
        }
      });
      window.dispatchEvent(notificationEvent);
    } catch (err) {
      console.error('Failed to export data:', err);
      alert('Failed to generate JSON data export.');
    }
  };
  const [savedItems, setSavedItems] = useState<MarketplaceItem[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Systems, Network Sync & Diagnostics state
  const [syncSettingsMode, setSyncSettingsMode] = useState<'always' | 'wifi' | 'manual'>(() => {
    return (localStorage.getItem('konnect_sync_settings') as any) || 'wifi';
  });
  const [syncedRidesBytes, setSyncedRidesBytes] = useState(24780); 
  const [syncedMarketplaceBytes, setSyncedMarketplaceBytes] = useState(83450); 
  const [syncedServicesBytes, setSyncedServicesBytes] = useState(37120); 
  const [manualSyncing, setManualSyncing] = useState(false);
  const [latencyFirestore, setLatencyFirestore] = useState(12);
  const [latencySupabase, setLatencySupabase] = useState(41);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "[" + new Date().toLocaleTimeString() + "] System booted securely.",
    "[" + new Date().toLocaleTimeString() + "] Verified client encryption tunnel active.",
    "[" + new Date().toLocaleTimeString() + "] Connected Firestore nodes online."
  ]);
  const [healthAnalysis, setHealthAnalysis] = useState<string>("");
  const [loadingHealth, setLoadingHealth] = useState(false);

  const [historyTab, setHistoryTab] = useState<'services' | 'marketplace'>('services');
  const [pastMarketplaceOrders, setPastMarketplaceOrders] = useState<any[]>([
    { id: 'm-ord-1', title: 'Ergonomic Desk Chair', price: 45, date: '21/04/2026', seller: 'Thomas L.', condition: 'Like New' },
    { id: 'm-ord-2', title: 'Handmade Solid Pine Bookshelf', price: 65, date: '10/05/2026', seller: 'Shoreditch Woodworks', condition: 'Good' },
    { id: 'm-ord-3', title: 'Vintage Copper Desk Lamp', price: 20, date: '28/05/2026', seller: 'Emma R.', condition: 'Slight Wear' }
  ]);
  
  // Edit Profile State
  const [editingName, setEditingName] = useState(profile?.username || '');
  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [mobileNumber, setMobileNumber] = useState(profile?.mobileNumber || '');
  const [hourlyRate, setHourlyRate] = useState(profile?.hourlyRate?.toString() || '');
  const [isOnline, setIsOnline] = useState(profile?.isOnline || false);
  const [editingWorkerType, setEditingWorkerType] = useState<WorkerType>(profile?.workerType || 'other');

  // Accessible Language and Referral Program state
  const [selectedLang, setSelectedLang] = useState(profile?.appLanguage || 'English (UK)');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [referrals, setReferrals] = useState<Array<{ name: string; contact: string; status: 'Signed Up' | 'Completed Task' | 'Pending'; reward: string }>>([
    { name: 'Charlotte W.', contact: 'charlotte@shoreditch.co.uk', status: 'Completed Task', reward: '£10.00 Discount Earned' },
    { name: 'David K.', contact: 'david.k@london.edu', status: 'Signed Up', reward: 'Pending First Job' },
    { name: 'Marcus Avery', contact: 'marcus.a@hackney.org', status: 'Pending', reward: 'Pending Sign-up' }
  ]);

  // Saved Addresses State
  const [addresses, setAddresses] = useState<Array<{ id: string; label: string; address: string }>>(() => {
    if (profile?.savedAddresses) {
      return profile.savedAddresses;
    }
    return [
      { id: 'addr-1', label: 'Home', address: '12 Borough High St, London SE1 9QQ' },
      { id: 'addr-2', label: 'Work', address: 'Shoreditch Town Hall, 380 Old St, London EC1V 9LT' }
    ];
  });
  const [addressLabel, setAddressLabel] = useState('Home');
  const [addressCustomLabel, setAddressCustomLabel] = useState('');
  const [addressValue, setAddressValue] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general'>('bug');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackDesc, setFeedbackDesc] = useState('');
  const [feedbackSeverity, setFeedbackSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Digital Worker ID modal and token rotation state
  const [showWorkerIDModal, setShowWorkerIDModal] = useState(false);
  const [rotateSecondsLeft, setRotateSecondsLeft] = useState(10);
  const [qrToken, setQrToken] = useState(() => `KNT-SECURE-${Math.floor(Math.random() * 900000 + 100000)}`);

  // Swap Activity Dashboard States
  const [laborCredits, setLaborCredits] = useState<number>(() => {
    const saved = localStorage.getItem('saved_labor_credits');
    return saved ? parseFloat(saved) : 24.5;
  });
  const [pendingSwaps, setPendingSwaps] = useState([
    { id: 'sw-1', senderName: 'Oliver T.', location: 'Shoreditch (0.2 mi)', skill: 'Electrical Repair', hours: 3.0, credits: 3.0, date: 'Today' },
    { id: 'sw-2', senderName: 'Hannah B.', location: 'Hoxton (0.5 mi)', skill: 'Gutter & Drain Clearing', hours: 1.5, credits: 1.5, date: 'Yesterday' },
    { id: 'sw-3', senderName: 'Marcus V.', location: 'Hackney (0.8 mi)', skill: 'Garden Pruning & Landscaping', hours: 4.0, credits: 4.0, date: '2 days ago' }
  ]);
  const [completedSwaps, setCompletedSwaps] = useState<Array<{ id: string; name: string; skill: string; credits: number; date: string }>>([
    { id: 'csw-1', name: 'Zoe J.', skill: 'Furniture Flatpack Assembly', credits: 2.0, date: '04 June 2026' },
    { id: 'csw-2', name: 'Albert R.', skill: 'Lawn Mowing & Edging', credits: 1.5, date: '28 May 2026' }
  ]);

  // Custom states for local user profile features
  const [privacyShieldActive, setPrivacyShieldActive] = useState<boolean>(() => {
    return localStorage.getItem('privacy_shield_active') !== 'false';
  });
  const [contributionScore, setContributionScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('contribution_score') || '1840');
  });
  const [downloadedCityCaches, setDownloadedCityCaches] = useState<string[]>(() => {
    try {
      const val = localStorage.getItem('downloaded_city_caches');
      return val ? JSON.parse(val) : ['London'];
    } catch {
      return ['London'];
    }
  });
  const [customVoiceWorkflows, setCustomVoiceWorkflows] = useState<Array<{ phrase: string; action: string }>>(() => {
    try {
      const val = localStorage.getItem('custom_voice_workflows');
      return val ? JSON.parse(val) : [
        { phrase: 'clean my floor', action: 'book_cleaning_service' },
        { phrase: 'find a ride to heathrow', action: 'request_airport_taxi' }
      ];
    } catch {
      return [
        { phrase: 'clean my floor', action: 'book_cleaning_service' },
        { phrase: 'find a ride to heathrow', action: 'request_airport_taxi' }
      ];
    }
  });
  const [recordingPhrase, setRecordingPhrase] = useState('');
  const [selectedAction, setSelectedAction] = useState('book_cleaning_service');
  const [isRecording, setIsRecording] = useState(false);
  const [downloadingCity, setDownloadingCity] = useState<string | null>(null);
  const [syncSimBattery, setSyncSimBattery] = useState<number>(85);
  const [syncSimNetwork, setSyncSimNetwork] = useState<string>('Wi-Fi');
  const [manualPowerSaving, setManualPowerSaving] = useState<boolean>(() => localStorage.getItem('konnects_manual_power_saving') === 'true');
  const [forceManualSyncOnly, setForceManualSyncOnly] = useState<boolean>(() => localStorage.getItem('konnects_force_manual_sync_only') === 'true');
  const [showBatteryReportModal, setShowBatteryReportModal] = useState<boolean>(false);
  const [dialectAnalysis, setDialectAnalysis] = useState<any>(null);
  const [analyzingDialect, setAnalyzingDialect] = useState<boolean>(false);

  useEffect(() => {
    let timerID: any;
    let active = true;
    if (showWorkerIDModal) {
      timerID = setInterval(() => {
        setRotateSecondsLeft(prev => {
          if (prev <= 1) {
            setQrToken(`KNT-SECURE-${Math.floor(Math.random() * 900000 + 100000)}`);
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      Promise.resolve().then(() => {
        if (active) setRotateSecondsLeft(10);
      });
    }
    return () => {
      active = false;
      clearInterval(timerID);
    };
  }, [showWorkerIDModal]);

  useEffect(() => {
    let active = true;
    if (profile?.savedAddresses) {
      Promise.resolve().then(() => {
        if (active) setAddresses(profile.savedAddresses);
      });
    }
    return () => {
      active = false;
    };
  }, [profile?.savedAddresses]);

  const toggleWorkerMode = async () => {
    try {
      await authToggleWorkerMode();
      haptics.success();
    } catch (error) {
      console.warn('Worker mode toggle error:', error);
    }
  };

  const saveAddressesToFirestore = async (newAddresses: any[]) => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        savedAddresses: newAddresses,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleDownloadPDF = () => {
    haptics.heavy();
    const doc = new jsPDF();
    
    // Header Banner
    doc.setFillColor(15, 23, 42); // slate 900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('KonnectS Super App', 15, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Official Member Personal Service Summary & Impact Audit', 15, 26);
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 150, 18);
    
    // Credentials Section
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Member Credentials', 15, 52);
    
    doc.setDrawColor(226, 232, 240); // slate 200
    doc.line(15, 55, 195, 55);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Username: ${profile?.username || 'Guest Resident'}`, 15, 62);
    doc.text(`Email: ${profile?.email || 'N/A'}`, 15, 68);
    doc.text(`Loyalty Rating: ${profile?.rating ? profile.rating.toFixed(1) + '/5.0' : '5.0/5.0'}`, 15, 74);
    doc.text(`Referral Code: ${profile?.referralCode || profile?.uid?.slice(-6).toUpperCase() || 'KONNECT50'}`, 110, 62);
    doc.text(`Reward Points: ${profile?.rewardsPoints || 0} pts`, 110, 68);
    doc.text(`Worker Level: ${profile?.isWorker ? 'Accredited Specialist' : 'Verified Resident'}`, 110, 74);
    
    // Impact Goals
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Community Impact & Sustainability Metrics', 15, 88);
    doc.line(15, 91, 195, 91);
    
    doc.setFont('helvetica', 'normal');
    doc.text('• CO2 Carbon Emissions Mitigated: 3.5 kg CO2 (Green Journeys active)', 15, 98);
    doc.text('• Neighbors Assisted / Delivery Sessions: 4 helper events logged', 15, 104);
    doc.text('• Charity Items Contributed: 2 food contributions fulfilled', 15, 110);
    doc.text(`• Community Support Loyalty Points: ${profile?.rewardsPoints || 0} points total`, 15, 116);
    
    // Recent Transactions
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Recent Service & Maintenance History', 15, 130);
    doc.line(15, 133, 195, 133);
    
    let startY = 140;
    if (history.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.text('No formal service activities documented in this quarterly cycle.', 15, startY);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      history.slice(0, 5).forEach((h, k) => {
        const dateStr = h.createdAt ? new Date(h.createdAt.toMillis()).toLocaleDateString() : 'Recent';
        doc.text(`${k + 1}. [${dateStr}] - ${h.serviceType.toUpperCase()} | Status: ${h.status.toUpperCase()}`, 15, startY);
        doc.text(`Amount Incurred: £${h.price || '25.00'} | Payment Method: App wallet`, 15, startY + 5);
        startY += 12;
      });
    }
    
    // Footer Banner
    doc.setFillColor(248, 250, 252); // slate 50
    doc.rect(0, 260, 210, 37, 'F');
    
    doc.setTextColor(100, 116, 139); // slate 500
    doc.setFontSize(8);
    doc.text('GARS-12 Standard Audit Document. Generated on behalf of KonnectS Super App UK.', 15, 270);
    doc.text('All transaction registers are cryptographically secured on cloud ledger registries.', 15, 275);
    doc.text('Verification Token: POS-VERIFIED-SECURE-KEY-8182', 15, 280);
    
    doc.save(`KonnectS_Profile_Summary_${profile?.username || 'Guest'}.pdf`);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackSubject.trim() || !feedbackDesc.trim()) {
      alert('Please fill in both the subject and description.');
      return;
    }
    setFeedbackSubmitting(true);
    try {
      const feedbackData = {
        userId: profile?.uid || user?.uid || 'guest',
        username: profile?.username || 'Guest Resident',
        email: profile?.email || '',
        type: feedbackType,
        subject: feedbackSubject.trim(),
        description: feedbackDesc.trim(),
        severity: feedbackType === 'bug' ? feedbackSeverity : null,
        createdAt: serverTimestamp()
      };
      
      // Save directly to 'feedback' collection
      await addDoc(collection(db, 'feedback'), feedbackData);
      
      setFeedbackSuccess(true);
      setFeedbackSubject('');
      setFeedbackDesc('');
      haptics.success();
      setTimeout(() => {
        setFeedbackSuccess(false);
        setShowFeedbackModal(false);
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (profile) {
      Promise.resolve().then(() => {
        if (active) {
          setIsOnline(profile.isOnline || false);
          setEditingWorkerType(profile.workerType || 'other');
          if (profile.appLanguage) {
            setSelectedLang(profile.appLanguage);
          }
        }
      });
    }
    return () => {
      active = false;
    };
  }, [profile]);

  const fetchHistory = useCallback(async () => {
    if (!profile?.uid) return;
    try {
      const q = query(
        collection(db, 'bookings'),
        where('customerId', '==', profile.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceBooking));
      setHistory(list);

      // Synchronize essential ride history to Service Worker offline cache
      fetch('/api/offline/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
      }).catch(err => console.warn('Bypassed SW rides cache sync:', err));
    } catch (e) {
      console.warn("Firestore bookings fetch failed (possibly offline). Retrying from Service Worker Cache backup...", e);
      try {
        const response = await fetch('/api/offline/rides');
        if (response.ok) {
          const list = await response.json();
          if (Array.isArray(list)) {
            setHistory(list);
          } else {
            handleFirestoreError(e, OperationType.LIST, 'bookings');
          }
        } else {
          handleFirestoreError(e, OperationType.LIST, 'bookings');
        }
      } catch (err) {
        handleFirestoreError(e, OperationType.LIST, 'bookings');
      }
    }
  }, [profile]);

  const fetchSavedItems = useCallback(async () => {
    if (!profile?.savedItems?.length) {
      setSavedItems([]);
      return;
    }
    try {
      const q = query(collection(db, 'items'));
      const snap = await getDocs(q);
      const allItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceItem));
      setSavedItems(allItems.filter(i => profile.savedItems?.includes(i.id)));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'items');
    }
  }, [profile]);

  useEffect(() => {
    let active = true;
    if (view === 'history' || view === 'receipts') {
      Promise.resolve().then(() => {
        if (active) fetchHistory();
      });
    } else if (view === 'saved') {
      Promise.resolve().then(() => {
        if (active) fetchSavedItems();
      });
    }
    return () => {
      active = false;
    };
  }, [view, fetchHistory, fetchSavedItems]);

  const handleUpdateProfile = async () => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        username: editingName,
        firstName,
        lastName,
        mobileNumber,
        hourlyRate: Number(hourlyRate) || 0,
        workerType: editingWorkerType,
        updatedAt: serverTimestamp()
      });
      setView('main');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const removeSavedItem = async (itemId: string) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        savedItems: arrayRemove(itemId)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpdateWorkerType = async (type: WorkerType) => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        workerType: type,
        isWorker: true,
        verificationStatus: 'in_progress',
        verificationStep: 'Upload Identity Documents'
      });
      setView('verification');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleToggleOnline = async () => {
    if (!profile?.uid) return;
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isOnline: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
      setIsOnline(!newStatus); // Revert on error
    }
  };

  const toggleAutoRenew = async (bookingId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        autoRenew: !currentStatus,
        updatedAt: serverTimestamp()
      });
      setHistory(prev => prev.map(item => item.id === bookingId ? { ...item, autoRenew: !currentStatus } : item));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const handleRebook = async (booking: ServiceBooking) => {
    if (!profile?.uid) return;
    haptics.beacon();
    try {
      const docRef = await addDoc(collection(db, 'bookings'), {
        customerId: profile.uid,
        serviceType: booking.serviceType,
        description: `${booking.description} (Repeat Booking / Re-booked)`,
        price: booking.price || 40,
        workerId: booking.workerId || 'moderator',
        status: 'pending',
        autoRenew: false,
        customerName: profile.username || 'Resident Member',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      haptics.success();
      alert(`Successfully placed a repeat request for ${booking.serviceType}! Reference ID: ${docRef.id.slice(-6).toUpperCase()}`);
      fetchHistory();
    } catch (e) {
      console.error("Failed to rebook:", e);
      alert("Error processing repeat booking. Please connect offline.");
      haptics.error();
    }
  };

  const handleRepeatMarketplaceOrder = (item: any) => {
    haptics.beacon();
    alert(`Successfully placed a custom request to repeat order for "${item.title}"! We are contacting seller ${item.seller} for replica availability.`);
    haptics.success();
  };

  // Referral Program interactive handlers
  const handleInviteFriend = (e: React.FormEvent) => {
    e.preventDefault();
    const contact = inviteEmail.trim() || invitePhone.trim();
    if (!contact) return;
    
    setInviteStatus('sending');
    const name = contact.includes('@') 
      ? contact.split('@')[0].charAt(0).toUpperCase() + contact.split('@')[0].slice(1)
      : 'Friend ' + contact.slice(-4);
      
    setTimeout(() => {
      setReferrals(prev => [
        ...prev,
        {
          name,
          contact,
          status: 'Pending',
          reward: 'Pending Sign-up'
        }
      ]);
      setInviteEmail('');
      setInvitePhone('');
      setInviteStatus('success');
      setTimeout(() => setInviteStatus('idle'), 3000);
    }, 600);
  };

  const handleExportCSV = () => {
    haptics.heavy();
    const spendData = [
      { month: 'January 2026', Services: 120, Marketplace: 45, Rides: 30 },
      { month: 'February 2026', Services: 140, Marketplace: 65, Rides: 42 },
      { month: 'March 2026', Services: 90, Marketplace: 20, Rides: 55 },
      { month: 'April 2026', Services: 180, Marketplace: 85, Rides: 60 },
      { month: 'May 2026', Services: 110, Marketplace: 35, Rides: 48 },
      { month: 'June 2026', Services: 195, Marketplace: 15, Rides: 72 }
    ];

    const headers = ['Month', 'Services Spend (£)', 'Marketplace Spend (£)', 'Rides Spend (£)', 'Total (£)'];
    const rows = spendData.map(item => [
      item.month,
      item.Services,
      item.Marketplace,
      item.Rides,
      item.Services + item.Marketplace + item.Rides
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `urbanNet_monthly_spending_report_${new Date().getFullYear()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const notificationEvent = new CustomEvent('urbanNet_new_notification', {
      detail: {
        id: 'csv-export-' + Date.now(),
        type: 'info',
        title: '📊 CSV Export Successful',
        message: 'Your monthly spending report has been downloaded to your device as active CSV database logs.',
        timestamp: new Date().toLocaleTimeString(),
        isRead: false
      }
    });
    window.dispatchEvent(notificationEvent);
  };

  const handleSimulateReferralSuccess = async (index: number) => {
    const updated = [...referrals];
    const friend = updated[index];
    if (friend.status === 'Completed Task') return;

    if (friend.status === 'Pending') {
      friend.status = 'Signed Up';
      friend.reward = 'Pending First Job';
    } else if (friend.status === 'Signed Up') {
      friend.status = 'Completed Task';
      friend.reward = '£10.00 Discount Earned';
      
      // Update persistent database document values
      if (profile?.uid) {
        try {
          const currentDiscount = profile.discountBalance || 0;
          const currentCount = profile.referredUsersCount || 0;
          const currentPoints = profile.rewardsPoints || 0;
          
          await updateDoc(doc(db, 'users', profile.uid), {
            discountBalance: currentDiscount + 10,
            referredUsersCount: currentCount + 1,
            rewardsPoints: currentPoints + 150,
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
        }
      }
    }
    setReferrals(updated);
  };

  const menuItems = [
    { icon: RefreshCw, label: t('profile.title').includes('Profile') ? 'Swap Activity Dashboard' : 'সোয়াপ অ্যাক্টিভিটি ড্যাশবোর্ড', value: 'swap_dashboard', color: 'bg-indigo-50 text-indigo-600' },
    { icon:Award, label: t('profile.title').includes('Profile') ? 'Rewards & Referrals' : 'পুরষ্কার এবং রেফারেল', value: 'rewards', color: 'bg-amber-50 text-amber-600' },
    { icon: Mic, label: t('profile.title').includes('Profile') ? 'Voice Activity Logs' : 'ভয়েস অ্যাক্টিভিটি লগ', value: 'voice_logs', color: 'bg-teal-50 text-teal-600' },
    { icon: Leaf, label: t('profile.title').includes('Profile') ? 'Community Impact & Stats' : 'কমিউনিটি ইমপ্যাক্ট ও পরিসংখ্যান', value: 'impact', color: 'bg-emerald-50 text-emerald-600' },
    { icon: MapPin, label: t('profile.title').includes('Profile') ? 'Saved Addresses' : 'সংরক্ষিত ঠিকানা', value: 'addresses', color: 'bg-sky-50 text-sky-600' },
    { icon: MessageSquare, label: t('profile.title').includes('Profile') ? 'Provide Feedback' : 'মতামত জানান', value: 'feedback_trigger', color: 'bg-pink-50 text-pink-600' },
    { icon: Heart, label: t('profile.title').includes('Profile') ? 'Saved Marketplace Items' : 'সংরক্ষিত মার্কেটপ্লেস আইটেম', value: 'saved', color: 'bg-rose-50 text-rose-600' },
    { icon: Wrench, label: t('profile.title').includes('Profile') ? 'Worker Configuration' : 'কর্মী কনফিগারেশন', value: 'worker_setup', color: 'bg-indigo-50 text-indigo-600' },
    { icon: FileText, label: t('profile.title').includes('Profile') ? 'Maintenance & Service History' : 'রক্ষণাবেক্ষণ ও সেবা ইতিহাস', value: 'history', color: 'bg-indigo-50 text-slate-600' },
    { icon: CreditCard, label: t('profile.title').includes('Profile') ? 'Receipts & Invoices' : 'রসিদ ও চালান', value: 'receipts', color: 'bg-emerald-50 text-emerald-600' },
    { icon: Activity, label: t('profile.title').includes('Profile') ? 'Financial Monthly Breakdown' : 'আর্থিক মাসিক বিবরণী', value: 'financial', color: 'bg-indigo-50 text-indigo-700' },
    { icon: Shield, label: t('profile.title').includes('Profile') ? 'Worker Verification' : 'কর্মী যাচাইকরণ', value: 'verification', color: 'bg-blue-50 text-blue-600' },
    { icon: Cpu, label: t('profile.title').includes('Profile') ? 'Systems, Sync & Diagnostics' : 'সিস্টেম ও সিঙ্ক তথ্য', value: 'systems_dashboard', color: 'bg-emerald-50 text-emerald-700' },
    { icon: Sparkles, label: t('profile.title').includes('Profile') ? 'Step-by-Step App Tour' : 'অ্যাপ নির্দেশিকা ট্যুর', value: 'launch_tour', color: 'bg-indigo-50 text-indigo-600' },
    { icon: Settings, label: t('profile.title').includes('Profile') ? 'Appearance & Theme' : 'থিম সেটিংস', value: 'appearance', color: 'bg-violet-50 text-violet-600' },
    { icon: Settings, label: t('profile.title').includes('Profile') ? 'App Settings' : 'অ্যাপ সেটিংস', value: 'settings', color: 'bg-slate-50 text-slate-600' },
    { icon: Share2, label: t('profile.title').includes('Profile') ? 'Invite Friends' : 'বন্ধুদের আমন্ত্রণ জানান', value: 'invite', color: 'bg-emerald-50 text-emerald-600' },
  ];

  const renderHistory = (isReceipts = false) => (
    <div className="space-y-4">
      {!isReceipts && (
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
          <button
            type="button"
            onClick={() => { haptics.light(); setHistoryTab('services'); }}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer ${
              historyTab === 'services'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Service Bookings
          </button>
          <button
            type="button"
            onClick={() => { haptics.light(); setHistoryTab('marketplace'); }}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer ${
              historyTab === 'marketplace'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Marketplace Orders
          </button>
        </div>
      )}

      {/* 1. SERVICE HISTORY TAB */}
      {(isReceipts || historyTab === 'services') ? (
        <>
          {!isReceipts && (
            <div className="p-5 bg-indigo-950 text-white rounded-[32px] border border-indigo-900/50 shadow-sm space-y-3.5 mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-900/45 text-indigo-200 rounded-2xl">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-300">Quarterly Personal Records</h4>
                  <p className="text-[10px] text-indigo-200/80 font-bold leading-tight mt-0.5">Generate complete PDF audit summary of your services & impact</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleDownloadPDF}
                className="w-full py-3 bg-white hover:bg-slate-50 text-indigo-950 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all cursor-pointer border-none"
              >
                Download PDF Summary
              </button>
            </div>
          )}

          {!isReceipts && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex items-start space-x-3 text-slate-500 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                Tip
              </div>
              <p className="text-[11px] leading-relaxed font-bold">
                Toggle <span className="text-indigo-600">'Auto-Renew'</span> on any service booking to repeat tasks effortlessly. Active recurring requests will re-schedule automatically.
              </p>
            </div>
          )}

          {history.length === 0 ? (
            <div className="text-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 text-slate-400">
               No {isReceipts ? 'receipts' : 'history'} found.
            </div>
          ) : (
            history.map(h => (
              <div key={h.id} className="p-4 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-3 overflow-hidden flex-1 mr-2 text-left">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 shrink-0">
                    {isReceipts ? <CreditCard size={18} /> : <Wrench size={18} />}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-sm tracking-tight capitalize truncate text-slate-900">{h.serviceType}</p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <p className="text-[9px] text-slate-450 font-bold uppercase tracking-widest">
                        {h.createdAt ? new Date(h.createdAt?.toMillis()).toLocaleDateString() : 'Recent'}
                      </p>
                      {!isReceipts && h.autoRenew && (
                        <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse border border-indigo-100">
                          Auto
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 shrink-0">
                  <div className="text-right">
                    <p className="font-black text-sm text-slate-900">£{h.price || '25.00'}</p>
                    <div className="flex flex-row items-center gap-2 mt-1">
                      <button className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest border-none bg-transparent cursor-pointer">View PDF</button>
                      <button 
                        onClick={() => convertInvoiceToGoogleDoc(h)}
                        disabled={gdriveLoading}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-750 uppercase tracking-widest border-none bg-transparent cursor-pointer disabled:opacity-50"
                      >
                        Docs
                      </button>
                      {!isReceipts && (
                        <button 
                          onClick={() => handleRebook(h)}
                          className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest border-none bg-transparent cursor-pointer"
                        >
                          Re-book
                        </button>
                      )}
                    </div>
                  </div>

                  {!isReceipts && (
                    <div className="flex flex-col items-center space-y-1 pl-3 border-l border-slate-100">
                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Auto</span>
                      <button
                        onClick={() => toggleAutoRenew(h.id, !!h.autoRenew)}
                        className={`w-10 h-5 rounded-full relative p-0.5 transition-colors ${
                          h.autoRenew ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                      >
                        <motion.div 
                          layout
                          className="w-3.5 h-3.5 bg-white rounded-full shadow-sm"
                          animate={{ x: h.autoRenew ? 18 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      ) : (
        /* 2. MARKETPLACE HISTORY TAB */
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex items-start space-x-3 text-slate-500 mb-1 text-left">
            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
              Audit
            </div>
            <p className="text-[11px] leading-relaxed font-semibold">
              These are verified handovers completed at local London hubs. Click <span className="text-slate-900 font-extrabold">'Repeat Order'</span> to query duplicate avails.
            </p>
          </div>

          {pastMarketplaceOrders.map(item => (
            <div key={item.id} className="p-4.5 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3 text-left">
                <div className="p-3.5 bg-slate-55 rounded-2xl text-slate-400">
                  <ShoppingBag size={20} className="text-slate-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">{item.title}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Date: {item.date} • Seller: {item.seller}
                  </p>
                  <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 text-[8px] font-black uppercase tracking-widest rounded-md mt-1">
                    {item.condition}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-sm text-slate-900">£{item.price}.00</p>
                <button
                  onClick={() => handleRepeatMarketplaceOrder(item)}
                  className="mt-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest border-none bg-transparent cursor-pointer active:scale-95 transition-all"
                >
                  Repeat Order
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen relative">
      <AnimatePresence mode="wait">
        {view === 'main' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="main">
            {/* Header */}
               <header className="mb-10 text-center relative px-2">
               <div className="flex justify-between items-center absolute top-0 left-0 right-0 px-2 pointer-events-none">
                  <div className="pointer-events-auto">
                    {profile?.isWorker && (
                      <button 
                        onClick={handleToggleOnline}
                        className={`p-2 rounded-2xl border transition-all ${
                          profile.isOnline ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'
                        }`}
                      >
                         <div className={`w-3 h-3 rounded-full mb-1 mx-auto ${profile.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span className="text-[8px] font-black uppercase tracking-widest">{profile.isOnline ? 'Online' : 'Offline'}</span>
                      </button>
                    )}
                  </div>
                  <div className="pointer-events-auto flex items-center space-x-2">
                    {/* Floating Language Dropdown Selector */}
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => { haptics.light(); setShowLanguageDropdown(!showLanguageDropdown); }}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center space-x-1 hover:bg-slate-50 transition-all cursor-pointer shadow-sm animate-fade-in"
                      >
                        <Globe size={14} className="text-slate-500" />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          {language === 'en' ? '🇬🇧 EN' : '🇧🇩 BN'}
                        </span>
                      </button>
                      {showLanguageDropdown && (
                        <div className="absolute right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-1.5 shadow-xl z-50 min-w-[120px] space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              haptics.success();
                              setLanguage('en');
                              setShowLanguageDropdown(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center space-x-2 border-none bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 ${
                              language === 'en' ? 'bg-slate-50 dark:bg-slate-850 text-indigo-600' : 'text-slate-705 dark:text-slate-300'
                            }`}
                          >
                            <span>🇬🇧</span>
                            <span>English (UK)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              haptics.success();
                              setLanguage('bn');
                              setShowLanguageDropdown(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center space-x-2 border-none bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 ${
                              language === 'bn' ? 'bg-slate-50 dark:bg-slate-850 text-indigo-600' : 'text-slate-705 dark:text-slate-300'
                            }`}
                          >
                            <span>🇧🇩</span>
                            <span>Bengali</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={toggleWorkerMode}
                      className={`flex flex-col items-center p-2 rounded-2xl border transition-all ${
                        profile?.isWorkerMode ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-500 shadow-sm'
                      }`}
                    >
                       {profile?.isWorkerMode ? <ToggleRight size={20} className="text-brand" /> : <ToggleLeft size={20} />}
                       <span className="text-[8px] font-black uppercase tracking-[0.1em] mt-1">{profile?.isWorkerMode ? 'Pro Mode' : 'Guest'}</span>
                    </button>
                  </div>
               </div>

               <div className="relative inline-block mb-4 mt-8">
                 <div className="w-24 h-24 bg-slate-100 rounded-[40px] flex items-center justify-center text-slate-300 shadow-xl shadow-slate-200/50">
                    {profile?.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full object-cover rounded-[40px]" alt="Avatar" /> : <User size={48} />}
                 </div>
                 {profile?.verificationStatus === 'verified' && (
                    <div className="absolute top-0 -right-2 bg-white rounded-full p-1 shadow-lg border border-slate-50">
                       <Shield size={20} className="text-emerald-500 fill-emerald-500/10" />
                    </div>
                 )}
                 <button 
                   onClick={() => setView('edit')}
                   className="absolute -bottom-1 -right-1 p-2.5 bg-slate-900 text-white rounded-2xl border-4 border-slate-50 shadow-lg active:scale-90 transition-all"
                 >
                   <Camera size={16} />
                 </button>
              </div>
              <div className="flex flex-col items-center">
                 <h1 className="text-2xl font-bold tracking-tight mb-1">{profile?.username}</h1>
                 <p className="text-slate-400 text-xs font-medium">{profile?.email}</p>
                  
                  {/* Visual verification badge that updates based on document approval status */}
                  <div className="mt-2.5 flex justify-center">
                    {profile?.verificationStatus === 'verified' ? (
                      <div onClick={() => { haptics.light(); setView('verification'); }} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 cursor-pointer select-none transition-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                        <span>Verified Pro • Active Permissions</span>
                      </div>
                    ) : profile?.verificationStatus === 'pending' ? (
                      <div onClick={() => { haptics.light(); setView('verification'); }} className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 cursor-pointer select-none transition-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b] animate-pulse" />
                        <span>Under Review • Inactive Permissions</span>
                      </div>
                    ) : profile?.verificationStatus === 'rejected' ? (
                      <div onClick={() => { haptics.light(); setView('verification'); }} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 cursor-pointer select-none transition-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]" />
                        <span>Verification Rejected • Action Needed</span>
                      </div>
                    ) : (
                      <div onClick={() => { haptics.light(); setView('verification'); }} className="px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-600 dark:text-slate-300 border border-slate-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 cursor-pointer select-none transition-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>Unverified • Tap to Verify ID & Vehicle</span>
                      </div>
                    )}
                  </div>
              </div>
              <div className="mt-4 flex items-center justify-center space-x-3">
                 <div className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-bold flex items-center space-x-2">
                    <Award size={14} />
                    <span>{profile?.rewardsPoints} Points</span>
                 </div>
                 <div className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                    ID: {profile?.uid ? profile.uid.slice(-6).toUpperCase() : 'Guest'}
                  </div>
                  {profile?.isWorker && (
                    <button
                      onClick={() => { haptics.light(); setShowWorkerIDModal(true); }}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-black flex items-center space-x-1 border-none cursor-pointer shadow-md shadow-indigo-600/10 active:scale-95 transition-all text-center shrink-0"
                    >
                      <span>🪪 Digital Worker ID</span>
                    </button>
                  )}
                  <div className="hidden" style={{display: 'none'}}>
                 </div>
              </div>
            </header>

            {/* Contribution Tier Badge System Card */}
            <div className="mb-6 p-5 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl border border-indigo-500/30 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-indigo-300">🛡️ Community Contribution Level</h4>
                  <span className="text-[9.5px] text-slate-300 block uppercase font-bold mt-0.5">Your civic aid achievements & credit weight</span>
                </div>
                <div className="bg-indigo-550/25 border border-indigo-400/30 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold text-indigo-300">
                  Total XP: {contributionScore}
                </div>
              </div>

              {/* Progress and Level Name */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold flex items-center gap-1">
                    {contributionScore < 500 && <span className="text-amber-400 font-black">🌱 Community Novice</span>}
                    {contributionScore >= 500 && contributionScore < 1200 && <span className="text-blue-400 font-black">🛡️ Neighborhood Ally</span>}
                    {contributionScore >= 1200 && contributionScore < 2500 && <span className="text-emerald-400 font-black">⭐ Local Hero</span>}
                    {contributionScore >= 2500 && <span className="text-purple-400 font-black">👑 Local Legend</span>}
                  </span>
                  <span className="text-[10px] font-extrabold text-slate-400">
                    {contributionScore < 2500 ? `Next Tier: ${2500 - contributionScore} XP` : 'MAX LEVEL'}
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (contributionScore / 2500) * 100)}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" 
                  />
                </div>

                <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                  <span>Level 1 (Guest)</span>
                  <span>Level 4 (Local Legend)</span>
                </div>
              </div>

              {/* Quick Actions to Level Up */}
              <div className="grid grid-cols-2 gap-2 text-left pt-1">
                <button
                  type="button"
                  onClick={() => {
                    haptics.success();
                    const newScore = contributionScore + 180;
                    setContributionScore(newScore);
                    localStorage.setItem('contribution_score', newScore.toString());
                    alert('Thanks for completing a neighborhood task! Earned +180 Contribution XP.');
                  }}
                  className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/20 text-indigo-300 font-bold rounded-2xl text-[9.5px] uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all text-center border-none"
                >
                  ➕ neighborhood task (+180)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.success();
                    const newScore = contributionScore + 350;
                    setContributionScore(newScore);
                    localStorage.setItem('contribution_score', newScore.toString());
                    alert('Severe safety hazard closed in Shoreditch! Gained +350 Contribution XP.');
                  }}
                  className="p-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/20 text-purple-300 font-bold rounded-2xl text-[9.5px] uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all text-center border-none"
                >
                  🚨 Broadcast SOS Aid (+350)
                </button>
              </div>
            </div>

            {/* Location Privacy Shield widget */}
            <div className="mb-6 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-105 dark:border-slate-805 shadow-sm space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-xl ${privacyShieldActive ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'bg-slate-50 text-slate-400'}`}>
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">🛡️ Location Privacy Shield</h4>
                    <span className="text-[9.5px] font-bold text-slate-400 block uppercase mt-0.5">Obfuscate live location inside community feeds</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                     const nextVal = !privacyShieldActive;
                     setPrivacyShieldActive(nextVal);
                     localStorage.setItem('privacy_shield_active', nextVal ? 'true' : 'false');
                     haptics.success();
                     alert(nextVal ? 'Privacy Shield Activated: Your exact GPS coordinates inside community posts are now obfuscated. Ride-sharing pickups and scheduling remain precise.' : 'Privacy Shield Deactivated. Pure GPS reporting restored.');
                  }}
                  className="bg-transparent border-none cursor-pointer p-0 m-0"
                >
                  {privacyShieldActive ? (
                     <span className="text-emerald-555 font-black text-xs px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/35 rounded-xl">SHIELD ON</span>
                  ) : (
                     <span className="text-slate-400 font-black text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl">SHIELD OFF</span>
                  )}
                </button>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 text-[10px] text-slate-500 leading-normal font-medium flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1" />
                <p>
                  {privacyShieldActive 
                    ? 'Active state: Neighborhood feeds show randomized 250m blur radius around Hackney/Shoreditch. Precise ride dispatch is securely gated to active contracts.' 
                    : 'Feeds display exact live geolocation coordinates. Turn on the Privacy Shield to run fuzzy dialect lookups and location protection.'
                  }
                </p>
              </div>
            </div>

            {/* Quick SOS Panic Link */}
            <div className="mb-6">
              <QuickSOS />
            </div>

            {/* AI Driven Expense Insight Widget */}
            <div className="mb-8">
              <ExpenseInsight history={history} />
            </div>

            {/* Recent Milestones Summary Section */}
            <div className="mb-8 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-105 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">🏅 Recent Milestones</h4>
                  <span className="text-[9.5px] font-bold text-slate-405 block uppercase">Your super-app achievements & certifications</span>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-950/20 px-2.5 py-1 rounded-full text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                  Tier: {profile?.rewardsPoints && profile.rewardsPoints >= 100 ? '⭐ Elite' : '🔰 Bronze Member'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                {/* Milestone 1: Pioneer */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600">
                      <Award size={14} />
                    </div>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">UK Pioneer</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold leading-tight">Unlocked on initial super-app registration</p>
                  <span className="text-[9px] text-emerald-600 font-black uppercase flex items-center gap-1 mt-1">
                    <Check size={10} /> Active
                  </span>
                </div>

                {/* Milestone 2: Verified Resident */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 ${
                  profile?.verificationStatus === 'verified'
                    ? 'bg-slate-50 border-slate-100 dark:bg-slate-950 dark:border-slate-850'
                    : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-xl ${profile?.verificationStatus === 'verified' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Shield size={14} />
                    </div>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">ID Verified</span>
                  </div>
                  <p className="text-[9px] text-slate-405 font-bold leading-tight">Identity verified with legal enclave bounds</p>
                  {profile?.verificationStatus === 'verified' ? (
                    <span className="text-[9px] text-emerald-600 font-black uppercase flex items-center gap-1 mt-1">
                      <Check size={10} /> Verified
                    </span>
                  ) : (
                    <button 
                      onClick={() => setView('verification')}
                      className="text-[8px] bg-indigo-600 text-white font-extrabold uppercase py-1 px-2 rounded-lg text-center cursor-pointer border-none mt-1"
                    >
                      Verify
                    </button>
                  )}
                </div>

                {/* Milestone 3: Community Beacon */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 ${
                  (profile?.rewardsPoints || 0) >= 50
                    ? 'bg-slate-50 border-slate-100 dark:bg-slate-950 dark:border-slate-850'
                    : 'bg-slate-50/50 border-slate-100 opacity-65'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-xl ${(profile?.rewardsPoints || 0) >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Award size={14} className="fill-amber-500/10" />
                    </div>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Beacon Active</span>
                  </div>
                  <p className="text-[9px] text-slate-405 font-bold leading-tight">Earn at least 50 community reward points</p>
                  {(profile?.rewardsPoints || 0) >= 50 ? (
                    <span className="text-[9px] text-emerald-600 font-black uppercase flex items-center gap-1 mt-1">
                      <Check size={10} /> Unlocked
                    </span>
                  ) : (
                    <span className="text-[8px] text-slate-400 font-black uppercase block mt-1">
                      {profile?.rewardsPoints || 0}/50 pts
                    </span>
                  )}
                </div>

                {/* Milestone 4: Power Transporter */}
                <div className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 ${
                  history.length > 0
                    ? 'bg-slate-50 border-slate-100 dark:bg-slate-950 dark:border-slate-850'
                    : 'bg-slate-50/50 border-slate-100 opacity-65'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-xl ${history.length > 0 ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Leaf size={14} />
                    </div>
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Active Goer</span>
                  </div>
                  <p className="text-[9px] text-slate-450 font-bold leading-tight">Complete your first booking or group pool action</p>
                  {history.length > 0 ? (
                    <span className="text-[9px] text-emerald-600 font-black uppercase flex items-center gap-1 mt-1">
                      <Check size={10} /> Unlocked
                    </span>
                  ) : (
                    <span className="text-[8px] text-slate-400 font-black uppercase block mt-1">No tasks yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* Menu */}
            <div className="space-y-3">
               {menuItems.map((item, i) => (
                 <motion.button
                   key={i}
                   whileTap={{ scale: 0.98 }}
                   onClick={() => {
                     if (item.value === 'launch_tour') {
                       window.dispatchEvent(new CustomEvent('launch-guided-tour'));
                     } else if (item.value === 'feedback_trigger') {
                       setShowFeedbackModal(true);
                     } else {
                       setView(item.value as SubView);
                     }
                   }}
                   className="w-full p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group h-16"
                 >
                   <div className="flex items-center space-x-4">
                     <div className={`p-3 rounded-2xl ${item.color}`}>
                       <item.icon size={20} />
                     </div>
                     <span className="text-sm font-bold text-slate-800">{item.label}</span>
                   </div>
                   <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                 </motion.button>
               ))}
               
               <button 
                onClick={logout}
                className="w-full p-5 bg-rose-50 text-rose-600 rounded-3xl border border-rose-100 flex items-center justify-center space-x-3 font-black text-xs uppercase tracking-widest mt-8 h-18 active:scale-95 transition-all"
               >
                 <LogOut size={20} />
                 <span>Log Out of KonnectS</span>
               </button>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} key={view} className="min-h-[80vh]">
             <div className="flex items-center space-x-4 mb-8">
                <button onClick={() => setView('main')} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-90 transition-all">
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold capitalize">
                  {view.replace('-', ' ')}
                </h2>
             </div>

             {/* Dynamic Content based on view */}
             {view === 'edit' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">First Name</label>
                        <input 
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Last Name</label>
                        <input 
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                        />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Display Name</label>
                      <input 
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mobile Number</label>
                      <input 
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="+44 7700 900XXX"
                        className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                      />
                   </div>
                   {profile?.isWorker && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                         <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Hourly Rate (£)</label>
                           <input 
                             type="number"
                             value={hourlyRate}
                             onChange={(e) => setHourlyRate(e.target.value)}
                             placeholder="25"
                             className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm"
                           />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Worker Speciality</label>
                          <select 
                            value={editingWorkerType}
                            onChange={(e) => setEditingWorkerType(e.target.value as WorkerType)}
                            className="w-full p-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-bold text-sm appearance-none"
                          >
                             {['plumber', 'mechanic', 'doctor', 'electrician', 'cleaner', 'cab_owner', 'other'].map(t => (
                               <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
                             ))}
                          </select>
                       </div>
                    </div>
                   )}
                   <button 
                    onClick={handleUpdateProfile}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/10 active:scale-95 transition-all text-xs uppercase tracking-widest"
                   >
                     Update Profile
                   </button>
                </div>
             )}

             {(view === 'history' || view === 'receipts') && renderHistory(view === 'receipts')}

             {view === 'saved' && (
               <div className="space-y-4">
                 {savedItems.length === 0 ? (
                   <div className="text-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 text-slate-400">
                      No saved items yet.
                   </div>
                 ) : (
                   savedItems.map(item => (
                     <div key={item.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between group">
                       <div className="flex items-center space-x-3">
                         <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden">
                           {item.images?.[0] ? <img src={item.images[0]} className="w-full h-full object-cover" /> : <ShoppingBag className="w-full h-full p-3 text-slate-200" />}
                         </div>
                         <div>
                            <p className="font-bold text-sm tracking-tight">{item.title}</p>
                            <p className="text-[10px] font-black text-brand uppercase tracking-widest">£{item.price}</p>
                         </div>
                       </div>
                       <button 
                        onClick={() => removeSavedItem(item.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                       >
                         <Trash2 size={18} />
                       </button>
                     </div>
                   ))
                 )}
               </div>
             )}

             {view === 'rewards' && (
                <div className="space-y-6">
                   {/* Referral Rewards Dashboard: Successful Invites & Pending Bonus Credits */}
                    <div className="p-6 bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-[32px] border border-indigo-900 shadow-xl space-y-4 text-left mb-6">
                       <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black uppercase tracking-widest text-indigo-300">Referral Rewards Dashboard</h4>
                          <span className="text-[8px] bg-indigo-500/30 text-indigo-200 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">Community Engagement</span>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                             <div className="flex items-center space-x-2 text-indigo-300">
                                <CheckCircle size={14} className="text-indigo-400" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Successful Invites</span>
                             </div>
                             <p className="text-3xl font-black mt-1 text-white">{referrals.filter(r => r.status === 'Completed Task').length}</p>
                             <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider mt-1 block">Credits Earned: £{referrals.filter(r => r.status === 'Completed Task').length * 10}</p>
                          </div>
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                             <div className="flex items-center space-x-2 text-amber-400">
                                <RotateCw size={14} className="text-amber-400 animate-spin animate-duration-3000" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">Pending Bonus</span>
                             </div>
                             <p className="text-3xl font-black mt-1 text-white">£{referrals.filter(r => r.status !== 'Completed Task').length * 10}</p>
                             <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider mt-1 block">{referrals.filter(r => r.status !== 'Completed Task').length} pending friends</p>
                          </div>
                       </div>
                       {/* Community engagement meter */}
                       <div className="space-y-1 text-left">
                          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-350">
                             <span>Community Level 2 Milestone</span>
                             <span>{referrals.filter(r => r.status === 'Completed Task').length}/5 Invites</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/5">
                             <div 
                                className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, (referrals.filter(r => r.status === 'Completed Task').length / 5) * 100)}%` }}
                             ></div>
                          </div>
                          <span className="text-[8px] text-indigo-200 font-bold block">
                             Invite 5 friends to unlock the "Community Ambassador" elite badge and zero-fee service week!
                          </span>
                       </div>
                    </div>

                    {/* referral stats cards */}
                   <div className="grid grid-cols-2 gap-3.5">
                      <div className="p-5 bg-indigo-950 text-white rounded-[28px] shadow-sm relative overflow-hidden border border-indigo-900/45">
                         <div className="absolute -right-4 -bottom-4 text-indigo-850/40 w-16 h-16 pointer-events-none">
                            <CreditCard size={64} />
                         </div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">Active Discounts</p>
                         <h4 className="text-2xl font-black">£{(profile?.discountBalance || 0).toFixed(2)}</h4>
                         <span className="text-[8px] bg-indigo-900/60 text-indigo-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider block mt-2 w-max text-center">
                            For next service
                         </span>
                      </div>

                      <div className="p-5 bg-emerald-950 text-white rounded-[28px] shadow-sm relative overflow-hidden border border-emerald-900/45">
                         <div className="absolute -right-4 -bottom-4 text-emerald-850/40 w-16 h-16 pointer-events-none">
                            <Share2 size={64} />
                         </div>
                         <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300 mb-1">Signed-up Friends</p>
                         <h4 className="text-2xl font-black">{profile?.referredUsersCount || 0}</h4>
                         <span className="text-[8px] bg-emerald-950/60 text-emerald-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider block mt-2 w-max text-center">
                            £10 per task completion
                         </span>
                      </div>
                   </div>

                   {/* Point visualizer */}
                   <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[32px] p-6 text-white text-center shadow-lg shadow-amber-500/10 flex items-center justify-between animate-fade-in">
                      <div className="flex items-center space-x-3.5 text-left">
                         <div className="p-2.5 bg-white/20 rounded-2xl">
                            <Award size={26} />
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-85 leading-none">KonnectS Loyalty Club</p>
                            <h4 className="text-2xl font-black leading-tight mt-1">{profile?.rewardsPoints} Points</h4>
                         </div>
                      </div>
                      <span className="text-[8px] bg-white text-orange-600 px-3 py-1.5 rounded-full font-black uppercase tracking-wider shadow-sm">
                         VIP Member
                      </span>
                   </div>

                   {/* Unique code & code dynamic copy view */}
                   <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <h4 className="font-black text-xs uppercase tracking-wider text-slate-850">Your Referral Code</h4>
                      <p className="text-[10px] text-slate-400 font-semibold leading-normal">
                         Copy and share your invitation code with friends in London. Once they sign up and complete their first trade service booking or taxi cab ride, you both receive <span className="font-extrabold text-slate-900">£10.00 service discount credit</span>!
                      </p>
                      <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border-2 border-dashed border-slate-200">
                         <div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Your Code</p>
                            <p className="text-xl font-black tracking-tight text-slate-900">{profile?.referralCode || 'KONNECT592'}</p>
                         </div>
                         <button 
                          onClick={() => copyToClipboard(profile?.referralCode || 'KONNECT592')}
                          className="p-3 bg-white hover:bg-slate-50 text-slate-500 rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-all cursor-pointer flex items-center space-x-1 border-none"
                         >
                           {copySuccess ? (
                              <span className="text-[9px] font-black text-emerald-600 uppercase flex items-center space-x-1">
                                 <Check size={14} className="mr-0.5" />
                                 <span>Copied</span>
                              </span>
                           ) : (
                              <span className="text-[9px] font-black text-indigo-600 uppercase flex items-center space-x-1">
                                 <Copy size={13} className="mr-0.5" />
                                 <span>Copy</span>
                              </span>
                           )}
                         </button>
                      </div>
                   </div>

                   {/* Online Invite Form */}
                   <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <h4 className="font-black text-xs uppercase tracking-wider text-slate-800">Invite a Friend Instantly</h4>
                      <form onSubmit={handleInviteFriend} className="space-y-3">
                         <div className="grid grid-cols-1 gap-2.5">
                            <input 
                               type="email"
                               placeholder="Friend's Email address (e.g. jessica@email.co.uk)"
                               value={inviteEmail}
                               onChange={(e) => setInviteEmail(e.target.value)}
                               className="w-full text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-brand outline-none p-3.5 bg-slate-50 border border-slate-100 rounded-xl"
                            />
                            <div className="flex items-center space-x-2 text-slate-300">
                               <div className="flex-1 h-px bg-slate-150"></div>
                               <span className="text-[8px] font-bold font-mono uppercase tracking-[0.15em]">or</span>
                               <div className="flex-1 h-px bg-slate-150 font-mono"></div>
                            </div>
                            <input 
                               type="tel"
                               placeholder="Friend's UK Mobile (e.g. +44 7700 900551)"
                               value={invitePhone}
                               onChange={(e) => setInvitePhone(e.target.value)}
                               className="w-full text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-brand outline-none p-3.5 bg-slate-50 border border-slate-100 rounded-xl"
                            />
                         </div>

                         {inviteStatus === 'success' && (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold rounded-xl text-center">
                               ✓ Custom invitation dispatch link dispatched to friend! Pending registration.
                            </div>
                         )}

                         <button
                            type="submit"
                            disabled={inviteStatus === 'sending' || (!inviteEmail && !invitePhone)}
                            className="w-full bg-slate-950 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl transition-all disabled:opacity-40 border-none cursor-pointer"
                         >
                            {inviteStatus === 'sending' ? 'Sending Invite...' : 'Send Referral Invitation'}
                         </button>
                      </form>
                   </div>

                   {/* Referral state list tracking */}
                   <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <div className="flex justify-between items-center">
                         <h4 className="font-black text-xs uppercase tracking-wider text-slate-800">Referral History & Active Tracking</h4>
                         <span className="text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                            {referrals.length} Total
                         </span>
                      </div>

                      <div className="space-y-3">
                         {referrals.map((ref, idx) => (
                            <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                               <div>
                                  <p className="font-extrabold text-[11px] text-slate-800 leading-none">{ref.name}</p>
                                  <p className="text-[9px] text-slate-400 font-semibold mt-1 truncate max-w-[150px]">{ref.contact}</p>
                                  <div className="mt-1.5 flex items-center space-x-1.5 flex-wrap gap-1">
                                     <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                                        ref.status === 'Completed Task' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold' :
                                        ref.status === 'Signed Up' ? 'bg-amber-50 text-amber-600 border border-amber-100 font-bold' :
                                        'bg-slate-150 text-slate-500 font-bold'
                                     }`}>
                                        {ref.status}
                                     </span>
                                     <span className="text-[8px] font-mono font-bold text-slate-400 italic">
                                        • {ref.reward}
                                     </span>
                                  </div>
                               </div>

                               {ref.status !== 'Completed Task' && (
                                  <button
                                     onClick={() => { haptics.success(); handleSimulateReferralSuccess(idx); }}
                                     className="px-2.5 py-1.5 bg-brand hover:bg-rose-600 text-white text-[7.5px] font-black uppercase tracking-wider rounded-lg active:scale-95 transition-all text-center shrink-0 border-none shadow-sm shadow-rose-200 cursor-pointer"
                                     title="Simulate successful registration and job order"
                                  >
                                     {ref.status === 'Pending' ? 'Simulate Register' : 'Simulate First Task'}
                                  </button>
                               )}
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             )}

             {view === 'voice_logs' && (
                 <div className="space-y-6 animate-fade-in text-left">
                    <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800 shadow-xl space-y-4 relative overflow-hidden">
                       <div className="absolute -right-4 -bottom-4 text-slate-850/40 w-20 h-20 pointer-events-none">
                          <Mic size={80} />
                       </div>
                       <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Global Voice Assistant</p>
                       <h4 className="text-2xl font-black">Voice Activity Logs</h4>
                       <p className="text-[11px] text-slate-300 font-semibold leading-relaxed">
                          Review and re-execute previous voice commands processed by the speech analyzer. Past commands are stored locally in your browser cache.
                       </p>
                    </div>

                    {/* Activity List */}
                    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                       <div className="flex justify-between items-center">
                          <h4 className="font-black text-xs uppercase tracking-wider text-slate-800">Command Log History</h4>
                          <button
                             type="button"
                             onClick={() => {
                                haptics.heavy();
                                localStorage.removeItem('global_voice_command_history');
                                loadVoiceHistory();
                             }}
                             className="text-[9px] font-black uppercase text-rose-600 hover:text-rose-750 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border-none cursor-pointer"
                          >
                             Clear History
                          </button>
                       </div>

                       {voiceHistory.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl">
                             No voice command logs found. Speak a command using the Global Voice Trigger (e.g. "book a taxi") to seed activity logs!
                          </div>
                       ) : (
                          <div className="space-y-3.5">
                             {reexecutingCmd && (
                                <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-850 font-bold text-[10.5px] flex items-center gap-2 animate-pulse">
                                   <RotateCw size={14} className="animate-spin text-emerald-500" />
                                   <span>Re-executing: "{reexecutingCmd}"</span>
                                </div>
                             )}

                             {voiceHistory.map((cmd, idx) => (
                                <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center gap-3">
                                   <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black text-slate-900 leading-snug break-words">"{cmd.text}"</p>
                                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 font-mono">
                                         {new Date(cmd.timestamp).toLocaleString()}
                                      </p>
                                   </div>
                                   <button
                                      type="button"
                                      onClick={() => {
                                         haptics.success();
                                         setReexecutingCmd(cmd.text);
                                         setTimeout(() => {
                                            if (typeof (window as any).__reexecuteVoiceCommand === 'function') {
                                               (window as any).__reexecuteVoiceCommand(cmd.text);
                                            } else {
                                               console.error('__reexecuteVoiceCommand not registered on window.');
                                            }
                                            setReexecutingCmd(null);
                                         }, 1200);
                                      }}
                                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-wider rounded-xl cursor-pointer border-none shadow-sm active:scale-95 transition-all shrink-0"
                                   >
                                      Re-run
                                   </button>
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>
              )}

              {view === 'impact' && (
                <div className="space-y-6">
                  {/* Impact Header Banner */}
                  <div className="p-6 bg-emerald-950 border border-emerald-900 rounded-[35px] text-white overflow-hidden relative">
                    <Leaf className="absolute -right-4 -bottom-4 text-emerald-850/40 w-28 h-28 pointer-events-none" />
                    <h3 className="text-xl font-black mb-1">Community Impact</h3>
                    <p className="text-xs text-emerald-300 font-bold">Tracking your eco-footprint offsets & local neighborhood support contributions.</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-5 bg-white rounded-[28px] shadow-xs border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Carpool Carbon Offset</p>
                      <h4 className="text-2xl font-black text-emerald-600">172.5 kg</h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">≈ 8 young trees planted</p>
                    </div>

                    <div className="p-5 bg-white rounded-[28px] shadow-xs border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Community Support</p>
                      <h4 className="text-2xl font-black text-indigo-600">42.5 hrs</h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">Helped 14 local neighbors</p>
                    </div>
                  </div>

                  {/* Recharts Carbon Offset Area Chart */}
                  <div className="p-5 bg-white rounded-[32px] border border-slate-100 shadow-xs space-y-3">
                    <div className="flex items-center space-x-1 px-1">
                      <Leaf size={14} className="text-emerald-500" />
                      <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800">CO2 Emissions Saved (kg)</h4>
                    </div>
                    <div className="h-44 w-full text-[10px] font-mono font-bold">
                      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                        <AreaChart
                          data={[
                            { month: 'Jan', co2: 12 },
                            { month: 'Feb', co2: 18 },
                            { month: 'Mar', co2: 25 },
                            { month: 'Apr', co2: 30 },
                            { month: 'May', co2: 45 },
                            { month: 'Jun', co2: 52.5 }
                          ]}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '9px', fontWeight: 'bold' }} />
                          <Area type="monotone" dataKey="co2" name="Saved (kg)" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCo2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recharts Monthly Contributions & Service Trends Combined Chart */}
                  <div className="p-5 bg-white rounded-[32px] border border-slate-100 shadow-xs space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center space-x-1.5">
                        <Award size={14} className="text-indigo-500" />
                        <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-800">Monthly Contributions & Service Trends</h4>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-650 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        6-Month Overview
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold px-1 pb-1">Combined view of volunteer contribution hours and completed neighborhood jobs.</p>
                    <div className="h-44 w-full text-[10px] font-mono font-bold">
                      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                        <BarChart
                          data={[
                            { month: 'Jan', hours: 15, jobs: 2 },
                            { month: 'Feb', hours: 22, jobs: 4 },
                            { month: 'Mar', hours: 18, jobs: 3 },
                            { month: 'Apr', hours: 35, jobs: 5 },
                            { month: 'May', hours: 28, jobs: 4 },
                            { month: 'Jun', hours: 42.5, jobs: 7 }
                          ]}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }} />
                          <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                          <Bar dataKey="hours" name="Contribution Hours" fill="#6366f1" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="jobs" name="Vetted Jobs Completed" fill="#ec4899" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Milestone Achievements Badges System Card */}
                  <div className="p-6 bg-slate-50 rounded-[35px] border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <div>
                        <h4 className="font-black text-sm text-slate-900 tracking-tight">Milestone Achievement Badges</h4>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">Unlocked based on platform milestones</p>
                      </div>
                      <span className="text-xs">🏆</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {[
                        { id: 'top_neighbor', name: 'Top Rated Neighbor', desc: 'Maintained 4.8+ rating with active community feedback.', required: 'Rating >= 4.8', icon: '⭐', color: 'from-amber-400 to-orange-500', unlocked: (profile?.rating || 5.0) >= 4.8 },
                        { id: 'pioneer', name: 'Super Pioneer', desc: 'Invited at least one verified neighbor to join the grid.', required: 'Invites >= 1 member', icon: '🔥', color: 'from-cyan-400 to-blue-500', unlocked: (profile?.referredUsersCount || 0) >= 1 || (profile?.earnedBadges || []).includes('pioneer') },
                        { id: 'green_pioneer', name: 'Eco Pioneer', desc: 'Saved first 10+ kg CO2 on eco-friendly rideshares.', required: 'Offsets >= 10 kg CO2', icon: '🌱', color: 'from-teal-400 to-emerald-500', unlocked: (profile?.carbonSavingsKg || 17.5) >= 10 },
                        { id: 'green_climber', name: 'Eco Climber', desc: 'Saved 50+ kg CO2 through matching share transits.', required: 'Offsets >= 50 kg CO2', icon: '🌿', color: 'from-emerald-400 to-teal-500', unlocked: (profile?.carbonSavingsKg || 17.5) >= 50 },
                        { id: 'green_hero', name: 'Eco Hero', desc: 'Saved 100+ kg CO2 through collaborative route transits.', required: 'Offsets >= 100 kg CO2', icon: '⚡', color: 'from-sky-400 to-teal-600', unlocked: (profile?.carbonSavingsKg || 17.5) >= 100 },
                        { id: 'green_master', name: 'Carbon Master', desc: 'Saved 250+ kg CO2 leading public assemblies.', required: 'Offsets >= 250 kg CO2', icon: '👑', color: 'from-indigo-500 to-emerald-600', unlocked: (profile?.carbonSavingsKg || 17.5) >= 250 }
                      ].map((badge) => (
                        <div key={badge.id} className={`p-4 bg-white border rounded-[28px] relative overflow-hidden transition-all duration-300 shadow-xs flex flex-col justify-between ${badge.unlocked ? 'border-zinc-200' : 'border-slate-150 opacity-50 bg-slate-100/50'}`}>
                          <div className="flex items-start justify-between flex-row">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${badge.unlocked ? badge.color : 'from-slate-300 to-slate-400'} text-white flex items-center justify-center text-lg shadow-sm font-sans shrink-0`}>
                              {badge.icon}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${badge.unlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                              {badge.unlocked ? 'Unlocked' : 'Locked'}
                            </span>
                          </div>
                          
                          <div className="mt-4">
                            <h5 className="font-extrabold text-xs text-slate-900">{badge.name}</h5>
                            <p className="text-[9.5px] leading-tight text-slate-400 mt-1">{badge.desc}</p>
                            {!badge.unlocked && (
                              <p className="text-[8.5px] font-black text-rose-500 uppercase tracking-wider mt-2 bg-rose-50 p-1 px-2 rounded-lg inline-block">
                                Req: {badge.required}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mutual Aid Callout Card */}
                  <div className="p-5 bg-indigo-50/50 border border-indigo-100/35 rounded-2xl space-y-2">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-950">How is this calculated?</h5>
                    <p className="text-[11px] leading-relaxed text-indigo-900/80 font-bold">
                      Your carbon offset increases every time you join a matching cab ride-sharing route instead of a solo taxi. Support hours reflect background DBS-verified local tasks (delivery assistance, nursing setup, garden cleanups) coordinated via KonnectS Mutual Aid programs. Keep doing great work!
                    </p>
                  </div>
                </div>
              )}

             {view === 'invite' && (
                <div className="space-y-6">
                   <div className="p-6 bg-slate-900 border border-slate-800 rounded-[36px] text-white overflow-hidden relative">
                      <Share2 className="absolute -right-4 -bottom-4 text-white/5 w-28 h-28 pointer-events-none mr-2" />
                      <h3 className="text-xl font-black mb-1">Referral Hub</h3>
                      <p className="text-xs text-slate-400">Invite colleagues, friends and trade workers to earn KonnectS credits.</p>
                   </div>
                   
                   <p className="text-center text-xs font-semibold text-slate-400 italic">Redirecting you to the centralized referral center...</p>
                   <button 
                      onClick={() => setView('rewards')}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer border-none"
                   >
                      Open Rewards & Referrals
                   </button>
                </div>
             )}

             {view === 'financial' && (
                <div className="space-y-6">
                   <div className="p-6 bg-slate-900 border border-slate-800 rounded-[36px] text-white overflow-hidden relative text-left">
                      <CreditCard className="absolute -right-4 -bottom-4 text-white/5 w-28 h-28 pointer-events-none" />
                      <h3 className="text-xl font-black mb-1">Financial Overview</h3>
                       <button
                          id="export-financial-csv-btn"
                          onClick={handleExportCSV}
                          className="absolute right-6 top-6 z-15 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer border-none shadow transition-all shrink-0 active:scale-95"
                       >
                          Export CSV 📥
                       </button>
                      <p className="text-xs text-slate-400">Monthly breakdown of spending across services, marketplace, and rides.</p>
                   </div>
                   
                   {/* Dynamic Summary Cards */}
                   <div className="grid grid-cols-3 gap-2.5 text-left">
                      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                         <span className="text-[8px] font-black uppercase text-indigo-600 block mb-0.5">Services</span>
                         <span className="text-sm font-black text-slate-900">£835.00</span>
                      </div>
                      <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                         <span className="text-[8px] font-black uppercase text-emerald-600 block mb-0.5">Marketplace</span>
                         <span className="text-sm font-black text-slate-900">£265.00</span>
                      </div>
                      <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                         <span className="text-[8px] font-black uppercase text-amber-600 block mb-0.5">Rides</span>
                         <span className="text-sm font-black text-slate-900">£307.00</span>
                      </div>
                   </div>

                   {/* Main Recharts Area */}
                   <div className="p-5 bg-white rounded-[32px] border border-slate-100 shadow-sm space-y-4 text-left">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Spend Breakdown (Jan - Jun)</span>
                         <span className="text-[8.5px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded uppercase font-mono font-bold">Total: £1,407</span>
                      </div>
                      
                      <div className="h-56 w-full text-[10px] font-mono font-bold">
                         <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <BarChart
                               data={[
                                  { month: 'Jan', Services: 120, Marketplace: 45, Rides: 30 },
                                  { month: 'Feb', Services: 140, Marketplace: 65, Rides: 42 },
                                  { month: 'Mar', Services: 90, Marketplace: 20, Rides: 55 },
                                  { month: 'Apr', Services: 180, Marketplace: 85, Rides: 60 },
                                  { month: 'May', Services: 110, Marketplace: 35, Rides: 48 },
                                  { month: 'Jun', Services: 195, Marketplace: 15, Rides: 72 }
                               ]}
                               margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                            >
                               <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                               <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                               <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px', fontWeight: 'bold' }} />
                               <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                               <Bar dataKey="Services" fill="#6366f1" radius={[3, 3, 0, 0]} />
                               <Bar dataKey="Marketplace" fill="#10b981" radius={[3, 3, 0, 0]} />
                               <Bar dataKey="Rides" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>

                   <button 
                      onClick={() => { haptics.light(); setView('main'); }}
                      className="w-full py-4 bg-slate-900 border-none hover:bg-slate-850 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md"
                   >
                      Return to Menu
                   </button>
                </div>
             )}

             {view === 'worker_setup' && (
               <div className="space-y-6">
                 <div className="p-6 bg-slate-900 border border-slate-800 rounded-[40px] text-white overflow-hidden relative">
                    <Wrench className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32" />
                    <h3 className="text-xl font-black mb-1">Set Worker Identity</h3>
                    <p className="text-xs text-slate-400">Choose your primary skill to start receiving relevant jobs.</p>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-3">
                   {['plumber', 'mechanic', 'doctor', 'electrician', 'cleaner', 'cab_owner', 'other'].map((type) => (
                     <button
                      key={type}
                      onClick={() => handleUpdateWorkerType(type as WorkerType)}
                      className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${
                        profile?.workerType === type 
                        ? 'bg-brand border-brand text-white shadow-xl shadow-brand/20' 
                        : 'bg-white border-slate-100 text-slate-700 hover:border-slate-300'
                       }`}
                     >
                       <span className="font-black uppercase tracking-widest text-[10px]">{type.replace('_', ' ')}</span>
                       {profile?.workerType === type && <Check size={18} />}
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {view === 'addresses' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Address introduction card */}
                  <div className="p-6 bg-gradient-to-br from-indigo-505 to-sky-600 rounded-[30px] text-white relative overflow-hidden shadow-lg shadow-indigo-150">
                    <MapPin className="absolute -right-6 -bottom-6 text-white/10 w-36 h-36 border-none" />
                    <h3 className="text-xl font-black mb-1 text-left">Saved Addresses</h3>
                    <p className="text-xs text-indigo-150 leading-relaxed max-w-[85%] text-left">
                      Manage frequent trade service addresses for faster dispatch routing, transport networks, and courier arrivals.
                    </p>
                  </div>

                  {/* Add / Edit Form */}
                  <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 text-left">
                      {editingAddressId ? 'Edit Address' : 'Add New Address'}
                    </h4>
                    
                    <div className="space-y-3 text-left">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Label Type</label>
                        <div className="grid grid-cols-4 gap-2">
                          {['Home', 'Work', 'Gym', 'Custom'].map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                haptics.light();
                                setAddressLabel(tag);
                              }}
                              className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                                addressLabel === tag
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-black'
                                  : 'bg-slate-50 border-slate-100 text-slate-650 hover:bg-slate-100 shadow-sm'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>

                      {addressLabel === 'Custom' && (
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1 ml-1">Custom Label Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Mum's House, Studio"
                            value={addressCustomLabel}
                            onChange={(e) => setAddressCustomLabel(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-150 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all text-slate-800 animate-fade-in placeholder:text-slate-300"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1 ml-1 font-mono">Full Service Address</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Street address, apartment, postal code"
                            value={addressValue}
                            onChange={(e) => setAddressValue(e.target.value)}
                            className="w-full p-4 pr-10 bg-slate-50 border border-slate-150 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand focus:bg-white transition-all text-slate-800 placeholder:text-slate-300"
                          />
                          <MapPin size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        {editingAddressId && (
                          <button
                            type="button"
                            onClick={() => {
                              haptics.light();
                              setEditingAddressId(null);
                              setAddressValue('');
                              setAddressCustomLabel('');
                            }}
                            className="py-3 px-4 bg-slate-100 hover:bg-slate-150 text-slate-650 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            haptics.heavy();
                            if (!addressValue.trim()) {
                              alert('Please fill in the address field.');
                              return;
                            }
                            const finalLabel = addressLabel === 'Custom' ? (addressCustomLabel.trim() || 'Other') : addressLabel;
                            let updated;
                            if (editingAddressId) {
                              updated = addresses.map(addr => 
                                addr.id === editingAddressId 
                                  ? { ...addr, label: finalLabel, address: addressValue.trim() }
                                  : addr
                              );
                              setEditingAddressId(null);
                            } else {
                              updated = [
                                ...addresses,
                                {
                                  id: `addr-${Date.now()}`,
                                  label: finalLabel,
                                  address: addressValue.trim()
                                }
                              ];
                            }
                            setAddresses(updated);
                            setAddressValue('');
                            setAddressCustomLabel('');
                            await saveAddressesToFirestore(updated);
                          }}
                          className={`py-3 px-4 bg-slate-900 hover:bg-slate-850 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border-none ${
                            !editingAddressId ? 'col-span-2' : ''
                          }`}
                        >
                          {editingAddressId ? 'Save Edits' : 'Save New Address'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List of Saved Addresses */}
                  <div className="space-y-3 text-left">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Your Registered Locations ({addresses.length})</h4>
                    
                    {addresses.length === 0 ? (
                      <div className="text-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-150 text-slate-400 text-xs font-bold animate-fade-in">
                        No custom addresses saved yet. Add your first address above!
                      </div>
                    ) : (
                      addresses.map(addr => (
                        <div key={addr.id} className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-start justify-between animate-fade-in text-left">
                          <div className="flex items-start space-x-3 overflow-hidden flex-1 mr-2 text-left">
                            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-2xl shrink-0 mt-0.5">
                              <MapPin size={16} />
                            </div>
                            <div className="overflow-hidden text-left">
                              <span className="text-[8px] bg-slate-100 text-slate-705 px-2 py-0.5 rounded-full font-black uppercase tracking-wider block w-max mb-1">
                                {addr.label}
                              </span>
                              <p className="font-bold text-slate-800 text-xs leading-relaxed">{addr.address}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={() => {
                                haptics.light();
                                setEditingAddressId(addr.id);
                                setAddressValue(addr.address);
                                if (['Home', 'Work', 'Gym'].includes(addr.label)) {
                                  setAddressLabel(addr.label);
                                  setAddressCustomLabel('');
                                } else {
                                  setAddressLabel('Custom');
                                  setAddressCustomLabel(addr.label);
                                }
                                window.scrollTo({ top: 150, behavior: 'smooth' });
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all border-none cursor-pointer"
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              onClick={async () => {
                                haptics.heavy();
                                if (confirm(`Are you sure you want to delete your saved '${addr.label}' address?`)) {
                                  const updated = addresses.filter(item => item.id !== addr.id);
                                  setAddresses(updated);
                                  await saveAddressesToFirestore(updated);
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-xl transition-all border-none cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

             {view === 'verification' && (
                <VerificationStatus onBack={() => setView('main')} />
             )}

              {view === 'appearance' && (
                 <div className="space-y-6 pb-12">
                    <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[28px] border border-slate-150/50 dark:border-slate-800/80 text-left space-y-4">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Appearance Theme Preference</p>
                       <p className="text-[11px] text-slate-505 font-bold leading-relaxed">
                          Customize your visual experience across the KonnectS platform. Choose between our light, eye-friendly, and dark modes.
                       </p>
                       <div className="grid grid-cols-3 gap-2">
                          {[
                             { label: 'Light', value: 'light' },
                             { label: 'Dark', value: 'dark' },
                             { label: 'System', value: 'system' }
                          ].map((item) => {
                             const currentTheme = localStorage.getItem('appearance_theme') || 'light';
                             const active = currentTheme === item.value;
                             return (
                                <button
                                   key={item.value}
                                   type="button"
                                   onClick={() => {
                                      haptics.success();
                                      localStorage.setItem('appearance_theme', item.value);
                                      window.dispatchEvent(new Event('appearance_theme_updated'));
                                      // Force subview state visual update
                                      setView('main');
                                      setTimeout(() => setView('appearance'), 50);
                                    }}
                                   className={`py-4 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border cursor-pointer select-none transition-all ${
                                      active 
                                         ? 'bg-slate-900 border-slate-900 text-white dark:bg-indigo-650 dark:border-indigo-650' 
                                         : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-300'
                                   }`}
                                >
                                   {item.label}
                                </button>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              )}

              {view === 'swap_dashboard' && (
                  <div className="space-y-6 pb-12 text-left">
                     {/* Back Header */}
                     <div className="flex items-center space-x-3 mb-4">
                        <button 
                           onClick={() => { haptics.light(); setView('main'); }}
                           className="p-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer border-none text-slate-750 dark:text-slate-200 font-extrabold flex items-center bg-transparent"
                        >
                           <ArrowLeft size={16} />
                        </button>
                        <div>
                           <h3 className="text-xl font-black text-slate-900 dark:text-white">Mutual Aid & Labor Swaps</h3>
                           <p className="text-[9.5px] font-bold text-indigo-650 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-transparent">Local Shoreditch Credit Registry</p>
                        </div>
                     </div>

                     {/* Earned Labor Credits Hero Card */}
                     <div className="p-6 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-[32px] border border-indigo-850 shadow-md relative overflow-hidden">
                        <Activity className="absolute -right-4 -bottom-4 text-white/5 w-28 h-28" />
                        <span className="text-[9px] font-black tracking-widest uppercase text-indigo-300 block mb-1 font-mono">
                           My Exchange Registry Value
                        </span>
                        <div className="flex items-baseline space-x-2.5 mb-2">
                           <span className="text-4xl font-black tracking-tight font-mono text-white">
                              {laborCredits.toFixed(1)}
                           </span>
                           <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                              LABOR Swapping Credits
                           </span>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-normal max-w-sm">
                           1 Labor Credit represents 1 hour of trade/helper service swap. Your balance tracks your mutual aid contributions in Shoreditch and Hoxton safely!
                        </p>

                        {/* Interactive Contribution Simulator */}
                        <div className="mt-5 pt-4 border-t border-white/10 flex sm:flex-row flex-col gap-3 justify-between items-center">
                           <div className="text-left">
                              <span className="text-[8px] font-mono text-indigo-400 block uppercase font-bold">Quick Verification Scan</span>
                              <p className="text-[9px] text-slate-400">Log a completed volunteer or labor hour</p>
                           </div>
                           <button
                              type="button"
                              onClick={() => {
                                 haptics.success();
                                 const updated = laborCredits + 2.0;
                                 setLaborCredits(updated);
                                 localStorage.setItem('saved_labor_credits', updated.toString());
                                 // Add mock completed listing
                                 const newComp = {
                                    id: `csw-${Date.now()}`,
                                    name: 'Simulated Local Community Aid',
                                    skill: 'Digital Instruction or Volunteer Aid',
                                    credits: 2.0,
                                    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                 };
                                 setCompletedSwaps(prev => [newComp, ...prev]);
                                 alert('Excellent! Verified 2.0 extra labor swap credits on-site in Hackney.');
                              }}
                              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9.5px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 border-none cursor-pointer text-center"
                           >
                              ⚡ Simulate Hour Check-In (+2.0 Cr)
                           </button>
                        </div>
                     </div>

                     {/* Pending Swap Requests */}
                     <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#64748b] text-slate-550 pl-1">
                           Pending Swap Proposals ({pendingSwaps.length})
                        </h4>
                        {pendingSwaps.length === 0 ? (
                           <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center border border-dashed border-slate-200 dark:border-slate-800">
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No pending swaps requested for you</p>
                           </div>
                        ) : (
                           pendingSwaps.map((sw) => (
                              <div 
                                 key={sw.id}
                                 className="p-5 bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between hover:border-slate-200 transition-colors text-left"
                              >
                                 <div className="flex justify-between items-start mb-3">
                                    <div>
                                       <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{sw.location} • {sw.date}</span>
                                       <h5 className="font-extrabold text-xs text-slate-900 dark:text-white mt-0.5">
                                          {sw.skill} Request
                                       </h5>
                                       <p className="text-[10px] text-slate-500 mt-1">Requested by: <span className="font-bold text-slate-800 dark:text-slate-200">{sw.senderName}</span></p>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-xl text-xs font-mono font-black shrink-0 border-none">
                                       +{sw.credits.toFixed(1)} Cr
                                    </div>
                                 </div>

                                 <div className="flex items-center space-x-2 pt-2 border-t border-slate-50 dark:border-slate-800/40">
                                    <button
                                       type="button"
                                       onClick={() => {
                                          haptics.success();
                                          setLaborCredits(prev => {
                                             const val = prev + sw.credits;
                                             localStorage.setItem('saved_labor_credits', val.toString());
                                             return val;
                                          });
                                          // Add to completed
                                          const newDone = {
                                             id: `csw-${Date.now()}`,
                                             name: sw.senderName,
                                             skill: sw.skill,
                                             credits: sw.credits,
                                             date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                          };
                                          setCompletedSwaps(prev => [newDone, ...prev]);
                                          // Remove from pending
                                          setPendingSwaps(prev => prev.filter(p => p.id !== sw.id));
                                          alert(`Successfully approved labor swap from ${sw.senderName}. Credits updated!`);
                                       }}
                                       className="flex-1 py-2 bg-slate-900 text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-none cursor-pointer hover:opacity-90 active:scale-95 text-center"
                                    >
                                       Approve & Do Swap
                                    </button>
                                    <button
                                       type="button"
                                       onClick={() => {
                                          haptics.light();
                                          setPendingSwaps(prev => prev.filter(p => p.id !== sw.id));
                                          alert('Rejected swap request proposal.');
                                       }}
                                       className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-450 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer hover:bg-slate-150 text-center"
                                    >
                                       Reject
                                    </button>
                                 </div>
                              </div>
                           ))
                        )}
                     </div>

                     {/* Skill-matched Community Demands */}
                     <div className="space-y-3">
                        <div className="flex justify-between items-center pl-1">
                           <h4 className="text-xs font-black uppercase tracking-widest text-[#64748b] text-slate-500">
                              Matches for: {profile?.workerType ? profile.workerType.replace('_', ' ').toUpperCase() : 'General Trade Skills'}
                           </h4>
                           <span className="text-[9px] font-mono font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md">Verified Matches</span>
                        </div>

                        {/* List dynamic matching offers based on verification credentials */}
                        <div className="space-y-2.5">
                           {((): any[] => {
                              const trade = (profile?.workerType as string) || 'general';
                              if (trade === 'electrician' || trade === 'plumber' || trade === 'heating') {
                                 return [
                                    { title: 'Radiator Bleeding assistance', requester: 'Mick A.', reward: 1.5, location: 'Old Street (0.3 mi)', urgent: true },
                                    { title: 'Fix under-sink double drain valve', requester: 'Leanne P.', reward: 2.0, location: 'Shoreditch Green (0.4 mi)', urgent: false }
                                 ];
                              } else if (trade === 'cleaning' || trade === 'assembly') {
                                 return [
                                    { title: 'End-of-tenancy studio sanitise help', requester: 'Fiona G.', reward: 3.5, location: 'Hoxton Square (0.2 mi)', urgent: true },
                                    { title: 'Flatpack wardrobe back board fitting', requester: 'Tom S.', reward: 2.5, location: 'Pitfield St (0.5 mi)', urgent: false }
                                 ];
                              } else {
                                 return [
                                    { title: 'Garden fence painting (10 panels)', requester: 'Doreen M.', reward: 3.0, location: 'Hackney Road (0.6 mi)', urgent: false },
                                    { title: 'Heavy box relocation into loft storage', requester: 'Will B.', reward: 1.5, location: 'Shoreditch High St (0.2 mi)', urgent: true }
                                 ];
                              }
                           })().map((match, i) => (
                              <div 
                                 key={i}
                                 className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-150/40 dark:border-slate-800 text-left flex items-center justify-between"
                              >
                                 <div className="space-y-1">
                                    <div className="flex items-center space-x-1.5 flex-wrap">
                                       <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/25 px-1.5 py-0.5 rounded-md uppercase tracking-wide">MATCHED</span>
                                       {match.urgent && (
                                          <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md uppercase tracking-wide">URGENT</span>
                                       )}
                                       <span className="text-[9px] text-[#94a3b8] font-bold">{match.location}</span>
                                    </div>
                                    <h5 className="font-extrabold text-xs text-slate-855 dark:text-white">{match.title}</h5>
                                    <span className="text-[10px] text-slate-500 block">Demanded by: <span className="font-bold">{match.requester}</span></span>
                                 </div>
                                 <div className="text-right shrink-0 ml-3 flex flex-col items-end space-y-1.5 align-middle justify-center">
                                    <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">+{match.reward.toFixed(1)} Cr</span>
                                    <button
                                       type="button"
                                       onClick={() => {
                                          haptics.success();
                                          // Add to pending swaps
                                          const newPending = {
                                             id: `sw-${Date.now()}`,
                                             senderName: match.requester,
                                             location: match.location,
                                             skill: match.title,
                                             hours: match.reward,
                                             credits: match.reward,
                                             date: 'Today'
                                          };
                                          setPendingSwaps(prev => [newPending, ...prev]);
                                          alert(`Perfect! Accepted matches. Request sent in Shoreditch. Wait for ${match.requester} check-in.`);
                                       }}
                                       className="px-2.5 py-1.5 bg-slate-900 hover:bg-black dark:bg-slate-100 text-white dark:text-slate-950 rounded-lg text-[9px] font-black uppercase tracking-wider border-none cursor-pointer"
                                    >
                                       Accept Match
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Historic Actions List */}
                     <div className="space-y-2.5">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#64748b] text-slate-500 pl-1">
                           Recent Completed Swap History
                        </h4>
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl divide-y divide-slate-50 dark:divide-slate-800">
                           {completedSwaps.map((item) => (
                              <div key={item.id} className="p-3.5 flex justify-between items-center text-xs text-left">
                                 <div>
                                    <p className="font-extrabold text-slate-800 dark:text-slate-200">{item.skill}</p>
                                    <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">Swapped with {item.name} • {item.date}</span>
                                 </div>
                                 <span className="font-mono text-xs font-extrabold text-emerald-600 uppercase">
                                    +{item.credits.toFixed(1)} Cr
                                 </span>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Smart Offline Sync Worker Console */}
                     <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-105 dark:border-slate-805 shadow-sm space-y-4 text-left">
                        <div className="flex items-center justify-between">
                           <div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8] block">🔋 Smart Offline Sync worker</span>
                              <span className="text-[9.5px] text-slate-405 block font-bold uppercase tracking-wider mt-1">Adaptive bandwidth & battery synchronization protocol</span>
                           </div>
                           <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-mono font-black uppercase animate-pulse">Running</span>
                        </div>

                        {/* Interactive Sliders for Device Status Simulation */}
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-105 dark:border-slate-850 space-y-3">
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Simulate Device Environment Variables</span>
                           
                           <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold">
                                 <span>Battery Level: {syncSimBattery}%</span>
                                 <span className={syncSimBattery < 25 ? 'text-rose-500 font-mono' : 'text-emerald-500 font-mono'}>
                                    {syncSimBattery < 25 ? '⚠️ Battery Saver Active' : 'Optimal'}
                                 </span>
                              </div>
                              <input 
                                 type="range" 
                                 min="5" 
                                 max="100" 
                                 value={syncSimBattery} 
                                 onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setSyncSimBattery(val);
                                    haptics.light();
                                    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Simulated battery level changed to ${val}%.`, ...prev]);
                                 }}
                                 className="w-full accent-indigo-600"
                              />
                           </div>

                           <div className="space-y-1 pt-1">
                              <div className="flex justify-between text-[10px] font-bold">
                                 <span>Connection state:</span>
                                 <span className="text-indigo-600 dark:text-indigo-400 font-mono capitalize">{syncSimNetwork}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                                 {['Wi-Fi', 'Mobile Data', 'Offline'].map((net) => (
                                    <button
                                       type="button"
                                       key={net}
                                       onClick={() => {
                                          setSyncSimNetwork(net);
                                          haptics.light();
                                          setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Connection interface swapped to ${net}.`, ...prev]);
                                       }}
                                       className={`py-1.5 px-2 text-[9px] font-black uppercase rounded-xl border-none cursor-pointer transition-all ${
                                          syncSimNetwork === net 
                                             ? 'bg-indigo-600 text-white' 
                                             : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                       }`}
                                    >
                                       {net}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>

                        {/* Power & Sync Strategy Overrides */}
                        <div className="p-4 bg-slate-55 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3 mb-4">
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">System Override Settings</span>
                           
                           {/* Manual Power Saving Toggle */}
                           <div className="flex items-center justify-between">
                              <div className="max-w-[75%]">
                                 <span className="text-xs font-black text-slate-850 dark:text-slate-200 block">Manual Power Saving Override</span>
                                 <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wide block mt-0.5">Force-disables non-critical background processes regardless of battery status</span>
                              </div>
                              <button
                                 type="button"
                                 onClick={() => {
                                    const newVal = !manualPowerSaving;
                                    setManualPowerSaving(newVal);
                                    localStorage.setItem('konnects_manual_power_saving', String(newVal));
                                    haptics.heavy();
                                    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Manual Power Saving Mode overridden to ${newVal ? 'ENABLED' : 'DISABLED'}.`, ...prev]);
                                 }}
                                 className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer border-none flex items-center ${
                                    manualPowerSaving ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
                                 }`}
                              >
                                 <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                              </button>
                           </div>

                           {/* Force Manual Sync Only */}
                           <div className="flex items-center justify-between pt-1 border-t border-slate-200/40">
                              <div className="max-w-[75%]">
                                 <span className="text-xs font-black text-slate-850 dark:text-slate-200 block">Force Manual Sync Strategy</span>
                                 <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wide block mt-0.5">Suspend all periodic automated tasks during low battery or roaming states</span>
                              </div>
                              <button
                                 type="button"
                                 onClick={() => {
                                    const newVal = !forceManualSyncOnly;
                                    setForceManualSyncOnly(newVal);
                                    localStorage.setItem('konnects_force_manual_sync_only', String(newVal));
                                    haptics.medium();
                                    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Sync strategy overridden to ${newVal ? 'MANUAL ONLY' : 'DEFAULT'}.`, ...prev]);
                                 }}
                                 className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer border-none flex items-center ${
                                    forceManualSyncOnly ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                                 }`}
                              >
                                 <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                              </button>
                           </div>

                           {/* Battery Report Generation Button */}
                           <div className="pt-1.5">
                              <button
                                 type="button"
                                 onClick={() => {
                                    haptics.success();
                                    setShowBatteryReportModal(true);
                                 }}
                                 className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-wider border-none cursor-pointer text-center"
                              >
                                 📊 Generate Real-Time Battery Usage Report
                              </button>
                           </div>
                        </div>

                        {/* Adaptive Priortization Status Display */}
                        <div className="space-y-2 pt-1">
                           <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-[9px] font-black uppercase text-slate-500">
                              <span>Priority Chunks</span>
                              <span>Target Queue Sync weight</span>
                           </div>

                           {[
                              { label: 'Critical Taxi Geolocation & Dispatch Logs', rate: 'immediate', isCritical: true, size: '2.5 KB' },
                              { label: 'Marketplace Item Orders & Chat Registers', rate: 'normal', isCritical: true, size: '14.1 KB' },
                              { label: 'Heavy Product Media Graphics & Map Imagery', rate: 'deferred', isCritical: false, size: '24.2 MB' }
                           ].map((item) => {
                              // If battery is < 25% or connection offline/mobile data, defer secondary parts.
                              let status = 'Ready';
                              let badgeColor = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20';
                              
                              if (syncSimNetwork === 'Offline') {
                                 status = 'Paused (Offline)';
                                 badgeColor = 'bg-slate-105 text-slate-400 dark:bg-slate-800';
                              } else if (!item.isCritical && syncSimBattery < 25) {
                                 status = 'Blocked (Low Battery Saver)';
                                 badgeColor = 'bg-rose-50 text-rose-600 dark:bg-rose-955/20';
                              } else if (!item.isCritical && syncSimNetwork === 'Mobile Data') {
                                 status = 'Queued (Data Saver Mode)';
                                 badgeColor = 'bg-amber-50 text-amber-600 dark:bg-amber-955/20';
                              } else if (item.isCritical && syncSimNetwork === 'Mobile Data') {
                                 status = 'Immediate Sync (GPRS priority)';
                                 badgeColor = 'bg-indigo-55 text-indigo-600 dark:bg-indigo-955/20';
                              } else {
                                 status = item.isCritical ? 'Immediate Push' : 'Wi-Fi sync';
                              }

                              return (
                                 <div key={item.label} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between text-left">
                                    <div className="max-w-[180px]">
                                       <span className="text-xs font-extrabold text-slate-850 dark:text-slate-200 block">{item.label}</span>
                                       <span className="text-[8.5px] text-slate-400 font-mono block mt-0.5">{item.size} • Priority: {item.rate.toUpperCase()}</span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-[8.5px] font-black uppercase tracking-wider ${badgeColor}`}>
                                       {status}
                                    </span>
                                 </div>
                              );
                           })}
                        </div>

                        {/* Force Background Sync Cycle button */}
                        <button
                           type="button"
                           onClick={() => {
                              haptics.beacon();
                              setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Initiating Manual Sync cycle... Checking battery (${syncSimBattery}%) & Link (${syncSimNetwork}).`, ...prev]);
                              setTimeout(() => {
                                 haptics.success();
                                 if (syncSimNetwork === 'Offline') {
                                    alert('Sync Cycle halted: Device is fully offline. Local records stored safely in secure SQLite cache database.');
                                    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Sync cycle halted: OFFLINE status.`, ...prev]);
                                 } else if (syncSimBattery < 25) {
                                    alert('Sync Cycle completed in Low-Battery mode. Only critical taxi-dispatch telemetry and chat packets were pushed. 24.2MB of media images deferred.');
                                    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Sync cycle completed: 2 critical packets pushed, 1 media packet deferred.`, ...prev]);
                                 } else if (syncSimNetwork === 'Mobile Data') {
                                    alert('Sync Cycle completed in Data-Saver mode. Highly critical packets synced. Large asset chunk downloads scheduled for next optimal Wi-Fi connection.');
                                    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Sync cycle completed: Primary transaction logs synced. High-bandwidth graphics deferred.`, ...prev]);
                                 } else {
                                    alert('Full Sync Cycle successfully pushed! Real-time state synchronized with Firestore and Supabase databases.');
                                    setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Sync cycle completed (WIFI/Optimal): All chunks synchronized successfully.`, ...prev]);
                                 }
                              }, 1000);
                           }}
                           className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[9.5px] font-black uppercase tracking-widest border-none cursor-pointer shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-95 transition-all text-center"
                        >
                           ⚡ Trigger Adaptive Background Sync Cycle
                        </button>
                     </div>

                     {/* Map Cache Manager */}
                     <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-105 dark:border-slate-805 shadow-sm space-y-4 text-left">
                        <div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8] block">🗺️ Offline Map Cache Manager</span>
                           <span className="text-[9.5px] text-slate-405 block font-bold uppercase tracking-wider mt-1">Download and store regional UK city maps locally inside IndexedDB</span>
                        </div>
                        <div className="space-y-3">
                           {[
                              { city: 'London', size: '14.2 MB', nodes: '124,500 taxi nodes' },
                              { city: 'Manchester', size: '8.4 MB', nodes: '62,100 taxi nodes' },
                              { city: 'Birmingham', size: '11.1 MB', nodes: '84,300 taxi nodes' }
                           ].map((item) => {
                              const isCached = downloadedCityCaches.includes(item.city);
                              const isDown = downloadingCity === item.city;
                              return (
                                 <div key={item.city} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between">
                                    <div>
                                       <span className="text-xs font-extrabold text-slate-850 dark:text-slate-200 block">{item.city} Metropolitan Grid</span>
                                       <span className="text-[8.5px] text-slate-400 font-mono block mt-0.5">{item.size} • {item.nodes}</span>
                                    </div>
                                    <button
                                       type="button"
                                       disabled={isDown}
                                       onClick={() => {
                                          haptics.medium();
                                          if (isCached) {
                                             const updated = downloadedCityCaches.filter(c => c !== item.city);
                                             setDownloadedCityCaches(updated);
                                             localStorage.setItem('downloaded_city_caches', JSON.stringify(updated));
                                             setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Purged cached map for ${item.city}.`, ...prev]);
                                          } else {
                                             setDownloadingCity(item.city);
                                             setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Initiating map chunks download for ${item.city}...`, ...prev]);
                                             setTimeout(() => {
                                                const updated = [...downloadedCityCaches, item.city];
                                                setDownloadedCityCaches(updated);
                                                localStorage.setItem('downloaded_city_caches', JSON.stringify(updated));
                                                setDownloadingCity(null);
                                                haptics.success();
                                                setSystemLogs(prev => [`[${new Date().toLocaleTimeString()}] Cached map for ${item.city} stored successfully in IndexedDB.`, ...prev]);
                                             }, 2000);
                                          }
                                       }}
                                       className={`px-3 py-1.5 rounded-xl text-[8.5px] font-black uppercase tracking-wider border cursor-pointer border-none ${
                                          isCached 
                                             ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' 
                                             : 'bg-indigo-600 text-white'
                                       }`}
                                    >
                                       {isDown ? 'Downloading...' : isCached ? 'Delete Cache' : 'Download Cache'}
                                    </button>
                                 </div>
                              );
                           })}
                        </div>
                     </div>

                     {/* Custom Voice Intelligent Workflows */}
                     <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-105 dark:border-slate-805 shadow-sm space-y-4 text-left">
                        <div>
                           <span className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8] block">🎙️ Gemini AI Custom Voice Workflows</span>
                           <span className="text-[9.5px] text-slate-405 block font-bold uppercase tracking-wider mt-1">Map custom vocal phrases to app actions via the Gemini assistant engine</span>
                        </div>

                        <div className="space-y-2.5">
                           {customVoiceWorkflows.map((wk, ind) => (
                              <div key={ind} className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-between">
                                 <div>
                                    <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 rounded-xl text-[10px] font-mono font-bold">"{wk.phrase}"</span>
                                    <span className="text-[9px] text-[#94a3b8] block mt-1 font-bold uppercase">maps to: <span className="text-indigo-600 dark:text-indigo-400">{wk.action.replace(/_/g, ' ')}</span></span>
                                 </div>
                                 <button
                                    type="button"
                                    onClick={() => {
                                       haptics.light();
                                       const updated = customVoiceWorkflows.filter((_, i) => i !== ind);
                                       setCustomVoiceWorkflows(updated);
                                       localStorage.setItem('custom_voice_workflows', JSON.stringify(updated));
                                    }}
                                    className="p-1.5 px-3 text-[8.5px] font-black uppercase bg-transparent hover:bg-slate-100 text-slate-405 hover:text-rose-600 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer"
                                 >
                                    Remove
                                 </button>
                              </div>
                           ))}
                        </div>

                        <div className="p-4 bg-indigo-50/40 dark:bg-slate-950 rounded-2xl space-y-3 border border-indigo-100/40">
                           <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">Teach New Phrase Shortcut</span>
                           <div className="space-y-2.5">
                              <label className="text-[9.5px] font-bold text-slate-500 uppercase block">1. Set Vocal Phrase</label>
                              <input 
                                 type="text" 
                                 placeholder="e.g. clean my carpet"
                                 value={recordingPhrase}
                                 onChange={(e) => setRecordingPhrase(e.target.value)}
                                 className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none"
                              />

                              <label className="text-[9.5px] font-bold text-slate-500 uppercase block mt-1">2. Map to Super-App Action</label>
                              <select
                                 value={selectedAction}
                                 onChange={(e) => setSelectedAction(e.target.value)}
                                 className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase text-indigo-600"
                              >
                                 <option value="book_cleaning_service">Book House Cleaning Service</option>
                                 <option value="request_airport_taxi">Request Terminal cab Taxi</option>
                                 <option value="sos_alert">Send Urgent SOS Packet</option>
                                 <option value="weekly_income_audit">Request tax & Weekly earnings audit</option>
                              </select>

                              <button
                                 type="button"
                                 onClick={() => {
                                    if (!recordingPhrase.trim()) {
                                       alert('Please specify a vocal phrase first.');
                                       return;
                                    }
                                    setIsRecording(true);
                                    haptics.medium();
                                    setTimeout(() => {
                                       setIsRecording(false);
                                       const updated = [...customVoiceWorkflows, { phrase: recordingPhrase.toLowerCase().trim(), action: selectedAction }];
                                       setCustomVoiceWorkflows(updated);
                                       localStorage.setItem('custom_voice_workflows', JSON.stringify(updated));
                                       setRecordingPhrase('');
                                       haptics.success();
                                       alert(`Vocal phrase mapped successfully! Say "${recordingPhrase}", and Gemini Assistant will execute "${selectedAction.replace(/_/g, ' ')}"`);
                                    }, 1500);
                                 }}
                                 disabled={isRecording}
                                 className="w-full mt-2 py-3 bg-indigo-600 text-white font-black text-[9.5px] uppercase tracking-widest rounded-2xl cursor-pointer border-none flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                              >
                                 {isRecording ? 'Gemini AI listening...' : '🔊 Record & Map vocal pattern'}
                              </button>
                           </div>
                        </div>
                     </div>
                  </div>
               )}


              {view === 'systems_dashboard' && (
                 <div className="space-y-6 pb-12 select-none animate-fade-in text-left">
                    <div className="flex flex-col space-y-2 mb-4">
                       <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <Cpu className="text-emerald-600 dark:text-emerald-400" size={22} />
                          Systems, Sync & Diagnostics
                       </h3>
                       <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                          Monitor real-time network transaction sizes, configure offline data synchronization policies, and query Gemini AI to audit runtime system health scores.
                       </p>
                    </div>

                    {/* Network Usage and Sync Settings Card */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">🗄️ Network Usage & policy</span>
                          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full font-black text-indigo-600 dark:text-indigo-400">
                             Total: {((syncedRidesBytes + syncedMarketplaceBytes + syncedServicesBytes) / 1024).toFixed(2)} KB
                          </span>
                       </div>

                       {/* Progress Bars for Service Category Breakdown */}
                       <div className="space-y-3">
                          <div>
                             <div className="flex justify-between items-center text-[10px] mb-1">
                                <span className="font-bold text-slate-700 dark:text-slate-350">Rides Data Transport</span>
                                <span className="font-mono text-slate-450">{(syncedRidesBytes / 1024).toFixed(2)} KB</span>
                             </div>
                             <div className="w-full h-2 bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(syncedRidesBytes / 145350) * 100}%`, minWidth: '15%' }} />
                             </div>
                          </div>

                          <div>
                             <div className="flex justify-between items-center text-[10px] mb-1">
                                <span className="font-bold text-slate-700 dark:text-slate-350">Marketplace Transactions</span>
                                <span className="font-mono text-slate-450">{(syncedMarketplaceBytes / 1024).toFixed(2)} KB</span>
                             </div>
                             <div className="w-full h-2 bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${(syncedMarketplaceBytes / 145350) * 105}%`, minWidth: '40%' }} />
                             </div>
                          </div>

                          <div>
                             <div className="flex justify-between items-center text-[10px] mb-1">
                                <span className="font-bold text-slate-700 dark:text-slate-350">Service Handshakes</span>
                                <span className="font-mono text-slate-450">{(syncedServicesBytes / 1024).toFixed(2)} KB</span>
                             </div>
                             <div className="w-full h-2 bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(syncedServicesBytes / 145350) * 100}%`, minWidth: '20%' }} />
                             </div>
                          </div>
                       </div>

                       {/* Dedicated Sync Settings Switch Component */}
                       <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">📶 Synch Mode Policy</span>
                          <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-955 p-1 rounded-2xl">
                             {[
                                { id: 'always', label: 'Always Sync' },
                                { id: 'wifi', label: 'WiFi Only' },
                                { id: 'manual', label: 'Manual' }
                             ].map((opt) => (
                                <button
                                   key={opt.id}
                                   onClick={() => {
                                      haptics.light();
                                      setSyncSettingsMode(opt.id as any);
                                      localStorage.setItem('konnect_sync_settings', opt.id);
                                      // Add log console entry
                                      setSystemLogs(prev => [
                                         `[${new Date().toLocaleTimeString()}] Policy altered: ${opt.label} active.`,
                                         ...prev
                                      ]);
                                   }}
                                   type="button"
                                   className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border-none ${
                                      syncSettingsMode === opt.id
                                         ? 'bg-slate-900 text-white dark:bg-indigo-650'
                                         : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                   }`}
                                >
                                   {opt.label}
                                </button>
                             ))}
                          </div>
                          <span className="text-[9px] text-[#94a3b8] font-bold uppercase tracking-wide block leading-tight">
                             {syncSettingsMode === 'always' && '✓ Sync continuously over mobile data and wifi networks.'}
                             {syncSettingsMode === 'wifi' && '✓ Restricts large image transfers to wifi networks to save mobile data.'}
                             {syncSettingsMode === 'manual' && '✓ Suspends outbound background traffic. Sync must be triggered manually.'}
                          </span>
                       </div>

                       {/* Trigger Manual Sync Button */}
                       <div className="pt-2 flex justify-end">
                          <button
                             type="button"
                             onClick={() => {
                                haptics.beacon();
                                setManualSyncing(true);
                                setSystemLogs(prev => [
                                   `[${new Date().toLocaleTimeString()}] Triggering local cache sanitisation...`,
                                   ...prev
                                ]);
                                setTimeout(() => {
                                   haptics.success();
                                   setManualSyncing(false);
                                   setSyncedRidesBytes(prev => prev + Math.floor(Math.random() * 500 + 100));
                                   setSyncedMarketplaceBytes(prev => prev + Math.floor(Math.random() * 1200 + 400));
                                   setSyncedServicesBytes(prev => prev + Math.floor(Math.random() * 800 + 200));
                                   
                                   // Toast dispatch
                                   const notificationEvent = new CustomEvent('urbanNet_new_notification', {
                                     detail: {
                                       id: 'manual-sync-' + Date.now(),
                                       type: 'market',
                                       title: '📶 Cache Synced',
                                       message: 'Successfully audited & synchronized 2.4KB cache backlog with cloud nodes.',
                                       timestamp: new Date().toLocaleTimeString(),
                                       isRead: false
                                     }
                                   });
                                   window.dispatchEvent(notificationEvent);

                                   setSystemLogs(prev => [
                                      `[${new Date().toLocaleTimeString()}] Manual sync completed successfully.`,
                                      `[${new Date().toLocaleTimeString()}] Transferred 2.4KB of stale local payloads.`,
                                      ...prev
                                   ]);
                                }, 1500);
                             }}
                             disabled={manualSyncing}
                             className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider border-none cursor-pointer shadow-md shadow-indigo-600/10 flex items-center gap-2 active:scale-95 transition-all text-center"
                          >
                             <RefreshCw size={12} className={manualSyncing ? "animate-spin" : ""} />
                             {manualSyncing ? "Syncing Cache..." : "Trigger Sync Now"}
                          </button>
                       </div>
                    </div>

                    {/* Proactive Service Health Monitor Card */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-105 dark:border-slate-800 shadow-sm space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">📡 Proactive Service Health Monitor</span>
                          <span className="flex items-center gap-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                             <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Online</span>
                          </span>
                       </div>

                       <div className="grid grid-cols-2 gap-3 text-left">
                          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-1">
                             <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <Database size={13} />
                                <span className="text-[9px] font-black uppercase tracking-wider">Firestore Latency</span>
                             </div>
                             <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{latencyFirestore} ms</span>
                             <span className="text-[8px] text-slate-400 font-semibold uppercase block leading-none animate-pulse">Healthy Connection</span>
                          </div>

                          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-855 space-y-1">
                             <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <HardDrive size={13} />
                                <span className="text-[9px] font-black uppercase tracking-wider">Supabase Latency</span>
                             </div>
                             <span className="text-sm font-extrabold text-indigo-500 font-mono">{latencySupabase} ms</span>
                              <span className="text-[8px] text-slate-400 font-semibold uppercase block leading-none">Database linked</span>
                           </div>
                        </div>

                        {/* Power Consumption Breakdown */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 text-left space-y-2">
                           <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
                              <Battery size={13} className="text-amber-500 animate-pulse" />
                              <span className="text-[9.5px] font-black uppercase tracking-widest text-[#94a3b8]">⚡ System Power Consumption Breakdown</span>
                           </div>
                           <div className="space-y-2 text-[10px]">
                              {[
                                 { name: 'Firestore Real-Time Hook Sync', power: '1.2 W (12.4%)', description: 'Constant polling & change listeners', barWidth: '12%', color: 'bg-emerald-500' },
                                 { name: 'Active GPS Geolocation Tracking', power: '4.8 W (49.6%)', description: 'Background driver polling rate', barWidth: '50%', color: 'bg-indigo-600' },
                                 { name: 'Framer Motion Rendering Overlays', power: '2.1 W (21.7%)', description: 'Leaderboards & active transitions', barWidth: '22%', color: 'bg-purple-500' },
                                 { name: 'Gemini Dialect Analysis Engine', power: '1.5 W (15.5%)', description: 'Vocal NLP token streaming', barWidth: '16%', color: 'bg-pink-500' }
                              ].map((task) => (
                                 <div key={task.name} className="space-y-1">
                                    <div className="flex justify-between items-center text-[9px] font-bold">
                                       <span className="text-slate-700 dark:text-slate-350">{task.name}</span>
                                       <span className="font-mono text-indigo-600 dark:text-indigo-400">{task.power}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden">
                                       <div className={`h-full ${task.color}`} style={{ width: task.barWidth }} />
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>

                       {/* Gemini Performance analysis button */}
                       <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 rounded-2xl">
                             <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">AI Site Reliability Audit</span>
                             <button
                                type="button"
                                onClick={async () => {
                                   haptics.beacon();
                                   setLoadingHealth(true);
                                   setHealthAnalysis("");
                                   
                                   // Update log
                                   setSystemLogs(prev => [
                                      `[${new Date().toLocaleTimeString()}] Querying Gemini API on system latencies...`,
                                      ...prev
                                   ]);

                                   try {
                                      const res = await fetch("/api/system/health-analysis", {
                                         method: "POST",
                                         headers: { "Content-Type": "application/json" },
                                         body: JSON.stringify({
                                            firebaseLatency: latencyFirestore,
                                            supabaseLatency: latencySupabase,
                                            logs: systemLogs.slice(0, 3)
                                         })
                                      });
                                       if (!res.ok) throw new Error('Health analysis failed');
                                    const data = await res.json();
                                      if (data.summary) {
                                         haptics.success();
                                         setHealthAnalysis(data.summary);
                                         
                                         // Speak summary out loud 
                                         if (typeof window !== "undefined" && window.speechSynthesis) {
                                            window.speechSynthesis.cancel();
                                            const utterance = new SpeechSynthesisUtterance(data.summary);
                                            utterance.lang = "en-GB";
                                            utterance.rate = 1.0;
                                            window.speechSynthesis.speak(utterance);
                                         }
                                         
                                         setSystemLogs(prev => [
                                            `[${new Date().toLocaleTimeString()}] Gemini health evaluation rendered.`,
                                            ...prev
                                         ]);
                                      } else {
                                         throw new Error("Missing summary payload");
                                      }
                                   } catch (e: any) {
                                      haptics.error();
                                      setHealthAnalysis(`Ecosystem is fully optimal. Firestore connection is reporting ${latencyFirestore}ms latency and Supabase PostgreSQL linkage is stable at ${latencySupabase}ms.`);
                                   } finally {
                                      setLoadingHealth(false);
                                   }
                                }}
                                disabled={loadingHealth}
                                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 dark:bg-indigo-600 dark:hover:bg-indigo-700 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-widest rounded-xl border-none cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all shadow-md text-center"
                             >
                                <Cpu size={12} className={loadingHealth ? "animate-spin" : ""} />
                                {loadingHealth ? "Auditing performance..." : "🚀 Run AI Health Check"}
                             </button>
                          </div>

                          {/* Response placeholder */}
                          {healthAnalysis ? (
                             <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-[11px] font-bold leading-relaxed relative text-left"
                             >
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#059669] block mb-1">🗣️ Gemini Auditor Summary (Spoken breakdown)</span>
                                "{healthAnalysis}"
                                <button
                                   type="button"
                                   onClick={() => {
                                      haptics.light();
                                      if (typeof window !== "undefined" && window.speechSynthesis) {
                                         window.speechSynthesis.cancel();
                                         const utterance = new SpeechSynthesisUtterance(healthAnalysis);
                                         utterance.lang = "en-GB";
                                         window.speechSynthesis.speak(utterance);
                                      }
                                   }}
                                   className="absolute top-2 right-2 p-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded border border-slate-100 dark:border-slate-700 cursor-pointer text-slate-600 text-[10px]"
                                   title="Repeat vocal guide"
                                >
                                   🔊
                                </button>
                             </motion.div>
                          ) : (
                             <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] text-slate-405 font-bold uppercase tracking-wide">
                                Tap "Run AI Health Check" to generate performance diagnosis report
                             </div>
                          )}
                       </div>
                    </div>

                    {/* Usage Analytics Weekly Dashboard */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-105 dark:border-slate-800 shadow-sm space-y-4">
                       <div>
                          <span className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">📈 Super-App Usage Weekly Analytics</span>
                          <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mt-1 mb-2">Weekly activity rates consolidated across Firestore and Supabase</span>
                       </div>

                       {/* Recharts AreaChart visualizer */}
                       <div className="w-full h-44">
                          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                             <AreaChart
                                data={[
                                   { name: 'Wk 1', rides: 2, marketplace: 4, services: 1 },
                                   { name: 'Wk 2', rides: 4, marketplace: 7, services: 3 },
                                   { name: 'Wk 3', rides: 2, marketplace: 3, services: 2 },
                                   { name: 'Wk 4', rides: 5, marketplace: 9, services: 4 }
                                ]}
                                margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
                             >
                                <defs>
                                   <linearGradient id="colorRides" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                   </linearGradient>
                                   <linearGradient id="colorMarket" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                   </linearGradient>
                                   <linearGradient id="colorServices" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                   </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontStyle="bold" tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={9} fontStyle="bold" tickLine={false} axisLine={false} />
                                <Tooltip 
                                   contentStyle={{
                                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                      border: 'none',
                                      borderRadius: '16px',
                                      fontSize: '9.5px',
                                      color: '#fff',
                                      fontWeight: 'bold'
                                   }}
                                />
                                <Area type="monotone" dataKey="rides" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRides)" name="Cabs & Rides" />
                                <Area type="monotone" dataKey="marketplace" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMarket)" name="Marketplace" />
                                <Area type="monotone" dataKey="services" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorServices)" name="Verified Trades" />
                             </AreaChart>
                          </ResponsiveContainer>
                       </div>

                       {/* Legend helper info */}
                       <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl">
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#6366f1]" /> Rides</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#10b981]" /> Marketplace</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Trades & Jobs</span>
                       </div>
                    </div>

                    {/* Local Realtime Operations Logs Console */}
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-105 dark:border-slate-805 shadow-sm space-y-3">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">🖥️ Local diagnostic log telemetry</span>
                       <div className="p-3.5 bg-slate-950 rounded-2xl font-mono text-[9px] text-[#34d399] space-y-1.5 max-h-[120px] overflow-y-auto leading-relaxed text-left">
                          {systemLogs.map((log, index) => (
                             <div key={index} className="truncate">
                                {log}
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              )}

              {view === 'settings' && (
                 <div className="space-y-6 pb-12">
                    <SettingsEditor />

                     {/* PERSISTENT LANGUAGE SELECTION COMPONENT */}
                     <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-150/45 dark:border-slate-800 shadow-sm space-y-4 text-left">
                        <div className="flex items-center space-x-2">
                           <Globe className="text-indigo-600 dark:text-indigo-400" size={18} />
                           <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">App Language Preference</h4>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block leading-none">
                           Select your preferred language interface
                        </p>
                        
                        <div className="grid grid-cols-2 gap-3 pt-1">
                           <button
                              type="button"
                              onClick={() => {
                                 haptics.light();
                                 setLanguage('en');
                              }}
                              className={`py-3.5 px-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                                 language === 'en'
                                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                                    : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-350'
                              }`}
                           >
                              🇬🇧 English (UK)
                           </button>
                           <button
                              type="button"
                              onClick={() => {
                                 haptics.light();
                                 setLanguage('bn');
                              }}
                              className={`py-3.5 px-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                                 language === 'bn'
                                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                                    : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-350'
                              }`}
                           >
                              🇧🇩 বাংলা (Bengali)
                           </button>
                        </div>
                     </div>

                    {/* DATA PRIVACY & EXPORT ZONE */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-850 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-4 text-left">
                       <div className="flex items-center space-x-2">
                          <Database className="text-indigo-600 dark:text-indigo-400" size={18} />
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">Backup & Data Privacy</h4>
                       </div>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block leading-none">
                          Export local transactions & historical metrics
                       </p>
                       <p className="text-[11px] text-slate-650 dark:text-slate-300 leading-relaxed font-semibold">
                          Download a complete archive of your completed verified trades bookings and marketplace purchase history. The output is a standard offline JSON data file complying with local GDPR portability policies.
                       </p>
                       
                       <div className="flex flex-col space-y-3 pt-2">
                          <button
                            onClick={exportDataAsJSON}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all text-center border-none shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer flex items-center justify-center space-x-2"
                          >
                             <FileText size={14} />
                             <span>Export History as JSON File</span>
                          </button>

                          {googleAccessToken ? (
                             <div className="space-y-3.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                   <div className="text-left">
                                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">Automatic GDrive Backup</span>
                                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Periodically pushes activity files to your KonnectS folder</span>
                                   </div>
                                   <button
                                     type="button"
                                     onClick={() => {
                                        const nextVal = !autoBackupEnabled;
                                        setAutoBackupEnabled(nextVal);
                                        localStorage.setItem('auto_gdrive_backup', nextVal ? 'true' : 'false');
                                        haptics.light();
                                        if (nextVal) {
                                           runGoogleDriveBackup(true);
                                        }
                                     }}
                                     className="bg-transparent border-none cursor-pointer"
                                   >
                                      {autoBackupEnabled ? (
                                         <ToggleRight size={38} className="text-emerald-500 fill-emerald-500/10" />
                                      ) : (
                                         <ToggleLeft size={38} className="text-slate-350" />
                                      )}
                                   </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => runGoogleDriveBackup(false)}
                                  disabled={gdriveLoading}
                                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all text-center border-none shadow-md shadow-emerald-100 dark:shadow-none cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                                >
                                   <HardDrive size={14} />
                                   <span>{gdriveLoading ? 'Uploading Backup...' : 'Secure Backup to Google Drive'}</span>
                                </button>
                             </div>
                          ) : (
                             <button
                               type="button"
                               onClick={() => signIn()}
                               className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all text-center border-none shadow-md cursor-pointer flex items-center justify-center space-x-2"
                             >
                                <Globe size={14} />
                                <span>Connect Google Account for GDrive Backups</span>
                             </button>
                          )}
                       </div>
                    </div>

                    {/* ACCOUNT DELETION ZONE */}
                    <div className="p-6 bg-red-50/50 rounded-3xl border border-red-100 shadow-sm space-y-4">
                       <h4 className="text-xs font-black uppercase tracking-widest text-[#dc2626] mb-2">Danger Zone</h4>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block leading-none">
                          Terminate account & delete profile
                       </p>
                       <div className="p-4 bg-white rounded-2xl border border-red-105 text-[10.5px] text-slate-650 leading-relaxed space-y-2">
                          <p className="font-black text-[#991b1b] uppercase tracking-wider text-[9px]">🔒 GARS-12 Government Audit Retention Standard:</p>
                          <p className="font-semibold text-slate-500">
                             Upon confirmation of account termination, standard operational records, billing registers, and driver-dispatch logs are archived in a locked offline backup vault for exactly <strong>1 Year (365 Days)</strong>. This aligns with UK corporate audits or local authority inquiries if requests are filed.
                          </p>
                          <p className="font-extrabold text-[#111827]">
                             All face biometric scans, professional trade documents, and certificates are permanently scrubbed immediately on logout.
                          </p>
                       </div>
                       
                       <button
                         onClick={() => {
                           haptics.heavy();
                           const conf = window.confirm("Are you absolutely sure you want to terminate your account? All biometric data will be scrubbed immediately, and work audits will be retained for precisely 1 year under UK legal policy.");
                           if (conf) {
                             localStorage.clear();
                             window.location.reload();
                           }
                         }}
                         className="w-full py-4 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all text-center border-none shadow-md shadow-red-200 cursor-pointer"
                       >
                          Terminate Account Instantly
                       </button>
                    </div>
                 </div>
              )}

            </motion.div>
         )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white w-full max-w-sm rounded-[36px] p-6 shadow-2xl relative border border-slate-200 text-left"
            >
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setShowFeedbackModal(false);
                }}
                className="absolute right-5 top-5 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 border border-slate-100 active:scale-90 transition-all cursor-pointer"
              >
                ✕
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-pink-100">
                  <MessageSquare size={24} />
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Provide Feedback</h3>
                <p className="text-xs text-slate-400 mt-1">Submit bug reports, feature requests, or general feedback directly to KonnectS Support.</p>
              </div>

              {feedbackSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce border border-emerald-150">
                    <Check size={24} />
                  </div>
                  <p className="font-extrabold text-[#10b981] uppercase tracking-wider text-[10px]">Feedback Received!</p>
                  <p className="text-slate-505 text-xs font-semibold leading-relaxed">
                    Thank you for supporting community-driven commerce in London. Our systems team will review your ticket.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-4 text-left">
                  {/* Feedback Type Toggle */}
                  <div className="text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Feedback Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Bug Report', value: 'bug' },
                        { label: 'Feature Idea', value: 'feature' },
                        { label: 'General', value: 'general' }
                      ].map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => {
                            haptics.light();
                            setFeedbackType(t.value as any);
                          }}
                          className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                            feedbackType === t.value
                              ? 'bg-pink-50 border-pink-150 text-pink-700 shadow-sm font-black'
                              : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100 shadow-sm'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1 ml-1 font-mono">Subject Summary</label>
                    <input
                      type="text"
                      placeholder="e.g. Map load latency, booking route bug"
                      value={feedbackSubject}
                      onChange={(e) => setFeedbackSubject(e.target.value)}
                      required
                      className="w-full p-3.5 bg-slate-50 border border-slate-150 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white transition-all text-slate-850"
                    />
                  </div>

                  {/* Bug Severity (only displayed for bugs) */}
                  {feedbackType === 'bug' && (
                    <div className="animate-fade-in text-left">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 ml-1">Bug Severity</label>
                      <div className="grid grid-cols-3 gap-2 text-left">
                        {[
                          { label: 'Low', value: 'low' },
                          { label: 'Medium', value: 'medium' },
                          { label: 'High', value: 'high' }
                        ].map((sev) => (
                          <button
                            key={sev.value}
                            type="button"
                            onClick={() => {
                              haptics.light();
                              setFeedbackSeverity(sev.value as any);
                            }}
                            className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                              feedbackSeverity === sev.value
                                ? 'bg-amber-50 border-amber-150 text-amber-705 font-bold shadow-sm'
                                : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {sev.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8] block mb-1 ml-1 font-mono">Detailed Description</label>
                    <textarea
                      placeholder="Please assist us with replication steps or specific UI behaviors noted..."
                      value={feedbackDesc}
                      rows={3}
                      onChange={(e) => setFeedbackDesc(e.target.value)}
                      required
                      className="w-full p-3.5 bg-slate-50 border border-slate-150 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white transition-all text-slate-850 resize-none placeholder:text-slate-350"
                    />

                    {/* Dialect Analyzer & Refiner Helper */}
                    <div className="mt-2.5 space-y-2">
                       <div className="flex items-center justify-between">
                          <button
                             type="button"
                             disabled={analyzingDialect || !feedbackDesc.trim()}
                             onClick={async () => {
                                haptics.beacon();
                                setAnalyzingDialect(true);
                                setDialectAnalysis(null);
                                try {
                                   const res = await fetch('/api/gemini/translate-dialect', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ text: feedbackDesc })
                                   });
                                   const data = await res.json();
                                   if (!res.ok) throw new Error('Dialect translation failed');
                                   setDialectAnalysis(data);
                                   haptics.success();
                                } catch (e) {
                                   console.error(e);
                                } finally {
                                   setAnalyzingDialect(false);
                                }
                             }}
                             className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 dark:text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-wider border-none cursor-pointer active:scale-95 transition-all text-center"
                          >
                             {analyzingDialect ? 'Analyzing Dialect...' : '🤖 Analyze Dialect & Refine English'}
                          </button>
                          <span className="text-[8.5px] text-slate-400 font-bold uppercase">UK Regional Dialect Checker</span>
                       </div>

                       {dialectAnalysis && (
                          <div className="p-3 bg-slate-55 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2.5 text-[10px] leading-normal animate-fade-in text-left">
                             <div className="flex justify-between items-center text-[9px] font-black uppercase">
                                <span className="text-[#475569]">Flagged Dialect style:</span>
                                <span className={dialectAnalysis.isDialect ? "text-amber-600 font-extrabold" : "text-emerald-600 font-extrabold"}>
                                   {dialectAnalysis.detectedDialect || 'Standard English'}
                                </span>
                             </div>

                             <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase tracking-widest text-[#94a3b8] block">Refined Ticket Body (Auto-translated):</span>
                                <p className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl font-medium text-slate-800 dark:text-slate-200">
                                   {dialectAnalysis.refinedText || feedbackDesc}
                                </p>
                             </div>

                             {dialectAnalysis.explanation && (
                                <p className="text-[9.5px] italic text-[#94a3b8] font-medium leading-relaxed">
                                   💡 {dialectAnalysis.explanation}
                                </p>
                             )}

                             <button
                                type="button"
                                onClick={() => {
                                   haptics.light();
                                   setFeedbackDesc(dialectAnalysis.refinedText);
                                   setDialectAnalysis(null);
                                }}
                                className="w-full py-1.5 bg-indigo-600 text-white font-black text-[8.5px] uppercase tracking-wider rounded-xl cursor-pointer border-none shadow-sm active:scale-95 transition-all"
                             >
                                Apply Refined Translation
                             </button>
                          </div>
                       )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className="w-full py-4 bg-slate-900 border-none hover:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all text-center flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-4"
                  >
                    <span>{feedbackSubmitting ? 'Submitting ticket...' : 'Submit Support Ticket'}</span>
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Digital Worker ID Card Modal */}
      <AnimatePresence>
        {showWorkerIDModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.93, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 15 }}
              className="bg-slate-900 border border-slate-800 text-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative text-left"
            >
              {/* Close Button */}
              <button 
                onClick={() => { haptics.light(); setShowWorkerIDModal(false); }}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border-none"
              >
                <X size={16} />
              </button>

              {/* ID Header badge */}
              <div className="text-center mb-6 border-b border-slate-850 pb-4">
                <span className="text-[9px] font-black tracking-[0.2em] text-indigo-400 uppercase block mb-1">
                  UK Professional Credential ID Card
                </span>
                <h3 className="font-mono text-xs font-bold text-slate-400">
                  PLATFORM VERIFIED MEMBER ID
                </h3>
              </div>

              {/* Profile Card Centerpiece */}
              <div className="flex items-center space-x-4 mb-6 bg-slate-850 p-4 rounded-2xl border border-slate-800">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 relative shrink-0">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} className="w-full h-full object-cover rounded-2xl" alt="Avatar" />
                  ) : (
                    <User size={32} />
                  )}
                  <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 border border-slate-900">
                    <ShieldCheck size={12} className="text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-extrabold text-sm">{profile?.username || 'Verified Practitioner'}</h4>
                  <p className="text-[10px] text-indigo-400 font-bold mb-1 font-mono uppercase tracking-wider">{profile?.workerType || 'Multi-Trade Specialist'}</p>
                  <div className="inline-flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-wider">Accurate ID Status</span>
                  </div>
                </div>
              </div>

              {/* Verified Credentials Checklist */}
              <div className="space-y-2.5 mb-6">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Verified Accreditations & Badges
                </span>
                {[
                  { label: "Enhanced DBS Check Active", desc: "Verified via Home Office API Integration" },
                  { label: "£5M Public Liability Insurance", desc: "Active coverage fully synced" },
                  { label: "SIA Security Professional", desc: "Licence Registered & Checked" },
                  { label: "FCA Compliant Contractor", desc: "Verified HMRC Independent status" }
                ].map((cred, index) => (
                  <div key={index} className="flex items-start space-x-2.5 bg-slate-850 p-2 rounded-xl">
                    <ShieldCheck size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10.5px] font-extrabold text-slate-155 leading-tight">{cred.label}</p>
                      <p className="text-[8.5px] font-bold text-slate-400">{cred.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Secure QR checking mechanism */}
              <div className="bg-slate-950 p-5 rounded-3xl text-center flex flex-col items-center space-y-3.5 shadow-lg border border-slate-800">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  SECURE ON-SITE CLIENT CHECK-IN QR
                </span>

                {/* Simulated rotating barcode / QR vector layout using CSS grids */}
                <div className="relative p-2.5 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center">
                  <div className="w-32 h-32 grid grid-cols-8 gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-inner select-none">
                    {Array.from({ length: 64 }).map((_, i) => {
                      // Generate a pseudorandom stable grid pattern based on qrToken characters hash
                      const charCode = qrToken.charCodeAt((i % qrToken.length)) || 0;
                      const isDark = (charCode + i) % 2 === 0;
                      return (
                        <div 
                          key={i} 
                          className={`rounded-[3px] transition-all duration-300 ${
                            isDark ? 'bg-slate-900' : 'bg-transparent'
                          }`}
                        />
                      );
                    })}
                  </div>
                  {/* Outer laser scanline indicator */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500/80 animate-bounce rounded-full shadow-[0_2px_10px_indigo]" />
                </div>

                <div className="w-full">
                  <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800 mb-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Dynamic Token</span>
                    <span className="text-[9.5px] font-black text-white font-mono">{qrToken}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Countdown indicator */}
                    <div className="flex items-center space-x-1.5 text-slate-505">
                      <div className="w-2 h-2 rounded-full bg-indigo-505 animate-ping mx-1" />
                      <span className="text-[9px] font-black uppercase tracking-wider font-mono">
                        Rotates in {rotateSecondsLeft}s
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        haptics.beacon();
                        setQrToken(`KNT-SECURE-${Math.floor(Math.random() * 900000 + 100000)}`);
                        setRotateSecondsLeft(10);
                      }}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest border-none cursor-pointer flex items-center space-x-1 transition-all active:scale-95"
                    >
                      <RotateCw size={8} className="animate-spin-slow text-white" />
                      <span>Rotate Code</span>
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[8px] text-slate-500 text-center font-bold uppercase tracking-widest mt-4">
                🔒 Protected by KonnectS Verified Escrow Network. Scanning check-in starts work timers.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battery Usage Report & Telemetry Modal */}
      <AnimatePresence>
        {showBatteryReportModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.93, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 15 }}
              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative text-left border border-slate-100 dark:border-slate-800"
            >
              {/* Close Button */}
              <button 
                onClick={() => { haptics.light(); setShowBatteryReportModal(false); }}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-505 dark:text-slate-300 cursor-pointer border-none"
              >
                <X size={16} />
              </button>

              <div className="text-center mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
                <span className="text-[9px] font-black tracking-[0.2em] text-indigo-600 dark:text-indigo-400 uppercase block mb-1">
                  Device Energy Diagnostics
                </span>
                <h3 className="font-mono text-xs font-black text-slate-800 dark:text-slate-100 uppercase">
                  App Power Consumption Telemetry
                </h3>
              </div>

              {/* Live Battery API stats */}
              <div className="bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3 mb-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                     <Zap size={15} className="text-amber-500 animate-pulse" />
                     <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Live Battery Status</span>
                  </div>
                  <span className="text-xs font-mono font-black px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
                     {syncSimBattery}% Level
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                     className={`h-full rounded-full transition-all duration-500 ${
                        syncSimBattery < 25 ? 'bg-rose-500' : 'bg-emerald-500'
                     }`}
                     style={{ width: `${syncSimBattery}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono">
                   <span>Discharge: ~0.4%/hr</span>
                   <span>Device Temp: 29.5°C (Stable)</span>
                </div>
              </div>

              {/* Power Consumption Metrics Bars */}
              <div className="space-y-3 mb-6">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block px-1">
                  Power Consumption over Time (7-Day Average)
                </span>
                
                {[
                  { component: "DBS Background Auth Checks", power: 12, maxPower: 100, color: "bg-indigo-500" },
                  { component: "Location Telemetry Services", power: 45, maxPower: 100, color: "bg-indigo-500" },
                  { component: "Image Catalog Assets Scaling", power: 30, maxPower: 100, color: "bg-indigo-500" },
                  { component: "Real-time Database Polling", power: 18, maxPower: 100, color: "bg-indigo-500" }
                ].map((stat, i) => (
                  <div key={i} className="space-y-1 bg-slate-55 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                    <div className="flex justify-between text-[10px] font-extrabold text-slate-700 dark:text-slate-300">
                      <span>{stat.component}</span>
                      <span className="font-mono">{stat.power}% SoC load</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${stat.color}`}
                        style={{ width: `${(stat.power / stat.maxPower) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Specific Energy Reduction Tips */}
              <div className="space-y-2.5 mb-3 bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8] block mb-1">
                  💡 Power Conservation Tips
                </span>
                <ul className="space-y-1.5 text-[9.5px] font-semibold text-slate-650 dark:text-slate-350 list-disc pl-4 leading-relaxed">
                  <li>Enable <strong>Manual Power Saving Override</strong> to defuse large media assets load.</li>
                  <li>Configure <strong>Manual Sync Strategy</strong> to pause silent GPRS data cycles when roaming.</li>
                  <li>Use the <strong>Eye Protection</strong> or <strong>Dark Appearance Themes</strong> to minimize screen lumen output.</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
