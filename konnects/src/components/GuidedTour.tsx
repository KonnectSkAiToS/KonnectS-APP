import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Sparkles, 
  Home, 
  ShoppingBag, 
  Shield, 
  Car, 
  User, 
  Mic, 
  Volume2, 
  VolumeX, 
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { haptics } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { isVoiceDebugEnabled, markTourCompletedLocally } from '../utils/tourState';

interface GuidedTourProps {
  userId: string;
  onClose: () => void;
}

export type VoiceGender = 'female' | 'male';

const TOUR_STEPS = [
  {
    badge: 'UK SUPER APP INTRO',
    title: 'Welcome to KonnectS!',
    description: 'Your state-of-the-art UK Super App, fully optimized for both guest users and registered members! We connect local pro services, transport dispatches, community boards, and a green swap marketplace under one unified dashboard.',
    icon: Sparkles,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-950/60 border border-indigo-800/40 text-indigo-400',
    tab: 'home',
    tip: 'As a guest user or member, you can explore all features, search local providers, and test dispatches freely!'
  },
  {
    badge: 'HOME & LOCAL RADAR',
    title: '🏠 Home Dashboard & Live Radar',
    description: 'Your central hub for operations. Track live carbon offsets, check London traffic & weather radar, use our Global AI Voice Assistant, or trigger high-priority Quick SOS emergency support.',
    icon: Home,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-950/60 border border-indigo-800/40 text-indigo-400',
    tab: 'home',
    tip: 'Tap the Voice Mic button at any time to speak natural commands like "Book electrician" or "Show taxi"!'
  },
  {
    badge: 'VERIFIED PRO SERVICES',
    title: '💼 Neighborhood Pro Services',
    description: 'Hire vetted local professionals instantly. Search DBS-checked electricians, plumbers, house cleaners, tutors, and security guards. Chat in real-time to negotiate pricing before booking.',
    icon: Shield,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-950/60 border border-blue-800/40 text-blue-400',
    tab: 'services',
    tip: 'Look for the blue DBS Verified badge on worker profiles for verified background compliance and safety.'
  },
  {
    badge: 'CIRCULAR MARKETPLACE',
    title: '🛍️ Circular Swap Marketplace',
    description: 'Buy, sell, or swap pre-loved items locally. Give away items for FREE or trade goods. Near-home local collection orders pay £0 product cost plus a tiny £1 app token!',
    icon: ShoppingBag,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-950/60 border border-emerald-800/40 text-emerald-400',
    tab: 'marketplace',
    tip: 'Filter by "Free Item Giveaways" to find neighbors offering furniture, electronics, and books for free!'
  },
  {
    badge: 'COMMUTE & RIDES',
    title: '🚕 Transport & Scheduled Rides',
    description: 'Request instant drivers or schedule regular commutes 15 minutes before departure. View live carpool route maps with accessibility support and driver arrival alerts.',
    icon: Car,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-950/60 border border-amber-800/40 text-amber-400',
    tab: 'rides',
    tip: 'Schedule a commute in advance and we will send a notification alert 15 minutes prior to departure!'
  },
  {
    badge: 'COMMUNITY SAFETY',
    title: '🚨 Community Safety & Bulletin Board',
    description: 'Stay connected with your neighborhood. Broadcast emergency safety alerts, report road hazards, post volunteer requests, or join local neighborhood discussion boards.',
    icon: Sparkles,
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-950/60 border border-rose-800/40 text-rose-400',
    tab: 'community',
    tip: 'Community members can share real-time GPS alert pins for road closures, weather warnings, or safety updates.'
  },
  {
    badge: 'ACCOUNT & SETTINGS',
    title: '👤 Profile, Worker Mode & Settings',
    description: 'Switch between Customer and Worker/Provider modes! Manage rewards points, customize High-Contrast Accessibility, toggle Dark Mode, and re-launch this Guided Tour anytime in Settings!',
    icon: User,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-950/60 border border-violet-800/40 text-violet-400',
    tab: 'profile',
    tip: 'Want to replay this step-by-step guide anytime? Go to Profile -> Settings -> Support -> "Launch Guided Tour"!'
  }
];

export function GuidedTour({ userId, onClose }: GuidedTourProps) {
  const { profile, updateProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);

  // The voice-rule debugging panel is only for developers (dev builds, or localStorage.konnects_debug = 'true').
  const [showVoiceDebug] = useState(() => isVoiceDebugEnabled(Boolean((import.meta as any).env?.DEV)));

  // Determine user gender from profile or localStorage (fallback to 'male' for standard demo)
  const [overrideUserGender, setOverrideUserGender] = useState<'male' | 'female' | null>(() => {
    if (!isVoiceDebugEnabled(Boolean((import.meta as any).env?.DEV))) return null;
    const saved = localStorage.getItem('konnects_demo_user_gender');
    return (saved === 'male' || saved === 'female') ? saved : null;
  });

  const effectiveUserGender: 'male' | 'female' = (() => {
    if (overrideUserGender) return overrideUserGender;
    const raw = (profile?.gender || localStorage.getItem('konnects_user_gender') || '').trim().toLowerCase();
    if (raw === 'female') return 'female';
    return 'male';
  })();

  // Core requirement:
  // "before selecting voice need to be female for male user for female user voice need to be men voice"
  const defaultVoiceGender: VoiceGender = effectiveUserGender === 'male' ? 'female' : 'male';

  // Track if user explicitly selected a voice preference
  const [manualVoiceGender, setManualVoiceGender] = useState<VoiceGender | null>(() => {
    const saved = localStorage.getItem(`konnects_tour_voice_gender_${userId}`);
    return (saved === 'female' || saved === 'male') ? saved : null;
  });

  // Active voice gender: user's manual selection if made, otherwise opposite of user's gender
  const activeVoiceGender: VoiceGender = manualVoiceGender || defaultVoiceGender;

  // Voice narration on/off state (persisted)
  const [isVoiceOn, setIsVoiceOn] = useState(() => {
    return localStorage.getItem(`konnects_tour_voice_on_${userId}`) === 'true';
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // Speech Recognition (Voice command inputs: 'Next', 'Back', 'Skip')
  const [isListening, setIsListening] = useState(false);
  const [, setLastSpokenCommand] = useState<string | null>(null);

  // Handlers refs for uninterrupted listening loop
  const nextHandlerRef = useRef<() => void>(() => {});
  const backHandlerRef = useRef<() => void>(() => {});
  const skipHandlerRef = useRef<() => void>(() => {});

  // SpeechSynthesis Engine with Male & Female Voice Profiles
  const speakCurrentStep = useCallback((stepIdx: number, gender: VoiceGender) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const step = TOUR_STEPS[stepIdx];
    if (!step) return;

    const speechText = `${step.title}. ${step.description} Pro tip: ${step.tip}`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'en-GB';

    // Query browser speech voices
    const voices = window.speechSynthesis.getVoices();
    const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));

    if (gender === 'female') {
      const femaleKeywords = [
        'female', 'zira', 'samantha', 'victoria', 'karen', 'moira', 
        'serena', 'fiona', 'stephanie', 'susan', 'catherine', 'hazel', 'google uk english female'
      ];
      const matched = englishVoices.find(v => femaleKeywords.some(kw => v.name.toLowerCase().includes(kw)))
        || voices.find(v => femaleKeywords.some(kw => v.name.toLowerCase().includes(kw)))
        || englishVoices[0];

      if (matched) utterance.voice = matched;
      utterance.pitch = 1.15; // Higher, crisp feminine pitch
      utterance.rate = 1.0;
    } else {
      const maleKeywords = [
        'male', 'david', 'daniel', 'oliver', 'george', 'rishi', 
        'alex', 'arthur', 'mark', 'guy', 'google uk english male'
      ];
      const matched = englishVoices.find(v => maleKeywords.some(kw => v.name.toLowerCase().includes(kw)))
        || voices.find(v => maleKeywords.some(kw => v.name.toLowerCase().includes(kw)))
        || englishVoices[0];

      if (matched) utterance.voice = matched;
      utterance.pitch = 0.85; // Deeper, resonant masculine pitch
      utterance.rate = 0.98;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Toggle Voice On/Off
  const handleToggleVoice = () => {
    haptics.medium();
    const nextState = !isVoiceOn;
    setIsVoiceOn(nextState);
    localStorage.setItem(`konnects_tour_voice_on_${userId}`, String(nextState));

    if (nextState) {
      speakCurrentStep(currentStep, activeVoiceGender);
    } else {
      stopSpeaking();
    }
  };

  // Switch Voice Gender (Female <-> Male)
  const handleSelectVoiceGender = (gender: VoiceGender) => {
    haptics.light();
    setManualVoiceGender(gender);
    localStorage.setItem(`konnects_tour_voice_gender_${userId}`, gender);

    if (isVoiceOn) {
      speakCurrentStep(currentStep, gender);
    }
  };

  // Demo tool: Toggle simulated User Gender to verify opposite default
  const handleToggleDemoUserGender = (gender: 'male' | 'female') => {
    haptics.light();
    setOverrideUserGender(gender);
    localStorage.setItem('konnects_demo_user_gender', gender);
    // Reset manual selection so user can immediately observe the default calculation
    setManualVoiceGender(null);
    localStorage.removeItem(`konnects_tour_voice_gender_${userId}`);

    const newDefault: VoiceGender = gender === 'male' ? 'female' : 'male';
    if (isVoiceOn) {
      speakCurrentStep(currentStep, newDefault);
    }
  };

  // Speak when step changes if voice is turned on
  useEffect(() => {
    if (isVoiceOn) {
      speakCurrentStep(currentStep, activeVoiceGender);
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentStep, isVoiceOn, activeVoiceGender, speakCurrentStep]);

  // Called when the tour is finished (Step N of N) or skipped: never auto-open again.
  const markCompleted = () => {
    markTourCompletedLocally(userId);
    if (userId !== 'guest_user') {
      updateProfile({ hasCompletedTour: true }).catch(() => { /* local flag still prevents a repeat on this device */ });
    }
  };

  // Step navigation handlers
  const handleNext = () => {
    haptics.light();
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      if ((window as any).__navigateTab) {
        (window as any).__navigateTab(TOUR_STEPS[nextStep].tab);
      }
    } else {
      haptics.success();
      stopSpeaking();
      markCompleted();
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      haptics.light();
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      if ((window as any).__navigateTab) {
        (window as any).__navigateTab(TOUR_STEPS[prevStep].tab);
      }
    }
  };

  const handleSkip = () => {
    haptics.light();
    stopSpeaking();
    markCompleted();
    onClose();
  };

  // Sync refs so voice listener loop has current handlers
  useEffect(() => {
    nextHandlerRef.current = handleNext;
    backHandlerRef.current = handleBack;
    skipHandlerRef.current = handleSkip;
  });

  // Speech Recognition (Voice Commands: 'next', 'back', 'skip')
  const inactivityTimerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  const toggleVoiceCommandMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser.');
      return;
    }

    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (x) {}
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-GB';

      rec.onstart = () => {
        setIsListening(true);
        haptics.light();
        inactivityTimerRef.current = setTimeout(() => {
          try { rec.stop(); } catch (e) {}
          setIsListening(false);
        }, 30000);
      };

      rec.onresult = (event: any) => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        setIsListening(false);
        const last = event.results.length - 1;
        const cmdText = event.results[last][0].transcript.trim().toLowerCase();
        setLastSpokenCommand(cmdText);

        if (cmdText.includes('next') || cmdText.includes('continue') || cmdText.includes('forward') || cmdText.includes('yes') || cmdText.includes('screen') || cmdText.includes('proceed')) {
          nextHandlerRef.current();
        } else if (cmdText.includes('back') || cmdText.includes('previous') || cmdText.includes('go back') || cmdText.includes('behind')) {
          backHandlerRef.current();
        } else if (cmdText.includes('skip') || cmdText.includes('close') || cmdText.includes('terminate') || cmdText.includes('finish') || cmdText.includes('exit') || cmdText.includes('stop')) {
          skipHandlerRef.current();
        }
      };

      rec.onspeechend = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        try { rec.stop(); } catch (e) {}
        setIsListening(false);
      };

      rec.onerror = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        setIsListening(false);
      };

      rec.onend = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const activeStepObj = TOUR_STEPS[currentStep];
  const IconComponent = activeStepObj.icon;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative bg-[#131620] rounded-[32px] max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-800 text-slate-100 overflow-hidden"
        >
          {/* Top subtle progress bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-800/80">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" 
              initial={{ width: '0%' }}
              animate={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* =========================================================================
              HEADER BAR: VOICE ON/OFF + VOICE GENDER + STEP COUNTER + SKIP
              (Directly matching user screenshot reference with Voice Off button on left)
             ========================================================================= */}
          <div className="flex items-center justify-between gap-2 mb-6 pt-1 flex-wrap">
            {/* Left Voice Controls: [VOICE OFF / ON] and [Female / Male Voice] */}
            <div className="flex items-center gap-1.5">
              {/* Main Voice Toggle Button (matching screenshot pill) */}
              <button
                type="button"
                onClick={handleToggleVoice}
                title={isVoiceOn ? 'Turn voice narration off' : 'Turn voice narration on'}
                className={`px-3 py-1.5 rounded-full border flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs ${
                  isVoiceOn
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-indigo-600/30'
                    : 'bg-slate-800/90 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                }`}
              >
                {isVoiceOn ? (
                  <Volume2 size={13} className={isSpeaking ? 'animate-bounce text-indigo-200' : 'text-white'} />
                ) : (
                  <VolumeX size={13} className="text-slate-400" />
                )}
                <span>{isVoiceOn ? 'VOICE ON' : 'VOICE OFF'}</span>
                {isSpeaking && (
                  <span className="flex items-center gap-0.5 ml-0.5">
                    <span className="w-1 h-2.5 bg-white rounded-full animate-pulse" />
                    <span className="w-1 h-3.5 bg-white rounded-full animate-pulse delay-75" />
                    <span className="w-1 h-2 bg-white rounded-full animate-pulse delay-150" />
                  </span>
                )}
              </button>

              {/* Voice Gender Switcher (Female vs Male) */}
              <div className="relative inline-flex items-center bg-slate-900/90 border border-slate-800 rounded-full p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSelectVoiceGender('female')}
                  title={`Female Voice ${activeVoiceGender === 'female' && !manualVoiceGender ? '(Auto-assigned default for Male user)' : ''}`}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border-none flex items-center gap-1 ${
                    activeVoiceGender === 'female'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  <span>👩 Female</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectVoiceGender('male')}
                  title={`Male Voice ${activeVoiceGender === 'male' && !manualVoiceGender ? '(Auto-assigned default for Female user)' : ''}`}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border-none flex items-center gap-1 ${
                    activeVoiceGender === 'male'
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  <span>👨 Male</span>
                </button>
              </div>

              {/* Settings / Info popover toggle (developer-only: voice rules & test-gender simulation) */}
              {showVoiceDebug && (
                <button
                  type="button"
                  onClick={() => setShowVoiceSettings(prev => !prev)}
                  title="Voice settings & user gender simulation"
                  className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                    showVoiceSettings 
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/60' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <SlidersHorizontal size={11} />
                </button>
              )}
            </div>

            {/* Center: Step Indicator */}
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800/80">
              GUIDED TOUR • STEP {currentStep + 1} OF {TOUR_STEPS.length}
            </span>

            {/* Right: Skip Button */}
            <button 
              type="button"
              onClick={handleSkip}
              className="text-[10px] uppercase tracking-wider font-black text-slate-400 hover:text-white transition-colors border-none bg-transparent cursor-pointer px-2 py-1"
            >
              Skip
            </button>
          </div>

          {showVoiceDebug && (
          <>
          {/* Voice Gender Auto-Assignment Status Banner & Simulation Box */}
          <AnimatePresence>
            {showVoiceSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 bg-slate-900/95 border border-indigo-500/30 rounded-2xl text-[10.5px] text-slate-300 space-y-2 overflow-hidden shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-black uppercase tracking-wider text-indigo-300 text-[9px] flex items-center gap-1">
                    <Sparkles size={11} /> Auto-Voice Rule Specification
                  </span>
                  <span className="text-[8.5px] font-mono text-slate-400">
                    {manualVoiceGender ? 'Custom Voice Active' : 'Default Auto-Voice Active'}
                  </span>
                </div>

                <div className="text-[10px] text-slate-300 leading-relaxed">
                  Before choosing a voice manually, <strong className="text-white">Male users receive a Female voice</strong> and <strong className="text-white">Female users receive a Male voice</strong>.
                </div>

                {/* Live Demo Gender Switcher to test both rules */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 flex-wrap gap-2">
                  <span className="text-[9px] uppercase font-bold text-slate-400">Test User Gender:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleDemoUserGender('male')}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                        effectiveUserGender === 'male'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500 font-black'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      User: 👨 Male (Default → 👩 Female)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDemoUserGender('female')}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                        effectiveUserGender === 'female'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500 font-black'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      User: 👩 Female (Default → 👨 Male)
                    </button>
                  </div>
                </div>

                {isVoiceOn && (
                  <div className="flex items-center justify-between pt-1 text-[9px] text-indigo-400">
                    <span>Speaking: {activeVoiceGender === 'female' ? '👩 Female UK Voice' : '👨 Male UK Voice'}</span>
                    <button
                      type="button"
                      onClick={() => speakCurrentStep(currentStep, activeVoiceGender)}
                      className="text-indigo-300 hover:text-white flex items-center gap-1 border-none bg-transparent cursor-pointer font-bold"
                    >
                      <RotateCcw size={10} /> Replay
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </>
          )}

          {/* Voice active badge if no settings open */}
          {!showVoiceSettings && isVoiceOn && (
            <div className="mb-3 px-3 py-1 bg-indigo-950/50 border border-indigo-900/50 rounded-xl flex items-center justify-between text-[9px] text-indigo-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <Volume2 size={11} className={isSpeaking ? 'animate-bounce text-indigo-400' : ''} />
                <span>
                  Narration: <strong className="text-white capitalize">{activeVoiceGender} Voice</strong> {manualVoiceGender ? '(Selected)' : `(Auto for ${effectiveUserGender} user)`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => speakCurrentStep(currentStep, activeVoiceGender)}
                className="text-indigo-400 hover:text-indigo-200 border-none bg-transparent cursor-pointer font-bold"
              >
                Replay Audio
              </button>
            </div>
          )}

          {/* =========================================================================
              CARD BODY: ICON + BADGE + TITLE + DESCRIPTION + PRO-TIP
             ========================================================================= */}
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            {/* Step Icon */}
            <div className={`w-16 h-16 rounded-[24px] ${activeStepObj.iconBg} flex items-center justify-center shadow-lg relative`}>
              <IconComponent size={30} className={activeStepObj.iconColor} />
              {isVoiceOn && isSpeaking && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
                </span>
              )}
            </div>

            {/* Category / Badge */}
            <div>
              <span className="px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1 shadow-2xs">
                <Sparkles size={10} className="text-indigo-400" />
                <span>{activeStepObj.badge}</span>
              </span>
            </div>

            {/* Step Heading */}
            <h3 className="text-2xl font-black text-white tracking-tight leading-snug">
              {activeStepObj.title}
            </h3>

            {/* Step Description */}
            <p className="text-[13px] text-slate-300 leading-relaxed font-medium max-w-md">
              {activeStepObj.description}
            </p>

            {/* Pro-Tip Box (matching screenshot styling) */}
            <div className="w-full mt-3 p-4 bg-indigo-950/40 rounded-2xl border border-indigo-900/60 text-left relative overflow-hidden shadow-inner">
              <div className="flex items-center gap-1.5 text-indigo-400 mb-1">
                <Sparkles size={12} />
                <span className="text-[9.5px] uppercase tracking-widest font-black">PRO-TIP:</span>
              </div>
              <p className="text-[11.5px] text-slate-200 leading-relaxed font-semibold">
                {activeStepObj.tip}
              </p>
            </div>
          </div>

          {/* Voice Command Mic status if active */}
          {isListening && (
            <div className="my-3 p-2 px-3 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center justify-between text-[9.5px]">
              <span className="text-rose-300 font-black uppercase tracking-wider flex items-center gap-1.5">
                <Mic size={11} className="animate-bounce text-rose-400" />
                <span>Listening for speech...</span>
              </span>
              <span className="text-rose-200 font-mono text-[9px]">
                Say: "Next", "Back", or "Skip"
              </span>
            </div>
          )}

          {/* =========================================================================
              FOOTER: PAGINATION DOTS + NEXT BUTTON
             ========================================================================= */}
          <div className="flex items-center justify-between mt-6 pt-3 border-t border-slate-800/80">
            {/* Dots Pagination */}
            <div className="flex items-center space-x-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 transition-all rounded-full ${
                    i === currentStep 
                      ? 'w-6 bg-gradient-to-r from-indigo-500 to-purple-500' 
                      : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                  }`} 
                />
              ))}
            </div>

            {/* Mic Command Button + Navigation Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleVoiceCommandMic}
                title="Speak commands: 'Next', 'Back', or 'Skip'"
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                <Mic size={13} />
              </button>

              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer border-none shadow-md shadow-indigo-600/30 flex items-center gap-1.5 active:scale-95"
              >
                <span>{currentStep === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next Screen'}</span>
                {currentStep === TOUR_STEPS.length - 1 ? (
                  <Check size={14} className="text-emerald-300" />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
