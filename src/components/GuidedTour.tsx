import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, Sparkles, Home, ShoppingBag, Shield, Car, User, Mic } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface GuidedTourProps {
  userId: string;
  onClose: () => void;
}

export function GuidedTour({ userId, onClose }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [lastSpokenCommand, setLastSpokenCommand] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Use refs to make handlers readable by the single listening loop
  const nextHandlerRef = useRef<() => void>(() => {});
  const backHandlerRef = useRef<() => void>(() => {});
  const skipHandlerRef = useRef<() => void>(() => {});

  const TOUR_STEPS = [
    {
      title: 'Welcome to KonnectS!',
      description: 'Your state-of-the-art regional web network. We connect professional skills, local transport, community boards, and a green swap marketplace under a single unified dashboard!',
      icon: Sparkles,
      iconColor: 'text-brand',
      tab: 'home',
      tip: 'Get started by exploring real-time services and community climate offset goals right at the center!'
    },
    {
      title: '🏠 Home Dashboard',
      description: 'Your daily center for operations. Monitor Carbon Offsetting scores, trigger high-priority Quick SOS support, or dispatch commands instantly using our Global Voice Assistant.',
      icon: Home,
      iconColor: 'text-indigo-600',
      tab: 'home',
      tip: 'Our London Traffic & Dispatch radar is displayed live at the top of the map layer.'
    },
    {
      title: '🛍️ Circular Swap Marketplace',
      description: 'Support local matches and green swaps. Here, you can sell tradecrafts, or donate items for FREE. If the recipient lives near your home, payments are completely waived except for a £1 app token!',
      icon: ShoppingBag,
      iconColor: 'text-emerald-600',
      tab: 'marketplace',
      tip: 'Workers verified by our compliance team earn badge credentials to gain client authority.'
    },
    {
      title: '💼 Neighborhood Pro Services',
      description: 'Hire vetted professionals instantly. Whether you need an electrician, a master plumber, cleaners, or security guards, browse local workers verified with official DBS records.',
      icon: Shield,
      iconColor: 'text-blue-600',
      tab: 'services',
      tip: 'You can chat and safely negotiate pricing in real-time before booking services.'
    },
    {
      title: '🚕 Transport & Rides',
      description: 'Request on-demand drivers or schedule regular commutes 15 minutes before departure. Keep track of visual carpool routes with our advanced, accessible multi-layer map failed-safes.',
      icon: Car,
      iconColor: 'text-amber-500',
      tab: 'rides',
      tip: 'We will send you a prompt reminder exactly 15 minutes before your scheduled pickup!'
    },
    {
      title: '👤 Profile & Worker Mode',
      description: 'Switch between Customer and Worker modes seamlessly! Track your accumulated rewards points, calibrate High-Contrast Accessibility, or toggles Dark Mode settings.',
      icon: User,
      iconColor: 'text-violet-600',
      tab: 'profile',
      tip: 'In Worker mode, you can upload certifications, trade skills and live camera verification photos to earn a verified status badge!'
    }
  ];

  const handleNext = () => {
    haptics.light();
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // Sync the tab background live so user can view tab features as they go!
      if ((window as any).__navigateTab) {
        (window as any).__navigateTab(TOUR_STEPS[nextStep].tab);
      }
    } else {
      haptics.success();
      localStorage.setItem(`urbanNet_tour_completed_${userId}`, 'true');
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
    localStorage.setItem(`urbanNet_tour_completed_${userId}`, 'true');
    onClose();
  };

  // Sync refs so modern listeners have uninterrupted state access
  useEffect(() => {
    nextHandlerRef.current = handleNext;
    backHandlerRef.current = handleBack;
    skipHandlerRef.current = handleSkip;
  });

  const inactivityTimerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  const toggleVoiceCommand = () => {
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
        // 30-second silence timeout
        inactivityTimerRef.current = setTimeout(() => {
          try {
            rec.stop();
          } catch (e) {}
          setIsListening(false);
        }, 30000);
      };

      rec.onresult = (event: any) => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        setIsListening(false);
        const last = event.results.length - 1;
        const cmdText = event.results[last][0].transcript.trim().toLowerCase();
        console.log('GuidedTour Voice command received:', cmdText);
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
        try {
          rec.stop();
        } catch (e) {}
        setIsListening(false);
      };

      rec.onerror = (err: any) => {
        console.warn('Speech error in GuidedTour:', err);
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative bg-white dark:bg-slate-900 rounded-[36px] max-w-md w-full p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 overflow-hidden"
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 dark:bg-slate-800">
            <motion.div 
              className="h-full bg-[#1e1b4b] dark:bg-indigo-500" 
              initial={{ width: '0%' }}
              animate={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#1e1b4b]/60 dark:text-indigo-400">
              Guided Tour • Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleVoiceCommand}
                title="Click to speak: 'Next', 'Back', or 'Skip'"
                className={`p-1.5 rounded-xl border-none cursor-pointer flex items-center space-x-1 text-[9px] font-black uppercase tracking-wider transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Mic size={12} className={isListening ? 'animate-bounce' : ''} />
                <span>{isListening ? 'Listening' : 'Voice'}</span>
              </button>
              <button 
                onClick={() => {
                  haptics.light();
                  localStorage.setItem(`urbanNet_tour_completed_${userId}`, 'true');
                  onClose();
                }}
                className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-none bg-transparent cursor-pointer"
              >
                Skip
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center text-center space-y-4 py-3">
            <div className={`w-16 h-16 rounded-[24px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center shadow-inner`}>
              <IconComponent size={32} className={activeStepObj.iconColor} />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeStepObj.title}
            </h3>

            <p className="text-[12.5px] text-slate-500 dark:text-slate-300 leading-relaxed font-semibold">
              {activeStepObj.description}
            </p>

            <div className="w-full mt-4 p-4.5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-indigo-950 text-left">
              <span className="text-[9px] uppercase tracking-widest font-black text-indigo-600 block mb-1">PRO-TIP:</span>
              <p className="text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed font-bold">
                {activeStepObj.tip}
              </p>
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center space-x-1.5 my-6">
            {TOUR_STEPS.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 transition-all rounded-full ${i === currentStep ? 'w-5 bg-[#1e1b4b] dark:bg-indigo-505' : 'w-1.5 bg-slate-200 dark:bg-slate-700'}`} 
              />
            ))}
          </div>

          {/* Voice Command Helper Banner */}
          {isListening && (
            <div className="mb-5 p-2 px-3.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900 rounded-2xl flex items-center justify-between select-none">
              <span className="text-[9.5px] text-violet-750 dark:text-violet-300 font-black uppercase tracking-wider flex items-center gap-1.5">
                <Mic size={11} className="text-violet-600 animate-bounce" />
                <span>Voice Step Active</span>
              </span>
              <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono font-black uppercase">
                Say: "Next", "Back" or "Skip"
              </span>
            </div>
          )}

          {/* Buttons Navigation */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="w-1/3 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className={`flex-1 py-4 bg-[#1e1b4b] dark:bg-indigo-600 hover:bg-slate-850 dark:hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer border-none flex items-center justify-center gap-2`}
            >
              <span>{currentStep === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next Screen'}</span>
              {currentStep === TOUR_STEPS.length - 1 ? <Check size={14} className="text-emerald-400" /> : <ChevronRight size={14} />}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
