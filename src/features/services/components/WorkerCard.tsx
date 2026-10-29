import { motion } from 'framer-motion';
import { Briefcase, Clock, MapPin, MessageSquare, Sparkles, Star, Zap } from 'lucide-react';
import type { Worker } from '../types';

interface WorkerCardProps {
  pro: Worker;
  index: number;
  requestDisabled: boolean;
  onRequest: (pro: Worker) => void;
  onChat: (pro: Worker) => void;
  onQuickTip: (pro: Worker) => void;
  onSave: (pro: Worker) => void;
  onHide: (pro: Worker) => void;
}

export function WorkerCard({ pro, index, requestDisabled, onRequest, onChat, onQuickTip, onSave, onHide }: WorkerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (info.offset.x > 80) onSave(pro);
        else if (info.offset.x < -80) onHide(pro);
      }}
      className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-start space-x-4 relative group"
    >
    {pro.isDynamic && (
      <span className="absolute top-3 right-3 bg-indigo-600/10 text-indigo-600 text-[7px] font-mono font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center space-x-0.5">
        <Sparkles size={8} />
        <span>Exact AI Match</span>
      </span>
    )}
    
    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
      <Briefcase size={22} />
    </div>
    
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-start mb-0.5">
        <div className="flex items-center space-x-2 flex-wrap gap-1">
           <h4 className="font-black text-slate-900 text-xs truncate max-w-[130px]">{pro.name}</h4>
           
           {/* Worker status indicator */}
           {(() => {
             const isBusy = pro.status === 'busy';
             return isBusy ? (
               <span className="inline-flex items-center space-x-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-50 text-red-650 border border-red-100">
                 <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                 <span>Busy</span>
               </span>
             ) : (
               <span className="inline-flex items-center space-x-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                 <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                 <span>Active</span>
               </span>
             );
           })()}

           {/* Interactive Quick Tip Advice Badge */}
           <button
             onClick={(e) => { e.stopPropagation(); onQuickTip(pro); }}
             className="inline-flex items-center space-x-0.5 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 active:scale-95 transition-all cursor-pointer select-none"
           >
             <span>💡 Quick Tip</span>
           </button>
        </div>
        <div className="flex items-center space-x-1 text-amber-500">
          <Star size={11} fill="currentColor" />
          <span className="text-[10px] font-black">{pro.rating}</span>
        </div>
      </div>
      
      <p className="text-[11px] font-extrabold text-slate-500 mb-2">{pro.role}</p>
      
      <div className="flex items-center space-x-3.5 mb-4 text-[9.5px]">
        <div className="flex items-center space-x-1 text-slate-400">
          <Clock size={11} />
          <span className="font-bold uppercase tracking-wider">Fast Route</span>
        </div>
        <span className="font-extrabold text-slate-900 font-mono">£{pro.price}/hr</span>
        <div className="flex items-center space-x-1 text-slate-400">
          <MapPin size={10} className="text-emerald-500 shrink-0" />
          <span className="truncate max-w-[80px] font-medium">{pro.locationName?.split('•')[0]}</span>
        </div>
      </div>

      <div className="flex space-x-2">
        <button 
          onClick={() => onRequest(pro)}
          disabled={requestDisabled}
          className="flex-1 py-3 bg-slate-900 border border-transparent hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center space-x-1.5 shadow-sm"
        >
          <Zap size={11} />
          <span>Request Pro</span>
        </button>
        <button 
          onClick={() => onChat(pro)}
          className="px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-black rounded-xl text-[10px] uppercase border-none active:scale-95 transition-transform flex items-center space-x-1"
        >
          <MessageSquare size={12} />
          <span>Chat</span>
        </button>
      </div>
    </div>
  </motion.div>
  );
}
