/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, User, Sparkles } from 'lucide-react';
import { askAI } from '../services/geminiService';
import { haptics } from '../utils/haptics';

export function GeminiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: 'Hi! I am KonnectS AI. How can I help you today? I can help with booking services, finding items, or explaining how the rewards work!' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const parseConversationSlots = () => {
    // Collect all chat text together
    const chatText = messages.map(m => m.text.toLowerCase()).join(' ');
    
    // Default smart suggestion slots
    const suggestions = [
      { day: 'Tomorrow Afternoon', time: '14:00', reason: 'Matches typical off-peak low fare rate slots' },
      { day: 'This Coming Saturday', time: '10:30', reason: 'Weekend premium coverage with active workers' },
      { day: 'Next Monday morning', time: '09:00', reason: 'Central London rush-hour worker proximity high' }
    ];

    if (chatText.includes('morning') || chatText.includes('am')) {
      suggestions[0] = { day: 'Tomorrow Morning', time: '09:30', reason: 'Matches your morning conversational preference' };
    }
    if (chatText.includes('weekend') || chatText.includes('saturday') || chatText.includes('sunday')) {
      suggestions[0] = { day: 'Saturday Morning', time: '10:00', reason: 'Matches your weekend preference' };
    }
    if (chatText.includes('urgent') || chatText.includes('now') || chatText.includes('emergency')) {
      suggestions[0] = { day: 'Immediate Dispatch', time: 'Within 45 mins', reason: 'Triggered by high-urgency keywords' };
    }
    
    return suggestions;
  };

  useEffect(() => {
    (window as any).__openAssistantWithMessage = (text: string) => {
      setIsOpen(true);
      setMessages(prev => [...prev, { role: 'ai', text }]);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    const response = await askAI(userMsg);
    
    setIsTyping(false);
    setMessages(prev => [...prev, { role: 'ai', text: response || "I'm not sure how to answer that. Could you try rephrasing?" }]);
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed right-6 bottom-24 w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl z-50 shadow-slate-900/30"
        id="ai-assistant-btn"
      >
        <Bot size={24} />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50, x: 20 }}
            className="fixed right-6 bottom-24 w-[calc(100vw-48px)] max-w-sm h-[500px] bg-white rounded-3xl shadow-2xl z-[60] flex flex-col overflow-hidden border border-slate-100"
          >
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">KonnectS Assistant</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Sub-Header Actions */}
            <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center text-white">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">AI TOOLS</span>
              <button
                type="button"
                onClick={() => { haptics.light(); setShowScheduler(!showScheduler); }}
                className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer border-none"
              >
                <Sparkles size={11} className="text-amber-300 animate-pulse mr-0.5" />
                <span>Smart Schedule</span>
              </button>
            </div>

            {/* Smart Schedule Integration */}
            {showScheduler && (
              <div className="p-4 bg-indigo-50 border-b border-indigo-150 text-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1">
                    <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-950">AI Smart Scheduler</span>
                  </div>
                  <button onClick={() => setShowScheduler(false)} className="text-[9px] font-bold text-indigo-600 hover:underline uppercase border-none bg-transparent cursor-pointer">Close</button>
                </div>
                
                <p className="text-[10.5px] font-semibold text-slate-500 leading-normal">
                  {messages.length <= 1 
                    ? "Chat with the assistant about booking details first so we can parse suggestions!" 
                    : "Analyzed current conversation threads for upcoming services:"}
                </p>

                {messages.length > 1 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {parseConversationSlots().map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          haptics.success();
                          const acceptMsg = `Great! I've accepted and applied the AI suggested slot: ${slot.day} at ${slot.time}. Ready to dispatch!`;
                          setMessages(prev => [...prev, { role: 'ai', text: acceptMsg }]);
                          setShowScheduler(false);
                        }}
                        className="w-full bg-white hover:bg-indigo-100 p-2.5 rounded-xl border border-indigo-200 flex flex-col text-left transition-all active:scale-98 border-none cursor-pointer"
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-[11px] font-black text-indigo-900">{slot.day}</span>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-black">{slot.time}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold mt-1 italic">{slot.reason}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-50/50">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: msg.role === 'ai' ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'ai' 
                      ? 'bg-white text-slate-800 rounded-tl-none shadow-sm' 
                      : 'bg-slate-900 text-white rounded-tr-none'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100 flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 bg-slate-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="p-2 bg-slate-900 text-white rounded-xl disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
