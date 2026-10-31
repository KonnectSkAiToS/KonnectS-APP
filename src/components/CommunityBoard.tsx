/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useDiscussions } from '../features/community/hooks/useCommunity';
import type { Reply, ThreadItem } from '../features/community/types';
import { MessageSquare, Pin, Send, Plus, X, Search, Heart, User, Filter, HelpCircle, Shield, AlertTriangle } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export function CommunityBoard() {
  const { user, profile } = useAuth();
  const { data: threads } = useDiscussions();
  const [openThread, setSelectedThread] = useState<ThreadItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'help' | 'general' | 'deals' | 'lost'>('general');
  
  // Reply State
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Always show the live version of the open thread (derived, so no effect or extra render is needed)
  const selectedThread = openThread ? threads.find(t => t.id === openThread.id) ?? openThread : null;

  const handlePostThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !user) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'discussions'), {
        title: newTitle,
        content: newContent,
        category: newCategory,
        authorName: profile?.username || 'Local Neighbor',
        authorId: user.uid,
        reactions: 0,
        replies: [],
        createdAt: serverTimestamp()
      });

      // Clear fields
      setNewTitle('');
      setNewContent('');
      setNewCategory('general');
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert('Error posting topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread || !user) return;

    try {
      const replyData: Reply = {
        id: 'reply-' + Date.now() + '-' + Math.random().toString(36).substring(4),
        authorName: profile?.username || 'Local Neighbor',
        authorId: user.uid,
        text: replyText,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      await updateDoc(doc(db, 'discussions', selectedThread.id), {
        replies: arrayUnion(replyData)
      });

      setReplyText('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleReaction = async (thread: ThreadItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'discussions', thread.id), {
        reactions: (thread.reactions || 0) + 1
      });
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'help': return 'bg-rose-50 text-rose-600 border-rose-100/60';
      case 'lost': return 'bg-amber-50 text-amber-600 border-amber-100/60';
      case 'deals': return 'bg-emerald-50 text-emerald-600 border-emerald-100/60';
      default: return 'bg-indigo-50 text-indigo-600 border-indigo-100/60';
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'help': return '🙋‍♀️ Help Needed';
      case 'lost': return '🔍 Lost & Found';
      case 'deals': return '🏷️ Local Deals';
      default: return '💬 General';
    }
  };

  const filteredThreads = threads.filter(t => {
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Row */}
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Search discussion threads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-3 bg-white rounded-2xl border border-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-3 bg-slate-950 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95 border-none cursor-pointer"
          title="New Topic"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex space-x-1.5 overflow-x-auto pb-1 checkScroller whitespace-nowrap">
        {['all', 'general', 'help', 'lost', 'deals'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
              filterCategory === cat
                ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-500'
            }`}
          >
            {cat === 'all' ? 'All Threads' : getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {/* Discussion List */}
      <div className="space-y-3">
        {filteredThreads.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <MessageSquare size={26} className="mx-auto mb-2 text-slate-300" />
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">No discussions found</h5>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Be the first to post a neighborhood update!</p>
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <motion.div
              key={thread.id}
              whileHover={{ y: -1 }}
              onClick={() => setSelectedThread(thread)}
              className="p-5 bg-white rounded-3xl border border-slate-100 hover:border-slate-200 shadow-sm transition-all duration-300 cursor-pointer text-left space-y-3 relative group overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border tracking-wider ${getCategoryColor(thread.category)}`}>
                  {getCategoryLabel(thread.category)}
                </span>
                <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-widest mt-1">
                  by {thread.authorName}
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-xs text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                  {thread.title}
                </h4>
                <p className="text-[10px] text-slate-400 font-bold line-clamp-2 leading-relaxed">
                  {thread.content}
                </p>
              </div>

              <div className="flex pt-2.5 border-t border-slate-50 justify-between items-center text-[10px] text-slate-400 font-bold">
                <button
                  onClick={(e) => handleReaction(thread, e)}
                  className="flex items-center space-x-1 hover:text-rose-500 bg-transparent border-none cursor-pointer"
                >
                  <Heart size={14} className="text-rose-400/80 fill-rose-50 hover:fill-rose-500 transition-colors" />
                  <span>{thread.reactions || 0}</span>
                </button>

                <div className="flex items-center space-x-1 text-slate-500 font-bold">
                  <MessageSquare size={13} className="text-indigo-500" />
                  <span>{thread.replies?.length || 0} replies</span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* New Topic Slide-up Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[1100] flex items-end justify-center p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative w-full max-w-sm bg-white rounded-t-[40px] p-6 shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Post New Discussion</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 border-none cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handlePostThread} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Select Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['general', 'help', 'lost', 'deals'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewCategory(cat as any)}
                        className={`p-2 rounded-xl text-[9px] font-black uppercase tracking-wider border text-center transition-all cursor-pointer ${
                          newCategory === cat
                            ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                            : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {getCategoryLabel(cat).split(' ')[1]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Topic Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lost Cat in Shoreditch / Plumbing Recommendation..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-semibold text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Full Description</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Elaborate on details of your inquiry..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-semibold text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all border-none cursor-pointer"
                >
                  {isSubmitting ? 'Publishing Topic...' : 'Share With Neighbors'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Persistent Thread Conversation Detail Drawer */}
      <AnimatePresence>
        {selectedThread && (
          <div className="fixed inset-0 z-[1100] flex items-end justify-center p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedThread(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative w-full max-w-sm bg-white rounded-t-[40px] p-6 shadow-2xl flex flex-col max-h-[85vh] text-left"
            >
              {/* Drawer Header */}
              <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                <div className="flex-1 mr-4 min-w-0">
                  <span className={`px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase border tracking-wider inline-block mb-1.5 ${getCategoryColor(selectedThread.category)}`}>
                    {getCategoryLabel(selectedThread.category)}
                  </span>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight leading-snug truncate">
                    {selectedThread.title}
                  </h3>
                  <p className="text-[8px] font-mono text-slate-400 font-extrabold uppercase mt-1">
                    posted by {selectedThread.authorName}
                  </p>
                </div>
                <button onClick={() => setSelectedThread(null)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 border-none cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              {/* Topic Post Content (Scrollable) */}
              <div className="flex-1 overflow-y-auto py-4 space-y-5 checkScroller">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                  <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                    {selectedThread.content}
                  </p>
                </div>

                {/* Sub-header */}
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                    Conversations ({selectedThread.replies?.length || 0})
                  </span>
                </div>

                {/* Replies Stream list */}
                <div className="space-y-3">
                  {!selectedThread.replies || selectedThread.replies.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-medium text-center py-4">No replies yet. Speak up and help your neighbor out!</p>
                  ) : (
                    selectedThread.replies.map((rep) => (
                      <div key={rep.id} className="p-3 bg-white rounded-2xl border border-slate-100 flex items-start space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-50 text-indigo-600 flex items-center justify-center shrink-0 font-black text-xs">
                          {rep.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-extrabold text-slate-800 uppercase tracking-tight">{rep.authorName}</span>
                            <span className="text-[8px] font-mono font-bold text-slate-400">{rep.createdAt}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{rep.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Reply Input Form */}
              <form onSubmit={handlePostReply} className="pt-3 border-t border-slate-100 flex space-x-2">
                <input
                  type="text"
                  required
                  placeholder="Type a helpful reply to neighbors..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border-none outline-none font-semibold text-xs"
                />
                <button
                  type="submit"
                  className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-colors border-none cursor-pointer"
                >
                  <Send size={14} />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
