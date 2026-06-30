import { useState, useEffect, useCallback } from 'react';
import { Brain, Sparkles, TrendingUp, RefreshCw, BadgePercent, Check, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { ServiceBooking } from '../types';
import { haptics } from '../utils/haptics';

interface ExpenseInsightProps {
  history?: ServiceBooking[];
}

interface AlternativeOption {
  id: string;
  category: string;
  currentExpense: string;
  alternativeTitle: string;
  alternativeDesc: string;
  potentialSaving: number;
  carbonOffset: string;
  applied: boolean;
}

export function ExpenseInsight({ history = [] }: ExpenseInsightProps) {
  const [totalSpent, setTotalSpent] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [chartData, setChartData] = useState<any[]>([]);

  // Configurable budget-friendly service alternatives state
  const [alternatives, setAlternatives] = useState<AlternativeOption[]>([
    {
      id: 'alt-1',
      category: 'Home Service',
      currentExpense: 'Peak Deep Clean (£75.00)',
      alternativeTitle: 'Off-Peak Eco maintenance Loop',
      alternativeDesc: 'Pre-schedule weekly 1-hour maintenance instead of deep clearing cycles.',
      potentialSaving: 25,
      carbonOffset: '-2.5kg CO2',
      applied: false
    },
    {
      id: 'alt-2',
      category: 'Transport',
      currentExpense: 'Priority Private Airport Ride (£42.00)',
      alternativeTitle: 'Boundary-Route Carpool Shuttle',
      alternativeDesc: 'Share airport transit with pre-screened Shoreditch community members.',
      potentialSaving: 18,
      carbonOffset: '-12kg CO2 (High Green impact)',
      applied: false
    },
    {
      id: 'alt-3',
      category: 'Home Service',
      currentExpense: 'Emergency Electrical Callout (£120.00)',
      alternativeTitle: 'Preventative Quarterly Digital Diagnostic',
      alternativeDesc: 'Virtual live checkup with a gold-certified engineer prior to site trips.',
      potentialSaving: 60,
      carbonOffset: 'Carbon-neutral diagnostic',
      applied: false
    }
  ]);

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#a855f7'];

  const runAnalysis = useCallback(() => {
    setIsAnalyzing(true);
    haptics.medium();

    setTimeout(() => {
      // Simulate/aggregate actual booking history costs
      const homeCosts = (history || [])
        .filter(b => b.serviceType?.toLowerCase().includes('clean') || b.serviceType?.toLowerCase().includes('electric') || b.serviceType?.toLowerCase().includes('plumb') || b.serviceType?.toLowerCase().includes('repair'))
        .reduce((sum, b) => sum + (b.price || 60), 0) + 195; // base simulation history

      const transportCosts = (history || [])
        .filter(b => b.serviceType?.toLowerCase().includes('ride') || b.serviceType?.toLowerCase().includes('carpool'))
        .reduce((sum, b) => sum + (b.price || 25), 0) + 42; // base simulation history

      const marketplaceCosts = 16; // Simulated past marketplace handovers

      const aggregateSpent = homeCosts + transportCosts + marketplaceCosts;
      setTotalSpent(aggregateSpent);

      const d = [
        { name: 'Home Services', value: homeCosts, color: '#6366f1' },
         { name: 'Transport', value: transportCosts, color: '#f59e0b' },
         { name: 'Marketplace', value: marketplaceCosts, color: '#10b981' }
      ];
      setChartData(d.filter(item => item.value > 0));

      // Generate context-friendly smart feedback
      let feedback = '';
      if (homeCosts > transportCosts) {
        feedback = `Shoreditch property maintenance comprises ${(homeCosts / aggregateSpent * 100).toFixed(0)}% of your service outlays. Transitioning to predictive diagnostics can slash reactive premium charges by up to £85.`;
      } else {
        feedback = `Commuter transit carpools comprise ${(transportCosts / aggregateSpent * 100).toFixed(0)}% of your outlays. Opting into Shoreditch shared-boundary schedules minimizes local gridlock and unlocks optimal fare structures.`;
      }
      setAiAnalysis(feedback);
      setIsAnalyzing(false);
      haptics.success();
    }, 1100);
  }, [history]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) runAnalysis();
    });
    return () => {
      active = false;
    };
  }, [runAnalysis]);

  const toggleApplyAlternative = (id: string, savings: number) => {
    haptics.success();
    setAlternatives(prev => prev.map(alt => {
      if (alt.id === id) {
        const nextState = !alt.applied;
        if (nextState) {
          // If applying, show brief alert/notification
          alert(`Alternative applied! Potential Monthly Balance unlocked: +£${savings}.`);
        }
        return { ...alt, applied: nextState };
      }
      return alt;
    }));
  };

  const totalPossibleSavings = alternatives
    .filter(alt => alt.applied)
    .reduce((sum, alt) => sum + alt.potentialSaving, 0);

  return (
    <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] text-left space-y-5 shadow-sm">
      <div className="flex justify-between items-start flex-row">
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 rounded border border-indigo-100/40 dark:border-indigo-900">
            Cognitive Ledger
          </span>
          <h4 className="font-black text-base text-slate-900 dark:text-white tracking-tight mt-1 flex items-center gap-1.5 leading-none">
            <Brain size={18} className="text-violet-500 animate-pulse" />
            <span>AI Spending Insights</span>
          </h4>
        </div>
        <button
          onClick={runAnalysis}
          disabled={isAnalyzing}
          className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl cursor-pointer active:scale-95 transition-all text-slate-400 hover:text-slate-600 disabled:opacity-45"
        >
          <RefreshCw size={13} className={isAnalyzing ? 'animate-spin' : ''} />
        </button>
      </div>

      {isAnalyzing ? (
        <div className="py-12 text-center space-y-3.5">
          <div className="w-9 h-9 border-[3.5px] border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Recharts Aggregating Ledger Logs...</p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in select-none">
          
          {/* Expenditure Summary Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl">
              <span className="text-[8.5px] uppercase font-black tracking-widest text-slate-400 block mb-0.5">Aggregate Outlay</span>
              <span className="text-lg font-black font-mono text-slate-900 dark:text-white">£{totalSpent.toFixed(2)}</span>
            </div>
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900/30 rounded-2xl flex flex-col justify-center">
              <span className="text-[8.5px] uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 block mb-0.5">Applied Alt Savings</span>
              <span className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                +£{totalPossibleSavings.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Recharts Visual Data Integration */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">Expenditure Category Mix</span>
              <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 font-mono">RECHARTS ENGINE</span>
            </div>
            
            <div className="w-full h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                    formatter={(val: number) => [`£${val.toFixed(2)}`, 'Spent']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend label markers */}
            <div className="flex justify-around items-center pt-2 border-t border-slate-200/40 dark:border-slate-800/40 text-[9.5px] font-bold">
              {chartData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full block shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-650 dark:text-slate-350">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Cognitive Accountant Text Box */}
          <div className="p-4 bg-violet-50/50 dark:bg-violet-950/25 border border-violet-100/40 dark:border-violet-900/40 rounded-2xl flex items-start gap-2.5">
            <Sparkles size={16} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[9px] uppercase font-black tracking-widest text-violet-700 dark:text-violet-300 block">AI Auditor Recommendation</span>
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-350 leading-relaxed mt-0.5">
                {aiAnalysis}
              </p>
            </div>
          </div>

          {/* Interactive Budget-Friendly Alternatives Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-1">
                <BadgePercent size={14} className="text-emerald-500" />
                Budget-Friendly Alternatives
              </h5>
              <span className="text-[8px] font-extrabold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Action to Save
              </span>
            </div>

            <div className="space-y-2">
              {alternatives.map((alt) => (
                <div 
                  key={alt.id}
                  onClick={() => toggleApplyAlternative(alt.id, alt.potentialSaving)}
                  className={`p-3.5 rounded-2xl border transition-all text-left flex justify-between items-start cursor-pointer select-none ${
                    alt.applied 
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-250 dark:border-emerald-900 shadow-sm' 
                      : 'bg-slate-50/50 dark:bg-slate-950/30 border-transparent hover:border-slate-100 dark:hover:border-slate-850'
                  }`}
                >
                  <div className="space-y-1 mr-3 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded leading-none">
                        {alt.category}
                      </span>
                      <span className="text-[8.5px] font-mono text-slate-400 line-through">
                        {alt.currentExpense}
                      </span>
                    </div>
                    <p className="text-[11px] font-black text-slate-900 dark:text-white leading-tight">
                      {alt.alternativeTitle}
                    </p>
                    <p className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 leading-snug">
                      {alt.alternativeDesc}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 rounded leading-none py-0.5">
                        💰 Save £{alt.potentialSaving}
                      </span>
                      <span className="text-[8.5px] font-bold text-indigo-500 dark:text-indigo-400 font-mono">
                        🌿 {alt.carbonOffset}
                      </span>
                    </div>
                  </div>

                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                    alt.applied 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/20' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-transparent'
                  }`}>
                    {alt.applied ? <Check size={12} strokeWidth={3} /> : <div className="w-1.5 h-1.5 bg-slate-200 dark:bg-slate-750 rounded-full" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
