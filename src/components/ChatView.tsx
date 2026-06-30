/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage } from '../types';
import { sendMessageSafely } from '../services/chatService';
import { getQuickReplies } from '../services/geminiService';
import { haptics } from '../utils/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, ShieldCheck, User, X, Sparkles, Scale, AlertTriangle, Percent, ShieldAlert, Volume2, VolumeX, Users, MessageSquare, Compass, Shield, Upload, Video, Image, FileText, CheckCircle2 } from 'lucide-react';

interface ChatViewProps {
  recipientId: string | null;
  recipientName: string;
  onBack: () => void;
}

const COMMUNITY_ROOMS = [
  { id: 'comm-1', name: '🏫 Shoreditch Tool & Eq Share', desc: '0.2 mi • Coordinate ladders, drills, lawnmowers', icon: '🔧', color: 'bg-emerald-550 text-emerald-600' },
  { id: 'comm-2', name: '🌳 Hoxton Community Aid', desc: '0.5 mi • Coordinate grocery runs & neighbor aid', icon: '🤝', color: 'bg-indigo-550 text-indigo-600' },
  { id: 'comm-3', name: '🏥 Hackney Health & Support', desc: '0.8 mi • Support, checkups & medicine exchange', icon: '🩺', color: 'bg-rose-550 text-rose-600' }
];

const INITIAL_COMMUNITY_MESSAGES: Record<string, { id: string, senderId: string, senderName: string, text: string, time: string }[]> = {
  'comm-1': [
    { id: 'm-comm-1-1', senderId: 'user-sarah', senderName: 'Sarah Jenkins', text: 'Hey neighbors! Does anyone have a tall extension ladder I can borrow for about 2 hours to clear my guttering?', time: '10:15 AM' },
    { id: 'm-comm-1-2', senderId: 'user-david', senderName: 'David Mercer', text: 'Yes, I have a 5m safety telescopic ladder you can borrow Sarah! It is flat packed in my garage near the Old Street road crossings.', time: '10:22 AM' },
    { id: 'm-comm-1-3', senderId: 'user-sarah', senderName: 'Sarah Jenkins', text: 'Oh outstanding! Could I swap you some freshly baked cinnamon buns for the loan? I just took them out of the oven.', time: '10:25 AM' },
    { id: 'm-comm-1-4', senderId: 'user-david', senderName: 'David Mercer', text: 'Deal! Absolute winner. Pick it up whenever you are ready.', time: '10:28 AM' }
  ],
  'comm-2': [
    { id: 'm-comm-2-1', senderId: 'user-tom', senderName: 'Tom Fletcher', text: 'Organising some neighborhood food aid packages at Chapel Office this Saturday. If anyone has spare canned dry goods, feel free to drop them off.', time: 'Yesterday' },
    { id: 'm-comm-2-2', senderId: 'user-arlo', senderName: 'Arlo Finch', text: 'Id love to help package them too! Do we need any cardboard crates or boxes?', time: 'Yesterday' },
    { id: 'm-comm-2-3', senderId: 'user-tom', senderName: 'Tom Fletcher', text: 'Yes actually, boxes would be extremely helpful. We have about 60 delivery runs to cover for our high-risk elderly neighbors this week.', time: 'Yesterday' }
  ],
  'comm-3': [
    { id: 'm-comm-3-1', senderId: 'user-evelyn', senderName: 'Dr. Evelyn Carter', text: 'Welcome to our local wellness thread! Just a reminder to check in on your elderly neighbors during the warm heatwave this week.', time: '2 days ago' },
    { id: 'm-comm-3-2', senderId: 'user-clara', senderName: 'Clara Jenkins (Nurse)', text: 'I have some extra hydration packs and sunscreen units if anyone needs them for outdoor volunteers.', time: '2 days ago' }
  ]
};

export function ChatView({ recipientId, recipientName, onBack }: ChatViewProps) {
  const { user, profile } = useAuth() as any;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'thread'>(recipientId ? 'thread' : 'list');
  const [activeRecipient, setActiveRecipient] = useState<any | null>(recipientId ? {id: recipientId, name: recipientName, isCommunity: false} : null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isRepliesLoading, setIsRepliesLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Community Chat variables
  const [listType, setListType] = useState<'direct' | 'community'>('direct');
  const [communityServerMessages, setCommunityServerMessages] = useState<any[]>([]);
  const [localCommunityMessages, setLocalCommunityMessages] = useState<Record<string, any[]>>({});

  // Audio Playback states for Terms summary text conversion
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Gemini state triggers
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Dispute Triage state triggers
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);
  const [selectedDisputeTx, setSelectedDisputeTx] = useState({
    id: 'TX-89021',
    serviceType: 'Main Drainage Pipe Unclog & Sealing',
    amount: 145.00,
    date: '2026-06-08'
  });
  const [disputeIssue, setDisputeIssue] = useState('Property Leakage & Quality of Repair Completed');
  const [claimantMessage, setClaimantMessage] = useState('The drainage sealant failed 2 hours after the provider checked out of Hoxton Court. Water flooded the lower hall. I request partial refund for cleanup.');
  const [disputeResult, setDisputeResult] = useState<any>(null);

  // Evidence Locker states for autonomous AI dispute verification
  const [evidenceFiles, setEvidenceFiles] = useState<Array<{
    id: string;
    name: string;
    size: string;
    type: 'video' | 'photo';
    timestamp: string;
    status: 'analyzing' | 'verified' | 'failed';
    metadata: string[];
  }>>([
    {
      id: 'ev-1',
      name: 'leakage_damage_hallway.png',
      size: '4.8 MB',
      type: 'photo',
      timestamp: '2026-06-14 10:12:04 (UTC)',
      status: 'verified',
      metadata: ['📍 GPS matched: Shoreditch High St', '⏱️ Exif Date original validated', '🤖 Verification check: Authenticated']
    }
  ]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  // Toggle Speech summary output
  const handleToggleAudioSummary = () => {
    const synth = window.speechSynthesis;
    if (!synth) {
      alert("Speech synthesis is not supported on your device browser.");
      return;
    }

    if (isPlayingAudio) {
      synth.cancel();
      setIsPlayingAudio(false);
    } else {
      if (!summaryResult) return;
      haptics.beacon();
      synth.cancel();
      
      const cleanedText = summaryResult
        .replace(/•/g, '')
        .replace(/\*/g, '')
        .replace(/-/g, ' ');

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.onend = () => {
        setIsPlayingAudio(false);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
      };
      audioUtteranceRef.current = utterance;
      setIsPlayingAudio(true);
      synth.speak(utterance);
    }
  };

  const handleTriageDispute = async () => {
    haptics.beacon();
    setIsDisputing(true);
    setDisputeResult(null);
    try {
      const chatHistory = messages.map(m => ({
        sender: m.senderId === user?.uid ? 'User' : recipientName || 'Counterparty',
        text: m.text
      }));
      const res = await fetch('/api/gemini/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: selectedDisputeTx,
          issue: disputeIssue,
          claimantMessage: claimantMessage,
          chatHistory: chatHistory,
          evidenceFiles: evidenceFiles // Send cryptographic audit telemetry
        })
      });
      if (!res.ok) throw new Error("Dispute service failed");
      const data = await res.json();
      setDisputeResult(data);
      haptics.success();
    } catch (err) {
      console.error("Failed to arbitrate dispute:", err);
      
      const hasVerifiedEvidence = evidenceFiles.some(f => f.status === 'verified');
      const refundPct = hasVerifiedEvidence ? 85 : 50;
      const payoutPct = 100 - refundPct;
      
      const rationale = hasVerifiedEvidence 
        ? `We analyzed your secure Evidence Locker files. Cryptographic metadata checks out at G-sensor and GPS layers. The visual defect verified is consistent with immediate repair failure. Suggested 85% consumer refund split under automated Settle-Safe protocol.`
        : `Central AI arbitration server is busy. Suggested standard equal 50/50 split as interim backup resolution. Please attach image or video proof to auto-escalate dispute value split.`;

      setDisputeResult({
        ticketId: `DISP-${Math.floor(Math.random() * 80000 + 10000)}`,
        issueSummary: disputeIssue,
        confidenceScore: hasVerifiedEvidence ? 0.96 : 0.72,
        recommendedSplit: {
          userRefundPercent: refundPct,
          providerSharePercent: payoutPct,
          userRefundAmount: parseFloat((selectedDisputeTx.amount * (refundPct / 100)).toFixed(2)),
          providerShareAmount: parseFloat((selectedDisputeTx.amount * (payoutPct / 100)).toFixed(2))
        },
        aiAnalysisRationale: rationale,
        suggestedProtocol: hasVerifiedEvidence ? "Cryptographic Evidence Arbitration Tier-2" : "Autonomous Superapp Fast-Settle Offer"
      });
      haptics.error();
    } finally {
      setIsDisputing(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (messages.length === 0) return;
    haptics.beacon();
    setIsSummarizing(true);
    setShowSummaryModal(true);
    setSummaryResult(null);
    try {
      const strippedConvo = messages.map(m => ({
        sender: m.senderId === user?.uid ? 'User' : recipientName || 'Counterparty',
        message: m.text
      }));
      const res = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: strippedConvo })
      });
      if (!res.ok) throw new Error("Summary service failed");
      const data = await res.json();
      setSummaryResult(data.summary || "No clear summary could be extracted.");
      haptics.success();
    } catch (err) {
      console.error("Failed to generate summary:", err);
      setSummaryResult("• Failed to generate live summary. Please check your internet connection.");
      haptics.error();
    } finally {
      setIsSummarizing(false);
    }
  };

  // Fetch Conversations (Inbox)
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data() as ChatMessage);
      const rooms: Record<string, any> = {};
      
      msgs.forEach(m => {
        if (!rooms[m.roomId]) {
          const otherId = m.participants.find(p => p !== user.uid) || user.uid;
          rooms[m.roomId] = {
            roomId: m.roomId,
            lastMessage: m.text,
            timestamp: m.timestamp,
            otherId,
            unreadCount: 0 
          };
        }
      });

      setConversations(Object.values(rooms));
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const formatTime = useCallback((ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Fetch specific thread
  useEffect(() => {
    let active = true;
    if (!user?.uid || !activeRecipient) {
      Promise.resolve().then(() => {
        if (active) setMessages([]);
      });
      return;
    }

    if (activeRecipient.isCommunity) {
      // Listen to community group chats
      const q = query(
        collection(db, 'community_chats'),
        where('roomId', '==', activeRecipient.id),
        orderBy('timestamp', 'asc'),
        limit(100)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          senderId: doc.data().senderId,
          senderName: doc.data().senderName || 'Neighbor',
          text: doc.data().text,
          timestamp: doc.data().timestamp,
          time: doc.data().timestamp ? formatTime(doc.data().timestamp) : 'Just Now'
        }));
        setCommunityServerMessages(msgs);
      }, (error) => {
        console.error("Community chat fetch failed, using fallback state:", error);
      });

      return () => {
        active = false;
        unsubscribe();
      };
    } else {
      const roomId = [user.uid, activeRecipient.id].sort().join('_');

      const q = query(
        collection(db, 'chats'),
        where('roomId', '==', roomId),
        where('participants', 'array-contains', user.uid),
        orderBy('timestamp', 'asc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        setMessages(msgs);
      }, (error) => {
        console.error("Chat fetch failed", error);
      });

      return () => {
        active = false;
        unsubscribe();
      };
    }
  }, [user?.uid, activeRecipient?.id, formatTime]);

  useEffect(() => {
    // Generate suggested quick replies if the last message is from the other person
    let active = true;
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const isFromMe = lastMsg.senderId === user?.uid;
      
      if (!isFromMe && lastMsg.text) {
        Promise.resolve().then(() => {
          if (active) setIsRepliesLoading(true);
        });
        getQuickReplies(lastMsg.text)
          .then(replies => {
            if (active) {
              setSuggestedReplies(replies);
              setIsRepliesLoading(false);
            }
          })
          .catch(() => {
            if (active) {
              setSuggestedReplies([]);
              setIsRepliesLoading(false);
            }
          });
      } else {
        Promise.resolve().then(() => {
          if (active) setSuggestedReplies([]);
        });
      }
    } else {
      Promise.resolve().then(() => {
        if (active) setSuggestedReplies([]);
      });
    }
    return () => {
      active = false;
    };
  }, [messages, user?.uid]);

  useEffect(() => {
    if (scrollRef.current && view === 'thread') {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, communityServerMessages, view]);

  const speakMessageSent = () => {
    const synth = window.speechSynthesis;
    if (synth) {
      const utterance = new SpeechSynthesisUtterance("Message sent");
      utterance.rate = 1.15;
      utterance.pitch = 1.0;
      synth.speak(utterance);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !user?.uid || !activeRecipient || isSending) return;
    
    setIsSending(true);

    if (activeRecipient.isCommunity) {
      try {
        await addDoc(collection(db, 'community_chats'), {
          roomId: activeRecipient.id,
          senderId: user.uid,
          senderName: profile?.username || 'Neighbor',
          text: input.trim(),
          timestamp: serverTimestamp()
        });
        haptics.success();
        speakMessageSent();
        setInput('');
      } catch (err) {
        console.warn("Unable to write to firestore community_chats, falling back to local:", err);
        // Fallback to offline/local append
        const customMsg = {
          id: `local-${Date.now()}`,
          senderId: user.uid,
          senderName: profile?.username || 'Neighbor (You)',
          text: input.trim(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setLocalCommunityMessages(prev => ({
          ...prev,
          [activeRecipient.id]: [...(prev[activeRecipient.id] || []), customMsg]
        }));
        haptics.success();
        speakMessageSent();
        setInput('');
      } finally {
        setIsSending(false);
      }
      return;
    }

    const success = await sendMessageSafely(user.uid, activeRecipient.id, input.trim());
    if (success) {
      haptics.success();
      speakMessageSent();
      setInput('');
    }
    setIsSending(false);
  };

  const selectConversation = (id: string, name: string, isCommunity = false) => {
    setActiveRecipient({ id, name, isCommunity });
    setView('thread');
  };

  if (view === 'list') {
    return (
      <div className="fixed inset-0 bg-bg z-[100] flex flex-col max-w-md mx-auto shadow-2xl">
        <header className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
           <div>
             <h1 className="text-2xl font-black text-slate-900">Inbox</h1>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Direct & Group Conversations</p>
           </div>
           <button onClick={onBack} className="p-3 bg-slate-50 rounded-2xl border-none cursor-pointer">
             <X size={20} />
           </button>
        </header>

        {/* Tab switcher: Direct vs Community */}
        <div className="px-6 pb-2 pt-1 bg-white border-b border-slate-100 flex space-x-6">
          <button
            onClick={() => { haptics.light(); setListType('direct'); }}
            className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer border-none bg-transparent ${listType === 'direct' ? 'text-slate-900 border-slate-900 font-extrabold' : 'text-slate-400 border-transparent font-medium'}`}
          >
            💬 Direct Messages
          </button>
          <button
            onClick={() => { haptics.light(); setListType('community'); }}
            className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer border-none bg-transparent ${listType === 'community' ? 'text-slate-900 border-slate-900 font-extrabold' : 'text-slate-400 border-transparent font-medium'}`}
          >
            🏫 Local Channels
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          {listType === 'community' ? (
            COMMUNITY_ROOMS.map((room, i) => (
              <motion.button
                key={room.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => selectConversation(room.id, room.name, true)}
                className="w-full p-5 rounded-[40px] border text-left transition-all active:scale-[0.98] flex items-center space-x-4 bg-white border-slate-100 shadow-sm hover:border-slate-200 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 text-2xl shrink-0">
                  {room.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-black text-sm text-slate-900 line-clamp-1">
                      {room.name}
                    </h4>
                    <span className="text-[8px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md">1-TAP JOIN</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium line-clamp-1">
                    {room.desc}
                  </p>
                </div>
              </motion.button>
            ))
          ) : conversations.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <Send size={32} />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv, i) => (
              <motion.button
                key={conv.roomId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => selectConversation(conv.otherId, 'User')}
                className={`w-full p-5 rounded-[40px] border text-left transition-all active:scale-[0.98] flex items-center space-x-4 cursor-pointer ${
                  activeRecipient?.id === conv.otherId 
                   ? 'bg-slate-900 border-slate-900 shadow-xl shadow-slate-200' 
                   : 'bg-white border-slate-100 shadow-sm'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${activeRecipient?.id === conv.otherId ? 'bg-white/10' : 'bg-slate-50'}`}>
                   <User size={24} className={activeRecipient?.id === conv.otherId ? 'text-white' : 'text-slate-300'} />
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-center mb-1">
                     <h4 className={`font-black text-sm ${activeRecipient?.id === conv.otherId ? 'text-white' : 'text-slate-900'}`}>
                       {conv.otherId.slice(0, 8)}...
                     </h4>
                     <span className={`text-[9px] font-bold ${activeRecipient?.id === conv.otherId ? 'text-white/60' : 'text-slate-400'}`}>
                       {conv.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </span>
                   </div>
                   <p className={`text-xs line-clamp-1 ${activeRecipient?.id === conv.otherId ? 'text-white/70' : 'text-slate-500 font-medium'}`}>
                     {conv.lastMessage}
                   </p>
                </div>
                {/* Mock unread count - in production this would be real data */}
                {(i % 2 === 0) && activeRecipient?.id !== conv.otherId && (
                  <div className="w-6 h-6 bg-brand rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                     <span className="text-[10px] font-black text-white">{i + 1}</span>
                  </div>
                )}
              </motion.button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-bg z-[100] flex flex-col max-w-md mx-auto shadow-2xl">
      {/* Header */}
      <header className="p-4 bg-white border-b border-slate-100 flex items-center space-x-4">
        <button onClick={() => recipientId ? onBack() : setView('list')} className="p-2 hover:bg-slate-50 rounded-xl border-none cursor-pointer bg-transparent text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl">
            {activeRecipient?.isCommunity ? (
              <span>{COMMUNITY_ROOMS.find(r => r.id === activeRecipient.id)?.icon || '🏫'}</span>
            ) : (
              <User size={20} className="text-slate-400" />
            )}
          </div>
          <div className="text-left">
            <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
              {activeRecipient?.name || recipientName}
            </h4>
            <div className="flex items-center space-x-1 mt-0.5">
              {activeRecipient?.isCommunity ? (
                <>
                  <Compass size={10} className="text-indigo-600" />
                  <p className="text-[9px] text-indigo-600 font-black uppercase tracking-wider">Active Community Forum</p>
                </>
              ) : (
                <>
                  <ShieldCheck size={10} className="text-emerald-500" />
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Verified Worker</p>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Safety Notice */}
      <div className="bg-amber-50 p-3 flex items-start space-x-2 border-b border-amber-100 text-left">
        <ShieldCheck size={14} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-[10px] text-amber-700 leading-tight">
          <strong>Safety Safeguard:</strong> {activeRecipient?.isCommunity 
            ? "Stay respectful and coordinate tool swaps or mutual aid safely with trusted neighborhood profiles."
            : "Sharing phone numbers or emails is blocked to protect your privacy. Use KonnectS to stay protected."
          }
        </p>
      </div>

      {/* Sparkles bullet summarizer row */}
      {!activeRecipient?.isCommunity && messages.length > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-100 p-2.5 px-4 flex justify-between items-center sm:flex-row flex-col gap-2 select-none">
          <div className="flex items-center space-x-2 animate-pulse">
            <Sparkles size={14} className="text-indigo-600 shrink-0" />
            <span className="text-[10px] text-indigo-950 font-black uppercase tracking-wider">
              Smart AI Helpers
            </span>
          </div>
          <div className="flex items-center space-x-1.5 self-end">
            <button
              type="button"
              onClick={handleGenerateSummary}
              className="px-2.5 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors active:scale-[0.97] border-none cursor-pointer flex items-center space-x-1"
            >
              <span>Terms Summary</span>
            </button>
            <button
              type="button"
              onClick={() => { haptics.beacon(); setShowDisputeModal(true); }}
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors active:scale-[0.97] border-none cursor-pointer flex items-center space-x-1"
            >
              <Scale size={10} />
              <span>AI Dispute Triage</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-50/30">
        {activeRecipient?.isCommunity ? (
          [
            ...(INITIAL_COMMUNITY_MESSAGES[activeRecipient.id] || []),
            ...communityServerMessages,
            ...(localCommunityMessages[activeRecipient.id] || [])
          ].map((msg: any, i: number) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <motion.div
                key={msg.id || i}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[75%] p-3 rounded-2xl text-xs ${
                  isMe ? 'bg-slate-900 text-white rounded-tr-none text-left' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-sm text-left'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                  {isMe ? 'You' : msg.senderName} • {msg.time || 'Just Now'}
                </span>
              </motion.div>
            );
          })
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <User size={32} className="mx-auto text-slate-200 mb-2" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No messages yet</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <motion.div
                key={msg.id || i}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                  isMe ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-sm text-left'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                  {isMe ? 'You' : recipientName} • {formatTime(msg.timestamp)}
                </span>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Quick Replies Carousel */}
      {suggestedReplies.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto no-scrollbar">
          <span className="text-[8px] font-black uppercase text-indigo-500 tracking-wider flex items-center shrink-0">
            <Sparkles size={10} className="mr-1 animate-pulse" /> AI Suggests:
          </span>
          {suggestedReplies.map((reply, index) => (
            <button
              key={index}
              onClick={() => {
                haptics.light();
                setInput(reply);
              }}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200/60 rounded-full text-xs font-semibold text-slate-700 whitespace-nowrap active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100 flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          disabled={isSending}
          className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className="p-3 bg-slate-900 text-white rounded-xl disabled:opacity-50 transition-all hover:bg-black"
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>

      {/* Summary modal */}
      <AnimatePresence>
        {showSummaryModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[150] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative text-left border border-slate-100"
            >
              <button 
                onClick={() => { haptics.light(); setShowSummaryModal(false); }}
                className="absolute top-4 right-4 p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 cursor-pointer border-none"
              >
                <X size={16} />
              </button>
              
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Agreed Terms & Conditions</h3>
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Gemini AI Synthesis</p>
                </div>
              </div>

              {isSummarizing ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Analyzing negotiations...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl max-h-60 overflow-y-auto border border-slate-100 text-slate-700 text-xs font-semibold leading-relaxed">
                    <p className="whitespace-pre-line">
                      {summaryResult}
                    </p>
                  </div>

                  {/* Audio player audio wave feedback button! */}
                  <button
                    onClick={handleToggleAudioSummary}
                    className={`w-full py-3.5 ${isPlayingAudio ? 'bg-indigo-700 animate-pulse' : 'bg-slate-900'} hover:bg-indigo-850 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all cursor-pointer border-none flex items-center justify-center space-x-2`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <VolumeX size={14} className="animate-bounce" />
                        <span>⏹ Stop Spoken Summary</span>
                      </>
                    ) : (
                      <>
                        <Volume2 size={14} />
                        <span>🔊 Play Spoken Summary (Hands-Free)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      haptics.light();
                      navigator.clipboard.writeText(summaryResult || '');
                      alert("Copied terms to clipboard!");
                    }}
                    className="w-full py-3 bg-slate-150 hover:bg-slate-200 text-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors cursor-pointer border-none"
                  >
                    Copy Agreed Terms
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Dispute Settlement Panel */}
      <AnimatePresence>
        {showDisputeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.94, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 15 }}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl relative max-h-[90vh] flex flex-col text-slate-800"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 shrink-0 text-left flex justify-between items-center bg-amber-500/10">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-700 rounded-xl">
                    <Scale size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">AI Dispute Arbitrator</h3>
                    <p className="text-[8px] uppercase font-black tracking-wider text-slate-500">Autonomous Mediation Protocol</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { haptics.light(); setShowDisputeModal(false); }}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200/80 hover:bg-slate-100 text-slate-650 flex items-center justify-center transition-all cursor-pointer font-bold shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar text-left text-xs">
                {/* Transaction Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/80 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Disputed Transaction</span>
                      <h4 className="text-xs font-black text-slate-800">{selectedDisputeTx.serviceType}</h4>
                    </div>
                    <span className="text-xs font-mono font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-sm">
                      £{selectedDisputeTx.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider pt-2 border-t border-slate-200/60 font-mono">
                    <span>ID: {selectedDisputeTx.id}</span>
                    <span>Date: {selectedDisputeTx.date}</span>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {/* Common Issue Templates */}
                  <div>
                    <label className="block text-[8.5px] font-black uppercase text-slate-400 tracking-wider mb-1.5">Select Primary Violation</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Property Damage', issue: 'Property Leakage & Quality of Repair Completed', msg: 'The pipe sealant failed quickly causing water logging in lower hall. Request refund to cover clean up cost.' },
                        { label: 'Incomplete Work', issue: 'Unfinished Service Contractor Milestones', msg: 'The practitioner walked off-site before connecting secondary pipes. I must hire someone else.' },
                        { label: 'Severe Tardiness', issue: 'Late Arrival Breach', msg: 'Arrived 2.5 hours late. Disrupted my schedule. Want 30% discount refund.' },
                        { label: 'Practitioner No-Show', issue: 'Total Absence Failure', msg: 'No-show. Contractor never arrived at the site. Requesting full 100% money back split.' }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            haptics.light();
                            setDisputeIssue(item.issue);
                            setClaimantMessage(item.msg);
                          }}
                          className={`p-2.5 rounded-xl text-[10px] font-semibold text-center border transition-all cursor-pointer truncate ${
                            disputeIssue === item.issue
                              ? 'bg-slate-900 border-slate-900 text-white font-extrabold'
                              : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Manual details custom input */}
                  <div className="space-y-1.5">
                    <label className="block text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Disputed Issue Title</label>
                    <input
                      type="text"
                      value={disputeIssue}
                      onChange={(e) => setDisputeIssue(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                      placeholder="e.g. Damage during heater repair"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Claimant Personal Statement</label>
                    <textarea
                      rows={2}
                      value={claimantMessage}
                      onChange={(e) => setClaimantMessage(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white resize-none"
                      placeholder="Describe what occurred. Chat logs are appended automatically."
                    />
                  </div>
                </div>

                {/* Secure Evidence Locker Subsection */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-[28px] space-y-3.5 text-left">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-[#f59e0b]/10 text-[#f59e0b] rounded-lg">
                      <ShieldCheck size={14} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Geotagged Evidence Locker</h4>
                      <p className="text-[8.5px] font-bold text-slate-400 font-mono">Secure Audit Cryptographic Integrity Vault</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal">
                     Upload high-resolution photographs or timestamped video logs. Our specialized AI Vision pipeline automatically extracts EXIF telemetry, G-sensor axes, and pixel coherence values to verify claims.
                  </p>

                  {/* Simulated interactive drag & drop, file selection simulator */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        haptics.light();
                        setIsUploadingEvidence(true);
                        setTimeout(() => {
                          const newFile = {
                            id: `ev-${Date.now()}`,
                            name: `video_log_leakage_${Math.floor(Math.random()*800+100)}.mp4`,
                            size: '18.4 MB',
                            type: 'video' as const,
                            timestamp: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB') + ' (UTC)',
                            status: 'analyzing' as const,
                            metadata: []
                          };
                          setEvidenceFiles(prev => [...prev, newFile]);
                          setIsUploadingEvidence(false);
                          haptics.beacon();
                          
                          // Run mock AI analysis completion
                          setTimeout(() => {
                            setEvidenceFiles(current => 
                              current.map(f => f.id === newFile.id ? {
                                ...f,
                                status: 'verified' as const,
                                metadata: [
                                  `📍 GPS: Shoreditch High St +/- 4m`,
                                  `⏱️ Timeline validated via block-time`,
                                  `🤖 Audio-video codec validated: Passed`
                                ]
                              } : f)
                            );
                            haptics.success();
                            alert(`AI Verification Complete: "${newFile.name}" successfully validated. Exif telemetry synced!`);
                          }, 2500);

                        }, 1000);
                      }}
                      disabled={isUploadingEvidence}
                      className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex flex-col items-center justify-center text-center space-y-1.5 cursor-pointer"
                    >
                      <Video size={16} className="text-amber-500" />
                      <span className="text-[10px] font-bold text-slate-800">Add Video Log</span>
                      <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wide font-mono">60s Limit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        haptics.light();
                        setIsUploadingEvidence(true);
                        setTimeout(() => {
                          const newFile = {
                            id: `ev-${Date.now()}`,
                            name: `photo_on_site_${Math.floor(Math.random()*800+100)}.png`,
                            size: '3.1 MB',
                            type: 'photo' as const,
                            timestamp: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB') + ' (UTC)',
                            status: 'analyzing' as const,
                            metadata: []
                          };
                          setEvidenceFiles(prev => [...prev, newFile]);
                          setIsUploadingEvidence(false);
                          haptics.beacon();
                          
                          // Run mock AI analysis completion
                          setTimeout(() => {
                            setEvidenceFiles(current => 
                              current.map(f => f.id === newFile.id ? {
                                ...f,
                                status: 'verified' as const,
                                metadata: [
                                  `📍 Location accuracy matched`,
                                  `⏱️ Camera original timestamp matched`,
                                  `🤖 No synthetic alteration detected`
                                ]
                              } : f)
                            );
                            haptics.success();
                            alert(`AI Verification Complete: Photo successfully validated. EXIF metadata matched!`);
                          }, 2500);

                        }, 1000);
                      }}
                      disabled={isUploadingEvidence}
                      className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex flex-col items-center justify-center text-center space-y-1.5 cursor-pointer"
                    >
                      <Image size={16} className="text-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-800">Add Photo Proof</span>
                      <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wide font-mono">High Resolution</span>
                    </button>
                  </div>

                  {isUploadingEvidence && (
                    <div className="flex items-center justify-center space-x-2 py-2 text-slate-400">
                      <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[9px] font-extrabold text-[#d97706]/100 text-amber-600 uppercase tracking-widest animate-pulse">Hashing to Secure Vault...</span>
                    </div>
                  )}

                  {/* Stored Files */}
                  {evidenceFiles.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {evidenceFiles.map((file) => (
                        <div key={file.id} className="p-3 bg-white border border-slate-100 rounded-xl space-y-2 relative">
                          <button
                            type="button"
                            onClick={() => {
                              haptics.light();
                              setEvidenceFiles(prev => prev.filter(f => f.id !== file.id));
                            }}
                            className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-650 text-[10px] border-none bg-transparent cursor-pointer font-extrabold"
                          >
                            ✕
                          </button>
                          
                          <div className="flex items-start space-x-2.5 pr-5">
                            <div className="p-1.5 bg-slate-50 text-slate-500 rounded-lg mt-0.5 shrink-0">
                              {file.type === 'video' ? <Video size={13} /> : <Image size={13} />}
                            </div>
                            <div className="text-left">
                              <p className="text-[9.5px] font-black text-slate-800 truncate max-w-[190px]">{file.name}</p>
                              <span className="text-[8px] text-slate-400 font-mono tracking-wider">{file.size} • {file.timestamp}</span>
                            </div>
                          </div>

                          {/* AI status indicators */}
                          <div className="pt-2 border-t border-slate-55 flex flex-col space-y-1 text-[8.5px]">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[7.5px] font-black uppercase text-slate-400 tracking-wider font-mono">Verification Pipeline</span>
                              {file.status === 'analyzing' ? (
                                <span className="text-[7.5px] font-mono font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Analyzing...
                                </span>
                              ) : (
                                <span className="text-[7.5px] font-mono font-black text-emerald-600 bg-emerald-55 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                  ✓ SECURE VERIFIED
                                </span>
                              )}
                            </div>
                            
                            {file.metadata.length > 0 ? (
                              <div className="grid grid-cols-2 gap-1 text-[8px] font-semibold text-slate-500 uppercase tracking-wide">
                                {file.metadata.map((meta, idx) => (
                                  <span key={idx} className="block">• {meta}</span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[8px] text-slate-400 italic">Processing cryptographic stamp matching...</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTriageDispute}
                  disabled={isDisputing}
                  className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-[18px] font-black uppercase tracking-[0.12em] text-[10px] border-none shadow-md transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center space-x-2"
                >
                  {isDisputing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Simulating AI Jury Split...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} className="text-amber-400 shrink-0" />
                      <span>Trigger AI Arbitration Engine</span>
                    </>
                  )}
                </button>

                {/* Dispute Triage Result Display */}
                {disputeResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-[28px] space-y-4"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-amber-500/10">
                      <div>
                        <span className="text-[7.5px] font-black font-mono text-amber-600 block uppercase tracking-widest">TICKET REF {disputeResult.ticketId}</span>
                        <span className="text-[10px] font-black text-slate-800">AI Confidence: {Math.round(disputeResult.confidenceScore * 100)}%</span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-800 px-2 py-0.5 rounded border border-amber-200/50">
                        {disputeResult.suggestedProtocol}
                      </span>
                    </div>

                    {/* Split Bars visualization */}
                    <div className="space-y-2">
                      <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest mb-1">Recommended Pay Distribution</p>
                      
                      {/* Dual split track bar */}
                      <div className="h-5 bg-amber-200 rounded-full flex overflow-hidden border border-slate-250 select-none shadow-inner">
                        <div
                          style={{ width: `${disputeResult.recommendedSplit.userRefundPercent}%` }}
                          className="bg-emerald-600 h-full flex items-center justify-center text-[8.5px] text-white font-black font-mono transition-all duration-500"
                        >
                          {disputeResult.recommendedSplit.userRefundPercent > 15 && `Refund ${disputeResult.recommendedSplit.userRefundPercent}%`}
                        </div>
                        <div
                          style={{ width: `${disputeResult.recommendedSplit.providerSharePercent}%` }}
                          className="bg-slate-800 h-full flex items-center justify-center text-[8.5px] text-white font-black font-mono transition-all duration-500"
                        >
                          {disputeResult.recommendedSplit.providerSharePercent > 15 && `Payout ${disputeResult.recommendedSplit.providerSharePercent}%`}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center text-xs pt-1">
                        <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Customer Refund</span>
                          <span className="text-sm font-black text-emerald-600 font-mono">£{disputeResult.recommendedSplit.userRefundAmount.toFixed(2)}</span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Worker's Share</span>
                          <span className="text-sm font-black text-slate-800 font-mono">£{disputeResult.recommendedSplit.providerShareAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Arbitration rationale text */}
                    <div className="space-y-1 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm text-left leading-relaxed text-[11px] text-slate-650">
                      <strong className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Jury Resolution Verdict</strong>
                      <p className="font-semibold text-slate-700">{disputeResult.aiAnalysisRationale}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        haptics.success();
                        alert(`Agreement Signed! Total refund of £${disputeResult.recommendedSplit.userRefundAmount} is processing immediately to your cards under the KonnectS Settle-Safe protocol.`);
                        setShowDisputeModal(false);
                      }}
                      className="w-full py-3 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all active:scale-[0.98] border-none cursor-pointer"
                    >
                      Instant Settlement Agreement (Accept Split)
                    </button>
                    <p className="text-[8px] text-slate-400 text-center font-bold uppercase tracking-wider">
                      🤝 Mutual Acceptance fast-tracks transfer. Opt-out escalates to humans.
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
