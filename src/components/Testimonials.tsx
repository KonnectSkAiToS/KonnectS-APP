import React, { useState, useEffect } from 'react';
import { Star, Shield, Check, MessageSquare, Award, ArrowRight, User } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export interface Review {
  id?: string;
  providerId?: string;
  reviewerName: string;
  rating: number;
  comment: string;
  isVerified: boolean;
  createdAt?: any;
}

const PRESEEDED_TESTIMONIALS: Record<string, Review[]> = {
  'spro-1': [
    { reviewerName: 'Alastair M.', rating: 5, comment: 'Dr. Carter was extremely gentle and thorough. She clarified my symptoms quickly. Highest level of UK medical professional service!', isVerified: true },
    { reviewerName: 'Harriet P.', rating: 5, comment: 'Professional, compassionate and professional. Highly recommended for family diagnoses.', isVerified: true }
  ],
  'spro-2': [
    { reviewerName: 'James L.', rating: 5, comment: 'Liam resolved our semantic model training bottlenecks in under an hour. Outstanding AI architecture and code clarity!', isVerified: true },
    { reviewerName: 'Sophie G.', rating: 5, comment: 'Incredible software mind. Configured our PyTorch pipelines perfectly.', isVerified: true }
  ],
  'spro-3': [
    { reviewerName: 'Kamil B.', rating: 5, comment: 'Marcus rewired our kitchen spotlights in no time. Completely compliant, safe and very professional. Fair pricing.', isVerified: true },
    { reviewerName: 'Aisha N.', rating: 4, comment: 'On-time and quickly figured out the short circuit in the attic. Excellent electrician.', isVerified: true }
  ],
  'spro-4': [
    { reviewerName: 'Eleanor R.', rating: 5, comment: 'Professor Hughes has an unparalleled depth of educational expertise. Superb chemistry tuition for kids.', isVerified: true }
  ],
  'spro-7': [
    { reviewerName: 'Thomas S.', rating: 5, comment: 'Arthur drew up sleek, modern extension layouts for our Victorian home in Shoreditch. Brilliant eye for detail.', isVerified: true }
  ],
  'spro-9': [
    { reviewerName: 'Finlay D.', rating: 5, comment: 'Mark fixed our ruptured mains pipe efficiently on a freezing winter night. Life saver!', isVerified: true },
    { reviewerName: 'Maya J.', rating: 4, comment: 'Fast turnaround, cleaned up after clearing the blocked drain filter. Thanks!', isVerified: true }
  ]
};

interface TestimonialsProps {
  providerId?: string;
  providerName?: string;
  productId?: string;
  productName?: string;
  onReviewAdded?: () => void;
}

export function Testimonials({ providerId, providerName, productId, productName, onReviewAdded }: TestimonialsProps) {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayTargetName = providerName || productName || 'Item';

  useEffect(() => {
    fetchReviews();
  }, [providerId, productId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let q;
      if (productId) {
        q = query(
          collection(db, 'reviews'),
          where('productId', '==', productId),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'reviews'),
          where('providerId', '==', providerId || 'spro-general'),
          orderBy('createdAt', 'desc')
        );
      }
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Review));
      
      const preseeded = providerId ? (PRESEEDED_TESTIMONIALS[providerId] || []) : [];
      // Combine Firestore comments and static ones
      setReviews([...docs, ...preseeded]);
    } catch (err) {
      console.warn('Reviews fetch failed or rules pending. Using seeded database profiles.', err);
      // Fallback
      if (providerId) {
        setReviews(PRESEEDED_TESTIMONIALS[providerId] || []);
      } else {
        setReviews([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmitting(true);
    try {
      const reviewData: any = {
        reviewerName: profile?.username || 'Verified Resident',
        rating,
        comment: comment.trim(),
        isVerified: true,
      };

      if (productId) {
        reviewData.productId = productId;
      } else {
        reviewData.providerId = providerId || 'spro-general';
      }

      await addDoc(collection(db, 'reviews'), {
        ...reviewData,
        createdAt: serverTimestamp()
      });

      setComment('');
      setRating(5);
      
      // Trigger refresh
      await fetchReviews();
      
      if (onReviewAdded) {
        onReviewAdded();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reviews');
    } finally {
      setSubmitting(false);
    }
  };

  // Speak review confirmation using Web Speech API
  const speakReviewConfirmation = () => {
    const synth = window.speechSynthesis;
    if (synth) {
      const text = `Thank you for posting your review for ${displayTargetName}! Your verified feedback has been published.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      synth.speak(utterance);
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="space-y-6 pt-5 mt-6 border-t border-slate-100">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center space-x-1.5">
            <Award size={14} className="text-indigo-600" />
            <span>Verified Testimonials</span>
          </h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 leading-none">Trust-score for {displayTargetName}</p>
        </div>
        <div className="flex items-center space-x-1.5 bg-amber-50/70 border border-amber-100 px-2.5 py-1 rounded-xl">
          <Star size={12} className="text-amber-500 fill-amber-500" />
          <span className="text-xs font-black text-amber-700">{averageRating} ({reviews.length})</span>
        </div>
      </div>

      {loading ? (
        <div className="py-4 flex justify-center">
          <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest animate-pulse">Retrieving Credentials...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="p-5 text-center bg-slate-50 border border-transparent rounded-2xl">
          <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">No customer feedback posted yet.</p>
          <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Be the first client to post a recommendation!</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[250px] overflow-y-auto no-scrollbar pr-1">
          {reviews.map((rev, idx) => (
            <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-1.5">
                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-[9px] font-black uppercase">
                    {rev.reviewerName.charAt(0)}
                  </div>
                  <span className="text-[11px] font-black text-slate-800">{rev.reviewerName}</span>
                  {rev.isVerified && (
                    <span className="inline-flex items-center text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <Check size={8} className="mr-0.5 stroke-[3]" /> Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      size={10} 
                      className={i < rev.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'} 
                    />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
                "{rev.comment}"
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add new review form */}
      <form onSubmit={(e) => { handleSubmitReview(e); speakReviewConfirmation(); }} className="p-4 bg-indigo-50/30 border border-indigo-150/45 rounded-2xl space-y-3.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-650 block">Share a Verified Recommendation</span>
        
        {/* Star Selection */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Your Rating:</span>
          <div className="flex items-center space-x-1">
            {Array.from({ length: 5 }).map((_, i) => {
              const currentStar = i + 1;
              const fill = (hoverRating !== null ? currentStar <= hoverRating : currentStar <= rating);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(currentStar)}
                  onMouseEnter={() => setHoverRating(currentStar)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-0.5 hover:scale-110 active:scale-95 transition-transform border-none bg-transparent cursor-pointer"
                >
                  <Star 
                    size={18} 
                    className={fill ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} 
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Input comment */}
        <div className="relative">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write comments about your experience..."
            className="w-full pl-4 pr-12 py-2.5 bg-white rounded-xl border border-slate-150 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-600"
          />
          <button
            type="submit"
            disabled={submitting || !comment.trim()}
            className="absolute right-1.5 top-1.5 p-1 bg-indigo-650 disabled:opacity-40 text-white rounded-lg hover:bg-slate-900 active:scale-95 transition-all border-none"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
