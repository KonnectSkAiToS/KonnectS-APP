import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { useCommunityFeed } from '../features/community/hooks/useCommunity';
import type { PulseItem } from '../features/community/types';
import { Calendar, Users, HeartHandshake, TrendingUp, Check, Plus, MessageSquare, MapPin, X } from 'lucide-react';

export function CommunityPulse() {
  const { user, profile } = useAuth();
  const { data: pulseItems, loading } = useCommunityFeed();
  const [activeTab, setActiveTab] = useState<'all' | 'project' | 'volunteer' | 'discussion'>('all');

  // New posting fields
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<'project' | 'volunteer' | 'discussion'>('project');
  const [newLocation, setNewLocation] = useState('');
  const [newDateOrReplies, setNewDateOrReplies] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSupport = async (itemId: string) => {
    try {
      const docRef = doc(db, 'community_pulse', itemId);
      await updateDoc(docRef, {
        supportersCount: increment(1)
      });
    } catch (err) {
      console.error("Support update failed:", err);
    }
  };

  const handleRsvp = async (itemId: string, item: PulseItem) => {
    if (!user) return;
    const rsvpList = item.rsvpedUsers || [];
    const editList = rsvpList.includes(user.uid) 
      ? rsvpList.filter(id => id !== user.uid)
      : [...rsvpList, user.uid];

    try {
      const docRef = doc(db, 'community_pulse', itemId);
      await updateDoc(docRef, {
        rsvpedUsers: editList
      });
      
      // Award rewards points dynamically to local user representation on register
      if (!rsvpList.includes(user.uid) && item.pointsReward) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          rewardsPoints: increment(item.pointsReward)
        });
      }
    } catch (err) {
      console.error("RSVP update failed:", err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'community_pulse'), {
        title: newTitle.trim(),
        description: newDesc.trim(),
        category: newCategory,
        location: newLocation.trim() || 'Shoreditch Grid',
        dateOrReplies: newDateOrReplies.trim() || (newCategory === 'discussion' ? '0 replies' : 'Dates TBA'),
        supportersCount: 1,
        rsvpedUsers: [],
        pointsReward: newCategory === 'discussion' ? 0 : 15,
        createdAt: serverTimestamp()
      });

      setNewTitle('');
      setNewDesc('');
      setNewLocation('');
      setNewDateOrReplies('');
      setShowAddForm(false);
    } catch (e) {
      console.error("Post writing failure:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = pulseItems.filter(item => {
    if (activeTab === 'all') return true;
    return item.category === activeTab;
  });

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-[36px] p-6 space-y-6 shadow-xs text-left">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-1 px-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg text-xs font-black">Pulse</span>
            Community Pulse Feed
          </h3>
          <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">Neighbourhood Projects & Action items</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1 p-2 bg-indigo-50 border-none hover:bg-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
        >
          {showAddForm ? <X size={12} /> : <Plus size={12} />}
          <span>{showAddForm ? 'Close' : 'Post Update'}</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreatePost}
            className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3 overflow-hidden text-xs"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-1">Pulse Title</label>
                <input
                  type="text"
                  placeholder="e.g., Solar collective panel assembly"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-1">Pulse Category</label>
                <select
                  value={newCategory}
                  onChange={(e: any) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl font-bold"
                >
                  <option value="project">🌱 Green Project</option>
                  <option value="volunteer">🤝 Volunteer Action</option>
                  <option value="discussion">💬 Citizen Discussion</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-1">Initiative Description</label>
              <textarea
                rows={2}
                placeholder="What is going on? Write some specific call to action details."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-1">Vibe/Coordinates</label>
                <input
                  type="text"
                  placeholder="e.g. Shoreditch Library"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-1">Time schedule or Replies</label>
                <input
                  type="text"
                  placeholder="e.g., Sunday 2pm"
                  value={newDateOrReplies}
                  onChange={(e) => setNewDateOrReplies(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border-none"
            >
              {isSubmitting ? 'Posting...' : '🚀 Publish Community Pulse'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Pill Filters */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar border-b border-slate-150/50">
        {[
          { id: 'all', label: '📣 All Pulses' },
          { id: 'project', label: '🌱 Projects' },
          { id: 'volunteer', label: '🤝 Volunteering' },
          { id: 'discussion', label: '💬 Discussions' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 text-[9.5px] font-black uppercase tracking-wider rounded-full shrink-0 border-none transition-all cursor-pointer ${
              activeTab === tab.id 
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' 
                : 'bg-slate-50 text-slate-500 hover:bg-slate-150 drak:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs">Loading neighborhood active stream...</div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => {
              const isRsvped = user && item.rsvpedUsers?.includes(user.uid);
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-5 border border-slate-150/60 dark:border-slate-850 rounded-[28px] hover:border-slate-200 transition-all space-y-4 bg-slate-50/55 dark:bg-slate-900/30"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        item.category === 'project' 
                          ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/20 dark:text-teal-400' 
                          : item.category === 'volunteer' 
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' 
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400'
                      }`}>
                        {item.category === 'project' && <TrendingUp size={10} />}
                        {item.category === 'volunteer' && <HeartHandshake size={10} />}
                        {item.category === 'discussion' && <MessageSquare size={10} />}
                        {item.category}
                      </span>
                      <h4 className="font-extrabold text-[#0f172a] dark:text-slate-100 text-sm">{item.title}</h4>
                    </div>

                    {item.pointsReward && item.pointsReward > 0 && (
                      <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 border border-emerald-100/50">
                        +{item.pointsReward} Points
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>

                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 flex-wrap gap-2 pt-1 border-t border-dashed border-slate-200 dark:border-slate-850">
                    <div className="flex items-center space-x-3.5 flex-wrap gap-1">
                      <span className="flex items-center gap-1.5"><MapPin size={11} className="text-indigo-400" />{item.location}</span>
                      <span className="flex items-center gap-1.5"><Calendar size={11} className="text-indigo-400" />{item.dateOrReplies}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleSupport(item.id)}
                        className="flex items-center gap-1 py-1 px-2.5 bg-slate-100 border-none dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-350 rounded-xl cursor-pointer"
                        title="Vouch for this project"
                      >
                        👍 <span className="font-sans font-black">{item.supportersCount}</span>
                      </button>

                      {item.category !== 'discussion' && (
                        <button
                          onClick={() => handleRsvp(item.id, item)}
                          className={`flex items-center gap-1 py-1 px-3 border-none rounded-xl cursor-pointer font-black uppercase tracking-wider text-[9px] transition-colors ${
                            isRsvped 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {isRsvped ? <Check size={10} /> : <Users size={10} />}
                          <span>{isRsvped ? 'Joined' : 'Join'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
