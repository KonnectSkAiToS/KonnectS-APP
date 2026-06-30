import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Sparkles, ChevronRight } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface SpotlightStep {
  target?: string; // CSS selector to point to (optional)
  title: string;
  description: string;
}

interface FeatureSpotlightProps {
  featureKey: string;
  title: string;
  steps: SpotlightStep[];
  onComplete?: () => void;
}

export function FeatureSpotlight({ featureKey, title, steps, onComplete }: FeatureSpotlightProps) {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem(`konnects_spotlight_seen_${featureKey}`);
    if (!hasSeen) {
      // Small delay before spotlight triggers to allow page load
      const timer = setTimeout(() => {
        setActive(true);
        haptics.medium();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [featureKey]);

  const handleNext = () => {
    haptics.light();
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    haptics.success();
    localStorage.setItem(`konnects_spotlight_seen_${featureKey}`, 'true');
    setActive(false);
    if (onComplete) onComplete();
  };

  if (!active) return null;

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-6 rounded-[28px] border border-indigo-500/20 shadow-2xl w-full max-w-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
              <Sparkles size={16} className="animate-pulse" />
              <span className="text-[10px] uppercase font-black tracking-widest">{title}</span>
            </div>
            <button
              onClick={handleClose}
              className="p-1 text-slate-450 hover:text-slate-700 dark:hover:text-white rounded-lg border-none bg-transparent cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-2.5">
            <h4 className="text-sm font-black text-slate-900 dark:text-white">{step.title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed font-semibold">
              {step.description}
            </p>
          </div>

          {/* Footer & Progress */}
          <div className="flex items-center justify-between mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-450">
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center space-x-1 cursor-pointer transition-all active:scale-95"
            >
              <span>{currentStep === steps.length - 1 ? 'Got it' : 'Next'}</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
