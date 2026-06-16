import { useState, useEffect } from 'react';
import { Mic, MicOff, X, Compass, Check, AlertTriangle, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function GlobalVoiceCommand() {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognizedAction, setRecognizedAction] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(() => {
    return localStorage.getItem('voice_guidance_enabled') === 'true';
  });

  const speakGuidance = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-GB';

    rec.onstart = () => {
      setIsListening(true);
      setTranscript('Listening for commands...');
      setRecognizedAction(null);
    };

    rec.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error);
      setIsListening(false);
      if (e.error === 'not-allowed') {
        setTranscript('Microphone access denied. Enable permissions in settings.');
      } else {
        setTranscript('Could not capture audio clearly. Tap again.');
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      setTranscript(resultText);
      parseCommand(resultText);
    };

    setRecognition(rec);
  }, []);

  // Sync turn-by-turn periodic voice updates
  useEffect(() => {
    const handleRideChange = (e: any) => {
      if (!voiceGuidanceEnabled) return;
      
      const timer = e.detail?.timer;
      const driver = localStorage.getItem('active_ride_driver') || 'Cab Driver';
      const destination = localStorage.getItem('active_ride_destination') || 'destination';

      if (timer === 100) {
        speakGuidance(`Voice Guidance Update: In 100 yards, your driver ${driver} will turn left onto Great Eastern Street.`);
      } else if (timer === 60) {
        speakGuidance(`Voice Guidance Update: Continue straight for 400 yards towards Old Street. Traffic is light and clear.`);
      } else if (timer === 20) {
        speakGuidance(`Voice Guidance Update: Preparing to stop on the left at ${destination}. Please ensure all personal items are collected.`);
      } else if (timer === 0) {
        speakGuidance("Voice Guidance Update: You have arrived safely at your destination. Greenhouse emission savings logged!");
      }
    };

    window.addEventListener('active_ride_changed', handleRideChange);
    return () => window.removeEventListener('active_ride_changed', handleRideChange);
  }, [voiceGuidanceEnabled]);

  const toggleListening = () => {
    if (!isSupported) {
      alert('Web Speech Recognition API is unsupported on this browser.');
      return;
    }
    if (isListening) {
      recognition?.stop();
    } else {
      recognition?.start();
    }
  };

  const parseCommand = (speech: string) => {
    const lower = speech.toLowerCase();
    
    // 1. Navigation Commands
    if (lower.includes('go to marketplace') || lower.includes('navigate to marketplace') || lower.includes('open marketplace') || lower.includes('show marketplace') || lower.includes('market')) {
      triggerNavigation('marketplace', 'Navigating to Marketplace Shop...');
    } 
    else if (lower.includes('go to rides') || lower.includes('navigate to rides') || lower.includes('open rides') || lower.includes('show rides') || lower.includes('rides') || lower.includes('cab')) {
      triggerNavigation('rides', 'Navigating to Rides & Cabs...');
    } 
    else if (lower.includes('go to services') || lower.includes('navigate to services') || lower.includes('open services') || lower.includes('show services') || lower.includes('services') || lower.includes('jobs')) {
      triggerNavigation('services', 'Navigating to Verified Trades...');
    } 
    else if (lower.includes('go to profile') || lower.includes('navigate to profile') || lower.includes('open profile') || lower.includes('show profile') || lower.includes('profile') || lower.includes('account') || lower.includes('about me')) {
      triggerNavigation('profile', 'Navigating to Profile Center...');
    } 
    else if (lower.includes('go to home') || lower.includes('navigate to home') || lower.includes('open home') || lower.includes('show home') || lower.includes('home')) {
      triggerNavigation('home', 'Navigating to Home Dashboard...');
    }
    
    // 2. Action search triggers (Cleaner, Plumber, Electrician)
    else if (lower.includes('book a cleaner') || lower.includes('hire a cleaner') || lower.includes('cleaner') || lower.includes('cleaning')) {
      triggerSpecialSearch('services', 'cleaner', 'Booking a Professional Cleaner...');
    } 
    else if (lower.includes('book a plumber') || lower.includes('hire a plumber') || lower.includes('plumber') || lower.includes('plumbing')) {
      triggerSpecialSearch('services', 'plumber', 'Booking a Certified Plumber...');
    } 
    else if (lower.includes('book an electrician') || lower.includes('hire an electrician') || lower.includes('electrician') || lower.includes('electrical')) {
      triggerSpecialSearch('services', 'electrician', 'Booking a Verified Electrician...');
    } 
    else if (lower.includes('find a sofa') || lower.includes('buy a sofa') || lower.includes('sofa') || lower.includes('couch')) {
      triggerSpecialSearch('marketplace', 'sofa', 'Searching Marketplace for Sofas...');
    } 
    else if (lower.includes('find a chair') || lower.includes('buy a chair') || lower.includes('chair') || lower.includes('furniture')) {
      triggerSpecialSearch('marketplace', 'chair', 'Searching Marketplace for Chairs...');
    }
    
    // 3. Spoken Turn by Turn Guidance Triggers
    else if (lower.includes('guidance') || lower.includes('directions') || lower.includes('route') || lower.includes('turn by turn') || lower.includes('where am i') || lower.includes('voice guide')) {
      const active = localStorage.getItem('active_ride_active') === 'true';
      if (!active) {
        const msg = 'You are not currently on an active London Ride. Go to the Rides page and request a match to get turn-by-turn guidance.';
        setRecognizedAction(msg);
        speakGuidance(msg);
      } else {
        const driver = localStorage.getItem('active_ride_driver') || 'Cab';
        const dest = localStorage.getItem('active_ride_destination') || 'Destination';
        const rawTimer = localStorage.getItem('active_ride_timer');
        const timerVal = rawTimer ? Number(rawTimer) : 120;
        
        let guidanceText = '';
        if (timerVal > 90) {
          guidanceText = `In 100 yards, your driver ${driver} will turn left onto Great Eastern Street, then head straight towards ${dest}.`;
        } else if (timerVal > 45) {
          guidanceText = `Continue straight for 400 yards, passing the Shoreditch Town Hall on your left. Speed is normal, arriving at ${dest} in about one minute.`;
        } else if (timerVal > 15) {
          guidanceText = `Approaching destination ${dest}. Please ensure you have gathered all personal belongings. Preceding carefully to exit after driver stops.`;
        } else {
          guidanceText = `You are arriving safely content at ${dest}. Thank you for choosing a shared transport route. You save fifteen point five kg level of carbon!`;
        }
        
        setRecognizedAction(`📢 Voice Guidance: "${guidanceText}"`);
        speakGuidance(guidanceText);
      }
    }

    // 4. Emergency SOS links!
    else if (lower.includes('sos') || lower.includes('emergency') || lower.includes('panic') || lower.includes('help me')) {
      setRecognizedAction('🚨 TRIGGERING EMERGENCY SOS PANIC ROUTE 🚨');
      setTimeout(() => {
        setIsListening(false);
        // Find existing SOS buttons and click or dispatch event
        const clickMock = new CustomEvent('voice-sos-trigger');
        window.dispatchEvent(clickMock);
      }, 1000);
    }

    // 5. Contact Support
    else if (lower.includes('contact support') || lower.includes('support') || lower.includes('moderator') || lower.includes('talk to admin')) {
      const msg = "Opening support chat session. Connecting you with a verified moderator...";
      setRecognizedAction(`✓ ${msg}`);
      speakGuidance(msg);
      setTimeout(() => {
        setIsListening(false);
        if ((window as any).__openSupportChat) {
          (window as any).__openSupportChat();
        }
      }, 1200);
    }
    
    // No match
    else {
      setRecognizedAction('Command not recognized. Say "contact support", "navigate to rides", or "book a cleaner".');
    }
  };

  const triggerNavigation = (tab: string, message: string) => {
    setRecognizedAction(`✓ ${message}`);
    setTimeout(() => {
      setIsListening(false);
      if ((window as any).__navigateTab) {
        (window as any).__navigateTab(tab);
      }
    }, 1200);
  };

  const triggerSpecialSearch = (tab: string, term: string, message: string) => {
    setRecognizedAction(`✓ ${message}`);
    setTimeout(() => {
      setIsListening(false);
      if ((window as any).__setGlobalSearchTerm) {
        (window as any).__setGlobalSearchTerm(tab, term);
      }
    }, 1200);
  };

  return (
    <>
      {/* Small floating button above the bottom navigation */}
      <button
        onClick={toggleListening}
        className={`fixed bottom-20 left-4 z-40 p-4.5 rounded-full shadow-2xl transition-all active:scale-90 border-none cursor-pointer ${
          isListening 
            ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-300 dark:ring-rose-950' 
            : 'bg-slate-900 text-slate-100 hover:bg-slate-800'
        }`}
        title="Global Voice Command Voice Listener"
      >
        <Mic size={22} className={isListening ? 'animate-bounce' : ''} />
      </button>

      {/* Voice Control Hub overlay */}
      <AnimatePresence>
        {isListening && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[5000] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white dark:bg-slate-905 w-full max-w-sm rounded-[35px] p-6 text-center space-y-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative"
            >
              <button 
                onClick={() => setIsListening(false)}
                className="absolute top-4 right-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 transition-all border-none cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center space-y-4">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Voice Control Hub Active
                </span>

                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl scale-125 animate-pulse" />
                  <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-white relative z-10 shadow-lg shadow-indigo-600/30">
                    <Mic size={32} className="animate-pulse" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">"Speak now, I'm listening..."</h3>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Web Speech API Processing</p>
                </div>
              </div>

              {/* Capturing Status */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-350 italic">
                  "{transcript}"
                </p>
              </div>

              {/* Recognized Response */}
              {recognizedAction && (
                <div className={`p-4 rounded-xl text-left border ${
                  recognizedAction.includes('✓') 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                    : recognizedAction.includes('🚨')
                    ? 'bg-rose-50 border-rose-100 text-rose-700'
                    : 'bg-amber-50 border-amber-100 text-amber-700'
                }`}>
                  <p className="text-xs font-extrabold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                    {recognizedAction.includes('✓') ? (
                      <Check size={14} className="text-emerald-500 shrink-0" />
                    ) : recognizedAction.includes('🚨') ? (
                      <ShieldAlert size={14} className="text-rose-500 shrink-0" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    )}
                    Action Trigger
                  </p>
                  <p className="text-xs font-bold">{recognizedAction}</p>
                </div>
              )}

              {/* Optional Active Ride Voice Guidance Banner toggle */}
              {localStorage.getItem('active_ride_active') === 'true' && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-150/50 flex items-center justify-between text-left">
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-indigo-200 block">Active Ride Assistance</span>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase leading-none mt-1">Read out loud upcoming directions</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !voiceGuidanceEnabled;
                      setVoiceGuidanceEnabled(next);
                      localStorage.setItem('voice_guidance_enabled', next ? 'true' : 'false');
                      speakGuidance(next ? "Voice guidance enabled. I will read upcoming directions out loud." : "Voice guidance disabled.");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-colors cursor-pointer border-none ${
                      voiceGuidanceEnabled 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {voiceGuidanceEnabled ? '🔊 ON' : '🔇 OFF'}
                  </button>
                </div>
              )}

              {/* Friendly Tips */}
              <div className="pt-2 text-[10px] text-slate-400 font-semibold space-y-1.5 text-left border-t border-slate-100">
                <p className="font-extrabold text-[#94a3b8] uppercase tracking-wider">Try saying things like:</p>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-slate-550">
                  <span className="p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg">💬 "Contact Support"</span>
                  <span className="p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg">💬 "Go to rides"</span>
                  <span className="p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg">💬 "Book a cleaner"</span>
                  <span className="p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg">💬 "Emergency SOS"</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
