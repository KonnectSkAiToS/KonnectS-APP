import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Bug, AlertCircle, Sparkles, CheckCircle2, ShieldAlert, 
  Monitor, Wifi, Clock, User, HardDrive, Camera, RefreshCw, 
  Trash2, Eye, Upload, ZoomIn, Image as ImageIcon, Check,
  CameraOff, Maximize2
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { haptics } from '../utils/haptics';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
}

interface EvidencePhoto {
  id: string;
  dataUrl: string;
  capturedAt: string;
  sizeKb: number;
  source: 'camera' | 'upload' | 'sample';
}

export function ReportIssueModal({ isOpen, onClose, activeTab }: ReportIssueModalProps) {
  const [category, setCategory] = useState<'ui_ux' | 'database_sync' | 'performance' | 'other'>('ui_ux');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Evidence Photos State
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState<EvidencePhoto | null>(null);
  const [shutterFlashing, setShutterFlashing] = useState(false);

  // Refs for camera stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Capture session diagnostics
  const [diagnostics, setDiagnostics] = useState({
    activeTab,
    uid: auth.currentUser?.uid || 'anonymous',
    email: auth.currentUser?.email || 'N/A',
    emailVerified: auth.currentUser?.emailVerified ? 'Verified' : 'Unverified',
    networkStatus: navigator.onLine ? 'Online' : 'Offline',
    localTime: new Date().toLocaleString(),
    userAgent: navigator.userAgent,
    screenResolution: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
  });

  // Stop hardware camera tracks helper (synchronous DOM/hardware only)
  const stopHardwareCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Full camera stop helper with UI state reset
  const stopCameraStream = () => {
    stopHardwareCamera();
    setIsCameraActive(false);
    setCameraLoading(false);
    setCameraError(null);
  };

  // Launch camera stream
  const startCamera = async (targetFacing: 'environment' | 'user' = facingMode) => {
    stopCameraStream();
    haptics.light();
    setIsCameraActive(true);
    setCameraLoading(true);
    setCameraError(null);

    try {
      // Check mediaDevices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported on this browser or platform.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: targetFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Small delay to ensure the video DOM element is mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((playErr) => {
            console.warn('Video playback warning:', playErr);
          });
        }
        setCameraLoading(false);
      }, 100);
    } catch (err: any) {
      console.warn('Camera hardware access restriction/failure:', err);
      setCameraLoading(false);
      let friendlyMsg = 'Device camera could not be accessed. You can still upload a photo or capture via system file picker.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyMsg = 'Camera permission was denied. Please allow camera permissions in your browser or use the file upload button.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyMsg = 'No active camera hardware was detected on this device.';
      }
      setCameraError(friendlyMsg);
      haptics.heavy();
    }
  };

  // Switch between front/back camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture snapshot from live video stream
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    haptics.success();
    setShutterFlashing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');

      // Scale down proportionally to max 1000px for optimal speed & storage
      const maxDim = 1000;
      let width = video.videoWidth || 640;
      let height = video.videoHeight || 480;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // If user front camera, mirror horizontal for natural selfie feel
        if (facingMode === 'user') {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, width, height);

        // Quality 0.82 JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

        const newPhoto: EvidencePhoto = {
          id: `cam_${Date.now()}`,
          dataUrl,
          capturedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          sizeKb,
          source: 'camera'
        };

        setPhotos((prev) => [...prev, newPhoto].slice(0, 3));
      }
    } catch (err) {
      console.error('Snapshot capture failed:', err);
    } finally {
      setTimeout(() => {
        setShutterFlashing(false);
        stopCameraStream();
      }, 250);
    }
  };

  // Handle file or device camera picker upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptics.light();
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

        const newPhoto: EvidencePhoto = {
          id: `upload_${Date.now()}`,
          dataUrl,
          capturedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          sizeKb,
          source: 'upload'
        };

        setPhotos((prev) => [...prev, newPhoto].slice(0, 3));
        haptics.success();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Simulated evidence snapshot (for quick testing or headless browsers)
  const handleSampleEvidence = () => {
    haptics.success();
    const sampleData = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=800&auto=format&fit=crop';
    const newPhoto: EvidencePhoto = {
      id: `sample_${Date.now()}`,
      dataUrl: sampleData,
      capturedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      sizeKb: 65,
      source: 'sample'
    };
    setPhotos((prev) => [...prev, newPhoto].slice(0, 3));
    stopCameraStream();
  };

  // Remove photo from evidence list
  const removePhoto = (id: string) => {
    haptics.light();
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Update diagnostics if modal opens or state changes
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setDiagnostics({
          activeTab,
          uid: auth.currentUser?.uid || 'anonymous',
          email: auth.currentUser?.email || 'N/A',
          emailVerified: auth.currentUser?.emailVerified ? 'Verified' : 'Unverified',
          networkStatus: navigator.onLine ? 'Online' : 'Offline',
          localTime: new Date().toLocaleString(),
          userAgent: navigator.userAgent,
          screenResolution: `${window.innerWidth}x${window.innerHeight}`,
          devicePixelRatio: window.devicePixelRatio,
        });
        setSuccess(false);
        setDescription('');
        setErrorMsg(null);
        setPhotos([]);
      }, 0);
      return () => {
        clearTimeout(timer);
        stopHardwareCamera();
      };
    } else {
      stopHardwareCamera();
    }
  }, [isOpen, activeTab]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      stopHardwareCamera();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      haptics.heavy();
      setErrorMsg('Please specify a description of the issue.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    haptics.medium();

    try {
      const issuePayload = {
        userId: auth.currentUser?.uid || 'guest',
        username: auth.currentUser?.displayName || 'Resident',
        email: auth.currentUser?.email || '',
        type: 'bug',
        category,
        subject: `Issue Report: ${category.toUpperCase()} on ${activeTab}`,
        description: description.trim(),
        severity: 'medium',
        assignedTo: 'admin_team',
        recipient: 'Admin Team (admin@konnects.co.uk)',
        routedToAdmin: true,
        createdAt: serverTimestamp(),
        diagnostics: {
          ...diagnostics,
          timestamp: new Date().toISOString()
        },
        status: 'open',
        // Attached camera photo evidence
        evidencePhotos: photos.map((p) => p.dataUrl),
        photoEvidence: photos[0]?.dataUrl || null,
        hasPhotoEvidence: photos.length > 0,
        photoCount: photos.length
      };

      // Submit directly to 'feedback' collection
      await addDoc(collection(db, 'feedback'), issuePayload);

      // Also log an entry to activity_logs so the admin team live feed immediately alerts admins
      try {
        const photoTag = photos.length > 0 ? ` 📷 (${photos.length} Photo${photos.length > 1 ? 's' : ''} Evidence Attached)` : '';
        await addDoc(collection(db, 'activity_logs'), {
          action: `🚨 BUG REPORTED [${category.toUpperCase()}]${photoTag}: "${description.trim().substring(0, 45)}${description.trim().length > 45 ? '...' : ''}"`,
          targetUser: auth.currentUser?.email || auth.currentUser?.displayName || 'Resident',
          adminEmail: 'admin@konnects.co.uk',
          timestamp: serverTimestamp(),
          status: 'admin_action_required',
          type: 'bug_report',
          routedTo: 'Admin Team'
        });
      } catch (logErr) {
        console.warn('Optional activity_logs dispatch skipped:', logErr);
      }

      haptics.success();
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err) {
      haptics.heavy();
      console.error(err);
      setErrorMsg('Failed to submit report. Please check connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-2xl">
                <Bug size={20} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-white">Report an Issue</h3>
                  <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    Direct to Admin
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Dispatched directly to the KonnectS Admin Team for review</p>
              </div>
            </div>
            <button
              onClick={() => { haptics.light(); stopCameraStream(); onClose(); }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer transition-colors border-none bg-transparent"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center flex flex-col items-center justify-center space-y-4"
              >
                <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-full animate-bounce">
                  <CheckCircle2 size={44} />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Report Sent to Admin Team!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thank you. Your bug report, {photos.length > 0 ? `${photos.length} photo evidence snapshot${photos.length > 1 ? 's' : ''}, ` : ''}telemetry details, and priority logs have been routed directly to the KonnectS Admin Team (admin@konnects.co.uk) for prompt review and resolution.
                  </p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Issue Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'ui_ux', label: 'UI / Layout Glitch' },
                      { id: 'database_sync', label: 'Database & Sync' },
                      { id: 'performance', label: 'Performance / Lag' },
                      { id: 'other', label: 'Other Issue' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { haptics.light(); setCategory(cat.id as any); }}
                        className={`py-3 px-4 rounded-2xl text-xs font-bold text-left border cursor-pointer transition-all flex items-center justify-between ${
                          category === cat.id
                            ? 'bg-rose-500/5 border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-850/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {category === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Description & Steps to Reproduce</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us what went wrong, what you expected, and how to trigger it..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-850/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-400 dark:placeholder:text-slate-550"
                  />
                </div>

                {/* PHOTO EVIDENCE SECTION WITH DEVICE CAMERA */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Camera size={13} className="text-rose-500" />
                      <span>Photo Evidence & Camera Capture</span>
                    </label>
                    <span className="text-[9px] font-semibold text-slate-400">
                      {photos.length}/3 photos attached
                    </span>
                  </div>

                  {/* Hidden file input for file selection / native mobile camera capture */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  {/* Active Camera Viewfinder View */}
                  {isCameraActive ? (
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl">
                      {/* Live Camera Viewport */}
                      <div className="relative aspect-video max-h-[260px] w-full flex items-center justify-center bg-black overflow-hidden">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                        />

                        {/* Shutter flash animation overlay */}
                        {shutterFlashing && (
                          <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200 pointer-events-none" />
                        )}

                        {/* Camera HUD overlay */}
                        <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
                          {/* Top HUD info */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-mono font-bold text-white border border-white/10">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                              <span>LIVE LENS ({facingMode === 'environment' ? 'BACK' : 'FRONT'})</span>
                            </div>
                            <span className="text-[9px] font-mono text-white/70 bg-black/50 px-2 py-0.5 rounded-md">
                              EVIDENCE CAPTURE
                            </span>
                          </div>

                          {/* Focus viewfinder targeting corners */}
                          <div className="relative w-40 h-28 mx-auto border-2 border-dashed border-white/40 rounded-xl flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white/70" />
                          </div>

                          {/* Bottom guidance */}
                          <div className="text-center text-[9px] font-mono text-white/80 bg-black/40 py-0.5 rounded">
                            Point camera at the glitch, screen, or physical item
                          </div>
                        </div>

                        {/* Camera loading state */}
                        {cameraLoading && (
                          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2 text-white">
                            <RefreshCw size={24} className="animate-spin text-rose-500" />
                            <span className="text-xs font-mono">Initializing camera sensor...</span>
                          </div>
                        )}

                        {/* Camera error state */}
                        {cameraError && (
                          <div className="absolute inset-0 bg-slate-950/90 p-4 flex flex-col items-center justify-center text-center gap-2.5 text-white z-20">
                            <CameraOff size={28} className="text-rose-400" />
                            <p className="text-xs font-semibold text-rose-300 max-w-xs">{cameraError}</p>
                            <div className="flex gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer border-none"
                              >
                                Upload Photo
                              </button>
                              <button
                                type="button"
                                onClick={handleSampleEvidence}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-slate-700"
                              >
                                Use Test Photo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Camera Controls Bar */}
                      <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => { haptics.light(); stopCameraStream(); }}
                          className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer border-none bg-transparent transition-colors flex items-center gap-1.5"
                        >
                          <X size={14} />
                          Cancel
                        </button>

                        {/* Snap Button */}
                        <button
                          type="button"
                          onClick={captureSnapshot}
                          disabled={cameraLoading || !!cameraError}
                          className="w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 disabled:opacity-40 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 border-4 border-white cursor-pointer transition-all"
                          title="Take Photo"
                        >
                          <div className="w-4 h-4 rounded-full bg-white" />
                        </button>

                        {/* Flip Camera Button */}
                        <button
                          type="button"
                          onClick={toggleFacingMode}
                          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer border-none bg-transparent transition-colors"
                          title="Switch Front/Back Camera"
                        >
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Photos List or Capture Trigger */
                    <div className="space-y-3">
                      {photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2.5">
                          {photos.map((photo, index) => (
                            <div
                              key={photo.id}
                              className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 aspect-video shadow-xs"
                            >
                              <img
                                src={photo.dataUrl}
                                alt={`Evidence #${index + 1}`}
                                className="w-full h-full object-cover"
                              />

                              {/* Action overlay on hover/tap */}
                              <div className="absolute inset-0 bg-slate-950/60 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                                <button
                                  type="button"
                                  onClick={() => { haptics.light(); setSelectedPreviewPhoto(photo); }}
                                  className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-xs cursor-pointer border-none"
                                  title="Enlarge Photo"
                                >
                                  <ZoomIn size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removePhoto(photo.id)}
                                  className="p-1.5 bg-rose-500/80 hover:bg-rose-600 text-white rounded-lg backdrop-blur-xs cursor-pointer border-none"
                                  title="Remove Photo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {/* Badge */}
                              <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[8px] font-mono text-white/90 bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded pointer-events-none">
                                <span className="truncate">#{index + 1}</span>
                                <span>{photo.sizeKb} KB</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Photo Capture Actions */}
                      {photos.length < 3 && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-850/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
                              <Camera size={16} />
                            </div>
                            <div className="text-left">
                              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                {photos.length === 0 ? 'Attach Camera Evidence' : 'Add More Evidence'}
                              </p>
                              <p className="text-[9px] text-slate-400">
                                Capture with device camera or choose from gallery ({3 - photos.length} slots left)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => startCamera('environment')}
                              className="flex-1 sm:flex-initial px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10.5px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-xs transition-colors"
                            >
                              <Camera size={13} />
                              Take Photo
                            </button>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10.5px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              title="Upload Photo / File"
                            >
                              <Upload size={13} />
                              Upload
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Diagnostics telemetries overlay */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/80 pb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                      <Monitor size={10} /> Auto-Captured Session Diagnostics
                    </span>
                    <span className="text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md font-mono">
                      JSON Telemetry Payload
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[9px] font-mono leading-relaxed text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Monitor size={10} className="text-slate-400" />
                      <span>Screen View: <b className="text-indigo-500 dark:text-indigo-400">{diagnostics.activeTab}</b></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wifi size={10} className="text-slate-400" />
                      <span>Network: <b className={diagnostics.networkStatus === 'Online' ? 'text-emerald-500' : 'text-rose-500'}>{diagnostics.networkStatus}</b></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User size={10} className="text-slate-400" />
                      <span className="truncate">UID: <b>{diagnostics.uid.substring(0, 8)}...</b></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={10} className="text-slate-400" />
                      <span className="truncate">Time: <b>{diagnostics.localTime}</b></span>
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl text-[10px] font-bold flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex space-x-3 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { haptics.light(); stopCameraStream(); onClose(); }}
                    className="px-5 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-350 rounded-2xl text-xs font-semibold uppercase tracking-wider cursor-pointer bg-transparent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-sm transition-all shadow-rose-500/10"
                  >
                    {submitting ? 'Submitting...' : photos.length > 0 ? `Submit Issue (${photos.length} Photo${photos.length > 1 ? 's' : ''})` : 'Submit Issue'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        {/* Fullscreen Photo Lightbox Preview */}
        <AnimatePresence>
          {selectedPreviewPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10010] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
              onClick={() => setSelectedPreviewPhoto(null)}
            >
              <div 
                className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-slate-800 text-white">
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-rose-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">Photo Evidence Preview</span>
                    <span className="text-[10px] font-mono text-slate-400">({selectedPreviewPhoto.sizeKb} KB • {selectedPreviewPhoto.capturedAt})</span>
                  </div>
                  <button
                    onClick={() => setSelectedPreviewPhoto(null)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer border-none bg-transparent"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-4 flex items-center justify-center bg-black/50">
                  <img
                    src={selectedPreviewPhoto.dataUrl}
                    alt="Evidence full view"
                    className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
