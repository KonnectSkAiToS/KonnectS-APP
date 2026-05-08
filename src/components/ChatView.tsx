/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage } from '../types';
import { sendMessageSafely } from '../services/chatService';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowLeft, ShieldCheck, User } from 'lucide-react';

interface ChatViewProps {
  recipientId: string;
  recipientName: string;
  onBack: () => void;
}

export function ChatView({ recipientId, recipientName, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.uid || !recipientId) return;

    // Fetch messages where this user is either sender or recipient
    // Note: Firestore composite queries need indexes. We filter by participants locally for simplicity in this demo.
    // Or we use a specific ChatRoom ID. For KonnectS, we'll use a unique ID based on both sorted IDs.
    const roomId = [user.uid, recipientId].sort().join('_');

    const q = query(
      collection(db, 'chats'),
      where('roomId', '==', roomId),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
    }, (error) => {
      console.error("Chat fetch failed", error);
      // Not throwing error to avoid breaking UI if index is missing
    });

    return () => unsubscribe();
  }, [user?.uid, recipientId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user?.uid || isSending) return;
    
    setIsSending(true);
    const success = await sendMessageSafely(user.uid, recipientId, input.trim());
    if (success) {
      setInput('');
    }
    setIsSending(false);
  };

  return (
    <div className="fixed inset-0 bg-bg z-[100] flex flex-col max-w-md mx-auto shadow-2xl">
      {/* Header */}
      <header className="p-4 bg-white border-b border-slate-100 flex items-center space-x-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-xl">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
            <User size={20} className="text-slate-400" />
          </div>
          <div>
            <h4 className="font-bold text-sm">{recipientName}</h4>
            <div className="flex items-center space-x-1">
              <ShieldCheck size={10} className="text-emerald-500" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verified Worker</p>
            </div>
          </div>
        </div>
      </header>

      {/* Safety Notice */}
      <div className="bg-amber-50 p-3 flex items-start space-x-2 border-b border-amber-100">
        <ShieldCheck size={14} className="text-amber-600 mt-0.5" />
        <p className="text-[10px] text-amber-700 leading-tight">
          <strong>Safety Warning:</strong> Sharing phone numbers or emails is blocked to protect your privacy. Use KonnectS to stay protected.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-50/30">
        {messages.map((msg, i) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <motion.div
              key={msg.id || i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                isMe ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-sm'
              }`}>
                {msg.text}
              </div>
            </motion.div>
          );
        })}
      </div>

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
    </div>
  );
}
