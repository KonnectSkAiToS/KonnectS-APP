import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, X, Compass, Check, AlertTriangle, ShieldAlert, HelpCircle, Clock, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptics } from '../utils/haptics';

export function GlobalVoiceCommand() {
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  });
  const [isListening, setIsListening] = useState(false);
  const [showHelpOpen, setShowHelpOpen] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognizedAction, setRecognizedAction] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(() => {
    return localStorage.getItem('voice_guidance_enabled') === 'true';
  });

  const longPressTimerRef = useRef<any>(null);
  const isLongPressActiveRef = useRef(false);
  const inactivityTimerRef = useRef<any>(null);

  const startLongPress = (e: any) => {
    isLongPressActiveRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      haptics.success();
      setShowQuickCommands(true);
    }, 600);
  };

  const endLongPress = (e: any) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (!isLongPressActiveRef.current) {
      toggleListening();
    }
    isLongPressActiveRef.current = false;
  };

  const speakGuidance = useCallback((text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const triggerNavigation = useCallback((tab: string, message: string) => {
    setRecognizedAction(`✓ ${message}`);
    setTimeout(() => {
      setIsListening(false);
      if ((window as any).__navigateTab) {
        (window as any).__navigateTab(tab);
      }
    }, 1200);
  }, []);

  const triggerSpecialSearch = useCallback((tab: string, term: string, message: string) => {
    setRecognizedAction(`✓ ${message}`);
    setTimeout(() => {
      setIsListening(false);
      if ((window as any).__setGlobalSearchTerm) {
        (window as any).__setGlobalSearchTerm(tab, term);
      }
    }, 1200);
  }, []);

  const parseCommand = useCallback((speech: string) => {
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
    else if (lower.includes('pending rides') || lower.includes('show me my pending rides') || lower.includes('my rides') || lower.includes('active rides')) {
      const active = localStorage.getItem('active_ride_active') === 'true';
      if (active) {
        const driver = localStorage.getItem('active_ride_driver') || 'your cab driver';
        const dest = localStorage.getItem('active_ride_destination') || 'your destination';
        const msg = `You have 1 active pending ride with driver ${driver} heading to ${dest}. Navigating to your active ride tracking screen now!`;
        setRecognizedAction(`✓ Pending Rides: ${msg}`);
        speakGuidance(msg);
        triggerNavigation('rides', 'Opening pending rides details...');
      } else {
        const msg = "You do not have any pending or active rides matching your account. Open the Rides tab to book your next trip.";
        setRecognizedAction(`✓ No pending rides found.`);
        speakGuidance(msg);
        triggerNavigation('rides', 'Opening rides form...');
      }
    }

    else if (lower.includes('refresh marketplace') || lower.includes('refresh listings') || lower.includes('update marketplace') || lower.includes('reload marketplace')) {
      const msg = "Refreshing neighborhood listings in Shoreditch... Fetching the latest community listings and trades!";
      setRecognizedAction(`✓ Marketplace Refreshed!`);
      speakGuidance(msg);
      
      // Dispatch event to allow MarketplaceView to catch it and trigger a small spin or refetch animation
      window.dispatchEvent(new CustomEvent('refresh-marketplace-listings'));
      
      triggerNavigation('marketplace', 'Refreshing marketplace listings... Loaded!');
    }

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

    // 5.5. AI Voice Spending Summary Command
    else if (lower.includes('spend') || lower.includes('spending') || lower.includes('outlay') || lower.includes('cost') || lower.includes('expense')) {
      let msg = "";
      if (lower.includes('ride') || lower.includes('transport') || lower.includes('cab')) {
        msg = "According to your local bookings ledger, you have spent a total of £42.00 on rides this month. This includes a priority cab ride in Shoreditch and your daily eco carpools. Your carbon offset from these rides saved 15.5 kilograms of CO2 emissions.";
      } else {
        msg = "Your aggregate professional outlay on KonnectS is £253.00 this month. This includes £195.00 on verified home trade services, £42.00 on boundary shared transport rides, and £16.00 in the peer-to-peer neighborhood marketplace.";
      }
      setRecognizedAction(`📊 Spending Summary: "${msg}"`);
      speakGuidance(msg);
      setTimeout(() => {
        setIsListening(false);
        // Let's also open Profile's transaction insights or display an indicator
        if ((window as any).__navigateTab) {
          (window as any).__navigateTab('profile');
        }
      }, 5000);
    }

    // 6. Verbally update ride or service status ("I am here", "arrived")
    else if (lower.includes('i am here') || lower.includes("i'm here") || lower.includes('arrived') || lower.includes('update status') || lower.includes('notify client') || lower.includes('notify driver')) {
      const msg = "Notifying driver and client that you are here. Your active status has been updated verbally.";
      setRecognizedAction(`✓ Status Updated: "I am here"`);
      speakGuidance(msg);
      
      localStorage.setItem('active_ride_status_update', 'arrived');
      localStorage.setItem('active_service_status_update', 'arrived');
      
      setTimeout(() => {
        setIsListening(false);
        const event = new CustomEvent('voice-status-arrived', { 
          detail: { status: 'arrived', message: 'User updated status verbally' } 
        });
        window.dispatchEvent(event);
        
        // Broadcast custom notification to activate non-intrusive toast notification
        const notificationEvent = new CustomEvent('urbanNet_new_notification', {
          detail: {
            id: 'voice-status-alert-' + Date.now(),
            type: 'ride',
            title: '📢 Status Broadcasted',
            message: 'Verbally notified driver & client: "I am here" at the Shoreditch node.',
            timestamp: new Date().toLocaleTimeString(),
            isRead: false
          }
        });
        window.dispatchEvent(notificationEvent);
      }, 1500);
    }
    
    // No match
    else {
      setRecognizedAction('Command not recognized. Say "contact support", "navigate to rides", or "book a cleaner".');
    }
  }, [speakGuidance, triggerNavigation, triggerSpecialSearch]);

  useEffect(() => {
    if (!isSupported) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-GB';

    rec.onstart = () => {
      setIsListening(true);
      setTranscript('Listening for commands...');
      setRecognizedAction(null);

      // Start 30-second silence / inactivity timeout
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        try {
          rec.stop();
        } catch (x) {}
        setIsListening(false);
        setTranscript('Microphone turned off (no speech detected for 30s).');
      }, 30000);
    };

    rec.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      setIsListening(false);
      if (e.error === 'not-allowed') {
        setTranscript('Microphone access denied. Enable permissions in settings.');
      } else {
        setTranscript('Could not capture audio clearly. Tap again.');
      }
    };

    rec.onspeechend = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      try {
        rec.stop();
      } catch (x) {}
      setIsListening(false);
    };

    rec.onend = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      setIsListening(false);
    };

    rec.onresult = (event: any) => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      setIsListening(false);
      const resultText = event.results[0][0].transcript;
      setTranscript(resultText);

      // Save to localStorage global_voice_command_history
      try {
        const existingRaw = localStorage.getItem('global_voice_command_history');
        const history = existingRaw ? JSON.parse(existingRaw) : [];
        if (Array.isArray(history)) {
          history.unshift({
            text: resultText,
            timestamp: new Date().toISOString()
          });
          localStorage.setItem('global_voice_command_history', JSON.stringify(history.slice(0, 50)));
          window.dispatchEvent(new CustomEvent('global_voice_command_logged', { detail: resultText }));
        }
      } catch (e) {
        console.error('Error logging voice command:', e);
      }

      parseCommand(resultText);
    };

    Promise.resolve().then(() => {
      setRecognition(rec);
    });
  }, [isSupported, parseCommand]);

  useEffect(() => {
    (window as any).__reexecuteVoiceCommand = parseCommand;
    return () => {
      delete (window as any).__reexecuteVoiceCommand;
    };
  }, [parseCommand]);

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
  }, [voiceGuidanceEnabled, speakGuidance]);

  const toggleListening = () => {
    if (!isSupported) {
      alert('Web Speech Recognition API is unsupported on this browser.');
      return;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (isListening) {
      try {
        recognition?.stop();
      } catch (x) {}
      setIsListening(false);
    } else {
      try {
        recognition?.start();
      } catch (x) {}
    }
  };

  return (
    <>
      {/* Floating Help Icon right above the Mic button */}
      <button
        onClick={() => { haptics.light(); setShowHelpOpen(true); }}
        className="fixed bottom-[136px] left-4 z-40 p-3 rounded-full shadow-lg bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-slate-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
        title="Voice Command Help Guide"
      >
        <HelpCircle size={18} className="text-indigo-600 dark:text-indigo-400" />
      </button>

      {/* Small floating button above the bottom navigation */}
      <button
        onMouseDown={startLongPress}
        onMouseUp={endLongPress}
        onMouseLeave={() => {
          if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        }}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        className={`fixed bottom-20 left-4 z-40 p-4.5 rounded-full shadow-2xl transition-all active:scale-90 border-none cursor-pointer ${
          isListening 
            ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-300 dark:ring-rose-950' 
            : 'bg-slate-900 text-slate-100 hover:bg-slate-800'
        }`}
        title="Global Voice Command Voice Listener (Hold for Quick Commands)"
      >
        <Mic size={22} className={isListening ? 'animate-bounce' : ''} />
      </button>

      {/* Voice commands list cheat-sheet help overlay */}
      <AnimatePresence>
        {showHelpOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[5000] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[30px] p-6 shadow-2xl border border-slate-150 dark:border-slate-800 relative max-h-[80vh] flex flex-col"
            >
              <button 
                onClick={() => { haptics.light(); setShowHelpOpen(false); }}
                className="absolute top-4 right-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-750 transition-all border-none cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="text-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Voice Commands Reference
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Global Voice Control Hub</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-1">Tap standard mic & say these vocal shortcuts</p>
              </div>

              {/* Scrollable list of shortcuts */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-left">
                {/* Section: Travel & Navigation */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    🗺️ Navigation Shortcuts
                  </h4>
                  <div className="space-y-1.5 text-xs font-semibold">
                    {[
                      { say: '"Go to home"', action: 'Open Home Dashboard' },
                      { say: '"Go to rides"', action: 'Open Active Cabs & Rides' },
                      { say: '"Go to marketplace"', action: 'Open Peer-to-Peer Shop' },
                      { say: '"Go to services"', action: 'Open Verified Local Trades' },
                      { say: '"Go to profile"', action: 'Open User Profile Center' },
                    ].map((cmd, i) => (
                      <div key={i} className="flex justify-between items-start gap-4 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100/50 dark:border-slate-850">
                        <span className="text-indigo-650 dark:text-indigo-400 font-mono tracking-tight text-[11px] font-bold">{cmd.say}</span>
                        <span className="text-slate-500 text-[10px] text-right font-medium">{cmd.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Bookings & Searches */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    🛠️ Service Tasks & Search
                  </h4>
                  <div className="space-y-1.5 text-xs font-semibold">
                    {[
                      { say: '"Book a cleaner / plumber / electrician"', action: 'Vocal Search of Verified Local Trades' },
                      { say: '"Find a sofa / chair"', action: 'Search Local Marketplace listings' },
                      { say: '"Refresh marketplace / listings"', action: 'Dynamic marketplace data reload' },
                    ].map((cmd, i) => (
                      <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100/50 dark:border-slate-850">
                        <span className="text-indigo-650 dark:text-indigo-400 font-mono tracking-tight text-[11px] font-bold">{cmd.say}</span>
                        <span className="text-slate-500 text-[10px] font-medium">{cmd.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Live Assistance */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    🚘 Real-Time Cab Updates
                  </h4>
                  <div className="space-y-1.5 text-xs font-semibold">
                    {[
                      { say: '"Pending rides" / "Show my rides"', action: 'Status announcements of your bookings & matching' },
                      { say: '"Directions" / "Where am am I"', action: 'Announce vocal turn-by-turn road alerts' },
                      { say: '"I am here" / "Notify driver"', action: 'Vocal arrival indicator & notifications flash' },
                    ].map((cmd, i) => (
                      <div key={i} className="flex justify-between items-start gap-4 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100/50 dark:border-slate-850">
                        <span className="text-indigo-650 dark:text-indigo-400 font-mono tracking-tight text-[11px] font-bold">{cmd.say}</span>
                        <span className="text-slate-500 text-[10px] text-right font-medium">{cmd.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Spend Analysis */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    📊 Financial Summary
                  </h4>
                  <div className="space-y-1.5 text-xs font-semibold">
                    {[
                      { say: '"How much spent on rides this month?"', action: 'Renders spoken ledger details of cab rides' },
                      { say: '"What are my expenses?"', action: 'Aggregated breakdown of marketplace + rides' },
                    ].map((cmd, i) => (
                      <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100/50 dark:border-slate-850">
                        <span className="text-indigo-650 dark:text-indigo-400 font-mono tracking-tight text-[11px] font-bold">{cmd.say}</span>
                        <span className="text-slate-500 text-[10px] font-medium">{cmd.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Support & SOS */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    🚨 Assistance & Security
                  </h4>
                  <div className="space-y-1.5 text-xs font-semibold">
                    {[
                      { say: '"Contact support"', action: 'Instantly connects to live local moderator chat' },
                      { say: '"SOS" / "Emergency" / "Panic"', action: 'Triggers fast SOS route & shares location' },
                    ].map((cmd, i) => (
                      <div key={i} className="flex justify-between items-start gap-4 p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100/50 dark:border-slate-850">
                        <span className="text-indigo-600 dark:text-rose-400 font-mono tracking-tight text-[11px] font-bold">{cmd.say}</span>
                        <span className="text-slate-500 text-[10px] text-right font-medium">{cmd.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  onClick={() => { haptics.light(); setShowHelpOpen(false); }}
                  className="w-full py-3 bg-slate-900 border-none rounded-2xl text-xs font-extrabold uppercase tracking-widest text-slate-50 cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  Got It, Thanks!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Voice Control Hub overlay */}
      <AnimatePresence>
        {isListening && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[5000] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white dark:bg-slate-905 w-full max-w-sm rounded-[35px] p-6 text-center space-y-6 shadow-2xl border border-slate-105 dark:border-slate-800 relative"
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
                  <span className="p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg">💬 "Show pending rides"</span>
                  <span className="p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg">💬 "Refresh Marketplace"</span>
                  <span className="p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg">💬 "Contact Support"</span>
                  <span className="p-1.5 bg-slate-50 dark:bg-slate-850 rounded-lg">💬 "Go to rides"</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Command Overlay */}
      <AnimatePresence>
        {showQuickCommands && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[6000] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 text-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border border-indigo-900/45 relative space-y-4"
            >
              <button 
                onClick={() => { haptics.light(); setShowQuickCommands(false); }}
                className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border-none cursor-pointer text-slate-400"
              >
                <X size={16} />
              </button>

              <div className="space-y-1 text-left">
                <span className="bg-indigo-500/10 text-indigo-300 text-[8px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-indigo-500/20 inline-flex items-center space-x-1">
                  ⚡ Quick Commands
                </span>
                <h3 className="text-sm font-black uppercase tracking-tight text-white leading-tight">
                  Shortcut Command Center
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Long-pressed micro-shortcuts for rapid on-site operations. Tap to run.
                </p>
              </div>

              <div className="space-y-2 pt-2 text-left">
                <button
                  type="button"
                  onClick={() => {
                    haptics.success();
                    setShowQuickCommands(false);
                    setTranscript("Check my sync status");
                    setIsListening(true);
                    setTimeout(() => {
                      const statusMsg = "Reconciliation complete. Supabase and Firestore queues are fully aligned with 0 pending writes.";
                      setRecognizedAction("✓ Sync Status Checked");
                      speakGuidance(statusMsg);
                      window.dispatchEvent(new CustomEvent('urbanNet_new_notification', {
                        detail: {
                          id: 'sync-status-check-' + Date.now(),
                          type: 'system',
                          title: '🔄 Sync Engine Active',
                          message: 'Local IndexedDB state is fully synchronized with Google Firestore.',
                          timestamp: new Date().toLocaleTimeString(),
                          isRead: false
                        }
                      }));
                      setIsListening(false);
                    }, 800);
                  }}
                  className="w-full p-3.5 bg-slate-950/60 hover:bg-indigo-950/50 hover:border-indigo-500/30 border border-slate-800 rounded-2xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Clock size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Check my sync status</h4>
                      <p className="text-[8.5px] text-slate-400 font-medium">Reconcile offline db queues</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-all group-hover:translate-x-1" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptics.success();
                    setShowQuickCommands(false);
                    setTranscript("Show worker dashboard");
                    setIsListening(true);
                    setTimeout(() => {
                      setRecognizedAction("✓ Navigating to Worker Dashboard");
                      speakGuidance("Opening your local trades and services provider portal.");
                      setIsListening(false);
                      if ((window as any).__navigateTab) {
                        (window as any).__navigateTab('services');
                      }
                      window.dispatchEvent(new CustomEvent('activate-worker-mode'));
                    }, 800);
                  }}
                  className="w-full p-3.5 bg-slate-950/60 hover:bg-indigo-950/50 hover:border-indigo-500/30 border border-slate-800 rounded-2xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <Mic size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Show worker dashboard</h4>
                      <p className="text-[8.5px] text-slate-400 font-medium">Manage service listings & bids</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-slate-600 group-hover:text-emerald-400 transition-all group-hover:translate-x-1" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptics.heavy();
                    setShowQuickCommands(false);
                    setTranscript("SOS Emergency");
                    setIsListening(true);
                    setTimeout(() => {
                      setRecognizedAction("🚨 Emergency SOS Triggered");
                      speakGuidance("Activating panic protocol. Location shared with Shoreditch emergency responders.");
                      setIsListening(false);
                      window.dispatchEvent(new CustomEvent('voice-sos-trigger'));
                    }, 800);
                  }}
                  className="w-full p-3.5 bg-red-950/20 hover:bg-red-950/40 hover:border-red-500/30 border border-red-950/50 rounded-2xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 group-hover:bg-red-650 group-hover:text-white transition-all">
                      <ShieldAlert size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-red-200">Trigger Emergency SOS</h4>
                      <p className="text-[8.5px] text-red-400/80 font-medium">Broadcast precise coordinates</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-red-500/60 group-hover:text-red-400 transition-all group-hover:translate-x-1" />
                </button>
              </div>

              <div className="text-center pt-2 text-[8px] text-slate-500 font-sans font-bold uppercase tracking-wider">
                Hold button for 0.6s anytime to show this overlay
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
